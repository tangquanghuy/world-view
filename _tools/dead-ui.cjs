/**
 * 查死控件：页面上长得能点、点了却什么都不发生的东西。
 *
 *   node _tools/dead-ui.cjs            四页全查
 *   node _tools/dead-ui.cjs 总览.html
 *
 * 做法是在页面脚本跑之前把 addEventListener 换掉，记下谁绑过 click；
 * 再回头看每个 button / [tabindex] / [role=button]，它自己或任一祖先有没有绑过。
 * 光看源码不行：这几页大量用事件委托（document 上一个 handler 管一片）。
 *
 * 分三档报：
 *   死  —— 没有任何 click 落点，点了毫无反应。这是 bug。
 *   吐司 —— 只挂了 data-toast，点了弹一句「尚未接入」。这是占位，要么接上要么删。
 *   活  —— 真接了逻辑，不报。
 *
 * 「吐司」这一档现在报不出来了：panel.js 里那个 [data-toast] 的全局委托已经删掉，
 * 再挂 data-toast 也没人接，会直接落进「死」。判定留着当绊线——万一有人把那个
 * 委托加回来，占位按钮才不会又变得没有代价。
 * 浮层默认关着，所以先把 [data-open-sheet] 全点开再查。
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
const PAGES = process.argv[2] ? [process.argv[2]]
  : ['总览.html', '角色档案.html', '势力与地区.html', '任务与事件.html'];

const INIT = `(() => {
  const nat = EventTarget.prototype.addEventListener;
  window.__wired = new WeakSet();
  window.__docClick = false;
  EventTarget.prototype.addEventListener = function (type, fn, opt) {
    if (type === 'click') {
      if (this === document || this === document.body || this === window) window.__docClick = true;
      else window.__wired.add(this);
    }
    return nat.call(this, type, fn, opt);
  };
})()`;

(async () => {
  const browser = await chromium.launch({
    headless: true, executablePath: EDGE,
    args: ['--allow-file-access-from-files'],
  });

  let dead = 0, stub = 0;
  for (const file of PAGES) {
    const page = await browser.newPage({ viewport: { width: 1536, height: 1000 } });
    await page.addInitScript(INIT);
    await page.goto(pathToFileURL(path.join(BASE, file)).href, { waitUntil: 'load' });
    await page.waitForTimeout(700);
    await page.evaluate(() => {
      document.querySelectorAll('[data-open-sheet]').forEach((b) => { try { b.click() } catch (e) {} });
      document.querySelectorAll('.sheet[hidden]').forEach((s) => { s.hidden = false });
    });
    await page.waitForTimeout(300);

    const found = await page.evaluate(() => {
      const out = [];
      const clickable = [...document.querySelectorAll('button,[role=button],[tabindex],a')];
      for (const el of clickable) {
        if (el.disabled) continue;
        let node = el, wired = false, toast = null;
        while (node && node !== document) {
          // onclick="" 属性不走 addEventListener，得单独认，否则真接了的按钮会被报成死的
          if (window.__wired.has(node) || node.onclick || (node.tagName === 'A' && node.getAttribute('href'))) wired = true;
          if (node.dataset && node.dataset.toast != null && toast == null) toast = node.dataset.toast;
          node = node.parentElement;
        }
        // 委托到 document 的那一路：只有挂了识别属性才算真的接住了
        const caught = wired || (window.__docClick && (toast != null
          || el.closest('[data-r],[data-fac2],[data-name],[data-k],[data-i],[data-d],[data-href],[data-open-sheet]')));
        const label = (el.getAttribute('aria-label') || el.innerText || el.title || '').trim().replace(/\\s+/g, ' ').slice(0, 28);
        if (!caught) out.push({ kind: '死', label, sel: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.') : '') });
        else if (toast != null && !wired) out.push({ kind: '吐司', label, sel: toast });
      }
      // 同一种占位可能渲染多份（列表里每条一个），按 类型+文案 去重
      const seen = new Set();
      return out.filter((o) => { const k = o.kind + o.label + o.sel; if (seen.has(k)) return false; seen.add(k); return true });
    });

    console.log('');
    console.log('=== ' + file);
    if (!found.length) console.log('  没有死控件。');
    for (const f of found) {
      console.log(`  ${f.kind}　${f.label || '(无文字)'}　${f.sel}`);
      if (f.kind === '死') dead++; else stub++;
    }
    await page.close();
  }

  await browser.close();
  console.log('');
  console.log(`合计：死控件 ${dead} 处，占位吐司 ${stub} 处。`);
})();
