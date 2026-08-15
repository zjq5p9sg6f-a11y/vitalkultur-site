/* Rechnet die Zahl nach, die auf der Visite-Seite steht.
   Aufruf:  node carlon-equine/app/belege/rmssd-nachrechnen.mjs
   Eine Verkaufszahl, die man nicht nachrechnen kann, ist eine Behauptung. */
import { readFileSync } from 'node:fs';
const b = JSON.parse(readFileSync(new URL('./rmssd-roh-vs-korrigiert.json', import.meta.url)));

const rmssd = (v) => {
  let s = 0;
  for (let i = 1; i < v.length; i++) { const d = v[i] - v[i - 1]; s += d * d; }
  return Math.sqrt(s / (v.length - 1));
};

/* ROH: alle Schläge, so wie ein ungefiltertes Werkzeug rechnet. */
const roh = rmssd(b.rrMs);

/* KORRIGIERT: der AV-Block (630) und der zugehörige Long-Short-Schlag (631)
   erzeugen ein lang-kurz-Paar. Beide Differenzen gehen quadriert in die Summe
   ein — deshalb fällt das PAAR heraus, nicht nur der einzelne Schlag. */
const raus = new Set(Object.keys(b.etiketten).map(Number));
const diffs = [];
for (let i = 1; i < b.rrMs.length; i++)
  if (!raus.has(i) && !raus.has(i - 1)) diffs.push(b.rrMs[i] - b.rrMs[i - 1]);
const korrigiert = Math.sqrt(diffs.reduce((s, d) => s + d * d, 0) / diffs.length);

const g = b.gemessen;
const zeile = (n, ist, soll, e = 0.02) => {
  const ok = Math.abs(ist - soll) <= e;
  console.log(`  ${ok ? '✓' : '✗'} ${n}: gerechnet ${ist.toFixed(2)} ms · hinterlegt ${soll} ms`);
  return ok;
};
console.log(`Beleg: ${g.schlaege} Schläge · Artefaktrate ${g.artefaktratePct} % · Urteil „${g.qualitaetsurteil}"`);
let ok = zeile('RMSSD roh (alle Schläge)', roh, g.rmssdRohMs);
ok = zeile('RMSSD korrigiert (Paar heraus)', korrigiert, g.rmssdKorrigiertMs, 0.35) && ok;

/* Die Zahl, die auf der Seite steht — abgeleitet, nicht getippt. */
const proz = Math.round((g.rmssdRohMs / g.rmssdKorrigiertMs - 1) * 100);
console.log(`\n  → roh liegt ${proz} % über korrigiert · Auslöser: ${g.ausHeadlineGenommeneSchlaege} Schläge von ${g.schlaege}`);
if (proz !== 130) { console.log(`  ✗ Die Seite nennt 130 %`); ok = false; }
process.exit(ok ? 0 : 1);
