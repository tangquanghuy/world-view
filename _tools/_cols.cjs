/* 临时：量三栏高度，看删掉「角色卡」空态卡之后右栏空了多少 */
const { chromium } = require('playwright-core');
const { pathToFileURL } = require('url');
const fs = require('fs');
const path = require('path');

const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const BASE = path.join(__dirname, '..');

(async () => {
  const b = await chromium.launch({ headless: true, executablePath: EDGE, args: ['--allow-file-access-from-files'] });
  const pg = await b.newPage({ viewport: { width: 1536, height: 960 } });
  await pg.goto(pathToFileURL(path.join(BASE, '角色档案.html')).href, { waitUntil: 'load' });
  await pg.waitForTimeout(700);
  for (const n of ['艾琳', '赛文', '米娅', '凯尔', '诺亚', '莉莉安', '露西']) {
    await pg.click(`.rcard[data-n="${n}"]`);
    await pg.waitForTimeout(250);
    const r = await pg.evaluate(() => {
      const h = (s) => { const e = document.querySelector(s); return e ? Math.round(e.getBoundingClientRect().height) : 0; };
      return {
        roster: h('.main.archive>*:nth-child(2)'),
        center: h('.main.archive>*:nth-child(3)'),
        rail: h('#rail'),
        cards: document.querySelectorAll('#rail .subcard').length,
      };
    });
    console.log(n.padEnd(4), '名册', String(r.roster).padStart(5), ' 中栏', String(r.center).padStart(5), ' 右栏', String(r.rail).padStart(5), ' 卡', r.cards);
  }
  await b.close();
})();
