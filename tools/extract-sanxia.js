// 三峡 TripPack 一次性提取脚本(保留备查/复跑)
// 从源 HTML 提取 12 个数据常量 + 引擎里写死的文案,组装为 TripPack schema v1
// 用法: node tools/extract-sanxia.js  →  写 trips/sanxia.trip.json
// 规则见 plans/2026-08-20-M1-通用壳与三峡迁移.md Task 3
const fs=require('fs'),vm=require('vm'),path=require('path');
const SRC='C:/Users/Vincen/Desktop/长江三峡成都自驾16天_互动行程.html';
const OUT=path.join(__dirname,'..','trips','sanxia.trip.json');

// 括号配平扫描取 var NAME=...; 字面量并 eval(数据是自己文件里的字面量,安全)
function grabVar(src,name){
  const m=src.match(new RegExp('var\\s+'+name+'\\s*='));
  if(!m)throw new Error('找不到 var '+name);
  let i=m.index+m[0].length,depth=0,q=null,j=i;
  for(;j<src.length;j++){
    const c=src[j];
    if(q){if(c==='\\')j++;else if(c===q)q=null;continue;}
    if(c==='"'||c==="'"){q=c;continue;}
    if('{[('.includes(c))depth++;
    if('}])'.includes(c))depth--;
    if(c===';'&&depth===0)break;
  }
  return vm.runInNewContext('('+src.slice(i,j)+')');
}
// 从源码照搬文案:正则取捕获组 1,取不到即抛错(拒绝静默占位)
function grabText(src,re,desc){
  const m=src.match(re);
  if(!m)throw new Error('找不到文案: '+desc);
  return m[1];
}
// JS 字符串字面量内容解码(处理转义)
function evalStr(raw){return vm.runInNewContext("'"+raw+"'");}

const src=fs.readFileSync(SRC,'utf8');
const ANCHORS=grabVar(src,'ANCHORS'),POIS=grabVar(src,'POIS'),CAT_Q=grabVar(src,'CAT_Q'),
      RADAR_EXTRA=grabVar(src,'RADAR_EXTRA'),DAYS=grabVar(src,'DAYS'),FLEX=grabVar(src,'FLEX'),
      BOOKINGS=grabVar(src,'BOOKINGS'),WX_CITIES=grabVar(src,'WX_CITIES'),
      MAIN_LEGS=grabVar(src,'MAIN_LEGS'),FLEX_ROUTE=grabVar(src,'FLEX_ROUTE'),
      LEG_INFO=grabVar(src,'LEG_INFO'),POI_DETAIL=grabVar(src,'POI_DETAIL');

/* ---- 引擎写死文案,从源 HTML 对应行照搬(注释为源行号) ---- */
// hero:眉题 273、路线 275(剥掉 <b> 标签,与 schema 示例的纯文本箭头一致)
const kicker=grabText(src,/<div class="eyebrow"><i><\/i>([^<]+)<\/div>/,'hero 眉题(273 行)');
const routeLine=grabText(src,/<div class="route">([\s\S]*?)<\/div>/,'hero 路线(275 行)').replace(/<\/?b>/g,'');
// culture.hint 293
const culHint=grabText(src,/<div class="map-hint" style="margin:4px 2px 0">([^<]+)<\/div>/,'文史导览提示(293 行)');
// renderCulture 分组 747(含 en-dash,直接 eval 原字面量)
const culGroups=vm.runInNewContext(grabText(src,/var groups=(\[[^\n]+?\]);/,'文史分组(747 行)'));
// flexCard 719:徽章 D10–13 / 标题 机动四天 / 提示
const mFlex=src.match(/<div class="d-badge">(D[^'<]+)<\/div><div class="d-title"><h3>([^<·]+?) · /);
if(!mFlex)throw new Error('找不到文案: 机动卡徽章/标题(719 行)');
const flexBadge=mFlex[1],flexTitle=mFlex[2];
const flexHint=grabText(src,/<div class="d-meta">8\.3.8\.6 · ([^<]+)<\/div>/,'机动卡提示(719 行)');
// renderWx 区域:窗口标签 936、四条 say 941-944(顺序同原 if 链:A/D/C/B)
const wxRegion=src.slice(src.indexOf('function renderWx'),src.indexOf('function flexMetrics'));
const windowLabel=grabText(wxRegion,/var txt='((?:[^'\\]|\\.)*?) 预报/,'天气窗口标签(936 行)');
const says=[];
{const re=/txt\+='((?:[^'\\]|\\.)*)'/g;let m;
 while((m=re.exec(wxRegion))){const s=evalStr(m[1]);if(s[0]===' ')says.push(s.slice(1));}
 if(says.length!==4)throw new Error('renderWx say 文案应为 4 条(941-944 行),实际 '+says.length);}
