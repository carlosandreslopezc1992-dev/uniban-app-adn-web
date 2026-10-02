/**
 * sw.js — Service worker: permite instalar la app y abrirla aunque falle la señal.
 * Estrategia "primero la red": siempre intenta traer la versión más nueva y,
 * solo si no hay conexión, usa la copia guardada. Así los cambios que
 * publiquemos se ven de inmediato.
 * Las llamadas al servidor (POST a Apps Script) no pasan por aquí.
 */
const CACHE = 'adn-v0.2.0';
const ARCHIVOS = [
  './', 'index.html', 'css/estilos.css', 'js/config.js', 'js/api.js', 'js/app.js',
  'manifest.json', 'img/logo-uniban-blanco.png', 'img/icono-192.png', 'img/icono-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(llaves => Promise.all(llaves.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then(r => { const copia = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); return r; })
      .catch(() => caches.match(e.request))
  );
});
