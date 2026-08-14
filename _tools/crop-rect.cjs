/**
 * crop.cjs 的宽屏版：它固定裁 900px 宽，1536 档右半边永远看不到。
 * 这个可以指定任意矩形，还能按倍率缩放（看整块构图时缩小，抠细节时放大）。
 *   node _tools/crop-rect.cjs _shots/势力与地区-1536.png 300 190 1200 640 1 out.png
 *                             文件                       x   y   w    h  倍率 输出名
 */
const { chromium } = require('playwright-core');
const { pathToFileURL } = require('url');
const fs = require('fs');
const path = require('path');

const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const BASE = path.join(__dirname, '..');

const [file, xx, yy, ww, hh, kk, name] = process.argv.slice(2);
const x = Number(xx) || 0, y = Number(yy) || 0;
const w = Number(ww) || 900, h = Number(hh) || 400, k = Number(kk) || 1;

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: EDGE, args: ['--allow-file-access-from-files', '--disable-web-security'] });
  const url = pathToFileURL(path.resolve(BASE, file)).href;
  const page = await browser.newPage({ viewport: { width: Math.round(w * k), height: Math.round(h * k) } });
  // 同 crop.cjs：先落到真实 file:// 文档，否则 setContent 的页面读不了本地图片
  await page.goto(pathToFileURL(path.join(BASE, 'mock', 'world-state-v09.json')).href);
  await page.evaluate(([u, ox, oy, sc]) => {
    document.documentElement.innerHTML =
      `<body style="margin:0;background:#222;overflow:hidden">` +
      `<img src="${u}" style="display:block;transform-origin:0 0;transform:scale(${sc}) translate(${-ox}px,${-oy}px)">` +
      `</body>`;
  }, [url, x, y, k]);
  await page.waitForTimeout(500);
  const out = path.join(BASE, '_shots', name || `rect-${path.parse(file).name}-${x}-${y}.png`);
  await page.screenshot({ path: out });
  await browser.close();
  console.log('裁图', path.relative(BASE, out));
})();
