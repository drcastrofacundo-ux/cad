'use strict';

// Service worker del Protocolo de Crisis Hiperglucemicas.
//
// Estrategia: red primero, cache como respaldo. Es deliberado y no hay que
// invertirlo: esto calcula dosis de insulina. Bajo cache-first, una correccion
// publicada puede tardar en llegar mientras alguien sigue prescribiendo con la
// version vieja. Con senal siempre gana la version vigente; sin senal, la
// ultima guardada.
//
// Al cambiar VERSION se invalida el cache anterior. Tiene que coincidir con el
// sello que muestran las pantallas; tests/pwa.test.js falla si se desincronizan.

var VERSION = '2026.09.04';
var CACHE = 'cad-ehh-v' + VERSION;

// Rutas relativas a proposito: asi la app anda igual servida desde la raiz de un
// dominio que desde un subdirectorio, y tambien abierta por file:// desde el
// disco, que es como se uso hasta ahora.
var FILES = [
  './',
  './index.html',
  './ingreso.html',
  './enfermeria.html',
  './transicion.html',
  './manifest.json',
  './registrar-sw.js',
  './icon-192.png',
  './icon-512.png',
  './iconos/icono-180.png',
  './iconos/icono-512-maskable.png',
  './iconos/favicon-32.png',
  // La portada lo ofrece como "22 paginas en PDF". Sin precargarlo, el enlace
  // muere justo cuando mas hace falta: sin senal, al lado de la cama.
  './protocolo.pdf',
];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) {
    // De a uno: un archivo caido no debe dejar la app entera sin cache.
    return Promise.all(FILES.map(function (url) {
      return c.add(url).catch(function () {
        console.warn('[sw] no se pudo precargar ' + url);
      });
    }));
  }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.map(function (k) {
      if (k.indexOf('cad-ehh-') === 0 && k !== CACHE) return caches.delete(k);
      return null;
    }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(function (res) {
      if (res && res.status === 200 && res.type === 'basic') {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(e.request).then(function (hit) {
        if (hit) return hit;
        return caches.match('./index.html');
      });
    })
  );
});

self.addEventListener('message', function (e) {
  if (e.data === 'version' && e.source) e.source.postMessage({ version: VERSION });
});
