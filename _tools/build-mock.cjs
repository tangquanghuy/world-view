/**
 * 从旧 demo 数据生成统一 mock，输出形态严格对齐正式产出的
 * dataViews → bg_world_structured_v09（rootKey: background_world）。
 *
 * 同时修正旧 demo 里不符合字段契约的枚举值，并补出缺失的 changes 集合。
 * 契约来源：配置方案/后台世界引擎-三类演进版-v0.9.json
 *          → units[0].impl.sub.format.fields
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const OLD = path.join(ROOT, '橱窗样稿', '_task-event-data.json');
const OUT = path.join(__dirname, '..', 'mock', 'world-state-v09.json');

/* ---------- 记录改名 ----------
   契约要求事件名写成正在发生的局势，不写成需要完成的行动；又因为名称本身就是记录匹配键，
   新建记录的名称必须与已有记录明显不同，不能只差一两个字。
   旧 demo 这个事件叫「失窃文书流向追踪」，两条都犯了：是个动作名，还跟任务
   「失踪文书流向追踪」只差一个字，页面上两行挨着会读成重复渲染。
   按它自己的 trigger（学院清点发现三份禁限文书缺失）改成局势名。
   只改整串相等的地方，正文里的「失窃文书」照旧——那些文书确实是被偷的。

   势力「星辉学会」和它控制的地区「星辉学院」同样只差一个字，同一条规则。
   这家的资源是三套目录、内部群体叫档案派、焦点是禁限知识流通，按它实际管的事
   改成「星辉典籍会」——沿用本世界「意象＋组织类型词」的叫法（黑石港商会、灰鸦佣兵团），
   避开「学派」（还是差一个字）和「议会」（和王都议会撞概念）。 */
const RENAME = {
  失窃文书流向追踪: '学院禁限文书失窃',
  星辉学会: '星辉典籍会',
};

const rename = (o) => {
  if (typeof o === 'string') return RENAME[o] || o;
  if (Array.isArray(o)) return o.map(rename);
  if (o && typeof o === 'object') {
    const out = {};
    for (const k of Object.keys(o)) out[k] = rename(o[k]);
    return out;
  }
  return o;
};

// 在最前面改完，下游的 events、各处引用和派生的 change_key 就都是新名字
const D = rename(JSON.parse(fs.readFileSync(OLD, 'utf8')));

/* ---------- 枚举修正表 ---------- */

// task.category：契约只允许 main_task/side_task/character_task/faction_project/personal_task/other，
// 且「只有输入明确时区分主线和支线」，后台自主演进的任务一律不得标主线/支线。
const TASK_CATEGORY = {
  灰牙洞失联委托: 'character_task',   // 公会委托，由艾琳、赛文两名人物承接
  商会与海盗停火接触: 'faction_project', // 黑石港商会推动的组织级项目
  失踪文书流向追踪: 'character_task',   // 星辉学会委托，由赛文一人执行
  边境药材护送: 'character_task',      // 公会委托，由凯尔承接
  地下水道巡查: 'faction_project',     // 王都议会的公共事务项目
};

// stages[].status：契约用 available，旧数据写成了 planned
const STAGE_STATUS = { planned: 'available' };

// regions[].conditions[].category：契约用 travel，旧数据写成了 transport
const REGION_COND_CATEGORY = { transport: 'travel' };

// factions[].resources[].type：契约用 information，旧数据写成了 records
const RESOURCE_TYPE = { records: 'information' };

// factions[].areas[].relation_type：契约用 contested，旧数据写成了 contest
const AREA_RELATION = { contest: 'contested' };

// knowledge[].status：契约用 uncertain，旧数据写成了 likely
const KNOWLEDGE_STATUS = { likely: 'uncertain' };

// regions[].control.status：契约只有 controlled/shared/contested/unclaimed/unclear。
// 旧数据把"通行受限""秩序被破坏"这类地区条件误写进了控制状态，
// 而这些事实本就已经记在 conditions 里，控制方并未改变。
const CONTROL_STATUS = { disrupted: 'controlled', open_with_restrictions: 'controlled', open: 'controlled' };

// regions[].conditions[].category：契约用 commerce（地区表没有 economy，那是人物条件表的值）
const REGION_COND_CATEGORY2 = { economy: 'commerce' };

// participants[].type：契约只有 person/faction/group/other。
// 「边境哨站」作为处置主体是一支驻守班子，不是地点，归 group。
const PARTICIPANT_TYPE = { region: 'group' };

