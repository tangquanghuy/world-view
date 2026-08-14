/**
 * 交叉核对 shared/vocab.js 与正式契约：
 *  1) 契约里每个封闭枚举（desc 写「只使用 …」）的每个值，词典是否都有中文；
 *  2) mock 里实际出现的每个枚举值，词典是否都能翻译。
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');
const SPEC = path.join(ROOT, '后台世界引擎-三类演进版-v0.9.json');

const sandbox = { window: {}, console };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'shared', 'vocab.js'), 'utf8'), sandbox);
const DICT = sandbox.window.V.DICT;

const fields = JSON.parse(fs.readFileSync(SPEC, 'utf8')).units[0].impl.sub.format.fields;

// 收集契约里所有封闭枚举，记下它出现的字段路径
const closed = [];
(function walk(list, p) {
  for (const f of list) {
    const here = `${p}.${f.key}`;
    const m = (f.desc || '').match(/只使用\s*([^。；]+)/);
    if (m) closed.push({ path: here, values: m[1].split(/[、,，]/).map((s) => s.trim()).filter(Boolean) });
    const props = f.properties || (f.items && f.items.properties);
    if (props) walk(props, here + (f.type === 'array' ? '[]' : ''));
  }
})(fields, '');

// 词典里所有已知值的并集，用来判断某个契约枚举是否已被某一组覆盖
const covered = new Set();
for (const table of Object.values(DICT)) for (const k of Object.keys(table)) covered.add(k);

const missing = [];
for (const e of closed) {
  const lack = e.values.filter((v) => !covered.has(v));
  if (lack.length) missing.push(`${e.path}  缺少中文: ${lack.join('、')}`);
}

// mock 里实际出现的值
const mock = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'mock', 'world-state-v09.json'), 'utf8'));
const enumKeys = new Set(['category', 'status', 'type', 'presence', 'relation_type', 'target_type', 'source_type', 'kind']);
const used = new Map();
(function scan(n, p) {
  if (Array.isArray(n)) return n.forEach((v) => scan(v, p));
  if (n && typeof n === 'object') {
    for (const [k, v] of Object.entries(n)) {
      if (typeof v === 'string' && enumKeys.has(k) && v && !/[\u4e00-\u9fa5]/.test(v)) {
        if (!used.has(v)) used.set(v, `${p}.${k}`);
      }
      scan(v, `${p}.${k}`);
    }
  }
})(mock, '');

const untranslatable = [...used].filter(([v]) => !covered.has(v));

console.log(`契约封闭枚举 ${closed.length} 处，词典 ${Object.keys(DICT).length} 组 / ${covered.size} 个值`);
console.log(`mock 中出现的枚举值 ${used.size} 个`);

if (!missing.length && !untranslatable.length) {
  console.log('\n词典覆盖完整。');
} else {
  if (missing.length) {
    console.log(`\n── 契约有、词典没有（${missing.length}）`);
    missing.forEach((s) => console.log('   ' + s));
  }
  if (untranslatable.length) {
    console.log(`\n── mock 用到但词典翻不出来（${untranslatable.length}）`);
    untranslatable.forEach(([v, p]) => console.log(`   ${v}   出现在 ${p}`));
  }
  process.exitCode = 1;
}
