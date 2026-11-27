// siegel-probe.mjs — Herkunftssiegel mit bekannter Wahrheit (27.11.2026). Aufruf: node belege/siegel-probe.mjs
// Ein Test-Ausstellerschlüssel spielt den Lizenzdienst; jede Probe hat eine feste Soll-Stufe.
// Gegenprobe: dieselben Proben gegen einen Prüfer, der die Praxisbindung NICHT prüft, müssen rot werden (Mutationsprobe).
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const S = require('../siegel.js');
const { subtle } = globalThis.crypto;
const enc = new TextEncoder();
const b64u = b => Buffer.from(b).toString('base64url');

const aussteller = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const PUB = await subtle.exportKey('jwk', aussteller.publicKey); delete PUB.d; delete PUB.key_ops; delete PUB.ext;
async function lizenz(nutzlast) { const p = b64u(enc.encode(JSON.stringify(nutzlast)));
  return p + '.' + b64u(await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, aussteller.privateKey, enc.encode(p))); }
async function praxis() { const k = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const roh = new Uint8Array(await subtle.exportKey('raw', k.publicKey)); return { k, roh, fp: await S.fingerabdruck(roh) }; }

const jetzt = Math.floor(Date.now() / 1000);
const A = await praxis(), B = await praxis(), H = await praxis();   // A, B zahlend; H Hacker
const licA = await lizenz({ v: 2, typ: 'lic', tier: 'vet_solo', lic: 'Tierarztpraxis A', pk: A.fp, iat: jetzt - 86400, exp: jetzt + 13 * 86400, iss: 'carlon-clinic' });
const licAlt = await lizenz({ v: 2, typ: 'lic', tier: 'vet_solo', lic: 'Tierarztpraxis A', iat: jetzt - 86400, exp: jetzt + 13 * 86400, iss: 'carlon-clinic' });
const licAbgelaufen = await lizenz({ v: 2, typ: 'lic', tier: 'vet_solo', lic: 'Tierarztpraxis A', pk: A.fp, iat: jetzt - 60 * 86400, exp: jetzt - 40 * 86400, iss: 'carlon-clinic' });
const fremdAussteller = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const pFake = b64u(enc.encode(JSON.stringify({ v: 2, typ: 'lic', tier: 'vet_center', lic: 'Hack', pk: H.fp, iat: jetzt, exp: jetzt + 9e8, iss: 'carlon-clinic' })));
const licFake = pFake + '.' + b64u(await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, fremdAussteller.privateKey, enc.encode(pFake)));

const daten = { schema: { name: 'carlon_equine_v1' }, metrics: { rmssd: 42.5, meanHR: 34 }, rrData: [1712, 1698, 1730] };
const html = '<!doctype html><html><head><title>Bericht</title></head><body><h1>Bericht Bella</h1><p>RMSSD 42,5 ms</p></body></html>';
const opt = (p, l) => ({ signKey: p.k.privateKey, signPubRoh: p.roh, lizenz: l });

