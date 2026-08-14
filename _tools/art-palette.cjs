/* 采样现有美术件的色彩特征，供风格说明引用具体数字而不是凭感觉描述 */
const { chromium } = require('playwright-core');
const { pathToFileURL } = require('url');
const fs = require('fs');
const path = require('path');

const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const BASE = path.join(__dirname, '..');
const FILES = process.argv.slice(2).length ? process.argv.slice(2) : [
  'assets/art/profile-saiwen.png',
  'assets/art/sidebar-heroine.png',
  'assets/art/header-compass.png',
];

(async () => {
  const tmp = path.join(BASE, '_palette.tmp.html');
  fs.writeFileSync(tmp, '<body style="margin:0">' + FILES.map((f) => `<img data-n="${f}" src="${f}">`).join('') + '</body>', 'utf8');

  const browser = await chromium.launch({ headless: true, executablePath: EDGE, args: ['--allow-file-access-from-files'] });
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  await page.goto(pathToFileURL(tmp).href, { waitUntil: 'load' });
  await page.waitForTimeout(400);

  const out = await page.evaluate(() => {
    const res = [];
    for (const img of document.images) {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const cx = c.getContext('2d');
      cx.drawImage(img, 0, 0);
      const d = cx.getImageData(0, 0, c.width, c.height).data;
      const buckets = new Map();
      let n = 0, sumL = 0, sumS = 0;
      for (let i = 0; i < d.length; i += 4 * 17) {
        if (d[i + 3] < 200) continue;
        const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
        const s = mx === mn ? 0 : (mx - mn) / (1 - Math.abs(2 * l - 1) || 1);
        sumL += l; sumS += s; n++;
        // 分桶后要夹回 0-255：264 这种越界值转十六进制会变成三位，把色值打乱
        const q = (v) => Math.min(255, Math.round(v / 24) * 24);
        const key = [q(d[i]), q(d[i + 1]), q(d[i + 2])].join(',');
        buckets.set(key, (buckets.get(key) || 0) + 1);
      }
      res.push({
        name: img.dataset.n,
        size: `${img.naturalWidth}×${img.naturalHeight}`,
        亮度: (sumL / n).toFixed(2),
        饱和: (sumS / n).toFixed(2),
        主色: [...buckets].sort((a, b) => b[1] - a[1]).slice(0, 5)
          .map(([k, cnt]) => `#${k.split(',').map((v) => Number(v).toString(16).padStart(2, '0')).join('')} ${(cnt / n * 100).toFixed(0)}%`),
      });
    }
    return res;
  });

  await browser.close();
  fs.unlinkSync(tmp);

  for (const r of out) {
    console.log(`\n${r.name}  ${r.size}`);
    console.log(`  平均亮度 ${r.亮度}   平均饱和度 ${r.饱和}`);
    console.log(`  主色     ${r.主色.join('  ')}`);
  }
})();
