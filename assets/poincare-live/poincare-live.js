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
  var P = { x0: 180, x1: 1224, y0: 720, y1: 1765, r: 24 };       // Plotfläche — am Hintergrund vermessen (27.10.: 1259/752 ließen den Zoom rechts über die Karte und oben das Original stehen)
  var SX = 0.8380, SY = 0.8384, X0 = 249, Y0 = 1695;              // 0 ms → (249, 1695); 1000 ms → (1087, 856,5)
  var KNOPF = { x0: 664, x1: 1065, y0: 1931, y1: 2003, b: 110 };
  var SPUR = { x0: 615, x1: 1121, y0: 1957, y1: 1975 };
  var CYAN = 'rgb(62,207,178)', PILL = 'rgb(56,56,56)', SPURGRAU = 'rgb(76,76,76)', KARTE = 'rgb(27,27,27)';
  var MONO = 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, monospace';
  var SANS = '-apple-system, system-ui, "Helvetica Neue", sans-serif';

  var css = document.createElement('style');
  css.textContent =
    '.lp-tipp{position:absolute;z-index:6;transform:translate(-50%,calc(-100% - 14px)) scale(.92);transform-origin:50% 100%;padding:8px 13px 9px;border-radius:14px;white-space:nowrap;' +
    'background:linear-gradient(rgba(58,62,62,.94),rgba(34,37,37,.94));' +
    'border:.5px solid rgba(255,255,255,.28);box-shadow:0 10px 28px rgba(0,0,0,.5),inset 0 .5px 0 rgba(255,255,255,.35);' +
    'color:#fff;font:600 12.5px/1.25 ' + SANS + ';letter-spacing:-.005em;opacity:0;pointer-events:none;' +
    'transition:opacity .35s ease,transform .5s cubic-bezier(.2,.9,.25,1)}' +
    '.lp-tipp small{display:block;font-weight:500;font-size:11px;color:rgba(255,255,255,.62);margin-top:1px}' +
    '.lp-tipp::after{content:"";position:absolute;left:50%;bottom:-6px;width:12px;height:12px;margin-left:-6px;transform:rotate(45deg);border-radius:2px;' +
    'background:rgba(34,37,37,.94);border-right:.5px solid rgba(255,255,255,.22);border-bottom:.5px solid rgba(255,255,255,.22)}' +
    '.lp-tipp.zeigen{opacity:1;transform:translate(-50%,calc(-100% - 14px)) scale(1)}' +
    '.lp-finger{position:absolute;z-index:5;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;pointer-events:none;opacity:0;' +
    'background:rgba(255,255,255,.26);border:2px solid rgba(255,255,255,.9);box-shadow:0 0 0 7px rgba(255,255,255,.07),0 10px 26px rgba(0,0,0,.5);' +
    'transition:opacity .35s ease,transform .22s cubic-bezier(.2,.9,.25,1),background .22s ease}' +
    '.lp-finger.an{opacity:1}.lp-finger.druck{transform:scale(.84);background:rgba(255,255,255,.42)}' +
    '.lp-finger.halten::before,.lp-finger.halten::after{content:"";position:absolute;inset:-4px;border-radius:50%;border:2px solid rgba(62,207,178,.85);animation:lpRing 1.1s cubic-bezier(.2,.7,.3,1) infinite}' +
    '.lp-finger.halten::after{animation-delay:.55s}' +
    '@keyframes lpRing{from{transform:scale(.7);opacity:.9}to{transform:scale(1.9);opacity:0}}' +
    '@media (prefers-reduced-motion:reduce){.lp-tipp,.lp-finger{transition:opacity .2s}.lp-finger.halten::before,.lp-finger.halten::after{animation:none}}';
  document.head.appendChild(css);

  function init(dev) {
    var cv = dev.querySelector('canvas.lp');
    if (!cv) return;
    var g = cv.getContext('2d'), k = 1;
    // Wolke: eigene Ebene nur so groß wie der Plot; Schnappschüsse alle 1000 Punkte → Rückwärtsziehen zeichnet ≤ 1000 nach
    var wolke = document.createElement('canvas'), wg = wolke.getContext('2d'), wolkeN = 0, wolkeSicht = '', stand = [], SCHRITT = 1000;
    var PW = P.x1 - P.x0, PH = P.y1 - P.y0;
    // Rechenfläche so groß wie sichtbar (× Pixeldichte) statt 1320 × 2868 — sonst ruckelt das Ziehen auf dem iPhone
    var groesse = function () {
      var b = cv.getBoundingClientRect(); if (!b.width) return;
      var px = Math.round(b.width * Math.min(2.5, window.devicePixelRatio || 1));
      if (px === cv.width) return;
      cv.width = px; cv.height = Math.round(px * H / W); k = px / W;
      wolke.width = Math.ceil(PW * k); wolke.height = Math.ceil(PH * k);
      g.setTransform(k, 0, 0, k, 0, 0); wg.setTransform(k, 0, 0, k, -P.x0 * k, -P.y0 * k); wolkeSicht = ''; neu();
    };
    var de = document.documentElement.lang === 'de';
    var maus = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    var start = (dev.dataset.start || '00:00:00').split(':').map(Number);
    var d = null, f = 0, fZiel = 0, kreuz = null, genutzt = false;
    var z = 1, ox = 0, oy = 0;                                     // Ansicht (Zoom, Verschiebung in Pixeln)
    // Während Pinch/Verschieben: fertiges Wolkenbild nur transformieren (wie Karten), danach scharf neu (27.10.: Jan „Ranzoomen nicht geil")
    var geste = false, gesteUhr = null, basis = null, basisSicht = null;
    var aktiv = 0, aktivZiel = 0;

    var VX = function (ms) { return X0 + ms * SX * z + ox; };
    var VY = function (ms) { return Y0 - ms * SY * z + oy; };
    var gezoomt = function () { return z > 1.001; };


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
    var sdN = -1, sdW = null;
    var sd = function (n) { if (n !== sdN) { sdN = n; sdW = sdRoh(n); } return sdW; };
    var sdRoh = function (n) {                                     // wie EquinePoincareRenderer beim Spulen
      if (n >= d.x.length) return [d.sd1_voll, d.sd2_voll];        // volle Ansicht = Analyse (sd1SD2Override)
      var ma = 0, ms = 0, i, a, s;
      for (i = 0; i < n; i++) { ma += d.y[i] - d.x[i]; ms += d.y[i] + d.x[i]; }
      ma /= n; ms /= n; var va = 0, vs = 0;
      for (i = 0; i < n; i++) { a = d.y[i] - d.x[i] - ma; s = d.y[i] + d.x[i] - ms; va += a * a; vs += s * s; }
      return [Math.sqrt(va / (n - 1) / 2), Math.sqrt(vs / (n - 1) / 2)];
    };
    function rund(x, y, w, h, r, c) { c = c || g; c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }

    // Beim Zoomen: Raster, Winkelhalbierende und Achsenzahlen neu — im Stil der App
    function raster() {
      var pxMs = SX * z, schritte = [10, 20, 25, 50, 100, 125, 250, 500], neben = 125, i;
      for (i = 0; i < schritte.length; i++) if (schritte[i] * pxMs >= 80) { neben = schritte[i]; break; }
      var haupt = neben * 4;
      var msX0 = (P.x0 - X0 - ox) / pxMs, msX1 = (P.x1 - X0 - ox) / pxMs;
      var msY0 = (Y0 + oy - P.y1) / (SY * z), msY1 = (Y0 + oy - P.y0) / (SY * z);
      g.fillStyle = KARTE; g.fillRect(64, P.y0 - 14, P.x0 - 66, P.y1 - P.y0 + 30); g.fillRect(64, P.y1 + 2, 1254 - 64, 48);   // nur innerhalb der Karte (62…1257)
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
      var t0 = window.__lpZeit ? performance.now() : 0;
      zeichnenInnen();
      if (t0) window.__lpZeit.push(performance.now() - t0);
    }
    function zeichnenInnen() {
      g.clearRect(0, 0, W, H);
      if (!d) return;
      var n = sichtbar(), i, sicht = z + '|' + ox + '|' + oy + '|' + cv.width;
      if (gezoomt()) raster();
      // Wolke: eigene Ebene, beim Vorwärtsziehen kommen nur die neuen Punkte dazu
      if (sicht !== wolkeSicht && geste && basis) {
        var sk = z / basisSicht.z, tx = X0 - sk * X0 - sk * basisSicht.ox + ox, ty = Y0 - sk * Y0 - sk * basisSicht.oy + oy;
        g.save(); rund(P.x0, P.y0, P.x1 - P.x0, P.y1 - P.y0, P.r); g.clip();
        g.translate(tx, ty); g.scale(sk, sk); g.drawImage(basis, P.x0, P.y0, PW, PH); g.restore();
        return rest(n);
      }
      if (sicht !== wolkeSicht) { wg.save(); wg.setTransform(1, 0, 0, 1, 0, 0); wg.clearRect(0, 0, wolke.width, wolke.height); wg.restore(); wolkeN = 0; wolkeSicht = sicht; stand = []; }
      if (n < wolkeN) {                                              // zurück: nächster Schnappschuss darunter
        var j = Math.min(stand.length - 1, Math.floor(n / SCHRITT));
        wg.save(); wg.setTransform(1, 0, 0, 1, 0, 0); wg.clearRect(0, 0, wolke.width, wolke.height);
        if (j >= 0) wg.drawImage(stand[j], 0, 0);
        wg.restore(); wolkeN = j >= 0 ? j * SCHRITT : 0;
      }
      var bis = Math.min(n, wolkeN + (wolkeN === 0 ? n : 1500));   // neue Ansicht: alles in EINEM Pfad; beim Spulen Budget je Bild
      if (bis < n) neu();
      if (bis > wolkeN) {
        wg.save(); rund(P.x0, P.y0, PW, PH, P.r, wg); wg.clip();   // Pfad auf DER Ebene, die schneidet (27.10.: leere Wolke)
        // EIN Füllpfad je Bild statt hunderter drawImage — die Kosten fallen erst beim Rendern an, nicht im JS (27.10.: Regler ruckelte)
        wg.fillStyle = CYAN; wg.globalAlpha = .9;
        var von = wolkeN;
        while (von < bis) {
          var stop = Math.min(bis, (Math.floor(von / SCHRITT) + 1) * SCHRITT);
          wg.beginPath();
          for (i = von; i < stop; i++) { var px = VX(d.x[i]), py = VY(d.y[i]); wg.moveTo(px + 4.2, py); wg.arc(px, py, 4.2, 0, 6.2832); }
          wg.fill(); von = stop;
          if (stop % SCHRITT === 0 && !stand[stop / SCHRITT]) {
            var sn = document.createElement('canvas'); sn.width = wolke.width; sn.height = wolke.height; sn.getContext('2d').drawImage(wolke, 0, 0); stand[stop / SCHRITT] = sn;
          }
        }
        wg.globalAlpha = 1; wg.restore(); wolkeN = bis;
      }
      if (!stand[0]) { stand[0] = document.createElement('canvas'); stand[0].width = wolke.width; stand[0].height = wolke.height; }
      g.drawImage(wolke, P.x0, P.y0, PW, PH);
      rest(n);
    }
    function rest(n) {
      var i;
      g.save(); rund(P.x0, P.y0, P.x1 - P.x0, P.y1 - P.y0, P.r); g.clip();
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
    var schatten = null;                                           // weicher Schatten einmal gerendert (shadowBlur je Bild ruckelt)
    function glasKnopf(kx, a) {
      var cy = (KNOPF.y0 + KNOPF.y1) / 2, w = KNOPF.b * (1 + 0.32 * a), h = (KNOPF.y1 - KNOPF.y0) * (1 + 0.24 * a), x = kx - w / 2, y = cy - h / 2;
      if (!schatten) {
        schatten = document.createElement('canvas'); schatten.width = 220; schatten.height = 140;
        var sc = schatten.getContext('2d'); sc.shadowColor = 'rgba(0,0,0,.34)'; sc.shadowBlur = 18; sc.shadowOffsetY = 1000;
        sc.fillStyle = '#000'; rund(50, 34 - 1000, 120, 72, 36, sc); sc.fill();
      }
      g.drawImage(schatten, kx - w * 110 / 120, cy - h * 70 / 72 + 4 + 3 * a, w * 220 / 120, h * 140 / 72);
      if (a > 0.01) {
        g.save(); rund(x, y, w, h, h / 2); g.clip();
        g.fillStyle = PILL; g.fillRect(x, y, w, h);
        g.translate(kx, cy); g.scale(1.22, 1.22); g.translate(-kx, -cy);      // Lupe: Spur darunter 1,22×
        g.fillStyle = SPURGRAU; rund(SPUR.x0, SPUR.y0, SPUR.x1 - SPUR.x0, SPUR.y1 - SPUR.y0, 9); g.fill();
        g.fillStyle = CYAN; rund(SPUR.x0, SPUR.y0, Math.max(18, kx - SPUR.x0), SPUR.y1 - SPUR.y0, 9); g.fill();
        g.setTransform(k, 0, 0, k, 0, 0); rund(x, y, w, h, h / 2); g.clip();
        g.fillStyle = 'rgba(255,255,255,' + (0.10 + 0.9 * (1 - a)) + ')'; g.fillRect(x, y, w, h);
        var gl = g.createRadialGradient(kx, y + h * 0.18, 2, kx, y + h * 0.18, w * 0.55);
        gl.addColorStop(0, 'rgba(255,255,255,' + 0.42 * a + ')'); gl.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gl; g.fillRect(x, y, w, h * 0.6);
        g.restore();
        var rim = g.createLinearGradient(0, y, 0, y + h);
        rim.addColorStop(0, 'rgba(255,255,255,.95)'); rim.addColorStop(.5, 'rgba(255,255,255,.35)'); rim.addColorStop(1, 'rgba(255,255,255,.7)');
        g.strokeStyle = rim; g.lineWidth = 3; rund(x + 1.5, y + 1.5, w - 3, h - 3, h / 2 - 1.5); g.stroke();
      } else {
        var weiss = g.createLinearGradient(0, y, 0, y + h); weiss.addColorStop(0, '#ffffff'); weiss.addColorStop(1, '#eeeeee');
        g.fillStyle = weiss; rund(x, y, w, h, h / 2); g.fill();
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
    var takt = function () {
      plan = false;
      if (aktiv !== aktivZiel) { aktiv += (aktivZiel - aktiv) * 0.28; if (Math.abs(aktivZiel - aktiv) < 0.01) aktiv = aktivZiel; }
      if (f !== fZiel) { f += (fZiel - f) * 0.38; if (Math.abs(fZiel - f) < 0.0008) f = fZiel; }
      zeichnen();
      if (aktiv !== aktivZiel || f !== fZiel) neu();
    };
    var neu = function () { if (!plan) { plan = true; requestAnimationFrame(takt); } };
    var fasse = function (an) { aktivZiel = an ? 1 : 0; neu(); };
    var punkt = function (cx, cy) { var r = cv.getBoundingClientRect(); return [(cx - r.left) / r.width * W, (cy - r.top) / r.height * H]; };
    var nahe = function (px, py) {
      var n = sichtbar(), best = -1, bd = 1e12, i, dx, dy, q;
      for (i = 0; i < n; i++) { dx = VX(d.x[i]) - px; dy = VY(d.y[i]) - py; q = dx * dx + dy * dy; if (q < bd) { bd = q; best = i; } }
      return best;
    };
    var imRegler = function (p) { return p[1] > 1890 && p[1] < 2035 && p[0] > 590 && p[0] < 1140; };
    var imPlot = function (p) { return p[0] > P.x0 && p[0] < P.x1 && p[1] > P.y0 && p[1] < P.y1; };
    var zieheF = function () { neu(); };                            // Knopf folgt weich (wie iOS) — Feder im Bild-Takt
    var setzeF = function (px) { fZiel = Math.max(0, Math.min(1, (px - KNOPF.x0) / (KNOPF.x1 - KNOPF.x0))); if (fZiel > 0.995) fZiel = 1; kreuz = null; zieheF(); };

    // Zoom um einen Bildpunkt, Verschiebung in Grenzen (die Wolke bleibt erreichbar)
    // Die Wolke darf nie aus dem Bild rutschen (27.10.: zweites Aufziehen zeigte leeres Raster):
    // liegt kein SICHTBARER Schlag nahe der Bildmitte, rückt die Ansicht zum nächsten heran
    var begrenzen = function () {
      if (z <= 1.001) { z = 1; ox = 0; oy = 0; return; }
      var cx = (P.x0 + P.x1) / 2, cy = (P.y0 + P.y1) / 2;
      var mx = (cx - X0 - ox) / (SX * z), my = (Y0 + oy - cy) / (SY * z);
      var hx = (P.x1 - P.x0) / 2 / (SX * z) * 0.6, hy = (P.y1 - P.y0) / 2 / (SY * z) * 0.6;
      var n = sichtbar(), best = 0, bd = 1e18, i, dx, dy, q;
      for (i = 0; i < n; i++) { dx = (d.x[i] - mx) / hx; dy = (d.y[i] - my) / hy; q = dx * dx + dy * dy; if (q < bd) { bd = q; best = i; } }
      if (bd > 0.09) {                                              // Mitte leer: zum Schwerpunkt der Schläge um den nächsten
        var sx = 0, sy = 0, k2 = 0, bx = d.x[best], by = d.y[best];
        for (i = 0; i < n; i++) { dx = (d.x[i] - bx) / hx; dy = (d.y[i] - by) / hy; if (dx * dx + dy * dy < 1) { sx += d.x[i]; sy += d.y[i]; k2++; } }
        var gx = sx / k2, gy = sy / k2, rx = hx * 0.3, ry = hy * 0.3;
        mx = Math.max(gx - rx, Math.min(gx + rx, mx)); my = Math.max(gy - ry, Math.min(gy + ry, my));
      }
      ox = cx - X0 - mx * SX * z; oy = cy - Y0 + my * SY * z;
    };
    var zoomUm = function (px, py, nz) {
      nz = Math.max(1, Math.min(12, nz));
      var mx = (px - X0 - ox) / (SX * z), my = (Y0 + oy - py) / (SY * z);
      gesteAn(); z = nz; ox = px - X0 - mx * SX * z; oy = py - Y0 + my * SY * z; begrenzen(); neu();
    };
    var zurueck = function () { z = 1; ox = 0; oy = 0; geste = false; neu(); };
    var gesteAn = function () {                                     // Wolkenbild der aktuellen Ansicht einfrieren
      clearTimeout(gesteUhr);
      if (!geste) {
        geste = true;
        if (!basis) basis = document.createElement('canvas');
        basis.width = wolke.width; basis.height = wolke.height; basis.getContext('2d').drawImage(wolke, 0, 0);
        basisSicht = { z: z, ox: ox, oy: oy };
      }
      gesteUhr = setTimeout(function () { geste = false; neu(); }, 160);   // Ruhe → scharf neu zeichnen
    };

    // ── Coach-Marks wie Apple: Sprechblase am Element + Berührungspunkt, weiche Bögen ──
    var T = de
      ? { zieh: ['Ziehen', 'die Sitzung läuft Schlag für Schlag ab'], halt: [maus ? 'Darüberfahren' : 'Halten', 'jeden Schlag mit Uhrzeit ansehen'],
          zoom: [maus ? 'Pinch zum Zoomen' : 'Aufziehen zum Zoomen', maus ? 'Doppelklick: zurück' : 'Doppeltipp: zurück'] }
      : { zieh: ['Drag', 'replay the session beat by beat'], halt: [maus ? 'Hover' : 'Hold', 'inspect any beat with its clock time'],
          zoom: [maus ? 'Pinch to zoom' : 'Pinch to zoom', maus ? 'Double-click to reset' : 'Double-tap to reset'] };
    var tipp = document.createElement('div'); tipp.className = 'lp-tipp'; tipp.setAttribute('aria-hidden', 'true');
    var finger = document.createElement('div'); finger.className = 'lp-finger'; finger.setAttribute('aria-hidden', 'true');
    var finger2 = finger.cloneNode(); dev.appendChild(tipp); dev.appendChild(finger); dev.appendChild(finger2);
    var prozent = function (cx, cy) { return [(5.102 + 89.796 * cx / W) + '%', (2.2 + 95.6 * cy / H) + '%']; };
    var setzeFinger = function (cx, cy, el) { var q = prozent(cx, cy); el = el || finger; el.style.left = q[0]; el.style.top = q[1]; };
    var zeigeTipp = function (t, cx, cy) {
      tipp.classList.remove('zeigen');
      setTimeout(function () { tipp.innerHTML = t[0] + '<small>' + t[1] + '</small>'; var q = prozent(cx, cy); tipp.style.left = q[0]; tipp.style.top = q[1]; tipp.classList.add('zeigen'); }, 120);
    };
    var uhren = [], lauf = 0;                                       // lauf: jede neue Vorführung beendet die alte
    var spaeter = function (fn, ms) { uhren.push(setTimeout(fn, ms)); };
    var weich = function (q) { return q < .5 ? 4 * q * q * q : 1 - Math.pow(-2 * q + 2, 3) / 2; };   // ease-in-out (kubisch)
    var animiere = function (dauerMs, schritt, fertig) {
      var t0 = performance.now(), g = lauf;
      var takt = function (now) { if (genutzt || g !== lauf) return; var q = Math.min(1, (now - t0) / dauerMs); schritt(weich(q)); if (q < 1) requestAnimationFrame(takt); else if (fertig) fertig(); };
      requestAnimationFrame(takt);
    };
    var knopfX = function () { return KNOPF.x0 + f * (KNOPF.x1 - KNOPF.x0); };
    var vorlauf = 1000;
    var vorfuehren = function () {
      if (genutzt) return;
      setzeFinger(knopfX(), 1967);
      zeigeTipp(T.zieh, knopfX(), 1925);
      spaeter(function () { finger.classList.add('an'); }, 350);
      spaeter(function () {
        finger.classList.add('druck'); fasse(true);
        var f0 = f, f1 = 0.64;
        animiere(2600, function (e) { f = fZiel = f0 + (f1 - f0) * e; setzeFinger(knopfX(), 1967); tipp.style.left = prozent(knopfX(), 0)[0]; neu(); }, function () {
          finger.classList.remove('druck'); fasse(false); tipp.classList.remove('zeigen');
          var n = sichtbar(), ziel = Math.floor(n * 0.7), zx = VX(d.x[ziel]), zy = VY(d.y[ziel]), sx = knopfX(), sy = 1967;
          var bx = (sx + zx) / 2 + 160, by = Math.min(sy, zy) - 120;              // Bogen statt Gerade
          spaeter(function () {
            animiere(900, function (e) { var u = 1 - e; setzeFinger(u * u * sx + 2 * u * e * bx + e * e * zx, u * u * sy + 2 * u * e * by + e * e * zy); }, function () {
              finger.classList.add('druck', 'halten'); kreuz = ziel; neu();
              zeigeTipp(T.halt, zx, zy - 40);
              spaeter(function () {
                animiere(1900, function (e) { var i = Math.min(n - 1, ziel + Math.round(e * 70)); kreuz = i; setzeFinger(VX(d.x[i]), VY(d.y[i])); neu(); }, function () {
                  finger.classList.remove('druck', 'halten', 'an'); tipp.classList.remove('zeigen'); kreuz = null; neu();
                  // Zoom vorführen (28.10., Jan: „zwei Punkte für zwei Finger, dann sieht der Betrachter alles,
                  // was er machen kann“): zwei Finger ziehen auf der Wolke auseinander, die Ansicht zoomt mit;
                  // danach Doppeltipp → weich zurück. Eigene Berührung bricht wie immer sofort ab.
                  var cx = VX(d.x[ziel]), cy = VY(d.y[ziel]), zz = 2.3;
                  var paar = function (a) { setzeFinger(cx - a, cy + a, finger); setzeFinger(cx + a, cy - a, finger2); };
                  spaeter(function () {
                    paar(55); finger.classList.add('an'); finger2.classList.add('an');
                    zeigeTipp(T.zoom, (P.x0 + P.x1) / 2, P.y0 + 150);
                    spaeter(function () {
                      finger.classList.add('druck'); finger2.classList.add('druck');
                      animiere(1500, function (e) { paar(55 + 175 * e); zoomUm(cx, cy, 1 + (zz - 1) * e); }, function () {
                        spaeter(function () {
                          finger.classList.remove('druck', 'an'); finger2.classList.remove('druck', 'an');
                          spaeter(function () {                      // Doppeltipp: zweimal kurz drücken, dann zurück
                            setzeFinger((P.x0 + P.x1) / 2, (P.y0 + P.y1) / 2); finger.classList.add('an');
                            spaeter(function () { finger.classList.add('druck'); }, 250);
                            spaeter(function () { finger.classList.remove('druck'); }, 400);
                            spaeter(function () { finger.classList.add('druck'); }, 550);
                            spaeter(function () {
                              finger.classList.remove('druck');
                              var z0 = z; animiere(700, function (e) { zoomUm(cx, cy, z0 + (1 - z0) * e); }, function () {
                                zurueck(); finger.classList.remove('an'); tipp.classList.remove('zeigen');
                              });
                            }, 700);
                          }, 450);
                        }, 900);
                      });
                    }, 450);
                  }, 600);
                });
              }, 450);
            });
          }, 250);
        });
      }, vorlauf);
    };
    var erinnern = function () { zeigeTipp(T.zieh, knopfX(), 1925); spaeter(function () { tipp.classList.remove('zeigen'); }, 2600); };
    var nutzerDa = function () {
      if (genutzt) return; genutzt = true;
      uhren.forEach(clearTimeout); tipp.classList.remove('zeigen'); finger.classList.remove('an', 'druck', 'halten'); finger2.classList.remove('an', 'druck');
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
      if (modus === 'pan') { gesteAn(); ox = panStart[2] + p[0] - panStart[0]; oy = panStart[3] + p[1] - panStart[1]; begrenzen(); neu(); return; }
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
    var beruehrung = 'ontouchstart' in window;
    cv.addEventListener('gesturestart', function (e) { e.preventDefault(); if (beruehrung) return; gz = z; gp = punkt(e.clientX, e.clientY); nutzerDa(); });
    cv.addEventListener('gesturechange', function (e) { e.preventDefault(); if (beruehrung) return; if (gp && imPlot(gp)) zoomUm(gp[0], gp[1], gz * e.scale); });

    // ── Finger: Regler sofort; Wolke erst nach kurzem Halten; zwei Finger = verschieben + Zoom ──
    var halte = null, tx = 0, ty = 0, zweiStart = null, tippZeit = 0, bewegt = false;
    var mitte = function (t) { return punkt((t[0].clientX + t[1].clientX) / 2, (t[0].clientY + t[1].clientY) / 2); };
    var abstand = function (t) { var dx = t[0].clientX - t[1].clientX, dy = t[0].clientY - t[1].clientY; return Math.sqrt(dx * dx + dy * dy); };
    cv.addEventListener('touchstart', function (e) {
      if (e.touches.length === 2) {
        nutzerDa();
        clearTimeout(halte); if (modus === 'regler') fasse(false); modus = 'zwei'; kreuz = null;
        zweiStart = { c: mitte(e.touches), a: abstand(e.touches), z: z, ox: ox, oy: oy };
        e.preventDefault(); return;
      }
      var t = e.touches[0], p = punkt(t.clientX, t.clientY); tx = t.clientX; ty = t.clientY; bewegt = false;
      if (imRegler(p)) { nutzerDa(); modus = 'regler'; fasse(true); setzeF(p[0]); e.preventDefault(); }
      else if (imPlot(p)) { clearTimeout(halte); halte = setTimeout(function () { nutzerDa(); modus = 'kreuz'; kreuz = nahe(p[0], p[1]); neu(); if (navigator.vibrate) navigator.vibrate(8); }, 220); }
    }, { passive: false });
    cv.addEventListener('touchmove', function (e) {
      if (modus === 'zwei' && e.touches.length === 2) {
        e.preventDefault();
        var m = mitte(e.touches), s = zweiStart;
        var mx = (s.c[0] - X0 - s.ox) / (SX * s.z), my = (Y0 + s.oy - s.c[1]) / (SY * s.z);
        gesteAn(); z = Math.max(1, Math.min(12, s.z * abstand(e.touches) / s.a));
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
      if (!s) return; e.preventDefault(); nutzerDa(); fZiel = Math.max(0, Math.min(1, fZiel + s)); kreuz = null; zieheF();
    });

    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    fetch(dev.dataset.poincareLive).then(function (r) { return r.json(); }).then(function (j) {
      d = j; f = fZiel = reduce ? 1 : 0; groesse(); zeichnen(); cv.classList.add('bereit');
      if ('ResizeObserver' in window) new ResizeObserver(groesse).observe(cv); else window.addEventListener('resize', groesse);
      if (!('IntersectionObserver' in window)) return;
      var erstes = true, imBild = false;
      // In der App-Tour ist die Karte eine Station: vorführen erst, wenn sie die aktive ist (29.10.2026)
      var station = dev.classList.contains('at-scr');
      var aktivStation = function () { return !station || dev.classList.contains('on'); };
      if (station) {
        // Tour-Station (29.10.2026, Jan: „startet beim Poincaré nicht so geil wie bei den anderen Karten“):
        // bei jedem Ankommen frisch – leere Wolke, Ziehen beginnt sofort; beim Verlassen anhalten.
        vorlauf = 450;
        var warAn = false;
        var stoppen = function () {
          lauf++; uhren.forEach(clearTimeout); uhren = [];
          tipp.classList.remove('zeigen'); finger.classList.remove('an', 'druck', 'halten'); finger2.classList.remove('an', 'druck'); fasse(false);
        };
        var wechsel = function () {
          var an = dev.classList.contains('on');
          if (an === warAn) return; warAn = an;
          stoppen();
          if (!an) return;
          genutzt = false; f = fZiel = reduce ? 1 : 0; kreuz = null; zurueck();
          if (!reduce) spaeter(vorfuehren, 250);
        };
        if ('MutationObserver' in window) new MutationObserver(wechsel).observe(dev, { attributes: true, attributeFilter: ['class'] });
        wechsel();
        return;
      }
      var anstossen = function () {
        if (!imBild || genutzt || !aktivStation()) return;
        if (erstes && !reduce) { erstes = false; setTimeout(function () { if (aktivStation()) vorfuehren(); else erstes = true; }, 500); }
        else erinnern();                                            // beim erneuten Vorbeiscrollen kurz erinnern
      };
      new IntersectionObserver(function (es) { imBild = es[0].isIntersecting; anstossen(); }, { threshold: 0.6 }).observe(cv);
      if (station && 'MutationObserver' in window) new MutationObserver(anstossen).observe(dev, { attributes: true, attributeFilter: ['class'] });
    }).catch(function () {});
  }
  function alle() { [].forEach.call(document.querySelectorAll('[data-poincare-live]'), init); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', alle); else alle();
})();
