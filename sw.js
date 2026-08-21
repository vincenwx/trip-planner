var C='ta-v1';
var SHELL=['./','./index.html','./行程助手.html','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install',function(e){e.waitUntil(caches.open(C).then(function(c){return c.addAll(SHELL);}).then(function(){return self.skipWaiting();}));});
self.addEventListener('activate',function(e){e.waitUntil(self.clients.claim());});
self.addEventListener('fetch',function(e){
 if(e.request.method!=='GET')return;
 var u=new URL(e.request.url);
 if(u.origin!==self.location.origin)return;   // 跨域(瓦片/OSRM/天气/DeepSeek)不碰
 e.respondWith(caches.match(e.request).then(function(hit){
  return hit||fetch(e.request).then(function(r){
   var cp=r.clone();caches.open(C).then(function(c){c.put(e.request,cp);});
   return r;
  });
 }));
});
