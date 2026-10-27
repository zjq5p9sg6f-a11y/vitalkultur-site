/*
 * Poincaré live — die Karte der App, auf der Website bedienbar (vitalkultur, 27.10.2026).
 *
 * Hintergrund = echter App-Screenshot (Regler auf 0:00, Plot geleert:
 * WimHofBreathwork/scripts/app-tour/poincare_live_bg.py). Gezeichnet wird nur, was sich
 * bewegt: Punkte, SD-Kasten, Zeitzeile, Regler (Liquid Glass), Fadenkreuz mit Info-Kasten.
 * Beim Zoomen zeichnet die Karte — wie die App — Raster und Achsen selbst neu.
 * Die Paare kommen aus der App selbst (WebsitePoincareExportTests: korrigierte Reihe →
 * CarlonPoincarePaare) — dieselbe Wolke, dieselben SD-Werte wie auf dem iPhone.
 *
 * Gesten wie in der App (CI-Buch „EIN Gesten-Vokabular“):
 *   Touch  — Regler ziehen · halten + ziehen = Fadenkreuz · 2 Finger = verschieben ·
 *            aufziehen = Zoom · Doppeltipp = zurück
 *   Maus   — Regler ziehen · über der Wolke = Fadenkreuz · ziehen = verschieben ·
 *            Trackpad-Pinch / Ctrl+Rad = Zoom · Doppelklick = zurück
 * Beim ersten Erscheinen führt ein Geister-Finger die Bedienung einmal vor; jede eigene
 * Berührung beendet das sofort.
 *
 * Markup:
 *   <div class="device" data-poincare-live="/…/poincare-live.json" data-start="19:47:13">
 *     <img class="lp-bg" src="…bg.webp"> <canvas class="lp"></canvas> <img class="bezel" …>
 *   </div>
 * Alle Maße in Pixeln des App-Screenshots (1320 × 2868), gemessen am iPhone 17 Pro Max.
 */
