const C='lucky-note-v15-shell';
const A=['./','./index.html','./app.js','./edit-transactions.js','./firebase-config.js','./manifest.json','./rose-icon.svg'];
self.addEventListener('install',e=>e.waitUntil(caches.open(C).then(c=>c.addAll(A)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET') return;
  const url=new URL(e.request.url);
  if(url.origin===location.origin && url.pathname.endsWith('/lucky-note/app.js')){
    e.respondWith(fetch(e.request,{cache:'no-store'}).then(async r=>{
      const code=await r.text();
      return new Response(code+"\nimport './edit-transactions.js';\n",{headers:{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store'}});
    }).catch(()=>caches.match(e.request)));
    return;
  }
  e.respondWith(fetch(e.request,{cache:'no-store'}).then(r=>{const copy=r.clone();caches.open(C).then(c=>c.put(e.request,copy));return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html'))));
});
