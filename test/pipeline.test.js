// mock fetch：按 deepseek 请求体里的 userPrompt 内容分stage返回罐头 JSON
const assert=require('assert'),fs=require('fs');
const {boot}=require('./boot.js');
const {validateTrip}=require(__dirname+'/../tools/validate-trip.js');
const FIXT=JSON.parse(fs.readFileSync(__dirname+'/fixtures/pipe-responses.json','utf8'));
function mockFetch(){
  const calls=[],keys=[];
  return {calls,keys,fetch:function(url,opts){
    calls.push(url);
    if(url.indexOf('nominatim')>=0){
      // Task 3 坐标路:按 q 参数回罐头坐标;查不到的点回空数组(未命中)
      const m=url.match(/[?&]q=([^&]*)/);
      const q=m?decodeURIComponent(m[1].replace(/\+/g,' ')):'';
      const hit=(FIXT.nominatim&&Object.prototype.hasOwnProperty.call(FIXT.nominatim,q))?FIXT.nominatim[q]:[];
      return Promise.resolve({ok:true,json:()=>Promise.resolve(hit)});
    }
    if(url.indexOf('deepseek')>=0){
      const body=JSON.parse(opts.body);const up=body.messages[1].content;
      let key=null;
      if(/复核/.test(up))key='verify1';
      else if(/骨架|动线草案/.test(up))key='skeleton';
      else if(/修改意见/.test(up))key='skeletonV2';
      // Task 2 批次(顺序即优先级,各批 prompt 只含自己的关键词)
      else if(/补充点/.test(up))key='radar1';
      else if(/讲解/.test(up))key='detail1';
      else if(/点位/.test(up))key='pois1';
      else if(/预约/.test(up))key='bookings1';
      else if(/天气城市/.test(up))key='wx1';
      else if(/路段/.test(up))key='leginfo1';
      keys.push(key);
      if(key&&FIXT[key])return Promise.resolve({ok:true,json:()=>Promise.resolve({choices:[{message:{content:JSON.stringify(FIXT[key])}}]})});
      return Promise.resolve({ok:true,json:()=>Promise.resolve({choices:[{message:{content:'{}'}}]})});
    }
    return Promise.reject(new Error('offline:'+url));
  }};
}

// === T2 共享:需求与 draft 构造(必须在顶层 return 之前初始化) ===
const T2_REQ={title:'南京三日',from:'南京',to:['镇江','扬州'],days:3,startDate:'2026-10-01',kidAge:11,theme:'历史',modes:['drive'],rhythm:'适中',mustAvoid:'',needFlex:false};
function t2Draft(baked,step){
  return {step:step,req:T2_REQ,skeleton:FIXT.skeleton,
    baked:Object.assign({pois:null,poiDetail:null,radarExtra:null,bookings:null,flex:null,wxCities:null,wxRules:null,legInfo:null},baked||{}),
    verify:null,log:[]};
}

// === T1 向导 + 骨架生成与对稿 ===
const mf=mockFetch();
const {ctx,document}=boot(__dirname+'/../行程助手.html',{});
ctx.fetch=mf.fetch;
// 从 picker 进规划器
ctx.openPlanner();
assert.ok(document.body.innerHTML.includes('新建行程')||document.body.innerHTML.includes('需求'),'规划器向导应渲染');
// 填需求（直接调函数,等价于表单填完）
ctx.wizSubmit({title:'南京三日',from:'南京',to:['镇江','扬州'],days:3,startDate:'2026-10-01',kidAge:11,theme:'历史',modes:['drive'],rhythm:'适中',mustAvoid:'',needFlex:false});
assert.ok(ctx.PLANNER.req.title==='南京三日','需求已存');
// S1 生成骨架（异步）
return ctx.genSkeleton().then(function(){
  assert.ok(ctx.PLANNER.skeleton&&ctx.PLANNER.skeleton.days.length===3,'骨架 3 天');
  assert.ok(document.body.innerHTML.includes('南京')||document.body.innerHTML.includes('D1'),'骨架对稿 UI 渲染');
  // 自然语言修改 → 重新生成
  return ctx.skelRevise('第二天太赶了').then(function(){
    assert.ok(mf.calls.length>=2,'调用了两次 deepseek');
    assert.ok(ctx.PLANNER.skeleton.days.length===3,'V2 骨架仍是 3 天');
    // 草稿已落盘
    assert.ok(JSON.parse(ctx.localStorage.getItem('ta-planner')).skeleton,'draft 已持久化');
    console.log('pipeline.test.js: T1 段通过');
    return t2FullBake();
  });
}).then(function(){
  return t3Verify();
}).then(function(){
  console.log('pipeline.test.js: 全部通过 (T1+T2+T3)');
}).catch(function(e){console.error(e);process.exit(1);});

