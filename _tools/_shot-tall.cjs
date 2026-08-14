/**
 * 临时：在指定视口高度下点开某个按钮再截一个元素，用来看浮层里滚动区的全貌。
 *   node _tools/_shot-tall.cjs <页面> <选择器> <出图名> <宽> <高> [先点的选择器...]
 */
const { chromium } = require('playwright-core');
const { pathToFileURL } = require('url');
const fs = require('fs');
const path = require('path');

const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const BASE = path.join(__dirname, '..');
const [file, sel, out, w, h, ...clicks] = process.argv.slice(2);

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: EDGE, args: ['--allow-file-access-from-files'] });
  const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) }, deviceScaleFactor: 2 });
  await page.goto(pathToFileURL(path.join(BASE, file)).href, { waitUntil: 'load' });
  await page.waitForTimeout(600);
  for (const c of clicks) { await page.click(c); await page.waitForTimeout(400); }
  const dir = path.join(BASE, '_shots');
  await page.locator(sel).screenshot({ path: path.join(dir, out) });
  console.log('截图 _shots/' + out);
  await browser.close();
})();
