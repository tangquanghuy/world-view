/**
 * 页面实际请求了哪些资源、哪些没拿到。
 * CSS 里的 background-image 404 不一定会进控制台，光看告警会漏。
 *
 *   node _tools/asset-check.cjs 总览.html
 *   node _tools/asset-check.cjs            # 查全部页面
 */
const { chromium } = require('playwright-core');
const { pathToFileURL } = require('url');
const fs = require('fs');
const path = require('path');

const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const BASE = path.join(__dirname, '..');
const PAGES = process.argv[2] ? [process.argv[2]]
  : fs.readdirSync(BASE).filter((f) => f.endsWith('.html'));

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: EDGE, args: ['--allow-file-access-from-files'] });
  let missing = 0;

  for (const file of PAGES) {
    const page = await browser.newPage({ viewport: { width: 1536, height: 1200 } });
    const ok = new Set(), bad = new Set();
    page.on('requestfinished', (r) => ok.add(r.url()));
    page.on('requestfailed', (r) => bad.add(r.url()));
    await page.goto(pathToFileURL(path.join(BASE, file)).href, { waitUntil: 'load' });
    await page.waitForTimeout(700);

    // 展开态和浮层里的图另算，先点一遍常见入口
    for (const sel of ['#expandAll', '#openFull']) {
      const el = await page.$(sel);
      if (el) { await el.click().catch(() => {}); await page.waitForTimeout(300); }
    }
    await page.close();

    const rel = (u) => decodeURIComponent(u).replace(pathToFileURL(BASE).href + '/', '');
    const loaded = [...ok].filter((u) => /\.(png|jpe?g|svg|webp)$/i.test(u));
    console.log(`\n${file}　加载成功 ${loaded.length} 个图，失败 ${bad.size} 个`);
    if (bad.size) {
      missing += bad.size;
      [...bad].forEach((u) => console.log('  缺: ' + rel(u)));
    }
  }

  await browser.close();
  console.log(missing ? `\n合计缺 ${missing} 个资源。装饰件缺失页面会留白，不破图；人物图缺失会退到首字。`
                      : '\n全部资源都在。');
})();