// === T2 分批烘焙 + 断点续跑(共享需求/draft 构造见文件上方,T2_REQ 在顶层 return 前初始化) ===
// 全量烘焙:预置已有骨架的 draft → startBake → 全部批次完成
function t2FullBake(){
  const mf2=mockFetch();
  const r2=boot(__dirname+'/../行程助手.html',{'ta-planner':JSON.stringify(t2Draft(null,1))});
  r2.ctx.alert=function(){};          // startVerify 占位用 alert,boot 桩里没有,测试打桩
  r2.ctx.fetch=mf2.fetch;
  r2.ctx.loadPlanner();
  return r2.ctx.startBake().then(function(){
    const P=r2.ctx.PLANNER;
    assert.ok(P.baked.pois&&P.baked.pois.length===2,'pois 非空(2 点)');
    assert.ok(P.baked.radarExtra&&P.baked.radarExtra.length===1,'radarExtra 非空(1 点)');
    // poiDetail 覆盖 pois+radarExtra 全部点名
    const names=P.baked.pois.map(function(p){return p.name;}).concat(P.baked.radarExtra.map(function(x){return x.n;}));
    names.forEach(function(n){
      const d=P.baked.poiDetail[n];
      assert.ok(d&&d.story&&Array.isArray(d.see)&&d.see.length===3&&d.fact&&d.think,'poiDetail 应完整覆盖 '+n);
    });
    assert.ok(P.baked.bookings.length===1&&/^\d{4}-\d{2}-\d{2}$/.test(P.baked.bookings[0].due),'bookings due 为 ISO 日期');
    assert.ok(P.baked.wxCities.length===3,'wxCities 覆盖 3 城');
    assert.ok(P.baked.legInfo&&P.baked.legInfo['nj>zj']&&P.baked.legInfo['zj>nj'],'legInfo 覆盖全部路段');
    assert.strictEqual(P.step,3,'烘焙完成应进 step 3');
    // draft 落盘含 baked
    const saved=JSON.parse(r2.localStorage.getItem('ta-planner'));
    assert.ok(saved.baked&&saved.baked.pois&&saved.baked.poiDetail&&saved.baked.legInfo,'draft 落盘含 baked');
    // startVerify 已接入(T3):烘焙结束会同步发起 LLM 复核请求,统计烘焙批次的调用要把 verify1 滤掉
    assert.deepStrictEqual(mf2.keys.filter(function(k){return k!=='verify1';}),['pois1','radar1','detail1','bookings1','wx1','leginfo1'],'全量烘焙 6 批各调一次');
    assert.ok(r2.document.body.innerHTML.includes('自动验证'),'烘焙完自动进入验证页');
    console.log('pipeline.test.js: T2 全量烘焙段通过 (调用序列:'+mf2.keys.join(',')+')');
    return t2Resume();
  });
}
// 断点续跑:半成品 draft(baked 只有 pois)→ openPlanner(step===2 自动 resume)→ 只补缺失批次
function t2Resume(){
  const mf3=mockFetch();
  const half=t2Draft({pois:FIXT.pois1},2);half.log=['之前:沿途点位 完成'];
  const r3=boot(__dirname+'/../行程助手.html',{'ta-planner':JSON.stringify(half)});
  r3.ctx.alert=function(){};
  r3.ctx.fetch=mf3.fetch;
  const p=r3.ctx.openPlanner();       // step===2 → openPlanner 自动 resumeBake 并返回 Promise
  assert.ok(p&&typeof p.then==='function','step===2 打开规划器应返回续跑 Promise');
  return p.then(function(){
    const P3=r3.ctx.PLANNER;
    assert.strictEqual(P3.step,3,'续跑完成进 step 3');
    assert.deepStrictEqual(P3.baked.pois,FIXT.pois1,'已有 pois 原样保留未被覆盖');
    assert.ok(P3.baked.radarExtra&&P3.baked.poiDetail&&P3.baked.bookings&&P3.baked.wxCities&&P3.baked.legInfo,'缺失批次已补齐');
    assert.deepStrictEqual(mf3.keys.filter(function(k){return k!=='verify1';}),['radar1','detail1','bookings1','wx1','leginfo1'],'续跑只为缺失批次发请求,实际:'+mf3.keys.join(','));
    assert.ok(mf3.keys.indexOf('pois1')<0,'已有 pois 不重复请求');
    console.log('pipeline.test.js: T2 断点续跑段通过 (续跑调用:'+mf3.keys.join(',')+',共 '+mf3.calls.length+' 次)');
  });
}

