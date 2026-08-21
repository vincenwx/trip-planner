// M4-T2 PWA 离线壳：manifest/sw/head 注册/图标产物 断言
const assert=require('assert');
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');

// manifest 合法 JSON 且含 start_url/icons
const mf=JSON.parse(read('manifest.webmanifest'));
assert.ok(mf.start_url==='./行程助手.html','manifest.start_url 应指向行程助手.html');
assert.ok(Array.isArray(mf.icons)&&mf.icons.length>=2,'manifest.icons 至少两张');
assert.ok(mf.icons.some(i=>i.src==='icons/icon-192.png')&&mf.icons.some(i=>i.src==='icons/icon-512.png'),'icons 含 192/512');
assert.ok(mf.display==='standalone','display 应为 standalone');

// sw.js 含 SHELL 列表与 fetch 监听
const sw=read('sw.js');
assert.ok(/var SHELL=\[/.test(sw),'sw.js 应有 SHELL 列表');
assert.ok(sw.includes('./行程助手.html')&&sw.includes('./manifest.webmanifest')&&sw.includes('./icons/icon-192.png')&&sw.includes('./icons/icon-512.png'),'SHELL 应含壳文件与图标');
assert.ok(/addEventListener\('fetch'/.test(sw),'sw.js 应监听 fetch');
assert.ok(/addEventListener\('install'/.test(sw),'sw.js 应监听 install');
assert.ok(sw.includes('u.origin!==self.location.origin'),'跨域请求不应被缓存');

// HTML 含 manifest link 与带 protocol 守卫的 sw 注册(file:// 不注册)
const html=read('行程助手.html');
assert.ok(html.includes('<link rel="manifest" href="manifest.webmanifest">'),'head 应有 manifest link');
assert.ok(html.includes('<meta name="theme-color" content="#2f6f5e">'),'head 应有 theme-color');
assert.ok(html.includes('<link rel="apple-touch-icon" href="icons/icon-192.png">'),'head 应有 apple-touch-icon');
assert.ok(html.includes("navigator.serviceWorker.register('sw.js')"),'应注册 sw.js');
assert.ok(/serviceWorker' in navigator&&\(location\.protocol==='https:'\|\|location\.hostname==='localhost'\)/.test(html),'注册应有 protocol 守卫(file:// 不注册)');

// 两张 PNG 存在且各 >1KB
['icons/icon-192.png','icons/icon-512.png'].forEach(f=>{
  const st=fs.statSync(path.join(root,f));
  assert.ok(st.size>1024,f+' 应大于 1KB,实际 '+st.size);
});

console.log('pwa.test.js: 全部通过');
