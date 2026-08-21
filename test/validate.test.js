const assert=require('assert');
const {validateTrip}=require('../tools/validate-trip.js');
function base(){return {schema:1,
 meta:{id:'t1',title:'T',kicker:'k',routeLine:'r',dateStart:'2026-01-01',dateEnd:'2026-01-03',kidAge:11,theme:'x',region:'cn',preDepartNote:'p',endNote:'e'},
 anchors:{a:{name:'A',lat:30,lng:120,stay:'s'},b:{name:'B',lat:31,lng:121,stay:'s'}},
 days:[{n:1,date:'1.1',full:'2026-01-01',wd:'周四',title:'A→B',meta:'m',type:'drive',anchor:'b',plan:['x'],know:['y'],tags:[]}],
 legs:[{id:'a>b',keys:['a','b'],label:'A→B',mode:'drive'}],legInfo:{},
 pois:[{name:'P1',lat:30.5,lng:120.5,day:'D1',seg:'out',pass:false,info:'i',cat:'史',q:'q'}],
 radarExtra:[],poiDetail:{P1:{story:'s',see:['1','2','3'],fact:'f',think:'t'}},
 flex:null,bookings:[{due:'2026-01-01',what:'w',how:'h'}],
 wxCities:[{name:'A',short:'A',lat:30,lng:120,role:null}],wxRules:null,
 optimize:{order:['a','b'],anchorDays:{b:[1]},home:'a',note:'n'},
 culture:{groups:[['out','去']],hint:'h'},
 map:{center:[30.5,120.5],zoom:5,mainPath:['a','b'],fitAnchors:['a','b']},
 ai:{radiusKm:100,routeKm:20,cats:['文','史','地','科']}};}
let r=validateTrip(base()); assert.deepStrictEqual(r.errors,[],'合法包应通过: '+r.errors.join(';'));
let p=base(); delete p.meta.kidAge; assert.ok(validateTrip(p).errors.some(e=>/kidAge/.test(e)));
p=base(); p.days[0].anchor='zzz'; assert.ok(validateTrip(p).errors.some(e=>/anchor/.test(e)));
p=base(); p.legs[0].keys=['a','zzz']; assert.ok(validateTrip(p).errors.some(e=>/legs.*zzz|zzz.*legs/.test(e)));
p=base(); p.legs[0].mode='rocket'; assert.ok(validateTrip(p).errors.some(e=>/mode/.test(e)));
p=base(); p.pois[0].cat='武'; assert.ok(validateTrip(p).errors.some(e=>/cat/.test(e)));
p=base(); delete p.poiDetail['P1']; assert.ok(validateTrip(p).errors.some(e=>/poiDetail.*P1|P1.*poiDetail/.test(e)));
p=base(); p.pois[0].seg='mid'; assert.ok(validateTrip(p).errors.some(e=>/seg/.test(e)));
p=base(); p.bookings[0].due='1月1日'; assert.ok(validateTrip(p).errors.some(e=>/due/.test(e)));
p=base(); p.flex={insertBeforeDay:2,doneKey:99,daysCount:2,badge:'D2–3',title:'机动',hint:'h',dateStart:'2026-01-02',dateEnd:'2026-01-03',options:{A:{name:'方案A',short:'A',color:'#fff',anchor:'zzz',note:'',rows:[],know:[]}}};
assert.ok(validateTrip(p).errors.some(e=>/flex.*anchor|anchor.*flex/.test(e)),'flex.anchor 必须在 anchors 里');
p=base(); p.optimize.anchorDays={zzz:[1]}; assert.ok(validateTrip(p).errors.some(e=>/optimize/.test(e)));
console.log('validate.test.js: 全部通过');
