const assert=require('assert'),fs=require('fs');
const {boot}=require('./boot.js');
const pack=JSON.parse(fs.readFileSync(__dirname+'/../trips/sanxia.trip.json','utf8'));
const seed={'ta-trips':JSON.stringify({[pack.meta.id]:pack}),'ta-current':JSON.stringify(pack.meta.id)};   // ta-current 经 save() 入库是 JSON 编码,种子须同构
const {ctx,document}=boot(__dirname+'/../行程助手.html',seed);
assert.ok(ctx.TRIP&&ctx.TRIP.meta.id==='sanxia16','boot 后应挂载三峡包');
assert.ok(document.getElementById('progTxt').textContent.includes('/ 16 天'),'进度总天数应来自数据');
assert.ok(document.getElementById('sec1').innerHTML.includes('id="dayflex"'),'时间轴应含机动卡');
assert.ok((document.getElementById('sec1').innerHTML.match(/class="day[ "]/g)||[]).length===13,'12 天卡+1 机动卡');
console.log('smoke.test.js: Task4 段通过');

// 接 Task4 段之后
ctx.fmtDate=function(){return '2026-08-04';};ctx.renderToday();
assert.ok(document.getElementById('todayBody').innerHTML.includes('方案'),'机动期今日卡应显示所选方案');
ctx.fmtDate=function(){return '2026-07-24';};ctx.renderToday();
assert.ok(document.getElementById('todayBody').innerHTML.includes('明天出发'),'出发前文案应来自 meta.preDepartNote');
ctx.fmtDate=function(){return '2026-08-10';};ctx.renderToday();
assert.ok(document.getElementById('todayBody').innerHTML.includes('行程已结束'),'结束后文案');
ctx.setDone(10,true);
assert.ok(document.getElementById('progTxt').textContent.includes('4 / 16'),'机动 doneKey 应计 daysCount 天');
ctx.setDone(10,false);
console.log('smoke.test.js: Task5 段通过');

// 接 Task5 段之后
ctx.runOptimize();
var opt=document.getElementById('optBox').innerHTML;
assert.ok(opt.includes('最优顺序')&&opt.includes('无锡'),'优化结果应使用 optimize.home 的城市名');
ctx.setMe(30.66,104.06,false);ctx.runRadar();           // 成都市区
var rl=document.getElementById('radarList').innerHTML;
assert.ok(rl.includes('r-item'),'雷达应列出附近点位');
assert.ok(document.getElementById('radarStatus').innerHTML.includes('100km'),'状态行');
console.log('smoke.test.js: Task6 段通过');

// 接 Task6 段之后：构造四城全晴与暴雨两份假天气，验证规则选择与三峡原逻辑一致
function fakeCity(prob,mm){var t=[],p=[],s=[],mx=[],mn=[],wc=[];
 for(var d=1;d<=16;d++){var dd='2026-08-'+('0'+d).slice(-2);t.push(dd);p.push(prob);s.push(mm);mx.push(30);mn.push(20);wc.push(1);}
 return {daily:{time:t,precipitation_probability_max:p,precipitation_sum:s,temperature_2m_max:mx,temperature_2m_min:mn,weathercode:wc}};}
var cities=ctx.WX_CITIES||pack.wxCities;
var arr=cities.map(function(c){return fakeCity(c.role?20:20,1);});   // 全部好天气
ctx.renderWx(arr);
assert.ok(document.getElementById('wxVerdict').innerHTML.includes('推荐方案A'),'全晴应推荐 A');
arr=cities.map(function(c){return fakeCity(90,30);});               // 全部暴雨
ctx.renderWx(arr);
assert.ok(document.getElementById('wxVerdict').innerHTML.includes('推荐方案B'),'暴雨应兜底 B');
console.log('smoke.test.js: Task7 段通过');

// 全量回归：四页签容器均有内容、文史分组、预约提醒、POI 抽屉
assert.ok(document.getElementById('culBox').innerHTML.split('cul-group').length===5,'文史四组');
assert.ok(document.getElementById('bookBox').innerHTML.includes('湖北省博物馆'),'预约提醒渲染');
ctx.openPoi('黄鹤楼');
assert.ok(document.getElementById('psBody').innerHTML.includes('背景故事'),'预烘焙讲解离线打开');
ctx.closePoi();
console.log('smoke.test.js: 全部通过 ('+__filename+')');

// === M2-T1 行程库 ===
(function(){
  var boot2=require('./boot.js').boot;
  var pack2=JSON.parse(fs.readFileSync(__dirname+'/../trips/sanxia.trip.json','utf8'));
  // 空库：应出现导入引导，且正文不含行程卡
  var r1=boot2(__dirname+'/../行程助手.html',{});
  assert.ok(r1.document.body.innerHTML.includes('导入'),'空库应有导入引导');
  // 有库无当前：显示行程卡（含标题/日期），但不 boot 进应用（progTxt 无内容）
  var seed2={'ta-trips':JSON.stringify({sanxia16:pack2})};
  var r2=boot2(__dirname+'/../行程助手.html',seed2);
  var bh=r2.document.body.innerHTML;
  assert.ok(bh.includes('诗路长江')&&bh.includes('2026'),'行程卡应显示标题与日期');
  assert.ok(bh.includes('进入')&&bh.includes('删除'),'行程卡应有进入/删除操作');
  // 删除函数：删库记录 + 清理该行程的 ta-<id>- 前缀 key
  r2.ctx.deleteTrip('sanxia16');
  assert.ok(!('sanxia16' in JSON.parse(r2.localStorage.getItem('ta-trips'))),'删除后库中无此行程');
  console.log('smoke.test.js: M2-T1 段通过');
})();


