/**
 * 字段落点体检：逐个点开页面上的每条记录，把 mock 里对应那条记录的每一个叶子字段的值
 * 拿去页面上找。找不到就是「信息被删掉了」。
 *
 * 只查值不查字段名：契约字段名是英文，页面上写的是中文标签，
 * 对得上的只能是值本身。空字符串、0 之类的按契约本来就允许缺省，跳过。
 *
 * 三档宽度都要跑。只跑 1536 会漏掉最阴的一类问题：某条字段的唯一落点是个
 * 会随版面收起来的装饰件（时间尺刻度、悬停提示、并排才显示的副栏），
 * 于是这条字段能不能读到取决于窗口多宽。单档审计永远是绿的。
 *
 * 加 --no-attrs 只认可见文本，不认 title / aria-label。用来回答另一个问题：
 * 这条字段是真排在页面上，还是只藏在一个悬停才出现的气泡里。
 * 平时跑不带这个开关（title 也算落点），重构完想确认没在糊审计时跑一次。
 *
 * 每页查哪些记录、怎么点开，写在下面的 PAGES 里。原来这份表是写死角色档案的，
 * 于是给另外三页传文件名只会得到一句「查 0 项」的假绿——重构完那几页的时候
 * 恰恰最需要它。改版式可以，改了记录的点开方式要记得跟着改这里。
 *
 *   node _tools/field-audit.cjs [页面文件名] [--no-attrs]
 *   node _tools/field-audit.cjs --all
 */
const { chromium } = require('playwright-core');
const { pathToFileURL } = require('url');
const fs = require('fs');
const path = require('path');

const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const BASE = path.join(__dirname, '..');
const ARGS = process.argv.slice(2);
const NO_ATTRS = ARGS.includes('--no-attrs');
const ALL = ARGS.includes('--all');

/* 每页的「有哪些记录」和「怎么点开第 n 条」。
   pick 会被搬进浏览器里跑，别引用 Node 这边的东西。 */
const PAGES = {
  '角色档案.html': {
    subjects: (bw) => [
      ...bw.npcs.map((p) => ({ p, kind: '固定人物' })),
      ...bw.candidates.map((p) => ({ p, kind: '候选人物' })),
    ],
    pick: (name) => {
      const el = document.querySelector(`.rcard[data-n="${CSS.escape(name)}"]`);
      if (!el) return false;
      el.click();
      return true;
    },
  },
  '势力与地区.html': {
    subjects: (bw) => [
      ...bw.factions.map((p) => ({ p, kind: '势力' })),
      ...bw.regions.map((p) => ({ p, kind: '地区' })),
    ],
    /* 势力靠格局图上的节点选，地区靠展开地区行——两者都没有一个稳定的
       「第 n 个按钮」，但都收在 pickNode 一个入口里，直接调它。 */
    pick: (name, kind) => {
      if (typeof pickNode !== 'function') return false;
      pickNode((kind === '势力' ? 'f:' : 'r:') + name);
      return true;
    },
  },
  '任务与事件.html': {
    subjects: (bw) => [
      ...bw.tasks.map((p) => ({ p, kind: '任务' })),
      ...bw.events.map((p) => ({ p, kind: '事件' })),
    ],
    /* 任务和事件都分页，要找的那条可能不在当前页——先翻到它所在的那一页。 */
    pick: (name, kind) => {
      const sel = kind === '任务' ? '.tcard' : '.ev';
      for (let i = 0; i < 40; i++) {
        const hit = [...document.querySelectorAll(sel)]
          .find((e) => e.innerText.includes(name));
        if (hit) { hit.click(); return true; }
        const next = document.querySelector(
          kind === '任务' ? '#taskPager .pg:last-child' : '#evPager .pg:last-child');
        if (!next || next.disabled) return false;
        next.click();
      }
      return false;
    },
  },
  '总览.html': {
    // 变化流是一整份列表，没有「点开某一条」这回事；翻页由外面的 rewind + 翻页扫描兜着
    subjects: (bw) => (bw.changes || []).map((p) => ({ p, kind: '变化' })),
    pick: () => true,
  },
};

const FILE = ARGS.find((a) => !a.startsWith('--')) || '角色档案.html';

