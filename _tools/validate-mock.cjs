/**
 * 用正式产出里的字段契约校验 mock。
 * 契约不是手抄的，每次运行都从
 * 配置方案/后台世界引擎-三类演进版-v0.9.json → units[0].impl.sub.format.fields 现读。
 *
 * 检查项：未知字段、缺失字段、枚举越界（解析 desc 里的「只使用 a、b、c」）、
 *        数组超上限（解析 desc 里的「最多 N 项」）。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const SPEC = path.join(ROOT, '后台世界引擎-三类演进版-v0.9.json');
const MOCK = path.join(__dirname, '..', 'mock', 'world-state-v09.json');

const fields = JSON.parse(fs.readFileSync(SPEC, 'utf8')).units[0].impl.sub.format.fields;
const mock = JSON.parse(fs.readFileSync(MOCK, 'utf8')).background_world;

// 视图分区名 → 写入契约字段名
const SECTION_TO_FIELD = {
  world: 'world_state',
  changes: 'change_updates',
  npcs: 'npc_updates',
  factions: 'faction_updates',
  candidates: 'candidate_updates',
  tasks: 'task_updates',
  events: 'event_updates',
  regions: 'region_updates',
};

const enumOf = (desc = '') => {
  // 「只使用 a、b、c。」以及「如 a、b、c」这类开放式建议要区分开：只有「只使用」是硬约束
  const m = desc.match(/只使用\s*([^。；]+)/);
  if (!m) return null;
  return m[1].split(/[、,，]/).map((s) => s.trim()).filter(Boolean);
};
const maxOf = (desc = '') => {
  const m = desc.match(/最多\s*(\d+)\s*项/);
  return m ? Number(m[1]) : null;
};

const problems = [];
const report = (p, msg) => problems.push(`${p}  ${msg}`);

function checkValue(val, spec, p) {
  if (val === undefined || val === null) return;

  if (spec.type === 'array') {
    if (!Array.isArray(val)) return report(p, `应为数组，实际 ${typeof val}`);
    const max = maxOf(spec.desc);
    if (max !== null && val.length > max) report(p, `数组 ${val.length} 项，超出契约上限 ${max}`);
    const item = spec.items;
    if (item) val.forEach((v, i) => checkValue(v, item, `${p}[${i}]`));
    return;
  }

  if (spec.type === 'object' || spec.properties) {
    if (typeof val !== 'object' || Array.isArray(val)) return report(p, `应为对象`);
    const props = spec.properties || [];
    if (!props.length) return;
    const known = new Set(props.map((f) => f.key));
    for (const k of Object.keys(val)) if (!known.has(k)) report(`${p}.${k}`, `契约中不存在此字段`);
    for (const f of props) {
      if (!(f.key in val)) { report(`${p}.${f.key}`, `缺失（契约要求存在，空值用 "" 或 []）`); continue; }
      checkValue(val[f.key], f, `${p}.${f.key}`);
    }
    return;
  }

  if (spec.type === 'string') {
    if (typeof val !== 'string') return report(p, `应为字符串，实际 ${typeof val}`);
    const en = enumOf(spec.desc);
    if (en && val !== '' && !en.includes(val)) report(p, `值 "${val}" 不在枚举 [${en.join(', ')}] 内`);
  }
}

for (const [section, rows] of Object.entries(mock)) {
  const fieldKey = SECTION_TO_FIELD[section];
  const spec = fields.find((f) => f.key === fieldKey);
  if (!spec) { report(section, `无法对应到契约字段`); continue; }
  // world_state 契约里是对象，视图按行返回，逐行按对象校验
  const itemSpec = spec.type === 'array' ? spec.items : spec;
  rows.forEach((row, i) => checkValue(row, itemSpec, `${section}[${i}]`));
}

const counts = Object.fromEntries(Object.entries(mock).map(([k, v]) => [k, v.length]));
console.log('集合规模:', JSON.stringify(counts));
if (!problems.length) {
  console.log('\n契约校验通过，无违规。');
} else {
  const byKind = {};
  problems.forEach((s) => {
    const kind = /不在枚举/.test(s) ? '枚举越界' : /不存在此字段/.test(s) ? '契约外字段' : /缺失/.test(s) ? '字段缺失' : /超出契约上限/.test(s) ? '超上限' : '类型不符';
    (byKind[kind] ||= []).push(s);
  });
  console.log(`\n共 ${problems.length} 处问题:`);
  for (const [kind, list] of Object.entries(byKind)) {
    console.log(`\n── ${kind}（${list.length}）`);
    list.slice(0, 40).forEach((s) => console.log('   ' + s));
    if (list.length > 40) console.log(`   …另有 ${list.length - 40} 处`);
  }
  process.exitCode = 1;
}