/* 好感度：只有 npc/candidate 的 relations 有 favorability（0-100，50 为中性熟人）
   与 favorability_change（本轮变动，需与 favorability 自洽），非人物目标一律填 0。
   势力之间的 relations 契约里没有这两个字段，不能套用。
   旧 demo 整个字段都没有，这里按各人已成立的互动事实补齐。 */
const FAVOR = {
  '艾琳→赛文': [68, 2],    // 本轮共同核对失联委托底单
  '赛文→艾琳': [66, 2],    // 同上，互相配合
  '莉莉安→赛文': [57, 0],  // 稳定的工作往来，本轮无互动
};

/* 固定人物 profile：v0.9 起契约给 npc_updates 加了这一块（职业／年纪／性别／外貌／性格），
   只供面板展示，不进「主剧情可用后台上下文」那份视图。旧 demo 成文时还没有这个字段。

   照契约的分工写：这里只放长期成立的部分，一次性的状态归 current_state.observable_state。
   艾琳那句「连续值班后略显疲劳，仍穿着公会值班制服」是今晚的样子，不是她的长相，
   所以下面写的是发式、常服和那枚旧登记牌——明天换班了这些还在。 */
const NPC_PROFILE = {
  艾琳: { occupation: '边境冒险者公会值班登记员', social_role: '公会值班登记员', age: 26, gender: '女', livelihood: '负责委托登记、回程核对与值班交接，领取公会固定薪酬', main_location: '边境冒险者公会', capability_basis: '熟悉公会委托登记、回程记录和失联核对流程', appearance: '深棕短发扎在脑后，惯穿公会制式外套，左腕一枚磨旧的登记牌', personality_tags: ['守规矩', '认死理', '不爱寒暄'] },
  赛文: { occupation: '星辉典籍会研究员', social_role: '典籍会研究员', age: 29, gender: '男', livelihood: '整理、比对和研究典籍会保存的文献，领取研究员津贴', main_location: '星辉学院·档案塔', capability_basis: '长期从事文献抄录、目录比对与禁限文书核验', appearance: '身量偏高，浅色长发束起，学院深蓝罩袍，随身一只装抄录工具的旧皮夹', personality_tags: ['刨根问底', '话少', '对文献较真'] },
  米娅: { occupation: '旧港中间人', social_role: '港区中间人', age: 31, gender: '女', livelihood: '为商贩、船员和临时客人传递消息并撮合交易，按次收取佣金', main_location: '旧港与黑石港南堤', capability_basis: '长期在港区往来，熟悉商贩、船员和各处联络门路', appearance: '利落短发，习惯压低宽檐旅帽，衣着刻意不显眼', personality_tags: ['嘴严', '算得清账', '不轻信人'] },
  凯尔: { occupation: '公会护送员', social_role: '公会护送员', age: 34, gender: '男', livelihood: '承接公会发布的货物与人员护送，按路程和风险结算报酬', main_location: '边境冒险者公会与北境驿道', capability_basis: '有长期护送和野外行路经历，熟悉驿道补给与风险判断', appearance: '肩背宽厚，左眉一道旧疤，磨旧皮甲外罩公会护送徽记', personality_tags: ['沉稳', '耐得住长路', '话只说一半'] },
  诺亚: { occupation: '王都议会水道巡查员', social_role: '水道巡查员', age: 27, gender: '男', livelihood: '负责地下水道巡查、设施记录与异常上报，领取议会薪酬', main_location: '地下水道与王都议会水道处', capability_basis: '熟悉地下水道结构、闸门巡查和现场痕迹记录', appearance: '中等个头，短发常被水汽打湿，防水斗篷配过膝胶靴', personality_tags: ['胆子大', '爱记细节', '独来独往'] },
  莉莉安: { occupation: '星辉学院学生', social_role: '学院学生', age: 20, gender: '女', livelihood: '以学院课程、抄录杂务和家中供给维持学业生活', main_location: '星辉学院', capability_basis: '接受学院基础训练，能完成文献抄录与资料整理', appearance: '个子娇小，浅金卷发，出门总抱着一摞书', personality_tags: ['用功', '怕生', '认真过头'] },
};

