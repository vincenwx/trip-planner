// PWA 图标生成：无头 Chrome 打开 data: URL 页面（圆角方块底 #2f6f5e + 白色"行"字），clip 截图 512/192
const fs=require('fs'),path=require('path');
const puppeteer=require('puppeteer');
function iconUrl(size){
  const html='<!DOCTYPE html><html><head><meta charset="utf-8"><style>'
    +'html,body{margin:0;padding:0;background:transparent;}'
    +'.icon{width:'+size+'px;height:'+size+'px;background:#2f6f5e;border-radius:'+Math.round(size*0.22)+'px;'
    +'display:flex;align-items:center;justify-content:center;}'
    +'.icon span{color:#fff;font-family:"Songti SC","STSong","SimSun",serif;font-weight:700;'
    +'font-size:'+Math.round(size*0.52)+'px;line-height:1;}'
    +'</style></head><body><div class="icon"><span>行</span></div></body></html>';
  return 'data:text/html;charset=utf-8,'+encodeURIComponent(html);
}
(async()=>{
  const root=path.resolve(__dirname,'..');
  const outDir=path.join(root,'icons');fs.mkdirSync(outDir,{recursive:true});
  const browser=await puppeteer.launch({headless:true});
  const page=await browser.newPage();
  for(const size of [512,192]){
    await page.setViewport({width:size,height:size,deviceScaleFactor:1});
    await page.goto(iconUrl(size));
    await page.screenshot({path:path.join(outDir,'icon-'+size+'.png'),clip:{x:0,y:0,width:size,height:size},omitBackground:true});
    console.log('icons/icon-'+size+'.png 生成');
  }
  await browser.close();
})().catch(e=>{console.error('FAIL:',e.message);process.exit(1);});
