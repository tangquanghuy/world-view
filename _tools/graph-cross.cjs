/* 数关系图里连线实际交叉了多少次。
   不按直线估，而是把每条 path 用 getPointAtLength 采样成折线，
   量的是屏幕上真正画出来的那条曲线——弧度调大调小会直接反映在数字上。
   共享端点的两条线（同一个节点引出的）不算交叉。

   用法：node _tools/graph-cross.cjs [页面.html ...]                        */
const {chromium}=require('playwright-core');
const path=require('path'),fs=require('fs');
const EDGE=[
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find(p=>fs.existsSync(p));

const PAGES=process.argv.slice(2).length?process.argv.slice(2)
  :['总览.html','角色档案.html','势力与地区.html','任务与事件.html'];

/* 全量图藏在浮层里，默认关着量不到——那恰恰是节点最多、最会乱的一张。
   进页面先把这些入口点开。 */
const OPEN={'总览.html':['#openFull'],'势力与地区.html':['#graphToggle']};

const PROBE=()=>{
  const SAMPLES=40, TOL=9;                       // 端点容差：9px 内算同一个接点
  const out=[];
  for(const svg of document.querySelectorAll('svg')){
    // 有的图用 <path> 画弧，有的直接 <line>，两种都要收；箭头是 fill 的 path，会被 stroke:none 滤掉
    const paths=[...svg.querySelectorAll('path,line,polyline')].filter(p=>{
      const s=getComputedStyle(p);
      if(s.stroke==='none'||s.visibility==='hidden'||s.display==='none')return false;
      if(parseFloat(s.strokeOpacity||'1')<.02||parseFloat(s.opacity||'1')<.02)return false;
      try{return p.getTotalLength()>12}catch(e){return false}
    });
    if(paths.length<2)continue;

    const host=svg.closest('.panel,.sheet-box,body');
    const h2=host&&host.querySelector('h2');
    const box=svg.getBoundingClientRect();

    const polys=paths.map(p=>{
      const L=p.getTotalLength(),pts=[];
      for(let i=0;i<=SAMPLES;i++){
        const q=p.getPointAtLength(L*i/SAMPLES);
        pts.push([q.x,q.y]);
      }
      return {pts,w:parseFloat(getComputedStyle(p).strokeWidth)||1};
    });

    const near=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1])<=TOL;
    const shares=(A,B)=>{
      const ea=[A.pts[0],A.pts[A.pts.length-1]],eb=[B.pts[0],B.pts[B.pts.length-1]];
      return ea.some(x=>eb.some(y=>near(x,y)));
    };
    const hit=(p1,p2,p3,p4)=>{
      const d=(p4[1]-p3[1])*(p2[0]-p1[0])-(p4[0]-p3[0])*(p2[1]-p1[1]);
      if(Math.abs(d)<1e-9)return null;
      const ua=((p4[0]-p3[0])*(p1[1]-p3[1])-(p4[1]-p3[1])*(p1[0]-p3[0]))/d;
      const ub=((p2[0]-p1[0])*(p1[1]-p3[1])-(p2[1]-p1[1])*(p1[0]-p3[0]))/d;
      if(ua<0||ua>1||ub<0||ub>1)return null;
      return [p1[0]+ua*(p2[0]-p1[0]),p1[1]+ua*(p2[1]-p1[1])];
    };

    let cross=0;const spots=[];
    for(let i=0;i<polys.length;i++)for(let j=i+1;j<polys.length;j++){
      if(shares(polys[i],polys[j]))continue;
      const seen=[];
      for(let a=0;a<polys[i].pts.length-1;a++)for(let b=0;b<polys[j].pts.length-1;b++){
        const q=hit(polys[i].pts[a],polys[i].pts[a+1],polys[j].pts[b],polys[j].pts[b+1]);
        // 同一对线擦着走会连采样命中好几次，靠近的只记一次
        if(q&&!seen.some(s=>Math.hypot(s[0]-q[0],s[1]-q[1])<TOL)){seen.push(q);}
      }
      cross+=seen.length;spots.push(...seen);
    }

    /* 主次分得开不开：看线宽和不透明度铺开了几档。
       全是一个粗细一个透明度，就是没有主次。 */
    const wq=[...new Set(polys.map(p=>p.w.toFixed(1)))].sort();
    const oq=[...new Set(paths.map(p=>{
      const s=getComputedStyle(p);
      return (parseFloat(s.strokeOpacity||'1')*parseFloat(s.opacity||'1')).toFixed(2);
    }))].sort();

    out.push({title:h2?h2.textContent.trim():'(无标题)',
      w:Math.round(box.width),h:Math.round(box.height),
      edges:paths.length,cross,widths:wq,opac:oq,
      dense:+(cross/Math.max(1,paths.length)).toFixed(2)});
  }
  return out;
};

(async()=>{
  const b=await chromium.launch({executablePath:EDGE,
    args:['--allow-file-access-from-files','--disable-web-security']});
  for(const f of PAGES){
    const p=await b.newPage({viewport:{width:1536,height:1000}});
    await p.goto('file:///'+path.resolve(f).replace(/\\/g,'/'));
    await p.waitForTimeout(1100);
    for(const sel of OPEN[f]||[]){
      const el=await p.$(sel);
      if(el){await el.click();await p.waitForTimeout(600)}
    }
    const r=await p.evaluate(PROBE);
    console.log('\n=== '+f);
    if(!r.length){console.log('  没有画线的图');await p.close();continue}
    for(const g of r){
      console.log('  '+g.title+'　'+g.w+'×'+g.h);
      console.log('    连线 '+g.edges+' 条　交叉 '+g.cross+' 处　每条线摊 '+g.dense+' 处');
      console.log('    线宽 '+g.widths.join(' / ')+'　不透明度 '+g.opac.join(' / '));
    }
    await p.close();
  }
  await b.close();
})();
