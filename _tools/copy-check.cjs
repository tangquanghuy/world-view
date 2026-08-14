/**
 * 文案自查：盯 README「文案规矩」第 7 条——标题和字段名是名词，不是问句。
 *
 * 这条规矩是踩出来的。角色档案页一度整页写成「这个人是谁」「知道些什么」
 * 「答应了谁什么」「在纠结什么」「眼下的难处」，用户念完的评价是「伪人感非常强烈」。
 * 反方向也翻过车：为了不像术语而硬凑「众人此刻」「新近事态」这种文艺词组。
 * 两头都靠人眼盯不住，写成脚本。
 *
 * 查三样：
 *   1. 问句味  标题／字段名／胶囊里出现疑问词或口语句式
 *   2. 文艺味  硬凑的词组（此刻、事态这类没有实指的字）
 *   3. 同屏重名  两个小节同名会读成同一份东西写了两遍。
 *      浮层内外分开比——摘要卡和它在浮层里的完整节本来就该同名，那两者不同屏。
 *
 *   node _tools/copy-check.cjs                # 四页全查
 *   node _tools/copy-check.cjs 角色档案.html   # 只查一页
 */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const EDGE = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find((p) => fs.existsSync(p));

const ALL = ['总览.html', '角色档案.html', '势力与地区.html', '任务与事件.html'];
const PAGES = process.argv.slice(2).length ? process.argv.slice(2) : ALL;

// 疑问词和口语句式。命中的多半是把标题写成了聊天
const QUESTION = /什么|哪儿|哪边|哪些|哪个|谁|怎么样|怎样|如何|要不要|有没有/;
// 没有实指、只为了不像术语而凑的字
const FLOWERY = /此刻|事态|近来的|众人|眼下的/;

(async () => {
  const b = await chromium.launch({
    executablePath: EDGE,
    args: ['--allow-file-access-from-files', '--disable-web-security'],
  });
  let bad = 0;

  for (const f of PAGES) {
    const p = await b.newPage({ viewport: { width: 1536, height: 1200 } });
    const errs = [];
    p.on('pageerror', (e) => errs.push('JS: ' + e.message));
    await p.goto('file:///' + path.resolve(__dirname, '..', f).replace(/\\/g, '/'));
    await p.waitForTimeout(1100);
    // 折叠区和浮层里的文案一样要查，先全打开
    await p.evaluate(() => {
      document.querySelectorAll('.dmore,.sysmore').forEach((d) => d.click && d.click());
      document.querySelectorAll('.sheet[hidden]').forEach((s) => { s.hidden = false; });
    });
    await p.waitForTimeout(500);

    const r = await p.evaluate(() => {
      const text = (e) => e.innerText.trim().replace(/\s+/g, ' ')
        .replace(/ ›$/, '').replace(/ 详情$/, '');
      const pick = (root, sel) => [...root.querySelectorAll(sel)]
        .map(text).filter((t) => t && t.length < 24);
      const inSheet = (e) => !!e.closest('.sheet');
      const SEL = 'h2,h3,h4,.sech';
      const heads = [...document.querySelectorAll(SEL)];
      return {
               // 问句／文艺味不分内外，全都要查。.dk 是完整档案里记录块的字段名，
               // 跟 .k 一个身份，换了组件别忘了跟着换选择器
               all: [...pick(document, SEL), ...pick(document, '.k'),
                 ...pick(document, '.dk'), ...pick(document, '.chip')],
        // 重名只在同屏范围内比
        page: heads.filter((e) => !inSheet(e)).map(text).filter(Boolean),
        sheet: heads.filter(inSheet).map(text).filter(Boolean),
      };
    });

    const uniq = (a) => [...new Set(a)];
    const dupOf = (a) => uniq(a.filter((t, i) => a.indexOf(t) !== i));
    const q = uniq(r.all).filter((t) => QUESTION.test(t));
    const fl = uniq(r.all).filter((t) => FLOWERY.test(t));
    const dup = [...dupOf(r.page), ...dupOf(r.sheet)];

    const n = q.length + fl.length + dup.length + errs.length;
    bad += n;
    console.log('=== ' + f + (n ? '' : '   √'));
    if (errs.length) console.log('  报错　' + errs.join(' | '));
    if (q.length) console.log('  问句味　' + q.join('、'));
    if (fl.length) console.log('  文艺味　' + fl.join('、'));
    if (dup.length) console.log('  同屏重名　' + dup.join('、'));
    await p.close();
  }

  await b.close();
  console.log(bad ? `\n${bad} 处要收。判据见 README「文案规矩」第 7 条。` : '\n四页文案干净。');
  process.exit(bad ? 1 : 0);
})();
