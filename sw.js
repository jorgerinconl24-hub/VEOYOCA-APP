// ═══════════════════════════════════════════════════════════
// VEOYOCA — SERVICE WORKER UNIFICADO
// Linea 1: motor de push de OneSignal (OBLIGATORIO de primero).
// Debajo: cache, alarmas locales y clicks de VeoYoca.
// ═══════════════════════════════════════════════════════════
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");


// ───────────────────────────────────────────────────────────
// CACHE
// Sube este numero cada vez que cambies un archivo de la lista.
// Ese bump es lo que obliga al navegador a bajar la version nueva.
// ───────────────────────────────────────────────────────────
var CACHE_NAME = 'veoyoca-v14';

var BASE = '/VEOYOCA-APP/';

// Archivos que la app necesita para abrir sin señal.
// Agrega aqui cualquier .html nuevo que subas al repo.
var ARCHIVOS = [
  BASE,
  BASE + 'index.html',
  BASE + 'conteo.html',
  BASE + 'planificador.html',
  BASE + 'manifest.json'
];

// Instalar el service worker
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      // addAll falla entero si UN archivo no existe.
      // Por eso se cachean de a uno: si falta el icono, el resto igual entra.
      return Promise.all(ARCHIVOS.map(function(url) {
        return cache.add(url).catch(function(err) {
          console.warn('[SW] No se pudo cachear:', url, err);
        });
      }));
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(nombres) {
      // Borrar caches de versiones viejas
      return Promise.all(nombres.map(function(n) {
        if (n !== CACHE_NAME) return caches.delete(n);
      }));
    }).then(function() {
      return clients.claim();
    })
  );
});

// ───────────────────────────────────────────────────────────
// FETCH — estrategia: red primero, cache de respaldo
//
// Con señal: siempre trae la version fresca del servidor.
// Sin señal: sirve la ultima copia guardada.
//
// Solo aplica a los archivos propios de la app. Firestore,
// OneSignal, Cloudinary y demas APIs pasan directo a la red;
// Firestore ya maneja su propio cache offline internamente.
// ───────────────────────────────────────────────────────────
self.addEventListener('fetch', function(e) {
  var req = e.request;

  // Solo GET
  if (req.method !== 'GET') return;

  var url = new URL(req.url);

  // Solo archivos de este mismo origen y dentro de /VEOYOCA-APP/
  if (url.origin !== self.location.origin) return;
  if (url.pathname.indexOf(BASE) !== 0) return;

  e.respondWith(
    fetch(req).then(function(resp) {
      // Guardar copia fresca para la proxima vez que no haya señal
      if (resp && resp.status === 200 && resp.type === 'basic') {
        var copia = resp.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(req, copia);
        });
      }
      return resp;
    }).catch(function() {
      // Sin red — buscar en cache
      return caches.match(req).then(function(guardado) {
        if (guardado) return guardado;
        // Navegacion a una ruta no cacheada: devolver el index
        if (req.mode === 'navigate') return caches.match(BASE + 'index.html');
        return new Response('Sin conexión y sin copia guardada.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      });
    })
  );
});

// Recibir mensajes desde la app
self.addEventListener('message', function(e) {
  var data = e.data;
  if (!data || !data.tipo) return;

  if (data.tipo === 'ALARMA_DIARIA') {
    programarAlarmaDiaria(data.hora || '08:45');
  }
  if (data.tipo === 'NOTIFICAR') {
    mostrarNotificacion(data.titulo, data.cuerpo, data.tag || 'veoyoca');
  }
});

// Mostrar notificación
function mostrarNotificacion(titulo, cuerpo, tag) {
  return self.registration.showNotification(titulo, {
    body:    cuerpo,
    icon:    '/VEOYOCA-APP/icon-192.png',
    badge:   '/VEOYOCA-APP/icon-192.png',
    tag:     tag,
    requireInteraction: true,
    vibrate: [200, 100, 200],
    data:    { url: '/VEOYOCA-APP/' }
  });
}

// Programar alarma diaria
function programarAlarmaDiaria(horaStr) {
  var partes = horaStr.split(':');
  var horas  = parseInt(partes[0]);
  var mins   = parseInt(partes[1]);

  var ahora  = new Date();
  var alarma = new Date();
  alarma.setHours(horas, mins, 0, 0);

  // Si ya pasó la hora hoy, programar para mañana
  if (alarma <= ahora) {
    alarma.setDate(alarma.getDate() + 1);
  }

  var ms = alarma.getTime() - ahora.getTime();

  setTimeout(function() {
    mostrarNotificacion(
      '🚨 VeoYoca — Reporte diario',
      'Revisa los pedidos vencidos y urgentes de hoy',
      'alarma-diaria'
    );
    // Reprogramar para mañana
    programarAlarmaDiaria(horaStr);
  }, ms);
}

// Click en la notificación
self.addEventListener('notificationclick', function(e) {
  e.notification.close();
  var tag = e.notification.tag || '';
  var tab = tag.indexOf('entregado') >= 0 ? 'reportes' : 'home';

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(lista) {
      // Guardar en todos los clientes abiertos
      lista.forEach(function(c) {
        c.postMessage({ tipo: 'IR_TAB', tab: tab });
      });
      if (lista.length > 0) {
        return lista[0].focus();
      }
      // App cerrada — abrir y el index.html leerá veo_goto al iniciar
      return self.clients.openWindow('https://jorgerinconl24-hub.github.io/VEOYOCA-APP/');
    })
  );
});
