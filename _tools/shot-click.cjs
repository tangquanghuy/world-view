/**
 * 点几下再截图。展开态、浮层、详情面板这些只有交互后才出现的界面，
 * 用 shot.cjs 是拍不到的。
 *
 *   node _tools/shot-click.cjs 总览.html 出图名 "#expandAll" ".act:nth-child(2)"
 *
 * 选择器按顺序点，每次点完等 350ms。截整页。
 */
const { chromium } = require('playwright-core');
const { pathToFileURL } = require('url');
const fs = require('fs');
const path = require('path');

const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const BASE = path.join(__dirname, '..');

const [file, out, ...clicks] = process.argv.slice(2);
if (!file || !out) { console.error('用法: node _tools/shot-click.cjs <页面.html> <出图名> [选择器...]'); process.exit(2); }

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: EDGE, args: ['--allow-file-access-from-files'] });
  const page = await browser.newPage({ viewport: { width: 1536, height: 1000 } });
  const warn = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') warn.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => warn.push(`[pageerror] ${e.message}`));

  await page.goto(pathToFileURL(path.join(BASE, file)).href, { waitUntil: 'load' });
  await page.waitForTimeout(500);

  for (const sel of clicks) {
    const el = await page.$(sel);
    if (!el) { console.log(`  选择器没命中，跳过: ${sel}`); continue; }
    await el.click();
    await page.waitForTimeout(350);
    console.log(`  点击 ${sel}`);
  }

  const target = path.join(BASE, '_shots', out.endsWith('.png') ? out : out + '.png');
  await page.screenshot({ path: target, fullPage: true });
  console.log('截图', path.relative(BASE, target));
  if (warn.length) { console.log('\n控制台告警:'); warn.forEach((w) => console.log('  ' + w)); }
  await browser.close();
})();
