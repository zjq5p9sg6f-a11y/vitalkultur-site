/* siegel.js — HERKUNFTSSIEGEL für Visite-Exporte (27.11.2026, Jan: „wenn jemand mit Fake-Lizenz Exporte erstellt,
   die bei anderen importiert werden … genial ein Mechanismus“).

   DIE IDEE: Den eigenen Browser kann man hacken, den des Empfängers nicht. Darum prüft nicht der Absender seine Lizenz,
   sondern JEDE andere Visite beim Import, und zwar offline:
     1. Die Laufzeit-Lizenz (14 Tage, vom Lizenzdienst mit unserem privaten Schlüssel signiert) trägt `pk`, den
        Fingerabdruck des Signierschlüssels der Praxis (dieselbe Fachnummer wie beim Postfach, Krypto.fachnummer).
     2. Jeder Export trägt Lizenz + Signatur der Praxis über den SHA-256 des Inhalts.
     3. Der Empfänger prüft: Lizenz echt (unser öffentlicher Schlüssel) · Lizenz an DIESEN Praxisschlüssel gebunden ·
        Inhalt mit diesem Schlüssel signiert · Inhalt seitdem unverändert · Lizenz zum Exportzeitpunkt gültig.
   Was ein Angreifer kann und was dabei herauskommt:
     · Lizenz fälschen → unsere Signatur fehlt → „nicht lizenziert“.
     · Echte Lizenz aus fremdem Siegel kopieren → `pk` zeigt auf die fremde Praxis, er kann nicht mit deren Schlüssel
       signieren → „nicht lizenziert“.
     · Siegel entfernen → „ohne Siegel“, nie „geprüft“.
     · Inhalt nach dem Export ändern → „verändert“.
     · Eine zahlende Praxis gibt ihre Sicherung samt Schlüssel weiter → das Siegel nennt die zahlende Praxis.
   Grenze: Eine gekündigte Praxis kann mit ihrer letzten Lizenz weiter siegeln, wenn sie die Exportzeit in deren
   Laufzeit zurückdatiert. Der Empfänger sieht dann ein altes Exportdatum. Keine Pferdedaten verlassen das Gerät.
   v2 (27.11.2026, Perplexity-Kreis Fable): signiert wird `carlon-siegel-v2.<Inhalts-Hash>.<Zeit>.<Hash der Lizenz>`,
   damit die beigelegte Lizenz weder getauscht noch nachträglich eingesetzt werden kann. Anzeige sachlich (§ 824 BGB):
   „Lizenznachweis nicht bestätigt“ statt „nicht lizenziert“, Exportdatum immer „laut Absender“.
   Formate: JSON → Feld `carlonSiegel` (zuletzt), Hash über JSON.stringify ohne das Feld.
            HTML → <script type="application/carlon-siegel+json" id="carlon-siegel">…</script> vor </body>,
            Hash über den Text ohne dieses Element. */
