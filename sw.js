/* Service worker Controvento - offline + installazione PWA */
const CACHE = 'controvento-v3';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon192.png',
  './icon512.png'
];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }).catch(function () {})
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  // La pagina e il manifest: prima la rete (aggiornamenti immediati), poi la cache se offline
  if (req.mode === 'navigate' || req.url.indexOf('manifest.webmanifest') !== -1) {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () {
        return caches.match(req).then(function (r) {
          return r || caches.match('./index.html') || caches.match('./');
        });
      })
    );
    return;
  }

  // Gli altri file: prima la cache, poi la rete
  e.respondWith(
    caches.match(req).then(function (cached) {
      return cached || fetch(req).then(function (res) {
        if (res && res.status === 200 && res.type === 'basic') {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return cached; });
    })
  );
});
