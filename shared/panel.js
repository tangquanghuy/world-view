/**
 * 四个面板页共用的取数与渲染工具。
 * 依赖：shared/vocab.js（中文词典）、shared/wtime.js（架空历法时间）、mock/world-state-v09.js（数据）。
 *
 * 这里只放跨页面重复出现的东西。页面专属逻辑留在各自的 HTML 里。
 *
 * 路由：单页入口（index.html）用 hash；独立打开四个 HTML 时仍走文件跳转。
 * 数据：默认 WORLD_MOCK；嵌入异步助手橱窗壳子时可通过 postMessage 桥换真实视图。
 */
(function (global) {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const arr = (v) => (Array.isArray(v) ? v : []);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* 中文标签统一走 vocab.js，那里的每一组都对应契约里的一条枚举约束。
     必须带组名：同一个字符串在不同组里含义不同，例如 planned 是日程状态而不是阶段状态。 */
  const L = (group, value) => global.V.label(group, value, '未记录');

  const DATA = (global.WORLD_MOCK || {}).background_world || {};

  /* ---------- 色相 ----------
     同一个键在页面上永远是同一个颜色。按出现顺序分配，保证不同页面之间也一致
     （数据顺序是固定的）。 */
  const HUES = ['indigo', 'amber', 'violet', 'teal', 'green', 'purple', 'rose'];
  function hueCycler() {
    const map = new Map();
    return (key) => {
      const k = String(key || '');
      if (!map.has(k)) map.set(k, HUES[map.size % HUES.length]);
      return map.get(k);
    };
  }
  /** 字符串 → 稳定的正整数。用于给无语义的数据挑一张通用素材。 */
  function hash(s) {
    let h = 2166136261;
    for (const ch of String(s || '')) h = Math.imul(h ^ ch.codePointAt(0), 16777619);
    return (h >>> 0);
  }

  /* ---------- 头像与纹章 ----------
     页面事先不知道会出现什么人、什么势力，所以除了少数已画好的角色，
     其余一律按名字哈希从通用池里挑一张。挑中的结果对同一个名字永远相同。 */
  /* GPT Image 2 pools. Name hash selects a stable index; gender selects the pool.
     静态站根目录是「世界引擎面板/」时用 assets-gpt-image-2/；也可在页面里先设 window.WE_ASSET_ROOT。 */
  const ASSET_ROOT = global.WE_ASSET_ROOT != null ? String(global.WE_ASSET_ROOT) : 'assets-gpt-image-2/';
  const AVATAR_POOLS={female:["avatar-v2-01.png","avatar-v2-02.png","avatar-v2-03.png","avatar-v2-04.png","avatar-v2-06.png","avatar-v2-07.png","avatar-v2-10.png","avatar-v2-12.png","avatar-v2-14.png","avatar-v2-16.png","avatar-v2-18.png","avatar-v2-20.png","avatar-v2-25.png","avatar-v2-26.png","avatar-v2-32.png","avatar-v2-37.png","avatar-v2-39.png"],male:["avatar-n-10.png","avatar-v2-05.png","avatar-v2-08.png","avatar-v2-09.png","avatar-v2-11.png","avatar-v2-13.png","avatar-v2-15.png","avatar-v2-17.png","avatar-v2-19.png","avatar-v2-21.png","avatar-v2-22.png","avatar-v2-23.png","avatar-v2-24.png","avatar-v2-27.png","avatar-v2-28.png","avatar-v2-29.png","avatar-v2-30.png","avatar-v2-31.png","avatar-v2-33.png","avatar-v2-34.png","avatar-v2-35.png","avatar-v2-36.png","avatar-v2-38.png","avatar-v2-40.png"],neutral:["avatar-neutral-001.png","avatar-neutral-002.png","avatar-neutral-003.png","avatar-neutral-004.png","avatar-neutral-005.png","avatar-neutral-006.png","avatar-neutral-007.png","avatar-neutral-008.png","avatar-neutral-009.png","avatar-neutral-010.png","avatar-neutral-011.png","avatar-neutral-012.png","avatar-neutral-013.png","avatar-neutral-014.png","avatar-neutral-015.png","avatar-neutral-016.png","avatar-neutral-017.png","avatar-neutral-018.png","avatar-neutral-019.png","avatar-neutral-020.png","avatar-neutral-021.png","avatar-neutral-022.png","avatar-neutral-023.png","avatar-neutral-024.png","avatar-neutral-025.png","avatar-neutral-026.png","avatar-neutral-027.png","avatar-neutral-028.png","avatar-neutral-029.png","avatar-neutral-030.png","avatar-neutral-031.png"]};
  /* ??????????????????????
     female ????????? 15 / 23 / 29 / 37?????????????????????
     ????????????????????????????? */
  const PORTRAIT_POOLS={
    female:["portrait-v2-04.png","portrait-v2-09.png","portrait-v2-10.png","portrait-v2-13.png","portrait-v2-17.png","portrait-v2-19.png","portrait-v2-20.png","portrait-v2-21.png","portrait-v2-22.png","portrait-v2-31.png"],
    male:["portrait-v2-03.png","portrait-v2-05.png","portrait-v2-11.png","portrait-v2-16.png","portrait-v2-18.png","portrait-v2-27.png","portrait-v2-33.png","portrait-v2-38.png","portrait-v2-39.png"],
    neutral:["portrait-neutral-003.png","portrait-neutral-006.png","portrait-neutral-008.png","portrait-neutral-009.png","portrait-neutral-010.png","portrait-neutral-011.png","portrait-neutral-012.png","portrait-neutral-013.png","portrait-neutral-014.png","portrait-neutral-015.png"]
  };
  /* 势力纹章只取 001-018 这一段，后面 019-036 不用。

     那一段是横向的编结和几何块，摆进圆形徽章里只占中间窄窄一条，剩下的圆面空着，
     远看就是个小点（王都议会原来抽到 026 就是这样）；而且编结跟地区那边的
     地块轮廓恰好最像，正是这轮要拉开的两族。
     001-018 是竖构图的立式纹章——翼、焰、卷叶，撑得满圆面，也最像"一伙人的旗"。 */
  const CREST_POOL=["crest-v2-001.png","crest-v2-002.png","crest-v2-003.png","crest-v2-004.png","crest-v2-005.png","crest-v2-006.png","crest-v2-007.png","crest-v2-008.png","crest-v2-009.png","crest-v2-010.png","crest-v2-011.png","crest-v2-012.png","crest-v2-013.png","crest-v2-014.png","crest-v2-015.png","crest-v2-016.png","crest-v2-017.png","crest-v2-018.png"];
  /* 地区徽记只取 025-041 这一段，前面 001-024 不用。

     sigils-v2 里其实混着两族东西：001-024 是对称的纹章式卷草，跟 crests 的画法
     完全同源；025-041 是地物——同心环、海岸线、水纹、岛形、地块。
     全池随机挑的时候，星辉学院拿到 012、旧港夜市拿到 009，两枚卷草跟隔壁势力的
     纹章长在一个模子里，白纹一上暗盘就分不出哪个是势力哪个是地界。

     势力与地区在图上刻意用同一种圆徽章（不靠形状和站位分，那样会读成泳道），
     区分全押在「徽记本身是纹章还是地物」这一件事上——那这批素材就必须真的分成
     两族。17 枚地物足够摆开，重复要到第 18 个地区才发生。 */
  const SIGIL_POOL=["sigil-v2-025.png","sigil-v2-026.png","sigil-v2-027.png","sigil-v2-028.png","sigil-v2-029.png","sigil-v2-030.png","sigil-v2-031.png","sigil-v2-032.png","sigil-v2-033.png","sigil-v2-034.png","sigil-v2-035.png","sigil-v2-036.png","sigil-v2-037.png","sigil-v2-038.png","sigil-v2-039.png","sigil-v2-040.png","sigil-v2-041.png"];
  const personRecord=name=>arr(DATA.npcs).concat(arr(DATA.candidates)).find(x=>x&&x.name===name)||null;
  const genderKey=gender=>gender==='female'||gender==='\u5973'?'female':gender==='male'||gender==='\u7537'?'male':'neutral';
  const poolPick=(pool,name)=>pool[hash(name)%pool.length];
  function avatarFile(name,gender){const g=genderKey(gender||personRecord(name)?.profile?.gender);if(g==='female')return ASSET_ROOT+'avatars-v2/female/'+poolPick(AVATAR_POOLS.female,name);if(g==='male')return ASSET_ROOT+'avatars-v2/male/'+poolPick(AVATAR_POOLS.male,name);return ASSET_ROOT+'avatars/'+poolPick(AVATAR_POOLS.neutral,name)}
  function portraitFile(name,gender){const g=genderKey(gender||personRecord(name)?.profile?.gender);if(g==='female')return ASSET_ROOT+'portraits-v2/female/'+poolPick(PORTRAIT_POOLS.female,name);if(g==='male')return ASSET_ROOT+'portraits-v2/male/'+poolPick(PORTRAIT_POOLS.male,name);return ASSET_ROOT+'portraits/'+poolPick(PORTRAIT_POOLS.neutral,name)}
  const crestFile=faction=>ASSET_ROOT+'icons-v2/crests/'+poolPick(CREST_POOL,faction&&faction.name||'');
  const sigilFile=region=>ASSET_ROOT+'icons-v2/sigils/'+poolPick(SIGIL_POOL,region&&region.name||'');

  function mode(list, get) {
    const c = new Map();
    for (const x of arr(list)) {
      const k = typeof get === 'function' ? get(x) : x[get];
      if (k) c.set(k, (c.get(k) || 0) + 1);
    }
    let best = '', n = 0;
    for (const [k, v] of c) if (v > n) { n = v; best = k; }
    return best;
  }

  /* 两张表都按契约里的枚举一个不落地铺满：漏一项，那一类的势力／地区就会
     整页退成首字方块。resources[].type 与 conditions[].category 的取值见 v0.9 契约。 */
  const isPerson = (p) => (p && p.type || 'person') === 'person';

  /* 参与者的形状本身就是类型：人物是圆头像，势力和团体是盾形纹章。
     这样 type 不必再用「（人物·…）」这种文字占位，把版面让给真正有用的角色名。 */
  function avatarTag(p, cls = 'av', gender) {
    const name = typeof p === 'string' ? p : (p && p.name) || '';
    const person = typeof p === 'string' ? true : isPerson(p);
    const initial = esc(String(name || '?').slice(0, 1));
    const shape = person ? '' : ' crest';
    const tip = esc(name + (typeof p === 'object' && p && p.type ? '（' + L('participant.type', p.type) + '）' : ''));
    // 两张人物表的 profile.gender 都是契约里明写的，不用它就会被名字哈希分到中性头像池
    const g = gender || (typeof p === 'object' && p && p.profile && p.profile.gender) || personRecord(name)?.profile?.gender || '';
    const file = person ? avatarFile(name, g) : '';
    const fallback = `this.replaceWith(Object.assign(document.createElement('span'),{className:'${cls}${shape} ph',textContent:'${initial}'}))`;
    if (file) return `<img class="${cls}${shape}" src="${file}" alt="${esc(name)}" title="${tip}" onerror="${fallback}">`;
    return `<span class="${cls}${shape} ph" title="${tip}">${initial}</span>`;
  }
  function avatarRow(list, max = 3, cls = 'av') {
    const p = arr(list);
    return p.slice(0, max).map((x) => avatarTag(x, cls)).join('') + (p.length > max ? `<span class="av-more">+${p.length - max}</span>` : '');
  }
  /* 参与者名单：一人一格，头像／纹章 + 名字 + 在本任务里的角色。
     角色（role）才是这里唯一值得读的信息，所以给它独立一行，不再挤进括号。 */
  function participantList(list) {
    const ps = arr(list);
    if (!ps.length) return '<p class="parts-empty">未记录参与者</p>';
    return '<div class="parts">' + ps.map((p) =>
      '<div class="part">' + avatarTag(p, 'pav') +
      '<span class="pinfo"><b>' + esc(p.name || '未记录') + '</b>' +
      '<small>' + esc(p.role || L('participant.type', p.type)) + '</small></span></div>'
    ).join('') + '</div>';
  }

  /* ---------- 字段名 / 字段值 ----------
     全站唯一规格：字段名带图标、上色、13px 半粗；字段值 14px 深墨色。
     两者原来都是灰字、字号只差 1px，几项排在一起就是一堵没有落点的字墙。 */
  const fieldKey = (icon, text) => `<small class="k"><svg><use href="#${icon}"/></svg>${esc(text)}</small>`;
  const termRow = (r) => `<div${r[3] ? ' class="w"' : ''}>${fieldKey(r[0], r[1])}<b class="v">${esc(r[2] || '未记录')}</b></div>`;
  /** rows = [[icon, 名, 值, 是否整行], ...]，cols 为空时用 CSS 默认三列 */
  const kvGrid = (rows, cols) =>
    `<div class="kv"${cols ? ` style="--kv-cols:${cols}"` : ''}>${rows.map(termRow).join('')}</div>`;

  /* ---------- 时间 ---------- */
  const timeHH = (t) => { const m = String(t || '').match(/(\d{1,2}):(\d{2})/); return m ? m[1].padStart(2, '0') + ':' + m[2] : ''; };

  /* ---------- 进度 ----------
     只按已完成阶段数算，不发明百分比。没有阶段的任务只能给 0 或 100。 */
  function progressOf(t) {
    const s = arr(t.stages), d = s.filter((x) => x.status === 'completed').length;
    return s.length ? Math.round((d / s.length) * 100) : (t.status === 'completed' ? 100 : 0);
  }

  /* ---------- 切页 ----------
     页数按 max 定，定了页数再把条目摊匀，而不是每页都塞满 max：
     五条分两页是 3+2 不是 4+1，七条分三页是 3+2+2 不是 3+3+1。
     末页只站一个，横排里是右边空掉一整排，竖排里是一张孤零零的卡。
     每页都不会超过 max，所以横排组件一页仍然只占一排。

     不适用于多行网格：那里首页排满整行比两页条数接近更重要
     （七个人 6+1 首页两行齐平，摊匀成 4+3 反而首页多一个豁口）。
     回传收敛过的 page，调用方拿它写回自己的页码——窗口拉宽后页数会变少，
     不收敛就会停在一个已经不存在的末页上。 */
  function pageSlice(list, max, page) {
    const pages = Math.max(1, Math.ceil(list.length / max));
    const p = Math.min(Math.max(0, page | 0), pages - 1);
    const base = Math.floor(list.length / pages), rem = list.length % pages;
    const start = p * base + Math.min(p, rem);
    return { items: list.slice(start, start + base + (p < rem ? 1 : 0)), pages, page: p };
  }

  /* ---------- 翻页 ----------
     卡位有限，早的往后翻，不做静默截断。 */
  function renderPager(el, { page, pages, total, unit = '条', note = '', onGo }) {
    if (!el) return;
    if (pages <= 1) { el.innerHTML = ''; return; }
    el.innerHTML =
      `<button class="pg" data-d="-1"${page === 0 ? ' disabled' : ''}>← 更近</button>` +
      `<span class="pg-n">${esc(note)}　第 ${page + 1} / ${pages} 页　共 ${total} ${esc(unit)}</span>` +
      `<button class="pg" data-d="1"${page >= pages - 1 ? ' disabled' : ''}>更早 →</button>`;
    $$('.pg', el).forEach((b) => b.addEventListener('click', () => onGo(page + Number(b.dataset.d))));
  }

  /* ---------- 提示条 ---------- */
  let toastTimer = 0;
  function toast(msg) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('on'), 2200);
  }

  /* ---------- 页头与侧栏 ----------
     四个页面的顶栏、导航、播控完全一样，只有当前高亮项不同。 */
  /* 原型的侧栏还有「事件日志」和「世界设定」两项，都删了。
     事件日志：契约确实存了跨轮的世界变化（bg_world_change_log，本视图取 120 条），
     但总览页的「近来发生了什么」已经在完整分页展示同一份数据，再开一页是同一个列表摆两遍。
     世界设定：v0.9 没有任何一条产出对应它。
     导航项一律要有真页面——点了弹「尚未接入」的入口，比没有这个入口更糟。 */
  /* routeId → 独立 HTML 文件名。单页入口用 routeId；直接打开文件时用 file。 */
  const ROUTES = [
    { id: 'overview', label: '世界演进', icon: 'i-spark', file: '总览.html' },
    { id: 'characters', label: '角色管理', icon: 'i-people', file: '角色档案.html' },
    { id: 'factions', label: '势力与地区', icon: 'i-shield', file: '势力与地区.html' },
    { id: 'tasks', label: '任务与剧本', icon: 'i-scroll', file: '任务与事件.html' },
  ];
  const NAV = ROUTES.map((r) => [r.icon, r.label, r.file, r.id]);
  const ROUTE_BY_ID = Object.fromEntries(ROUTES.map((r) => [r.id, r]));
  const ROUTE_BY_LABEL = Object.fromEntries(ROUTES.map((r) => [r.label, r]));
  const ROUTE_BY_FILE = Object.fromEntries(ROUTES.map((r) => [r.file, r]));

  function spaHost() {
    try {
      if (global.parent && global.parent !== global && global.parent.WE_SPA) return global.parent.WE_SPA;
    } catch (_e) { /* 跨域壳子读不到 parent 属性，走 postMessage */ }
    return global.WE_SPA || null;
  }

  /** 跨页跳转。opts.focus 会写入 sessionStorage.focusTask，任务页启动时读取。 */
  function goto(target, opts) {
    const focus = opts && opts.focus != null ? String(opts.focus) : '';
    if (focus) {
      try { sessionStorage.setItem('focusTask', focus); } catch (_e) { /* ignore */ }
    }
    const route = ROUTE_BY_ID[target] || ROUTE_BY_LABEL[target] || ROUTE_BY_FILE[target] || null;
    const host = spaHost();
    if (host && typeof host.navigate === 'function' && route) {
      host.navigate(route.id, opts || {});
      return;
    }
    try {
      if (global.parent && global.parent !== global) {
        global.parent.postMessage({ type: 'we-goto', route: route ? route.id : target, opts: opts || {} }, '*');
        return;
      }
    } catch (_e) { /* ignore */ }
    location.href = route ? route.file : String(target);
  }

  function initChrome(activeLabel) {
    const raw = String(DATA.world?.[0]?.world_time || '');
    const dateEl = $('#wDate'), clockEl = $('#wClock');
    // 按分隔点切成整段。中文可以在任意字之间断行，整串交给浏览器的话
    // 390 下会折成「王历 312 / 年 · 霜月 / 12 日」这种断在词中间的三行。
    if (dateEl) {
      const date = raw.replace(/\s*[·・]?\s*\d{1,2}:\d{2}.*$/, '').trim();
      dateEl.innerHTML = date
        ? date.split(/\s*[·・]\s*/).filter(Boolean).map((seg) => `<i>${esc(seg)}</i>`).join('')
        : '时间未记录';
    }
    if (clockEl) clockEl.textContent = timeHH(raw) || '--:--';

    const active = ROUTE_BY_LABEL[activeLabel] || ROUTE_BY_ID[activeLabel] || null;
    const nav = $('#nav');
    if (nav) {
      nav.innerHTML = ROUTES.map((r) =>
        `<button class="nav-item${active && r.id === active.id ? ' on' : ''}" type="button" data-route="${r.id}"><svg class="ni"><use href="#${r.icon}"/></svg>${r.label}</button>`
      ).join('');
      $$('.nav-item', nav).forEach((b) => b.addEventListener('click', () => {
        if (b.classList.contains('on')) toast('已经在' + b.textContent.trim());
        else goto(b.dataset.route);
      }));
    }

    /* 这里原来还有三样东西，都删了。

       「速度倍率 × 2.0」和「暂停中／继续」：契约里没有任何间隔、频率、速度字段
       （推演由后台的 bg_world_tick_v09 驱动），× 2.0 是四页写死的一个数，
       那对按钮是个只会弹吐司的假开关。页面是引擎产出的显示端，不是它的遥控器。

       `[data-toast]` 的全局委托：它的唯一用途是让「摆一个点了弹『尚未接入』的按钮」
       变得很省事，四页曾经挂了 11 处。占位按钮比没有这个按钮更糟——它承诺了一个
       不存在的地方。真需要弹一句时直接调 P.toast，不要再造这个口子。 */
  }

  global.P = {
    $, $$, arr, esc, L, DATA,
    HUES, hueCycler, hash, mode,
    avatarFile, portraitFile, crestFile, sigilFile, isPerson,
    avatarTag, avatarRow, participantList,
    fieldKey, termRow, kvGrid,
    timeHH, progressOf, pageSlice, renderPager, toast, initChrome,
    ROUTES, goto,
  };
})(window);

