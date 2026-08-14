/**
 * 真实桥模式冒烟测试：
 *   node _tools/smoke-spa.cjs [站点地址] [结构化数据 fixture]
 *
 * fixture 只存在测试进程里，不会被静态站加载。默认读取相邻异步助手工程的开发数据。
 */
const fs = require('fs');
const path = require('path');
const MODULE_ROOT = process.env.ASYNC_ASSISTANT_DIR
  ? path.resolve(process.env.ASYNC_ASSISTANT_DIR)
  : path.resolve(__dirname, '../../异步助手-project');
const { chromium } = require(require.resolve('playwright-core', { paths: [MODULE_ROOT] }));

const BASE = process.argv[2] || 'http://localhost:5500/';
const BRIDGE_URL = new URL('__bridge_test__', BASE).href;
const FIXTURE = process.argv[3]
  || path.resolve(__dirname, '../../异步助手-project/配置方案/世界引擎面板/mock/world-state-v09.json');
const WORLD = JSON.parse(fs.readFileSync(FIXTURE, 'utf8')).background_world;
const ROUTES = [
  ['overview', '世界演进', '总览.html'],
  ['characters', '角色管理', '角色档案.html'],
  ['factions', '势力与地区', '势力与地区.html'],
  ['tasks', '任务与剧本', '任务与事件.html'],
];

async function panelFrame(page, file) {
  const stem = file.replace(/\.html$/, '');
  for (let i = 0; i < 80; i++) {
    const frame = page.frames().find((candidate) => {
      if (candidate === page.mainFrame()) return false;
      let url = candidate.url();
      try { url = decodeURIComponent(url); } catch (_e) {}
      return url.replace(/\.html(?=$|[?#])/, '').endsWith('/' + stem);
    });
    if (frame && await frame.$('.nav-item.on').catch(() => null)) return frame;
    await page.waitForTimeout(100);
  }
  return null;
}

async function indexFrame(page) {
  for (let i = 0; i < 80; i++) {
    const frame = page.frames().find((candidate) =>
      candidate !== page.mainFrame() && /[?&]acuBridge=1/.test(candidate.url()));
    if (frame && await frame.evaluate(() => !!window.WE_SPA).catch(() => false)) return frame;
    await page.waitForTimeout(100);
  }
  return null;
}

async function launch() {
  for (const channel of ['chrome', 'msedge']) {
    try { return await chromium.launch({ channel }); } catch (_e) {}
  }
  return chromium.launch();
}

(async () => {
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 1536, height: 960 } });
  const errors = [];
  const missing = new Map();
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push('pageerror: ' + error.message));
  page.on('response', (response) => {
    if (response.status() < 400 || /favicon/i.test(response.url())) return;
    let url = response.url();
    try { url = decodeURIComponent(url); } catch (_e) {}
    missing.set(url, (missing.get(url) || 0) + 1);
  });

  // 模拟与橱窗同源的壳子；只实现 watchView 协议，返回结构与 AcuData 完全一致。
  await page.route(BRIDGE_URL, async (route) => {
    const panelUrl = new URL(BASE);
    panelUrl.searchParams.set('acuBridge', '1');
    await route.fulfill({
      contentType: 'text/html; charset=utf-8',
      body: `<!doctype html><iframe id="app" style="width:100%;height:100%;border:0"></iframe>
<script>
const WORLD=${JSON.stringify(WORLD).replace(/</g, '\\u003c')};
const app=document.getElementById('app');
addEventListener('message',e=>{
  const m=e.data;
  if(!m||m.type!=='we-watch-view')return;
  e.source.postMessage({type:'we-watch-view-result',watchId:m.watchId,ok:true,
    result:{ok:true,data:{background_world:WORLD},revision:1}},'*');
});
app.src=${JSON.stringify(panelUrl.href + '#/overview')};
</script>`,
    });
  });
  await page.goto(BRIDGE_URL, { waitUntil: 'load' });

  let bad = 0;
  const index = await indexFrame(page);
  if (!index) {
    throw new Error('静态站入口未通过真实数据桥启动\nframes:\n'
      + page.frames().map((frame) => '  ' + frame.url()).join('\n')
      + '\nerrors:\n  ' + errors.join('\n  '));
  }

  for (const [id, label, file] of ROUTES) {
    await index.evaluate((route) => window.WE_SPA.navigate(route), id);
    const frame = await panelFrame(page, file);
    if (!frame) { console.log(`✗ ${id} 没挂上子页`); bad++; continue; }
    const active = await frame.$eval('.nav-item.on', (element) => element.textContent.trim()).catch(() => '');
    const panels = await frame.$$eval('.panel', (elements) => elements.length).catch(() => 0);
    const ok = active === label && panels > 0;
    if (!ok) bad++;
    console.log(`${ok ? '✓' : '✗'} ${id}  高亮=${active || '无'}  面板=${panels}`);
  }

  await index.evaluate(() => window.WE_SPA.navigate('overview'));
  const from = await panelFrame(page, '总览.html');
  await from.click('.nav-item[data-route="tasks"]');
  const landed = await panelFrame(page, '任务与事件.html');
  const hash = await index.evaluate(() => location.hash);
  const clickOk = hash === '#/tasks' && !!landed;
  if (!clickOk) bad++;
  console.log(`${clickOk ? '✓' : '✗'} 侧栏切页  hash=${hash}`);

  // 不带桥直接打开：必须明确拒绝 mock，而不是静默展示假数据。
  const direct = await browser.newPage();
  await direct.goto(BASE, { waitUntil: 'load' });
  const noMock = await direct.locator('#status').innerText();
  const noMockOk = noMock.includes('需要从异步助手橱窗打开');
  if (!noMockOk) bad++;
  console.log(`${noMockOk ? '✓' : '✗'} 直开站点不回退 mock`);
  await direct.close();

  const realErrors = errors.filter((text) => !/favicon|ERR_FILE|net::ERR/i.test(text));
  console.log(realErrors.length
    ? `✗ 控制台报错 ${realErrors.length} 条：\n  ` + realErrors.slice(0, 8).join('\n  ')
    : '✓ 无控制台报错');
  if (missing.size) {
    bad++;
    console.log(`✗ 资源 404 ${missing.size} 种`);
    for (const [url, count] of [...missing.entries()].slice(0, 10)) console.log(`  ×${count} ${url}`);
  } else {
    console.log('✓ 无资源 404');
  }

  await browser.close();
  process.exit(bad || realErrors.length ? 1 : 0);
})().catch((error) => { console.error(error); process.exit(1); });
