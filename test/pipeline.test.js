// mock fetch：按 deepseek 请求体里的 userPrompt 内容分stage返回罐头 JSON
const assert=require('assert'),fs=require('fs');
const {boot}=require('./boot.js');
const FIXT=JSON.parse(fs.readFileSync(__dirname+'/fixtures/pipe-responses.json','utf8'));
function mockFetch(){
  const calls=[];
  return {calls,fetch:function(url,opts){
    calls.push(url);
    if(url.indexOf('deepseek')>=0){
      const body=JSON.parse(opts.body);const up=body.messages[1].content;
      let key=null;
      if(/骨架|动线草案/.test(up))key='skeleton';
      else if(/修改意见/.test(up))key='skeletonV2';
      // Task 2/3 的 key 后续任务补
      if(key&&FIXT[key])return Promise.resolve({ok:true,json:()=>Promise.resolve({choices:[{message:{content:JSON.stringify(FIXT[key])}}]})});
      return Promise.resolve({ok:true,json:()=>Promise.resolve({choices:[{message:{content:'{}'}}]})});
    }
    return Promise.reject(new Error('offline:'+url));
  }};
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
  });
}).catch(function(e){console.error(e);process.exit(1);});
