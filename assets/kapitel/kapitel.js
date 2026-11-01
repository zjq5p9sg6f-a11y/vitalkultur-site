/* Kapitel-Navigation + Sprünge der vitalkultur-Produktseiten (aus der Research-Seite gelöst, 29.10.2026).
   Einbinden am Ende des <body>: <script src="/assets/kapitel/kapitel.js?v=1"></script> */
/* Beim Öffnen und Neuladen oben beginnen (30.10.2026, Jan: „beim Laden der Seite beginnt sie nicht oben“): Safari stellte
   die letzte Scrollposition wieder her. Ein Anker von außen (#faq, Sprachwechsel) gilt weiter. */
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
if (!location.hash) scrollTo(0, 0);
(function () {
  /* Sprünge innerhalb der Seite ohne Anker in der Adresse (29.10.2026, Jan: „startet beim Öffnen bei FAQ“):
     ein Tipp auf einen Belegchip schrieb #faq in die Adresse, beim nächsten Öffnen begann die Seite dort.
     Links von außen mit Anker funktionieren weiter. */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey) return;
    var ziel = document.getElementById(a.getAttribute('href').slice(1));
    if (!ziel) return;
    e.preventDefault();
    springe(ziel);
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  });
  /* Sprung auf den TITEL des Ziels, 34 px unter der Kopfleiste – und nach der Fahrt nachmessen (29.10.2026, Jan:
     „Workflow tippen, Seite stoppt davor“): scrollIntoView rechnet das Ziel nur einmal; klappt unterwegs die
     Safari-Leiste ein oder lädt ein Bild, endet die Fahrt zu früh. Bis zu drei Korrekturen, bis es auf 3 px stimmt. */
  function springe(ziel) {
    var ruhig = matchMedia('(prefers-reduced-motion: reduce)').matches, nav = document.querySelector('.nav');
    var marke = ziel.querySelector('.label, h1, h2') || ziel;
    var soll = function () { return Math.max(0, Math.round(marke.getBoundingClientRect().top + scrollY - (nav ? nav.offsetHeight : 0) - 34)); };
    /* Bühnen (Karussell/Uhr + Satz) landen MITTIG im freien Bild, nicht mit dem Kopf an der Leiste (31.10.2026, Jan, iPad:
       „How it works rastet nicht ideal ein … Watch und Text darunter ideal positioniert“) */
    var buehne = ziel.querySelector('[data-buehne]');
    if (buehne && buehne.offsetHeight && buehne.offsetHeight < innerHeight) soll = function () {
      var r = buehne.getBoundingClientRect(), kopf = nav ? nav.offsetHeight : 0;
      return Math.max(0, Math.round(r.top + scrollY - kopf - (innerHeight - kopf - r.height) / 2)); };
    var runde = 0, letztY = -1, still = 0, selbst = false, halt = function () { selbst = true; };
    ['touchstart', 'wheel', 'keydown'].forEach(function (ev) { addEventListener(ev, halt, { once: true, passive: true }); });   // wer selbst scrollt, wird nicht zurückgezogen
    scrollTo({ top: soll(), behavior: ruhig ? 'auto' : 'smooth' });
    (function pruefe() {
      if (Math.abs(scrollY - letztY) > 0.5) { letztY = scrollY; still = 0; } else still++;
      if (selbst) return;
      if (still < 8) return requestAnimationFrame(pruefe);          // Fahrt läuft noch (8 ruhige Bilder ≈ 130 ms)
      var y = soll();
      if (Math.abs(scrollY - y) > 3 && runde++ < 3) { scrollTo({ top: y, behavior: ruhig || Math.abs(scrollY - y) < 120 ? 'auto' : 'smooth' }); still = 0; letztY = -1; requestAnimationFrame(pruefe); }
    })();
  }
})();

/* Kapitel-Navigation: aktuelles Kapitel, Fortschrittslinie, Liste auf iPhone/iPad */
(function () {
  var nav = document.querySelector('.nav'), knopf = document.getElementById('kapKnopf'), liste = document.getElementById('kapListe');
  if (!nav || !knopf || !liste) return;
  var links = [].slice.call(liste.querySelectorAll('a')), dimm = document.querySelector('.kap-dimm'), fort = nav.querySelector('.kap-fort');
  var ziele = links.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); });
  var akt = -2, offen = false, geplant = false;
  if (document.documentElement.lang === 'de') nav.querySelector('.kapitel').setAttribute('aria-label', 'Kapitel');
  function lage() {
    geplant = false;
    var h = innerHeight, kopf = nav.offsetHeight, i = -1;
    ziele.forEach(function (z, j) { if (z && z.getBoundingClientRect().top <= kopf + h * 0.3) i = j; });
    if (i !== akt) {
      akt = i; nav.classList.toggle('weiter', i >= 0);
      links.forEach(function (a, j) { if (j === i) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); });
      var a = links[Math.max(0, i)];
      knopf.querySelector('.kap-nr').textContent = a.querySelector('.kap-nr').textContent;
      knopf.querySelector('.kap-name').textContent = a.querySelector('.kap-titel').textContent;
    }
    var max = document.documentElement.scrollHeight - h;
    fort.style.setProperty('--fort', max > 0 ? Math.min(1, scrollY / max).toFixed(4) : 0);
  }
  function auf() { offen = true; nav.classList.add('kap-offen'); knopf.setAttribute('aria-expanded', 'true'); }
  function zu(fokus) {
    if (!offen) return; offen = false; nav.classList.remove('kap-offen'); knopf.setAttribute('aria-expanded', 'false');
    if (fokus) knopf.focus({ preventScroll: true });
  }
  knopf.addEventListener('click', function () { if (offen) zu(true); else auf(); });
  if (dimm) dimm.addEventListener('click', function () { zu(false); });
  links.forEach(function (a) { a.addEventListener('click', function () { zu(false); }); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') zu(true); });
  addEventListener('scroll', function () { if (!geplant) { geplant = true; requestAnimationFrame(lage); } }, { passive: true });
  addEventListener('resize', function () { if (offen && innerWidth >= 1180) zu(false); lage(); });
  // Bilder, die nachladen, verschieben die Kapitel ohne Scroll-Ereignis – dann neu messen
  if ('ResizeObserver' in window) new ResizeObserver(function () { if (!geplant) { geplant = true; requestAnimationFrame(lage); } }).observe(document.body);
  lage();
})();
