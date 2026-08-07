/* CARLON — Ende-zu-Ende-Verschlüsselung für das Praxis-Postfach
   ═══════════════════════════════════════════════════════════════════════
   WARUM ES DAS GIBT
   Der bisherige Weg war ein Rendezvous: der Besitzer konnte nur senden,
   solange die Tierärztin ein Fenster offen hielt und wartete. Ein mobiler
   Tierarzt und ein Pferdebesitzer sind aber praktisch nie gleichzeitig
   verfügbar — das Geschäft ist von Natur aus asynchron. Deshalb ein
   Briefkasten statt einer Verabredung.

   Damit die Aufnahme dabei über einen Zwischenspeicher darf, ohne dass
   irgendwer sie lesen kann, wird sie gegen den öffentlichen Schlüssel der
   Praxis verschlüsselt. Der private Schlüssel entsteht in der Praxis und
   verlässt sie nie.

   VERFAHREN (ECIES, ausschliesslich Web-Crypto, keine Abhängigkeiten)
     Absender  erzeugt ein Wegwerf-Schlüsselpaar (ECDH P-256),
               leitet mit dem Praxis-Schlüssel ein gemeinsames Geheimnis ab,
               verschlüsselt damit AES-GCM-256
     Praxis    leitet dasselbe Geheimnis aus ihrem privaten Schlüssel und dem
               mitgesendeten Wegwerf-Schlüssel ab und entschlüsselt

   Das Wegwerf-Paar macht jede Sendung eigenständig: wer eine knackt, hat
   nichts über die anderen gelernt.

   ZWEI SCHLÜSSELPAARE, weil Web-Crypto einen Schlüssel nicht für beides
   zulässt:
     box   ECDH  — womit an die Praxis verschlüsselt wird (öffentlich im Link)
     sign  ECDSA — womit die Praxis beweist, dass das Fach ihr gehört

   DIE FACHNUMMER IST DER FINGERABDRUCK DES SIGNIERSCHLÜSSELS.
   Damit braucht der Zwischenspeicher keine Benutzerverwaltung, keine
   Registrierung und keine Identitäten-Datenbank: wer aus Fach X lesen will,
   muss eine Signatur vorlegen, deren Schlüssel zu X hasht. Nichts zu
   verwalten heisst nichts, was auseinanderlaufen oder abfliessen kann.
   ═══════════════════════════════════════════════════════════════════════ */