/** 把一条记录摊平成 [字段路径, 值] 列表，数组下标写成 [i] */
function flatten(obj, prefix, out) {
  for (const [k, v] of Object.entries(obj || {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v === null || v === undefined || v === '') continue;
    if (Array.isArray(v)) {
      if (!v.length) continue;
      v.forEach((item, i) => {
        if (item && typeof item === 'object') flatten(item, `${key}[${i}]`, out);
        else out.push([`${key}[${i}]`, String(item)]);
      });
    } else if (typeof v === 'object') {
      flatten(v, key, out);
    } else {
      out.push([key, String(v)]);
    }
  }
  return out;
}

/* 契约里的时间戳长这样：「霜月12日 16:00」。页面上通常拆开排，
   比如日程卡写的是「16:00 – 18:20　霜月12日」——两截都在，只是不连着。
   整串找不到就退一步按空白切，每一截都得找到才算数。
   只对时间戳放宽：别的字段仍要求整串命中，否则这条会把真窟窿一起放过去。 */
/* 契约里有、但本来就不该出现在玩家眼前的字段。跟 field-coverage.cjs 的 EXEMPT 同一份口径，
   写在这儿是为了让「豁免」和「漏了」分开：漏了要修，豁免了要有理由。 */
const EXEMPT = {
  change_key: '技术去重键，后台自己用',
};

const STAMP = /^\S*\d+日\s+\d{1,2}:\d{2}$/;
const found = (hay, val) => {
  if (hay.includes(val.replace(/\s+/g, ''))) return true;
  if (!STAMP.test(val)) return false;
  return val.split(/\s+/).every((part) => hay.includes(part));
};

async function auditPage(browser, file) {
  const cfg = PAGES[file];
  if (!cfg) {
    console.log(`× ${file} 不在 PAGES 里，不知道该点开哪些记录`);
    return 1;
  }
  const raw = JSON.parse(fs.readFileSync(path.join(BASE, 'mock', 'world-state-v09.json'), 'utf8'));
  const bw = raw.background_world;
  const people = cfg.subjects(bw);

  const WIDTHS = [1536, 1280, 390];
  const missAt = new Map();   // 「记录 · 字段 = 值」 → 在哪几档缺
  const dead = new Set();     // 压根点不开的记录
  let checkTotal = 0;

  console.log(`\n=== ${file}　${people.length} 条记录`);
  for (const width of WIDTHS) {
    const page = await browser.newPage({ viewport: { width, height: 1200 } });
    await page.goto(pathToFileURL(path.join(BASE, file)).href, { waitUntil: 'load' });
    await page.addScriptTag({ content: `window.__noAttrs=${NO_ATTRS}` });
    await page.waitForTimeout(500);

    /* 每查一条记录都先把所有翻页条退回第一页。上一条记录扫完时页码停在最后一页，
       不退回去的话：要找的卡可能在前面的页上，翻页只往后走就永远找不到；
       只读一次页面的那种页（总览的变化流）也只会读到最后一页。

       认 data-d 而不是 .pg：页面上有两种翻页件——底下一整行的翻页条（.pg），
       和名录那种只有一对左右箭头的（.stripnav）。共同点是按钮上的 data-d。 */
    const rewind = async () => {
      for (let i = 0; i < 20; i++) {
        const moved = await page.evaluate(() => {
          let any = false;
          document.querySelectorAll('button[data-d="-1"]').forEach((b) => {
            if (!b.disabled) { b.click(); any = true }
          });
          return any;
        });
        if (!moved) return;
        await page.waitForTimeout(60);
      }
    };

    let missHere = 0, checkHere = 0;
    for (const { p, kind } of people) {
      const label = p.name || kind;
      await rewind();
      const ok = await page.evaluate(([fn, n, k]) => {
        try { return eval(`(${fn})`)(n, k) } catch (e) { return false }
      }, [cfg.pick.toString(), p.name, kind]);
      if (!ok) {
        if (!dead.has(label)) { console.log(`  × ${label} 在页面上点不开`); dead.add(label) }
        missHere++; continue;
      }
      await page.waitForTimeout(120);

      // 页面上「能被读到的信息」= 可见文本 + title/aria-label（折叠进 title 的说明也算落点）
      const grab = () => page.evaluate(() => {
        /* 三页现在都走「窄栏摘要 + 宽浮层看全文」，而 hidden 的 .sheet 是 display:none，
           正文一个字都不在 innerText 里——只在浮层里排开的字段会被误判成数据丢了，
           页面就被逼着在摘要行上挂一堆 title 去糊审计，而 title 恰恰是那种
           会随版面消失的落点。所以抓文本之前先把浮层打开。
           顺序不能反：内容是点出口时才渲染的，先点出口，再取消隐藏，否则抓到一个空壳。

           只认 data-open-sheet 这一个标记。原来这里还列着 .dmore，那是角色档案页
           自己的类名——另外两页的浮层入口叫 #openFull 和 #dossierBtn，一个都点不开，
           于是那两页的浮层内容从来没被审过。新增浮层记得给入口挂上这个属性。 */
        document.querySelectorAll('[data-open-sheet]').forEach((b) => { try { b.click() } catch (e) {} });
        document.querySelectorAll('.sheet[hidden]').forEach((s) => { s.hidden = false });
        const t = document.body.innerText;
        if (window.__noAttrs) return t.replace(/\s+/g, '');
        const attrs = [...document.querySelectorAll('[title],[aria-label],[data-toast]')]
          .map((e) => (e.getAttribute('title') || '') + ' ' + (e.getAttribute('aria-label') || '') + ' ' + (e.dataset.toast || ''))
          .join(' ');
        return (t + ' ' + attrs).replace(/\s+/g, '');
      });

      /* 翻页翻走的内容不算丢。列表分页是刻意的取舍（首屏只放最近几条），
         跟"这条字段页面上根本没排"是两回事——不翻一遍，凡是超出首页的记录
         都会被报成数据丢了，然后逼着页面取消分页去糊审计。 */
      let hay = await grab();
      for (let round = 0; round < 20; round++) {
        const moved = await page.evaluate(() => {
          let any = false;
          document.querySelectorAll('button[data-d="1"]').forEach((b) => {
            if (!b.disabled) { b.click(); any = true }
          });
          return any;
        });
        if (!moved) break;
        await page.waitForTimeout(100);
        hay += await grab();
      }

      for (const [key, val] of flatten(p, '', [])) {
        // 纯枚举值（全小写英文）页面上是翻译过的中文，逐条对照词典太脆，交给 vocab 自己的告警
        if (/^[a-z_]+$/.test(val)) continue;
        if (EXEMPT[key.split('.').pop().replace(/\[\d+\]$/, '')]) continue;
        // 数值 0 在契约里表示「非人物目标不适用」，不要求显示
        if (val === '0') continue;
        checkHere++;
        if (!found(hay, val)) {
          missHere++;
          const id = `${label}（${kind}） ${key} = ${val.length > 30 ? val.slice(0, 30) + '…' : val}`;
          if (!missAt.has(id)) missAt.set(id, []);
          missAt.get(id).push(width);
        }
      }
    }
    await page.close();
    checkTotal = checkHere;
    console.log(`  ${missHere ? '×' : '√'} ${width}px　查 ${checkHere} 项，缺 ${missHere}`);
  }

  if (!missAt.size && !dead.size) {
    console.log(`  共 ${checkTotal} 项 × ${WIDTHS.length} 档，全部能在页面上找到落点。`);
    return 0;
  }
  if (dead.size) console.log(`  ${dead.size} 条记录点不开，它们的字段一项都没查到。`);

  // 只在部分宽度缺的，是最需要先看的：说明这条字段的落点会随版面消失
  const partial = [...missAt].filter(([, w]) => w.length < WIDTHS.length);
  const always = [...missAt].filter(([, w]) => w.length === WIDTHS.length);
  if (partial.length) {
    console.log('  落点随版面消失（同一条字段换个宽度就找不到了）：');
    partial.forEach(([id, w]) => console.log(`    ${id}\n       缺于 ${w.join(' / ')}px`));
  }
  if (always.length) {
    console.log('  三档都缺：');
    always.forEach(([id]) => console.log(`    ${id}`));
  }
  return missAt.size + dead.size;
}

(async () => {
  const browser = await chromium.launch({
    headless: true, executablePath: EDGE, args: ['--allow-file-access-from-files'],
  });
  const files = ALL ? Object.keys(PAGES) : [FILE];
  let bad = 0;
  for (const f of files) bad += await auditPage(browser, f);
  await browser.close();
  console.log(bad ? `\n共 ${bad} 条字段找不到落点。` : '\n全部字段都有落点。');
  process.exitCode = bad ? 1 : 0;
})();
