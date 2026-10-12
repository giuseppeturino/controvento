/* Service worker Controvento - installazione PWA + funzionamento OFFLINE (anche creazione PDF) */
const CACHE = 'controvento-v4';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon192.png',
  './icon512.png',
  './appletouchicon.png'
];
// librerie esterne necessarie per creare i PDF e per i caratteri: le salvo la prima volta che ci si collega
const ESTERNI = [
  'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'
];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      var lavori = ASSETS.map(function (u) { return c.add(u).catch(function () {}); });
      ESTERNI.forEach(function (u) {
        lavori.push(fetch(new Request(u, { mode: 'no-cors' })).then(function (r) { return c.put(u, r); }).catch(function () {}));
      });
      return Promise.all(lavori);
    })
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
  var url = new URL(req.url);

  // La pagina e il manifest: prima la rete (gli aggiornamenti arrivano subito), poi la cache se sei offline
  if (req.mode === 'navigate' || url.pathname.indexOf('manifest.webmanifest') !== -1) {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req.mode === 'navigate' ? './index.html' : req, copy); });
        return res;
      }).catch(function () {
        return caches.match(req.mode === 'navigate' ? './index.html' : req).then(function (r) {
          return r || caches.match('./index.html') || caches.match('./');
        });
      })
    );
    return;
  }

  // File di altri siti (html2pdf, caratteri): dalla cache se ci sono, altrimenti rete e li salvo
  if (url.origin !== self.location.origin) {
    e.respondWith(
      caches.match(req).then(function (cached) {
        if (cached) return cached;
        return fetch(req).then(function (res) {
          if (res && (res.ok || res.type === 'opaque')) {
            var copy = res.clone();
            caches.open(CACHE).then(function (c) { c.put(req, copy); });
          }
          return res;
        });
      })
    );
    return;
  }

  // Gli altri file del sito: prima la cache, poi la rete
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
