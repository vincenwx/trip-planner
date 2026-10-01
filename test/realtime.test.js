const assert=require('assert'),fs=require('fs');
const {boot}=require('./boot.js');
const pack=JSON.parse(fs.readFileSync(__dirname+'/../trips/sanxia.trip.json','utf8'));
const seed={'ta-trips':JSON.stringify({[pack.meta.id]:pack}),'ta-current':JSON.stringify(pack.meta.id)};
const {ctx,document}=boot(__dirname+'/../行程助手.html',seed);

// === 人流估算规则 crowdOf(日历+天气) ===
var summerSat=new Date('2026-07-25T00:00:00');           // 周六 + 暑假
var c1=ctx.crowdOf(summerSat,null);
assert.ok(c1.lv===0,'暑假周六应为「高」:'+JSON.stringify(c1));
assert.ok(c1.tags.indexOf('暑假')>=0&&c1.tags.indexOf('周末')>=0,'标签应含暑假/周末');
var plainWed=new Date('2026-09-16T00:00:00');            // 普通工作日
var c2=ctx.crowdOf(plainWed,null);
assert.ok(c2.lv===2,'普通工作日应为「低」:'+JSON.stringify(c2));
var natDay=new Date('2026-10-03T00:00:00');             // 国庆
var c3=ctx.crowdOf(natDay,null);
assert.ok(c3.lv===0&&c3.tags.indexOf('国庆')>=0,'国庆应为「高」且带标签:'+JSON.stringify(c3));
var rainy=ctx.crowdOf(plainWed,{prob:80,code:61,tmax:24});
assert.ok(rainy.tags.indexOf('有雨·户外人少')>=0,'雨天应计入降级标签:'+JSON.stringify(rainy));
console.log('realtime.test.js: crowdOf 段通过');

// === renderCrowd 渲染 ===
ctx.renderCrowd();
var cb=document.getElementById('crowdBox').innerHTML;
assert.ok(cb.indexOf('crowd-row')>=0,'crowdBox 应渲染日期行');
assert.ok(cb.indexOf('实时路况')>=0,'脚注应引导到实时路况');
console.log('realtime.test.js: renderCrowd 段通过');

// === 实时路况:开关 + 官方同频自动刷新 ===
ctx.L={tileLayer:function(u,o){return {url:u,opts:o,addTo:function(){this.added=true;return this;},setUrl:function(x){this.url=x;this.setUrlCalls=(this.setUrlCalls||0)+1;return this;}};}};
ctx.map={removeLayer:function(l){l.removed=true;}};
ctx.setInterval=function(f,ms){ctx._iv={f:f,ms:ms};return 7;};
ctx.clearInterval=function(h){ctx._cleared=h;};
document.getElementById('trafBtn').querySelector=function(){return {textContent:''};};   // stub-DOM 补 querySelector
ctx.toggleTraffic();
assert.ok(ctx.trafficOn===true,'开启后 trafficOn 为真');
assert.ok(ctx.trafficLayer.url.indexOf('trafficengine')>=0,'使用高德路况瓦片');
assert.ok(ctx.trafficLayer.url.indexOf('_=')>=0,'瓦片 URL 应带时间戳以强制刷新');
assert.ok(ctx.trafficLayer.added===true,'图层已加入地图');
assert.ok(ctx._iv&&ctx._iv.ms===180000,'刷新间隔应为 180000ms(高德 2 分钟级)');
assert.ok(document.getElementById('trafTime').textContent.indexOf('更新于')>=0,'应显示「更新于」时间');
assert.ok(document.getElementById('trafTip').classList.contains('show'),'提示条应显示');
var n1=ctx.trafficLayer.setUrlCalls;ctx._iv.f();
assert.ok(ctx.trafficLayer.setUrlCalls===n1+1,'定时刷新应重设瓦片 URL(拉取新图)');
assert.ok(ctx.trafficLayer.url.indexOf('_=')>=0,'刷新后的 URL 仍带时间戳');
ctx.toggleTraffic();
assert.ok(ctx.trafficOn===false,'再次点击应关闭');
assert.ok(ctx._cleared===7,'关闭时应清除定时器');
assert.ok(ctx.trafficLayer.removed===true,'图层应移除');
console.log('realtime.test.js: 实时路况段通过');

