/**
 * 打印字段契约速查表，方便改页面时对照。
 * 内容现读 配置方案/后台世界引擎-三类演进版-v0.9.json → units[0].impl.sub.format.fields，
 * 不留副本，避免速查表和契约各说各话。
 *
 *   node _tools/dump-contract.cjs           全部
 *   node _tools/dump-contract.cjs task      只看任务
 *   node _tools/dump-contract.cjs --enums   只列封闭枚举
 */
const fs = require('fs');
const path = require('path');

const SPEC = path.join(__dirname, '..', '..', '后台世界引擎-三类演进版-v0.9.json');
const fields = JSON.parse(fs.readFileSync(SPEC, 'utf8')).units[0].impl.sub.format.fields;
const argv = process.argv.slice(2);
const onlyEnums = argv.includes('--enums');
const filter = argv.find((a) => !a.startsWith('--'));

if (onlyEnums) {
  console.log('契约里的封闭枚举（desc 写明「只使用」的字段）:\n');
  (function walk(list, p) {
    for (const f of list) {
      const here = `${p}.${f.key}${f.type === 'array' ? '[]' : ''}`;
      const m = (f.desc || '').match(/只使用\s*([^。；]+)/);
      if (m) console.log(`${here.replace(/^\./, '').padEnd(48)} ${m[1].trim()}`);
      const props = f.properties || (f.items && f.items.properties);
      if (props) walk(props, here);
    }
  })(fields, '');
  return;
}

(function walk(list, indent, p) {
  for (const f of list) {
    const here = `${p}.${f.key}`;
    if (filter && indent === 0 && !here.includes(filter)) continue;
    const t = f.type === 'array' ? `array<${f.items ? f.items.type : '?'}>` : f.type;
    console.log('  '.repeat(indent) + f.key.padEnd(24 - indent * 2) + String(t).padEnd(15) + (f.desc || ''));
    const props = f.properties || (f.items && f.items.properties);
    if (props) walk(props, indent + 1, here);
  }
})(fields, 0, '');
