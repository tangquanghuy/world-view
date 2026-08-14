/**
 * 汇总美术资产缺口清单。
 * 数据来自 橱窗样稿/_asset-audit-report.json（四个页面各自的 DOM 资产扫描结果），
 * 这里只做归并统计，不再重新抓页面。
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', '..', '橱窗样稿', '_asset-audit-report.json');
const R = JSON.parse(fs.readFileSync(SRC, 'utf8'));

const PAGE_NAME = { overview: '世界总览', character: '角色档案', faction: '势力与地区', task: '任务与事件' };
const pages = Object.keys(R);

console.log('页面:', pages.map((k) => `${PAGE_NAME[k] || k}(${R[k].file})`).join('\n      '));

// 1) 图片资产：按 src 归并，记录出现页面、渲染尺寸、是否破图
const imgs = new Map();
for (const k of pages) {
  for (const im of R[k].imgs || []) {
    const e = imgs.get(im.src) || { src: im.src, pages: new Set(), sizes: new Set(), broken: false, count: 0, where: im.where, near: im.near };
    e.pages.add(PAGE_NAME[k] || k);
    if (im.box) e.sizes.add(`${Math.round(im.box.w)}×${Math.round(im.box.h)}`);
    if (im.broken) e.broken = true;
    e.count++;
    imgs.set(im.src, e);
  }
}

// 2) CSS 背景图
const bgs = new Map();
for (const k of pages) {
  for (const b of R[k].bgs || []) {
    const url = b.url || b.src || JSON.stringify(b).slice(0, 60);
    const e = bgs.get(url) || { url, pages: new Set(), count: 0, sample: b };
    e.pages.add(PAGE_NAME[k] || k);
    e.count++;
    bgs.set(url, e);
  }
}

// 3) 当图标用的 Unicode 字形：这些是最该换成真美术的地方
const uni = new Map();
for (const k of pages) {
  for (const u of R[k].uni || []) {
    const e = uni.get(u.ch) || { ch: u.ch, code: u.code, pages: new Set(), count: 0, sizes: new Set(), wheres: new Set() };
    e.pages.add(PAGE_NAME[k] || k);
    e.count++;
    if (u.fontSize) e.sizes.add(u.fontSize);
    if (u.where) e.wheres.add(String(u.where).split(' < ')[0]);
    uni.set(u.ch, e);
  }
}

// 4) 文字兜底头像：说明该角色没有立绘
const avatars = new Map();
for (const k of pages) {
  for (const a of R[k].textAvatars || []) {
    const e = avatars.get(a.text) || { text: a.text, pages: new Set(), sizes: new Set(), radius: a.radius };
    e.pages.add(PAGE_NAME[k] || k);
    if (a.box) e.sizes.add(`${Math.round(a.box.w)}×${Math.round(a.box.h)}`);
    avatars.set(a.text, e);
  }
}

// 5) 请求失败的资源
const failed = new Map();
for (const k of pages) {
  for (const f of R[k].failed || []) {
    const url = decodeURIComponent(String(f.url || f)).split('/橱窗样稿/').pop();
    const e = failed.get(url) || { url, pages: new Set() };
    e.pages.add(PAGE_NAME[k] || k);
    failed.set(url, e);
  }
  for (const q of R[k].requests || []) {
    if (q.status && q.status >= 400) {
      const url = decodeURIComponent(String(q.url)).split('/橱窗样稿/').pop();
      const e = failed.get(url) || { url, pages: new Set() };
      e.pages.add(PAGE_NAME[k] || k);
      failed.set(url, e);
    }
  }
}

const P = (s) => [...s].join('、');

console.log(`\n${'='.repeat(78)}\n图片资产 ${imgs.size} 个（引用 ${[...imgs.values()].reduce((a, e) => a + e.count, 0)} 次）\n${'='.repeat(78)}`);
[...imgs.values()].sort((a, b) => b.count - a.count).forEach((e) =>
  console.log(`${e.broken ? '[破图] ' : '      '}${e.src.padEnd(46)} ${String(e.count).padStart(3)}次  ${[...e.sizes].join(',').padEnd(18)} ${P(e.pages)}`));

console.log(`\n${'='.repeat(78)}\nCSS 背景图 ${bgs.size} 个\n${'='.repeat(78)}`);
[...bgs.values()].sort((a, b) => b.count - a.count).forEach((e) => console.log(`  ${String(e.url).slice(0, 60).padEnd(62)} ${String(e.count).padStart(3)}次  ${P(e.pages)}`));

console.log(`\n${'='.repeat(78)}\n用 Unicode 字符顶替图标 ${uni.size} 种（共 ${[...uni.values()].reduce((a, e) => a + e.count, 0)} 处）\n${'='.repeat(78)}`);
[...uni.values()].sort((a, b) => b.count - a.count).forEach((e) =>
  console.log(`  ${e.ch}  ${e.code.padEnd(8)} ${String(e.count).padStart(3)}处  ${[...e.sizes].join(',').padEnd(14)} ${P(e.pages).padEnd(22)} ${[...e.wheres].slice(0, 3).join(' ')}`));

console.log(`\n${'='.repeat(78)}\n没有立绘、用文字顶替的角色 ${avatars.size} 个\n${'='.repeat(78)}`);
[...avatars.values()].forEach((e) => console.log(`  ${e.text.padEnd(10)} ${[...e.sizes].join(',').padEnd(12)} ${e.radius}  ${P(e.pages)}`));

console.log(`\n${'='.repeat(78)}\n加载失败 ${failed.size} 个\n${'='.repeat(78)}`);
[...failed.values()].forEach((e) => console.log(`  ${e.url.padEnd(50)} ${P(e.pages)}`));

/* ------------------------------------------------------------------
   通用资产覆盖率。
   数据是 AI 实时产出的，页面不认识具体是哪个势力哪个地区，
   所以不按实体数缺口，而按「枚举值是否都有对应图形」来算：
   每个枚举值配一枚图，就能覆盖任意数据。
   ------------------------------------------------------------------ */
