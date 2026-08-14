/**
 * 把页内私有的 <symbol id="x-…"> 收进 shared/icons.js 之后，
 * 用这个脚本把页面里的 #x-… 引用改成 #i-…，并删掉页内那段 sprite。
 *   node _tools/_dedupe-sprite.cjs 角色档案.html 势力与地区.html
 */
const fs = require('fs');
const path = require('path');
const BASE = path.join(__dirname, '..');

for (const file of process.argv.slice(2)) {
  const p = path.join(BASE, file);
  let s = fs.readFileSync(p, 'utf8');
  const ids = [...s.matchAll(/<symbol id="(x-[a-z]+)"/g)].map((m) => m[1]);
  if (!ids.length) { console.log(file, '没有页内 symbol'); continue; }

  // 删掉整段 sprite：从包着它的 <svg …> 一直到对应的 </svg>，连同前面那条说明注释
  let from = s.lastIndexOf('<svg', s.indexOf('<symbol id="x-'));
  const to = s.indexOf('</svg>', from);
  if (from < 0 || to < 0) { console.log(file, '找不到包住 symbol 的 svg，跳过'); continue; }
  const cmt = s.lastIndexOf('<!--', from);
  if (cmt >= 0 && s.indexOf('-->', cmt) < from) from = cmt;
  s = s.slice(0, from) + s.slice(to + 6).replace(/^\s*\n/, '');

  for (const id of ids) s = s.split('#' + id).join('#i-' + id.slice(2));
  fs.writeFileSync(p, s);
  console.log(file, '并入', ids.length, '个图标：', ids.map((i) => 'i-' + i.slice(2)).join(' '));
}
