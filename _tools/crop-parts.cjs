/* 逐条任务切换，单独截参与者区域，并列出真正 404 的资源 */
const { chromium } = require('playwright-core');
const { pathToFileURL } = require('url');
const fs = require('fs');
const path = require('path');

const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const BASE = path.join(__dirname, '..');
const OUT = path.join(BASE, '_shots');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: EDGE, args: ['--allow-file-access-from-files'] });
  // 3 倍缩放：参与者头像只有 34px，1 倍截图看不清纹章形状
  const page = await browser.newPage({ viewport: { width: 1536, height: 1000 }, deviceScaleFactor: 3 });

  const failed = [];
  page.on('requestfailed', (r) => failed.push(r.url().replace(pathToFileURL(BASE).href, '')));

  await page.goto(pathToFileURL(path.join(BASE, '任务与事件.html')).href, { waitUntil: 'load' });
  await page.waitForTimeout(600);

  const n = await page.evaluate(() => document.querySelectorAll('.tcard').length);
  for (let i = 0; i < n; i++) {
    await page.evaluate((k) => document.querySelectorAll('.tcard')[k].click(), i);
    await page.waitForTimeout(300);
    const info = await page.evaluate(() => ({
      title: document.querySelector('#detailTitle').textContent,
      sub: document.querySelector('#detailSub').textContent,
      parts: [...document.querySelectorAll('.part')].map((el) => el.innerText.replace(/\n/g, ' / ')),
    }));
    console.log(`\n[${i}] ${info.title}`);
    console.log(`    ${info.sub}`);
    info.parts.forEach((p) => console.log('    · ' + p));
    const el = await page.$('.contract-parts');
    if (el) await el.screenshot({ path: path.join(OUT, `parts-${i}.png`) });
  }

  await browser.close();
  if (failed.length) console.log('\n加载失败的资源:\n  ' + [...new Set(failed)].join('\n  '));
})();
