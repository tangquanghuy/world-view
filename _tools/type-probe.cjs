/**
 * 排版体检：量出页面上每一类文字的实际字号、字重、行高和对比度。
 * 按 (选择器 + 字号 + 颜色) 归类，同一类只报一次，附一段实际文本方便定位。
 *
 * 判定线：
 *   正文 ≥14px，辅助文字 ≥13px，低于 13px 一律报
 *   对比度按 WCAG AA：普通字 4.5，大字（≥18.66px 或 ≥14px 且 bold）3.0
 *
 *   node _tools/type-probe.cjs [页面.html]
 */
const { chromium } = require('playwright-core');
const { pathToFileURL } = require('url');
const fs = require('fs');
const path = require('path');

const EDGE = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find((p) => fs.existsSync(p));

const BASE = path.join(__dirname, '..');
const file = process.argv[2] || '任务与事件.html';

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: EDGE, args: ['--allow-file-access-from-files'] });
  const page = await browser.newPage({ viewport: { width: 1536, height: 1200 } });
  await page.goto(pathToFileURL(path.join(BASE, file)).href, { waitUntil: 'load' });
  await page.waitForTimeout(600);

  /* 浮层默认 display:none，里面的字一类都量不到——而浮层恰恰是排全量字段的地方，
     字号最容易在那儿悄悄掉下去。进来先把带 data-open-sheet 的入口全点开。
     顺序不能反：内容是点出口时才渲染的，先点出口，再取消隐藏。 */
  await page.evaluate(() => {
    document.querySelectorAll('[data-open-sheet]').forEach((b) => { try { b.click() } catch (e) {} });
    document.querySelectorAll('.sheet[hidden]').forEach((s) => { s.hidden = false });
  });
  await page.waitForTimeout(400);

  const rows = await page.evaluate(() => {
    const lum = (rgb) => {
      const c = rgb.map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const parse = (s) => (s.match(/[\d.]+/g) || []).slice(0, 4).map(Number);
    const ratio = (fg, bg) => {
      const a = lum(fg) + 0.05, b = lum(bg) + 0.05;
      return Math.round((Math.max(a, b) / Math.min(a, b)) * 100) / 100;
    };
    /* 元素背后第一个不透明的背景色。
       渐变背景的 backgroundColor 是 transparent，直接往上找会一路穿到白底，
       把白底上的白字算成对比度 1.15。遇到 background-image 就放弃判定。 */
    const bgOf = (el) => {
      for (let n = el; n; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.backgroundImage && cs.backgroundImage !== 'none') return null;
        const c = parse(cs.backgroundColor);
        if (c.length === 3 || (c[3] ?? 1) > 0.85) return c.slice(0, 3);
      }
      return [255, 255, 255];
    };
    const sel = (el) => {
      const cls = [...el.classList].filter((c) => !/^h-/.test(c)).slice(0, 2).join('.');
      return el.tagName.toLowerCase() + (cls ? '.' + cls : '');
    };

    const out = new Map();
    for (const el of document.querySelectorAll('body *')) {
      // 只看直接持有文本的元素，避免把容器算成一份
      const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join('').trim();
      if (!own) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || !el.offsetParent) continue;

      const size = parseFloat(cs.fontSize);
      const weight = Number(cs.fontWeight);
      const lh = cs.lineHeight === 'normal' ? size * 1.2 : parseFloat(cs.lineHeight);
      const fg = parse(cs.color).slice(0, 3);
      const bg = bgOf(el);
      const key = `${sel(el)}|${size}|${weight}|${cs.color}`;
      if (out.has(key)) { out.get(key).n++; continue; }
      out.set(key, {
        sel: sel(el), size, weight, lh: Math.round((lh / size) * 100) / 100,
        contrast: bg ? ratio(fg, bg) : null, big: size >= 18.66 || (size >= 14 && weight >= 700),
        text: own.replace(/\s+/g, ' ').slice(0, 24), n: 1,
      });
    }
    return [...out.values()];
  });
  await browser.close();

  // ✓ ✦ 这类装饰字形不按正文要求判定
  const GLYPH = /^[✓✦✧←→›·—+\s]*$/;

  const bad = [];
  let small = 0;
  rows.forEach((r) => {
    r.need = r.big ? 3 : 4.5;
    r.glyph = GLYPH.test(r.text);
    if (r.size < 14 && !r.glyph) small += r.n;
    if (r.glyph) return;
    if (r.size < 13) bad.push({ ...r, why: `字号 ${r.size}px 偏小` });
    else if (r.contrast !== null && r.contrast < r.need) bad.push({ ...r, why: `对比度 ${r.contrast} < ${r.need}` });
  });

  rows.sort((a, b) => a.size - b.size || (a.contrast ?? 99) - (b.contrast ?? 99));
  console.log(`\n${file}　文字类目 ${rows.length} 种\n${'-'.repeat(84)}`);
  console.log('  字号  行高  字重  对比度      选择器                        示例');
  rows.forEach((r) => {
    const flag = !r.glyph && (r.size < 13 || (r.contrast !== null && r.contrast < r.need)) ? '!' : ' ';
    const c = r.contrast === null ? '  渐变' : String(r.contrast).padStart(6);
    console.log(`${flag} ${String(r.size).padStart(5)} ${String(r.lh).padStart(5)} ${String(r.weight).padStart(5)} ${c}   ${r.sel.padEnd(28)} ${r.text}`);
  });

  console.log(`\n${'-'.repeat(84)}`);
  console.log(`小于 14px 的正文元素共 ${small} 个（装饰字形不计）`);
  if (!bad.length) { console.log('字号与对比度全部达标。'); return; }
  console.log(`不达标 ${bad.length} 处:`);
  bad.forEach((r) => console.log(`  ${r.sel.padEnd(26)} ${r.why}　「${r.text}」`));
  process.exitCode = 1;
})();
