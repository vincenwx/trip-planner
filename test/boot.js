const fs=require('fs'),vm=require('vm');
function mkEl(){return {innerHTML:'',textContent:'',value:'',style:{},dataset:{},disabled:false,
 className:'',classList:{_s:new Set(),add(c){this._s.add(c)},remove(c){this._s.delete(c)},toggle(c,f){f?this._s.add(c):this._s.delete(c)},contains(c){return this._s.has(c)}},
 addEventListener(){},appendChild(){},setAttribute(){},getAttribute(){return null},querySelectorAll(){return[]},scrollIntoView(){},openPopup(){return this},bindPopup(){return this}};}
function boot(htmlPath,seed){
  const els={};const store=Object.assign({},seed||{});
  const document={getElementById(id){return els[id]||(els[id]=mkEl())},querySelectorAll(){return[]},createElement(){return mkEl()},body:mkEl(),_els:els};
  const localStorage={_d:store,getItem(k){return k in this._d?this._d[k]:null},setItem(k,v){this._d[k]=String(v)},removeItem(k){delete this._d[k]}};
  const ctx={window:{},document,localStorage,navigator:{},console,
    fetch:()=>Promise.reject(new Error('offline')),
    setTimeout:(f)=>{try{f()}catch(e){console.error(e)}return 0},
    Date,JSON,Math,Object,Array,String,Number,RegExp,Error,Promise};
  ctx.window=ctx;ctx.globalThis=ctx;
  vm.createContext(ctx);
  const html=fs.readFileSync(htmlPath,'utf8');
  const m=html.match(/<script>([\s\S]*?)<\/script>/);           // 唯一的内联脚本块
  vm.runInContext(m[1],ctx,{filename:'inline.js'});
  return {ctx,document,localStorage};
}
module.exports={boot};
