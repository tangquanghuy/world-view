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

const GROUPS = {
  change_updates: [
    'time', 'kind', 'source_type', 'source_name', 'target_name', 'summary',
  ],
  npc_updates: [
    'name', 'presence', 'updated_at', 'next_update',
    'current_state.location', 'current_state.action', 'current_state.status',
    'current_state.started_at', 'current_state.expected_end', 'current_state.observable_state',
    'current_state.related_task', 'current_state.related_event',
    'schedule[].start_time', 'schedule[].end_time', 'schedule[].location', 'schedule[].action',
    'schedule[].status', 'schedule[].related_task', 'schedule[].related_event', 'schedule[].result',
    'conditions[].category', 'conditions[].fact', 'conditions[].impact', 'conditions[].review_condition',
    'commitments[].target', 'commitments[].content', 'commitments[].deadline', 'commitments[].release_condition',
    'decisions[].question', 'decisions[].options[].choice', 'decisions[].options[].cost', 'decisions[].waiting_for',
    'relations[].target_type', 'relations[].target_name', 'relations[].relation_type', 'relations[].current_basis',
    'relations[].favorability', 'relations[].favorability_change', 'relations[].recent_change', 'relations[].changed_at',
    'knowledge[].fact', 'knowledge[].source', 'knowledge[].source_type', 'knowledge[].learned_at', 'knowledge[].status',
    'visible_effects[].time', 'visible_effects[].location', 'visible_effects[].effect', 'visible_effects[].related_event',
    'scene_entry.reason', 'scene_entry.earliest_time', 'scene_entry.location', 'scene_entry.condition',
  ],
  candidate_updates: [
    'name', 'status', 'updated_at', 'next_update',
    'profile.occupation', 'profile.social_role', 'profile.age', 'profile.gender', 'profile.appearance',
    'profile.personality_tags', 'profile.livelihood', 'profile.main_location', 'profile.capability_basis',
    'observations[].time', 'observations[].situation', 'observations[].action', 'observations[].result',
    'retention.status_basis', 'retention.missing_evidence', 'retention.next_observation',
  ],
  faction_updates: [
    'name', 'status', 'updated_at', 'next_update',
    'current_focus.issue', 'current_focus.action', 'current_focus.deferred_items',
    'areas[].name', 'areas[].relation_type', 'areas[].current_state', 'areas[].recent_change',
    'resources[].type', 'resources[].quantity', 'resources[].current_use', 'resources[].constraint', 'resources[].recent_change',
    'internal_groups[].name', 'internal_groups[].position', 'internal_groups[].current_action', 'internal_groups[].effect',
    'relations[].target_type', 'relations[].target_name', 'relations[].relation_type', 'relations[].current_basis', 'relations[].recent_change', 'relations[].changed_at',
    'knowledge[].fact', 'knowledge[].source', 'knowledge[].source_type', 'knowledge[].learned_at', 'knowledge[].status',
    'visible_effects[].time', 'visible_effects[].location', 'visible_effects[].effect', 'visible_effects[].related_event',
  ],
  region_updates: [
    'name', 'updated_at', 'next_update',
    'control.status', 'control.primary_faction', 'control.contesting_factions',
    'present_factions',
    'conditions[].category', 'conditions[].fact', 'conditions[].impact',
    'recent_changes[].time', 'recent_changes[].fact', 'recent_changes[].related_task', 'recent_changes[].related_event',
  ],
  task_updates: [
    'name', 'category', 'status', 'source', 'updated_at', 'next_update', 'deadline',
    'objective', 'completion_condition', 'failure_condition', 'outcome',
    'participants[].name', 'participants[].type', 'participants[].role',
    'locations', 'blockers',
    'stages[].name', 'stages[].status', 'stages[].time', 'stages[].summary', 'stages[].parent_stage',
  ],
  event_updates: [
    'name', 'category', 'status', 'started_at', 'updated_at', 'expected_end', 'next_update',
    'locations',
    'participants[].name', 'participants[].type', 'participants[].role',
    'trigger', 'current_state',
    'visible_effects[].time', 'visible_effects[].location', 'visible_effects[].effect',
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
