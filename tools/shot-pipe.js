// M3 收官验收:无头 Chrome 全程 mock 跑行前规划流水线,逐步截图 + 关键词断言
// 用法: NODE_PATH=D:/npm-global/node_modules node tools/shot-pipe.js
// 截图存 shots/pipe/(git 已 ignore)。任一步断言失败即非零退出。
const fs=require('fs'),path=require('path');
const puppeteer=require('puppeteer');
(async()=>{
  const root=path.resolve(__dirname,'..');
  const FIXT=JSON.parse(fs.readFileSync(path.join(root,'test/fixtures/pipe-responses.json'),'utf8'));
  const sanxiaRaw=fs.readFileSync(path.join(root,'trips/sanxia.trip.json'),'utf8');
  const sanxiaId=JSON.parse(sanxiaRaw).meta.id;          // sanxia16,便于最后对比新旧行程
  const NEW_TITLE=FIXT.skeleton.meta.title;              // 入库包标题取自骨架罐头(金陵润州三日)
  const outDir=path.join(root,'shots','pipe');fs.mkdirSync(outDir,{recursive:true});
  const shots=[];
  let fails=0;
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const browser=await puppeteer.launch({headless:true});
  const page=await browser.newPage();
  await page.setViewport({width:390,height:844,deviceScaleFactor:2});
  page.on('pageerror',e=>console.log('PAGEERROR:',e.message));
  page.on('console',m=>{if(m.type()==='error')console.log('CONSOLE-ERR:',m.text().slice(0,200));});
  page.on('dialog',async d=>{console.log('DIALOG:',d.message());await d.dismiss();});

  // 每个新文档(含 finishPlanner 后的 reload)都要重做两件事:
  // (a) 预置 localStorage:ta-trips 合并放入三峡包(不覆盖规划器入库的产物),放假 key;不动 ta-current/ta-planner
  // (b) mock fetch:deepseek 按 userPrompt 关键词回罐头(映射照抄 test/pipeline.test.js 的 mockFetch);
  //     nominatim 按 q 回罐头坐标;其余 url(高德瓦片/OSRM/Leaflet/天气)走原始 fetch 真网络
  await page.evaluateOnNewDocument(function(fixt,packRaw,packId){
    try{
      var trips={};try{trips=JSON.parse(localStorage.getItem('ta-trips')||'{}');}catch(e){}
      trips[packId]=JSON.parse(packRaw);
      localStorage.setItem('ta-trips',JSON.stringify(trips));
      if(!localStorage.getItem('ta-ds-key'))localStorage.setItem('ta-ds-key',JSON.stringify('test-key'));
    }catch(e){}
    var ofetch=window.fetch.bind(window);
    window.fetch=function(url,opts){
      url=String(url);
      if(url.indexOf('nominatim')>=0){
        var m=url.match(/[?&]q=([^&]*)/);
        var q=m?decodeURIComponent(m[1].replace(/\+/g,' ')):'';
        var hit=(fixt.nominatim&&Object.prototype.hasOwnProperty.call(fixt.nominatim,q))?fixt.nominatim[q]:[];
        return Promise.resolve({ok:true,status:200,json:function(){return Promise.resolve(hit);}});
      }
      if(url.indexOf('deepseek')>=0){
        var up='';
        try{up=JSON.parse(opts.body).messages[1].content;}catch(e){}
        var key=null;
        if(/复核/.test(up))key='verify1';
        else if(/骨架|动线草案/.test(up))key='skeleton';
        else if(/修改意见/.test(up))key='skeletonV2';
        // 批次(顺序即优先级,各批 prompt 只含自己的关键词)
        else if(/补充点/.test(up))key='radar1';
        else if(/讲解/.test(up))key='detail1';
        else if(/点位/.test(up))key='pois1';
        else if(/预约/.test(up))key='bookings1';
        else if(/天气城市/.test(up))key='wx1';
        else if(/路段/.test(up))key='leginfo1';
        var payload=(key&&fixt[key])?JSON.stringify(fixt[key]):'{}';
        return Promise.resolve({ok:true,status:200,json:function(){return Promise.resolve({choices:[{message:{content:payload}}]});}});
      }
      return ofetch(url,opts);
    };
  },FIXT,sanxiaRaw,sanxiaId);

  const bodyHas=t=>page.evaluate(s=>document.body.innerHTML.includes(s),t);
  async function expect(label,t){
    const ok=await bodyHas(t);
    console.log('  '+(ok?'✓':'✗')+' '+label+' 断言「'+t+'」'+(ok?'':'未命中'));
    if(!ok)fails++;
  }
  async function waitFor(t,ms){
    await page.waitForFunction(s=>document.body&&document.body.innerHTML.includes(s),{timeout:ms||30000,polling:100},t);
  }
  async function shot(name){
    const p=path.join(outDir,name);
    await page.screenshot({path:p});
    shots.push(p);
  }
  // 点页面上文本完全匹配的第一个 button
  async function clickBtn(text){
    const ok=await page.evaluate(t=>{
      const b=[].slice.call(document.querySelectorAll('button')).filter(x=>x.textContent===t)[0];
      if(b){b.click();return true;}return false;
    },text);
    if(!ok)throw new Error('找不到按钮:「'+text+'」');
  }

  await page.goto('file:///'+path.join(root,'行程助手.html').replace(/\\/g,'/'),{waitUntil:'networkidle2',timeout:60000});
  await page.evaluate(()=>{window.NOMI_DELAY=0;});   // 跳过 Nominatim 礼仪间隔(var 全局,驱动阶段直接改写)

  // ---- p0:picker 首页 ----
  await sleep(800);
  await expect('p0 picker','新建行程');
  await expect('p0 已有三峡行程','诗路长江');
  await shot('p0-picker.png');
  console.log('p0: picker 首页已截图(新建行程按钮可见)');

  // ---- p1:step0 需求表单 ----
  await clickBtn('新建行程');
  await page.waitForFunction(()=>!!document.getElementById('wizTitle'),{timeout:10000,polling:100});
  await page.evaluate(()=>{
    const set=(id,v)=>{document.getElementById(id).value=v;};
    set('wizTitle','南京三日');set('wizFrom','南京');set('wizTo','扬州,镇江');
    set('wizDays','3');set('wizStart','2026-10-01');set('wizAge','11');set('wizTheme','历史');
  });
  const filled=await page.evaluate(()=>document.getElementById('wizTitle').value+'|'+document.getElementById('wizFrom').value+'|'+document.getElementById('wizTo').value+'|'+document.getElementById('wizDays').value);
  console.log('  '+(filled==='南京三日|南京|扬州,镇江|3'?'✓':'✗')+' p1 表单已填:'+filled);
  if(filled!=='南京三日|南京|扬州,镇江|3')fails++;
  await expect('p1 step0','第 1 步');
  await sleep(400);
  await shot('p1-step0-form.png');
  console.log('p1: step0 需求表单已截图');

  // ---- p2:提交 → 生成骨架 → step1 骨架对稿 ----
  await clickBtn('生成行程骨架');       // wizCollect → wizSubmit → step1(骨架未生成)
  await page.waitForFunction(()=>!![].slice.call(document.querySelectorAll('button')).filter(x=>x.textContent==='生成骨架')[0],{timeout:10000,polling:100});
  await clickBtn('生成骨架');           // genSkeleton → mock 罐头 skeleton
  await waitFor('确认骨架,开始烘焙');
  await expect('p2 骨架对稿','骨架对稿');
  await expect('p2 骨架 D1','D1');
  await sleep(400);
  await shot('p2-step1-skeleton.png');
  console.log('p2: step1 骨架对稿页已截图');

  // ---- p3:确认骨架 → step2 烘焙全部 ✅ ----
  // 全 ✅ 之后 bakeNext 会立刻自动进 startVerify,截图抓不住;先把 startVerify 挂起,截完全 ✅ 再放行
  await page.evaluate(()=>{
    window.__origStartVerify=startVerify;
    startVerify=function(){window.__verifyDeferred=true;};
  });
  await clickBtn('确认骨架,开始烘焙');  // startBake → 6 批(flex 因 needFlex=false 跳过)
  await page.waitForFunction(()=>window.__verifyDeferred===true,{timeout:60000,polling:100});
  const ticks=await page.evaluate(()=>(document.body.innerHTML.match(/✅/g)||[]).length);
  const cross=await bodyHas('❌');
  console.log('  '+(ticks===6&&!cross?'✓':'✗')+' p3 烘焙批次 ✅x'+ticks+(cross?' 出现 ❌':''));
  if(ticks!==6||cross)fails++;
  await expect('p3 烘焙页','分批烘焙');
  await shot('p3-step2-bake.png');
  console.log('p3: step2 烘焙进度页(全部 ✅)已截图');

  // ---- p4:放行 startVerify → step3 三档验证报告 ----
  await page.evaluate(()=>{startVerify=window.__origStartVerify;startVerify();});
  await waitFor('待确认');
  await expect('p4 通过档','✅ 通过');
  await expect('p4 纠偏档','🔧 已纠偏');
  await expect('p4 待确认档','⚠️ 待确认');
  await expect('p4 坏点','西津渡古街');
  await sleep(400);
  await shot('p4-step3-verify.png');
  console.log('p4: step3 三档验证报告页已截图');

  // ---- p5:丢弃坏点 → 完成入库 → reload 进新行程页 ----
  const dropped=await page.evaluate(()=>{
    const b=[].slice.call(document.querySelectorAll('button[data-n="西津渡古街"]')).filter(x=>x.textContent==='丢弃')[0];
    if(b){b.click();return true;}return false;
  });
  if(!dropped){console.log('  ✗ 找不到西津渡古街的「丢弃」按钮');fails++;}
  await waitFor('完成,加入行程库');
  console.log('p5: 西津渡古街已丢弃,完成按钮亮起');
  const nav=page.waitForNavigation({waitUntil:'networkidle2',timeout:60000});
  await clickBtn('完成,加入行程库');    // finishPlanner → location.reload()
  await nav;
  await page.waitForFunction(t=>{
    const el=document.getElementById('heroTitle');return el&&el.textContent===t;
  },{timeout:30000,polling:100},NEW_TITLE);
  await sleep(1500);                    // 等行程页渲染(天气/道路走真网络,有容错不阻塞)
  const st=await page.evaluate(()=>({
    planner:localStorage.getItem('ta-planner'),
    cur:JSON.parse(localStorage.getItem('ta-current')||'null'),
    trips:Object.keys(JSON.parse(localStorage.getItem('ta-trips')||'{}')),
    hero:document.getElementById('heroTitle').textContent
  }));
  const storeOk=st.planner===null&&/^t\d+$/.test(st.cur)&&st.trips.indexOf(sanxiaId)>=0&&st.trips.indexOf(st.cur)>=0;
  console.log('  '+(st.hero===NEW_TITLE?'✓':'✗')+' p5 新行程标题「'+st.hero+'」');
  console.log('  '+(storeOk?'✓':'✗')+' p5 入库:ta-current='+st.cur+',ta-trips=['+st.trips.join(',')+'],ta-planner 已清除');
  if(st.hero!==NEW_TITLE)fails++;
  if(!storeOk)fails++;
  await shot('p5-trip-page.png');
  console.log('p5: 新行程行程页已截图');

  await browser.close();
  console.log('---');
  shots.forEach(p=>console.log('SHOT: '+p));
  if(fails){console.log('PIPE-SHOT FAIL ('+fails+' 处断言未过)');process.exit(1);}
  console.log('PIPE-SHOT OK');
})().catch(e=>{console.error('FAIL:',e.message);process.exit(1);});