const ICONS = path.join(__dirname, '..', 'assets', 'icons');
const AVATARS = path.join(__dirname, '..', 'assets', 'avatars');
const haveIcon = new Set(fs.existsSync(ICONS) ? fs.readdirSync(ICONS).map((f) => f.replace(/\.svg$/, '')) : []);
const avatarPool = fs.existsSync(AVATARS) ? fs.readdirSync(AVATARS).filter((f) => /^avatar-[fmn]-\d+\./.test(f)) : [];

// 枚举值 → 图形。值是现有图标名，null 表示还得画
const CREST = {                     // 势力纹样，按 resources[].type
  personnel: 'users-three', information: 'scroll', sites: 'buildings', other: 'circles-three-plus',
  funds: null, supplies: null, transport: null, authority: null,
};
const SIGIL = {                     // 地区图形，按 conditions[].category
  order: 'shield', population: 'users-three', travel: 'path', other: 'map-pin',
  commerce: null, access: null, infrastructure: null, supply: null, weather: null,
};
const BADGE = {                     // 人物状态徽标，按 current_state.status
  working: 'briefcase', travelling: 'navigation-arrow', meeting: 'chat-circle-dots',
  investigating: 'magnifying-glass', waiting: 'hourglass', recovering: 'heart',
  idle: 'clock', other: 'question', resting: null,
};

const B = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'mock', 'world-state-v09.json'), 'utf8')).background_world;

// 取某实体出现次数最多的枚举值，这是运行时选图的依据
const dominant = (list, key) => {
  const tally = new Map();
  for (const x of list || []) if (x && x[key]) tally.set(x[key], (tally.get(x[key]) || 0) + 1);
  return [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
};

const table = (title, mapping, exercised) => {
  const miss = Object.entries(mapping).filter(([, v]) => !v || !haveIcon.has(v));
  console.log(`\n  ${title}  ${Object.keys(mapping).length - miss.length}/${Object.keys(mapping).length} 已有`);
  for (const [k, v] of Object.entries(mapping)) {
    const ok = v && haveIcon.has(v);
    const used = exercised.has(k) ? `  ← 当前 mock 用到 ${exercised.get(k)} 次` : '';
    console.log(`    ${ok ? '有' : '缺'}  ${k.padEnd(16)} ${(v || '待画').padEnd(20)}${used}`);
  }
  return miss.length;
};

console.log(`\n${'='.repeat(78)}\n通用资产覆盖率（按枚举，不按实体）\n${'='.repeat(78)}`);

const facUse = new Map();
B.factions.forEach((f) => { const d = dominant(f.resources, 'type') || '(空)'; facUse.set(d, (facUse.get(d) || 0) + 1); });
const missCrest = table(`势力纹样  ← resources[].type，覆盖 ${B.factions.length} 个势力`, CREST, facUse);

const regUse = new Map();
B.regions.forEach((r) => { const d = dominant(r.conditions, 'category') || '(空)'; regUse.set(d, (regUse.get(d) || 0) + 1); });
const missSigil = table(`地区图形  ← conditions[].category，覆盖 ${B.regions.length} 个地区`, SIGIL, regUse);

const npcUse = new Map();
[...B.npcs, ...B.candidates].forEach((n) => { const s = (n.current_state || {}).status || '(空)'; npcUse.set(s, (npcUse.get(s) || 0) + 1); });
const missBadge = table('状态徽标  ← current_state.status', BADGE, npcUse);

const AVATAR_POOL = 30;   // 三组各 10
const PORTRAIT_POOL = 18; // 三组各 6
const portraitPool = fs.existsSync(AVATARS) ? fs.readdirSync(AVATARS).filter((f) => /^portrait-[fmn]-\d+\./.test(f)) : [];

const people = B.npcs.length + B.candidates.length;
console.log(`\n  人物形象池  头像 ${avatarPool.length}/${AVATAR_POOL}　立绘 ${portraitPool.length}/${PORTRAIT_POOL}`);
console.log(`    固定人物在契约里没有 profile（无性别年龄外貌），只能按名字哈希分配`);
console.log(`    当前 mock 有 ${people} 个人物；${AVATAR_POOL} 张池子一屏十几人基本不会撞图`);

const total = missCrest + missSigil + missBadge +
              (AVATAR_POOL - avatarPool.length) + (PORTRAIT_POOL - portraitPool.length) + failed.size;
console.log(`\n${'='.repeat(78)}`);
console.log(`还需新增：势力纹样 ${missCrest}、地区图形 ${missSigil}、状态徽标 ${missBadge}、` +
            `头像池 ${AVATAR_POOL - avatarPool.length}、立绘池 ${PORTRAIT_POOL - portraitPool.length}、` +
            `装饰件 ${failed.size}　合计 ${total}`);
console.log(`另有 ${uni.size} 种 Unicode 字符顶替图标，其中承担语义的 3 种建议换成现有图标`);
