#!/usr/bin/env node
/* Zeichnet den 130-%-Beleg als statisches SVG – aus der hinterlegten RR-Serie, nicht aus abgetippten
   Punkten, ohne JavaScript im Ergebnis. 15.11.2026 (Jan: „keine Skala zu sehen“): Messinstrument-Darstellung
   mit y-Achse in ms, x-Achse in Schlägen, feinem Raster und beschrifteter Störung.
   Aufruf: node carlon-equine/app/belege/beleg-svg.mjs [--en]      (SVG auf stdout)                     */
import { readFileSync } from 'node:fs';
const EN = process.argv.includes('--en');
const b = JSON.parse(readFileSync(new URL('./rmssd-roh-vs-korrigiert.json', import.meta.url)));
const rr = b.rrMs, st = Object.keys(b.etiketten).map(Number).sort((p, q) => p - q);
const W = 760, H = 250, L = 58, R = 18, T = 16, U = 40;            // Ränder: links Skala, unten Schlagnummern
const min = 400, max = 1900, n = rr.length;
const x = (i) => L + (i / (n - 1)) * (W - L - R);
const y = (ms) => T + (H - T - U) * (1 - (Math.min(Math.max(ms, min), max) - min) / (max - min));
const f = (v) => v.toFixed(1);
const pfad = (von, bis) => rr.slice(von, bis).map((v, k) => `${k ? 'L' : 'M'}${f(x(von + k))} ${f(y(v))}`).join('');
const a = st[0] - 1, z = st[st.length - 1] + 2, sp = st.reduce((m, i) => rr[i] > rr[m] ? i : m, st[0]), mitte = Math.round(rr.slice(0, a).reduce((s, v) => s + v, 0) / a);
const fein = [], grob = [];
for (let ms = min; ms <= max; ms += 100) (ms % 200 ? fein : grob).push(ms);   // Raster 100 ms, beschriftet alle 200 ms
const xt = []; for (let i = 0; i < n; i += 100) if (n - i > 60 || i === 0) xt.push(i); xt.push(n);
const t = EN ? { y: 'RR interval (ms)', x: 'Beat', m: `${Math.round(rr[sp])} ms · long pause`, mi: `mean ≈ ${mitte} ms` }
             : { y: 'Schlagabstand (ms)', x: 'Schlag', m: `${Math.round(rr[sp])} ms · lange Pause`, mi: `Mittel ≈ ${mitte} ms` };
console.log(`<svg viewBox="0 0 ${W} ${H}" role="img" width="100%" style="height:auto" font-family="inherit"
     aria-label="${EN ? `RR intervals of a recording over ${n} beats, scale 400–1900 ms. The line stays calm around ${mitte} ms; at beat ${sp} it jumps to ${Math.round(rr[sp])} ms – a long pause with its short follow-up beat. This one spot raises RMSSD from 24.2 to 55.5 ms.` : `Schlagabstände einer Aufnahme über ${n} Schläge, Skala 400–1900 ms. Die Linie verläuft ruhig um ${mitte} ms; bei Schlag ${sp} springt sie auf ${Math.round(rr[sp])} ms – eine lange Pause mit ihrem kurzen Folgeschlag. Diese eine Stelle hebt die RMSSD von 24,2 auf 55,5 ms.`}">
  <g stroke="#ffffff" stroke-opacity=".05">${fein.map(ms => `<line x1="${L}" x2="${W - R}" y1="${f(y(ms))}" y2="${f(y(ms))}"/>`).join('')}</g>
  <g stroke="#ffffff" stroke-opacity=".13">${grob.map(ms => `<line x1="${L}" x2="${W - R}" y1="${f(y(ms))}" y2="${f(y(ms))}"/>`).join('')}${xt.map(i => `<line x1="${f(x(i))}" x2="${f(x(i))}" y1="${T}" y2="${H - U}" stroke-opacity=".06"/>`).join('')}</g>
  <g fill="#a8a49c" font-size="11" text-anchor="end">${grob.map(ms => `<text x="${L - 7}" y="${f(y(ms) + 4)}">${ms}</text>`).join('')}</g>
  <g fill="#a8a49c" font-size="11" text-anchor="middle">${xt.map(i => `<text x="${f(x(i))}" y="${H - U + 16}">${i}</text>`).join('')}</g>
  <text x="${(L + W - R) / 2}" y="${H - 6}" fill="#a8a49c" font-size="11" text-anchor="middle" letter-spacing=".06em">${t.x}</text>
  <text transform="translate(13 ${(T + H - U) / 2}) rotate(-90)" fill="#a8a49c" font-size="11" text-anchor="middle" letter-spacing=".06em">${t.y}</text>
  <line x1="${L}" x2="${W - R}" y1="${f(y(mitte))}" y2="${f(y(mitte))}" stroke="#3ECFB2" stroke-opacity=".55" stroke-dasharray="4 4"/>
  <text x="${L + 8}" y="${f(y(1300))}" fill="#3ECFB2" font-size="11">┄ ${t.mi}</text>
  <path d="${pfad(0, a + 1)}" fill="none" stroke="#cfcac0" stroke-width="1.2" stroke-linejoin="round"/>
  <path d="${pfad(z - 1, n)}" fill="none" stroke="#cfcac0" stroke-width="1.2" stroke-linejoin="round"/>
  <path d="${pfad(a, z)}" fill="none" stroke="#FFB547" stroke-width="2.2" stroke-linejoin="round"/>
  <circle cx="${f(x(sp))}" cy="${f(y(rr[sp]))}" r="3.5" fill="#FFB547"/>
  <text x="${f(x(sp) - 8)}" y="${f(y(rr[sp]) + 4)}" fill="#FFB547" font-size="12" font-weight="600" text-anchor="end">${t.m}</text>
  <rect x="${L}" y="${T}" width="${W - L - R}" height="${H - T - U}" fill="none" stroke="#ffffff" stroke-opacity=".18"/>
</svg>`);
