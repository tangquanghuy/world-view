/**
 * 和 crop.cjs 一样从截图里裁一块，但可以指定 x 起点与宽度。
 * 三列以上的页面右栏落在 x>1000 的位置，crop.cjs 固定从 x=0 裁 900px 宽，够不着。
 *
 *   node _tools/crop-xy.cjs _shots/角色档案-1536.png 1150 380 200 900 [输出名]
 *                           文件                     x    宽   y   高
 */
const { chromium } = require('playwright-core');
const { pathToFileURL } = require('url');
const fs = require('fs');
const path = require('path');

const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const BASE = path.join(__dirname, '..');

const [file, x0, ww, y0, hh, name] = process.argv.slice(2);
const left = Number(x0) || 0, width = Number(ww) || 900;
const top = Number(y0) || 0, height = Number(hh) || 600;

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: EDGE, args: ['--allow-file-access-from-files', '--disable-web-security'] });
  const url = pathToFileURL(path.resolve(BASE, file)).href;
  const page = await browser.newPage({ viewport: { width, height: Math.min(height, 1600) } });
  // 必须先落到一个真实的 file:// 文档上，setContent 出来的页面加载不了本地图片
  await page.goto(pathToFileURL(path.join(BASE, 'mock', 'world-state-v09.json')).href);
  await page.evaluate(([u, l, t]) => {
    document.documentElement.innerHTML =
      `<body style="margin:0;background:#222"><img src="${u}" style="display:block;margin:-${t}px 0 0 -${l}px"></body>`;
  }, [url, left, top]);
  await page.waitForTimeout(500);
  const out = path.join(BASE, '_shots', name || `crop-${path.parse(file).name}-${left}-${top}.png`);
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width, height } });
  await browser.close();
  console.log('裁图', path.relative(BASE, out));
})();
