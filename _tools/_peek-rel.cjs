/** 列出 mock 里每个人物的关系条数与字段，用来判断自我网络能画成什么样。 */
const w = require('../mock/world-state-v09.json').background_world;
const people = [...(w.npcs || []), ...(w.candidates || [])];
for (const p of people) {
  const rs = p.relations || [];
  console.log(`\n${p.name}　${rs.length} 条`);
  for (const r of rs) {
    console.log('   ', JSON.stringify(r, null, 0));
  }
}
