/**
 * 点开浮层再截图。浮层默认是 hidden 的，shot.cjs 拍不到里面的排版。
 * 原来这事儿是靠两个页面各自的专用脚本（shot-pick / shot-event）干的，
 * 浮层现在两页都有，抽成一个。
 *
 *   node _tools/shot-open.cjs 势力与地区.html "#dossierBtn"
 *   node _tools/shot-open.cjs 势力与地区.html "#dossierBtn" ".sheet-box" 1280
 *
 * 点击选择器可以用 | 串几步，按顺序点：浮层的内容常常取决于先选中了谁，
 * 例如先点图上的某个势力、再开它的档案。
 *   node _tools/shot-open.cjs 势力与地区.html "[data-k='f:星辉典籍会']|#dossierBtn"
 *
 * 第三个参数给要拍的那块（默认 .sheet-box，也就是浮层本身）；给 page 就整页拍。
 * 顺带报浮层内的横向溢出和控制台错误——浮层里的溢出最容易漏，因为默认看不见。
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
const PAGE = process.argv[2];
const CLICK = process.argv[3];
const SHOT = process.argv[4] || '.sheet-box';
const W = Number(process.argv[5]) || 1536;

if (!PAGE || !CLICK) {
  console.log('用法：node _tools/shot-open.cjs <页面.html> <点击选择器> [截图选择器] [宽]');
  process.exit(2);
}

(async () => {
  fs.mkdirSync(path.join(BASE, '_shots'), { recursive: true });
  const browser = await chromium.launch({
    headless: true, executablePath: EDGE,
    args: ['--allow-file-access-from-files', '--font-render-hinting=none'],
  });
  const page = await browser.newPage({ viewport: { width: W, height: 1000 }, deviceScaleFactor: 1 });
  const errs = [];
  page.on('pageerror', (e) => errs.push('JS: ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/ERR_FILE_NOT_FOUND/.test(m.text())) errs.push(m.text());
  });

  await page.goto(pathToFileURL(path.join(BASE, PAGE)).href, { waitUntil: 'load' });
  await page.waitForTimeout(700);
  for (const sel of CLICK.split('|')) {
    await page.click(sel.trim());
    await page.waitForTimeout(400);
  }

  const target = SHOT === 'page' ? null : await page.$(SHOT);
  if (SHOT !== 'page' && !target) { console.log('找不到 ' + SHOT); await browser.close(); process.exit(1); }

  // 浮层自己是滚动容器，截图只拍到可视那一屏——先把它撑开，拍完不用还原
  if (target) {
    await page.evaluate((s) => {
      const el = document.querySelector(s);
      if (el) { el.style.maxHeight = 'none'; el.style.overflow = 'visible'; }
    }, SHOT);
    await page.waitForTimeout(300);
  }

  const tag = PAGE.replace(/\.html$/, '');
  const out = path.join(BASE, '_shots', `${tag}-浮层-${W}.png`);
  if (target) await (await page.$(SHOT)).screenshot({ path: out });
  else await page.screenshot({ path: out, fullPage: true });

  const over = await page.evaluate((s) => {
    const root = document.querySelector(s) || document.body;
    const lim = root.getBoundingClientRect().right + 1;
    const bad = [];
    for (const el of root.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      if (st.overflowX === 'auto' || st.overflowX === 'scroll') continue;
      if (st.textOverflow === 'ellipsis' || st.webkitLineClamp !== 'none') continue;
      if (r.width && r.right > lim) {
        bad.push(el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className.trim()
          ? '.' + el.className.trim().split(/\s+/).join('.') : '') + ` 超 ${Math.round(r.right - lim)}px`);
      }
    }
    return [...new Set(bad)].slice(0, 8);
  }, SHOT === 'page' ? 'body' : SHOT);

  await browser.close();
  console.log('截图 ' + path.relative(BASE, out));
  if (over.length) { console.log('  横向溢出：'); over.forEach((o) => console.log('    ' + o)); }
  if (errs.length) { console.log('  报错：'); errs.forEach((e) => console.log('    ' + e)); }
  if (!over.length && !errs.length) console.log('  无溢出、无报错。');
})();
