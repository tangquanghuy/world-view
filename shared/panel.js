/**
 * 四个面板页共用的取数与渲染工具。
 * 依赖：shared/vocab.js（中文词典）、shared/wtime.js（架空历法时间）。
 *
 * 这里只放跨页面重复出现的东西。页面专属逻辑留在各自的 HTML 里。
 *
 * 路由：单页入口（index.html）用 hash；独立打开四个 HTML 时仍走文件跳转。
 * 数据：由 index.html 从异步助手 AcuData 桥取得后挂在 parent.WE_WORLD_DATA。
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

  let DATA = {};
  try {
    DATA = global.parent && global.parent.WE_WORLD_DATA || {};
  } catch (_e) {
    DATA = {};
  }

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
     人物图：用户自定义链接 > 正文美化内置名册 > 黄底剪影池。
     同一个名字哈希到同一张剪影，圆头像用立绘上半身裁切。
     势力纹章和地区徽记仍用 icons-v2。 */
  const ASSET_ROOT = global.WE_ASSET_ROOT != null ? String(global.WE_ASSET_ROOT) : 'assets-gpt-image-2/';
  const SILHOUETTE_ROOT = global.WE_SILHOUETTE_ROOT != null ? String(global.WE_SILHOUETTE_ROOT) : 'assets/silhouettes/';
  const SILHOUETTE_POOL = [
    'silhouette-01.png', 'silhouette-02.png', 'silhouette-03.png', 'silhouette-04.png',
    'silhouette-05.png', 'silhouette-06.png', 'silhouette-07.png', 'silhouette-08.png',
  ];
  /* 与 正文美化智慧姬兼容.html 同一套：头像走 /头像/，封面立绘走 /封面/。
     典狱长、特图没有封面，立绘回落到头像。塔菲来自精简版正文美化。 */
  const CHAR_ART_STORAGE = 'we-char-art-v1';
  const CHAR_AVATAR_BASE = 'https://rpg.bolt.qzz.io/%E5%A4%B4%E5%83%8F/';
  const CHAR_COVER_BASE = 'https://rpg.bolt.qzz.io/%E5%B0%81%E9%9D%A2/';
  const CHAR_COVER_EXCLUDED = new Set(['典狱长', '特图']);
  const BUILTIN_CHAR_ART = {};
  [
    ['法露特'], ['星极'], ['奈雅丽'], ['艾克莉西娅'], ['红莲'], ['特图'], ['典狱长'],
    ['初濑伊纲', ['初濑伊纲', '伊纲']], ['白'], ['史蒂芬妮'], ['吉普莉尔'], ['菲尔'],
    ['克拉米'], ['绯'], ['奥契丝'], ['亚丝娜'], ['露露卡'], ['优纪'], ['桐子'], ['米特'],
    ['莉法'], ['西莉卡'], ['诗乃'], ['阿尔戈'], ['罗曼'], ['芙蕾雅'], ['卡提希娅'],
    ['爱弥斯'], ['璐米欧儿'], ['雅儿贞特'], ['达妮娅'], ['洛茜'], ['夏弥'],
    ['绘梨衣', ['上杉绘梨衣', '绘梨衣']], ['陈墨瞳', ['陈墨瞳', '诺诺']],
    ['叶瞬光', ['叶瞬光', '瞬光']], ['莉贝尔'], ['塔菲'],
  ].forEach((row) => {
    const name = row[0];
    const aliases = row[1] || [name];
    const avatar = CHAR_AVATAR_BASE + encodeURIComponent(name) + '.webp';
    BUILTIN_CHAR_ART[name] = {
      avatar,
      portrait: CHAR_COVER_EXCLUDED.has(name) ? '' : CHAR_COVER_BASE + encodeURIComponent(name) + '.webp',
      aliases,
    };
  });
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
  const poolPick=(pool,name)=>pool[hash(name)%pool.length];
  function silhouetteFile(name){return SILHOUETTE_ROOT+poolPick(SILHOUETTE_POOL,name)}
  function readCustomArtMap(){
    try{
      const raw=global.localStorage&&global.localStorage.getItem(CHAR_ART_STORAGE);
      const parsed=raw?JSON.parse(raw):{};
      return parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed:{};
    }catch(_e){return {};}
  }
  function writeCustomArtMap(map){
    try{global.localStorage&&global.localStorage.setItem(CHAR_ART_STORAGE,JSON.stringify(map||{}));}
    catch(_e){}
  }
  function lookupArtRow(name,map){
    const n=String(name||'').trim();
    if(!n||!map||typeof map!=='object')return null;
    if(map[n])return map[n];
    for(const row of Object.values(map)){
      if(row&&Array.isArray(row.aliases)&&row.aliases.includes(n))return row;
    }
    return null;
  }
  function getCustomArt(name){return lookupArtRow(name,readCustomArtMap());}
  function normalizeImageUrl(url){
    let trimmed=String(url||'').trim();
    if(!trimmed)return '';
    if(/^(SFW|NSFW)\//.test(trimmed)){
      if(!/\.(webp|png|jpg|jpeg|gif|bmp|svg)(\?|#|$)/i.test(trimmed)) trimmed+='.webp';
      return 'https://rpg.bolt.qzz.io/'+trimmed;
    }
    return trimmed;
  }
  function isAllowedImageUrl(url){
    const t=String(url||'').trim();
    if(!t)return true;
    if(/^(SFW|NSFW)\//.test(t))return true;
    if(/^https?:\/\//i.test(t))return true;
    if(/^data:image\//i.test(t))return true;
    return false;
  }
  function setCustomArt(name,art){
    const n=String(name||'').trim();
    if(!n)return getCustomArt(n);
    const map=readCustomArtMap();
    const avatar=normalizeImageUrl(art&&art.avatar);
    const portrait=normalizeImageUrl(art&&art.portrait);
    if(!avatar&&!portrait)delete map[n];
    else map[n]={avatar,portrait};
    writeCustomArtMap(map);
    return map[n]||null;
  }
  function clearCustomArt(name){return setCustomArt(name,{});}
  function lookupBuiltinArt(name){return lookupArtRow(name,BUILTIN_CHAR_ART);}
  function avatarFile(name){
    const custom=getCustomArt(name);
    if(custom&&custom.avatar)return custom.avatar;
    const built=lookupBuiltinArt(name);
    if(built&&built.avatar)return built.avatar;
    return silhouetteFile(name);
  }
  function portraitFile(name){
    const custom=getCustomArt(name);
    if(custom&&custom.portrait)return custom.portrait;
    const built=lookupBuiltinArt(name);
    if(built&&built.portrait)return built.portrait;
    if(built&&built.avatar)return built.avatar;
    return silhouetteFile(name);
  }
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
    const file = person ? avatarFile(name) : '';
    const fallback = `this.replaceWith(Object.assign(document.createElement('span'),{className:'${cls}${shape} ph',textContent:'${initial}'}))`;
    if (file) return `<img class="${cls}${shape}" src="${esc(file)}" alt="${esc(name)}" title="${tip}" onerror="${fallback}">`;
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
    avatarFile, portraitFile, silhouetteFile, crestFile, sigilFile, isPerson,
    getCustomArt, setCustomArt, clearCustomArt, isAllowedImageUrl,
    avatarTag, avatarRow, participantList,
    fieldKey, termRow, kvGrid,
    timeHH, progressOf, pageSlice, renderPager, toast, initChrome,
    ROUTES, goto,
  };
})(window);

