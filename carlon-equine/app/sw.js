/* CARLON Clinic — Service Worker (Offline-First PWA)
   App-Shell wird precached; Fonts & Leaflet lokal gebündelt (assets/) — keine externen CDNs,
   sodass die App nach dem ersten Online-Start vollständig offline läuft.
   Gesundheitsdaten liegen in IndexedDB — der SW cached nur Programm-Assets. */
const VERSION = 'carlon-clinic-v33-anfordern';
/* ACHTUNG: JEDE Datei in CORE wird ausgeliefert, bis VERSION sich aendert.
   Zweimal in dieser Nacht passiert — einmal beim Livegang-Schalter, einmal bei
   krypto.js: Datei geaendert, Version vergessen, und der Browser lieferte
   stundenlang den alten Stand aus, ohne dass irgendwo ein Fehler auftauchte.
   Wer hier eine Datei anfasst, zaehlt VERSION hoch. Ohne Ausnahme. */
const SHELL = VERSION + '-shell';
const RUNTIME = VERSION + '-runtime';

const CORE = [
  'krypto.js',
  'index.html',
  'landing.html',
  'senden.html',
  'messen.html',
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

  // Live-Requests nie cachen. Die Lizenzpruefung braucht hier keinen Eintrag mehr:
  // sie laeuft rein offline (ECDSA, kein Netz), und der Stripe-Checkout liegt auf
  // einem fremden Origin in einem neuen Tab — der geht ohnehin nicht durch diesen SW.
  if (/nominatim\.openstreetmap\.org/.test(url.hostname)) return;

  /* DER SCHALTER KOMMT IMMER AUS DEM NETZ.
     An echten Aufnahmen dieses Fehlers: die Datei im Netz sagte bereits
     "true", ueber den Service Worker kam weiterhin "false" — der alte
     Shell-Cache lieferte die veraltete Fassung aus. Ein Livegang waere bei
     jedem, der die App schon installiert hat, wirkungslos geblieben, ohne
     dass irgendwo ein Fehler auftaucht. Ein Schalter, der erst nach einer
     Cache-Erneuerung greift, ist kein Schalter.
     Ohne Netz schlaegt der Abruf fehl, window.CARLON_LIVE bleibt undefiniert
     und es gilt Beta — die sichere Richtung, und offline kann ohnehin niemand
     bezahlen. */
  if (/\/live\.js$/.test(url.pathname)) {
    e.respondWith(fetch(req, { cache: 'no-store' }));
    return;
  }

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


/* ════════════════════════════════════════════════════════════════════════
   LIZENZ IM HINTERGRUND ERNEUERN
   ════════════════════════════════════════════════════════════════════════
   Die Erneuerung in der Seite deckt ab, solange die App offen ist. Diese
   Ergaenzung deckt den Fall, in dem sie NICHT offen ist: das Geraet kommt
   nachts wieder ins Netz, der Browser weckt den Service Worker, die Lizenz
   ist morgens frisch — ohne dass jemand etwas geoeffnet hat.

   Ehrliche Einordnung: Background Sync gibt es in Chromium, NICHT in Safari.
   Auf iPad und iPhone bleibt es bei den Ausloesern in der Seite (Start,
   Tab-Fokus, online). Deshalb ist das hier eine Zugabe und keine Zusage —
   die Reichweite von 14 Tagen plus 14 Tagen Kulanz traegt auch ohne sie.

   Der Service Worker liest den Abo-Token direkt aus derselben Datenbank, in
   der die App ihn ablegt (carlon_clinic → settings → id 'app'), und schreibt
   die neue Lizenz dorthin zurueck. Die Seite liest sie beim naechsten Start.
   Gesundheitsdaten fasst dieser Weg nicht an. */

const LIZENZ_DIENST = 'https://lizenz.vitalkultur.com/erneuern';

function dbOeffnen() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('carlon_clinic', 2);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

function einstellungen(db, schreiben) {
  return new Promise((res, rej) => {
    const tx = db.transaction('settings', schreiben ? 'readwrite' : 'readonly');
    const st = tx.objectStore('settings');
    if (schreiben) { const q = st.put(schreiben); q.onsuccess = () => res(true); q.onerror = () => rej(q.error); }
    else { const q = st.get('app'); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }
  });
}

async function lizenzImHintergrundErneuern() {
  let db;
  try { db = await dbOeffnen(); } catch { return; }
  let satz;
  try { satz = await einstellungen(db); } catch { return; }
  const daten = satz && satz.data;
  const liz = daten && daten.license;
  if (!liz || !liz.sub) return;                      // kein Abo hinterlegt

  try {
    const r = await fetch(LIZENZ_DIENST, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: liz.sub }),
    });
    const d = await r.json().catch(() => ({}));
    const jetzt = Math.floor(Date.now() / 1000);
    if (d && d.ok && d.lizenz) {
      liz.key = d.lizenz; liz.letztePruefung = jetzt; liz.abgelehntSeit = null;
    } else if (r.status === 402) {
      /* Definitive Absage auch hier merken — sonst haette die Seite spaeter
         wieder nur "konnte nicht fragen" gesehen und Kulanz gewaehrt. */
      liz.abgelehntSeit = jetzt; liz.letztePruefung = jetzt;
    } else {
      return;                                        // Netz-/Dienstproblem: nichts anfassen
    }
    daten.license = liz;
    await einstellungen(db, { id: 'app', data: daten });
  } catch { /* still scheitern — die Seite versucht es beim naechsten Start */ }
}

self.addEventListener('sync', (e) => {
  if (e.tag === 'carlon-lizenz') e.waitUntil(lizenzImHintergrundErneuern());
});

self.addEventListener('periodicsync', (e) => {
  if (e.tag === 'carlon-lizenz') e.waitUntil(lizenzImHintergrundErneuern());
});
