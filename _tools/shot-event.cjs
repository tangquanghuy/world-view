/**
 * 点开一张事件卡再截图。事件详情是选中态才出现的，默认截图拍不到。
 * 顺带验证「关联任务」能不能跳回任务详情。
 *
 *   node _tools/shot-event.cjs
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
const OUTDIR = path.join(BASE, '_shots');

(async () => {
  fs.mkdirSync(OUTDIR, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath: EDGE,
    args: ['--allow-file-access-from-files', '--font-render-hinting=none'],
  });

  const errs = [];
  for (const w of [1536, 390]) {
    const page = await browser.newPage({ viewport: { width: w, height: 1000 }, deviceScaleFactor: 1 });
    page.on('pageerror', (e) => errs.push(`[${w}px] ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error' && !/ERR_FILE_NOT_FOUND/.test(m.text())) errs.push(`[${w}px] ${m.text()}`); });

    await page.goto(pathToFileURL(path.join(BASE, '任务与事件.html')).href, { waitUntil: 'load' });
    await page.waitForTimeout(600);

    await page.click('.ev[data-i]');
    await page.waitForTimeout(400);

    const out = path.join(OUTDIR, `事件详情-${w}.png`);
    await page.screenshot({ path: out, fullPage: true });
    console.log(`截图 _shots\\事件详情-${w}.png`);

    const info = await page.evaluate(() => ({
      title: document.querySelector('#detailTitle').textContent,
      sub: document.querySelector('#detailSub').textContent,
      flowHidden: document.querySelector('#flowWrap').hidden,
      effects: document.querySelectorAll('#evDetail .effect').length,
      rels: [...document.querySelectorAll('#evDetail .rel button')].map((b) => b.textContent),
      nowline: document.querySelector('#nowLine').textContent,
    }));
    console.log('  标题:', info.title);
    console.log('  副标:', info.sub);
    console.log('  链路图已隐藏:', info.flowHidden, '| 公开后果:', info.effects, '条');
    console.log('  关联任务:', info.rels.join(' / ') || '(无)');
    console.log(' ', info.nowline.trim());

    const rel = await page.$('#evDetail .rel button[data-t]');
    if (rel) {
      await rel.click();
      await page.waitForTimeout(300);
      const back = await page.evaluate(() => ({
        title: document.querySelector('#detailTitle').textContent,
        flowHidden: document.querySelector('#flowWrap').hidden,
        pager: (document.querySelector('#taskPager .pg-n') || {}).textContent || '',
      }));
      console.log('  点关联任务 → ', back.title, '| 链路图已隐藏:', back.flowHidden, '|', back.pager.trim());
    } else {
      console.log('  没有可点的关联任务');
    }
    await page.close();
  }
  await browser.close();
  if (errs.length) { console.log('\n错误:'); errs.forEach((e) => console.log(' ', e)); }
})();
