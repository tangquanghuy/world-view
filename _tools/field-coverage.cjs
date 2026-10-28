/**
 * 字段落点自查：契约里每个字段，负责它的那一页源码里到底有没有读到。
 * 防止"看着挺满，其实漏了一列"。
 *
 * 契约有七组产出，每组都有且只有一页负责把它排全（别处出现的是摘要，不算数）。
 * 这份对应关系写在 OWNER 里，改版式可以，改归属要想清楚谁来兜底。
 *
 *   node _tools/field-coverage.cjs                # 四页全查
 *   node _tools/field-coverage.cjs 角色档案.html   # 只查这一页负责的组
 */
const fs = require('fs');
const path = require('path');
const BASE = path.join(__dirname, '..');

/* v1.0 字段（异步助手方案「后台世界演进 v1.0」）。v0.9 存档由 index.html 先转成这个形状。
   各实体的「痕迹 / 近期变化」统一在 change_updates，地区的在场势力由势力 areas 推出，所以不再单列。 */
const GROUPS = {
  change_updates: [
    'time', 'kind', 'source_type', 'source_name', 'target_name', 'summary', 'location',
  ],
  npc_updates: [
    'name', 'presence',
    'current_state.location', 'current_state.action', 'current_state.status',
    'current_state.expected_end', 'current_state.observable_state',
    'current_state.related_task', 'current_state.related_event',
    'schedule[].start_time', 'schedule[].end_time', 'schedule[].location', 'schedule[].action',
    'schedule[].status', 'schedule[].result',
    'conditions[].category', 'conditions[].fact', 'conditions[].impact',
    'commitments[].target', 'commitments[].content', 'commitments[].deadline',
    'decisions[].question', 'decisions[].options',
    'relations[].target_type', 'relations[].target_name', 'relations[].relation_type', 'relations[].current_basis',
    'relations[].favorability', 'relations[].recent_change',
    'knowledge[].fact', 'knowledge[].source', 'knowledge[].status',
  ],
  candidate_updates: [
    'name', 'status',
    'profile.occupation', 'profile.age', 'profile.gender', 'profile.appearance',
    'profile.personality_tags', 'profile.livelihood', 'profile.main_location', 'profile.capability_basis',
    'observations[].time', 'observations[].content',
  ],
  faction_updates: [
    'name', 'status',
    'current_focus.issue', 'current_focus.action', 'current_focus.deferred_items',
    'areas[].name', 'areas[].relation_type', 'areas[].current_state',
    'resources[].type', 'resources[].quantity', 'resources[].current_use',
    'internal_groups[].name', 'internal_groups[].position', 'internal_groups[].current_action',
    'relations[].target_type', 'relations[].target_name', 'relations[].relation_type', 'relations[].current_basis', 'relations[].recent_change',
    'knowledge[].fact', 'knowledge[].source', 'knowledge[].status',
  ],
  region_updates: [
    'name',
    'control.status', 'control.primary_faction',
    'conditions[].category', 'conditions[].fact', 'conditions[].impact',
  ],
  task_updates: [
    'name', 'category', 'status', 'deadline',
    'objective', 'completion_condition', 'outcome',
    'participants[].name', 'participants[].role',
    'locations', 'blockers',
    'stages[].name', 'stages[].status', 'stages[].time', 'stages[].summary',
  ],
  event_updates: [
    'name', 'category', 'status', 'started_at', 'expected_end',
    'locations',
    'participants[].name', 'participants[].role',
    'trigger', 'current_state',
    'related_tasks', 'outcome',
  ],
};

/* 契约里有、但本来就不该出现在玩家眼前的字段。写在这儿是为了让它跟"漏了"区分开：
   漏了要修，豁免了要有理由。 */
const EXEMPT = {
  'change_updates.change_key': '技术去重键（time|kind|source_type|source_name|target_name），后台自己用',
};

const OWNER = {
  '总览.html': ['change_updates'],
  '角色档案.html': ['npc_updates', 'candidate_updates'],
  '势力与地区.html': ['faction_updates', 'region_updates'],
  '任务与事件.html': ['task_updates', 'event_updates'],
};

const only = process.argv[2];
const pages = only ? [only] : Object.keys(OWNER);
let miss = 0;

for (const page of pages) {
  const groups = OWNER[page];
  if (!groups) {
    console.log(`× ${page} 不在 OWNER 里，不知道该拿哪几组契约字段查它`);
    process.exit(2);
  }
  const src = fs.readFileSync(path.join(BASE, page), 'utf8');
  console.log('\n=== ' + page);
  for (const g of groups) {
    const gone = [];
    for (const f of GROUPS[g]) {
      const leaf = f.split('.').pop().replace('[]', '');
      // 属性访问、解构、字符串键三种写法都算读到了
      const hit = new RegExp('[.\\[\'"`]' + leaf + '\\b').test(src)
        || new RegExp('\\b' + leaf + '\\s*[:,}]').test(src);
      if (!hit) gone.push(f);
    }
    miss += gone.length;
    console.log(`  ${gone.length ? '×' : '√'} ${g}　${GROUPS[g].length} 项，缺 ${gone.length}`);
    gone.forEach((f) => console.log(`      缺  ${f}`));
  }
}

const ex = Object.entries(EXEMPT);
if (ex.length && !only) {
  console.log('\n豁免（契约里有，但不该给玩家看）：');
  ex.forEach(([k, why]) => console.log(`  ${k}　${why}`));
}
console.log(miss ? `\n有 ${miss} 个字段在页面源码里找不到读取处。` : '\n全部字段都有读取处。');
process.exit(miss ? 1 : 0);
