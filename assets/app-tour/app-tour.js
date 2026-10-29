/*
 * App-Tour — die echte App im echten iPhone, virtuell erlebbar (vitalkultur, 27.10.2026).
 *
 * Eine Komponente für alle Seiten (Research, Breathwork, Equine). Die Medien erzeugt
 * `WimHofBreathwork/scripts/app-tour/tour.py` aus der laufenden App im Simulator.
 *
 * Markup (Texte bleiben im HTML — Suchmaschinen und KI lesen sie):
 *   <div data-app-tour>
 *     <ol data-tour-liste> <li><button>…</button><i class="fort"></i></li> … </ol>
 *     <div class="at-device">
 *       <div class="at-screen">
 *         <div class="at-scr" data-dauer="12" data-rate="1.4"><video …></video></div>
 *         <div class="at-scr at-scroll" data-dauer="10"><img class="at-head" …><div class="at-scroller"><img …></div></div>
 *         <div class="at-scr" data-dauer="6"><img …></div>
 *       </div>
 *       <img class="at-bezel" src="/assets/app-tour/iphone-18-pro-max-black.webp" alt="">
 *     </div>
 *   </div>
 *
 * Verhalten: läuft von selbst (Fortschrittsbalken je Station), Klick auf eine Zeile oder
 * Wischen am iPhone übernimmt; nach 14 s ohne Eingriff läuft sie weiter. Videos spielen mit
 * data-rate, halten das letzte Bild. Scroll-Stationen scrollen selbst, bis der Nutzer
 * hineingreift. Unsichtbar = Pause. prefers-reduced-motion = kein Selbstlauf.
 */
