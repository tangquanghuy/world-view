/**
 * 单入口冒烟测试：起好静态服后跑
 *   node _tools/smoke-spa.cjs [http://localhost:5500/]
 *
 * 查：四条路由都能挂上、侧栏能切路由、跨页焦点传得到、无控制台报错、
 * 以及**没有 404 资源**——图片路径写错时页面只是静默退成首字方块，肉眼查不出来。
 * 用系统装的 Chrome/Edge，不下载浏览器。
 */
const path = require('path');
const ROOT = path.resolve(__dirname, '../../..');
const { chromium } = require(require.resolve('playwright-core', { paths: [ROOT] }));

const BASE = process.argv[2] || 'http://localhost:5500/';
const ROUTES = [
  ['overview', '世界演进', '总览.html'],
  ['characters', '角色管理', '角色档案.html'],
  ['factions', '势力与地区', '势力与地区.html'],
  ['tasks', '任务与剧本', '任务与事件.html'],
];

/** 等 iframe 真的换到目标文件并把侧栏渲染出来。src 是异步换的，早读会读到上一页。
    比对忽略 .html：`serve` 默认走 clean URL，线上 Pages 不去后缀，两边都要认。 */
async function panelFrame(page, file) {
  const stem = file.replace(/\.html$/, '');
  for (let i = 0; i < 60; i++) {
    const frame = page.frames().find((f) => {
      if (f === page.mainFrame()) return false;
      let url = f.url();
      try { url = decodeURIComponent(url); } catch (_e) { /* 保留原样 */ }
      return url.replace(/\.html(?=$|[?#])/, '').endsWith('/' + stem);
    });
    if (frame) {
      const ready = await frame.$('.nav-item.on').catch(() => null);
      if (ready) return frame;
    }
    await page.waitForTimeout(100);
  }
  return null;
}

async function launch() {
  for (const channel of ['chrome', 'msedge']) {
    try {
      return await chromium.launch({ channel });
    } catch (_e) { /* 试下一个 */ }
  }
  return chromium.launch();
}

(async () => {
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 1536, height: 960 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

  // 资源 404。图片挂了只会退成首字方块，不进控制台，也不影响布局，只能这么抓。
  const missing = new Map();
  page.on('response', (res) => {
    if (res.status() < 400) return;
    let url = res.url();
    try { url = decodeURIComponent(url); } catch (_e) { /* 保留原样 */ }
    if (/favicon/i.test(url)) return;
    missing.set(url, (missing.get(url) || 0) + 1);
  });

  let bad = 0;
  for (const [id, label, file] of ROUTES) {
    await page.goto(BASE + '#/' + id, { waitUntil: 'load' });
    const frame = await panelFrame(page, file);
    if (!frame) { console.log(`✗ ${id} 没挂上子页`); bad++; continue; }
    const active = await frame.$eval('.nav-item.on', (el) => el.textContent.trim()).catch(() => '');
    const panels = await frame.$$eval('.panel', (els) => els.length).catch(() => 0);
    const ok = active === label && panels > 0;
    if (!ok) bad++;
    console.log(`${ok ? '✓' : '✗'} ${id}  高亮=${active || '无'}  面板=${panels}`);
  }

  // 侧栏点击是否真的换路由（不整页跳出入口），并且目标页确实挂上
  await page.goto(BASE + '#/overview', { waitUntil: 'load' });
  const from = await panelFrame(page, '总览.html');
  await from.click('.nav-item[data-route="tasks"]');
  await page.waitForFunction(() => location.hash === '#/tasks', null, { timeout: 5000 }).catch(() => {});
  const hash = await page.evaluate(() => location.hash);
  const landed = await panelFrame(page, '任务与事件.html');
  const clickOk = hash === '#/tasks' && !!landed;
  if (!clickOk) bad++;
  console.log(`${clickOk ? '✓' : '✗'} 侧栏点击切路由  hash=${hash}  落地=${landed ? '任务与事件' : '无'}`);

  // 跨页带焦点：势力页点一条任务，应落到任务页并选中它
  await page.goto(BASE + '#/factions', { waitUntil: 'load' });
  const fac = await panelFrame(page, '势力与地区.html');
  const focusName = await fac.evaluate(() => {
    const el = document.querySelector('[data-name]');
    if (!el) return '';
    el.click();
    return el.dataset.name || '';
  });
  let focusOk = false;
  if (focusName) {
    const taskFrame = await panelFrame(page, '任务与事件.html');
    if (taskFrame) {
      focusOk = await taskFrame.evaluate((n) => document.body.innerText.includes(n), focusName).catch(() => false);
    }
  }
  if (!focusOk) bad++;
  console.log(`${focusOk ? '✓' : '✗'} 跨页带焦点  目标=${focusName || '页面上没有可点的任务'}`);

  const real = errors.filter((t) => !/favicon|404|ERR_FILE|net::ERR/i.test(t));
  console.log(real.length ? `✗ 控制台报错 ${real.length} 条：\n  ` + real.slice(0, 8).join('\n  ') : '✓ 无控制台报错');

  if (missing.size) {
    bad++;
    const list = [...missing.entries()].sort((a, b) => b[1] - a[1]);
    console.log(`✗ 资源 404 ${list.length} 种（共 ${list.reduce((n, x) => n + x[1], 0)} 次）：`);
    for (const [url, n] of list.slice(0, 10)) console.log(`  ×${n}  ${url}`);
    if (list.length > 10) console.log(`  …另有 ${list.length - 10} 种`);
  } else {
    console.log('✓ 无资源 404');
  }

  await browser.close();
  process.exit(bad || real.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
