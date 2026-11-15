/*
 * Poincaré mit Zeitregler – CARLON Equine Visite (16.11.2026).
 * Jan: „Point-Carré-Plot mit dem Swipe-Regler, weil wir die Zeitstempel nicht wegschmeißen, vor- und zurückspulen“.
 * Messgrafik: Achsen in ms mit Skala und Raster, Identitätslinie, SD1/SD2-Ellipse für das gewählte Zeitfenster,
 * Fadenkreuz mit Schlagnummer, RR-Paar und Zeitpunkt. AV-Block-Paare (Etiketten der Datei) bernsteinfarben.
 * Beim ersten Sichtbarwerden spult die Wolke einmal von 0 bis zum Ende (abschaltbar über prefers-reduced-motion);
 * jede Berührung des Reglers beendet die Vorführung.
 * Markup: <figure class="pz" data-quelle="/carlon-equine/app/belege/rmssd-roh-vs-korrigiert.json" data-lang="de"> … </figure>
 */
(function () {
  'use strict';
  var DE = (document.documentElement.lang || 'de').indexOf('en') !== 0;
  var T = DE ? { x: 'RRₙ (ms)', y: 'RRₙ₊₁ (ms)', schlag: 'Schlag', bis: 'bis', paare: 'Paare', av: 'AV-Block-Pause', zeit: 'Zeit', spielen: 'Abspielen', halt: 'Anhalten' }
             : { x: 'RRₙ (ms)', y: 'RRₙ₊₁ (ms)', schlag: 'Beat', bis: 'to', paare: 'pairs', av: 'AV-block pause', zeit: 'Time', spielen: 'Play', halt: 'Pause' };
  var CYAN = '#3ECFB2', AMBER = '#FFB547', GRID = 'rgba(255,255,255,.06)', GRID2 = 'rgba(255,255,255,.14)', TXT = '#9fb2c2';
  function fmtZeit(s) { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function nett(a, b, n) { var r = (b - a) / n, m = Math.pow(10, Math.floor(Math.log10(r))), f = r / m; var st = (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * m; var o = []; for (var v = Math.ceil(a / st) * st; v <= b + 1e-9; v += st) o.push(Math.round(v)); return { werte: o, schritt: st }; }

  function init(fig) {
    var url = fig.getAttribute('data-quelle'); if (!url && !fig._daten) return; if (fig._pzFertig) return; fig._pzFertig = true;
    fig.innerHTML = '<div class="pz-buehne"><canvas class="pz-c" tabindex="0" role="img"></canvas><div class="pz-tipp" hidden></div></div>' +
      '<div class="pz-leiste"><button class="pz-knopf" type="button" aria-label="' + T.spielen + '">▶</button>' +
      '<input class="pz-regler" type="range" min="2" max="100" value="100" step="1" aria-label="' + T.zeit + '">' +
      '<span class="pz-zeit">0:00</span></div><div class="pz-werte"></div>';
    var cv = fig.querySelector('.pz-c'), tipp = fig.querySelector('.pz-tipp'), regler = fig.querySelector('.pz-regler'),
        zeitEl = fig.querySelector('.pz-zeit'), werteEl = fig.querySelector('.pz-werte'), knopf = fig.querySelector('.pz-knopf');
    var rr = [], t = [], av = {}, n = 0, lo = 400, hi = 2000, vlo = 400, vhi = 2000, k = 0, spielt = null, vorgefuehrt = false;

    (fig._daten ? Promise.resolve(fig._daten) : fetch(url).then(function (r) { return r.json(); })).then(function (d) {
      rr = (d.rrMs || []).map(Number); n = rr.length; var acc = 0; t = rr.map(function (v) { acc += v / 1000; return acc; });
      Object.keys(d.etiketten || {}).forEach(function (i) { av[+i] = d.etiketten[i]; });
      var s = rr.slice().sort(function (a, b) { return a - b; }); var q = function (p) { return s[Math.floor(p * (s.length - 1))]; };
      lo = Math.floor((Math.min(q(0.005), 700)) / 100) * 100; hi = Math.ceil(Math.max(q(1), 1000) / 100) * 100 + 100;
      regler.max = String(n - 1); regler.value = String(n - 1); k = n - 1; vlo = lo; vhi = hi;
      cv.setAttribute('aria-label', (DE ? 'Poincaré-Diagramm einer Ruheaufnahme über ' : 'Poincaré plot of a resting recording over ') + n + (DE ? ' Schläge mit Zeitregler' : ' beats with time slider'));
      groesse(); zeichne();
      if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting && !vorgefuehrt) { vorgefuehrt = true; abspielen(true); io.disconnect(); } }); }, { threshold: 0.55 });
        io.observe(fig);
      }
    });

    var dpr = 1, S = 0, M = { l: 62, r: 16, t: 16, b: 48 };
    function groesse() { var b = cv.parentNode.getBoundingClientRect(); S = Math.min(b.width, 560); dpr = window.devicePixelRatio || 1; cv.width = S * dpr; cv.height = S * dpr; cv.style.width = S + 'px'; cv.style.height = S + 'px'; }
    function X(v) { return M.l + (v - vlo) / (vhi - vlo) * (S - M.l - M.r); }
    function Y(v) { return S - M.b - (v - vlo) / (vhi - vlo) * (S - M.t - M.b); }
    function wert(px) { return vlo + (px - M.l) / (S - M.l - M.r) * (vhi - vlo); }
    function sd(bis) { var a = [], b = []; for (var i = 0; i < bis; i++) { a.push(rr[i + 1] - rr[i]); b.push(rr[i + 1] + rr[i]); }
      var m = function (x) { return x.reduce(function (p, c) { return p + c; }, 0) / x.length; }, va = function (x) { var mm = m(x); return x.reduce(function (p, c) { return p + (c - mm) * (c - mm); }, 0) / x.length; };
      return { sd1: Math.sqrt(va(a) / 2), sd2: Math.sqrt(va(b) / 2), mx: m(rr.slice(0, bis + 1)) }; }

    function zeichne(hl) {
      var c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, S, S);
      c.fillStyle = '#0b1117'; c.fillRect(M.l, M.t, S - M.l - M.r, S - M.t - M.b);
      var tk = nett(vlo, vhi, 6), fein = tk.schritt / 2; c.lineWidth = 1;
      for (var v = Math.ceil(vlo / fein) * fein; v <= vhi; v += fein) { var grob = tk.werte.indexOf(Math.round(v)) >= 0; c.strokeStyle = grob ? GRID2 : GRID;
        c.beginPath(); c.moveTo(X(v), M.t); c.lineTo(X(v), S - M.b); c.stroke(); c.beginPath(); c.moveTo(M.l, Y(v)); c.lineTo(S - M.r, Y(v)); c.stroke(); }
      c.fillStyle = TXT; c.font = '11px ui-monospace, Menlo, monospace'; c.textAlign = 'center';
      tk.werte.forEach(function (v) { c.fillText(v.toLocaleString(DE ? 'de-DE' : 'en-US'), X(v), S - M.b + 16); });
      c.textAlign = 'right'; tk.werte.forEach(function (v) { c.fillText(v.toLocaleString(DE ? 'de-DE' : 'en-US'), M.l - 7, Y(v) + 4); });
      c.textAlign = 'center'; c.font = '600 11px system-ui, sans-serif'; c.fillText(T.x, (M.l + S - M.r) / 2, S - 10);
      c.save(); c.translate(14, (M.t + S - M.b) / 2); c.rotate(-Math.PI / 2); c.fillText(T.y, 0, 0); c.restore();
      c.strokeStyle = 'rgba(255,255,255,.22)'; c.setLineDash([4, 4]); c.beginPath(); c.moveTo(X(vlo), Y(vlo)); c.lineTo(X(vhi), Y(vhi)); c.stroke(); c.setLineDash([]);
      c.strokeStyle = 'rgba(255,255,255,.2)'; c.strokeRect(M.l + .5, M.t + .5, S - M.l - M.r - 1, S - M.t - M.b - 1);
      if (!n) return;
      c.save(); c.beginPath(); c.rect(M.l, M.t, S - M.l - M.r, S - M.t - M.b); c.clip();
      for (var i = 0; i < k; i++) { var alt = (k - i) / Math.max(1, k); var istAv = av[i] || av[i + 1];
        c.fillStyle = istAv ? AMBER : 'rgba(62,207,178,' + (0.25 + 0.75 * (1 - alt)).toFixed(2) + ')';
        c.beginPath(); c.arc(X(rr[i]), Y(rr[i + 1]), istAv ? 3.6 : 2.2, 0, 7); c.fill(); }
      if (k > 3) { var e = sd(k); var cx = X(e.mx), cy = Y(e.mx), px = (S - M.l - M.r) / (vhi - vlo);
        c.save(); c.translate(cx, cy); c.rotate(-Math.PI / 4); c.strokeStyle = CYAN; c.lineWidth = 1.6; c.beginPath(); c.ellipse(0, 0, e.sd2 * px, e.sd1 * px, 0, 0, 7); c.stroke(); c.restore();
        werteEl.innerHTML = '<span><b>SD1</b> ' + e.sd1.toFixed(1).replace('.', DE ? ',' : '.') + ' ms</span><span><b>SD2</b> ' + e.sd2.toFixed(1).replace('.', DE ? ',' : '.') + ' ms</span><span><b>' + k + '</b> ' + T.paare + '</span><span class="pz-av"><i></i>' + T.av + '</span>'; }
      if (hl != null) { c.strokeStyle = '#fff'; c.lineWidth = 1; c.beginPath(); c.moveTo(X(rr[hl]), M.t); c.lineTo(X(rr[hl]), S - M.b); c.moveTo(M.l, Y(rr[hl + 1])); c.lineTo(S - M.r, Y(rr[hl + 1])); c.stroke();
        c.fillStyle = '#fff'; c.beginPath(); c.arc(X(rr[hl]), Y(rr[hl + 1]), 4.5, 0, 7); c.fill(); }
      c.restore();
      zeitEl.textContent = fmtZeit(t[k] || 0) + ' / ' + fmtZeit(t[n - 1] || 0);
    }

    function setze(v) { k = Math.max(2, Math.min(n - 1, v | 0)); regler.value = String(k); zeichne(); }
    function abspielen(vorfuehrung) {
      if (spielt) { cancelAnimationFrame(spielt); spielt = null; knopf.textContent = '▶'; knopf.setAttribute('aria-label', T.spielen); return; }
      var start = performance.now(), von = vorfuehrung ? 2 : (k >= n - 1 ? 2 : k), dauer = 6500 * (n - von) / n;
      knopf.textContent = '❚❚'; knopf.setAttribute('aria-label', T.halt);
      var schritt = function (jetzt) { var p = Math.min(1, (jetzt - start) / dauer); setze(von + (n - 1 - von) * (1 - Math.pow(1 - p, 2)));
        if (p < 1) spielt = requestAnimationFrame(schritt); else { spielt = null; knopf.textContent = '▶'; knopf.setAttribute('aria-label', T.spielen); } };
      spielt = requestAnimationFrame(schritt);
    }
    knopf.addEventListener('click', function () { abspielen(false); });
    regler.addEventListener('input', function () { if (spielt) { cancelAnimationFrame(spielt); spielt = null; knopf.textContent = '▶'; } vorgefuehrt = true; setze(+regler.value); });
    function naechster(ev) { var b = cv.getBoundingClientRect(), x = ev.clientX - b.left, y = ev.clientY - b.top, best = -1, bd = 1e9;
      for (var i = 0; i < k; i++) { var dx = X(rr[i]) - x, dy = Y(rr[i + 1]) - y, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = i; } }
      if (best < 0 || bd > 900) { tipp.hidden = true; zeichne(); return; }
      zeichne(best); tipp.hidden = false; tipp.style.left = X(rr[best]) + 'px'; tipp.style.top = Y(rr[best + 1]) + 'px';
      tipp.innerHTML = '<b>' + T.schlag + ' ' + (best + 1) + '</b> · ' + fmtZeit(t[best]) + '<br>' + Math.round(rr[best]) + ' → ' + Math.round(rr[best + 1]) + ' ms' + ((av[best] || av[best + 1]) ? '<br><span style="color:' + AMBER + '">' + T.av + '</span>' : ''); }
    function zoom(f, px) { var w = wert(px), neu = Math.max(60, Math.min(hi - lo, (vhi - vlo) * f)); var a = (w - vlo) / (vhi - vlo);
      vlo = w - a * neu; vhi = vlo + neu; if (vlo < lo - 200) { vlo = lo - 200; vhi = vlo + neu; } if (vhi > hi + 200) { vhi = hi + 200; vlo = vhi - neu; } zeichne(); }
    function schieb(dpx) { var d = dpx / (S - M.l - M.r) * (vhi - vlo); vlo -= d; vhi -= d; zeichne(); }
    function zurueck() { vlo = lo; vhi = hi; tipp.hidden = true; zeichne(); }
    cv.addEventListener('wheel', function (e) { e.preventDefault(); var b = cv.getBoundingClientRect(); zoom(Math.exp(e.deltaY * 0.0016), e.clientX - b.left); }, { passive: false });
    cv.addEventListener('dblclick', zurueck);
    var zieh = null;
    cv.addEventListener('mousedown', function (e) { zieh = e.clientX; });
    window.addEventListener('mouseup', function () { zieh = null; });
    cv.addEventListener('mousemove', function (e) { if (zieh != null && (vhi - vlo) < (hi - lo) - 1) { schieb(e.clientX - zieh); zieh = e.clientX; } });
    var t2 = null, letzterTipp = 0;
    cv.addEventListener('touchstart', function (e) { if (e.touches.length === 2) { e.preventDefault(); var a = e.touches[0], b = e.touches[1]; t2 = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), x: (a.clientX + b.clientX) / 2 }; }
      else if (e.touches.length === 1) { var jetzt = Date.now(); if (jetzt - letzterTipp < 300) { e.preventDefault(); zurueck(); } letzterTipp = jetzt; } }, { passive: false });
    cv.addEventListener('touchmove', function (e) { if (e.touches.length === 2 && t2) { e.preventDefault(); var a = e.touches[0], b = e.touches[1], bb = cv.getBoundingClientRect();
      var d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), x = (a.clientX + b.clientX) / 2; schieb(x - t2.x); zoom(t2.d / d, x - bb.left); t2 = { d: d, x: x }; } }, { passive: false });
    cv.addEventListener('touchend', function () { t2 = null; });
    cv.addEventListener('pointermove', naechster); cv.addEventListener('pointerdown', naechster);
    cv.addEventListener('pointerleave', function () { tipp.hidden = true; zeichne(); });
    window.addEventListener('resize', function () { groesse(); zeichne(); });
  }
  var css = document.createElement('style');
  css.textContent = '.pz{margin:0}.pz-buehne{position:relative;display:flex;justify-content:center}.pz-c{touch-action:pan-y;display:block;border-radius:14px;cursor:crosshair}' +
    '.pz-tipp{position:absolute;transform:translate(-50%,calc(-100% - 12px));padding:7px 11px;border-radius:10px;background:rgba(20,26,32,.95);border:1px solid rgba(255,255,255,.18);color:#e8eef2;font:12px/1.4 system-ui,sans-serif;white-space:nowrap;pointer-events:none;box-shadow:0 10px 24px rgba(0,0,0,.5)}' +
    '.pz-leiste{display:flex;align-items:center;gap:12px;max-width:560px;margin:14px auto 0}.pz-regler{flex:1;accent-color:#3ECFB2;height:28px}' +
    '.pz-knopf{width:38px;height:38px;border-radius:50%;border:1px solid rgba(62,207,178,.5);background:rgba(62,207,178,.1);color:#3ECFB2;font-size:13px;cursor:pointer}' +
    '.pz-zeit{font:12px ui-monospace,Menlo,monospace;color:#9fb2c2;min-width:84px;text-align:right}' +
    '.pz-werte{display:flex;flex-wrap:wrap;gap:8px 18px;justify-content:center;margin:12px auto 0;font:12.5px ui-monospace,Menlo,monospace;color:#9fb2c2}.pz-werte b{color:#e8eef2;font-weight:600}' +
    '.pz-av i{display:inline-block;width:8px;height:8px;border-radius:50%;background:#FFB547;margin-right:6px;vertical-align:middle}';
  document.head.appendChild(css);
  window.PoincareZeit = { init: init };
  var los = function () { document.querySelectorAll('figure.pz[data-quelle]').forEach(init); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', los); else los();
})();