(function () {
  function init(root) {
    var scrs = [].slice.call(root.querySelectorAll('.at-scr'));
    var items = [].slice.call(root.querySelectorAll('[data-tour-liste] > li'));
    if (!scrs.length) return;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var cur = -1, t0 = 0, sichtbar = true, nutzer = -1e9, halt = null, scrollAuto = null;
    var beimZeigen = [], beimTakt = [];                           // Stations-Bausteine (Spickzettel, Scroll-Hinweis)
    var dauer = function (i) { return (parseFloat(scrs[i].dataset.dauer) || 6) * 1000; };
    var video = function (i) { return scrs[i] && scrs[i].querySelector('video'); };
    // Erklärungen im Bild: data-ab/data-bis in Sekunden ab Stationsbeginn (läuft mit der Pause mit)
    var calls = scrs.map(function (s) { return [].slice.call(s.querySelectorAll('.at-call')); });
    var scr0 = root.querySelector('.at-screen'), devEl = root.querySelector('.at-device'), spot = null, cap = null, aktivCall = null;
    if (scr0 && calls.some(function (c) { return c.length; })) {
      spot = document.createElement('div'); spot.className = 'at-spot'; spot.setAttribute('aria-hidden', 'true'); scr0.appendChild(spot);
      cap = document.createElement('div'); cap.className = 'at-cap'; cap.setAttribute('aria-live', 'polite'); devEl.appendChild(cap);
    }
    var zeigeCall = function (c) {
      if (c === aktivCall || !spot) return; aktivCall = c;
      root.classList.toggle('at-erklaert', !!c);                  // Bildtext ersetzt den Hinweis unter dem Gerät
      if (!c) { spot.classList.remove('zeigen'); cap.classList.remove('zeigen'); return; }
      var r = c.dataset.r.split(' ').map(Number);
      spot.style.left = r[0] + '%'; spot.style.top = r[1] + '%'; spot.style.width = (r[2] - r[0]) + '%'; spot.style.height = (r[3] - r[1]) + '%';
      spot.classList.add('zeigen');
      cap.classList.remove('zeigen');
      var t = c.querySelector('span').innerHTML;
      setTimeout(function () { if (aktivCall === c) { cap.innerHTML = t; cap.classList.add('zeigen'); } }, 180);
    };

    function zeige(i, vomNutzer) {
      i = (i + scrs.length) % scrs.length;
      if (i === cur) return;
      var alt = video(cur); if (alt) alt.pause();
      cur = i; t0 = performance.now(); halt = null;
      scrs.forEach(function (s, j) { s.classList.toggle('on', j === i); });
      zeigeCall(null);
      items.forEach(function (li, j) { li.classList.toggle('on', j === i); var f = li.querySelector('.fort'); if (f) f.style.setProperty('--fort', '0%'); });
      var v = video(i);
      if (v) { try { v.currentTime = 0; } catch (e) {} v.playbackRate = parseFloat(scrs[i].dataset.rate) || 1; v.play().catch(function () {}); }
      var sc = scrs[i].querySelector('.at-scroller');
      // Auch nach einem Tipp in der Liste selbst scrollen (29.10.: „man erkennt nicht, dass man scrollen kann“) —
      // die eigene Berührung des Scrollers hält es sofort an.
      if (sc) { sc.scrollTop = 0; scrollAuto = performance.now(); }
      if (vomNutzer) nutzer = performance.now();
      beimZeigen.forEach(function (f) { f(i); });
    }

    function tick(now) {
      if (cur >= 0) {
        var d = dauer(cur);
        // Die Uhr der Station hält nur an, wenn die Tour nicht zu sehen ist. Wer bedient, sperrt bloß das
        // WEITERSCHALTEN (29.10.2026: nach einem Tipp in der Liste standen Vorführung und Bildtexte 14 s still).
        var pausiert = reduce || !sichtbar, gesperrt = now - nutzer < 14000;
        if (pausiert) { if (halt === null) halt = now - t0; t0 = now - halt; } else { halt = null; }
        var p = Math.min(1, (now - t0) / d);
        var sek = reduce ? 1 : p * d / 1000;
        var akt = null; calls[cur].forEach(function (c) { if (sek >= parseFloat(c.dataset.ab) && sek < parseFloat(c.dataset.bis)) akt = c; }); zeigeCall(akt);
        var f = items[cur] && items[cur].querySelector('.fort'); if (f) f.style.setProperty('--fort', (p * 100).toFixed(1) + '%');
        var sc = scrs[cur].querySelector('.at-scroller');
        if (sc && scrollAuto !== null && !reduce) {
          // In Schritten wie ein Daumen (29.10.2026, Jan: „quälend langsam“): zügig eine Dreiviertel-Seite weiter,
          // kurz stehen lassen, weiter – statt die ganze Station lang gleichmäßig zu kriechen.
          var hoehe = sc.scrollHeight - sc.clientHeight, hub = sc.clientHeight * 0.72;
          if (hoehe > 0) {
            var schritte = Math.max(1, Math.ceil(hoehe / hub)), takt = Math.min(1900, (d * 0.86 - 600) / schritte);
            var t = now - scrollAuto - 600, k = Math.floor(t / takt), r = (t - k * takt) / 520;
            if (t < 0) { sc.scrollTop = 0; }
            else {
              var von = Math.min(hoehe, k * hub), nach = Math.min(hoehe, (k + 1) * hub), q = Math.min(1, r);
              var e = 1 - Math.pow(1 - q, 3);
              sc.scrollTop = von + (nach - von) * e;
            }
          }
        }
        beimTakt.forEach(function (f) { f(cur, sek, pausiert, now); });
        if (!pausiert && !gesperrt && p >= 1) zeige(cur + 1, false);
      }
      requestAnimationFrame(tick);
    }

    items.forEach(function (li, j) { var b = li.querySelector('button'); if (b) b.addEventListener('click', function () { zeige(j, true); }); });
    scrs.forEach(function (s, j) {
      var sc = s.querySelector('.at-scroller');
      if (sc) ['wheel', 'touchstart', 'pointerdown', 'keydown'].forEach(function (ev) {
        sc.addEventListener(ev, function () { scrollAuto = null; nutzer = performance.now(); }, { passive: true });
      });
      var lp = s.querySelector('canvas.lp');                       // wer die Karte bedient, hält die Tour an
      if (lp) ['pointerdown', 'pointermove', 'touchstart', 'touchmove', 'wheel', 'keydown'].forEach(function (ev) {
        lp.addEventListener(ev, function (e) { if (ev !== 'pointermove' || e.buttons || e.pointerType === 'mouse') nutzer = performance.now(); }, { passive: true });
      });
      var v = video(j);
      if (v) v.addEventListener('ended', function () { try { v.currentTime = Math.max(0, v.duration - 0.05); } catch (e) {} });
    });
    var screen = root.querySelector('.at-screen'), sx = 0, sy = 0;
    if (screen) {
      // Poincaré live (29.10.2026): nur der Zeitregler, Halten-und-Ziehen (Fadenkreuz) und zwei Finger sind
      // Bedienung. Ein schnelles Wischen über die Karte wechselt weiter die Station — vorher sperrte die
      // bildschirmfüllende Karte das Wischen ganz (Jan: „kann nicht mehr weiter swipen“).
      var bedient = false, tStart = 0, mehrfinger = false;
      screen.addEventListener('touchstart', function (e) {
        tStart = performance.now(); mehrfinger = e.touches.length > 1; sx = e.touches[0].clientX; sy = e.touches[0].clientY;
        var cv = e.target.closest && e.target.closest('canvas.lp');
        if (cv) { var b = cv.getBoundingClientRect(), ry = (sy - b.top) / b.height; bedient = ry > 1880 / 2868 && ry < 2060 / 2868; } else bedient = false;
      }, { passive: true });
      screen.addEventListener('touchmove', function (e) { if (e.touches.length > 1) mehrfinger = true; }, { passive: true });
      screen.addEventListener('touchend', function (e) {
        if (bedient || mehrfinger || performance.now() - tStart > 450) return;
        var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.4) zeige(cur + (dx < 0 ? 1 : -1), true);
      }, { passive: true });
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { es.forEach(function (e) {
        sichtbar = e.isIntersecting; var v = video(cur);
        if (v) { if (sichtbar) v.play().catch(function () {}); else v.pause(); }
      }); }, { threshold: 0.3 }).observe(root.querySelector('.at-device') || root);
    }
    // Vollbild (27.10.2026, Jan: „geht nicht auf Vollbild“): das Gerät selbst wandert in eine
    // Ebene über der Seite — Tour, Wischen und Scrollen laufen dort weiter; Klick daneben/Esc schließt.
    var dev = root.querySelector('.at-device');
    if (dev) {
      var de = document.documentElement.lang === 'de', platz = null, ebene = null;
      var AUF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
      var ZU = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
      var knopf = document.createElement('button');
      knopf.type = 'button'; knopf.className = 'at-voll-btn';
      var beschriften = function () { var g = !!ebene; knopf.innerHTML = g ? ZU : AUF; knopf.setAttribute('aria-label', g ? (de ? 'Vollbild schließen' : 'Close full screen') : (de ? 'Vollbild' : 'Full screen')); };
      var weiter = function () { var v = video(cur); if (v) v.play().catch(function () {}); };
      var zu = function () {
        if (!ebene) return;
        platz.parentNode.replaceChild(dev, platz); ebene.remove(); ebene = null;
        document.documentElement.style.overflow = ''; beschriften(); weiter(); knopf.focus();
      };
      var auf = function () {
        platz = document.createComment('at-device'); dev.parentNode.insertBefore(platz, dev);
        ebene = document.createElement('div'); ebene.className = 'at-voll';
        ebene.setAttribute('role', 'dialog'); ebene.setAttribute('aria-modal', 'true');
        ebene.addEventListener('click', function (e) { if (e.target === ebene) zu(); });
        document.body.appendChild(ebene); ebene.appendChild(dev);
        document.documentElement.style.overflow = 'hidden'; nutzer = performance.now(); beschriften(); weiter(); knopf.focus();
      };
      knopf.addEventListener('click', function (e) { e.stopPropagation(); if (ebene) zu(); else auf(); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') zu(); });
      beschriften(); dev.appendChild(knopf);
    }
    // ── Scroll-Stationen: Leiste + Hinweis „Scrollen“, damit erkennbar ist, dass es weitergeht ──
    var deL = document.documentElement.lang === 'de';
    scrs.forEach(function (st) {
      var sc = st.querySelector('.at-scroller'); if (!sc) return;
      var leiste = document.createElement('div'); leiste.className = 'at-leiste'; leiste.innerHTML = '<i></i>'; leiste.setAttribute('aria-hidden', 'true');
      var mehr = document.createElement('div'); mehr.className = 'at-mehr'; mehr.setAttribute('aria-hidden', 'true');
      mehr.innerHTML = '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 4.5l3 3 3-3"/></svg>' + (deL ? 'Scrollen' : 'Scroll');
      st.appendChild(leiste); st.appendChild(mehr);
      var balken = leiste.firstChild;
      var lage = function () {
        var h = sc.scrollHeight - sc.clientHeight; if (h <= 0) return;
        var q = sc.clientHeight / sc.scrollHeight; balken.style.height = Math.max(8, q * 100) + '%';
        balken.style.top = (sc.scrollTop / h) * (100 - Math.max(8, q * 100)) + '%';
        if (sc.scrollTop / h > 0.92) mehr.classList.add('weg');
      };
      sc.addEventListener('scroll', lage, { passive: true });
      ['wheel', 'touchstart', 'pointerdown'].forEach(function (ev) { sc.addEventListener(ev, function () { mehr.classList.add('weg'); }, { passive: true }); });
      beimZeigen.push(function (i) { if (scrs[i] === st) { mehr.classList.remove('weg'); setTimeout(lage, 50); } });
    });

    // ── Spickzettel-Station: der Finger tippt geprüfte Beispiel-Kacheln an, das echte Erklärblatt der App fährt herein ──
    scrs.forEach(function (st, si) {
      if (!st.classList.contains('at-spick')) return;
      var blatt = st.querySelector('.at-blatt'), dimm = st.querySelector('.at-dimm');
      var kacheln = [].slice.call(st.querySelectorAll('.at-kachel'));
      var finger = document.createElement('div'); finger.className = 'at-finger'; finger.setAttribute('aria-hidden', 'true'); st.appendChild(finger);
      var demo = (st.dataset.demo || '').split(' ').filter(Boolean).map(function (x) {
        var m = x.split('@'), t = m[1].split('-'); return { id: m[0], ab: parseFloat(t[0]), bis: parseFloat(t[1]) };
      });
      var kachel = function (id) { return kacheln.filter(function (k) { return k.dataset.id === id; })[0]; };
      var offenId = null, selbst = false;
      var auf = function (k) {
        if (!k) return; blatt.src = k.dataset.blatt;
        blatt.alt = (deL ? 'Erklärblatt der App: ' : 'App explanation sheet: ') + k.dataset.id.toUpperCase();
        offenId = k.dataset.id; st.classList.add('offen');
      };
      var zu = function () { offenId = null; st.classList.remove('offen'); };
      var ruf = function (an) { var k = kachel(demo.length ? demo[0].id : ''); if (k) k.classList.toggle('ruf', an); };
      // Reine Vorführung an geprüften Beispielen (Jan 29.10.: nicht jede Kachel antippbar machen).
      beimZeigen.push(function (i) {
        zu(); finger.classList.remove('an', 'druck');
        if (i === si) { selbst = false; demo.forEach(function (d) { var k = kachel(d.id); if (k) new Image().src = k.dataset.blatt; }); }
        ruf(i === si);
      });
      beimTakt.push(function (i, sek, pausiert) {
        if (i !== si || selbst || reduce) return;
        var soll = null, f = null;
        demo.forEach(function (d) {
          if (sek >= d.ab && sek < d.bis) soll = d.id;
          if (sek >= d.ab - 0.8 && sek < d.ab + 0.3) f = d;
        });
        if (f) {
          var k = kachel(f.id);
          finger.style.left = (parseFloat(k.style.left) + parseFloat(k.style.width) / 2) + '%';
          finger.style.top = (parseFloat(k.style.top) + parseFloat(k.style.height) / 2) + '%';
          finger.classList.add('an'); finger.classList.toggle('druck', sek >= f.ab - 0.18);
        } else finger.classList.remove('an', 'druck');
        if (soll !== offenId) { if (soll) { ruf(false); auf(kachel(soll)); } else zu(); }
      });
    });

    zeige(0, false);
    requestAnimationFrame(tick);
  }
  function alle() { [].forEach.call(document.querySelectorAll('[data-app-tour]'), init); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', alle); else alle();
  window.AppTour = { init: init };
})();