// Siegel v2: Lizenz nach dem Signieren getauscht → Signatur ungültig („unlesbar“), in v1 erst „nichtLizenziert“. Nie „geprueft“.
const faelle = [];
const fall = (name, soll, ist) => faelle.push({ name, soll, ist: ist.stufe, grund: ist.grund, praxis: ist.praxis });
fall('echt JSON', 'geprueft', await S.jsonPruefen(await S.jsonVersiegeln(daten, opt(A, licA)), PUB));
fall('echt HTML', 'geprueft', await S.htmlPruefen(await S.htmlVersiegeln(html, opt(A, licA)), PUB));
fall('ohne Lizenz (Demo)', 'nichtLizenziert', await S.jsonPruefen(await S.jsonVersiegeln(daten, opt(H, null)), PUB));
fall('gefälschte Lizenz', 'nichtLizenziert', await S.jsonPruefen(await S.jsonVersiegeln(daten, opt(H, licFake)), PUB));
fall('echte Lizenz von A kopiert, Hacker signiert', 'nichtLizenziert', await S.jsonPruefen(await S.jsonVersiegeln(daten, opt(H, licA)), PUB));
fall('alte Lizenz ohne Praxisbindung', 'nichtLizenziert', await S.jsonPruefen(await S.jsonVersiegeln(daten, opt(A, licAlt)), PUB));
fall('Lizenz zum Exportzeitpunkt abgelaufen', 'nichtLizenziert', await S.jsonPruefen(await S.jsonVersiegeln(daten, opt(A, licAbgelaufen)), PUB));
{ const v = await S.jsonVersiegeln(daten, opt(A, licA)); v.metrics = { ...v.metrics, rmssd: 21.0 }; fall('JSON nach Export verändert', 'veraendert', await S.jsonPruefen(v, PUB)); }
{ const v = (await S.htmlVersiegeln(html, opt(A, licA))).replace('42,5', '21,0'); fall('HTML nach Export verändert', 'veraendert', await S.htmlPruefen(v, PUB)); }
{ const v = await S.jsonVersiegeln(daten, opt(A, licA)); delete v.carlonSiegel; fall('Siegel entfernt', 'ohneSiegel', await S.jsonPruefen(v, PUB)); }
{ const v = await S.jsonVersiegeln(daten, opt(A, licA)); v.carlonSiegel = { ...v.carlonSiegel, lizenz: licFake }; fall('Lizenz im Siegel ausgetauscht', 'unlesbar', await S.jsonPruefen(v, PUB)); }
{ const v = await S.jsonVersiegeln(daten, opt(H, null)); const s = await S.jsonVersiegeln(daten, opt(A, licA));
  v.carlonSiegel = { ...v.carlonSiegel, lizenz: licA }; fall('Hacker setzt A-Lizenz in eigenes Siegel', 'unlesbar', await S.jsonPruefen(v, PUB));
  const w = { ...s, carlonSiegel: { ...s.carlonSiegel, pk: b64u(H.roh) } }; fall('Hacker setzt eigenen Schlüssel in A-Siegel', 'unlesbar', await S.jsonPruefen(w, PUB)); }
{ const v = await S.jsonVersiegeln(JSON.parse(JSON.stringify(await S.jsonVersiegeln(daten, opt(A, licA)))), opt(B, licA)); fall('B versiegelt A-Export neu mit A-Lizenz', 'nichtLizenziert', await S.jsonPruefen(v, PUB)); }
{ const v = JSON.parse(JSON.stringify(await S.jsonVersiegeln(daten, opt(A, licA)))); fall('echt nach Speichern und Laden (Text)', 'geprueft', await S.jsonPruefen(v, PUB)); }
// Lizenz ist mitsigniert (Perplexity-Kreis 27.11.: „Exportsignatur muss die konkret verwendete Lizenz mitbinden“):
{ const v = await S.jsonVersiegeln(daten, opt(A, null)); v.carlonSiegel = { ...v.carlonSiegel, lizenz: licA }; fall('Lizenz nachträglich in lizenzloses A-Siegel gesetzt', 'unlesbar', await S.jsonPruefen(v, PUB)); }
{ const v = await S.jsonVersiegeln(daten, opt(A, licAlt)); v.carlonSiegel = { ...v.carlonSiegel, lizenz: licA }; fall('A-Lizenz gegen andere A-Lizenz getauscht', 'unlesbar', await S.jsonPruefen(v, PUB)); }

let rot = 0;
for (const f of faelle) { const ok = f.soll === f.ist; if (!ok) rot++; console.log(`${ok ? '✓' : '✗'} ${f.name}: ${f.ist}${f.praxis ? ' (' + f.praxis + ')' : ''} · ${f.grund}${ok ? '' : '  SOLL ' + f.soll}`); }
console.log(`${faelle.length - rot}/${faelle.length} Proben wie erwartet`);
process.exit(rot ? 1 : 0);
