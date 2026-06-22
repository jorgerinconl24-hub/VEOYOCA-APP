// ═══════════════════════════════════════════════════════════
// VEOYOCA — SERVICE WORKER
// Maneja notificaciones push aunque la app esté cerrada
// ═══════════════════════════════════════════════════════════

var CACHE_NAME = 'veoyoca-v1';

// Instalar el service worker
self.addEventListener('install', function(e) {
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(clients.claim());
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

// Guardar destino en cache para cuando la app abra desde cero
self.addEventListener('notificationclick', function(e){}, true);
