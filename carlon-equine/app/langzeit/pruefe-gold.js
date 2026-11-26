// Prüft langzeit-kern.js gegen die Goldfälle aus dem Swift-Original. Exit 1 bei jeder Abweichung > 1e-9.
const K = require('./langzeit-kern.js'), gold = require('./gold.json'), utc = ms => Math.floor(ms / 864e5);
let fehler = 0, maxD = 0;
for (const [i, f] of gold.entries()) {
  const r = K.rechnen(f.messungen, f.heuteMs, K.PROFIL.pferd, utc), s = f.soll;
  if (r.lage !== s.lage || r.nAktuell !== s.nAktuell || r.nBasis !== s.nBasis || r.tageswerte.length !== s.nTage) { fehler++; if (fehler < 5) console.log('✗', i, r.lage, s.lage); continue; }
  for (const k of ['rho', 'aenderungPct', 'grenzeUntenPct', 'grenzeObenPct', 'sEff']) {
    if ((s[k] === null) !== (r[k] === null)) { fehler++; console.log('✗ null', i, k); continue; }
    if (s[k] !== null) { const d = Math.abs(r[k] - s[k]) / Math.max(1, Math.abs(s[k])); maxD = Math.max(maxD, d); if (d > 1e-9) { fehler++; console.log('✗', i, k, r[k], s[k]); } } }
  const e = K.einzel(f.messungen, f.heuteMs, K.PROFIL.pferd, utc), se = f.sollEinzel;
  if (e.lage !== se.lage || e.nBasis !== se.nBasis) { fehler++; console.log('✗ einzel', i, e.lage, se.lage); continue; }
  for (const k of ['aenderungPct', 'grenzeUntenPct']) { if ((se[k] === null) !== (e[k] === null)) { fehler++; continue; }
    if (se[k] !== null) { const d = Math.abs(e[k] - se[k]) / Math.max(1, Math.abs(se[k])); maxD = Math.max(maxD, d); if (d > 1e-9) { fehler++; console.log('✗ einzel', i, k, e[k], se[k]); } } }
}
console.log(`${gold.length - fehler}/${gold.length} Goldfälle gleich · größte rel. Abweichung ${maxD.toExponential(2)}`);
process.exit(fehler ? 1 : 0);
