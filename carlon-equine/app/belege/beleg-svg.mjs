#!/usr/bin/env node
/* Zeichnet den 130-%-Beleg als statisches SVG — aus der hinterlegten RR-Serie,
   nicht aus abgetippten Punkten. Ohne JavaScript im Ergebnis: die Seite soll
   den Beweis auch dann zeigen, wenn ein Skript scheitert.
   Aufruf:  node carlon-equine/app/belege/beleg-svg.mjs            (SVG auf stdout)
   Der Wächter t-belegte-zahlen.mjs vergleicht das Ergebnis mit dem, was in
   der Seite steht — driftet der Beleg, fällt die Seite auf.                */
import { readFileSync } from 'node:fs';
const b = JSON.parse(readFileSync(new URL('./rmssd-roh-vs-korrigiert.json', import.meta.url)));
const rr = b.rrMs, stoerung = Object.keys(b.etiketten).map(Number);

const B = 642, H = 96, PAD = 3;
const min = 780, max = 1850;                       // Ausschnitt: die ruhige Lage + der Zacken
const y = (ms) => PAD + (H - 2 * PAD) * (1 - (Math.min(Math.max(ms, min), max) - min) / (max - min));
/* Rechts Luft lassen: die Störung sitzt bei Schlag 630 von 642, also fast am
   Rand. Ohne Rand klebte der Marker an der Kante und las sich wie ein
   Zeichenfehler statt wie ein Ereignis. Die Daten bleiben unangetastet —
   nur der Zeichenbereich ist schmaler als das Bild. */
const RAND = 26;
const x = (i) => 4 + (i / (rr.length - 1)) * (B - RAND);
const pfad = (von, bis) => rr.slice(von, bis).map((v, k) => `${k ? 'L' : 'M'}${x(von + k).toFixed(1)} ${y(v).toFixed(1)}`).join('');

/* Die Störung als eigener Pfad — sie soll die Farbe tragen, nicht ein Marker
   daneben. Ein Punkt neben der Linie behauptet; die eingefärbte Linie zeigt. */
const a = Math.min(...stoerung) - 1, z = Math.max(...stoerung) + 2;

console.log(`<svg viewBox="0 0 ${B} ${H}" preserveAspectRatio="none" role="img" width="100%" height="96"
     aria-label="Die Schlagabstände einer Ruheaufnahme über 642 Schläge. Die Linie verläuft ruhig um 850 Millisekunden. An einer einzigen Stelle springt sie auf 1794 Millisekunden — ein AV-Block mit seinem kurzen Folgeschlag. Diese eine Stelle hebt die RMSSD von 24,2 auf 55,5 Millisekunden.">
  <path d="${pfad(0, a + 1)}" fill="none" stroke="#5b7b93" stroke-width="1" stroke-linejoin="round"/>
  <path d="${pfad(z - 1, rr.length)}" fill="none" stroke="#5b7b93" stroke-width="1" stroke-linejoin="round"/>
  <path d="${pfad(a, z)}" fill="none" stroke="#FFB547" stroke-width="2" stroke-linejoin="round"/>
  <circle cx="${x(stoerung[0]).toFixed(1)}" cy="${y(rr[stoerung[0]]).toFixed(1)}" r="3" fill="#FFB547"/>
</svg>`);
