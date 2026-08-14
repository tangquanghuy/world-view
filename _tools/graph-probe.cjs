/**
 * 拓扑图专用体检：把每个节点的盒子和画布对齐着量一遍，报出
 *   1) 越出画布边界的节点（会被 overflow:hidden 切掉）
 *   2) 名字被 text-overflow 省略掉的节点
 *   3) 节点之间、边标签之间、边标签与节点之间的重叠
 * 光看截图只能看出"好像挤了一下"，量出来才知道差几个像素。
 *   node _tools/graph-probe.cjs [宽度] [节点数上限压测: stress]
 */
const { chromium } = require('playwright-core');
const { pathToFileURL } = require('url');
const fs = require('fs');
const path = require('path');

const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const BASE = path.join(__dirname, '..');
const width = Number(process.argv[2]) || 1536;
const stress = process.argv.includes('stress');

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: EDGE, args: ['--allow-file-access-from-files', '--disable-web-security'] });
  const page = await browser.newPage({ viewport: { width, height: 1000 }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(path.join(BASE, '势力与地区.html')).href, { waitUntil: 'load' });
  await page.waitForTimeout(700);

  if (stress) {
    // 页面里留了 __stressGraph(势力数, 地区数) 钩子，灌的假数据每条数组都顶到契约上限
    const nf = Number(process.argv[4]) || 8;
    const nr = Number(process.argv[5]) || 10;
    const info = await page.evaluate(([a, b]) => window.__stressGraph(a, b), [nf, nr]);
    console.log(`  灌入 ${info.factions} 势力 / ${info.regions} 地区 / ${info.edges} 条边（名字全部用 10 字长名）`);
    await page.waitForTimeout(600);
  }

  const res = await page.evaluate(() => {
    const box = document.querySelector('.gcanvas');
    const cb = box.getBoundingClientRect();
    const rect = (el) => { const r = el.getBoundingClientRect(); return { x: r.x - cb.x, y: r.y - cb.y, w: r.width, h: r.height, r: r.right - cb.x, b: r.bottom - cb.y }; };
    const nodes = [...box.querySelectorAll('.gnode')].map((el) => {
      const nm = el.querySelector('.gname'), st = el.querySelector('.gstate');
      const r = rect(el);
      // 子元素可能溢出节点盒子（grid 固有宽度算错时就会这样），所以盒子取并集
      [nm, st].forEach((c) => { if (!c) return; const q = rect(c); r.x = Math.min(r.x, q.x); r.y = Math.min(r.y, q.y); r.r = Math.max(r.r, q.r); r.b = Math.max(r.b, q.b); });
      r.w = r.r - r.x; r.h = r.b - r.y;
      const gb = el.firstElementChild.getBoundingClientRect();
      const bleed = [nm, st].filter(Boolean).map((c) => { const q = c.getBoundingClientRect(); return Math.max(q.right - gb.right, gb.left - q.left); });
      return { name: nm.textContent, state: st ? st.textContent.trim() : '—', ...r, bleed: Math.max(0, ...bleed), boxw: gb.width, cut: (nm.scrollWidth > nm.clientWidth + 1) || (st && st.scrollWidth > st.clientWidth + 1) };
    });
    /* 背景线的标签默认是隐形的，只在悬停那一簇子图时才现身。
       它们照样有盒子，量重叠时会报出一堆玩家根本看不见的"压节点"。
       按实际算出来的可见性分开——不按类名，换实现也不会失灵。 */
    const visible = (el) => {
      for (let e = el; e && e !== document.body; e = e.parentElement) {
        const s = getComputedStyle(e);
        if (s.display === 'none' || s.visibility === 'hidden') return false;
        if (parseFloat(s.opacity) < 0.05) return false;
      }
      return true;
    };
    const tags = [...box.querySelectorAll('.gtag')]
      .map((el) => ({ name: el.textContent, vis: visible(el), ...rect(el) }));
    return { W: cb.width, H: cb.height, nodes, tags, edges: box.querySelectorAll('svg.wires path[stroke]').length };
  });

  const hit = (a, b) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.y, b.y));
  const out = [];
  res.nodes.forEach((n) => {
    if (n.x < -0.5 || n.y < -0.5 || n.r > res.W + 0.5 || n.b > res.H + 0.5) out.push(`越界  ${n.name}  盒子 ${n.x.toFixed(0)},${n.y.toFixed(0)} → ${n.r.toFixed(0)},${n.b.toFixed(0)}  画布 ${res.W.toFixed(0)}×${res.H.toFixed(0)}`);
    if (n.cut) out.push(`名字被省略号截断  ${n.name}`);
  });
  for (let i = 0; i < res.nodes.length; i++) for (let j = i + 1; j < res.nodes.length; j++) { const a = hit(res.nodes[i], res.nodes[j]); if (a > 1) out.push(`节点相叠  ${res.nodes[i].name} × ${res.nodes[j].name}  ${a.toFixed(0)}px²`); }
  // 重叠只量玩家真看得见的那批；隐形标签仍然进上面的标签数对账
  const shown = res.tags.filter((t) => t.vis);
  for (let i = 0; i < shown.length; i++) {
    for (let j = 0; j < res.nodes.length; j++) { const a = hit(shown[i], res.nodes[j]); if (a > 1) out.push(`标签压节点  「${shown[i].name}」 × ${res.nodes[j].name}  ${a.toFixed(0)}px²`); }
    for (let j = i + 1; j < shown.length; j++) { const a = hit(shown[i], shown[j]); if (a > 1) out.push(`标签相叠  「${shown[i].name}」 × 「${shown[j].name}」  ${a.toFixed(0)}px²`); }
  }

  const hid = res.tags.length - shown.length;
  console.log(`\n宽度 ${width}${stress ? '（上限压测）' : ''}　画布 ${res.W.toFixed(0)}×${res.H.toFixed(0)}　节点 ${res.nodes.length}　连线 ${res.edges}　标签 ${res.tags.length}${hid ? `（常显 ${shown.length}，悬停才现身 ${hid}，重叠只量常显那批）` : ''}`);
  if (process.argv.includes('dump')) res.nodes.forEach((n) => console.log(`  ${n.name.padEnd(12)} x ${n.x.toFixed(0)}→${n.r.toFixed(0)}  ${n.w.toFixed(0)}×${n.h.toFixed(0)}  内盒 ${n.boxw.toFixed(1)}  出血 ${n.bleed.toFixed(1)}  [${n.state}]${n.cut ? '  ← 文字被截断' : ''}`));
  if (res.tags.length !== res.edges) console.log(`!! 标签数 ${res.tags.length} ≠ 连线数 ${res.edges}，有边被静默丢掉了`);
  console.log(out.length ? out.map((s) => '  ' + s).join('\n') : '  无越界、无截断、无重叠。');
  if (process.argv.includes('shot')) {
    const f = path.join(BASE, '_shots', `graph-${width}${stress ? '-stress' : ''}.png`);
    await page.locator('.gwrap').screenshot({ path: f });
    console.log('  截图 ' + path.relative(BASE, f));
  }
  await browser.close();
  process.exit(out.length || res.tags.length !== res.edges ? 1 : 0);
})();
