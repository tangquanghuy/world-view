/**
 * 角色档案页专用：先点开某个角色，再整页截图。
 * shot.cjs 只截默认选中的人（赛文），但候选人物走的是另一张表，
 * 不点开就永远看不到 profile / observations / retention 这几节的真实排版。
 *
 *   node _tools/shot-pick.cjs 露西 [宽度]
 */
const { chromium } = require('playwright-core');
const { pathToFileURL } = require('url');
const fs = require('fs');
const path = require('path');

const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const BASE = path.join(__dirname, '..');
const NAME = process.argv[2] || '露西';
const W = Number(process.argv[3]) || 1536;

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: EDGE, args: ['--allow-file-access-from-files'] });
  const page = await browser.newPage({ viewport: { width: W, height: 1000 } });
  const warns = [];
  page.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') warns.push(m.text()); });
  await page.goto(pathToFileURL(path.join(BASE, '角色档案.html')).href, { waitUntil: 'load' });
  await page.waitForTimeout(400);
  await page.evaluate((n) => document.querySelector(`.rcard[data-n="${CSS.escape(n)}"]`)?.click(), NAME);
  await page.waitForTimeout(400);

  const over = await page.evaluate(() => {
    const bad = [];
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width && r.right > document.documentElement.clientWidth + 1) {
        bad.push(el.tagName.toLowerCase() + (typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''));
      }
    }
    return [...new Set(bad)].slice(0, 6);
  });

  const out = path.join(BASE, '_shots', `角色档案-${NAME}-${W}.png`);
  await page.screenshot({ path: out, fullPage: true });
  await browser.close();
  console.log('截图', path.relative(BASE, out));
  if (over.length) console.log('  横向溢出:', over.join('  '));
  if (warns.length) warns.forEach((w) => console.log('  告警:', w));
  if (!over.length && !warns.length) console.log('  无溢出、无告警。');
})();
