// TripPack schema v1 校验器(Node require / CLI 双用)
// 规则见 plans/2026-08-20-M1-通用壳与三峡迁移.md Task 2 Step 3
// 所有错误收集后一次返回,不中途抛错
function validateTrip(pack){
  const errors=[],warnings=[];
  const E=(m)=>errors.push(m);
  const isISO=(s)=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s);
  const isNum=(x)=>typeof x==='number'&&isFinite(x);
  const isPosInt=(x)=>isNum(x)&&Math.floor(x)===x&&x>0;

  if(!pack||typeof pack!=='object'||Array.isArray(pack)){E('pack 不是对象');return {errors,warnings};}
  if(pack.schema!==1)E('schema 应为 1,实际: '+JSON.stringify(pack.schema));

  // ---- meta ----
  const meta=(pack.meta&&typeof pack.meta==='object')?pack.meta:null;
  if(!meta){E('meta 缺失');}
  else{
    ['id','title','kicker','routeLine','dateStart','dateEnd','kidAge','theme','region','preDepartNote','endNote'].forEach(function(k){
      if(meta[k]===undefined||meta[k]===null||meta[k]==='')E('meta.'+k+' 缺失');
    });
    if(meta.region!==undefined&&meta.region!=='cn'&&meta.region!=='global')
      E('meta.region 应为 cn|global,实际: '+JSON.stringify(meta.region));
    if(meta.dateStart!==undefined&&!isISO(meta.dateStart))E('meta.dateStart 不是 ISO 日期: '+JSON.stringify(meta.dateStart));
    if(meta.dateEnd!==undefined&&!isISO(meta.dateEnd))E('meta.dateEnd 不是 ISO 日期: '+JSON.stringify(meta.dateEnd));
    if(isISO(meta.dateStart)&&isISO(meta.dateEnd)&&!(meta.dateStart<meta.dateEnd))
      E('meta.dateStart 必须早于 meta.dateEnd');
  }

  // ---- anchors ----
  const anchors=(pack.anchors&&typeof pack.anchors==='object')?pack.anchors:null;
  const anchorKeys=anchors?Object.keys(anchors):[];
  if(!anchors){E('anchors 缺失');}
  else{
    if(anchorKeys.length<2)E('anchors 至少需要 2 个,实际 '+anchorKeys.length+' 个');
    anchorKeys.forEach(function(k){
      const a=anchors[k];
      if(!a||typeof a!=='object'){E('anchors.'+k+' 不是对象');return;}
      ['name','lat','lng','stay'].forEach(function(f){
        if(a[f]===undefined||a[f]===null)E('anchors.'+k+'.'+f+' 缺失');
      });
      if(a.lat!==undefined&&!isNum(a.lat))E('anchors.'+k+'.lat 不是有限数字');
      if(a.lng!==undefined&&!isNum(a.lng))E('anchors.'+k+'.lng 不是有限数字');
    });
  }
  const inAnchors=(k)=>anchorKeys.indexOf(k)>=0;

  // ---- culture(pois.seg 依赖其 groups) ----
  const culture=(pack.culture&&typeof pack.culture==='object')?pack.culture:null;
  const groupKeys=[];
  if(!culture){E('culture 缺失');}
  else{
    if(!Array.isArray(culture.groups)||!culture.groups.length){E('culture.groups 缺失或为空');}
    else culture.groups.forEach(function(g,i){
      if(!Array.isArray(g)||g.length<1){E('culture.groups['+i+'] 应为 [key,label] 数组');return;}
      if(groupKeys.indexOf(g[0])>=0)E('culture.groups 的 key 重复: '+JSON.stringify(g[0]));
      else groupKeys.push(g[0]);
    });
  }

  // ---- ai(pois.cat 依赖其 cats) ----
  const ai=(pack.ai&&typeof pack.ai==='object')?pack.ai:null;
  if(!ai){E('ai 缺失');}
  else if(!Array.isArray(ai.cats)||!ai.cats.length)E('ai.cats 缺失或为空');

  // ---- flex(可空 null) ----
  const flex=(pack.flex===undefined)?null:pack.flex;
  let flexOptKeys=[];
  if(flex!==null){
    if(!flex||typeof flex!=='object'||Array.isArray(flex)){E('flex 应为对象或 null');}
    else{
      if(!isPosInt(flex.doneKey))E('flex.doneKey 应为正整数');
      if(!isPosInt(flex.insertBeforeDay))E('flex.insertBeforeDay 应为正整数');
      if(!flex.options||typeof flex.options!=='object'||!Object.keys(flex.options).length){E('flex.options 缺失或为空');}
      else{
        flexOptKeys=Object.keys(flex.options);
        flexOptKeys.forEach(function(k){
          const o=flex.options[k];
          if(!o||typeof o!=='object'){E('flex.options.'+k+' 不是对象');return;}
          if(!inAnchors(o.anchor))E('flex.options.'+k+'.anchor '+JSON.stringify(o.anchor)+' 不在 anchors 里');
          if(!Array.isArray(o.rows))E('flex.options.'+k+'.rows 应为数组');
        });
      }
    }
  }

  // ---- days ----
  const dayNums=[];
  if(!Array.isArray(pack.days)||!pack.days.length){E('days 缺失或为空');}
  else{
    let prev=-Infinity;
    pack.days.forEach(function(d,i){
      if(!d||typeof d!=='object'){E('days['+i+'] 不是对象');return;}
      if(!isNum(d.n)){E('days['+i+'].n 不是数字');}
      else{
        if(dayNums.indexOf(d.n)>=0)E('days['+i+'].n 重复: '+d.n);
        else if(d.n<=prev)E('days['+i+'].n 未递增: '+d.n+'(前一天 '+prev+')');
        prev=d.n;dayNums.push(d.n);
      }
      if(!inAnchors(d.anchor))E('days['+i+'].anchor '+JSON.stringify(d.anchor)+' 不在 anchors 里');
      if(!isISO(d.full))E('days['+i+'].full 不是 ISO 日期: '+JSON.stringify(d.full));
    });
  }

  // ---- legs ----
  const MODES=['drive','rail','flight','local'];
  if(!Array.isArray(pack.legs)||!pack.legs.length){E('legs 缺失或为空');}
  else{
    const ids=[];
    pack.legs.forEach(function(l,i){
      if(!l||typeof l!=='object'){E('legs['+i+'] 不是对象');return;}
      if(l.id===undefined||l.id===null||l.id==='')E('legs['+i+'].id 缺失');
      else{if(ids.indexOf(l.id)>=0)E('legs['+i+'].id 重复: '+JSON.stringify(l.id));ids.push(l.id);}
      if(!Array.isArray(l.keys)||!l.keys.length){E('legs['+i+'].keys 缺失或为空');}
      else l.keys.forEach(function(k){
        if(!inAnchors(k))E('legs['+i+'].keys 含未知锚点 '+JSON.stringify(k));
      });
      if(MODES.indexOf(l.mode)<0)E('legs['+i+'].mode '+JSON.stringify(l.mode)+' 非法(应为 '+MODES.join('|')+')');
      if(l.flex!==undefined&&l.flex!==null&&flexOptKeys.indexOf(l.flex)<0)
        E('legs['+i+'].flex '+JSON.stringify(l.flex)+' 不在 flex.options 的 key 里');
    });
  }

  // ---- pois ----
  const poiNames=[];
  if(!Array.isArray(pack.pois)){E('pois 缺失');}
  else pack.pois.forEach(function(pt,i){
    const tag='pois['+i+']'+(pt&&pt.name?'('+pt.name+')':'');
    if(!pt||typeof pt!=='object'){E(tag+' 不是对象');return;}
    poiNames.push(pt.name);
    // day 是展示标签:三峡真实数据含 '备选D2/3'/'方案A'/'D5晚' 等值,故只要求非空字符串(原计划写 /^D\d+$/,Task 3 执行时放宽)
    if(typeof pt.day!=='string'||!pt.day)E(tag+'.day 缺失或不是非空字符串: '+JSON.stringify(pt.day));
    if(groupKeys.length&&groupKeys.indexOf(pt.seg)<0)E(tag+'.seg '+JSON.stringify(pt.seg)+' 不在 culture.groups 的 key 里');
    if(ai&&Array.isArray(ai.cats)&&ai.cats.length&&ai.cats.indexOf(pt.cat)<0)
      E(tag+'.cat '+JSON.stringify(pt.cat)+' 不在 ai.cats 里');
    if(!isNum(pt.lat))E(tag+'.lat 不是数字');
    if(!isNum(pt.lng))E(tag+'.lng 不是数字');
  });

  // ---- radarExtra(poiDetail 覆盖检查用) ----
  const radarNames=[];
  if(!Array.isArray(pack.radarExtra)){E('radarExtra 缺失');}
  else pack.radarExtra.forEach(function(x,i){
    if(!x||typeof x!=='object'){E('radarExtra['+i+'] 不是对象');return;}
    radarNames.push(x.n);
  });

  // ---- poiDetail:pois[].name 与 radarExtra[].n 全覆盖 ----
  const poiDetail=(pack.poiDetail&&typeof pack.poiDetail==='object')?pack.poiDetail:null;
  if(!poiDetail){E('poiDetail 缺失');}
  else poiNames.concat(radarNames).forEach(function(n){
    const d=poiDetail[n];
    if(!d||typeof d!=='object'){E('poiDetail 缺 '+JSON.stringify(n)+' 的讲解');return;}
    if(typeof d.story!=='string'||!d.story)E('poiDetail['+n+'].story 缺失');
    if(!Array.isArray(d.see)||d.see.length!==3)E('poiDetail['+n+'].see 应为 3 条数组');
    if(typeof d.fact!=='string'||!d.fact)E('poiDetail['+n+'].fact 缺失');
    if(typeof d.think!=='string'||!d.think)E('poiDetail['+n+'].think 缺失');
  });

  // ---- bookings ----
  if(!Array.isArray(pack.bookings)){E('bookings 缺失');}
  else pack.bookings.forEach(function(b,i){
    if(!b||typeof b!=='object'){E('bookings['+i+'] 不是对象');return;}
    if(!isISO(b.due))E('bookings['+i+'].due 不是 ISO 日期: '+JSON.stringify(b.due));
  });

  // ---- wxCities ----
  if(!Array.isArray(pack.wxCities)){E('wxCities 缺失');}
  else pack.wxCities.forEach(function(c,i){
    if(!c||typeof c!=='object'){E('wxCities['+i+'] 不是对象');return;}
    if(c.role!=null&&flexOptKeys.indexOf(c.role)<0)
      E('wxCities['+i+']'+(c.name?'('+c.name+')':'')+'.role '+JSON.stringify(c.role)+' 应为 null 或 flex.options 的 key');
  });

  // ---- wxRules(flex 非空时必填) ----
  const wxRules=(pack.wxRules===undefined)?null:pack.wxRules;
  if(flex&&typeof flex==='object'&&!Array.isArray(flex)&&wxRules===null)E('wxRules 缺失(flex 非空时必填)');
  if(wxRules!==null){
    if(!wxRules||typeof wxRules!=='object'||Array.isArray(wxRules)){E('wxRules 应为对象或 null');}
    else{
      if(!Array.isArray(wxRules.rules)||!wxRules.rules.length){E('wxRules.rules 缺失或为空');}
      else{
        wxRules.rules.forEach(function(r,i){
          if(!r||typeof r!=='object'){E('wxRules.rules['+i+'] 不是对象');return;}
          if(flexOptKeys.length&&flexOptKeys.indexOf(r.option)<0)
            E('wxRules.rules['+i+'].option '+JSON.stringify(r.option)+' 不在 flex.options 的 key 里');
        });
        const last=wxRules.rules[wxRules.rules.length-1];
        if(last&&typeof last==='object'&&(last.maxProb!=null||last.maxSum!=null))
          E('wxRules.rules 最后一条应为无阈值兜底规则(maxProb/maxSum 缺省)');
      }
      if(flex===null)warnings.push('wxRules 存在但 flex 为 null');
    }
  }

  // ---- optimize ----
  const optimize=(pack.optimize&&typeof pack.optimize==='object')?pack.optimize:null;
  if(!optimize){E('optimize 缺失');}
  else{
    const flexDayNums=[];
    if(flex&&typeof flex==='object'&&isPosInt(flex.insertBeforeDay)&&isPosInt(flex.daysCount))
      for(let n=flex.insertBeforeDay-flex.daysCount;n<flex.insertBeforeDay;n++)flexDayNums.push(n);
    const validDay=(n)=>dayNums.indexOf(n)>=0||flexDayNums.indexOf(n)>=0;
    if(!Array.isArray(optimize.order)||!optimize.order.length){E('optimize.order 缺失或为空');}
    else optimize.order.forEach(function(k){
      if(!inAnchors(k))E('optimize.order 含未知锚点 '+JSON.stringify(k));
    });
    if(!inAnchors(optimize.home))E('optimize.home '+JSON.stringify(optimize.home)+' 不在 anchors 里');
    if(!optimize.anchorDays||typeof optimize.anchorDays!=='object'){E('optimize.anchorDays 缺失');}
    else Object.keys(optimize.anchorDays).forEach(function(k){
      if(!inAnchors(k))E('optimize.anchorDays 含未知锚点 '+JSON.stringify(k));
      const arr=optimize.anchorDays[k];
      if(!Array.isArray(arr)){E('optimize.anchorDays.'+k+' 应为天数数组');return;}
      arr.forEach(function(n){
        if(!validDay(n))E('optimize.anchorDays.'+k+' 的天数 '+n+' 不在 days[].n 或机动天数范围里');
      });
    });
  }

  // ---- map ----
  const map=(pack.map&&typeof pack.map==='object')?pack.map:null;
  if(!map){E('map 缺失');}
  else ['mainPath','fitAnchors'].forEach(function(f){
    if(!Array.isArray(map[f])){E('map.'+f+' 缺失或不是数组');return;}
    map[f].forEach(function(k){
      if(!inAnchors(k))E('map.'+f+' 含未知锚点 '+JSON.stringify(k));
    });
  });

  return {errors,warnings};
}
if(typeof module!=='undefined')module.exports={validateTrip};
if(typeof require!=='undefined'&&require.main===module){
  const fs=require('fs');const f=process.argv[2];
  if(!f){console.error('用法: node tools/validate-trip.js <file.trip.json>');process.exit(2);}
  let pack;
  try{pack=JSON.parse(fs.readFileSync(f,'utf8'));}
  catch(e){console.error('读取/解析失败:',e.message);process.exit(1);}
  const r=validateTrip(pack);
  r.warnings.forEach(w=>console.log('警告:',w));
  if(r.errors.length){r.errors.forEach(e=>console.error('错误:',e));process.exit(1);}
  console.log('校验通过:',f);
}
