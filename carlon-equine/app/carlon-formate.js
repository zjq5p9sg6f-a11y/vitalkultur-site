/* ═══════════════════════════════════════════════════════════════════════════
   carlon-formate.js — jede Datei der CARLON-Equine-App öffnet in Visite (05.11.2026)
   ───────────────────────────────────────────────────────────────────────────
   ANLASS: Prüfstand Chrome, 05.11.2026. Die App (iPhone/iPad) schrieb über ihre
   eigenen Knöpfe 8 Exportarten einer echten Aufnahme; Visite öffnete davon 2.
   Roh-JSON, beide CSV, der Forschungs-Zip und die .carlon-Übergabe kamen nicht an —
   die CSV wurde sogar für ein Adressbuch gehalten und das Fenster schloss sich still.

   WAS DIESE DATEI TUT: Sie übersetzt jedes App-Format in die Form, die der
   Importer schon kennt ({subject, session, rrIntervalsMs, metrics}), und rechnet
   fehlende Kennzahlen mit DEMSELBEN Weg wie die Messstation (HRVVorstufe.analysiere,
   in der Testkette gegen EquineFilterPipeline.swift bis zur letzten Stelle geprüft).
   Sie rechnet NIE aus der ungefilterten Reihe — dieser Rückfall lag beim Pferd
   130–177 % über dem korrigierten Wert (AV-Block, Bewegung).

   Formate (Erzeuger in Klammern, alle in CarlonEquine/):
     .carlon            Übergabe: Pferd + Protokoll + Aufnahmen (EquineUebergabePaket,
                        JSON, Raw-Deflate — NSData .zlib)
     *_raw.json         Roh-RR (EquineExportEngine, schema carlon_equine_raw_v1)
     *.csv  (RR-Reihe)  Forschungs-CSV und Roh-CSV (EquineWorldClassExporter /
                        EquineExportEngine) — erkannt an der Kopfzeile
     *_research.zip     Forschungspaket (EquineGoldStandardExporter): *_rr_kubios.csv
   Der App-JSON-Export mit Kennzahlen und FHIR laufen wie bisher direkt im Importer.
   Reines JavaScript, Browser und Node (Testkette: LogicTests/visite_formate.js).
   ═══════════════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';
  const V = root.HRVVorstufe || (typeof require === 'function' ? require('./hrv-vorstufe.js') : null);

  const text = (u8) => new TextDecoder('utf-8').decode(u8);
  const num = (x) => { const v = typeof x === 'string' ? parseFloat(x.replace(',', '.')) : x; return Number.isFinite(v) ? v : null; };

  async function inflateRaw(u8) {
    const s = new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(s).arrayBuffer());
  }

  /* ── ZIP über das Zentralverzeichnis (gespeichert ODER deflate) ─────────── */
  async function zipEintraege(u8) {
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    let eocd = -1;
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) return null;
    const n = dv.getUint16(eocd + 10, true); let p = dv.getUint32(eocd + 16, true);
    const out = {};
    for (let k = 0; k < n; k++) {
      if (dv.getUint32(p, true) !== 0x02014b50) return null;
      const methode = dv.getUint16(p + 10, true), groesse = dv.getUint32(p + 20, true);
      const nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true);
      const lokal = dv.getUint32(p + 42, true);
      const name = text(u8.subarray(p + 46, p + 46 + nl));
      const start = lokal + 30 + dv.getUint16(lokal + 26, true) + dv.getUint16(lokal + 28, true);
      const roh = u8.subarray(start, start + groesse);
      out[name] = methode === 0 ? roh : methode === 8 ? await inflateRaw(roh) : null;
      p += 46 + nl + xl + cl;
    }
    return out;
  }

  /* ── Kopf „# schluessel: wert" + eine RR-Spalte ────────────────────────── */
  function carlonCSV(t) {
    const zeilen = t.split(/\r?\n/);
    const erste = (zeilen[0] || '').trim();
    const kennung = /^#\s*carlon_equine_(world_class|research_rr)/i.test(erste) ? 'forschung'
      : /^#\s*CARLON Equine\b.*Raw RR/i.test(erste) ? 'roh' : null;
    const kopf = {}; let kopfzeile = null, i = 0;
    for (; i < zeilen.length; i++) {
      const z = zeilen[i];
      if (z.startsWith('#')) { const m = /^#\s*([A-Za-z_]+):\s*(.*)$/.exec(z); if (m) kopf[m[1]] = m[2].trim(); continue; }
      if (z.trim()) { kopfzeile = z.split(',').map(s => s.trim().toLowerCase()); i++; break; }
    }
    if (!kopfzeile) return null;
    const spalte = ['rr_interval_ms', 'rr_ms', 'rr'].map(s => kopfzeile.indexOf(s)).find(x => x >= 0);
    if (spalte == null || (!kennung && kopfzeile.length > 3)) return null;   // keine RR-Spalte ⇒ kein CARLON-CSV
    const rr = [];
    for (; i < zeilen.length; i++) { const v = num((zeilen[i].split(',')[spalte] || '').trim()); if (v != null && v > 0) rr.push(v); }
    return rr.length ? { kennung, kopf, rr } : null;
  }

  /* ── Eine Aufnahme in der Form des Importers, Kennzahlen über die Messstation ── */
  function aufnahme(rr, m) {
    const v = V && rr.length >= 30 ? V.analysiere(rr) : null;
    const raw = {
      subject: { id: m.pferdId || null, nameAtTime: m.name || null, species: m.art || 'horse', breed: m.rasse || null },
      session: { id: m.id || null, startedAt: m.start || null, endedAt: m.ende || null,
                 durationSec: num(m.dauer) ?? rr.reduce((a, b) => a + b, 0) / 1000, beatCount: rr.length, intent: m.intent || null },
      rrIntervalsMs: rr,
      source: { app: m.quelle, file: m.datei },
      importHinweis: v ? null : (V && V.abbruchGrund ? V.abbruchGrund(rr) : 'zu kurz'),
    };
    if (v) {
      raw.metrics = {
        timeDomain: { rmssdMs: v.rmssdMs, sdnnMs: v.sdnnMs, meanHRBpm: v.meanHrBpm, pNN50Pct: v.pnn50Pct,
                      nnCleaningMethod: 'equine_filter_pipeline_hrv_vorstufe' },
        nonLinear: { dfaAlpha1: v.dfaAlpha1, sd1Ms: v.sd1Ms, sd2Ms: v.sd2Ms },
        frequencyDomain: { lfHfRatio: v.lfHfRatio },
        equineSpecific: { avBlockCount: v.avBlockCount },
      };
      raw.quality = { artifactRatePct: v.artefaktRatePct };
    }
    return raw;
  }

  const PDF_GRUND = 'PDF-Bericht zum Lesen — die Messdaten stecken in der .carlon- oder .json-Datei derselben Aufnahme';

  /**
   * Erkennt eine App-Datei und liefert die Aufnahmen in Importer-Form.
   * @returns {Promise<{erkannt:boolean, format?:string, raws?:object[], kontext?:object, grund?:string}>}
   */
  async function lesen(name, daten) {
    const u8 = daten instanceof Uint8Array ? daten : new Uint8Array(daten);
    const n = String(name || '').toLowerCase();
    try {
      if (n.endsWith('.pdf')) return { erkannt: false, grund: PDF_GRUND };
      if (n.endsWith('.carlon')) {
        let j; try { j = JSON.parse(text(await inflateRaw(u8))); } catch (e) { j = JSON.parse(text(u8)); }
        if (!j || j.format !== 'carlon-equine-uebergabe') return { erkannt: false, grund: 'Keine CARLON-Übergabe' };
        const p = j.pferd || {};
        const raws = (j.sitzungen || []).filter(s => Array.isArray(s.rrIntervalsMs) && s.rrIntervalsMs.length)
          .map(s => aufnahme(s.rrIntervalsMs, { pferdId: p.id || s.subjectId, name: p.name || s.subjectNameAtTime,
            art: p.species, rasse: p.breed, id: s.id, start: s.startedAt, ende: s.endedAt, intent: s.intent,
            quelle: 'CARLON Equine · Übergabe', datei: name }));
        return { erkannt: raws.length > 0, format: 'carlon', raws,
                 kontext: { einrichtung: (j.einrichtung || {}).name || null, protokoll: (j.protokoll || {}).title || null,
                            ereignisse: j.ereignisse || {} },
                 grund: raws.length ? null : 'Übergabe ohne Herzschläge' };
      }
      if (n.endsWith('.zip')) {
        const e = await zipEintraege(u8);
        if (!e) return { erkannt: false, grund: 'Zip-Datei nicht lesbar' };
        const rrName = Object.keys(e).find(k => /_rr_kubios\.csv$/i.test(k));
        if (!rrName || !e[rrName]) return { erkannt: false, grund: 'Kein CARLON-Forschungspaket (keine RR-Datei darin)' };
        const rr = text(e[rrName]).split(/\r?\n/).map(z => num(z.trim())).filter(v => v != null && v > 0);
        let meta = {}; const mName = Object.keys(e).find(k => /_metadata\.json$/i.test(k));
        try { meta = mName ? JSON.parse(text(e[mName])) : {}; } catch (x) {}
        const id = String(meta.persistentId || '').replace(/^urn:carlon:session:/, '') || null;
        return { erkannt: true, format: 'forschungspaket',
                 raws: [aufnahme(rr, { id, name: 'Forschungspaket (anonymisiert)', quelle: 'CARLON Equine · Forschungspaket', datei: name })] };
      }
      if (n.endsWith('.csv')) {
        const c = carlonCSV(text(u8));
        if (!c) return { erkannt: false };   // kein CARLON-CSV ⇒ der Importer prüft auf Kontakte
        const k = c.kopf;
        return { erkannt: true, format: c.kennung === 'roh' ? 'roh-csv' : 'forschung-csv',
                 raws: [aufnahme(c.rr, { id: k.session_id, name: k.subject_name || k.subject_label, art: k.subject_species || k.species,
                   rasse: k.subject_breed, start: k.session_started_at || k.started_at, dauer: k.session_duration_sec || k.duration_sec,
                   quelle: 'CARLON Equine · CSV', datei: name })] };
      }
      if (n.endsWith('.json')) {
        const j = JSON.parse(text(u8));
        if (j && j.schema === 'carlon_equine_raw_v1' && Array.isArray(j.rr_intervals_ms)) {
          return { erkannt: true, format: 'roh-json',
                   raws: [aufnahme(j.rr_intervals_ms, { pferdId: j.subject_id, name: j.subject_label, art: j.species, rasse: j.breed,
                     id: j.session_id, start: j.started_at, dauer: j.duration_sec, quelle: 'CARLON Equine · Roh-RR', datei: name })] };
        }
      }
    } catch (e) { return { erkannt: false, grund: 'Datei nicht lesbar' }; }
    return { erkannt: false };
  }

  const api = { lesen, carlonCSV, zipEintraege, VERSION: '2026-11-05' };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CarlonFormate = api;
})(typeof window !== 'undefined' ? window : globalThis);
