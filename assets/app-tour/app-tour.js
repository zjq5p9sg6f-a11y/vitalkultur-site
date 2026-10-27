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
    var dauer = function (i) { return (parseFloat(scrs[i].dataset.dauer) || 6) * 1000; };
    var video = function (i) { return scrs[i] && scrs[i].querySelector('video'); };

    function zeige(i, vomNutzer) {
      i = (i + scrs.length) % scrs.length;
      if (i === cur) return;
      var alt = video(cur); if (alt) alt.pause();
      cur = i; t0 = performance.now(); halt = null;
      scrs.forEach(function (s, j) { s.classList.toggle('on', j === i); });
      items.forEach(function (li, j) { li.classList.toggle('on', j === i); var f = li.querySelector('.fort'); if (f) f.style.setProperty('--fort', '0%'); });
      var v = video(i);
      if (v) { try { v.currentTime = 0; } catch (e) {} v.playbackRate = parseFloat(scrs[i].dataset.rate) || 1; v.play().catch(function () {}); }
      var sc = scrs[i].querySelector('.at-scroller');
      if (sc) { sc.scrollTop = 0; scrollAuto = vomNutzer ? null : performance.now(); }
      if (vomNutzer) nutzer = performance.now();
    }

    function tick(now) {
      if (cur >= 0) {
        var d = dauer(cur);
        var pausiert = reduce || !sichtbar || now - nutzer < 14000;
        if (pausiert) { if (halt === null) halt = now - t0; t0 = now - halt; } else { halt = null; }
        var p = Math.min(1, (now - t0) / d);
        var f = items[cur] && items[cur].querySelector('.fort'); if (f) f.style.setProperty('--fort', (p * 100).toFixed(1) + '%');
        var sc = scrs[cur].querySelector('.at-scroller');
        if (sc && scrollAuto !== null && !reduce) {
          var q = Math.min(1, (now - scrollAuto) / (d * 0.92)), e = q < .5 ? 2 * q * q : 1 - Math.pow(-2 * q + 2, 2) / 2;
          sc.scrollTop = e * (sc.scrollHeight - sc.clientHeight);
        }
        if (!pausiert && p >= 1) zeige(cur + 1, false);
      }
      requestAnimationFrame(tick);
    }

    items.forEach(function (li, j) { var b = li.querySelector('button'); if (b) b.addEventListener('click', function () { zeige(j, true); }); });
    scrs.forEach(function (s, j) {
      var sc = s.querySelector('.at-scroller');
      if (sc) ['wheel', 'touchstart', 'pointerdown', 'keydown'].forEach(function (ev) {
        sc.addEventListener(ev, function () { scrollAuto = null; nutzer = performance.now(); }, { passive: true });
      });
      var v = video(j);
      if (v) v.addEventListener('ended', function () { try { v.currentTime = Math.max(0, v.duration - 0.05); } catch (e) {} });
    });
    var screen = root.querySelector('.at-screen'), sx = 0, sy = 0;
    if (screen) {
      screen.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
      screen.addEventListener('touchend', function (e) {
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
    zeige(0, false);
    requestAnimationFrame(tick);
  }
  function alle() { [].forEach.call(document.querySelectorAll('[data-app-tour]'), init); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', alle); else alle();
  window.AppTour = { init: init };
})();
