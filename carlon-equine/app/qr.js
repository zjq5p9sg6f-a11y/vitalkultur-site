/* CARLON — QR-Erzeugung ohne Fremdbibliothek.
   ═══════════════════════════════════════════════════════════════════════
   WOZU
   Die Dauer-Einladung einer Praxis ist ein Link. Solange sie ihn einzeln
   verschicken muss, erreicht sie eine Kundin nach der anderen. Als Aushang
   im Stall erreicht derselbe Link vierzig auf einmal — bei Grenzkosten von
   null. Das ist der billigste Multiplikator, den es hier gibt.

   WARUM SELBST GESCHRIEBEN
   Die App laeuft unter strenger CSP und muss offline funktionieren. Eine
   Bibliothek von einem fremden Server ist beides nicht. Also die rund
   dreihundert Zeilen selbst — einmal geschrieben, nie wieder angefasst.

   UMFANG (bewusst begrenzt)
   Byte-Modus, Fehlerkorrektur M (~15 %), Versionen 1–13. Das traegt bis
   334 Zeichen; die Dauer-Einladung braucht rund 170. Laengeres wird
   ABGELEHNT statt stillschweigend abgeschnitten — ein QR-Code, der falsch
   scannt, ist schlimmer als keiner.

   GEPRUEFT
   Modul fuer Modul gegen `qrencode` und zusaetzlich mit `zbarimg`
   tatsaechlich dekodiert. Siehe scripts/carlon-closed-loop/t-qr.mjs.
   ═══════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  /* ── Galois-Feld GF(256), Generator 0x11D ─────────────────────────── */
  const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
  (function () {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      EXP[i] = x; LOG[x] = i;
      x <<= 1; if (x & 0x100) x ^= 0x11D;
    }
    for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  })();
  const mul = (a, b) => (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]];

  /* Generatorpolynom fuer n Fehlerkorrektur-Codewoerter */
  function generator(n) {
    let g = [1];
    for (let i = 0; i < n; i++) {
      const next = new Array(g.length + 1).fill(0);
      for (let j = 0; j < g.length; j++) {
        next[j] ^= g[j];
        next[j + 1] ^= mul(g[j], EXP[i]);
      }
      g = next;
    }
    return g;
  }

  function ecCodewords(daten, n) {
    const g = generator(n), rest = new Array(daten.length + n).fill(0);
    for (let i = 0; i < daten.length; i++) rest[i] = daten[i];
    for (let i = 0; i < daten.length; i++) {
      const f = rest[i]; if (!f) continue;
      for (let j = 0; j < g.length; j++) rest[i + j] ^= mul(g[j], f);
    }
    return rest.slice(daten.length);
  }

  /* ── Tabellen, Fehlerkorrektur M, Versionen 1–13 ──────────────────────
     [ EC-Codewoerter je Block, Bloecke Gruppe 1, Daten je Block G1,
       Bloecke Gruppe 2, Daten je Block G2 ] */
  const M = {
    1:  [10, 1, 16, 0, 0],   2:  [16, 1, 28, 0, 0],   3:  [26, 1, 44, 0, 0],
    4:  [18, 2, 32, 0, 0],   5:  [24, 2, 43, 0, 0],   6:  [16, 4, 27, 0, 0],
    7:  [18, 4, 31, 0, 0],   8:  [22, 2, 38, 2, 39],  9:  [22, 3, 36, 2, 37],
    10: [26, 4, 43, 1, 44],  11: [30, 1, 50, 4, 51],  12: [22, 6, 36, 2, 37],
    13: [22, 8, 37, 1, 38],
  };
  /* Mittelpunkte der Ausrichtungsmuster je Version */
  const AUSRICHT = {
    1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34],
    7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
    11: [6, 30, 54], 12: [6, 32, 58], 13: [6, 34, 62],
  };
  const datenKapazitaet = (v) => { const t = M[v]; return t[1] * t[2] + t[3] * t[4]; };

  /* ── Bitstrom ─────────────────────────────────────────────────────── */
  function Bits() { this.b = []; }
  Bits.prototype.push = function (wert, laenge) {
    for (let i = laenge - 1; i >= 0; i--) this.b.push((wert >> i) & 1);
  };

  function datenCodewoerter(bytes, version) {
    const kap = datenKapazitaet(version), bits = new Bits();
    bits.push(0b0100, 4);                                   // Byte-Modus
    bits.push(bytes.length, version <= 9 ? 8 : 16);          // Zeichenzahl
    for (const b of bytes) bits.push(b, 8);
    const max = kap * 8;
    for (let i = 0; i < 4 && bits.b.length < max; i++) bits.b.push(0);   // Abschluss
    while (bits.b.length % 8) bits.b.push(0);
    const cw = [];
    for (let i = 0; i < bits.b.length; i += 8) {
      let v = 0; for (let j = 0; j < 8; j++) v = (v << 1) | bits.b[i + j];
      cw.push(v);
    }
    const fuell = [0xEC, 0x11];                              // Norm-Fuellmuster
    for (let i = 0; cw.length < kap; i++) cw.push(fuell[i % 2]);
    return cw;
  }

  /* Bloecke bilden, Fehlerkorrektur rechnen, verschraenkt zusammensetzen */
  function endgueltigeCodewoerter(bytes, version) {
    const [ecN, g1, d1, g2, d2] = M[version];
    const cw = datenCodewoerter(bytes, version);
    const bloecke = [];
    let p = 0;
    for (let i = 0; i < g1; i++) { bloecke.push(cw.slice(p, p + d1)); p += d1; }
    for (let i = 0; i < g2; i++) { bloecke.push(cw.slice(p, p + d2)); p += d2; }
    const ec = bloecke.map(b => ecCodewords(b, ecN));
    const raus = [];
    const maxD = Math.max(d1, d2 || 0);
    for (let i = 0; i < maxD; i++)
      for (const b of bloecke) if (i < b.length) raus.push(b[i]);
    for (let i = 0; i < ecN; i++)
      for (const e of ec) raus.push(e[i]);
    return raus;
  }

  /* ── Matrix ───────────────────────────────────────────────────────── */
  function leereMatrix(n) {
    const m = [], reserviert = [];
    for (let i = 0; i < n; i++) { m.push(new Array(n).fill(0)); reserviert.push(new Array(n).fill(false)); }
    return { m, reserviert };
  }

  function setzeFest(mat, n, version) {
    const { m, reserviert } = mat;
    const sucher = (r, c) => {
      for (let i = -1; i <= 7; i++) for (let j = -1; j <= 7; j++) {
        const y = r + i, x = c + j;
        if (y < 0 || y >= n || x < 0 || x >= n) continue;
        const rand = (i === 0 || i === 6 || j === 0 || j === 6);
        const kern = (i >= 2 && i <= 4 && j >= 2 && j <= 4);
        m[y][x] = (i >= 0 && i <= 6 && j >= 0 && j <= 6 && (rand || kern)) ? 1 : 0;
        reserviert[y][x] = true;
      }
    };
    sucher(0, 0); sucher(0, n - 7); sucher(n - 7, 0);

    for (let i = 8; i < n - 8; i++) {                        // Taktmuster
      const b = (i % 2 === 0) ? 1 : 0;
      m[6][i] = b; reserviert[6][i] = true;
      m[i][6] = b; reserviert[i][6] = true;
    }

    const pos = AUSRICHT[version];                            // Ausrichtungsmuster
    for (const r of pos) for (const c of pos) {
      if ((r <= 8 && c <= 8) || (r <= 8 && c >= n - 9) || (r >= n - 9 && c <= 8)) continue;
      for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
        m[r + i][c + j] = (Math.max(Math.abs(i), Math.abs(j)) !== 1) ? 1 : 0;
        reserviert[r + i][c + j] = true;
      }
    }

    m[n - 8][8] = 1; reserviert[n - 8][8] = true;             // immer dunkel

    for (let i = 0; i < 9; i++) {                             // Formatbereich freihalten
      if (i !== 6) { reserviert[8][i] = true; reserviert[i][8] = true; }
    }
    for (let i = 0; i < 8; i++) { reserviert[8][n - 1 - i] = true; reserviert[n - 1 - i][8] = true; }

    if (version >= 7) {                                       // Versionsbereich
      for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) {
        reserviert[i][n - 11 + j] = true; reserviert[n - 11 + j][i] = true;
      }
    }
  }

  function setzeDaten(mat, n, cw) {
    const { m, reserviert } = mat;
    const bits = [];
    for (const c of cw) for (let i = 7; i >= 0; i--) bits.push((c >> i) & 1);
    let p = 0, aufwaerts = true;
    for (let rechts = n - 1; rechts > 0; rechts -= 2) {
      if (rechts === 6) rechts--;                              // Taktspalte ueberspringen
      for (let k = 0; k < n; k++) {
        const y = aufwaerts ? (n - 1 - k) : k;
        for (let s = 0; s < 2; s++) {
          const x = rechts - s;
          if (reserviert[y][x]) continue;
          m[y][x] = p < bits.length ? bits[p] : 0;
          p++;
        }
      }
      aufwaerts = !aufwaerts;
    }
  }

  const MASKEN = [
    (y, x) => (y + x) % 2 === 0,
    (y) => y % 2 === 0,
    (y, x) => x % 3 === 0,
    (y, x) => (y + x) % 3 === 0,
    (y, x) => (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0,
    (y, x) => ((y * x) % 2) + ((y * x) % 3) === 0,
    (y, x) => ((((y * x) % 2) + ((y * x) % 3)) % 2) === 0,
    (y, x) => ((((y + x) % 2) + ((y * x) % 3)) % 2) === 0,
  ];

  /* Strafpunkte nach ISO 18004 — die Maske mit den wenigsten gewinnt. */
  function strafe(m, n) {
    let s = 0;
    for (let y = 0; y < n; y++) {                              // Regel 1: Reihen
      let lauf = 1;
      for (let x = 1; x < n; x++) {
        if (m[y][x] === m[y][x - 1]) lauf++;
        else { if (lauf >= 5) s += 3 + (lauf - 5); lauf = 1; }
      }
      if (lauf >= 5) s += 3 + (lauf - 5);
    }
    for (let x = 0; x < n; x++) {                              // Regel 1: Spalten
      let lauf = 1;
      for (let y = 1; y < n; y++) {
        if (m[y][x] === m[y - 1][x]) lauf++;
        else { if (lauf >= 5) s += 3 + (lauf - 5); lauf = 1; }
      }
      if (lauf >= 5) s += 3 + (lauf - 5);
    }
    for (let y = 0; y < n - 1; y++) for (let x = 0; x < n - 1; x++) {   // Regel 2: Bloecke
      const v = m[y][x];
      if (v === m[y][x + 1] && v === m[y + 1][x] && v === m[y + 1][x + 1]) s += 3;
    }
    const muster = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];          // Regel 3: Sucher-Aehnlichkeit
    const passt = (hol) => {
      let t = 0;
      for (let i = 0; i + 11 <= n; i++) {
        let ok = true;
        for (let j = 0; j < 11; j++) if (hol(i + j) !== muster[j]) { ok = false; break; }
        if (ok) t++;
        ok = true;
        for (let j = 0; j < 11; j++) if (hol(i + j) !== muster[10 - j]) { ok = false; break; }
        if (ok) t++;
      }
      return t;
    };
    for (let y = 0; y < n; y++) s += 40 * passt((i) => m[y][i]);
    for (let x = 0; x < n; x++) s += 40 * passt((i) => m[i][x]);
    let dunkel = 0;                                            // Regel 4: Verhaeltnis
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) dunkel += m[y][x];
    const anteil = dunkel * 100 / (n * n);
    s += 10 * Math.floor(Math.abs(anteil - 50) / 5);
    return s;
  }

  /* BCH(15,5) fuer die Formatinformation */
  function formatBits(maske) {
    let d = (0b00 << 3) | maske;                               // 00 = Fehlerkorrektur M
    let v = d << 10;
    for (let i = 4; i >= 0; i--) if ((v >> (i + 10)) & 1) v ^= 0b10100110111 << i;
    return ((d << 10) | v) ^ 0b101010000010010;
  }

  /* BCH(18,6) fuer die Versionsinformation, ab Version 7 */
  function versionBits(version) {
    let v = version << 12;
    for (let i = 5; i >= 0; i--) if ((v >> (i + 12)) & 1) v ^= 0b1111100100101 << i;
    return (version << 12) | v;
  }

  function setzeFormat(m, n, maske) {
    const f = formatBits(maske);
    /* Die beiden Kopien laufen GEGENLAEUFIG. In der ersten steht das
       hoechstwertige Bit links oben bei (8,0), in der zweiten das
       niederwertigste rechts bei (8,n-1). Wer beide gleich herum schreibt,
       bekommt trotzdem einen scannenden Code — Decoder nehmen die zweite
       Kopie, wenn die erste die Pruefsumme verfehlt. Der Fehler bleibt
       still, bis eine Kamera nur die erste Kopie sauber sieht.
       Gefunden im Modulvergleich gegen qrencode, nicht beim Scannen. */
    for (let i = 0; i < 15; i++) {
      const b = (f >> i) & 1;
      if (i <= 5) m[i][8] = b;                 // (0,8) … (5,8)
      else if (i === 6) m[7][8] = b;
      else if (i === 7) m[8][8] = b;
      else if (i === 8) m[8][7] = b;
      else m[8][14 - i] = b;                   // (8,5) … (8,0)

      if (i < 8) m[8][n - 1 - i] = b;          // (8,n-1) … (8,n-8)
      else m[n - 15 + i][8] = b;               // (n-7,8) … (n-1,8)
    }
    m[n - 8][8] = 1;
  }

  function setzeVersion(m, n, version) {
    if (version < 7) return;
    const v = versionBits(version);
    for (let i = 0; i < 18; i++) {
      const b = (v >> i) & 1;
      const y = Math.floor(i / 3), x = i % 3;
      m[y][n - 11 + x] = b;
      m[n - 11 + x][y] = b;
    }
  }

  /* ── Oeffentlich ──────────────────────────────────────────────────── */
  /* maskeErzwingen dient dem Pruefstand: damit laesst sich zeigen, dass
     alles ausser der Maskenwahl exakt der Norm entspricht. */
  function matrix(text, maskeErzwingen) {
    const bytes = Array.from(new TextEncoder().encode(String(text)));
    let version = 0;
    for (let v = 1; v <= 13; v++) {
      const kopf = v <= 9 ? 8 : 16;
      if (bytes.length * 8 + 4 + kopf <= datenKapazitaet(v) * 8) { version = v; break; }
    }
    /* Lieber ehrlich scheitern als einen Code liefern, der falsch scannt. */
    if (!version) throw new Error('Text zu lang für einen QR-Code dieser Größe');

    const n = version * 4 + 17;
    const cw = endgueltigeCodewoerter(bytes, version);

    let beste = null, besteStrafe = Infinity;
    for (let maske = 0; maske < 8; maske++) {
      if (maskeErzwingen != null && maske !== maskeErzwingen) continue;
      const mat = leereMatrix(n);
      setzeFest(mat, n, version);
      setzeDaten(mat, n, cw);
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++)
        if (!mat.reserviert[y][x] && MASKEN[maske](y, x)) mat.m[y][x] ^= 1;
      setzeFormat(mat.m, n, maske);
      setzeVersion(mat.m, n, version);
      const s = strafe(mat.m, n);
      if (s < besteStrafe) { besteStrafe = s; beste = mat.m; }
    }
    return { module: beste, groesse: n, version, strafe: besteStrafe };
  }

  /* Als SVG — scharf in jeder Groesse, druckbar, ohne Rasterbild.
     Der Ruhebereich von vier Modulen ist Pflicht: ohne ihn finden viele
     Kameras den Code auf einem bedruckten Aushang nicht. */
  function svg(text, { rand = 4, hell = '#ffffff', dunkel = '#000000' } = {}) {
    const { module, groesse } = matrix(text);
    const gesamt = groesse + rand * 2;
    let d = '';
    for (let y = 0; y < groesse; y++) {
      let x = 0;
      while (x < groesse) {
        if (!module[y][x]) { x++; continue; }
        let breite = 0;
        while (x + breite < groesse && module[y][x + breite]) breite++;
        d += `M${x + rand} ${y + rand}h${breite}v1h-${breite}z`;
        x += breite;
      }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${gesamt} ${gesamt}" shape-rendering="crispEdges" role="img" aria-label="QR-Code">`
      + `<rect width="${gesamt}" height="${gesamt}" fill="${hell}"/>`
      + `<path d="${d}" fill="${dunkel}"/></svg>`;
  }

  const QR = { matrix, svg };
  if (typeof module !== 'undefined' && module.exports) module.exports = QR;
  global.QR = QR;
})(typeof window !== 'undefined' ? window : globalThis);