(function (wurzel) {
  'use strict';
  const V = 2, KULANZ_S = 14 * 86400;                    // Kulanz wie License: abgelaufen, aber nie abgesagt
  const HTML_RE = /<script type="application\/carlon-siegel\+json" id="carlon-siegel">([\s\S]*?)<\/script>\n?/;
  const enc = new TextEncoder();
  /* Nur diese Felder; alles Weitere wäre unsigniert (Paarrunde 27.11., B1: Markup im HTML-Siegel neben „geprüft“). */
  const FELDER = ['v', 'zeit', 'h', 'pk', 'sig', 'lizenz'];
  const HTML_RE_ALLE = new RegExp(HTML_RE.source, 'g');
  const kanonisch = s => JSON.stringify(s).replace(/</g, '\\u003c');
  const b64u = b => { const u = new Uint8Array(b); let s = ''; for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const unb64u = s => { s = String(s).replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
  const sha = async t => b64u(await crypto.subtle.digest('SHA-256', enc.encode(t)));
  const fingerabdruck = async rohPub => b64u((await crypto.subtle.digest('SHA-256', rohPub)).slice(0, 16));
  /* v2 (27.11.2026): die beigelegte Lizenz ist mitsigniert (Hash), sonst ließe sie sich austauschen oder nachträglich einsetzen. */
  const nachricht = (h, zeit, lh) => enc.encode(`carlon-siegel-v${V}.${h}.${zeit}.${lh}`);

  /* Lizenz lesen und prüfen (dieselbe Regel wie License.verify, hier ohne Zeitwächter, weil der Exportzeitpunkt zählt). */
  async function lizenzLesen(key, pubJwk) {
    try {
      let k = String(key || '').trim(); if (k.startsWith('CARLON-')) k = k.slice(7);
      const [p, s] = k.split('.'); if (!p || !s) return null;
      const pub = await crypto.subtle.importKey('jwk', pubJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
      if (!await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, unb64u(s), enc.encode(p))) return null;
      const d = JSON.parse(new TextDecoder().decode(unb64u(p)));
      return d && d.iss === 'carlon-clinic' && typeof d.exp === 'number' ? d : null;
    } catch (_) { return null; }
  }

  /* inhaltOhne: der Text, über den gehasht wird. signKey: privater ECDSA-Schlüssel der Praxis, signPubRoh: dessen
     öffentlicher Teil (raw). lizenz: der aktuelle Laufzeit-Lizenzschlüssel (String) oder null. */
  async function siegelFuer(inhaltOhne, { signKey, signPubRoh, lizenz, zeit }) {
    const z = Math.floor(zeit != null ? zeit : Date.now() / 1000), h = await sha(inhaltOhne);
    if (!Number.isFinite(z) || z > 1e11) throw new RangeError('zeit: Unix-Sekunden erwartet');
    const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, signKey, nachricht(h, z, await sha(lizenz || '')));
    return { v: V, zeit: z, h, pk: b64u(signPubRoh), sig: b64u(sig), lizenz: lizenz || null };
  }

  /* ── JSON ── */
  async function jsonVersiegeln(obj, opt) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new TypeError('jsonVersiegeln: Objekt erwartet');
    const o = { ...obj }; delete o.carlonSiegel;
    const s = await siegelFuer(JSON.stringify(o), opt);
    return { ...o, carlonSiegel: s };
  }
  /* ── HTML ── */
  async function htmlVersiegeln(html, opt) {
    const ohne = String(html).replace(HTML_RE_ALLE, '');
    const s = await siegelFuer(ohne, opt);
    const tag = `<script type="application/carlon-siegel+json" id="carlon-siegel">${kanonisch(s)}</script>\n`;
    const i = ohne.lastIndexOf('</body>');
    return i < 0 ? ohne + tag : ohne.slice(0, i) + tag + ohne.slice(i);
  }

  /* Prüfen. Ergebnis: { stufe, grund, praxis, tier, zeit }
     stufe: 'geprueft' | 'nichtLizenziert' | 'veraendert' | 'ohneSiegel' | 'unlesbar' */
  async function pruefeSiegel(s, inhaltOhne, pubJwk) {
    if (!s || typeof s !== 'object') return { stufe: 'ohneSiegel', grund: 'Kein Herkunftssiegel' };
    try {
      if (s.v !== V || !s.pk || !s.sig || !s.h || typeof s.zeit !== 'number') return { stufe: 'unlesbar', grund: 'Siegel unvollständig' };
      if (Object.keys(s).some(k => !FELDER.includes(k)) || (s.lizenz != null && typeof s.lizenz !== 'string')) return { stufe: 'unlesbar', grund: 'Siegel enthält fremde Felder' };
      try { await crypto.subtle.importKey('jwk', pubJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']); }
      catch (_) { return { stufe: 'unlesbar', grund: 'Prüfschlüssel dieser Visite fehlt' }; }
      const roh = unb64u(s.pk);
      const pub = await crypto.subtle.importKey('raw', roh, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
      if (!await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, unb64u(s.sig), nachricht(s.h, s.zeit, await sha(s.lizenz || ''))))
        return { stufe: 'unlesbar', grund: 'Signatur des Siegels ungültig' };
      const zeit = s.zeit;
      if (await sha(inhaltOhne) !== s.h) return { stufe: 'veraendert', grund: 'Inhalt weicht vom versiegelten Stand ab', zeit };
      const l = s.lizenz ? await lizenzLesen(s.lizenz, pubJwk) : null;
      if (!l) return { stufe: 'nichtLizenziert', grund: s.lizenz ? 'Lizenz nicht von CARLON ausgestellt' : 'Siegel enthält keinen Lizenznachweis', zeit };
      if (l.typ !== 'lic') return { stufe: 'nichtLizenziert', grund: 'Kein Laufzeit-Schlüssel', zeit };
      if (l.pk !== await fingerabdruck(roh)) return { stufe: 'nichtLizenziert', grund: l.pk ? 'Lizenz passt nicht zum Schlüssel des Siegels' : 'Lizenz ohne Praxisbindung', zeit };
      if (zeit < (l.iat || 0) - 3600 || zeit > l.exp + KULANZ_S) return { stufe: 'nichtLizenziert', grund: 'Lizenz deckt das angegebene Exportdatum nicht ab', zeit };
      return { stufe: 'geprueft', grund: 'Herkunft geprüft', praxis: l.lic || '', tier: l.tier || '', zeit };
    } catch (e) { return { stufe: 'unlesbar', grund: 'Siegel unlesbar' }; }
  }
  async function jsonPruefen(obj, pubJwk) {
    if (!obj || typeof obj !== 'object') return { stufe: 'ohneSiegel', grund: 'Kein Herkunftssiegel' };
    const o = { ...obj }; const s = o.carlonSiegel; delete o.carlonSiegel;
    return pruefeSiegel(s, JSON.stringify(o), pubJwk);
  }
  async function htmlPruefen(html, pubJwk) {
    const m = String(html).match(HTML_RE); if (!m) return { stufe: 'ohneSiegel', grund: 'Kein Herkunftssiegel' };
    let s = null; try { s = JSON.parse(m[1]); } catch (_) { return { stufe: 'unlesbar', grund: 'Siegel unlesbar' }; }
    if (!s || typeof s !== 'object' || m[1] !== kanonisch(s)) return { stufe: 'unlesbar', grund: 'Siegel enthält fremde Felder' };
    return pruefeSiegel(s, String(html).replace(HTML_RE, ''), pubJwk);
  }
  const api = { V, KULANZ_S, fingerabdruck, jsonVersiegeln, htmlVersiegeln, jsonPruefen, htmlPruefen, lizenzLesen };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else wurzel.Siegel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
