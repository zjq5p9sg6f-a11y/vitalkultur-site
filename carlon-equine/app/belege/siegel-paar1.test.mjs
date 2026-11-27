// siegel-paar1.test.mjs — Befunde der Fable-Paarrunde siegel-v2 (27.11.2026), je Befund ein Test, vorher rot.
// Aufruf: node --test belege/siegel-paar1.test.mjs
import { createRequire } from 'node:module';
import assert from 'node:assert';
import { test } from 'node:test';
const require = createRequire(import.meta.url);
const S = require('../siegel.js');
const A = { name: 'ECDSA', namedCurve: 'P-256' }, H = { name: 'ECDSA', hash: 'SHA-256' };
const b64u = b => Buffer.from(b).toString('base64url');
async function welt(felder = {}) {
  const iss = await crypto.subtle.generateKey(A, true, ['sign', 'verify']);
  const px = await crypto.subtle.generateKey(A, true, ['sign', 'verify']);
  const roh = new Uint8Array(await crypto.subtle.exportKey('raw', px.publicKey));
  const now = Math.floor(Date.now() / 1000);
  const p = b64u(JSON.stringify({ iss: 'carlon-clinic', typ: 'lic', lic: 'Praxis A',
    pk: await S.fingerabdruck(roh), iat: now - 60, exp: now + 14 * 86400, ...felder }));
  const sig = await crypto.subtle.sign(H, iss.privateKey, new TextEncoder().encode(p));
  const pubJwk = await crypto.subtle.exportKey('jwk', iss.publicKey); delete pubJwk.d; delete pubJwk.key_ops; delete pubJwk.ext;
  return { pubJwk, opt: { signKey: px.privateKey, signPubRoh: roh, lizenz: `CARLON-${p}.${b64u(sig)}` } };
}
const DOC = '<html><body><p>echt</p></body></html>';

test('B1 HTML-Siegel mit eingeschleustem Markup ist nie geprueft', async () => {
  const w = await welt(), gut = await S.htmlVersiegeln(DOC, w.opt);
  const boese = gut.replace('{"v":2,', '{"x":"</SCRIPT><h1>FAELSCHUNG</h1><script type=text/plain>","v":2,');
  assert.notStrictEqual(boese, gut);
  assert.notStrictEqual((await S.htmlPruefen(boese, w.pubJwk)).stufe, 'geprueft');
});
test('B1b unsigniertes Zusatzfeld im JSON-Siegel ist nie geprueft', async () => {
  const w = await welt(), v = await S.jsonVersiegeln({ a: 1 }, w.opt);
  v.carlonSiegel = { ...v.carlonSiegel, praxisname: 'Klinik Fälschung' };
  assert.notStrictEqual((await S.jsonPruefen(v, w.pubJwk)).stufe, 'geprueft');
});
test('B2 mehrere Altsiegel: echte Praxis bleibt geprueft', async () => {
  const w = await welt(), alt = '<script type="application/carlon-siegel+json" id="carlon-siegel">{}</script>\n';
  const out = await S.htmlVersiegeln(`<html><body>${alt}<p>x</p>${alt}</body></html>`, w.opt);
  assert.strictEqual((await S.htmlPruefen(out, w.pubJwk)).stufe, 'geprueft');
});
test('B3 Token ohne typ ist keine Lizenz', async () => {
  const w = await welt({ typ: undefined });
  assert.strictEqual((await S.htmlPruefen(await S.htmlVersiegeln(DOC, w.opt), w.pubJwk)).stufe, 'nichtLizenziert');
});
test('B4 fehlender Prüfschlüssel beschuldigt nicht die Praxis', async () => {
  const w = await welt(), r = await S.htmlPruefen(await S.htmlVersiegeln(DOC, w.opt), undefined);
  assert.strictEqual(r.stufe, 'unlesbar');
});
test('B5 ungültige Zeit scheitert beim Versiegeln', async () => {
  const w = await welt();
  await assert.rejects(S.htmlVersiegeln(DOC, { ...w.opt, zeit: NaN }));
  await assert.rejects(S.htmlVersiegeln(DOC, { ...w.opt, zeit: Date.now() }));
});
test('B6 Array wird abgelehnt', async () => {
  const w = await welt(); await assert.rejects(S.jsonVersiegeln([1, 2], w.opt));
});
test('B1c Siegeltext nicht in kanonischer Form ist unlesbar (zweite Sicherung)', async () => {
  const w = await welt(), gut = await S.htmlVersiegeln(DOC, w.opt);
  const anders = gut.replace(/(id="carlon-siegel">)([\s\S]*?)(<\/script>)/, (_, a, j, c) => a + JSON.stringify(JSON.parse(j), null, 1) + c);
  assert.notStrictEqual(anders, gut);
  assert.strictEqual((await S.htmlPruefen(anders, w.pubJwk)).stufe, 'unlesbar');
});
