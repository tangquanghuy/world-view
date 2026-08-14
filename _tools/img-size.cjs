/** 报告 PNG 的像素尺寸。裁图前先量，省得坐标全错。 */
const fs = require('fs');
const path = require('path');
for (const f of process.argv.slice(2)) {
  const p = path.resolve(path.join(__dirname, '..'), f);
  const b = fs.readFileSync(p);
  // PNG: 8 字节签名 + 4 长度 + 4 "IHDR" + 宽高各 4 字节大端
  console.log(`${f}　${b.readUInt32BE(16)} × ${b.readUInt32BE(20)}`);
}
