/*
  CHANGELOG
  - Mantiene manifest e icono en sus rutas originales para instalaciones React.
  - Caché exclusivo por ruta de aplicación: no se borran cachés de otros sitios.
  - Precarga completa de HTML, estilos, script, manifest e ícono.
  - Las versiones nuevas se activan cuando el usuario confirma la actualización.
*/
const RUTA_APP = new URL(self.registration.scope).pathname;
const PREFIJO_CACHE = `asado-pro:${RUTA_APP}:`;
const CACHE_NAME = `${PREFIJO_CACHE}v9`;
const ARCHIVOS_CACHE = [
  './', './index.html', './style.css', './script.js',
  './manifest.json', './icon.svg', './public/manifest.json', './public/icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ARCHIVOS_CACHE)));
});

self.addEventListener('message', (event) => {
  if (event.data?.tipo === 'ACTIVAR_ACTUALIZACION') event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith(PREFIJO_CACHE)
        && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin
    || !url.pathname.startsWith(RUTA_APP)) return;

  // Una sola caché de versión evita mezclar archivos viejos y nuevos al estar offline.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cacheado = await cache.match(event.request, { ignoreSearch: true });
    if (cacheado) return cacheado;
    try {
      return await fetch(event.request);
    } catch {
      if (event.request.mode === 'navigate') {
        const inicio = await cache.match('./index.html');
        if (inicio) return inicio;
      }
      return Response.error();
    }
  })());
});
