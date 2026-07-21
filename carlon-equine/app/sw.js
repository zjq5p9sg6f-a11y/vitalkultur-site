/* CARLON Clinic — Service Worker (Offline-First PWA)
   App-Shell wird precached; Fonts & Leaflet lokal gebündelt (assets/) — keine externen CDNs,
   sodass die App nach dem ersten Online-Start vollständig offline läuft.
   Gesundheitsdaten liegen in IndexedDB — der SW cached nur Programm-Assets. */
const VERSION = 'carlon-clinic-v6-beta';
const SHELL = VERSION + '-shell';
const RUNTIME = VERSION + '-runtime';

const CORE = [
  'index.html',
  'landing.html',
  'senden.html',
  'impressum.html',
  'datenschutz.html',
  'seed-data.js',
  'p2p.js',
  'manifest.webmanifest',
  'assets/carlon-logo-soft-512.png',
  'assets/carlon-logo-soft-128.png',
  'assets/icon-192.png',
  'assets/icon-512.png',
  'assets/icon-maskable-512.png',
  'assets/apple-touch-icon.png',
  'assets/fonts/jost-variable.woff2',
  'assets/fonts/inter-variable.woff2',
  'assets/leaflet/leaflet.css',
  'assets/leaflet/leaflet.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(SHELL).then((c) => c.addAll(CORE.map((u) => new Request(u, { cache: 'reload' }))))
      .catch(() => {}) // einzelne fehlende Assets nicht den Install killen lassen
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  // Web Share Target: geteilte Aufnahme (WhatsApp/Mail/Telegram) empfangen → zwischenspeichern → App öffnet & importiert
  if (req.method === 'POST' && new URL(req.url).searchParams.has('shared')) {
    e.respondWith((async () => {
      try {
        const form = await req.formData();
        const files = form.getAll('files');
        const payload = [];
        for (const f of files) { try { payload.push({ name: (f && f.name) || 'aufnahme.json', text: await f.text() }); } catch (_) {} }
        const cache = await caches.open('carlon-shared');
        await cache.put('/__shared__', new Response(JSON.stringify(payload), { headers: { 'Content-Type': 'application/json' } }));
      } catch (_) {}
      return Response.redirect('index.html?shared=1', 303);
    })());
    return;
  }
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Kartenkacheln nie cachen (zu groß, optional) — direkt Netz, still scheitern lassen
  if (/basemaps\.cartocdn\.com|tile\./.test(url.hostname)) return;

  // Lizenz-/API-Requests nie cachen (immer live)
  if (/api\.lemonsqueezy\.com|nominatim\.openstreetmap\.org/.test(url.hostname)) return;

  // Navigationsanfragen: App-Shell zuerst, Fallback auf gecachtes index.html (Offline)
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).catch(() => caches.match(req).then((r) => r || caches.match('index.html')))
    );
    return;
  }

  // Externe Bibliotheken (Fonts, Leaflet, unpkg): stale-while-revalidate
  if (url.origin !== self.location.origin) {
    e.respondWith(
      caches.open(RUNTIME).then((cache) =>
        cache.match(req).then((cached) => {
          const network = fetch(req).then((res) => {
            if (res && res.status === 200) cache.put(req, res.clone());
            return res;
          }).catch(() => cached);
          return cached || network;
        })
      )
    );
    return;
  }

  // Eigene Assets: cache-first, dann Netz (und nachladen)
  e.respondWith(
    caches.match(req).then((cached) =>
      cached ||
      fetch(req).then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => cached)
    )
  );
});
