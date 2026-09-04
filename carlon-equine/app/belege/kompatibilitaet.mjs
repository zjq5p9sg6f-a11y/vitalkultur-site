/* ═══════════════════════════════════════════════════════════════════════
   KOMPATIBILITAETS-WAECHTER — alte Aufnahmen muessen lesbar BLEIBEN
   ───────────────────────────────────────────────────────────────────────
   Eine Klinik legt Aufnahmen jahrelang ab. Wenn wir das Format aendern,
   darf keine davon still unlesbar werden. „Stumm unlesbar" heisst hier
   nicht Absturz — es heisst: ein Feld ist ploetzlich leer, und niemand
   merkt es, weil die NEUEN Aufnahmen ja gehen.

   Genau das war am 04.09.2026 der Fall: Das Cockpit las `device.model`,
   die Messstation schreibt seit dem 12.08. `source.sensor`. Jede Aufnahme
   der aktuellen Station kam ohne Geraeteangabe an.

   Dieser Waechter laeuft mit dem AUSGELIEFERTEN Modul `aufnahme-herkunft.js`
   ueber den gesamten Messbestand und verlangt fuer JEDE Aufnahme:
     - eine RR-Reihe mit mindestens 20 Schlaegen
     - eine Geraeteangabe, die nicht leer ist

   Aufruf:  node belege/kompatibilitaet.mjs [korpus-verzeichnis]
   ═══════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Herkunft = require('../aufnahme-herkunft.js');

const KORPUS = process.argv[2]
  || process.env.MESSKORPUS
  || path.join(process.env.HOME, 'Developer/carlon-rnd/05-MESSKORPUS-GABELUNG');

if (!fs.existsSync(KORPUS)) {
  console.log('   ❌ Messbestand nicht gefunden: ' + KORPUS);
  console.log('      Ein Waechter, der nichts ansieht, ist kein Waechter.');
  process.exit(1);
}

const dateien = fs.readdirSync(KORPUS).filter(f => f.endsWith('.json')).sort();
if (dateien.length < 20) {
  console.log(`   ❌ Nur ${dateien.length} Aufnahmen im Bestand — verlangt sind mindestens 20.`);
  process.exit(1);
}

const generationen = new Map();
let rot = 0, geprueft = 0;

for (const f of dateien) {
  let d;
  try { d = JSON.parse(fs.readFileSync(path.join(KORPUS, f), 'utf8')); }
  catch (e) { console.log(`   ❌ ${f} — laesst sich nicht mehr lesen: ${e.message}`); rot++; continue; }
  if (!d || typeof d !== 'object') { console.log(`   ❌ ${f} — kein Objekt`); rot++; continue; }

  const rr = Herkunft.rrReihe(d);
  const geraet = Herkunft.geraet(d);
  geprueft++;

  // Formatgeneration nur zur Anzeige — sie sagt, wie breit der Bestand ist.
  const sch = d.schema || {};
  const art = (sch.name || (sch.generated ? 'schema{generated}' : 'ohne schema'))
            + (d.source ? ' · source' : '') + (d.device ? ' · device' : '')
            + (d.rrIntervalsMs ? ' · rrIntervalsMs' : '');
  generationen.set(art, (generationen.get(art) || 0) + 1);

  if (rr.length < 20) { console.log(`   ❌ ${f} — RR-Reihe nicht lesbar (${rr.length} Schlaege)`); rot++; }
  if (!geraet)        { console.log(`   ❌ ${f} — keine Geraeteangabe (${art})`); rot++; }
}

console.log(`   ℹ Kompatibilitaet: ${geprueft} Aufnahmen aus ${generationen.size} Formatgenerationen`);
for (const [art, n] of [...generationen].sort()) console.log(`   ℹ   ${String(n).padStart(3)}×  ${art}`);

if (rot) {
  console.log(`   ❌ ${rot} Aufnahme(n) sind nicht mehr vollstaendig lesbar.`);
  console.log('      In `aufnahme-herkunft.js` wird HINZUGEFUEGT, nie entfernt.');
  process.exit(1);
}
console.log('   ✓ Jede Aufnahme im Bestand liefert RR-Reihe und Geraeteangabe.');
