// 验收截图：无头 Chrome 打开行程助手.html，预置三峡行程，逐页签截图
const fs=require('fs'),path=require('path');
const puppeteer=require('puppeteer');
(async()=>{
  const root=path.resolve(__dirname,'..');
  const pack=fs.readFileSync(path.join(root,'trips','sanxia.trip.json'),'utf8');
  const outDir=path.join(root,'shots');fs.mkdirSync(outDir,{recursive:true});
  const browser=await puppeteer.launch({headless:'shell'===process.env.SHELL?true:true});
  const page=await browser.newPage();
  await page.setViewport({width:390,height:844,deviceScaleFactor:2});
  await page.evaluateOnNewDocument((p)=>{
    localStorage.setItem('ta-trips',JSON.stringify({sanxia16:JSON.parse(p)}));
    localStorage.setItem('ta-current',JSON.stringify('sanxia16'));
  },pack);
  page.on('pageerror',e=>console.log('PAGEERROR:',e.message));
  page.on('console',m=>{if(m.type()==='error')console.log('CONSOLE-ERR:',m.text().slice(0,200));});
  await page.goto('file:///'+path.join(root,'行程助手.html').replace(/\\/g,'/'),{waitUntil:'networkidle2',timeout:60000});
  await new Promise(r=>setTimeout(r,1500));
  await page.screenshot({path:path.join(outDir,'1-行程.png')});
  // 行程页点开 D2 卡片看内容
  await page.evaluate(()=>{const el=document.getElementById('day2');if(el)el.classList.add('open');});
  await new Promise(r=>setTimeout(r,400));
  await page.screenshot({path:path.join(outDir,'1b-行程-展开D2.png')});
  await page.evaluate(()=>showTab(2));
  await new Promise(r=>setTimeout(r,600));
  await page.screenshot({path:path.join(outDir,'2-文史.png')});
  // 点开黄鹤楼讲解抽屉
  await page.evaluate(()=>openPoi('黄鹤楼'));
  await new Promise(r=>setTimeout(r,600));
  await page.screenshot({path:path.join(outDir,'2b-文史-黄鹤楼.png')});
  await page.evaluate(()=>closePoi());
  await page.evaluate(()=>showTab(3));
  await new Promise(r=>setTimeout(r,4000)); // 等瓦片/道路
  await page.screenshot({path:path.join(outDir,'3-地图.png')});
  await page.evaluate(()=>showTab(4));
  await new Promise(r=>setTimeout(r,1200));
  await page.screenshot({path:path.join(outDir,'4-智能助手.png')});
  console.log('title=',await page.title());
  console.log('hero=',await page.evaluate(()=>document.getElementById('heroTitle')&&document.getElementById('heroTitle').textContent));
  console.log('prog=',await page.evaluate(()=>document.getElementById('progTxt').textContent));
  console.log('done');
  await browser.close();
})().catch(e=>{console.error('FAIL:',e.message);process.exit(1);});
