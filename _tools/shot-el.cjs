/**
 * 点几下再拍某个元素。展开态、浮层这些默认截图看不到的状态用它。
 *   node _tools/shot-el.cjs <页面> <要拍的选择器> <输出名> [宽度] [先点的选择器...]
 * 例：node _tools/shot-el.cjs 总览.html "#ego~*,.panel" ego-open.png 1536 "#egoMore"
 */
const { chromium } = require('playwright-core');
const { pathToFileURL } = require('url');
const fs = require('fs');
const path = require('path');

const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const BASE = path.join(__dirname, '..');

const [file, target, out, w, ...clicks] = process.argv.slice(2);
const WIDTH = Number(w) || 1536;

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: EDGE, args: ['--allow-file-access-from-files', '--font-render-hinting=none'] });
  const page = await browser.newPage({ viewport: { width: WIDTH, height: 1000 }, deviceScaleFactor: 2 });
  const msgs = [];
  page.on('console', (m) => { if (['warning', 'error'].includes(m.type())) msgs.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => msgs.push(`[pageerror] ${e.message}`));

  await page.goto(pathToFileURL(path.join(BASE, file)).href, { waitUntil: 'load' });
  await page.waitForTimeout(600);
  for (const sel of clicks) { await page.click(sel); await page.waitForTimeout(350); }

  const dst = path.join(BASE, '_shots', out);
  await page.locator(target).first().screenshot({ path: dst });
  await browser.close();
  console.log('截图', path.relative(BASE, dst));
  if (msgs.length) { console.log('控制台：'); [...new Set(msgs)].forEach((m) => console.log('  ' + m)); }
})();
