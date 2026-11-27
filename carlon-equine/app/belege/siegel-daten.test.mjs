// siegel-daten.test.mjs — Bericht-HTML mit signiertem Datenblock (27.11.2026), Voraussetzung für die Prüfseite /pruefen.
// Wahrheit: Wer die sichtbare Berichtsansicht verfälscht, ändert nicht, was die Prüfung als Daten zurückgibt.
// node --test belege/siegel-daten.test.mjs
import { createRequire } from 'node:module';
import assert from 'node:assert';
import { test } from 'node:test';
const require = createRequire(import.meta.url);
const S = require('../siegel.js');
const A = { name: 'ECDSA', namedCurve: 'P-256' }, H = { name: 'ECDSA', hash: 'SHA-256' };
const b64u = b => Buffer.from(b).toString('base64url');
async function praxis(iss, name) {
  const px = await crypto.subtle.generateKey(A, true, ['sign', 'verify']);
  const roh = new Uint8Array(await crypto.subtle.exportKey('raw', px.publicKey)), now = Math.floor(Date.now() / 1000);
  const p = b64u(JSON.stringify({ iss: 'carlon-clinic', typ: 'lic', lic: name, pk: await S.fingerabdruck(roh), iat: now - 60, exp: now + 86400 }));
  const sig = await crypto.subtle.sign(H, iss.privateKey, new TextEncoder().encode(p));
  return { signKey: px.privateKey, signPubRoh: roh, lizenz: `${p}.${b64u(sig)}` };
}
const iss = await crypto.subtle.generateKey(A, true, ['sign', 'verify']);
const PUB = await crypto.subtle.exportKey('jwk', iss.publicKey); delete PUB.d;
const DATEN = { art: 'carlon-bericht', v: 1, pferd: { name: 'Bella </script><b>x</b>' }, aufnahme: { beginn: '2026-11-27T08:00:00.000Z' },
  kennwerte: { rmssd: { wert: 42.5, einheit: 'ms' }, meanHR: { wert: 34, einheit: 'bpm' } } };
const doc = () => `<html><body><h1>Bella</h1><p>RMSSD 42,5 ms</p>${S.datenBlock(DATEN)}</body></html>`;

test('D1 echter Bericht: geprueft, Daten echt und gleich dem Original', async () => {
  const r = await S.htmlPruefen(await S.htmlVersiegeln(doc(), await praxis(iss, 'Praxis A')), PUB);
  assert.strictEqual(r.stufe, 'geprueft'); assert.strictEqual(r.datenEcht, true);
  assert.deepStrictEqual(r.daten, DATEN);
});
test('D2 sichtbares HTML verfälscht, Datenblock echt: veraendert, Daten zeigen Originalwerte', async () => {
  const echt = await S.htmlVersiegeln(doc(), await praxis(iss, 'Praxis A'));
  const r = await S.htmlPruefen(echt.replace('RMSSD 42,5 ms', 'RMSSD 12,0 ms'), PUB);
  assert.strictEqual(r.stufe, 'veraendert'); assert.strictEqual(r.datenEcht, true);
  assert.strictEqual(r.daten.kennwerte.rmssd.wert, 42.5);
});
test('D3 Datenblock verfälscht: keine Daten, nie geprueft', async () => {
  const echt = await S.htmlVersiegeln(doc(), await praxis(iss, 'Praxis A'));
  const r = await S.htmlPruefen(echt.replace('42.5', '12'), PUB);
  assert.notStrictEqual(r.stufe, 'geprueft'); assert.ok(!r.datenEcht); assert.strictEqual(r.daten, undefined);
});
test('D4 zweiter Datenblock eingeschoben: keine Daten', async () => {
  const echt = await S.htmlVersiegeln(doc(), await praxis(iss, 'Praxis A'));
  const fremd = S.datenBlock({ ...DATEN, kennwerte: { rmssd: { wert: 99, einheit: 'ms' } } });
  for (const html of [echt.replace('<h1>', fremd + '<h1>'), echt.replace('</body>', fremd + '</body>')]) {
    const r = await S.htmlPruefen(html, PUB);
    assert.ok(!r.datenEcht); assert.strictEqual(r.daten, undefined);
  }
});
test('D5 Datenblock-Hash entfernt (d gestrichen): Signatur ungültig', async () => {
  const echt = await S.htmlVersiegeln(doc(), await praxis(iss, 'Praxis A'));
  const r = await S.htmlPruefen(echt.replace(/,"d":"[^"]+"/, ''), PUB);
  assert.strictEqual(r.stufe, 'unlesbar'); assert.strictEqual(r.daten, undefined);
});
test('D6 vom Absender selbst gebauter, nicht kanonischer Block (doppelter Schlüssel, zwei Lesarten): keine Daten', async () => {
  const block = '<script type="application/carlon-bericht+json" id="carlon-bericht">{"kennwerte":{"rmssd":{"wert":12,"wert":42.5}}}</script>';
  const r = await S.htmlPruefen(await S.htmlVersiegeln(`<html><body>${block}</body></html>`, await praxis(iss, 'Praxis A')), PUB);
  assert.strictEqual(r.stufe, 'geprueft'); assert.ok(!r.datenEcht); assert.strictEqual(r.daten, undefined);
});
test('D7 Datenblock kann den Script-Kontext nicht verlassen', async () => {
  assert.ok(!/<\/script>[\s\S]*<\/script>/.test(S.datenBlock(DATEN)), S.datenBlock(DATEN));
});
test('D8 Bericht ohne Datenblock bleibt wie bisher geprueft, ohne Daten', async () => {
  const r = await S.htmlPruefen(await S.htmlVersiegeln('<html><body><p>x</p></body></html>', await praxis(iss, 'Praxis A')), PUB);
  assert.strictEqual(r.stufe, 'geprueft'); assert.strictEqual(r.daten, undefined);
});
test('D9 fremde Lizenz, echte Daten: Daten echt, aber Stufe nichtLizenziert (Anzeige muss beides zeigen)', async () => {
  const o = await praxis(iss, 'Praxis A'); o.lizenz = null;
  const r = await S.htmlPruefen(await S.htmlVersiegeln(doc(), o), PUB);
  assert.strictEqual(r.stufe, 'nichtLizenziert'); assert.strictEqual(r.datenEcht, true);
});
