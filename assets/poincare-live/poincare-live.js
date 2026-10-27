/*
 * Poincaré live — die Karte der App, auf der Website bedienbar (vitalkultur, 27.10.2026).
 *
 * Hintergrund = echter App-Screenshot (Regler auf 0:00, Plot geleert:
 * WimHofBreathwork/scripts/app-tour/poincare_live_bg.py). Gezeichnet wird nur, was sich
 * bewegt: Punkte, SD-Kasten, Zeitzeile, Reglerfüllung + Knopf, Fadenkreuz mit Info-Kasten.
 * Die Paare kommen aus der App selbst (WebsitePoincareExportTests: korrigierte Reihe →
 * CarlonPoincarePaare) — dieselbe Wolke, dieselben SD-Werte wie auf dem iPhone.
 *
 * Bedienung wie in der App: Zeitregler ziehen → die Wolke baut sich Schlag für Schlag auf.
 * Auf der Wolke halten (Maus: drücken) → Fadenkreuz am nächsten Schlag mit Zeit und Werten.
 *
 * Markup:
 *   <div class="device" data-poincare-live="assets/v14/poincare-live.json" data-start="19:47:13">
 *     <img class="lp-bg" src="…bg.webp"> <canvas class="lp"></canvas> <img class="bezel" …>
 *   </div>
 * Alle Maße in Pixeln des App-Screenshots (1320 × 2868), gemessen am iPhone 17 Pro Max.
 */
