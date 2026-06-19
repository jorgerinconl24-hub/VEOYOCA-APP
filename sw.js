// sw.js — VeoYoca v6
// Este service worker se desinstala solo para evitar problemas de cache
self.addEventListener('install', function(e) {
  self.skipWaiting();
});
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.map(function(k) { return caches.delete(k); }));
    }).then(function() {
      return self.clients.claim();
    }).then(function() {
      // Notificar a todos los clientes que recarguen
      return self.clients.matchAll().then(function(clients) {
        clients.forEach(function(client) {
          client.postMessage({type: 'RELOAD'});
        });
      });
    })
  );
});
self.addEventListener('fetch', function(e) {
  // Sin cache — siempre ir a la red
  e.respondWith(fetch(e.request));
});
