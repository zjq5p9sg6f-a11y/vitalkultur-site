/* STEUERUNGSPROTOKOLL-IMPORT (22.11.2026, Jan: Sascotec soll Visite mit seiner Steuerungsdatei einrichten können)
   Die Gerätesteuerung (Laufband, Aquatrainer, Führanlage, Vibration) schreibt eine Datei mit Zeit und Einstellungen.
   Visite liest sie NUR (keine Steuerung), ordnet die Werte der Aufnahme über die Zeit zu und macht daraus die Stufen,
   die sonst von Hand getippt werden. Format-agnostisch: Trennzeichen, Kopfzeile, Zeitspalte, Dezimalkomma, Einheiten
   werden erkannt; die Spaltenzuordnung wird je Gerät EINMAL eingerichtet (Profil) und danach automatisch genutzt.
   Reine Funktionen (lesen, zuordnen, stufen) sind ohne Browser testbar: werkzeuge/steuerung-test.mjs */
(function (g) {
  'use strict';
  const FELDER = {
    speedKmh:       { re: /(tempo|geschw|speed|velocity|^v$|^v[_ ]|km\/?h|mph|m\/s|band)/i, schwelle: 0.2 },
    inclinePercent: { re: /(steig|neigung|incline|gradient|grade|slope|winkel)/i, schwelle: 0.5 },
    waterHeightCm:  { re: /(wasser.*(h(ö|oe)he|stand|level|tiefe)|f(ü|ue)llstand|water.*(height|level|depth)|pegel|niveau)/i, schwelle: 2 },
    waterTempC:     { re: /(temp)/i, schwelle: 0.5 },
    vibrationHz:    { re: /(frequenz|frequency|hz|vibra)/i, schwelle: 1 },
    reverse:        { re: /(r(ü|ue)ckw|reverse|richtung|direction)/i, schwelle: 0.5 },
    radiusM:        { re: /(radius)/i, schwelle: 0.5 }
  };
  /* dez: ',' (deutsch, Punkt = Tausender) · '.' (englisch, Komma = Tausender) · null = raten je Zelle */
  const zahl = (s, dez) => { if (s == null) return NaN; let t = String(s).trim().replace(/\s/g, ''); if (!t) return NaN;
    if (dez === '.') t = t.replace(/,/g, ''); else if (dez === ',') t = t.replace(/\./g, '').replace(',', '.');
    else if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, '').replace(',', '.'); else t = t.replace(',', '.');
    if (!/^-?\d*\.?\d+(e-?\d+)?$/i.test(t)) return NaN; const v = parseFloat(t); return isFinite(v) ? v : NaN; };
  const wahr = s => /^(1|ja|yes|true|an|on|r(ü|ue)ckw|rev)/i.test(String(s).trim()) ? 1 : 0;

  /* Zeit einer Zelle in ms: ISO/Datum+Uhrzeit (absolut), HH:MM:SS[.ms] (Tageszeit, abs. mit Datum der Aufnahme), Sekunden/Millisekunden/Unix */
  function zeitArt(werte) {
    const w = werte.filter(x => String(x).trim()).slice(0, 20);
    if (!w.length) return null;
    if (w.every(x => /^(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[./]\d{1,2}[./]\d{2,4})[ T]\d{1,2}:\d{2}/.test(String(x).trim()))) return 'datum';
    if (w.every(x => /^\d{1,2}:\d{2}(:\d{2}([.,]\d+)?)?$/.test(String(x).trim()))) return 'uhrzeit';
    const n = w.map(zahl); if (n.some(isNaN)) return null;
    const max = Math.max(...n); if (max > 1e12) return 'unixMs'; if (max > 1e9) return 'unixS';
    return 'sekunden';
  }
  function zeitMs(x, art, tagMs, mdy) {
    const s = String(x).trim();
    if (art === 'datum') { const y = s.match(/^(\d{4})[/.](\d{1,2})[/.](\d{1,2})[ T](.*)$/); if (y) return Date.parse(`${y[1]}-${y[2].padStart(2, '0')}-${y[3].padStart(2, '0')}T${y[4]}`.replace(',', '.'));
      const m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})[ T](.*)$/); const [tt, mm] = m && mdy && s.includes('/') ? [m[2], m[1]] : m ? [m[1], m[2]] : []; const iso = m ? `${m[3].length === 2 ? '20' + m[3] : m[3]}-${mm.padStart(2, '0')}-${tt.padStart(2, '0')}T${m[4]}` : s.replace(' ', 'T'); return Date.parse(iso.replace(',', '.')); }
    if (art === 'excel') { return Math.round((zahl(s) - 25569) * 86400000 + new Date().getTimezoneOffset() * 60000); }
    if (art === 'uhrzeit') { const [h, mi, se] = s.split(':'); return tagMs + ((+h) * 3600 + (+mi) * 60 + zahl(se || 0)) * 1000; }
    const v = zahl(s); if (art === 'unixMs') return v; if (art === 'unixS') return v * 1000; return v * 1000;   // sekunden: relativ
  }

  /* Bytes → Text: UTF-16 (BOM oder viele Nullbytes), UTF-8, sonst Windows-1252 (ältere Panels/Excel) */
  function dekodieren(buf) {
    const b = new Uint8Array(buf);
    if (b[0] === 0xFF && b[1] === 0xFE) return new TextDecoder('utf-16le').decode(b.subarray(2));
    if (b[0] === 0xFE && b[1] === 0xFF) return new TextDecoder('utf-16be').decode(b.subarray(2));
    let nul = 0; for (let k = 1; k < Math.min(b.length, 400); k += 2) if (b[k] === 0) nul++;
    if (nul > 60) return new TextDecoder('utf-16le').decode(b);
    const u = new TextDecoder('utf-8').decode(b); return /�/.test(u) ? new TextDecoder('windows-1252').decode(b) : u;
  }
  function spalten(z, t) { const out = []; let cur = '', q = false;
    for (let k = 0; k < z.length; k++) { const c = z[k];
      if (c === '"') { if (q && z[k + 1] === '"') { cur += '"'; k++; } else q = !q; }
      else if (c === t && !q) { out.push(cur.trim()); cur = ''; } else cur += c; }
    out.push(cur.trim()); return out; }
  const istZahlOderZeit = c => !isNaN(zahl(c)) || /^-?[\d.,]+$/.test(c) || /^\d{1,2}:\d{2}/.test(c) || /^\d{4}-\d{2}-\d{2}|^\d{1,2}[./]\d{1,2}[./]\d{2,4}/.test(c);
  function lesen(text) {
    const zeilenRoh = String(text).replace(/^﻿/, '').split(/\r?\n/).filter(z => z.trim() && !/^\s*(#|\/\/)/.test(z));
    if (zeilenRoh.length < 2) return { fehler: 'Zu wenige Zeilen' };
    /* Trennzeichen: das mit der häufigsten gleichbleibenden Spaltenzahl im Datenteil (Metadaten oben stören so nicht) */
    let best = null;
    for (const t of ['\t', ';', ',', '|']) { const n = zeilenRoh.map(z => spalten(z, t).length); const h = {};
      n.slice(-Math.min(200, n.length)).forEach(x => { if (x > 1) h[x] = (h[x] || 0) + 1; });
      const [anz, haeuf] = Object.entries(h).sort((a, b) => b[1] - a[1])[0] || [0, 0];
      if (haeuf && (!best || haeuf > best.haeuf || (haeuf === best.haeuf && +anz > best.anz))) best = { t, anz: +anz, haeuf }; }
    const trenner = best ? best.t : ';';
    const teile = zeilenRoh.map(z => spalten(z, trenner)).filter(r => r.length === (best ? best.anz : r.length));
    /* erste Datenzeile = erste Zeile, deren Zellen überwiegend Zahl/Zeit sind; davor: Kopf (+ evtl. Einheitenzeile) */
    const datenAb = teile.findIndex(r => r.filter(istZahlOderZeit).length >= Math.ceil(r.length * 0.6));
    if (datenAb < 0) return { fehler: 'Keine Datenzeilen' };
    let kopf = datenAb > 0 ? teile[datenAb - 1].slice() : teile[0].map((_, i) => 'Spalte ' + (i + 1));
    if (datenAb > 1 && teile[datenAb - 1].every(c => c.length <= 9 && /^[\[(]?[%°a-zA-Zµ/²:]*[\])]?$/.test(c)) && teile[datenAb - 2].some(c => c.length > 2))
      kopf = teile[datenAb - 2].map((k, i) => (k + ' ' + (teile[datenAb - 1][i] || '')).trim());   // Einheitenzeile unter dem Kopf
    let daten = teile.slice(datenAb).filter(r => r.filter(istZahlOderZeit).length >= Math.ceil(r.length * 0.5));
    /* Langformat (Siemens WinCC Comfort/Advanced-Archiv: "VarName";"TimeString";"VarValue";"Validity";"Time_ms"; ähnlich viele Panels):
       eine Zeile je Variable und Zeitpunkt → in Breitformat drehen (eine Spalte je Variable). Quelle: Siemens-Support, Archiv-CSV-Aufbau. */
    const vn = kopf.findIndex(k => /^(var_?name|tag_?name|tag|variable|name|kanal|channel)$/i.test(k.replace(/\s/g, '')));
    const vv = kopf.findIndex(k => /^(var_?value|value|wert|messwert)$/i.test(k.replace(/\s/g, '')));
    const vt = kopf.findIndex(k => /(time_?string|zeit|time|datum|date|stamp)/i.test(k) && !/_ms$/i.test(k));
    if (vn >= 0 && vv >= 0 && vt >= 0) {
      const namen = [...new Set(daten.map(r => r[vn]))], zeilen = new Map();
      for (const r of daten) { if (kopf.some(k => /validity|g(ü|ue)ltig/i.test(k)) && r[kopf.findIndex(k => /validity|g(ü|ue)ltig/i.test(k))] === '0') continue;
        const t = r[vt]; if (!zeilen.has(t)) zeilen.set(t, [t, ...namen.map(() => '')]); zeilen.get(t)[1 + namen.indexOf(r[vn])] = r[vv]; }
      kopf = [kopf[vt], ...namen]; daten = [...zeilen.values()];
    }
    /* Datum und Uhrzeit in zwei Spalten → zusammenführen */
    const di = kopf.findIndex((_, i) => daten.slice(0, 5).every(r => /^(\d{4}-\d{2}-\d{2}|\d{1,2}[./]\d{1,2}[./]\d{2,4})$/.test(r[i])));
    if (di >= 0 && daten.slice(0, 5).every(r => /^\d{1,2}:\d{2}/.test(r[di + 1] || ''))) {
      daten = daten.map(r => { const d = r[di].replace(/\//g, '.'), m = d.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/), iso = m ? `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : d;
        const n = r.slice(); n.splice(di, 2, iso + 'T' + r[di + 1]); return n; });
      kopf = kopf.slice(); kopf.splice(di, 2, (kopf[di] + ' ' + kopf[di + 1]).trim());
    }
    let zeitIdx = kopf.findIndex(k => /(zeit|time|uhr|datum|date|stamp|^t$|sek|sec)/i.test(k) && !/(lauf|run|dauer|duration|elapsed)/i.test(k));
    if (zeitIdx < 0 || !zeitArt(daten.map(r => r[zeitIdx]))) zeitIdx = kopf.findIndex((_, i) => zeitArt(daten.map(r => r[i])));
    const za = zeitIdx >= 0 ? zeitArt(daten.map(r => r[zeitIdx])) : null;
    const zellen = daten.slice(0, 200).flatMap(r => r.filter((_, i) => i !== zeitIdx));
    const dez = zellen.some(c => /^-?\d+,\d+$/.test(c)) ? ',' : zellen.some(c => /^-?\d+\.\d+$/.test(c)) ? '.' : (trenner === ',' ? '.' : ',');
    const tm = daten.slice(0, 200).map(r => String(r[zeitIdx] || '').match(/^(\d{1,2})\/(\d{1,2})\/\d{2,4}/)).filter(Boolean);
    const mdy = tm.length > 0 && !tm.some(m => +m[1] > 12) && (tm.some(m => +m[2] > 12) || true);
    return { trenner, dez, mdy, kopf, daten, zeitIdx, zeitArt: za === 'sekunden' && /(datum|date)/i.test(kopf[zeitIdx] || '') && daten.every(r => zahl(r[zeitIdx]) > 30000 && zahl(r[zeitIdx]) < 80000) ? 'excel' : za };
  }

  /* Vorschlag Spalte → Feld; Einheit aus dem Kopf (m/s, mph → km/h; mm → cm; °F → °C) */
  function zuordnen(kopf, zeitIdx) {
    const map = {};
    kopf.forEach((k, i) => { if (i === zeitIdx) return;
      for (const [f, F] of Object.entries(FELDER)) if (!Object.values(map).some(m => m.feld === f) && F.re.test(k)) {
        if (f === 'waterTempC' && !/wasser|water/i.test(k) && Object.values(map).some(m => m.feld === 'waterTempC')) continue;
        map[i] = { feld: f, faktor: /m\/s/i.test(k) ? 3.6 : /mph/i.test(k) ? 1.609344 : /\bmm\b/i.test(k) ? 0.1 : /\bm\b(?!\/)/i.test(k) && f === 'waterHeightCm' ? 100 : 1, f2c: /°f\b|\(f\)|\bf\b|fahrenheit/i.test(k) && f === 'waterTempC' }; break; } });
    return map;
  }

  /* Stufen aus dem Protokoll: neue Stufe, wenn sich ein Wert um mehr als seine Schwelle ändert und mindestens haltSec hält.
     Tempo 0 über haltSec = „Belastung Ende“. startMs = Beginn der Aufnahme; versatzSec verschiebt die Datei gegen die Aufnahme. */
  function stufen(p, map, o) {
    const { startMs, dauerSec, geraet, haltSec = 30, versatzSec = 0, basis = () => ({}) } = o;
    const tag = new Date(startMs); tag.setHours(0, 0, 0, 0);
    let t0 = null; const reihe = [];
    for (const r of p.daten) {
      let ms = zeitMs(r[p.zeitIdx], p.zeitArt, tag.getTime(), p.mdy); if (!isFinite(ms)) continue;
      if (p.zeitArt === 'sekunden') { if (t0 == null) t0 = ms; ms = startMs + (ms - t0); }
      const w = {}; for (const [i, m] of Object.entries(map)) { const roh = r[i]; let v = m.feld === 'reverse' ? wahr(roh) : zahl(roh, p.dez);
        if (isNaN(v)) continue; if (m.f2c) v = (v - 32) * 5 / 9; else v *= m.faktor || 1; w[m.feld] = Math.round(v * 10) / 10; }
      reihe.push({ sec: (ms - startMs) / 1000 + versatzSec, w });
    }
    reihe.sort((a, b) => a.sec - b.sec);
    /* Fehlender Wert (leeres Feld) heißt „nicht gemeldet“, nicht „geändert“: letzten bekannten Wert für die Stufenerkennung fortführen */
    for (let k = 1; k < reihe.length; k++) for (const f of Object.keys(reihe[k - 1].w)) if (reihe[k].w[f] == null) reihe[k].w[f] = reihe[k - 1].w[f];
    const innen = reihe.filter(x => x.sec >= -5 && x.sec <= dauerSec + 5);
    const gleich = (a, b) => Object.keys(FELDER).every(f => (a[f] == null && b[f] == null) || (a[f] != null && b[f] != null && Math.abs(a[f] - b[f]) < FELDER[f].schwelle));
    const log = []; let akt = null, kand = null;
    for (const x of innen) {
      if (!akt) { akt = x; log.push(x); continue; }
      if (gleich(x.w, akt.w)) { kand = null; delete akt.ende; continue; }   /* kurzer Ausreißer: Stufe läuft weiter */
      if (akt.ende == null) akt.ende = x.sec;   /* erste Abweichung = Ende der Stufe (23.11.2026), Übergang zählt nicht mit */
      if (!kand || !gleich(x.w, kand.w)) kand = x;
      if (x.sec - kand.sec >= haltSec || x === innen[innen.length - 1]) { akt = kand; log.push(kand); kand = null; }
    }
    while (log.length && log[0].w.speedKmh != null && log[0].w.speedKmh < 0.3 && geraet !== 'vibration') log.shift();   // Stillstand vor der ersten Stufe = Ruhe-Referenz, keine Stufe
    return { reihe: innen.length, ausserhalb: reihe.length - innen.length,
      log: log.map(x => { const ruht = x.w.speedKmh != null && x.w.speedKmh < 0.3 && geraet !== 'vibration';
        return ruht ? { startSec: Math.max(0, Math.round(x.sec)), device: 'keines', quelle: 'steuerung' }
          : Object.assign({}, basis(x.sec), x.w, { startSec: Math.max(0, Math.round(x.sec)), device: geraet, quelle: 'steuerung' }, x.ende != null && x.ende > x.sec ? { endSec: Math.round(x.ende) } : {}); }) };
  }

  /* Zeitpunkt der ersten Zeile (für die Prüfseite ohne Aufnahme) */
  function ersteZeit(p) { const tag = new Date(); tag.setHours(0, 0, 0, 0); for (const r of p.daten) { const ms = zeitMs(r[p.zeitIdx], p.zeitArt, tag.getTime(), p.mdy); if (isFinite(ms)) return p.zeitArt === 'sekunden' ? Date.now() : ms; } return null; }
  g.Steuerung = { FELDER, lesen, zuordnen, stufen, zahl, zeitArt, dekodieren, ersteZeit };
})(typeof window !== 'undefined' ? window : globalThis);

/* ── Oberfläche im Cockpit: „Steuerungsprotokoll übernehmen“ je Reha-Sitzung ─────────────────────────────────
   Erstes Mal je Gerät: Zuordnung prüfen (Vorschlag aus den Spaltennamen), Versatz, Vorschau → als Profil merken.
   Danach erkennt Visite dieselbe Dateiform und übernimmt mit einem Tipp. Die Handeingabe bleibt erhalten (logHand). */
(function () {
  if (typeof window === 'undefined') return;
  const S = window.Steuerung, en = () => typeof Sprache !== 'undefined' && Sprache.cur === 'en';
  const NAMEN = { speedKmh: ['Tempo (km/h)', 'Speed (km/h)'], inclinePercent: ['Steigung (%)', 'Incline (%)'], waterHeightCm: ['Wasserhöhe (cm)', 'Water height (cm)'],
    waterTempC: ['Wassertemperatur (°C)', 'Water temperature (°C)'], vibrationHz: ['Frequenz (Hz)', 'Frequency (Hz)'], reverse: ['Rückwärts', 'Reverse'], radiusM: ['Radius (m)', 'Radius (m)'] };
  const n = f => NAMEN[f][en() ? 1 : 0];
  const ui = {
    rec: null, p: null, map: null, datei: '',
    async start(hid, rid) {
      const rec = State.recordings.find(r => r.id === rid); if (!rec || !rec.reha) return; this.rec = rec;
      const i = document.createElement('input'); i.type = 'file'; i.accept = '.csv,.txt,.tsv,.log,text/csv,text/plain';
      i.onchange = async () => { const f = i.files && i.files[0]; if (!f) return; this.datei = f.name; this.p = S.lesen(S.dekodieren(await f.arrayBuffer()));
        if (this.p.fehler || this.p.zeitIdx < 0) { Toast.show(en() ? 'No time column found in this file' : 'In dieser Datei ist keine Zeitspalte erkennbar', 'warn'); return; }
        const art = this.art(), prof = ((State.settings.steuerProfile || {})[art]) || null;
        this.map = prof && prof.kopf === this.p.kopf.join('|') ? prof.map : S.zuordnen(this.p.kopf, this.p.zeitIdx);
        this.versatz = prof && prof.kopf === this.p.kopf.join('|') ? (prof.versatz || 0) : 0; this.bekannt = !!(prof && prof.kopf === this.p.kopf.join('|'));
        this.zeigen(); };
      i.click();
    },
    art() { const l = (this.rec.reha.logHand || this.rec.reha.log).find(m => m.device && m.device !== 'keines'); return l ? l.device : 'laufband'; },
    basis(sec) { const L = (this.rec.reha.logHand || this.rec.reha.log).filter(m => m.device && m.device !== 'keines' && m.startSec <= sec + 1);
      const b = L.length ? L[L.length - 1] : (this.rec.reha.logHand || this.rec.reha.log).find(m => m.device && m.device !== 'keines') || {};
      const o = Object.assign({}, b); delete o.startSec; delete o.wandSec; delete o.quelle; return o; },
    rechnen() { return S.stufen(this.p, this.map, { startMs: Date.parse(this.rec.startedAt), dauerSec: this.rec.durationSec || 3600, geraet: this.art(), versatzSec: +this.versatz || 0, basis: s => this.basis(s) }); },
    zeigen() {
      const E = en(), r = this.rechnen(), mmss = x => Math.floor(x / 60) + ':' + String(Math.round(x % 60)).padStart(2, '0');
      const opt = i => `<select data-sp="${i}" style="padding:6px 8px"><option value="">${E ? '– ignore –' : '– nicht übernehmen –'}</option>${Object.keys(NAMEN).map(f => `<option value="${f}"${(this.map[i] || {}).feld === f ? ' selected' : ''}>${esc(n(f))}</option>`).join('')}</select>`;
      const spalten = this.p.kopf.map((k, i) => i === this.p.zeitIdx ? `<tr><td><b>${esc(k)}</b></td><td>${E ? 'time' : 'Zeit'} (${esc(this.p.zeitArt)})</td><td>${esc(this.p.daten[0][i] || '')}</td></tr>`
        : `<tr><td><b>${esc(k)}</b></td><td>${opt(i)}</td><td>${esc(this.p.daten[0][i] || '')}</td></tr>`).join('');
      const vor = r.log.map(m => `<tr><td>${mmss(m.startSec)}</td><td>${m.device === 'keines' ? (E ? 'Load ends' : 'Belastung Ende') : esc(RehaKern.label(m, !E))}</td></tr>`).join('');
      UI.modal(`<div class="modal-head"><button class="closex" onclick="UI.closeModal()">${IC.x}</button><h3>${E ? 'Take over the controller log' : 'Steuerungsprotokoll übernehmen'}</h3></div>
        <div class="modal-body"><p style="margin:0 0 10px;color:var(--text-secondary)">${esc(this.datei)} · ${this.p.daten.length} ${E ? 'rows' : 'Zeilen'}${this.bekannt ? (E ? ' · saved profile for this equipment' : ' · gespeichertes Profil für dieses Gerät') : (E ? ' · set up once, then automatic' : ' · einmal einrichten, danach automatisch')}</p>
        <table class="tbl" style="width:100%;font-size:13px"><tr><th>${E ? 'Column' : 'Spalte'}</th><th>${E ? 'Meaning' : 'Bedeutung'}</th><th>${E ? 'First value' : 'Erster Wert'}</th></tr>${spalten}</table>
        <label style="display:block;margin:12px 0">${E ? 'Offset file to recording (seconds, + = file later)' : 'Versatz Datei zur Aufnahme (Sekunden, + = Datei später)'} <input data-vs type="number" step="1" value="${+this.versatz || 0}" style="width:90px;padding:6px 8px"></label>
        <p style="margin:6px 0"><b>${r.log.length} ${E ? 'stages from the controller' : 'Stufen aus der Steuerung'}</b>${r.ausserhalb ? ` · ${r.ausserhalb} ${E ? 'rows outside the recording' : 'Zeilen außerhalb der Aufnahme'}` : ''}</p>
        <table class="tbl" style="width:100%;font-size:13px">${vor || `<tr><td>${E ? 'No stages: check time column and offset.' : 'Keine Stufen: Zeitspalte und Versatz prüfen.'}</td></tr>`}</table></div>
        <div class="modal-foot"><button class="btn ghost" onclick="UI.closeModal()">${E ? 'Cancel' : 'Abbrechen'}</button><button class="btn primary" ${r.log.length ? '' : 'disabled'} onclick="SteuerUI.uebernehmen()">${E ? 'Take over and remember for this equipment' : 'Übernehmen und für dieses Gerät merken'}</button></div>`, { wide: true });
      const m = document.getElementById('modalBg'); if (!m) return;
      m.addEventListener('change', e => { const s = e.target.closest('[data-sp]'); if (s) { const i = s.dataset.sp; if (s.value) this.map[i] = Object.assign(S.zuordnen([this.p.kopf[i]], -1)[0] || { faktor: 1 }, { feld: s.value }); else delete this.map[i]; this.zeigen(); }
        if (e.target.matches('[data-vs]')) { this.versatz = +e.target.value || 0; this.zeigen(); } });
    },
    async uebernehmen() {
      const r = this.rechnen(), rec = this.rec, art = this.art(); if (!r.log.length) return;
      if (!rec.reha.logHand) rec.reha.logHand = rec.reha.log;
      rec.reha.log = r.log; rec.reha.steuerung = { datei: this.datei, zeilen: this.p.daten.length, versatzSec: +this.versatz || 0, am: new Date().toISOString() };
    try { if (typeof Neuauswertung !== 'undefined') { rec.neuauswertung = Neuauswertung._rechnen(rec, Neuauswertung.version()); Neuauswertung._uebernehmen(rec); } } catch (_) {}
      await DB.put('recordings', rec);
      State.settings.steuerProfile = Object.assign({}, State.settings.steuerProfile, { [art]: { kopf: this.p.kopf.join('|'), map: this.map, versatz: +this.versatz || 0 } }); State.saveSettings();
      UI.closeModal(); Toast.show(en() ? `${r.log.length} stages taken from the controller log` : `${r.log.length} Stufen aus dem Steuerungsprotokoll übernommen`, 'ok'); try { Nav.refresh(); } catch (_) {}
    },
    async zurueck(rid) { const rec = State.recordings.find(r => r.id === rid); if (!rec || !rec.reha || !rec.reha.logHand) return;
      rec.reha.log = rec.reha.logHand; delete rec.reha.logHand; delete rec.reha.steuerung;
    try { if (typeof Neuauswertung !== 'undefined') { rec.neuauswertung = Neuauswertung._rechnen(rec, Neuauswertung.version()); Neuauswertung._uebernehmen(rec); } } catch (_) {}
      await DB.put('recordings', rec);
      Toast.show(en() ? 'Manual stages restored' : 'Handeingabe wiederhergestellt', 'ok'); try { Nav.refresh(); } catch (_) {} }
  };
  window.SteuerUI = ui;
})();
