// 修复回归:DeepSeek json_object 模式只产对象,数组批次可能被包壳({points:[...]}),asArr 应剥壳
const assert=require('assert');
const {boot}=require('./boot.js');
const {ctx}=boot(__dirname+'/../行程助手.html',{});
assert.strictEqual(typeof ctx.asArr,'function','asArr 应存在');
assert.strictEqual(JSON.stringify(ctx.asArr({points:[{a:1}]})),'[{"a":1}]','剥壳对象里的数组');
assert.strictEqual(JSON.stringify(ctx.asArr([1,2])),'[1,2]','裸数组原样通过');
assert.strictEqual(JSON.stringify(ctx.asArr({pois:[],note:'x'})),'[]','空数组也应剥出');
console.log('unwrap.test.js: 全部通过');
