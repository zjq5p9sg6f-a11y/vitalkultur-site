/* pruefen.js — Prüfseite für Visite-Berichte (27.11.2026). Stellt NUR den signierten Datenblock neu dar, immer per textContent.
   Fremdes HTML aus der Datei wird nie eingefügt. Kein Service Worker, keine Netzanfrage: Prüfung offline gegen den öffentlichen Schlüssel. */
(function () {
  'use strict';
  /* Öffentlicher Schlüssel des Lizenzdienstes, gleich License.PUB in carlon-equine/app/index.html. */
  const PUB = { kty: 'EC', crv: 'P-256', x: 'pqbiPaa-gOiZKjeRsQ7XMRe9am5L7giiV48Qjzp3enY', y: '5lg4Ipa-paTigXd7rxitFKwpee8h1Lu0W5eod1mYOok' };
  let en = false; try { en = new URLSearchParams(location.search).get('lang') === 'en'; } catch (_) { }
  const T = {
    titel: 'Check a report', intro: 'Choose a report (HTML) or export (JSON) from CARLON Equine Visite. The check runs only in this browser; the file does not leave your device.',
    waehlen: 'Choose file', datenT: 'Signed measurements', datenH: 'Re-rendered from the signed data block, not from the report view.', kennwert: 'Metric', wert: 'Value',
    fuss: 'Not a medical device, no diagnosis. What is checked is origin and integrity, not the measurement itself.' };
  const STUFE = { geprueft: ['Herkunft geprüft', 'Origin verified'], nichtLizenziert: ['Lizenznachweis nicht bestätigt', 'Licence proof not confirmed'],
    veraendert: ['Inhalt passt nicht zum Siegel', 'Content does not match the seal'], unlesbar: ['Herkunftssiegel ungültig', 'Origin seal invalid'], ohneSiegel: ['Ohne Herkunftssiegel', 'No origin seal'] };
  const GRUND_EN = { 'Siegel enthält keinen Lizenznachweis': 'seal carries no licence proof', 'Lizenz nicht von CARLON ausgestellt': 'licence not issued by CARLON', 'Kein Laufzeit-Schlüssel': 'not a runtime licence',
    'Lizenz passt nicht zum Schlüssel des Siegels': 'licence does not match the seal key', 'Lizenz ohne Praxisbindung': 'licence not bound to a practice', 'Lizenz deckt das angegebene Exportdatum nicht ab': 'licence does not cover the stated export date',
    'Inhalt weicht vom versiegelten Stand ab': 'content differs from the sealed version', 'Signatur des Siegels ungültig': 'seal signature invalid', 'Siegel unvollständig': 'seal incomplete', 'Siegel unlesbar': 'seal unreadable',
    'Kein Herkunftssiegel': 'no origin seal', 'Siegel enthält fremde Felder': 'seal contains unknown fields', 'Prüfschlüssel dieser Visite fehlt': 'verification key missing', 'Herkunft geprüft': 'origin verified' };
  const KW = { meanHR: ['Mittlere Herzfrequenz', 'Mean heart rate'], minHR: ['Minimale Herzfrequenz', 'Minimum heart rate'], maxHR: ['Maximale Herzfrequenz', 'Maximum heart rate'],
    rmssd: ['RMSSD', 'RMSSD'], sdnn: ['SDNN', 'SDNN'], quality: ['Signalgüte', 'Signal quality'] };
  const $ = id => document.getElementById(id), loc = en ? 'en-GB' : 'de-DE';
  if (en) { document.documentElement.lang = 'en'; document.title = 'Check a report · CARLON Equine'; document.querySelectorAll('[data-t]').forEach(e => { if (T[e.dataset.t]) e.textContent = T[e.dataset.t]; }); }
  const zahl = v => typeof v === 'number' && Number.isFinite(v) ? v.toLocaleString(loc, { maximumFractionDigits: 2 }) : '';
  const text = v => String(v == null ? '' : v).replace(/[\p{Cc}\p{Cf}]/gu, '');
  const zeile = (dl, k, v, feld) => { if (!v) return; const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = k; dd.textContent = v; if (feld) dd.dataset.feld = feld; dl.append(dt, dd); };
  function zeigen(r) {
    const s = $('stufe'), st = STUFE[r.stufe] || [r.stufe, r.stufe], d = r.zeit ? new Date(r.zeit * 1000).toLocaleDateString(loc) : '';
    s.dataset.stufe = r.stufe; s.className = 'stufe ' + (r.stufe === 'geprueft' ? 'ok' : 'warn');
    s.textContent = st[en ? 1 : 0] + (r.stufe === 'geprueft' && r.praxis ? ': ' + text(r.praxis) : '');
    $('grund').textContent = (en ? (GRUND_EN[r.grund] || r.grund) : r.grund) + (d ? (en ? ' · export date stated by sender ' : ' · Exportdatum laut Absender ') + d : '');
    const box = $('daten'), dl = $('felder'), tb = $('kw'); dl.replaceChildren(); tb.replaceChildren();
    const D = r.datenEcht && r.daten && typeof r.daten === 'object' ? r.daten : null; box.hidden = !D;
    if (D) {
      zeile(dl, en ? 'Horse' : 'Pferd', text(D.pferd && D.pferd.name), 'pferd');
      zeile(dl, en ? 'Practice (stated in report)' : 'Praxis (laut Bericht)', text(D.praxis), 'praxis');
      const b = D.aufnahme && D.aufnahme.beginn ? new Date(D.aufnahme.beginn) : null;
      zeile(dl, en ? 'Recording start' : 'Beginn der Aufnahme', b && !isNaN(b) ? b.toLocaleString(loc) : '', 'beginn');
      if (D.aufnahme && typeof D.aufnahme.dauerS === 'number') zeile(dl, en ? 'Duration' : 'Dauer', Math.round(D.aufnahme.dauerS / 60) + ' min', 'dauer');
      for (const [k, n] of Object.entries(KW)) { const w = D.kennwerte && D.kennwerte[k]; if (!w || typeof w.wert !== 'number') continue;
        const tr = document.createElement('tr'), a = document.createElement('td'), v = document.createElement('td');
        a.textContent = n[en ? 1 : 0]; v.textContent = zahl(w.wert) + ' ' + text(w.einheit); v.dataset.kw = k; tr.append(a, v); tb.append(tr); }
    }
    $('ergebnis').hidden = false;
  }
  $('datei').addEventListener('change', async ev => {
    const f = ev.target.files && ev.target.files[0]; if (!f) return;
    let r;
    try { const t = await f.text();
      r = /\.json$/i.test(f.name) || /^\s*\{/.test(t) ? await Siegel.jsonPruefen(JSON.parse(t), PUB) : await Siegel.htmlPruefen(t, PUB);
    } catch (_) { r = { stufe: 'unlesbar', grund: 'Siegel unlesbar' }; }
    zeigen(r);
  });
})();
