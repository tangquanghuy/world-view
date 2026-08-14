/**
 * 渲染页面并截图，同时抓控制台告警。
 * vocab.js 遇到契约外的枚举值会 console.warn，这里会一并报出来。
 *
 *   node _tools/shot.cjs 任务与事件.html [宽度...]
 */
const { chromium } = require('playwright-core');
const { pathToFileURL } = require('url');
const fs = require('fs');
const path = require('path');

const EDGE = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find((p) => fs.existsSync(p));

const BASE = path.join(__dirname, '..');
const file = process.argv[2] || '任务与事件.html';
const widths = process.argv.slice(3).map(Number).filter(Boolean);
const WIDTHS = widths.length ? widths : [1536, 1280, 390];
const OUTDIR = path.join(BASE, '_shots');

(async () => {
  fs.mkdirSync(OUTDIR, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath: EDGE,
    args: ['--allow-file-access-from-files', '--font-render-hinting=none'],
  });

  const msgs = [];
  for (const w of WIDTHS) {
    const page = await browser.newPage({ viewport: { width: w, height: 1000 }, deviceScaleFactor: 1 });
    page.on('console', (m) => { if (['warning', 'error'].includes(m.type())) msgs.push(`[${w}px][${m.type()}] ${m.text()}`); });
    page.on('pageerror', (e) => msgs.push(`[${w}px][pageerror] ${e.message}`));

    await page.goto(pathToFileURL(path.join(BASE, file)).href, { waitUntil: 'load' });
    await page.waitForTimeout(700);

    const out = path.join(OUTDIR, `${path.parse(file).name}-${w}.png`);
    await page.screenshot({ path: out, fullPage: true });
    console.log('截图', path.relative(BASE, out));

    // 溢出与超小字号体检
    const diag = await page.evaluate(() => {
      const over = [];
      const small = new Map();
      const name = (el) =>
        el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).join('.') : '');

      document.querySelectorAll('*').forEach((el) => {
        const cs = getComputedStyle(el);

        // 三类不算问题：可滚动容器、省略号截断、多行钳制，都是刻意为之
        const intentional =
          cs.overflowX === 'auto' || cs.overflowX === 'scroll' ||
          cs.textOverflow === 'ellipsis' || cs.webkitLineClamp !== 'none';

        if (!intentional) {
          if (!el.children.length) {
            // 叶子节点直接比较，捕捉放不下的长文本
            if (el.scrollWidth > el.clientWidth + 2 && over.length < 12) over.push(`${name(el)}  ${el.scrollWidth}>${el.clientWidth}`);
          } else {
            // 有子元素时比对子元素实际位置，绕开 ::before/::after 装饰出血造成的误报
            const r = el.getBoundingClientRect();
            for (const c of el.children) {
              const cr = c.getBoundingClientRect();
              if (cr.width && (cr.right > r.right + 1 || cr.left < r.left - 1)) {
                if (over.length < 12) over.push(`${name(el)} 的子元素 ${name(c)} 越界`);
                break;
              }
            }
          }
        }

        if (!el.children.length && el.textContent.trim()) {
          const fs2 = parseFloat(cs.fontSize);
          if (fs2 < 13) small.set(fs2, (small.get(fs2) || 0) + 1);
        }
      });
      // 引用了不存在的 symbol：页面上是一块空白，肉眼很难发现
      const ghost = new Set();
      document.querySelectorAll('use').forEach((u) => {
        const id = (u.getAttribute('href') || u.getAttribute('xlink:href') || '').replace('#', '');
        if (id && !document.getElementById(id)) ghost.add(id);
      });

      return { over, small: [...small].sort((a, b) => a[0] - b[0]), ghost: [...ghost] };
    });
    if (diag.over.length) console.log(`  横向溢出 ${diag.over.length} 处: ` + diag.over.join(' | '));
    if (diag.small.length) console.log('  小于 13px 的文字: ' + diag.small.map(([s, n]) => `${s}px×${n}`).join(', '));
    if (diag.ghost.length) { console.log('  引用了不存在的图标: ' + diag.ghost.join(', ')); process.exitCode = 1; }
    await page.close();
  }
  await browser.close();

  if (msgs.length) {
    console.log(`\n控制台告警 ${msgs.length} 条:`);
    [...new Set(msgs)].forEach((m) => console.log('  ' + m));
    process.exitCode = 1;
  } else {
    console.log('\n控制台无告警。');
  }
})();