(function (global) {
  const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unb64u = (s) => {
    s = String(s).replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    const bin = atob(s), u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  };

  const Krypto = {
    b64u, unb64u,

    /* Ein frisches Paar Schlüsselpaare für eine Praxis. Der private Teil ist
       NICHT extrahierbar angelegt — er kann das Gerät technisch nicht
       verlassen, auch nicht durch einen Fehler unsererseits. */
    async praxisAnlegen() {
      const box = await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveKey', 'deriveBits']);
      const sign = await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
      const boxPub = await crypto.subtle.exportKey('raw', box.publicKey);
      const signPub = await crypto.subtle.exportKey('raw', sign.publicKey);
      return {
        box, sign,
        boxPub: b64u(boxPub),
        signPub: b64u(signPub),
        fach: await this.fachnummer(signPub),
      };
    },

    /* Fachnummer = die ersten 128 Bit des SHA-256 über den öffentlichen
       Signierschlüssel. Kurz genug für einen Link, lang genug, dass niemand
       ein fremdes Fach errät. */
    async fachnummer(signPubRaw) {
      const h = await crypto.subtle.digest('SHA-256', signPubRaw);
      return b64u(h.slice(0, 16));
    },

    /* ── Senden: verschlüsseln gegen den öffentlichen Praxis-Schlüssel ──
       Der Absender braucht KEIN Konto und KEINEN eigenen dauerhaften
       Schlüssel — nur den öffentlichen aus dem Link. Genau deshalb kann ein
       Pferdebesitzer ohne Anmeldung senden. */
    /* SCHLUESSELABLEITUNG MIT HKDF — nachgeruestet, nachdem eine Messung es
       belegt hat: WebCrypto gibt bei ECDH-`deriveKey` die rohe x-Koordinate
       des gemeinsamen Punkts UNVERAENDERT als AES-Schluessel heraus. Nachgeprueft,
       nicht geglaubt: rohes Geheimnis und abgeleiteter Schluessel waren Byte fuer
       Byte identisch.
       Das war kein bekannter Angriff auf ein einzelnes Chiffrat, aber es
       widerspricht NIST SP 800-56A/56C und RFC 9180 und laesst zwei Dinge
       fehlen, die spaeter teuer werden: Bereichstrennung (derselbe Schluessel
       waere in einem anderen Zusammenhang nicht getrennt) und die Bindung an
       den Empfaenger.
       Jetzt: deriveBits -> HKDF-SHA-256 mit kontextgebundenem `info`, plus
       AES-GCM mit zusaetzlichen authentifizierten Daten. Damit gehoert ein
       Umschlag genau zu EINEM Postfach — an ein anderes weitergereicht laesst
       er sich nicht mehr oeffnen. */
    async _aesSchluessel(privKey, pubKey, fach, wegPubB64, zweck) {
      const bits = await crypto.subtle.deriveBits(
        { name: 'ECDH', public: pubKey }, privKey, 256);
      const hk = await crypto.subtle.importKey('raw', bits, 'HKDF', false, ['deriveKey']);
      return crypto.subtle.deriveKey(
        { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0),
          info: new TextEncoder().encode('CARLON-postfach-v2|' + fach) },
        hk, { name: 'AES-GCM', length: 256 }, false, [zweck]);
    },
    _aad(fach, wegPubB64) {
      return new TextEncoder().encode(fach + '|' + wegPubB64);
    },

    async versiegeln(boxPubB64, klartext, fach) {
      if (!fach) throw new Error('Fachnummer fehlt — sie bindet den Umschlag an das Postfach');
      const empfaenger = await crypto.subtle.importKey('raw', unb64u(boxPubB64),
        { name: 'ECDH', namedCurve: 'P-256' }, false, []);
      const weg = await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveKey', 'deriveBits']);
      const wegPub = b64u(await crypto.subtle.exportKey('raw', weg.publicKey));
      const schluessel = await this._aesSchluessel(
        weg.privateKey, empfaenger, fach, wegPub, 'encrypt');
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const daten = typeof klartext === 'string'
        ? new TextEncoder().encode(klartext) : klartext;
      const chiffrat = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv, additionalData: this._aad(fach, wegPub) },
        schluessel, daten);
      return { v: 2, weg: wegPub, iv: b64u(iv), c: b64u(chiffrat) };
    },

    /* ── Empfangen: nur mit dem privaten Schlüssel der Praxis ── */
    async oeffnen(boxPrivKey, umschlag, fach) {
      if (!fach) throw new Error('Fachnummer fehlt');
      const weg = await crypto.subtle.importKey('raw', unb64u(umschlag.weg),
        { name: 'ECDH', namedCurve: 'P-256' }, false, []);
      const schluessel = await this._aesSchluessel(
        boxPrivKey, weg, fach, umschlag.weg, 'decrypt');
      const klar = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: unb64u(umschlag.iv),
          additionalData: this._aad(fach, umschlag.weg) },
        schluessel, unb64u(umschlag.c));
      return new TextDecoder().decode(klar);
    },

    /* ── Abholen beweisen ──────────────────────────────────────────────
       Die Praxis signiert Fachnummer + Zeitstempel. Der Zwischenspeicher
       prüft die Signatur gegen den mitgesendeten öffentlichen Schlüssel UND
       dass dessen Fingerabdruck die Fachnummer ergibt. Ohne Datenbank.
       Der Zeitstempel begrenzt, wie lange ein abgefangener Nachweis nützt. */
    async abholNachweis(praxis) {
      const jetzt = Math.floor(Date.now() / 1000);
      const satz = new TextEncoder().encode(praxis.fach + '.' + jetzt);
      const sig = await crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' }, praxis.sign.privateKey, satz);
      return { fach: praxis.fach, zeit: jetzt, signPub: praxis.signPub, sig: b64u(sig) };
    },

    /* Gegenstück, das der Zwischenspeicher ausführt. Steht hier, damit
       Prüfung und Erzeugung nicht auseinanderlaufen können. */
    async nachweisPruefen(n, maxAlterSek = 300) {
      if (!n || !n.fach || !n.signPub || !n.sig || typeof n.zeit !== 'number')
        return { ok: false, grund: 'unvollständig' };
      const alter = Math.abs(Math.floor(Date.now() / 1000) - n.zeit);
      if (alter > maxAlterSek) return { ok: false, grund: 'Nachweis zu alt' };
      const roh = unb64u(n.signPub);
      if (await this.fachnummer(roh) !== n.fach)
        return { ok: false, grund: 'Schlüssel gehört nicht zu diesem Fach' };
      let pub;
      try {
        pub = await crypto.subtle.importKey('raw', roh,
          { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
      } catch { return { ok: false, grund: 'Schlüssel unlesbar' }; }
      const satz = new TextEncoder().encode(n.fach + '.' + n.zeit);
      const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' },
        pub, unb64u(n.sig), satz);
      return ok ? { ok: true } : { ok: false, grund: 'Signatur ungültig' };
    },
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Krypto;
  else global.Krypto = Krypto;
})(typeof self !== 'undefined' ? self : globalThis);
