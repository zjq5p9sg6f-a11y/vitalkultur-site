/* CARLON-Familie – Leiste über allen Produktseiten (29.10.2026). Einbinden direkt nach <body>, synchron, damit die
   Seite beim Laden nicht um 44 px springt:
     <link rel="stylesheet" href="/assets/familie/familie.css?v=2">   (im <head>)
     <script src="/assets/familie/familie.js?v=2"></script>            (erste Zeile im <body>)
   Die eigene Kopfleiste der Seite bekommt data-vkf-folgt und rückt dann mit der Familienleiste.
   Sprache folgt <html lang> – jede Seite schaltet sie selbst, hier wird nur mitgelesen. */
(function () {
  var APPS = [
    { pfad: '/breathwork/', icon: '/assets/breathwork-app-icon-224.png', name: 'Breathwork',
      was: { en: 'Your wrist becomes your breath coach.', de: 'Dein Handgelenk wird dein Atem-Coach.' } },
    { pfad: '/hrv-research/', de: '/hrv-research/de/', icon: '/assets/research-app-icon-224.png', name: 'HRV Research',
      was: { en: 'Your HRV study, from one iPhone.', de: 'Deine HRV-Studie mit einem iPhone.' } },
    { pfad: '/carlon-equine/', icon: '/assets/equine-favicon-180.png', name: 'Equine',
      was: { en: 'Research-grade HRV for horses.', de: 'Forschungs-HRV für Pferde.' } }
  ];
  var T = {
    en: { alle: 'All apps', apps: 'Apps', hier: 'This app', uebersicht: 'All apps at a glance', browser: 'In the browser:',
          station: 'Messstation', visite: 'Visite', label: 'CARLON apps by vitalkultur' },
    de: { alle: 'Alle Apps', apps: 'Apps', hier: 'Diese App', uebersicht: 'Alle Apps im Überblick', browser: 'Im Browser:',
          station: 'Messstation', visite: 'Visite', label: 'CARLON-Apps von vitalkultur' }
  };
  var weg = location.pathname, hier = APPS.filter(function (a) { return weg.indexOf(a.pfad) === 0; })[0];
  var skript = document.currentScript;

  function sprache() { return /^de/i.test(document.documentElement.lang) ? 'de' : 'en'; }
  function ziel(a, l) { return l === 'de' && a.de ? a.de : a.pfad; }

  function markup(l) {
    var t = T[l], leiste = '', tafel = '';
    APPS.forEach(function (a) {
      var akt = a === hier ? ' aria-current="page"' : '';
      leiste += '<li><a href="' + ziel(a, l) + '"' + akt + '><img src="' + a.icon + '" alt="" width="18" height="18">' + a.name + '</a></li>';
      tafel += '<li><a href="' + ziel(a, l) + '"' + akt + '><img src="' + a.icon + '" alt="" width="44" height="44"><span class="name">CARLON ' + a.name +
        '</span><span class="was">' + a.was[l] + '</span>' + (a === hier ? '<span class="hier">' + t.hier + '</span>' : '') + '</a></li>';
    });
    return '<div class="vkf-in">' +
      '<a class="vkf-marke" href="/" aria-label="vitalkultur"><img src="/assets/vitalkultur-wordmark.png" alt="vitalkultur" width="78" height="20"></a>' +
      '<ul class="vkf-apps">' + leiste + '</ul>' +
      '<a class="vkf-alle" href="/#apps">' + t.alle + '</a>' +
      '<button class="vkf-knopf" type="button" aria-expanded="false" aria-controls="vkfTafel">' + t.apps +
        '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
      '</div>' +
      '<div class="vkf-tafel" id="vkfTafel"><ul>' + tafel + '</ul>' +
      '<a class="uebersicht" href="/#apps">' + t.uebersicht + '<span aria-hidden="true">→</span></a>' +
      '<p class="browser">' + t.browser + ' <a href="/messen">' + t.station + '</a> · <a href="/carlon-equine-visite/">' + t.visite + '</a></p></div>';
  }

  var platz = document.createElement('div'); platz.className = 'vkf-platz'; platz.setAttribute('aria-hidden', 'true');
  var leiste = document.createElement('nav'); leiste.className = 'vkf';
  var dimm = document.createElement('div'); dimm.className = 'vkf-dimm'; dimm.setAttribute('aria-hidden', 'true');
  var l = sprache();
  function zeichne() { leiste.innerHTML = markup(l); leiste.setAttribute('aria-label', T[l].label); }
  zeichne();
  (skript && skript.parentNode ? skript : document.body.firstChild).insertAdjacentElement('afterend', platz);
  platz.insertAdjacentElement('afterend', leiste);
  leiste.insertAdjacentElement('afterend', dimm);
  new MutationObserver(function () { if (sprache() !== l) { l = sprache(); zeichne(); } })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

  /* Tafel (iPhone/iPad) */
  function tafel(auf) {
    leiste.classList.toggle('offen', auf); dimm.classList.toggle('an', auf);
    var k = leiste.querySelector('.vkf-knopf'); if (k) k.setAttribute('aria-expanded', String(auf));
    if (auf) zeige(true);
  }
  leiste.addEventListener('click', function (e) {
    if (e.target.closest('.vkf-knopf')) tafel(!leiste.classList.contains('offen'));
    else if (e.target.closest('.vkf-tafel a')) tafel(false);
  });
  dimm.addEventListener('click', function () { tafel(false); });
  addEventListener('keydown', function (e) { if (e.key === 'Escape' && leiste.classList.contains('offen')) { tafel(false); leiste.querySelector('.vkf-knopf').focus(); } });

  /* Weichen beim Lesen, zurück beim Zurückscrollen. Sprünge über Seitenanker sind keine Zurückbewegung:
     solange so eine Fahrt (samt Nachkorrektur) läuft, bleibt die Leiste weg und verdeckt kein Kapitel. */
  var sichtbar = true, letztY = scrollY, hoch = 0, ruhe = 0, H = 44;
  function zeige(v) {
    if (v === sichtbar) return;
    sichtbar = v; leiste.classList.toggle('weg', !v);
    document.documentElement.style.setProperty('--vkf-sicht', v ? 'var(--vkf-h)' : '0px');
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href*="#"]');
    if (a && a.pathname === location.pathname && a.hash) ruhe = Date.now() + 700;
  }, true);
  addEventListener('scroll', function () {
    var y = scrollY, d = y - letztY, jetzt = Date.now(); letztY = y;
    if (leiste.classList.contains('offen')) return;
    if (y <= H) { hoch = 0; return zeige(true); }
    if (jetzt < ruhe) { ruhe = Math.max(ruhe, jetzt + 300); hoch = 0; return zeige(false); }
    if (d > 0) { hoch = 0; zeige(false); }
    else if ((hoch -= d) > 34) zeige(true);
  }, { passive: true });
})();