const CANDIDATE_PROFILE = {
  露西: { occupation: '代写员', social_role: '代写员', age: 24, gender: '女', livelihood: '为摊主和临时客人代写文书与简单账目', main_location: '旧港夜市', capability_basis: '识字并有处理简单账目的实际经历', appearance: '身形偏瘦，常年穿洗得发白的深灰罩衫，右手中指有长期握笔留下的茧', personality_tags: ['沉得住气', '记性好', '不轻易表态'] },
};
const arr = (v) => (Array.isArray(v) ? v : []);
const map = (table, v) => (v in table ? table[v] : v);

// 势力关系：契约字段就这六个，不带好感度
const factionRelation = (r) => ({
  target_type: r.target_type,
  target_name: r.target_name,
  relation_type: r.relation_type,
  current_basis: r.current_basis || '',
  recent_change: r.recent_change || '',
  changed_at: r.changed_at || '',
});

// 人物关系：契约要求好感度两字段始终存在
const withFavor = (owner) => (r) => {
  const [fav, chg] = FAVOR[`${owner}→${r.target_name}`] || [0, 0];
  return {
    target_type: r.target_type,
    target_name: r.target_name,
    relation_type: r.relation_type,
    current_basis: r.current_basis || '',
    favorability: r.target_type === 'person' ? fav : 0,
    favorability_change: r.target_type === 'person' ? chg : 0,
    recent_change: r.recent_change || '',
    changed_at: r.changed_at || '',
  };
};

/* ---------- 逐集合规范化 ---------- */

const tasks = arr(D.tasks).map((t) => ({
  name: t.name,
  category: TASK_CATEGORY[t.name] || 'other',
  status: t.status,
  source: t.source || '',
  updated_at: t.updated_at || '',
  next_update: t.next_update || '',
  deadline: t.deadline || '',
  objective: t.objective || '',
  completion_condition: t.completion_condition || '',
  failure_condition: t.failure_condition || '',
  outcome: t.outcome || '',
  participants: arr(t.participants).slice(0, 8).map((p) => ({ name: p.name, type: p.type, role: p.role || '' })),
  locations: arr(t.locations).slice(0, 5),
  blockers: arr(t.blockers).slice(0, 5),
  stages: arr(t.stages).slice(0, 8).map((s) => ({
    name: s.name,
    status: map(STAGE_STATUS, s.status),
    time: s.time || '',
    summary: s.summary || '',
    parent_stage: s.parent_stage || '',
  })),
}));

const events = arr(D.events).map((e) => ({
  name: e.name,
  category: e.category,
  status: e.status,
  started_at: e.started_at || '',
  updated_at: e.updated_at || '',
  expected_end: e.expected_end || '',
  next_update: e.next_update || '',
  locations: arr(e.locations).slice(0, 5),
  participants: arr(e.participants).slice(0, 8).map((p) => ({ name: p.name, type: map(PARTICIPANT_TYPE, p.type), role: p.role || '' })),
  trigger: e.trigger || '',
  current_state: e.current_state || '',
  visible_effects: arr(e.visible_effects).slice(0, 6),
  related_tasks: arr(e.related_tasks).slice(0, 6),
  outcome: e.outcome || '',
}));

const regions = arr(D.regions).map((r) => ({
  name: r.name,
  updated_at: r.updated_at || '',
  next_update: r.next_update || '',
  control: {
    status: map(CONTROL_STATUS, (r.control && r.control.status) || 'unclear'),
    primary_faction: (r.control && r.control.primary_faction) || '',
    contesting_factions: arr(r.control && r.control.contesting_factions).slice(0, 5),
  },
  present_factions: arr(r.present_factions).slice(0, 8),
  conditions: arr(r.conditions).slice(0, 6).map((c) => ({
    ...c,
    category: map(REGION_COND_CATEGORY2, map(REGION_COND_CATEGORY, c.category)),
  })),
  recent_changes: arr(r.recent_changes).slice(0, 6),
}));

const factions = arr(D.factions).map((f) => ({
  name: f.name,
  status: f.status,
  updated_at: f.updated_at || '',
  next_update: f.next_update || '',
  current_focus: f.current_focus || {},
  areas: arr(f.areas).map((a) => ({ ...a, relation_type: map(AREA_RELATION, a.relation_type) })),
  resources: arr(f.resources).map((x) => ({ ...x, type: map(RESOURCE_TYPE, x.type) })),
  internal_groups: arr(f.internal_groups),
  relations: arr(f.relations).slice(0, 8).map(factionRelation),
  knowledge: arr(f.knowledge).map((k) => ({ ...k, status: map(KNOWLEDGE_STATUS, k.status) })),
  visible_effects: arr(f.visible_effects),
}));

