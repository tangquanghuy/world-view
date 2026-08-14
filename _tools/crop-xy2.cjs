/**
 * 从 PNG 里按矩形裁一块，可放大。比对原型局部时用。
 *   node _tools/crop-xy2.cjs <图片> <x> <y> <宽> <高> <缩放> <输出名>
 * 图片路径相对本目录；原型图可写 ../橱窗样稿/示意图总览.png
 */
const { chromium } = require('playwright-core');
const { pathToFileURL } = require('url');
const fs = require('fs');
const path = require('path');

const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const BASE = path.join(__dirname, '..');

const [file, x, y, w, h, z, name] = process.argv.slice(2);
const X = Number(x) || 0, Y = Number(y) || 0, W = Number(w) || 400, H = Number(h) || 300, Z = Number(z) || 1;

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: EDGE, args: ['--allow-file-access-from-files', '--disable-web-security'] });
  const url = pathToFileURL(path.resolve(BASE, file)).href;
  const page = await browser.newPage({ viewport: { width: Math.round(W * Z), height: Math.round(H * Z) } });
  await page.goto(pathToFileURL(path.join(BASE, 'mock', 'world-state-v09.json')).href);
  await page.evaluate(([u, X, Y, Z]) => {
    document.documentElement.innerHTML =
      `<body style="margin:0;overflow:hidden;background:#222">
         <img src="${u}" style="position:absolute;left:${-X * Z}px;top:${-Y * Z}px;transform-origin:0 0;transform:scale(${Z});image-rendering:auto">
       </body>`;
  }, [url, X, Y, Z]);
  await page.waitForTimeout(500);
  const out = path.join(BASE, '_shots', name || 'xy.png');
  await page.screenshot({ path: out });
  await browser.close();
  console.log('裁图', path.relative(BASE, out));
})();
