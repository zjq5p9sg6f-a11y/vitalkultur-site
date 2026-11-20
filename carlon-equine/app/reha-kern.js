// reha-kern.js — Reha-Kern für Visite (20.11.2026). EINE Datenwahrheit mit der iOS-App:
// Gerätearten und Stufen-Felder 1:1 aus CarlonCore/Sources/CarlonCore/EquineGeraeteStufen.swift
// (EquineGeraeteart, EquineWaterHeight, AquaStageMarker.label, beschleunigungG, fliehkraftG).
// Austauschformat = Forschungs-JSON 2.0 der App: session.deviceSettingsLog[] (Rohmarken) mit den
// StageInfo-Schlüsseln startSec, device, speedKmh, reverse, inclinePercent, waterHeight, waterHeightCm,
// waterTempC, vibrationHz, amplitudeMm, directionChanges, radiusM, intensityPercent, distanceCm.
// Auswertung je Stufe ist eine ÜBERGANGSFASSUNG (Definitionen nach Modellrat 20.11. und Equine:
// deltaHRbpm = Mittel der letzten 40 % der Stufe minus Mittel der 20 s davor; adaptationSec = Zeit bis 63 %
// der HF-Änderung, Sprungantwort 1. Ordnung, kleinste Quadrate). Sie wird durch Equines eingefrorenen
// JS-Port ersetzt; ein Kreuztest wacht dann über Gleichheit. Keine Diagnose, keine Bewertung.
(function (root) {
  const GERAETE = {
    keines:      { de: 'Ohne Gerät',  en: 'No device',      last: false, felder: [] },
    laufband:    { de: 'Laufband',    en: 'Treadmill',      last: true,  felder: ['speedKmh', 'inclinePercent', 'reverse', 'vibrationAn'] },
    aquatrainer: { de: 'Aquatrainer', en: 'Aqua treadmill', last: true,  felder: ['waterHeight', 'waterHeightCm', 'waterTempC', 'speedKmh', 'inclinePercent', 'reverse'] },
    vibration:   { de: 'Vibration',   en: 'Vibration',      last: false, felder: ['vibrationHz', 'amplitudeMm'] },
    fuehranlage: { de: 'Führanlage',  en: 'Horse walker',   last: true,  felder: ['speedKmh', 'directionChanges', 'radiusM'] },
    solarium:    { de: 'Solarium',    en: 'Solarium',       last: false, felder: ['intensityPercent', 'distanceCm'] },
    solekammer:  { de: 'Solekammer',  en: 'Salt chamber',   last: false, felder: ['intensityPercent'] },
    /* Bewegungsarbeit und weitere Anwendungen (20.11.2026, Recherche 13 Reha-Zentren DE/AT/CH/NL/UK: Reha-Pläne = Minuten je
       Gangart). gangStufe: ein Tipp auf Gangart oder Hand beginnt die nächste Stufe (Dauer entsteht von selbst). */
    handfuehren: { de: 'Führen an der Hand', en: 'In-hand walking', last: true, gangStufe: true, felder: ['gangart', 'untergrund', 'steigung', 'stangen'] },
    longe:       { de: 'Longe',       en: 'Lungeing',       last: true,  gangStufe: true, felder: ['longenArt', 'gangart', 'hand', 'zirkelM', 'hilfszuegel', 'stangen'] },
    reiten:      { de: 'Reiten',      en: 'Ridden work',    last: true,  gangStufe: true, felder: ['gangart', 'untergrund', 'gelaende', 'stangen'] },
    wasser:      { de: 'Wasser ohne Band', en: 'Water (no treadmill)', last: true, felder: ['wasserArt', 'waterHeight', 'waterTempC'] },
    anwendung:   { de: 'Anwendung im Stand', en: 'Standing therapy', last: false, felder: ['anwendungArt', 'intensityPercent'] },
    paddock:     { de: 'Freie Bewegung', en: 'Free movement', last: false, felder: ['untergrund'] },
    sonstiges:   { de: 'Sonstiges',   en: 'Other',          last: false, felder: ['bezeichnung'] },
  };
  // Eingabehilfen (Schritt, Bereich) für große Plus/Minus-Tasten am Gerät
  const FELD = {
    speedKmh:         { de: 'Tempo', en: 'Speed', einheit: 'km/h', schritt: 0.5, min: 0, max: 40 },
    inclinePercent:   { de: 'Steigung', en: 'Incline', einheit: '%', schritt: 0.5, min: -10, max: 20 },
    reverse:          { de: 'Rückwärts', en: 'Reverse', bool: true },
    waterHeight:      { de: 'Wasserhöhe', en: 'Water height', liste: ['none', 'fetlock', 'carpus', 'elbow', 'stifle', 'shoulder'] },
    waterHeightCm:    { de: 'Wasserhöhe in cm', en: 'Water height (cm)', einheit: 'cm', schritt: 5, min: 0, max: 200 },
    waterTempC:       { de: 'Wassertemperatur', en: 'Water temperature', einheit: '°C', schritt: 1, min: 0, max: 40 },
    vibrationHz:      { de: 'Frequenz', en: 'Frequency', einheit: 'Hz', schritt: 1, min: 0, max: 100 },
    amplitudeMm:      { de: 'Schwingweg', en: 'Displacement', einheit: 'mm', schritt: 0.01, min: 0, max: 5 },
    directionChanges: { de: 'Richtungswechsel', en: 'Reversals', einheit: '×', schritt: 1, min: 0, max: 50 },
    radiusM:          { de: 'Radius', en: 'Radius', einheit: 'm', schritt: 1, min: 1, max: 40 },
    intensityPercent: { de: 'Intensität', en: 'Intensity', einheit: '%', schritt: 5, min: 0, max: 100 },
    distanceCm:       { de: 'Abstand', en: 'Distance', einheit: 'cm', schritt: 5, min: 0, max: 300 },
    vibrationAn:      { de: 'Vibration', en: 'Vibration', bool: true },
    gangart:          { de: 'Gangart', en: 'Gait', liste: ['stand', 'schritt', 'trab', 'galopp'], namen: { stand: ['Stehen', 'Standing'], schritt: ['Schritt', 'Walk'], trab: ['Trab', 'Trot'], galopp: ['Galopp', 'Canter'] } },
    untergrund:       { de: 'Boden', en: 'Ground', liste: ['sand', 'gras', 'fest', 'tief'], namen: { sand: ['Sand', 'Sand'], gras: ['Gras', 'Grass'], fest: ['Fester Boden', 'Firm ground'], tief: ['Tiefer Boden', 'Deep ground'] } },
    steigung:         { de: 'Gelände', en: 'Slope', liste: ['eben', 'leicht', 'steil'], namen: { eben: ['Eben', 'Flat'], leicht: ['Leicht bergauf', 'Gentle slope'], steil: ['Steil', 'Steep'] } },
    gelaende:         { de: 'Ort', en: 'Where', liste: ['bahn', 'gelaende', 'huegel'], namen: { bahn: ['Reitbahn', 'Arena'], gelaende: ['Gelände eben', 'Flat terrain'], huegel: ['Hügel', 'Hills'] } },
    hand:             { de: 'Hand', en: 'Rein', liste: ['links', 'rechts'], namen: { links: ['Linke Hand', 'Left rein'], rechts: ['Rechte Hand', 'Right rein'] } },
    longenArt:        { de: 'Art', en: 'Type', liste: ['longe', 'doppellonge', 'langzuegel', 'freilauf'], namen: { longe: ['Longe', 'Lunge line'], doppellonge: ['Doppellonge', 'Double lunge'], langzuegel: ['Langzügel', 'Long reins'], freilauf: ['Freilauf', 'Free lungeing'] } },
    zirkelM:          { de: 'Zirkel', en: 'Circle', einheit: 'm', schritt: 2, min: 8, max: 30 },
    hilfszuegel:      { de: 'Hilfszügel', en: 'Training aid', bool: true },
    stangen:          { de: 'Stangen', en: 'Poles', einheit: '', schritt: 1, min: 0, max: 12 },
    wasserArt:        { de: 'Art', en: 'Type', liste: ['kaltspa', 'schwimmen'], namen: { kaltspa: ['Kaltwasser-Spa', 'Cold-water spa'], schwimmen: ['Schwimmen', 'Swimming'] } },
    anwendungArt:     { de: 'Anwendung', en: 'Therapy', liste: ['magnetfeld', 'laser', 'stosswelle', 'kuehlung', 'massage', 'physio'], namen: { magnetfeld: ['Magnetfeld', 'Magnetic field'], laser: ['Laser', 'Laser'], stosswelle: ['Stoßwelle', 'Shockwave'], kuehlung: ['Kühlung', 'Cooling'], massage: ['Massage', 'Massage'], physio: ['Physiotherapie', 'Physiotherapy'] } },
    bezeichnung:      { de: 'Bezeichnung', en: 'Name', text: true },
  };
  const WASSER = { none: ['Kein Wasser', 'No water'], fetlock: ['Fessel', 'Fetlock'], carpus: ['Karpus', 'Carpus'],
                   elbow: ['Ellbogen', 'Elbow'], stifle: ['Knie', 'Stifle'], shoulder: ['Schulter', 'Shoulder'] };
  // Alltagserklärung für jede Wasserhöhe (für Stallpersonal ohne Anatomie-Begriffe), Reihenfolge = Höhe am Pferd
  const WASSER_ERKL = {
    none:     ['Laufband ohne Wasser', 'Treadmill without water'],
    fetlock:  ['bis zum dicken Gelenk eine Handbreit über dem Huf', 'up to the joint a hand above the hoof'],
    carpus:   ['bis zum „Knie“ am Vorderbein (Vorderfußwurzel)', 'up to the "knee" of the front leg'],
    elbow:    ['bis dahin, wo das Vorderbein hinten an die Brust stößt', 'up to where the front leg meets the chest at the back'],
    stifle:   ['bis zum Kniegelenk vorn am Hinterbein, etwa Bauchunterseite', 'up to the knee joint at the front of the hind leg, about belly level'],
    shoulder: ['bis zur Spitze der Brust vorn (Buggelenk)', 'up to the point of the shoulder at the front of the chest'],
  };
  // Rangfolge der Höhe am Pferd. Ellbogen und Knie (hinten) liegen etwa gleich hoch: kein Vergleich untereinander.
  const WASSER_RANG = { none: 0, fetlock: 1, carpus: 2, elbow: 3, stifle: 3, shoulder: 4 };
  // Abweichung zur bisher bei DIESEM Pferd gemessenen cm-Zahl derselben Höhe, ab der nachgefragt wird (CARLON-Festlegung:
  // drei Rasterschritte des Felds, 15 cm; Tagesschwankung durch Einfüllmenge bleibt darunter)
  const WASSER_TOLERANZ_CM = 15;
  // Widerspruchsprüfung Höhe ↔ cm. karte = { höhe: cm } aus früheren Stufen dieses Pferds. Ergebnis null = stimmig,
  // sonst { de, en, hoehe?, cm? } mit Vorschlägen für eine Ein-Tipp-Korrektur.
  function wasserPruefen(m, karte) {
    const h = m.waterHeight, cm = m.waterHeightCm; karte = karte || {};
    if (!h || cm == null) return null;
    const naechste = () => { let best = null; for (const [k, v] of Object.entries(karte)) if (best == null || Math.abs(v - cm) < Math.abs(karte[best] - cm)) best = k; return best; };
    if (h === 'none' && cm > 0) { const n = naechste(); return { de: `„Kein Wasser“ gewählt, aber ${cm} cm eingestellt.`, en: `“No water” selected but ${cm} cm set.`, hoehe: n || 'fetlock', cm: 0 }; }
    if (h !== 'none' && cm === 0) return { de: `${WASSER[h][0]} gewählt, aber 0 cm eingestellt.`, en: `${WASSER[h][1]} selected but 0 cm set.`, hoehe: 'none', cm: karte[h] != null ? karte[h] : null };
    if (h === 'none') return null;
    const r = WASSER_RANG[h];
    for (const [k, v] of Object.entries(karte)) {
      if (k === h || k === 'none') continue; const rk = WASSER_RANG[k];
      if ((rk < r && v >= cm) || (rk > r && v <= cm)) {
        const n = naechste();
        return { de: `Bei diesem Pferd war ${WASSER[k][0]} bisher ${v} cm. ${cm} cm passt deshalb nicht zu ${WASSER[h][0]}.`,
                 en: `For this horse ${WASSER[k][1]} was ${v} cm so far, so ${cm} cm does not fit ${WASSER[h][1]}.`, hoehe: n !== h ? n : null, cm: karte[h] != null ? karte[h] : null };
      }
    }
    if (karte[h] != null && Math.abs(karte[h] - cm) > WASSER_TOLERANZ_CM) {
      const n = naechste();
      return { de: `${WASSER[h][0]} war bei diesem Pferd bisher ${karte[h]} cm, jetzt ${cm} cm.`, en: `${WASSER[h][1]} was ${karte[h]} cm for this horse so far, now ${cm} cm.`, hoehe: n && n !== h ? n : null, cm: karte[h] };
    }
    return null;
  }
  // cm je Höhe aus Stufen-Marken (Median), z. B. aller bisherigen Sitzungen eines Pferds
  function wasserKarte(marken) {
    const L = {}; for (const m of marken || []) if (m && m.waterHeight && m.waterHeight !== 'none' && m.waterHeightCm > 0) (L[m.waterHeight] = L[m.waterHeight] || []).push(+m.waterHeightCm);
    const k = {}; for (const [h, v] of Object.entries(L)) { v.sort((x, y) => x - y); const n = v.length; const md = n % 2 ? v[(n - 1) / 2] : (v[n / 2 - 1] + v[n / 2]) / 2; k[h] = Math.round(md / 5) * 5; } return k;
  }

  // Abgeleitete Dosen wie in der App: Spitze-zu-Spitze → Amplitude = Weg/2; a_c = v²/r
  function beschleunigungG(m) { const f = m.vibrationHz, w = m.amplitudeMm; if (!(f > 0) || !(w > 0)) return null; return Math.pow(2 * Math.PI * f, 2) * ((w / 2) / 1000) / 9.81; }
  function fliehkraftG(m) { const v = m.speedKmh, r = m.radiusM; if (v == null || !(r > 0)) return null; const vms = v / 3.6; return (vms * vms / r) / 9.81; }

  // Port von AquaStageMarker.label(de:) — gleiche Reihenfolge, gleiche Einheiten
  function label(m, de = true) {
    const z = (v, d) => { const t = (+v).toFixed(d); return de ? t.replace('.', ',') : t; };
    const p = [];
    /* neue Typen (20.11.2026) zuerst mit ihrem Namen; bei den Gerätetypen kommen diese Felder nicht vor (Reihenfolge wie bisher) */
    const nm = (f, v) => { const F = FELD[f]; return F && F.namen && F.namen[v] ? F.namen[v][de ? 0 : 1] : v; };
    for (const f of ['bezeichnung', 'anwendungArt', 'wasserArt', 'longenArt', 'gangart', 'hand', 'untergrund', 'steigung', 'gelaende']) if (m[f]) p.push(f === 'bezeichnung' ? String(m[f]) : nm(f, m[f]));
    if (m.vibrationHz != null) p.push(`${z(m.vibrationHz, 1)} Hz`);
    if (m.amplitudeMm != null) p.push(`${z(m.amplitudeMm, 2)} mm`);
    if (m.inclinePercent != null) p.push(de ? `Steigung ${z(m.inclinePercent, 1)} %` : `incline ${z(m.inclinePercent, 1)} %`);
    if (m.waterHeight) p.push(WASSER[m.waterHeight] ? WASSER[m.waterHeight][de ? 0 : 1] : m.waterHeight);
    if (m.waterHeightCm != null) p.push(`${z(m.waterHeightCm, 0)} cm`);
    if (m.waterTempC != null && (m.waterHeight !== 'none' || (m.waterHeightCm || 0) > 0)) p.push(de ? `Wasser ${z(m.waterTempC, 1)} °C` : `water ${z(m.waterTempC, 1)} °C`);
    if (m.speedKmh != null) p.push(`${z(m.speedKmh, 1)} km/h`);
    if (m.reverse === true) p.push(de ? 'rückwärts' : 'reverse');
    if (m.directionChanges != null) p.push(de ? `${m.directionChanges}× Wechsel` : `${m.directionChanges}× reversal`);
    const g = fliehkraftG(m); if (g != null) p.push(`${z(g, 2)} g`);
    if (m.intensityPercent != null) p.push(`${m.device === 'solekammer' ? (de ? 'Vernebelung' : 'nebulisation') : (de ? 'Intensität' : 'intensity')} ${z(m.intensityPercent, 0)} %`);
    if (m.distanceCm != null) p.push(de ? `${z(m.distanceCm, 0)} cm Abstand` : `${z(m.distanceCm, 0)} cm distance`);
    if (m.zirkelM != null) p.push(de ? `Zirkel ${z(m.zirkelM, 0)} m` : `circle ${z(m.zirkelM, 0)} m`);
    if (m.hilfszuegel === true) p.push(de ? 'Hilfszügel' : 'training aid');
    if (m.stangen > 0) p.push(de ? `${m.stangen} Stangen` : `${m.stangen} poles`);
    if (m.vibrationAn === true) p.push('Vibration');
    if (!p.length && m.note) p.push(m.note);
    return p.join(' · ');
  }
  // Lastschlüssel: verglichen werden nur Sitzungen mit identischem Schlüssel (fairer Verlauf)
  function lastschluessel(m) { const g = GERAETE[m.device] || GERAETE.keines; return [m.device].concat(g.felder.map(f => f + '=' + (m[f] == null ? '' : m[f]))).join('|'); }

  // ── Auswertung (Übergangsfassung) ─────────────────────────────────────────────
  let _zeit = null;   // Zeitachse von außen (Rohreihe), wenn die Werte aus der korrigierten Reihe kommen
  function zeitachse(rr) { if (_zeit && _zeit.length === rr.length) return _zeit; const t = []; let a = 0; for (const x of rr) { a += x / 1000; t.push(a); } return t; }
  const mittel = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
  const median = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
  function fenster(rr, t, a, b) { const i = []; for (let k = 0; k < rr.length; k++) if (t[k] > a && t[k] <= b) i.push(k); return i; }
  function hf(rr, idx) { return idx.map(k => 60000 / rr[k]); }
  function artefaktPct(rr, idx) { if (!idx.length) return null; let n = 0; for (const k of idx) { const h = 60000 / rr[k]; const prev = k > 0 ? rr[k - 1] : rr[k]; if (h < 20 || h > 230 || Math.abs(rr[k] - prev) / prev > 0.2) n++; } return 100 * n / idx.length; }
  function rmssd(rr, idx) { const d = []; for (let j = 1; j < idx.length; j++) if (idx[j] === idx[j - 1] + 1) d.push(rr[idx[j]] - rr[idx[j - 1]]); return d.length > 1 ? Math.sqrt(mittel(d.map(x => x * x))) : null; }
  // Sprungantwort 1. Ordnung: HF(t) = h0 + Δ·(1 − e^(−t/τ)); τ per Gittersuche (kleinste Quadrate); Zeit bis 63 % = τ
  function adaptation(rr, t, s, e, h0) {
    const idx = fenster(rr, t, s, e); if (idx.length < 10 || h0 == null) return null;
    const x = idx.map(k => t[k] - s), y = hf(rr, idx); const hEnd = mittel(y.slice(Math.floor(y.length * 0.6))); const d = hEnd - h0;
    if (Math.abs(d) < 1) return null; let best = null;
    for (let tau = 2; tau <= Math.min(600, (e - s)); tau += 1) { let sse = 0; for (let j = 0; j < x.length; j++) { const f = h0 + d * (1 - Math.exp(-x[j] / tau)); sse += (y[j] - f) * (y[j] - f); } if (!best || sse < best.sse) best = { tau, sse }; }
    return best ? best.tau : null;
  }
  function stufen(rr, log) {
    const t = zeitachse(rr), T = t[t.length - 1] || 0;
    const l = (log || []).slice().sort((a, b) => a.startSec - b.startSec);
    return l.map((m, i) => {
      const s = m.startSec, e = i + 1 < l.length ? l[i + 1].startSec : T;
      const idx = fenster(rr, t, s, e), h = hf(rr, idx);
      const vor = hf(rr, fenster(rr, t, s - 20, s)), h0 = mittel(vor);
      const spaet = hf(rr, fenster(rr, t, s + 0.6 * (e - s), e));
      const ende60 = hf(rr, fenster(rr, t, e - 60, e));
      return { index: i, startSec: s, endSec: e, device: m.device, label: label(m), schluessel: lastschluessel(m), last: !!(GERAETE[m.device] || {}).last,
        beats: idx.length, meanHRbpm: mittel(h), hfMedian60: (e - s) >= 120 ? median(ende60) : null,
        deltaHRbpm: (h0 != null && spaet.length) ? mittel(spaet) - h0 : null,
        adaptationSec: adaptation(rr, t, s, e, h0),
        /* RMSSD je Stufe wie in der App (Trainingsbericht): ohne die ersten 2 min der Stufe (Anpassung), nur bei stabiler Datenqualität (< 5 % Artefakte, ≥ 60 Schläge) */
        rmssdMs: (() => { const j = fenster(rr, t, s + 120, e); return (j.length >= 60 && (artefaktPct(rr, j) || 0) < 5) ? rmssd(rr, j) : null; })(),
        hrvValide: (() => { const j = fenster(rr, t, s + 120, e); return j.length >= 60 && (artefaktPct(rr, j) || 0) < 5; })(),
        artifactRatePct: artefaktPct(rr, idx), markierung: m };
    });
  }
  // Erholung nach der letzten Belastungsstufe: HF bei +60/180/300 s (±10 s), Abfall gegenüber dem Lastende
  function erholung(rr, st) {
    const t = zeitachse(rr); const lastSt = st.filter(x => x.last && x.device !== 'keines'); if (!lastSt.length) return null;
    const ende = lastSt[lastSt.length - 1].endSec, hEnde = median(hf(rr, fenster(rr, t, ende - 30, ende)));
    const bei = s => { const h = hf(rr, fenster(rr, t, ende + s - 10, ende + s + 10)); return h.length >= 5 ? mittel(h) : null; };
    const r = { endeSec: ende, hfEnde: hEnde };
    for (const s of [60, 180, 300]) { const v = bei(s); r['hf' + s] = v; r['abfall' + s] = (v != null && hEnde != null) ? hEnde - v : null; }
    return r;
  }
  function ruhe(rr, st) {
    const t = zeitachse(rr), T = t[t.length - 1] || 0; if (!st.length) return null;
    const a = st[0].startSec, vor = fenster(rr, t, 0, a);
    const lastSt = st.filter(x => x.last); const nachAb = lastSt.length ? lastSt[lastSt.length - 1].endSec + 300 : null;
    const nach = nachAb != null ? fenster(rr, t, nachAb, T) : [];
    return { vorSec: a, rmssdVor: a >= 300 ? rmssd(rr, vor) : null, hfVor: vor.length ? mittel(hf(rr, vor)) : null,
             nachSec: nachAb != null ? Math.max(0, T - nachAb) : 0, rmssdNach: (nachAb != null && T - nachAb >= 300) ? rmssd(rr, nach) : null };
  }
  /* Belastungsende vergessen (Lehre aus dem Zeitraffer, 20.11.2026): Folgt auf die letzte Gerätestufe keine Marke
     „Belastung Ende“, sucht die Auswertung den Pulsabfall selbst – Mittel über 20 s fällt um mindestens 15 bpm unter das
     Niveau der Stufe (Median ab 60 % der Stufe bis dorthin) und bleibt 60 s darunter. Die erkannte Marke trägt
     `erkannt: true` und wird im Bericht so benannt. Rückwirkend: gilt auch für alte Aufnahmen, die Rohdaten bleiben unberührt. */
  function endeErgaenzen(rr, log) {
    const l = (log || []).slice().sort((a, b) => a.startSec - b.startSec); if (!l.length) return l;
    const letzte = l[l.length - 1]; if (letzte.device === 'keines' || !(GERAETE[letzte.device] || {}).last) return l;
    const t = zeitachse(rr), T = t[t.length - 1] || 0, s = letzte.startSec; if (T - s < 240) return l;
    /* Präfixsummen der Herzfrequenz + binäre Suche: jedes Fenstermittel in O(log n) statt einer Vollsuche */
    const n = rr.length, S = new Float64Array(n + 1); for (let k = 0; k < n; k++) S[k + 1] = S[k] + 60000 / rr[k];
    const pos = x => { let lo = 0, hi = n; while (lo < hi) { const m = (lo + hi) >> 1; if (t[m] <= x) lo = m + 1; else hi = m; } return lo; };
    const mw = (a, b) => { const i = pos(a), j = pos(b); return j > i ? (S[j] - S[i]) / (j - i) : null; };
    /* Grundniveau = Mittel der Stufe bis kurz vor x; sobald der Puls 5 bpm darunter fällt, wird es EINGEFROREN
       (sonst sinkt es mit dem Abfall mit). Erreicht der Abfall binnen 180 s 15 bpm und hält 60 s → Belastungsende. */
    let basis = null, abX = null;
    for (let x = s + 120; x <= T - 60; x += 5) {
      const jetzt = mw(x - 20, x); if (jetzt == null) continue;
      if (abX == null) { basis = mw(s + 60, x - 20); if (basis == null) continue; if (jetzt <= basis - 5) abX = x; continue; }
      if (x - abX > 180 || jetzt > basis - 3) { abX = null; continue; }
      if (jetzt > basis - 15) continue;
      let bleibt = true; for (let y = x; y <= x + 60; y += 10) { const m = mw(y - 10, y); if (m == null || m > basis - 15) { bleibt = false; break; } }
      if (!bleibt) continue;
      let start = abX - 20; for (let y = abX - 20; y > s + 60; y -= 2) { const m = mw(y - 6, y); if (m != null && m >= basis - 2) { start = y; break; } }
      return l.concat([{ startSec: Math.round(start * 10) / 10, device: 'keines', erkannt: true }]);
    }
    return l;
  }
  /* opt.zeit: Zeitachse der ROHreihe. Werte dürfen aus der artefaktkorrigierten Reihe kommen (ersetzte AV-Block-Pausen),
     die Zeit nicht – sonst rückten alle Stufenmarken je ersetzter Pause um ihre Länge zusammen. */
  function auswerten(rr, log, opt) { _zeit = opt && opt.zeit && opt.zeit.length === rr.length ? opt.zeit : null; try { return auswertenInnen(rr, log); } finally { _zeit = null; } }
  function auswertenInnen(rr, log) { const l2 = endeErgaenzen(rr, log); const st = stufen(rr, l2); return { stufen: st, erholung: erholung(rr, st), ruhe: ruhe(rr, st), endeErkannt: l2.length > (log || []).length, version: VERSION }; }
  const VERSION = 'Reha-Auswertung 1.1 (2026-11-20, Schema CarlonCore EquineGeraeteStufen)';
  const api = { GERAETE, FELD, WASSER, WASSER_ERKL, WASSER_RANG, WASSER_TOLERANZ_CM, wasserPruefen, wasserKarte, label, lastschluessel, beschleunigungG, fliehkraftG, auswerten, stufen, erholung, ruhe, zeitachse, endeErgaenzen, VERSION };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.RehaKern = api;
})(typeof window !== 'undefined' ? window : globalThis);