/* 键序照契约排。直接 {...n, profile} 会把新键甩到记录末尾，
   而这份 mock 的另一个用处是对着契约逐字段核对，键序错位读起来就像字段列表对不上。 */
const NPC_KEYS = ['name', 'presence', 'updated_at', 'next_update', 'profile', 'current_state',
  'schedule', 'conditions', 'commitments', 'decisions', 'relations', 'knowledge',
  'visible_effects', 'scene_entry'];

const npcs = arr(D.npcs).map((n) => {
  const v = {
    ...n,
    profile: { ...(NPC_PROFILE[n.name] || {}), ...(n.profile || {}) },
    relations: arr(n.relations).slice(0, 8).map(withFavor(n.name)),
    knowledge: arr(n.knowledge).map((k) => ({ ...k, status: map(KNOWLEDGE_STATUS, k.status) })),
  };
  const out = {};
  for (const k of NPC_KEYS) if (k in v) out[k] = v[k];
  return out;
});

const candidates = arr(D.candidates).map((c) => {
  // 候选人物契约里没有 knowledge 字段，旧 demo 多挂了个空数组
  const { knowledge, ...rest } = c;
  return {
    ...rest,
    profile: { ...(CANDIDATE_PROFILE[c.name] || {}), ...(c.profile || {}) },
    relations: arr(c.relations).slice(0, 8).map(withFavor(c.name)),
  };
});

/* ---------- 生成 changes（旧 demo 完全缺失）----------
   契约：每条必须能回指某条实体更新中的已发生事实；
   change_key 固定为 time|kind|source_type|source_name|target_name；
   同一事实只写一次，任务变化归 task、事件后果归 event、地区变化归 region。 */
const changes = [];
const push = (time, kind, source_type, source_name, target_name, summary) => {
  if (!time || !summary) return;
  changes.push({
    change_key: `${time}|${kind}|${source_type}|${source_name}|${target_name}`,
    time, kind, source_type, source_name, target_name, summary,
  });
};

tasks.forEach((t) => {
  t.stages.filter((s) => s.status === 'completed' && s.time).forEach((s) => {
    push(s.time, 'task', 'task', t.name, '', `完成阶段：${s.name}`);
  });
});
events.forEach((e) => {
  arr(e.visible_effects).forEach((v) => {
    push(v.time, 'event', 'event', e.name, v.location || '', v.effect);
  });
});
regions.forEach((r) => {
  arr(r.recent_changes).forEach((c) => {
    push(c.time, 'region', 'region', r.name, '', c.fact);
  });
});

// 同一 change_key 只保留一条，再按时间倒序
const seen = new Set();
const uniqueChanges = changes
  .filter((c) => (seen.has(c.change_key) ? false : seen.add(c.change_key)))
  .sort((a, b) => String(b.time).localeCompare(String(a.time)))
  .slice(0, 120);

const OUTPUT = {
  background_world: {
    world: arr(D.world).map((w) => ({ scope: w.scope || 'current', world_time: w.world_time })),
    changes: uniqueChanges,
    npcs,
    factions,
    candidates,
    tasks,
    events,
    regions,
  },
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(OUTPUT, null, 2), 'utf8');

// 页面以 file:// 打开时 fetch 本地 JSON 会被 CORS 拦掉，同步产出一份可直接 <script> 引入的副本。
// JSON 是唯一事实源，这个 .js 只是构建产物。
fs.writeFileSync(
  OUT.replace(/\.json$/, '.js'),
  '/* 由 _tools/build-mock.cjs 生成，勿手改。事实源：mock/world-state-v09.json */\n' +
    'window.WORLD_MOCK = ' + JSON.stringify(OUTPUT) + ';\n',
  'utf8'
);

const B = OUTPUT.background_world;
console.log('已写出', path.relative(ROOT, OUT), (fs.statSync(OUT).size / 1024).toFixed(0) + 'KB');
console.log('  world     ', B.world.length);
console.log('  changes   ', B.changes.length, '（旧 demo 完全缺失，本次由已完成阶段/事件后果/地区变化派生）');
console.log('  npcs      ', B.npcs.length);
console.log('  factions  ', B.factions.length);
console.log('  candidates', B.candidates.length);
console.log('  tasks     ', B.tasks.length);
console.log('  events    ', B.events.length);
console.log('  regions   ', B.regions.length);
console.log('\ntask.category 改写结果:');
tasks.forEach((t) => console.log(`  ${t.name.padEnd(12)} → ${t.category}`));

