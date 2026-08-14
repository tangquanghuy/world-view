/** 图标实际填充色体检：sprite 里的 <use> 有没有真的吃到 CSS 的 color */
const { chromium } = require('playwright-core');
const { pathToFileURL } = require('url');
const fs = require('fs');
const path = require('path');

const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const BASE = path.join(__dirname, '..');

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: EDGE, args: ['--allow-file-access-from-files'] });
  const page = await browser.newPage({ viewport: { width: 1536, height: 1200 } });
  await page.goto(pathToFileURL(path.join(BASE, process.argv[2] || '任务与事件.html')).href, { waitUntil: 'load' });
  await page.waitForTimeout(500);

  const rows = await page.evaluate(() => {
    const seen = new Map();
    for (const svg of document.querySelectorAll('svg:not([aria-hidden="true"]) use, .pmark svg use, .ni use, .mi use, .fi use, .sym use, .ev-mark use, .chip use')) {
      const host = svg.closest('svg');
      const owner = host.parentElement;
      const key = owner.className.baseVal || owner.className || owner.tagName;
      if (seen.has(key)) continue;
      seen.set(key, {
        owner: String(key).slice(0, 28),
        icon: svg.getAttribute('href'),
        wantColor: getComputedStyle(owner).color,
        svgFill: getComputedStyle(host).fill,
      });
    }
    return [...seen.values()];
  });
  await browser.close();

  console.log('  容器                          图标          期望色(color)          实际 fill');
  rows.forEach((r) => console.log(`  ${r.owner.padEnd(28)} ${String(r.icon).padEnd(13)} ${r.wantColor.padEnd(22)} ${r.svgFill}`));
  const black = rows.filter((r) => r.svgFill === 'rgb(0, 0, 0)');
  console.log(black.length ? `\n${black.length} 处图标是纯黑，没吃到 color——缺 svg{fill:currentColor}` : '\n图标填充色正常。');
})();