(function () {
  var W = 1320, H = 2868;
  var P = { x0: 180, x1: 1259, y0: 752, y1: 1765, r: 24 };       // Plotfläche
  var SX = 0.8380, SY = 0.8384, X0 = 249, Y0 = 1695;              // 0 ms → (249, 1695); 1000 ms → (1087, 856,5)
  var KNOPF = { x0: 664, x1: 1065, y0: 1931, y1: 2003, b: 110 };
  var SPUR = { x0: 615, x1: 1121, y0: 1957, y1: 1975 };
  var CYAN = 'rgb(62,207,178)', PILL = 'rgb(56,56,56)', SPURGRAU = 'rgb(76,76,76)', KARTE = 'rgb(27,27,27)';
  var MONO = 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, monospace';
  var SANS = '-apple-system, system-ui, "Helvetica Neue", sans-serif';

  var css = document.createElement('style');
  css.textContent =
    '.lp-hinweis{position:absolute;left:50%;top:34%;z-index:4;transform:translate(-50%,-50%) scale(.96);max-width:84%;padding:12px 18px;border-radius:22px;' +
    'background:rgba(18,22,22,.5);-webkit-backdrop-filter:blur(18px) saturate(170%);backdrop-filter:blur(18px) saturate(170%);border:1px solid rgba(255,255,255,.2);' +
    'box-shadow:0 12px 34px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.18);color:#fff;text-align:center;font:500 12.5px/1.45 ' + SANS + ';' +
    'opacity:0;transition:opacity .45s ease,transform .45s cubic-bezier(.2,.8,.2,1);pointer-events:none}' +
    '.lp-hinweis b{display:block;font-weight:600;font-size:13.5px;margin-bottom:2px}' +
    '.lp-hinweis.zeigen{opacity:1;transform:translate(-50%,-50%) scale(1)}' +
    '.lp-finger{position:absolute;z-index:5;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;pointer-events:none;opacity:0;' +
    'background:radial-gradient(circle at 38% 32%,rgba(255,255,255,.6),rgba(255,255,255,.16) 62%);border:1.5px solid rgba(255,255,255,.8);' +
    'box-shadow:0 8px 20px rgba(0,0,0,.45);transition:opacity .3s ease,transform .18s ease}' +
    '.lp-finger.an{opacity:1}.lp-finger.druck{transform:scale(.8)}' +
    '.lp-finger.halten::after{content:"";position:absolute;inset:-10px;border-radius:50%;border:2px solid rgba(62,207,178,.8);animation:lpRing .5s ease-out forwards}' +
    '@keyframes lpRing{from{transform:scale(.5);opacity:1}to{transform:scale(1.25);opacity:0}}';
  document.head.appendChild(css);

  function init(dev) {
    var cv = dev.querySelector('canvas.lp');
    if (!cv) return;
    cv.width = W; cv.height = H;
    var g = cv.getContext('2d');
    var de = document.documentElement.lang === 'de';
    var maus = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    var start = (dev.dataset.start || '00:00:00').split(':').map(Number);
    var d = null, f = 0, kreuz = null, genutzt = false;
    var z = 1, ox = 0, oy = 0;                                     // Ansicht (Zoom, Verschiebung in Pixeln)
    var aktiv = 0, aktivZiel = 0, feder = null;

    var VX = function (ms) { return X0 + ms * SX * z + ox; };
    var VY = function (ms) { return Y0 - ms * SY * z + oy; };
    var gezoomt = function () { return z > 1.001; };

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

    // Beim Zoomen: Raster, Winkelhalbierende und Achsenzahlen neu — im Stil der App
    function raster() {
      var pxMs = SX * z, schritte = [10, 20, 25, 50, 100, 125, 250, 500], neben = 125, i;
      for (i = 0; i < schritte.length; i++) if (schritte[i] * pxMs >= 80) { neben = schritte[i]; break; }
      var haupt = neben * 4;
      var msX0 = (P.x0 - X0 - ox) / pxMs, msX1 = (P.x1 - X0 - ox) / pxMs;
      var msY0 = (Y0 + oy - P.y1) / (SY * z), msY1 = (Y0 + oy - P.y0) / (SY * z);
      g.fillStyle = KARTE; g.fillRect(56, P.y0 - 14, P.x0 - 58, P.y1 - P.y0 + 30); g.fillRect(P.x0 - 40, P.y1 + 2, P.x1 - P.x0 + 80, 48);
      g.save(); rund(P.x0, P.y0, P.x1 - P.x0, P.y1 - P.y0, P.r); g.fillStyle = '#0e0e0e'; g.fill(); g.clip();
      var m;
      for (m = Math.ceil(msX0 / neben) * neben; m <= msX1; m += neben) {
        var hx = m % haupt === 0; g.strokeStyle = hx ? 'rgb(150,150,150)' : 'rgb(54,54,54)'; g.lineWidth = hx ? 2.5 : 2;
        g.beginPath(); g.moveTo(VX(m), P.y0); g.lineTo(VX(m), P.y1); g.stroke();
      }
      for (m = Math.ceil(msY0 / neben) * neben; m <= msY1; m += neben) {
        var hy = m % haupt === 0; g.strokeStyle = hy ? 'rgb(150,150,150)' : 'rgb(54,54,54)'; g.lineWidth = hy ? 2.5 : 2;
        g.beginPath(); g.moveTo(P.x0, VY(m)); g.lineTo(P.x1, VY(m)); g.stroke();
      }
      g.setLineDash([14, 10]); g.strokeStyle = 'rgb(199,199,199)'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(VX(0), VY(0)); g.lineTo(VX(2500), VY(2500)); g.stroke(); g.setLineDash([]);
      g.restore();
      g.fillStyle = 'rgb(170,170,170)'; g.font = '400 30px ' + MONO;
      g.textAlign = 'right'; g.textBaseline = 'middle';
      for (m = Math.ceil(msY0 / haupt) * haupt; m <= msY1; m += haupt) if (VY(m) > P.y0 + 12 && VY(m) < P.y1 - 12) g.fillText(String(m), P.x0 - 8, VY(m));
      g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      for (m = Math.ceil(msX0 / haupt) * haupt; m <= msX1; m += haupt) if (VX(m) > P.x0 + 20 && VX(m) < P.x1 - 20) g.fillText(String(m), VX(m), P.y1 + 40);
      g.textAlign = 'left';
    }

    function zeichnen() {
      g.clearRect(0, 0, W, H);
      if (!d) return;
      var n = sichtbar(), i;
      if (gezoomt()) raster();
      // Wolke
      g.save(); rund(P.x0, P.y0, P.x1 - P.x0, P.y1 - P.y0, P.r); g.clip();
      for (i = 0; i < n; i++) g.drawImage(spr, VX(d.x[i]) - 6, VY(d.y[i]) - 6);
      if (f < 0.9995) {                                             // jüngste Schläge hell, Ring am aktuellen
        g.fillStyle = 'rgba(255,255,255,.85)';
        for (i = Math.max(0, n - 24); i < n; i++) { g.beginPath(); g.arc(VX(d.x[i]), VY(d.y[i]), 4, 0, 7); g.fill(); }
        g.strokeStyle = '#fff'; g.lineWidth = 4; g.beginPath(); g.arc(VX(d.x[n - 1]), VY(d.y[n - 1]), 22, 0, 7); g.stroke();
      }
      if (kreuz !== null && kreuz < n) {
        var kx = VX(d.x[kreuz]), ky = VY(d.y[kreuz]);
        g.setLineDash([11, 11]); g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 2.5;
        g.beginPath(); g.moveTo(kx, P.y0); g.lineTo(kx, P.y1); g.moveTo(P.x0, ky); g.lineTo(P.x1, ky); g.stroke(); g.setLineDash([]);
        g.strokeStyle = CYAN; g.lineWidth = 4; g.beginPath(); g.arc(kx, ky, 20, 0, 7); g.stroke();
      }
      g.restore();
      if (kreuz !== null && kreuz < n) kasten(kreuz);
      // SD-Kasten (beim Zoomen ganz, sonst nur die Werte)
      var s = sd(n);
      if (gezoomt()) { g.fillStyle = '#030303'; rund(878, 740, 328, 118, 22); g.fill(); g.strokeStyle = 'rgba(62,207,178,.32)'; g.lineWidth = 2.5; g.stroke(); }
      else { g.fillStyle = '#030303'; g.fillRect(893, 756, 312, 92); }
      g.fillStyle = '#fff'; g.font = '400 33px ' + MONO; g.textBaseline = 'alphabetic';
      g.fillText('SD1', 902, 791); g.fillText(s[0].toFixed(1) + ' ms', 993, 791);
      g.fillText('SD2', 902, 834); g.fillText(s[1].toFixed(1) + ' ms', 993, 834);
      // Zeitzeile (strikt im Inneren der Pill — Kante 1901–1903 bleibt)
      g.fillStyle = PILL; g.fillRect(128, 1906, 440, 118);
      var T = f * d.dauer;
      if (f >= 0.9995) {
        g.fillStyle = '#fff'; g.font = '600 36px ' + MONO; g.fillText('t ' + dauer(d.dauer), 131, 1941);
        g.fillStyle = 'rgba(235,235,235,.55)'; g.font = '400 29px ' + SANS; g.fillText('Play formation', 131, 1992);
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
      glasKnopf(kx2, aktiv);
    }

    // Liquid-Glass-Knopf wie iOS: in Ruhe weiß; angefasst wächst er, wird Glas und vergrößert die Spur darunter
    function glasKnopf(kx, a) {
      var cy = (KNOPF.y0 + KNOPF.y1) / 2, w = KNOPF.b * (1 + 0.32 * a), h = (KNOPF.y1 - KNOPF.y0) * (1 + 0.24 * a), x = kx - w / 2, y = cy - h / 2;
      if (a > 0.01) {
        g.save(); rund(x, y, w, h, h / 2); g.clip();
        var zz = 1.22, sw = w / zz, sh = h / zz;
        g.drawImage(cv, kx - sw / 2, cy - sh / 2, sw, sh, x, y, w, h);
        g.fillStyle = 'rgba(255,255,255,' + (0.10 + 0.9 * (1 - a)) + ')'; g.fillRect(x, y, w, h);
        var gl = g.createRadialGradient(kx, y + h * 0.18, 2, kx, y + h * 0.18, w * 0.55);
        gl.addColorStop(0, 'rgba(255,255,255,' + 0.42 * a + ')'); gl.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gl; g.fillRect(x, y, w, h * 0.6);
        g.restore();
        var rim = g.createLinearGradient(0, y, 0, y + h);
        rim.addColorStop(0, 'rgba(255,255,255,.95)'); rim.addColorStop(.5, 'rgba(255,255,255,.35)'); rim.addColorStop(1, 'rgba(255,255,255,.7)');
        g.save(); g.shadowColor = 'rgba(0,0,0,' + (0.28 + 0.12 * a) + ')'; g.shadowBlur = 18 + 10 * a; g.shadowOffsetY = 4 + 3 * a;
        g.strokeStyle = rim; g.lineWidth = 3; rund(x + 1.5, y + 1.5, w - 3, h - 3, h / 2 - 1.5); g.stroke(); g.restore();
      } else {
        g.save(); g.shadowColor = 'rgba(0,0,0,.32)'; g.shadowBlur = 16; g.shadowOffsetY = 4;
        var weiss = g.createLinearGradient(0, y, 0, y + h); weiss.addColorStop(0, '#ffffff'); weiss.addColorStop(1, '#eeeeee');
        g.fillStyle = weiss; rund(x, y, w, h, h / 2); g.fill(); g.restore();
        g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 1.5; rund(x + 1, y + 1, w - 2, h - 2, h / 2 - 1); g.stroke();
      }
    }

    function kasten(i) {                                           // Info-Kasten wie die App
      var kx = VX(d.x[i]), ky = VY(d.y[i]), bw = 470, bh = 168;
      var bx = kx - bw - 36, by = Math.max(P.y0 + 14, Math.min(P.y1 - bh - 14, ky - bh - 36));
      if (bx < P.x0 + 14) bx = Math.min(P.x1 - bw - 14, kx + 36);
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
    var fasse = function (an) {
      aktivZiel = an ? 1 : 0; if (feder) return;
      var schritt = function () { aktiv += (aktivZiel - aktiv) * 0.28; if (Math.abs(aktivZiel - aktiv) < 0.01) aktiv = aktivZiel; zeichnen(); feder = aktiv === aktivZiel ? null : requestAnimationFrame(schritt); };
      feder = requestAnimationFrame(schritt);
    };
    var punkt = function (cx, cy) { var r = cv.getBoundingClientRect(); return [(cx - r.left) / r.width * W, (cy - r.top) / r.height * H]; };
    var nahe = function (px, py) {
      var n = sichtbar(), best = -1, bd = 1e12, i, dx, dy, q;
      for (i = 0; i < n; i++) { dx = VX(d.x[i]) - px; dy = VY(d.y[i]) - py; q = dx * dx + dy * dy; if (q < bd) { bd = q; best = i; } }
      return best;
    };
    var imRegler = function (p) { return p[1] > 1890 && p[1] < 2035 && p[0] > 590 && p[0] < 1140; };
    var imPlot = function (p) { return p[0] > P.x0 && p[0] < P.x1 && p[1] > P.y0 && p[1] < P.y1; };
    var setzeF = function (px) { f = Math.max(0, Math.min(1, (px - KNOPF.x0) / (KNOPF.x1 - KNOPF.x0))); if (f > 0.995) f = 1; kreuz = null; neu(); };

    // Zoom um einen Bildpunkt, Verschiebung in Grenzen (die Wolke bleibt erreichbar)
    var begrenzen = function () {
      if (z <= 1.001) { z = 1; ox = 0; oy = 0; return; }
      ox = Math.max(351 - 1005 * z, Math.min(651 - 209.5 * z, ox));
      oy = Math.max(209.6 * z - 445, Math.min(1006 * z - 445, oy));
    };
    var zoomUm = function (px, py, nz) {
      nz = Math.max(1, Math.min(12, nz));
      var mx = (px - X0 - ox) / (SX * z), my = (Y0 + oy - py) / (SY * z);
      z = nz; ox = px - X0 - mx * SX * z; oy = py - Y0 + my * SY * z; begrenzen(); neu();
    };
    var zurueck = function () { z = 1; ox = 0; oy = 0; neu(); };

    // ── Geister-Finger + Hinweis ──
    var hinweis = document.createElement('div'); hinweis.className = 'lp-hinweis'; hinweis.setAttribute('aria-hidden', 'true');
    hinweis.innerHTML = de
      ? '<b>Du bist dran</b>Regler ziehen · ' + (maus ? 'Maus über die Wolke · Pinch = Zoom' : 'auf der Wolke halten · zwei Finger = Zoom')
      : '<b>Your turn</b>Drag the slider · ' + (maus ? 'hover the cloud · pinch to zoom' : 'hold on the cloud · pinch to zoom');
    var finger = document.createElement('div'); finger.className = 'lp-finger'; finger.setAttribute('aria-hidden', 'true');
    dev.appendChild(hinweis); dev.appendChild(finger);
    var setzeFinger = function (cx, cy) { finger.style.left = (5.102 + 89.796 * cx / W) + '%'; finger.style.top = (2.2 + 95.6 * cy / H) + '%'; };
    var uhren = [];
    var spaeter = function (fn, ms) { uhren.push(setTimeout(fn, ms)); };
    var animiere = function (dauerMs, schritt, fertig) {
      var t0 = performance.now();
      var lauf = function (now) { if (genutzt) return; var q = Math.min(1, (now - t0) / dauerMs), e = q < .5 ? 2 * q * q : 1 - Math.pow(-2 * q + 2, 2) / 2; schritt(e); if (q < 1) requestAnimationFrame(lauf); else if (fertig) fertig(); };
      requestAnimationFrame(lauf);
    };
    var hinweisZeigen = function (ms) { hinweis.classList.add('zeigen'); spaeter(function () { hinweis.classList.remove('zeigen'); }, ms); };
    var vorfuehren = function () {
      if (genutzt) return;
      hinweis.classList.add('zeigen');
      setzeFinger(KNOPF.x0 + f * (KNOPF.x1 - KNOPF.x0), 1967);
      spaeter(function () { finger.classList.add('an'); }, 500);
      spaeter(function () {
        finger.classList.add('druck'); fasse(true);
        var f0 = f, f1 = 0.62;
        animiere(2400, function (e) { f = f0 + (f1 - f0) * e; setzeFinger(KNOPF.x0 + f * (KNOPF.x1 - KNOPF.x0), 1967); neu(); }, function () {
          finger.classList.remove('druck'); fasse(false);
          var n = sichtbar(), ziel = Math.floor(n * 0.72), zx = VX(d.x[ziel]), zy = VY(d.y[ziel]), sx = KNOPF.x0 + f * (KNOPF.x1 - KNOPF.x0);
          animiere(700, function (e) { setzeFinger(sx + (zx - sx) * e, 1967 + (zy - 1967) * e); }, function () {
            finger.classList.add('druck', 'halten');
            spaeter(function () {
              if (genutzt) return;
              var i0 = ziel; kreuz = i0; neu();
              animiere(1500, function (e) { var i = Math.min(n - 1, i0 + Math.round(e * 60)); kreuz = i; setzeFinger(VX(d.x[i]), VY(d.y[i])); neu(); }, function () {
                finger.classList.remove('druck', 'halten', 'an');
                spaeter(function () { hinweis.classList.remove('zeigen'); }, 2600);
              });
            }, 500);
          });
        });
      }, 1100);
    };
    var nutzerDa = function () {
      if (genutzt) return; genutzt = true;
      uhren.forEach(clearTimeout); hinweis.classList.remove('zeigen'); finger.classList.remove('an', 'druck', 'halten');
    };

    // ── Maus/Stift ──
    var modus = null, panStart = null;
    cv.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'touch') return;
      nutzerDa();
      var p = punkt(e.clientX, e.clientY);
      if (imRegler(p)) { modus = 'regler'; fasse(true); setzeF(p[0]); cv.setPointerCapture(e.pointerId); }
      else if (imPlot(p) && gezoomt()) { modus = 'pan'; panStart = [p[0], p[1], ox, oy]; cv.setPointerCapture(e.pointerId); cv.style.cursor = 'grabbing'; }
    });
    cv.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      var p = punkt(e.clientX, e.clientY);
      if (modus === 'regler') { setzeF(p[0]); return; }
      if (modus === 'pan') { ox = panStart[2] + p[0] - panStart[0]; oy = panStart[3] + p[1] - panStart[1]; begrenzen(); neu(); return; }
      if (imPlot(p)) { if (!genutzt && e.movementX * e.movementX + e.movementY * e.movementY > 4) nutzerDa(); if (genutzt) { kreuz = nahe(p[0], p[1]); neu(); } cv.style.cursor = gezoomt() ? 'grab' : 'crosshair'; }
      else { cv.style.cursor = imRegler(p) ? 'ew-resize' : 'default'; if (kreuz !== null && genutzt) { kreuz = null; neu(); } }
    });
    var mausLos = function () { if (modus === 'regler') fasse(false); if (modus === 'pan') cv.style.cursor = 'grab'; modus = null; };
    cv.addEventListener('pointerup', mausLos); cv.addEventListener('pointercancel', mausLos);
    cv.addEventListener('pointerleave', function (e) { if (e.pointerType !== 'touch' && !modus && kreuz !== null && genutzt) { kreuz = null; neu(); } });
    cv.addEventListener('dblclick', function () { nutzerDa(); zurueck(); });
    cv.addEventListener('wheel', function (e) {                       // Trackpad-Pinch kommt als Rad mit Ctrl
      if (!e.ctrlKey) return;
      var p = punkt(e.clientX, e.clientY); if (!imPlot(p)) return;
      e.preventDefault(); nutzerDa(); zoomUm(p[0], p[1], z * Math.exp(-e.deltaY * 0.012));
    }, { passive: false });
    var gz = 1, gp = null;                                            // Safari macOS: Pinch als GestureEvent
    cv.addEventListener('gesturestart', function (e) { e.preventDefault(); gz = z; gp = punkt(e.clientX, e.clientY); nutzerDa(); });
    cv.addEventListener('gesturechange', function (e) { e.preventDefault(); if (gp && imPlot(gp)) zoomUm(gp[0], gp[1], gz * e.scale); });

    // ── Finger: Regler sofort; Wolke erst nach kurzem Halten; zwei Finger = verschieben + Zoom ──
    var halte = null, tx = 0, ty = 0, zweiStart = null, tippZeit = 0, bewegt = false;
    var mitte = function (t) { return punkt((t[0].clientX + t[1].clientX) / 2, (t[0].clientY + t[1].clientY) / 2); };
    var abstand = function (t) { var dx = t[0].clientX - t[1].clientX, dy = t[0].clientY - t[1].clientY; return Math.sqrt(dx * dx + dy * dy); };
    cv.addEventListener('touchstart', function (e) {
      nutzerDa();
      if (e.touches.length === 2) {
        clearTimeout(halte); if (modus === 'regler') fasse(false); modus = 'zwei'; kreuz = null;
        zweiStart = { c: mitte(e.touches), a: abstand(e.touches), z: z, ox: ox, oy: oy };
        e.preventDefault(); return;
      }
      var t = e.touches[0], p = punkt(t.clientX, t.clientY); tx = t.clientX; ty = t.clientY; bewegt = false;
      if (imRegler(p)) { modus = 'regler'; fasse(true); setzeF(p[0]); e.preventDefault(); }
      else if (imPlot(p)) { clearTimeout(halte); halte = setTimeout(function () { modus = 'kreuz'; kreuz = nahe(p[0], p[1]); neu(); if (navigator.vibrate) navigator.vibrate(8); }, 220); }
    }, { passive: false });
    cv.addEventListener('touchmove', function (e) {
      if (modus === 'zwei' && e.touches.length === 2) {
        e.preventDefault();
        var m = mitte(e.touches), s = zweiStart;
        var mx = (s.c[0] - X0 - s.ox) / (SX * s.z), my = (Y0 + s.oy - s.c[1]) / (SY * s.z);
        z = Math.max(1, Math.min(12, s.z * abstand(e.touches) / s.a));
        ox = m[0] - X0 - mx * SX * z; oy = m[1] - Y0 + my * SY * z; begrenzen(); neu(); return;
      }
      var t = e.touches[0];
      if (Math.abs(t.clientX - tx) > 8 || Math.abs(t.clientY - ty) > 8) bewegt = true;
      if (!modus) { if (bewegt) clearTimeout(halte); return; }
      e.preventDefault();
      var p = punkt(t.clientX, t.clientY);
      if (modus === 'regler') setzeF(p[0]); else if (modus === 'kreuz') { kreuz = nahe(p[0], p[1]); neu(); }
    }, { passive: false });
    cv.addEventListener('touchend', function (e) {
      clearTimeout(halte);
      if (modus === 'regler') fasse(false);
      if (modus === 'zwei' && e.touches.length === 1) { modus = null; return; }
      if (!modus && !bewegt) {                                      // Doppeltipp = Ansicht zurück
        var jetzt = Date.now(); if (jetzt - tippZeit < 320) { zurueck(); tippZeit = 0; } else tippZeit = jetzt;
      }
      if (e.touches.length === 0) modus = null;
    });
    cv.addEventListener('keydown', function (e) {
      var s = e.key === 'ArrowRight' ? 0.02 : e.key === 'ArrowLeft' ? -0.02 : 0;
      if (e.key === '+' || e.key === '=') { nutzerDa(); zoomUm((P.x0 + P.x1) / 2, (P.y0 + P.y1) / 2, z * 1.4); return; }
      if (e.key === '-') { nutzerDa(); zoomUm((P.x0 + P.x1) / 2, (P.y0 + P.y1) / 2, z / 1.4); return; }
      if (e.key === '0') { nutzerDa(); zurueck(); return; }
      if (!s) return; e.preventDefault(); nutzerDa(); f = Math.max(0, Math.min(1, f + s)); kreuz = null; neu();
    });

    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    fetch(dev.dataset.poincareLive).then(function (r) { return r.json(); }).then(function (j) {
      d = j; f = reduce ? 1 : 0; zeichnen(); cv.classList.add('bereit');
      if (!('IntersectionObserver' in window)) return;
      var erstes = true;
      new IntersectionObserver(function (es) {
        if (!es[0].isIntersecting || genutzt) return;
        if (erstes && !reduce) { erstes = false; setTimeout(vorfuehren, 500); }
        else hinweisZeigen(3200);                                   // beim erneuten Vorbeiscrollen kurz erinnern
      }, { threshold: 0.6 }).observe(cv);
    }).catch(function () {});
  }
  function alle() { [].forEach.call(document.querySelectorAll('[data-poincare-live]'), init); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', alle); else alle();
})();
