var CACHE = 'cad-ehh-v0-4';
var FILES = ['./','./index.html','./ingreso.html','./enfermeria.html','./manifest.json'];

self.addEventListener('install', function(e){
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(FILES).catch(function(){}); }));
});

self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(ks){
    return Promise.all(ks.map(function(k){ if(k!==CACHE) return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});

// Red primero, cache como respaldo: garantiza que el contenido publicado
// se actualice sin que el usuario tenga que reinstalar la aplicacion.
self.addEventListener('fetch', function(e){
  if(e.request.method!=='GET') return;
  e.respondWith(
    fetch(e.request).then(function(res){
      if(res && res.status===200 && res.type==='basic'){
        var copy=res.clone();
        caches.open(CACHE).then(function(c){ c.put(e.request, copy); });
      }
      return res;
    }).catch(function(){
      return caches.match(e.request).then(function(hit){
        if(hit) return hit;
        return caches.match('./index.html');
      });
    })
  );
});
