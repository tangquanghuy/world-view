/**
 * 从 PNG 里裁一段出来看。长页面整张读不清，用这个盯局部。
 *   node _tools/crop.cjs _shots/任务与事件-390.png 3400 400 [输出名]
 *                        文件            y起点 高度
 */
const { chromium } = require('playwright-core');
const { pathToFileURL } = require('url');
const fs = require('fs');
const path = require('path');

const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const BASE = path.join(__dirname, '..');

const [file, y0, hh, name] = process.argv.slice(2);
const top = Number(y0) || 0, height = Number(hh) || 400;

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: EDGE, args: ['--allow-file-access-from-files', '--disable-web-security'] });
  const url = pathToFileURL(path.resolve(BASE, file)).href;
  const page = await browser.newPage({ viewport: { width: 900, height: Math.min(height, 1400) } });
  // 必须先落到一个真实的 file:// 文档上，setContent 出来的页面加载不了本地图片
  await page.goto(pathToFileURL(path.join(BASE, 'mock', 'world-state-v09.json')).href);
  await page.evaluate(([u, t]) => {
    document.documentElement.innerHTML =
      `<body style="margin:0;background:#222"><img src="${u}" style="display:block;margin-top:-${t}px"></body>`;
  }, [url, top]);
  await page.waitForTimeout(500);
  const out = path.join(BASE, '_shots', name || `crop-${path.parse(file).name}-${top}.png`);
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 900, height } });
  await browser.close();
  console.log('裁图', path.relative(BASE, out));
})();
