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