// === M2-T2 交通方式 ===
(function(){
  var boot3=require('./boot.js').boot;
  var rp=JSON.parse(fs.readFileSync(__dirname+'/fixtures/rail.trip.json','utf8'));
  var r=boot3(__dirname+'/../行程助手.html',{'ta-trips':JSON.stringify({railtest:rp}),'ta-current':JSON.stringify('railtest')});
  var c=r.ctx;
  assert.ok(c.TRIP.meta.id==='railtest','挂载 railtest');
  var st=c.baseStyle('hm>bj');
  assert.ok(st.dashArray,'高铁段应为虚线示意');
  assert.ok(st.color&&st.color!=='#2f6f5e','高铁段颜色应与自驾主线不同');
  var fetchCalls=[];c.fetch=function(u){fetchCalls.push(u);return Promise.reject(new Error('x'));};
  c.loadRoads();
  assert.ok(!fetchCalls.some(function(u){return u.indexOf('osrm')>=0||u.indexOf('router')>=0;}),'非 drive 段不应请求 OSRM');
  var stD=c.baseStyle('bj>local');
  assert.ok(stD.dashArray,'市内段也应为虚线');
  var card=c.dayCard(c.DAYS[0]);
  assert.ok(card.includes('🚄'),'rail 日程卡应有高铁图标');
  console.log('smoke.test.js: M2-T2 段通过');
})();


// === M2-T3 跳过/恢复 ===
(function(){
  ctx.toggleSkipDay(3,true);
  assert.ok(document.getElementById('sec1').innerHTML.includes('skipped'),'跳过的天卡应有 skipped 样式');
  assert.ok(document.getElementById('progTxt').textContent.includes('/ 15 天'),'跳过一天后总数 15');
  ctx.toggleSkipDay(3,false);
  assert.ok(document.getElementById('progTxt').textContent.includes('/ 16 天'),'恢复后总数 16');
  ctx.toggleSkipPoi('黄鹤楼',true);
  assert.ok(document.getElementById('culBox').innerHTML.match(/cul-item[^>]*skipped/),'文史项应置灰');
  var names=ctx.allRadarPoints().map(function(p){return p.n;});
  assert.ok(names.indexOf('黄鹤楼')<0,'跳过的 POI 雷达排除');
  assert.ok(ctx.state.skip.pois['黄鹤楼']===true,'override 层已写');
  ctx.toggleSkipPoi('黄鹤楼',false);
  assert.ok(ctx.allRadarPoints().some(function(p){return p.n==='黄鹤楼';}),'恢复后回归');
  console.log('smoke.test.js: M2-T3 段通过');
})();


// === M4-T1 L2 局部重规划 ===
(function(){
  // mock deepseek:按 prompt 关键词"提出调整/替换需要改的天"识别局部重规划请求,返回 patch
  ctx.save('ta-ds-key','sk-test');   // aiAdjust 无 key 会短路,先种一个假 key
  ctx.fetch=function(url,opts){
   var body=opts&&opts.body?opts.body:'';
   if(url.indexOf('deepseek')>=0&&/提出调整|替换需要改的天/.test(body)){
    return Promise.resolve({ok:true,json:()=>Promise.resolve({choices:[{message:{content:JSON.stringify({days:[{n:3,title:'武汉室内一日',meta:'宿武昌',plan:['上午:湖北省博物馆','下午:知音号研学'],know:['编钟是战国乐团'],tags:['室内']}],note:'雨天全改室内'})}}]})});
   }
   return Promise.reject(new Error('offline'));
  };
  return ctx.aiAdjust('D3 下雨,全部换室内').then(function(){
   assert.ok(document.getElementById('adjBox').innerHTML.includes('武汉室内一日'),'预览应显示新方案');
   assert.ok(document.getElementById('adjBox').innerHTML.includes('雨天全改室内'),'预览应显示 AI 说明');
   ctx.applyAdjust();
   assert.ok(ctx.state.ovr[3]&&ctx.state.ovr[3].title==='武汉室内一日','override 已写');
   assert.ok(JSON.parse(ctx.localStorage.getItem('ta-sanxia16-ovr'))['3'],'override 已持久化');
   assert.ok(document.getElementById('sec1').innerHTML.includes('武汉室内一日'),'时间轴显示新方案');
   assert.ok(document.getElementById('sec1').innerHTML.includes('已调整'),'已调整角标');
   var d3=ctx.effDay(ctx.DAYS[2]);
   assert.ok(d3.full==='2026-07-27'&&d3.anchor==='fj','日期与锚点不被 AI 改');
   ctx.revertDay(3);
   assert.ok(!ctx.state.ovr[3],'还原后 override 清除');
   assert.ok(!document.getElementById('sec1').innerHTML.includes('武汉室内一日'),'时间轴恢复原方案');
   console.log('smoke.test.js: M4-T1 段通过');
  }).catch(function(e){console.error(e);process.exit(1);});
})();
