/* langzeit-kern.js — EquineLangzeitV2 (CARLON Equine App, Langzeit/EquineLangzeitV2.swift) Zeile für Zeile in JavaScript.
   EIN Rechenkern für App und Visite (26.11.2026, Jan: „muss mit Visite kompatibel sein und sich gegenseitig flywheelen“).
   Gleichheit wird nicht behauptet, sondern geprüft: gold.json kommt aus dem Swift-Original, pruefe-gold.js vergleicht auf 1e-9.
   Tage: `tag(ms)` liefert die Kalendertag-Nummer (Standard: Ortszeit des Geräts, wie Calendar.current in der App). */
(function (wurzel) {
  'use strict';
  const PROFIL = {
    // 27.11.2026 R&D EQ-EPISODE Rang 1 (algorithmen-pruefstand c4bbcc5): 14 gegen 56 Tage, ohne Schrumpfung, Hinweis ab 1,9·Grenze am selben Tag.
    pferd:  { name: 'pferd-v3', mindestDauerSek: 300, maxStoerPct: 5, tageAktuell: 14, mindestAktuell: 3, tageBasis: 56, mindestBasis: 14, sigma0: 0.30, kSchrumpf: 0, sTech: 0.03, rhoMax: 0.7, hinweisFaktor: 1.9 },
    mensch: { name: 'mensch-v2-vorlaeufig', mindestDauerSek: 60, maxStoerPct: 5, tageAktuell: 7, mindestAktuell: 3, tageBasis: 28, mindestBasis: 14, sigma0: 0.30, kSchrumpf: 3, sTech: 0.02, rhoMax: 0.7, hinweisFaktor: 1 },
  };
  const ortsTag = ms => { const d = new Date(ms); return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5); };
  const mittel = x => x.reduce((a, b) => a + b, 0) / Math.max(1, x.length);
  function median(x) { const s = [...x].sort((a, b) => a - b), n = s.length;
    return n === 0 ? NaN : (n % 2 === 1 ? s[(n - 1) / 2] : 0.5 * (s[n / 2 - 1] + s[n / 2])); }
  function tQuantil975(v) { const z = 1.959964;
    const g1 = (z ** 3 + z) / 4, g2 = (5 * z ** 5 + 16 * z ** 3 + 3 * z) / 96;
    const g3 = (3 * z ** 7 + 19 * z ** 5 + 17 * z ** 3 - 15 * z) / 384;
    const g4 = (79 * z ** 9 + 776 * z ** 7 + 1482 * z ** 5 - 1920 * z ** 3 - 945 * z) / 92160;
    return z + g1 / v + g2 / (v * v) + g3 / (v * v * v) + g4 / (v * v * v * v); }
  /** messungen: [{zeitMs, rmssdMs, dauerSek, stoerPct, ruhe}] → [{tag, lnRmssd}] (Median je Kalendertag) */
  function tageswerte(m, P = PROFIL.pferd, tag = ortsTag) {
    const je = new Map();
    for (const x of m) { if (!(x.ruhe && x.dauerSek >= P.mindestDauerSek && x.stoerPct <= P.maxStoerPct && isFinite(x.rmssdMs) && x.rmssdMs > 0)) continue;
      const t = tag(x.zeitMs); if (!je.has(t)) je.set(t, []); je.get(t).push(Math.log(x.rmssdMs)); }
    return [...je.entries()].map(([t, v]) => ({ tag: t, lnRmssd: median(v) })).sort((a, b) => a.tag - b.tag);
  }
  function rechnen(m, heuteMs, P = PROFIL.pferd, tag = ortsTag) {
    const tw = tageswerte(m, P, tag), t0 = tag(heuteMs), vor = t => t0 - t;
    const akt = tw.filter(w => vor(w.tag) >= 0 && vor(w.tag) < P.tageAktuell);
    const bas = tw.filter(w => vor(w.tag) >= P.tageAktuell && vor(w.tag) < P.tageAktuell + P.tageBasis);
    const leer = { aenderungPct: null, grenzeUntenPct: null, grenzeObenPct: null };
    if (bas.length < P.mindestBasis) return { lage: 'basisImAufbau', tageswerte: tw, nAktuell: akt.length, nBasis: bas.length, rho: 0, ...leer, sEff: null };
    const yb = bas.map(w => w.lnRmssd), mb = mittel(yb);
    const s2 = yb.map(y => (y - mb) * (y - mb)).reduce((a, b) => a + b, 0) / (yb.length - 1);
    const k = P.kSchrumpf, nB = yb.length;
    const sStern = Math.sqrt((k * P.sigma0 * P.sigma0 + (nB - 1) * s2) / (k + nB - 1));
    const sEff = Math.max(Math.sqrt(s2), sStern, P.sTech);
    const paare = [];
    for (let i = 0; i + 1 < bas.length; i++) if (bas[i + 1].tag - bas[i].tag === 1) paare.push([bas[i].lnRmssd - mb, bas[i + 1].lnRmssd - mb]);
    const nenner = yb.map(y => (y - mb) * (y - mb)).reduce((a, b) => a + b, 0);
    const rhoRoh = paare.length >= 5 && nenner > 0 ? paare.map(p => p[0] * p[1]).reduce((a, b) => a + b, 0) / nenner * yb.length / paare.length : 0;
    const rhoK = rhoRoh + (1 + 3 * Math.max(0, rhoRoh)) / nB;
    const rho = Math.min(P.rhoMax, Math.max(0, rhoK + 0.75 * Math.sqrt((1 - Math.min(0.95, rhoK * rhoK)) / nB)));
    if (akt.length < P.mindestAktuell) return { lage: 'zuWenigAktuell', tageswerte: tw, nAktuell: akt.length, nBasis: bas.length, rho, ...leer, sEff };
    const ma = mittel(akt.map(w => w.lnRmssd)), f = (1 - rho) / (1 + rho), nB2 = Math.max(2, nB * f);
    const tage = akt.map(w => [vor(w.tag), 1 / akt.length]).concat(bas.map(w => [vor(w.tag), -1 / nB]));
    let varD = 0; for (const [di, ci] of tage) for (const [dj, cj] of tage) varD += ci * cj * Math.pow(rho, Math.abs(di - dj));
    const dMin = tQuantil975(Math.max(1, nB2 - 1)) * sEff * Math.sqrt(Math.max(0, varD));
    const grenze = Math.max(dMin, 0.5 * sEff), d = ma - mb;
    const schwelle = (P.hinweisFaktor ?? 1) * grenze;
    const lage = d > schwelle ? 'darueber' : (d < -schwelle ? 'darunter' : 'innerhalb');
    return { lage, tageswerte: tw, nAktuell: akt.length, nBasis: bas.length, rho, aenderungPct: (Math.exp(d) - 1) * 100,
             grenzeUntenPct: (1 - Math.exp(-schwelle)) * 100, grenzeObenPct: (Math.exp(schwelle) - 1) * 100, sEff, dLn: d, grenzeLn: grenze };
  }
  function hinweis(verlauf, k = 3) {
    const b = verlauf.filter(l => l === 'innerhalb' || l === 'darueber' || l === 'darunter').slice(-k);
    if (b.length !== k || b[0] === 'innerhalb' || !b.every(l => l === b[0])) return null; return b[0];
  }
  /* Einzelaufnahme gegen eigene Basis (R&D-Rangtabelle EQ-EINZEL, Sieger: einseitiges t-Vorhersageintervall, α 3 %).
     Gleich EquineLangzeitV2.einzel (Swift). Basis = Tageswerte [heute − 60 d, heute), n ≥ 10. */
  const EINZEL = { alpha: 0.03, basisTage: 60, mindestBasis: 10 };   // 27.11.2026 R&D EQ-EINZEL-N
  function lgamma(x) { const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
    let y = x, t = x + 5.5; t -= (x + 0.5) * Math.log(t); let s = 1.000000000190015; for (const ci of c) { y += 1; s += ci / y; } return -t + Math.log(2.5066282746310005 * s / x); }
  function betacf(a, b, x) { const qab = a + b, qap = a + 1, qam = a - 1; let c = 1, d = 1 - qab * x / qap; if (Math.abs(d) < 1e-300) d = 1e-300; d = 1 / d; let h = d;
    for (let m = 1; m <= 300; m++) { const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < 1e-300) d = 1e-300; c = 1 + aa / c; if (Math.abs(c) < 1e-300) c = 1e-300; d = 1 / d; h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2)); d = 1 + aa * d; if (Math.abs(d) < 1e-300) d = 1e-300; c = 1 + aa / c; if (Math.abs(c) < 1e-300) c = 1e-300;
      d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 1e-14) break; } return h; }
  function ibeta(a, b, x) { if (x <= 0) return 0; if (x >= 1) return 1;
    const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b; }
  function tQuantil(p, v) { const cdf = t => { const q = 0.5 * ibeta(v / 2, 0.5, v / (v + t * t)); return t > 0 ? 1 - q : q; };
    let lo = 0, hi = 200; for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (cdf(mid) < p) lo = mid; else hi = mid; } return (lo + hi) / 2; }
  function einzel(m, heuteMs, P = PROFIL.pferd, tag = ortsTag) {
    const tw = tageswerte(m, P, tag), t0 = tag(heuteMs), vor = t => t0 - t;
    const bas = tw.filter(w => vor(w.tag) >= 1 && vor(w.tag) <= EINZEL.basisTage).map(w => w.lnRmssd);
    if (bas.length < EINZEL.mindestBasis) return { lage: 'basisImAufbau', nBasis: bas.length, aenderungPct: null, grenzeUntenPct: null };
    const heute = tw.find(w => vor(w.tag) === 0);
    if (!heute) return { lage: 'zuWenigAktuell', nBasis: bas.length, aenderungPct: null, grenzeUntenPct: null };
    const n = bas.length, mb = mittel(bas), s = Math.sqrt(bas.map(y => (y - mb) * (y - mb)).reduce((a, b) => a + b, 0) / (n - 1));
    const grenze = tQuantil(1 - EINZEL.alpha, n - 1) * s * Math.sqrt(1 + 1 / n), d = heute.lnRmssd - mb;
    return { lage: d < -grenze ? 'darunter' : 'innerhalb', nBasis: n, aenderungPct: (Math.exp(d) - 1) * 100, grenzeUntenPct: (1 - Math.exp(-grenze)) * 100 };
  }
  const api = { PROFIL, EINZEL, tageswerte, rechnen, einzel, hinweis, tQuantil975, tQuantil, ortsTag };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else wurzel.LangzeitKern = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