// 注:say 原文带一个前导空格(拼接收尾用),入包时去掉——通用引擎拼接时自加空格
// failText 914 / unknownText 935
const failText=evalStr(grabText(src,/getElementById\('wxBox'\)\.textContent='((?:[^'\\]|\\.)*)'/,'天气失败文案(914 行)'));
const unknownText=grabText(src,/<div class="verdict unk">([^<]+)<\/div>/,'超出预报文案(935 行)');
// optimize.note 992
const optNote=grabText(src,/margin-top:6px">(注:[^<]+)<\/div>/,'最优重排备注(992 行)');
// renderToday 出发前/结束后文案 1021/1022
const preDepartNote=grabText(src,/明天出发.<\/div><div class="dim">([^<]+)<\/div>/,'出发前文案(1021 行)');
const endNote=grabText(src,/行程已结束<\/div><div class="dim">([^<]+)<\/div>/,'结束后文案(1022 行)');
// fitAll 锚点列表 833
const fitAnchors=vm.runInNewContext('['+grabText(src,/function fitAll\(\)[\s\S]*?pts\(\[([^\]]+)\]\)/,'fitAnchors(833 行)')+']');

/* ---- 写死映射(值均与源引擎一致,注释为出处) ---- */
const FLEX_SHORT={A:'九寨',B:'乐峨',C:'四姑娘',D:'海螺沟'};          // flexCard 按钮 723-726
const FLEX_COLOR={A:'#2f6fb2',B:'#e07b24',C:'#d13c3c',D:'#4ca64c'}; // baseStyle 768-771
const FLEX_ANCHOR={A:'jzg',B:'ls',C:'sg',D:'hg'};                   // flexAnchor 959
const WX_ROLE={4:'A',5:'B',7:'C',8:'D'};                            // renderWx 下标 933
const WX_SHORT={'九寨沟口':'九寨沟','乐山':'乐山','四姑娘山':'四姑娘山','磨西镇':'海螺沟'};

/* ---- 组装 ---- */
const legs=MAIN_LEGS.map(function(l){return {id:l.id,keys:l.keys,label:l.label,mode:'drive'};})
  .concat(['A','B','C','D'].map(function(k){
    const r=FLEX_ROUTE[k];return {id:r.id,keys:r.keys,label:r.label,mode:'drive',flex:k};
  }));
const pois=POIS.map(function(p){
  const cq=CAT_Q[p.name];
  if(!cq)throw new Error('CAT_Q 缺 '+p.name);
  return {name:p.name,lat:p.lat,lng:p.lng,day:p.day,seg:p.seg,pass:p.pass===true,info:p.info,cat:cq[0],q:cq[1]};
});
const flexOptions={};
['A','B','C','D'].forEach(function(k){
  flexOptions[k]={name:FLEX[k].name,short:FLEX_SHORT[k],color:FLEX_COLOR[k],anchor:FLEX_ANCHOR[k],
                  note:FLEX[k].note,rows:FLEX[k].rows,know:FLEX[k].know};
});
const pack={
  schema:1,
  meta:{id:'sanxia16',title:'诗路长江',kicker:kicker,routeLine:routeLine,
        dateStart:'2026-07-25',dateEnd:'2026-08-09',kidAge:11,theme:'古诗词+历史典故',region:'cn',
        preDepartNote:preDepartNote,endNote:endNote},
  anchors:ANCHORS,
  days:DAYS,
  legs:legs,
  legInfo:LEG_INFO,
  pois:pois,
  radarExtra:RADAR_EXTRA,
  poiDetail:POI_DETAIL,
  flex:{insertBeforeDay:14,doneKey:10,daysCount:4,badge:flexBadge,title:flexTitle,hint:flexHint,
        dateStart:'2026-08-03',dateEnd:'2026-08-06',options:flexOptions},
  bookings:BOOKINGS,
  wxCities:WX_CITIES.map(function(c,i){
    return {name:c.name,short:WX_SHORT[c.name]||c.name,lat:c.lat,lng:c.lng,role:WX_ROLE[i]||null};
  }),
  wxRules:{windowLabel:windowLabel,failText:failText,unknownText:unknownText,rules:[
    {option:'A',maxProb:50,maxSum:8,say:says[0]},
    {option:'D',maxProb:50,maxSum:8,say:says[1]},
    {option:'C',maxProb:45,maxSum:6,say:says[2]},
    {option:'B',say:says[3]}]},
  optimize:{order:['wx','wh','fj','cq','cd','yc'],
            anchorDays:{wh:[1,2],fj:[3],cq:[4,5],cd:[6,7,8,9],yc:[14,15]},
            home:'wx',note:optNote},
  culture:{groups:culGroups,hint:culHint},
  map:{center:[31.2,110.5],zoom:5,mainPath:['wh','fj','cq','dz','cd','yc','wx'],fitAnchors:fitAnchors},
  ai:{radiusKm:100,routeKm:20,cats:['文','史','地','科']}
};
fs.writeFileSync(OUT,JSON.stringify(pack));
console.log('已写出 '+OUT);
console.log('days='+pack.days.length+' pois='+pack.pois.length+' radarExtra='+pack.radarExtra.length+
  ' poiDetail='+Object.keys(pack.poiDetail).length+' legs='+pack.legs.length+
  ' bookings='+pack.bookings.length+' wxCities='+pack.wxCities.length+' flexOptions='+Object.keys(flexOptions).length);
