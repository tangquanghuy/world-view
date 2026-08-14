/**
 * 两张 PNG 的逐像素比较。重构样式时用来证明「什么都没变」。
 *
 *   node _tools/diff-shot.cjs _shots/_baseline-1536.png _shots/任务与事件-1536.png
 *
 * 差异超过阈值会写一张热区图，标出变化落在哪里。
 */
const { chromium } = require('playwright-core');
const { pathToFileURL } = require('url');
const fs = require('fs');
const path = require('path');

const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const BASE = path.join(__dirname, '..');

const pair = process.argv.slice(2, 4);
if (pair.length < 2) { console.error('用法: node _tools/diff-shot.cjs <基准.png> <对比.png>'); process.exit(2); }

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: EDGE, args: ['--allow-file-access-from-files', '--disable-web-security'] });
  const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
  // 用一个真实文件页做载体，about:blank 下 canvas 读像素会被判成跨域
  await page.goto(pathToFileURL(path.join(BASE, 'mock', 'world-state-v09.json')).href);

  const urls = pair.map((p) => pathToFileURL(path.resolve(BASE, p)).href);
  const out = await page.evaluate(async ([ua, ub]) => {
    const load = (u) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('读不到 ' + u)); i.src = u; });
    const [a, b] = await Promise.all([load(ua), load(ub)]);
    const w = Math.max(a.width, b.width), h = Math.max(a.height, b.height);
    const grab = (img) => {
      const c = new OffscreenCanvas(w, h), x = c.getContext('2d');
      x.fillStyle = '#000'; x.fillRect(0, 0, w, h);
      x.drawImage(img, 0, 0);
      return x.getImageData(0, 0, w, h).data;
    };
    const da = grab(a), db = grab(b);

    // 差异按 32px 网格归并，报出热区而不是一堆孤立坐标
    const G = 32, cols = Math.ceil(w / G), rows = Math.ceil(h / G);
    const cell = new Int32Array(cols * rows);
    let diff = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        // 阈值 8：躲开字体抗锯齿和渐变 dithering 的一两级抖动
        if (Math.abs(da[i] - db[i]) > 8 || Math.abs(da[i + 1] - db[i + 1]) > 8 || Math.abs(da[i + 2] - db[i + 2]) > 8) {
          diff++; cell[Math.floor(y / G) * cols + Math.floor(x / G)]++;
        }
      }
    }
    const hot = [];
    cell.forEach((n, i) => { if (n > 24) hot.push({ x: (i % cols) * G, y: Math.floor(i / cols) * G, n }); });
    hot.sort((p, q) => q.n - p.n);
    return { w, h, sizeA: [a.width, a.height], sizeB: [b.width, b.height], diff, total: w * h, hot: hot.slice(0, 14), hotCount: hot.length };
  }, urls);
  await browser.close();

  const pct = ((out.diff / out.total) * 100).toFixed(3);
  console.log(`基准 ${out.sizeA.join('×')}　对比 ${out.sizeB.join('×')}`);
  if (out.sizeA[1] !== out.sizeB[1]) console.log(`! 高度变了 ${out.sizeA[1]} → ${out.sizeB[1]}（差 ${out.sizeB[1] - out.sizeA[1]}px）`);
  console.log(`不同像素 ${out.diff} / ${out.total}（${pct}%），热区 ${out.hotCount} 格`);
  if (out.hot.length) {
    console.log('差异最集中的位置（32px 网格左上角坐标）:');
    out.hot.forEach((c) => console.log(`  x=${String(c.x).padStart(4)} y=${String(c.y).padStart(4)}　${c.n} 像素`));
  } else {
    console.log('无可见差异。');
  }
  process.exitCode = out.diff > 0 ? 1 : 0;
})();