// === T3 自动验证(S3)+ 组装入库(S4) ===
// 预置烘焙完成的 step3 draft → startVerify → 三档分类 → 丢弃坏点 → 组装过 Node 校验 → 入库
// 坏点:radar1 的「西津渡古街」(Nominatim 回空数组 + LLM 复核 ok:false);「金山寺(镇江)」Nominatim 回偏远坐标 → 纠偏
function t3Verify(){
  const mf4=mockFetch();
  const baked={pois:FIXT.pois1,radarExtra:FIXT.radar1,poiDetail:FIXT.detail1,bookings:FIXT.bookings1,
    wxCities:FIXT.wx1.wxCities,wxRules:FIXT.wx1.wxRules,legInfo:FIXT.leginfo1};
  const r4=boot(__dirname+'/../行程助手.html',{'ta-planner':JSON.stringify(t2Draft(baked,3))});
  r4.ctx.fetch=mf4.fetch;
  r4.ctx.NOMI_DELAY=0;            // 跳过 Nominatim 1.1s 礼仪间隔(boot 的 setTimeout 本来就立即执行,双保险)
  r4.ctx.loadPlanner();
  return r4.ctx.startVerify().then(function(){
    const v=r4.ctx.PLANNER.verify;
    // 三档分类:南京博物院坐标对得上→pass;金山寺偏远→corrected;西津渡未命中+复核不ok→pending
    // 注:ctx 内的数组/对象字面量是 vm realm 原型,deepStrictEqual 会比不过,统一 JSON 序列化比较
    assert.strictEqual(JSON.stringify(v.pass),JSON.stringify(['南京博物院']),'pass 只含坐标对得上的点,实际:'+JSON.stringify(v.pass));
    assert.strictEqual(v.corrected.length,1,'corrected 恰好一个点');
    assert.strictEqual(v.corrected[0].name,'金山寺(镇江)','纠偏的是金山寺');
    assert.strictEqual(JSON.stringify(v.poiFixes['金山寺(镇江)']),JSON.stringify({lat:32.4512,lng:119.6087}),'纠偏坐标记入 verify.poiFixes');
    assert.strictEqual(v.pending.length,1,'pending 恰好一个点');
    assert.strictEqual(v.pending[0].name,'西津渡古街','待确认的是坏点西津渡');
    assert.ok(v.pending[0].reason,'pending 带复核原因');
    // 报告页:三档分组渲染;pending 没清空,「完成」按钮不亮
    let html=r4.document.body.innerHTML;
    assert.ok(html.includes('✅')&&html.includes('🔧')&&html.includes('⚠️'),'报告页三档分组渲染');
    assert.ok(html.includes('待确认'),'报告页有待确认文案');
    assert.ok(html.indexOf('finishPlanner()')<0,'pending 未清空,完成按钮不亮');
    assert.ok(mf4.calls.some(function(u){return u.indexOf('nominatim')>=0;}),'走过 Nominatim 坐标路');
    assert.ok(mf4.keys.indexOf('verify1')>=0,'走过 LLM 复核路');
    // 丢弃坏点:pending 清空,完成按钮亮起
    r4.ctx.resolvePending('西津渡古街',false);
    assert.strictEqual(r4.ctx.PLANNER.verify.pending.length,0,'pending 清空');
    assert.strictEqual(JSON.stringify(r4.ctx.PLANNER.verify.dropped),JSON.stringify(['西津渡古街']),'丢弃名单记录');
    assert.ok(r4.document.body.innerHTML.includes('finishPlanner()'),'pending 清空后完成按钮亮起');
    // 组装:Node 侧完整校验 + 丢弃/纠偏生效 + flex 迷你行程形状
    const pack=r4.ctx.assemblePack();
    assert.ok(pack,'assemblePack 出包');
    const vr=validateTrip(pack);
    assert.deepStrictEqual(vr.errors,[],'assemblePack 产物过 Node validateTrip,实际 errors:'+vr.errors.join(';'));
    assert.ok(!pack.radarExtra.some(function(x){return x.n==='西津渡古街';}),'丢弃点不进最终包 radarExtra');
    assert.ok(!pack.poiDetail['西津渡古街'],'丢弃点不进最终包 poiDetail');
    const js=pack.pois.filter(function(p){return p.name==='金山寺(镇江)';})[0];
    assert.deepStrictEqual({lat:js.lat,lng:js.lng},{lat:32.4512,lng:119.6087},'纠偏坐标已应用进最终包');
    assert.strictEqual(pack.flex,null,'flex:null 的迷你行程产出 flex:null');
    assert.strictEqual(pack.wxRules,null,'flex:null 的迷你行程产出 wxRules:null');
    assert.strictEqual(pack.meta.preDepartNote,FIXT.skeleton.meta.preDepartNote,'preDepartNote 用骨架 meta 的');
    assert.strictEqual(pack.meta.endNote,FIXT.skeleton.meta.endNote,'endNote 用骨架 meta 的');
    assert.strictEqual(JSON.stringify(pack.optimize.anchorDays),JSON.stringify({nj:[1,3],zj:[2]}),'optimize.anchorDays 与 days[].n 一致');
    assert.strictEqual(pack.optimize.home,'nj','optimize.home 是出发地锚点');
    // 入库:ta-trips 含新行程、ta-planner 清除、ta-current 指向新行程
    r4.ctx.finishPlanner();
    const cur=JSON.parse(r4.localStorage.getItem('ta-current'));
    const trips=JSON.parse(r4.localStorage.getItem('ta-trips'));
    assert.ok(/^t\d+$/.test(cur),'ta-current 指向新行程 id:'+cur);
    assert.ok(trips[cur]&&trips[cur].meta&&trips[cur].meta.id===cur,'ta-trips 含新行程');
    assert.strictEqual(r4.localStorage.getItem('ta-planner'),null,'ta-planner 已清除');
    console.log('pipeline.test.js: T3 段通过 (三档:pass 1/纠偏 1/丢弃 1,新行程 '+cur+' 已入库)');
  });
}
