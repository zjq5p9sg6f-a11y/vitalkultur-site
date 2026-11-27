// siegel-r2.test.mjs — Perplexity-Kreis Runde 2 (27.11.2026): Anzeige- und Mehrdeutigkeitsfälle. node --test belege/siegel-r2.test.mjs
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
const DOC = '<html><body><p>echt</p></body></html>';

test('R2-1 Steuerzeichen (Bidi, unsichtbar) im Praxisnamen erreichen die Anzeige nicht', async () => {
  const o = await praxis(iss, 'Praxis ‮neuel‬​ Nord');
  const r = await S.jsonPruefen(await S.jsonVersiegeln({ a: 1 }, o), PUB);
  assert.strictEqual(r.stufe, 'geprueft');
  assert.ok(!/[\p{Cc}\p{Cf}]/u.test(r.praxis), JSON.stringify(r.praxis));
  assert.strictEqual(r.praxisBereinigt, true);
});
test('R2-1b normaler Name bleibt unverändert', async () => {
  const r = await S.jsonPruefen(await S.jsonVersiegeln({ a: 1 }, await praxis(iss, 'Tierärztliche Klinik Müller & Söhne')), PUB);
  assert.strictEqual(r.praxis, 'Tierärztliche Klinik Müller & Söhne'); assert.ok(!r.praxisBereinigt);
});
test('R2-2 zweiter Siegelblock vorn (fremdes Siegel) ist nie geprueft', async () => {
  const echt = await S.htmlVersiegeln(DOC, await praxis(iss, 'Praxis A'));
  const fremd = (await S.htmlVersiegeln(DOC, await praxis(iss, 'Praxis B'))).match(/<script type="application\/carlon-siegel\+json"[\s\S]*?<\/script>\n?/)[0];
  assert.notStrictEqual((await S.htmlPruefen(fremd + echt, PUB)).stufe, 'geprueft');
});
test('R2-3 zweiter Siegelblock hinten ist nie geprueft', async () => {
  const o = await praxis(iss, 'Praxis A'), echt = await S.htmlVersiegeln(DOC, o);
  const block = echt.match(/<script type="application\/carlon-siegel\+json"[\s\S]*?<\/script>\n?/)[0];
  assert.notStrictEqual((await S.htmlPruefen(echt + block, PUB)).stufe, 'geprueft');
});