// 天气块不需要地图:置空 map 让 drawRoutes 早退(与 smoke 一致,避免复用路况桩时缺 L.polyline)
ctx.map=null;
// === 天气增强:实时此刻 + 逐小时推荐外出时段 + 预警 ===
function cityWith(prob,base,tmax){
 var t=[],p=[],s=[],mx=[],mn=[],wc=[];
 for(var d=1;d<=16;d++){var dd='2026-08-'+('0'+d).slice(-2);t.push(dd);p.push(prob);s.push(1);mx.push(tmax);mn.push(tmax-8);wc.push(1);}
 var ht=[],hp=[],hw=[];
 for(var i=0;i<48;i++){
  var dt=new Date(base.getTime()+i*3600*1000);dt.setMinutes(0,0,0);
  ht.push(dt.getFullYear()+'-'+('0'+(dt.getMonth()+1)).slice(-2)+'-'+('0'+dt.getDate()).slice(-2)+'T'+('0'+dt.getHours()).slice(-2)+':00');
  hp.push(i<6?40:(i>=6&&i<=9?90:5));
  hw.push(26);
 }
 return {daily:{time:t,precipitation_probability_max:p,precipitation_sum:s,temperature_2m_max:mx,temperature_2m_min:mn,weathercode:wc},
  current:{temperature_2m:28,apparent_temperature:31,relative_humidity_2m:62,weathercode:1,wind_speed_10m:3.2,precipitation:0},
  hourly:{time:ht,precipitation_probability:hp,temperature_2m:hw}};
}
var base=new Date();base.setMinutes(0,0,0);
var cities0=ctx.WX_CITIES||pack.wxCities;
var wxArr=cities0.map(function(){return cityWith(20,base,30);});
ctx.renderWx(wxArr);
var nw=document.getElementById('wxNow').innerHTML;
assert.ok(nw.indexOf('此刻 ·')>=0,'应显示实时此刻:'+nw.slice(0,80));
assert.ok(nw.indexOf('体感')>=0&&nw.indexOf('湿度')>=0,'此刻应含体感/湿度');
assert.ok(nw.indexOf('今日推荐外出')>=0,'应给出今日推荐外出时段');
assert.ok(nw.indexOf('⚠️')>=0,'未来12小时强降水应触发预警');
assert.ok(nw.indexOf('实时实况')>=0,'此刻块应标明实时');
// bestWindow 单元:应跳过 40%/90% 的时段,选到 i=10 的 5% 窗口
var bw=ctx.bestWindow(wxArr[0].hourly,base);
assert.ok(bw&&bw.prob===5,'推荐窗口应落在低雨概率时段:'+JSON.stringify(bw));
assert.ok(bw.i===10,'推荐窗口应从 i=10 开始(雨后):'+bw.i);
// 高温/大风预警
assert.ok(ctx.wxWarn({time:[wxArr[0].hourly.time[0]],precipitation_probability:[10],temperature_2m:[36]},null,base).indexOf('heat')>=0,'36°C 应触发高温预警');
assert.ok(ctx.wxWarn(null,{wind_speed_10m:12},base).indexOf('wind')>=0,'大风应触发预警');
// 缺 current/hourly 时优雅降级(旧 pack 的日预报数组)
ctx.renderWx(cities0.map(function(c){return {daily:cityWith(20,base,30).daily};}));
assert.ok(document.getElementById('wxNow').innerHTML.indexOf('此刻实况获取中')>=0,'缺实时数据应降级提示');
console.log('realtime.test.js: 天气增强段通过');

// === 实时监测:定时重取 + 可停 ===
assert.ok(ctx.wxOn===false,'初始未监测');
ctx.toggleWxLive();
assert.ok(ctx.wxOn===true,'开启后进入监测');
assert.ok(ctx._iv&&ctx._iv.ms===600000,'监测间隔应为 600000ms(10 分钟)');
assert.ok(ctx.wxTimer===7,'应建立定时器');
assert.ok(document.getElementById('wxLiveBtn').textContent.indexOf('监测中')>=0,'按钮应显示监测中');
ctx._cleared=null;
ctx.toggleWxLive();
assert.ok(ctx.wxOn===false,'再次点击应停止');
assert.ok(ctx._cleared===7,'停止时应清除定时器');
assert.ok(ctx.wxTimer===null,'定时器句柄应清空');
assert.ok(document.getElementById('wxLiveBtn').textContent.indexOf('实时监测')>=0,'停止后按钮回到实时监测');
console.log('realtime.test.js: 实时监测段通过');

// === 附近好玩的:按可玩性排序 ===
var p0=ctx.POIS[0];
var me={lat:p0.lat,lng:p0.lng};
var tops=ctx.funTop(me,5);
assert.ok(tops.length>0,'应返回附近可玩点:'+tops.length);
assert.ok(tops.length<2||tops[0].score>=tops[1].score,'应按可玩性降序');
assert.ok(tops[0].d<=100,'排序首位应在半径内');
var sci=ctx.funScore({n:'x',c:'科',lat:p0.lat,lng:p0.lng},me);
var his=ctx.funScore({n:'y',c:'史',lat:p0.lat,lng:p0.lng},me);
assert.ok(sci>his,'同距离下 科 应比 史 更「好玩」:'+sci+'/'+his);
assert.ok(ctx.funScore({n:'z',c:'地',lat:p0.lat,lng:p0.lng},me)>ctx.funScore({n:'z',c:'地',lat:0,lng:0},me),'同分类更近者分更高');
console.log('realtime.test.js: 附近好玩段通过');

// === 附近好玩的(定位/临时城市) ===
ctx.initFunCity();
assert.ok((document.getElementById('funCity').innerHTML||'').indexOf('<option')>=0,'城市下拉应被填充选项');
var fk=Object.keys(ctx.ANCHORS)[0];
document.getElementById('funCity').value=fk;
ctx.findFun();
assert.ok(ctx.funData.length>0,'按临时城市应找到附近可玩点');
assert.ok((document.getElementById('funList').innerHTML||'').indexOf('r-item')>=0,'应渲染可玩点行');
assert.ok(ctx.funRef().src===ctx.ANCHORS[fk].name,'funRef 应取所选城市');
document.getElementById('funCity').value='';
ctx.setMe(ctx.ANCHORS[fk].lat,ctx.ANCHORS[fk].lng,false);
assert.ok(ctx.funRef().src==='我的定位','清空选择后应回落到定位');
ctx.zoomFunPoint(0);
console.log('realtime.test.js: 附近好玩(定位)段通过');

console.log('realtime.test.js: 全部通过 ('+__filename+')');
