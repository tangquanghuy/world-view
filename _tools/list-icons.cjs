// 列出共享精灵里全部可用的 symbol id。写页面时挑图标用，省得每次打开 icons.js 翻。
// icons.js 是 { id: '<path .../>' } 的字典再拼成 <symbol>，所以要按键名抓而不是按标签抓。
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'shared', 'icons.js'), 'utf8');
const ids = [...src.matchAll(/'(i-[a-z0-9-]+)'\s*:/g)].map(m => m[1]);
console.log('共 ' + ids.length + ' 个图标：');
for (let i = 0; i < ids.length; i += 6) console.log('  ' + ids.slice(i, i + 6).join('  '));