(function () {
  var W = 1320, H = 2868;
  var P = { x0: 180, x1: 1259, y0: 752, y1: 1765 };              // Plotfläche
  var MX = function (ms) { return 249 + ms * 0.8380; };           // 0 ms → 249, 1000 ms → 1087
  var MY = function (ms) { return 1695 - ms * 0.8384; };          // 0 ms → 1695, 1000 ms → 856,5
  var KNOPF = { x0: 664, x1: 1065, y0: 1931, y1: 2003, b: 110 };
  var SPUR = { x0: 615, x1: 1121, y0: 1957, y1: 1975 };
  var CYAN = 'rgb(62,207,178)', PILL = 'rgb(56,56,56)', SPURGRAU = 'rgb(76,76,76)';
  var MONO = 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, monospace';

  function init(dev) {
    var bg = dev.querySelector('.lp-bg'), cv = dev.querySelector('canvas.lp');
    if (!cv) return;
    cv.width = W; cv.height = H;
    var g = cv.getContext('2d');
    var start = (dev.dataset.start || '00:00:00').split(':').map(Number);
    var d = null, f = 0, kreuz = null, auto = null, genutzt = false;

    // Punkt-Sprite (weich gerandeter Kreis wie in der App)
    var spr = document.createElement('canvas'); spr.width = spr.height = 12;
    var sg = spr.getContext('2d'); sg.fillStyle = CYAN; sg.globalAlpha = .9;
    sg.beginPath(); sg.arc(6, 6, 4.2, 0, Math.PI * 2); sg.fill();

    var zwei = function (n) { return (n < 10 ? '0' : '') + n; };
    var dauer = function (s) { s = Math.round(s); return Math.floor(s / 60) + ':' + zwei(s % 60); };
    var uhr = function (s) {
      var t = Math.round(start[0] * 3600 + start[1] * 60 + start[2] + s) % 86400;
      return zwei(Math.floor(t / 3600)) + ':' + zwei(Math.floor(t / 60) % 60) + ':' + zwei(t % 60);
    };
    var sichtbar = function () {                                   // Anzahl Paare bis zur Reglerzeit
      if (f >= 0.9995) return d.x.length;
      var T = f * d.dauer, lo = 0, hi = d.t.length;
      while (lo < hi) { var m = (lo + hi) >> 1; if (d.t[m] <= T) lo = m + 1; else hi = m; }
      return Math.max(2, lo);
    };
    var sd = function (n) {                                        // wie EquinePoincareRenderer beim Spulen
      if (n >= d.x.length) return [d.sd1_voll, d.sd2_voll];        // volle Ansicht = Analyse (sd1SD2Override)
      var ma = 0, ms = 0, i, a, s;
      for (i = 0; i < n; i++) { ma += d.y[i] - d.x[i]; ms += d.y[i] + d.x[i]; }
      ma /= n; ms /= n; var va = 0, vs = 0;
      for (i = 0; i < n; i++) { a = d.y[i] - d.x[i] - ma; s = d.y[i] + d.x[i] - ms; va += a * a; vs += s * s; }
      return [Math.sqrt(va / (n - 1) / 2), Math.sqrt(vs / (n - 1) / 2)];
    };

    function rund(x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

    function zeichnen() {
      g.clearRect(0, 0, W, H);
      var n = sichtbar(), i;
      // Wolke
      g.save(); g.beginPath(); g.rect(P.x0, P.y0, P.x1 - P.x0, P.y1 - P.y0); g.clip();
      for (i = 0; i < n; i++) g.drawImage(spr, MX(d.x[i]) - 6, MY(d.y[i]) - 6);
      if (f < 0.9995) {                                             // jüngste Schläge hell, Ring am aktuellen
        g.fillStyle = 'rgba(255,255,255,.85)';
        for (i = Math.max(0, n - 24); i < n; i++) { g.beginPath(); g.arc(MX(d.x[i]), MY(d.y[i]), 4, 0, 7); g.fill(); }
        var lx = MX(d.x[n - 1]), ly = MY(d.y[n - 1]);
        g.strokeStyle = '#fff'; g.lineWidth = 4; g.beginPath(); g.arc(lx, ly, 22, 0, 7); g.stroke();
      }
      if (kreuz !== null && kreuz < n) {
        var kx = MX(d.x[kreuz]), ky = MY(d.y[kreuz]);
        g.setLineDash([11, 11]); g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 2.5;
        g.beginPath(); g.moveTo(kx, P.y0); g.lineTo(kx, P.y1); g.moveTo(P.x0, ky); g.lineTo(P.x1, ky); g.stroke(); g.setLineDash([]);
        g.strokeStyle = CYAN; g.lineWidth = 4; g.beginPath(); g.arc(kx, ky, 20, 0, 7); g.stroke();
      }
      g.restore();
      if (kreuz !== null && kreuz < n) kasten(kreuz);
      // SD-Kasten
      var s = sd(n);
      g.fillStyle = '#030303'; g.fillRect(893, 756, 312, 92);
      g.fillStyle = '#fff'; g.font = '400 33px ' + MONO; g.textBaseline = 'alphabetic';
      g.fillText('SD1', 902, 791); g.fillText(s[0].toFixed(1) + ' ms', 993, 791);
      g.fillText('SD2', 902, 834); g.fillText(s[1].toFixed(1) + ' ms', 993, 834);
      // Zeitzeile
      g.fillStyle = PILL; g.fillRect(128, 1899, 440, 106);              // innerhalb der Pill (Ecken bleiben rund)
      var T = f * d.dauer;
      if (f >= 0.9995) {
        g.fillStyle = '#fff'; g.font = '600 36px ' + MONO; g.fillText('t ' + dauer(d.dauer), 131, 1941);
        g.fillStyle = 'rgba(235,235,235,.55)'; g.font = '400 29px -apple-system, system-ui, sans-serif'; g.fillText('Play formation', 131, 1992);
      } else {
        var e = dauer(T); g.fillStyle = '#fff'; g.font = '600 37px ' + MONO; g.fillText(e, 131, 1941);
        var bw = g.measureText(e).width; g.fillStyle = CYAN; g.font = '400 35px ' + MONO; g.fillText(uhr(T), 131 + bw + 18, 1941);
        g.fillStyle = 'rgba(235,235,235,.55)'; g.font = '400 29px ' + MONO;
        g.fillText('RRₙ ' + Math.round(d.x[n - 1]) + ' · RRₙ₊₁ ' + Math.round(d.y[n - 1]) + ' ms', 131, 1992);
      }
      // Regler
      g.fillStyle = PILL; g.fillRect(598, 1922, 540, 90);
      var kx2 = KNOPF.x0 + f * (KNOPF.x1 - KNOPF.x0);
      g.fillStyle = SPURGRAU; rund(SPUR.x0, SPUR.y0, SPUR.x1 - SPUR.x0, SPUR.y1 - SPUR.y0, 9); g.fill();
      g.fillStyle = CYAN; rund(SPUR.x0, SPUR.y0, Math.max(18, kx2 - SPUR.x0), SPUR.y1 - SPUR.y0, 9); g.fill();
      g.save(); g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 14; g.shadowOffsetY = 3;
      g.fillStyle = '#fff'; rund(kx2 - KNOPF.b / 2, KNOPF.y0, KNOPF.b, KNOPF.y1 - KNOPF.y0, 36); g.fill(); g.restore();
    }

    function kasten(i) {                                           // Info-Kasten wie die App
      var kx = MX(d.x[i]), ky = MY(d.y[i]), bw = 470, bh = 168;
      var bx = Math.min(P.x1 - bw - 14, Math.max(P.x0 + 14, kx - bw - 36)), by = Math.max(P.y0 + 14, Math.min(P.y1 - bh - 14, ky - bh - 36));
      if (kx - bw - 36 < P.x0 + 14) bx = Math.min(P.x1 - bw - 14, kx + 36);
      g.fillStyle = 'rgba(8,12,12,.94)'; rund(bx, by, bw, bh, 24); g.fill();
      g.strokeStyle = 'rgba(62,207,178,.45)'; g.lineWidth = 2.5; g.stroke();
      var t = d.t[i], hr = Math.round(60000 / d.x[i]), dr = Math.round(d.y[i] - d.x[i]);
      g.strokeStyle = '#fff'; g.lineWidth = 2.5; g.beginPath(); g.arc(bx + 34, by + 40, 11, 0, 7); g.moveTo(bx + 34, by + 32); g.lineTo(bx + 34, by + 40); g.lineTo(bx + 40, by + 44); g.stroke();
      g.fillStyle = '#fff'; g.font = '600 31px ' + MONO; g.fillText(dauer(t), bx + 56, by + 51);
      var w1 = g.measureText(dauer(t)).width; g.fillStyle = 'rgba(235,235,235,.55)'; g.font = '400 29px ' + MONO; g.fillText(' · ' + uhr(t), bx + 56 + w1, by + 51);
      g.fillStyle = CYAN; g.font = '700 37px ' + MONO; g.fillText('RRₙ ' + Math.round(d.x[i]) + ' → ' + Math.round(d.y[i]) + ' ms', bx + 22, by + 102);
      g.fillStyle = 'rgba(235,235,235,.6)'; g.font = '400 29px ' + MONO; g.fillText('HR ' + hr + ' bpm  ΔRR ' + (dr >= 0 ? '+' : '') + dr + ' ms', bx + 22, by + 146);
    }

    var plan = false;
    var neu = function () { if (!plan) { plan = true; requestAnimationFrame(function () { plan = false; zeichnen(); }); } };
    var punkt = function (cx, cy) { var r = cv.getBoundingClientRect(); return [(cx - r.left) / r.width * W, (cy - r.top) / r.height * H]; };
    var nahe = function (px, py) {
      var n = sichtbar(), best = -1, bd = 1e12, i, dx, dy, q;
      for (i = 0; i < n; i++) { dx = MX(d.x[i]) - px; dy = MY(d.y[i]) - py; q = dx * dx + dy * dy; if (q < bd) { bd = q; best = i; } }
      return best;
    };
    var imRegler = function (p) { return p[1] > 1890 && p[1] < 2035 && p[0] > 590 && p[0] < 1140; };
    var imPlot = function (p) { return p[0] > P.x0 && p[0] < P.x1 && p[1] > P.y0 && p[1] < P.y1; };
    var setzeF = function (px) { f = Math.max(0, Math.min(1, (px - KNOPF.x0) / (KNOPF.x1 - KNOPF.x0))); if (f > 0.995) f = 1; kreuz = null; neu(); };
    var stopAuto = function () { genutzt = true; if (auto) { cancelAnimationFrame(auto); auto = null; } };

    // Maus/Stift: Regler ziehen, auf der Wolke drücken = Fadenkreuz
    var modus = null, halte = null, tx = 0, ty = 0;
    cv.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'touch') return;
      var p = punkt(e.clientX, e.clientY);
      if (imRegler(p)) { stopAuto(); modus = 'regler'; setzeF(p[0]); cv.setPointerCapture(e.pointerId); }
      else if (imPlot(p)) { stopAuto(); modus = 'kreuz'; kreuz = nahe(p[0], p[1]); neu(); cv.setPointerCapture(e.pointerId); }
    });
    cv.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch' || !modus) return;
      var p = punkt(e.clientX, e.clientY);
      if (modus === 'regler') setzeF(p[0]); else { kreuz = nahe(p[0], p[1]); neu(); }
    });
    cv.addEventListener('pointerup', function () { modus = null; });
    // Finger: Regler sofort; Wolke erst nach kurzem Halten (die Seite bleibt scrollbar — wie in der App)
    cv.addEventListener('touchstart', function (e) {
      var t = e.touches[0], p = punkt(t.clientX, t.clientY); tx = t.clientX; ty = t.clientY;
      if (imRegler(p)) { stopAuto(); modus = 'regler'; setzeF(p[0]); e.preventDefault(); }
      else if (imPlot(p)) { clearTimeout(halte); halte = setTimeout(function () { stopAuto(); modus = 'kreuz'; kreuz = nahe(p[0], p[1]); neu(); if (navigator.vibrate) navigator.vibrate(8); }, 220); }
    }, { passive: false });
    cv.addEventListener('touchmove', function (e) {
      var t = e.touches[0];
      if (!modus) { if (Math.abs(t.clientX - tx) > 8 || Math.abs(t.clientY - ty) > 8) clearTimeout(halte); return; }
      e.preventDefault();
      var p = punkt(t.clientX, t.clientY);
      if (modus === 'regler') setzeF(p[0]); else { kreuz = nahe(p[0], p[1]); neu(); }
    }, { passive: false });
    cv.addEventListener('touchend', function () { clearTimeout(halte); modus = null; });
    cv.addEventListener('keydown', function (e) {
      var s = e.key === 'ArrowRight' ? 0.02 : e.key === 'ArrowLeft' ? -0.02 : 0;
      if (!s) return; e.preventDefault(); stopAuto(); f = Math.max(0, Math.min(1, f + s)); kreuz = null; neu();
    });

    // Selbstlauf einmal, wenn sichtbar: die Wolke baut sich auf („Play formation“), dann übernimmt der Nutzer
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var laufen = function () {
      if (genutzt) return; var t0 = performance.now(), f0 = f;
      var schritt = function (now) { if (genutzt) return; f = Math.min(1, f0 + (now - t0) / 14000); neu(); if (f < 1) auto = requestAnimationFrame(schritt); else auto = null; };
      auto = requestAnimationFrame(schritt);
    };

    fetch(dev.dataset.poincareLive).then(function (r) { return r.json(); }).then(function (j) {
      d = j; f = reduce ? 1 : 0; zeichnen(); cv.classList.add('bereit');
      if (!reduce && 'IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { io.disconnect(); setTimeout(laufen, 600); } }, { threshold: 0.6 });
        io.observe(cv);
      }
    }).catch(function () {});
  }
  function alle() { [].forEach.call(document.querySelectorAll('[data-poincare-live]'), init); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', alle); else alle();
})();
