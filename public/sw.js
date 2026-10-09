/* All build chunks, including the fixed historical field, are cached for offline use. */
const base=new URL('./',self.location.href).pathname;
const CACHE='__WETTERWARTE_SHELL__';
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE),r=await fetch(base+'.vite/manifest.json'),manifest=await r.json();
 const files=new Set([base,base+'favicon.svg',base+'SUNCALC-LICENSE.txt']);
 for(const entry of Object.values(manifest)){files.add(base+entry.file);for(const path of entry.css??[])files.add(base+path);for(const path of entry.assets??[])files.add(base+path);}
 await cache.addAll([...files]);self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const name of await caches.keys())if(name.startsWith('wetterwarte-shell-')&&name!==CACHE)await caches.delete(name);await self.clients.claim();})()));
self.addEventListener('fetch',event=>{if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;event.respondWith(fetch(event.request).catch(async()=>await caches.match(event.request)||(event.request.mode==='navigate'?await caches.match(base):undefined)||Response.error()));});
