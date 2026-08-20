/* Beweist, dass die Signalgüte im Befund die richtige SKALA trifft.
   Aufruf:  node carlon-equine/app/belege/signalguete-skala.mjs

   Der Befund ist das einzige Stück CARLON, das das Haus verlässt. Steht dort
   eine Güte, die nicht zur Aufnahme passt, ist der Schaden bei der
   empfangenden Klinik — nicht bei uns.

   WARUM DIESER BELEG DEN QUELLTEXT LIEST STATT DIE REGEL NACHZUBAUEN
   ------------------------------------------------------------------
   Ein Prüfstand, der die geprüfte Rechnung selbst noch einmal aufschreibt,
   prüft nichts — er bestätigt das Missverständnis seines Autors. Genau das ist
   im Schwesterprojekt passiert: dort bildete das Erzeugerskript den
   Toleranzradius je Skala neu, wie der defekte Code, und sein Sollwert war die
   Signatur des Defekts statt seine Widerlegung.
   Deshalb wird hier der `quality:`-Ausdruck WÖRTLICH aus `index.html`
   herausgeschnitten und ausgeführt. Ändert jemand ihn dort, ändert sich der
   Prüfling hier mit. Findet der Beleg ihn nicht mehr, wird er ROT — ein
   Prüfstand, der seinen Prüfling verloren hat, darf nicht grün sagen. */
import { readFileSync } from 'node:fs';

const quelle = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

/* Der Ausdruck steht als `quality: (()=>{ … })(),` im Aufbau des Datensatzes.
   Geschnitten wird über Klammer-Zählung, nicht über einen gierigen Ausdruck:
   der Rumpf enthält selbst geschweifte Klammern. */
function schneideQuality(text) {
  const start = text.indexOf('quality: (()=>{');
  if (start < 0) return null;
  let i = text.indexOf('{', start), tiefe = 0;
  for (; i < text.length; i++) {
    if (text[i] === '{') tiefe++;
    else if (text[i] === '}') { tiefe--; if (tiefe === 0) break; }
  }
  const ende = text.indexOf('})()', i);
  return ende < 0 ? null : text.slice(start + 'quality: '.length, ende + 4);
}

const ausdruck = schneideQuality(quelle);
if (!ausdruck) {
  console.error('✗ ROT — der `quality:`-Ausdruck wurde in index.html nicht gefunden.');
  console.error('  Dieser Beleg hat seinen Prüfling verloren und sagt deshalb NICHT grün.');
  process.exit(1);
}

/* Die einzige Umgebung, die der Ausdruck braucht: `num`, `eq`, `q`.
   `num` ist im Original die Zahl-oder-null-Prüfung. */
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
function guete(eq, q) {
  // eslint-disable-next-line no-new-func
  return Function('num', 'eq', 'q', `return (${ausdruck});`)(num, eq, q);
}

/* Die alte Regel — nur als GEGENPROBE. Sie muss an Fall 1 scheitern, sonst
   misst dieser Beleg nichts. */
const alteRegel = (eq, q) => {
  const _q = num(eq.equineQualityScore);
  if (_q != null) return _q <= 1 ? Math.round(_q * 100) : Math.round(_q);
  return q.artifactRatePct != null ? Math.max(0, Math.round(100 - num(q.artifactRatePct) * 4)) : null;
};

/* Der Zusammenhang, gegen den geprüft wird, stammt aus der App:
       equineQuality = 1 − Artefaktrate/25   →   Score(0–100) = 100 − 4·Rate
   Er ist hergeleitet, nicht gewählt — deshalb ist er ein Sollwert. */
const soll = (rate) => Math.max(0, Math.min(100, 100 - 4 * rate));

const faelle = [
  // Name                                        Rate    Score exportiert    Skala
  ['heutige App, saubere Aufnahme',               2.0,   soll(2.0),          '0–100'],
  ['heutige App, ein Viertel Artefakte',         24.8,   soll(24.8),         '0–100'],
  ['heutige App, genau an der Kippe',            24.75,  soll(24.75),        '0–100'],
  ['alte Aufnahme (Bruch), saubere Aufnahme',     2.0,   soll(2.0) / 100,    '0–1'],
  ['alte Aufnahme (Bruch), viertel Artefakte',   24.8,   soll(24.8) / 100,   '0–1'],
];

let rot = 0, sehend = 0;
console.log('── Signalgüte-Skala · Sollwert aus der App-Formel 100 − 4·Rate ──');
for (const [name, rate, score, skala] of faelle) {
  const eq = { equineQualityScore: score, adjustedArtifactRatePct: rate };
  const ist = guete(eq, {});
  const s = Math.round(soll(rate));
  const gut = ist === s;
  if (!gut) rot++;
  console.log(`  ${gut ? '✓' : '✗'} ${name} (${skala})`);
  console.log(`      Rate ${rate} % · exportiert ${score} → angezeigt ${ist} % · Soll ${s} %`);

  // Sieht der Beleg überhaupt etwas? Die alte Regel muss mindestens einen
  // dieser Fälle verfehlen — sonst ist er blind und beweist nichts.
  if (alteRegel(eq, {}) !== s) {
    sehend++;
    console.log(`      ↳ alte Regel hätte hier ${alteRegel(eq, {})} % gezeigt (sehend)`);
  }
}

/* Die ehrliche Grenze: OHNE Artefaktrate ist die Skala aus einer Zahl allein
   nicht bestimmbar. Dann gilt weiter die alte Regel — das ist keine Lücke,
   sondern eine benannte Grenze, und sie wird hier festgehalten statt
   verschwiegen. */
const ohneRate = guete({ equineQualityScore: 0.92 }, {});
console.log(`  ℹ ohne Artefaktrate: 0.92 → ${ohneRate} % (alte Regel, benannte Grenze)`);

/* Gegen-Gegenprobe: ein Prüfstand, der Richtiges anmeckert, wird abgeschaltet.
   Die heutige App auf einer sauberen Aufnahme MUSS glatt durchlaufen. */
const sauber = guete({ equineQualityScore: soll(1.0), adjustedArtifactRatePct: 1.0 }, {});
if (sauber !== Math.round(soll(1.0))) {
  console.error(`  ✗ zu scharf — saubere Aufnahme gemeldet (${sauber} statt ${Math.round(soll(1.0))})`);
  rot++;
} else {
  console.log(`  ✓ Gegen-Gegenprobe: saubere Aufnahme läuft durch (${sauber} %)`);
}

if (sehend === 0) {
  console.error('  ✗ BLIND — die alte Regel hätte jeden Fall gleich beantwortet.');
  rot++;
}

console.log(rot === 0
  ? `✅ Signalgüte-Skala erkannt statt geraten (${sehend}× sehend, 1× nicht übereifrig)`
  : `❌ ${rot} Fall/Fälle rot`);
process.exit(rot === 0 ? 0 : 1);
