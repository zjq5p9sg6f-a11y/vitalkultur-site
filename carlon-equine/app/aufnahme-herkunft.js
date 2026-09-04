/* ═══════════════════════════════════════════════════════════════════════
   AUFNAHME-HERKUNFT — eine Stelle, die ALLE Formatgenerationen kennt
   ───────────────────────────────────────────────────────────────────────
   Eine Klinik liest Aufnahmen, die Jahre alt sind. Zwischen der ersten und
   der heutigen Fassung liegen bereits VIER Formatgenerationen aus vier
   Monaten — gemessen am Bestand, nicht vermutet:

     23.05.2026  schema{generated,name}     device, metrics, rrData, session
     24.05.–31.07. schema{generated,jsonSchemaStatus}
                                            + integrity, provenance
     ab 12.08.2026 schema{name:'carlon_equine_v1',version:'1.0'}
                                            metrics, rrData, session, SOURCE
                                            — `device` gibt es nicht mehr
     Pruef-Fixtures schema{…audit_fixture_v1} rrIntervalsMs statt rrData

   DER BEFUND, DER DAZU GEFUEHRT HAT (04.09.2026): Das Cockpit las
   `(raw.device||{}).model` — nur die alte Form. Fuer JEDE Aufnahme der
   aktuellen Messstation stand damit `device: null`. Der Sensorname
   („Movesense 262930002906") ging still verloren, und daran haengt die
   Herkunftszeile im Bericht. Kein Fehler, keine Meldung: das Feld war
   einfach leer.

   DIE REGEL: Hier wird nur HINZUGEFUEGT, nie entfernt. Ein Rueckfallweg,
   den man streicht, macht genau die Aufnahmen unlesbar, die am laengsten
   im Haus liegen — und niemand merkt es, weil neue Aufnahmen ja gehen.
   `belege/kompatibilitaet.mjs` haelt das gegen den gesamten Messbestand.
   ═══════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  /* Das MESSGERAET, nicht die App. `source.app` ist absichtlich KEIN
     Rueckfallweg: „CARLON Mess-Station (Browser)" als Geraet auszuweisen
     waere eine erfundene Angabe — lieber leer als falsch. */
  function geraet(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const d = raw.device || {}, s = raw.source || {};
    return d.model            // iOS-App-Export und Messstation bis 31.07.
        || s.sensor           // Messstation ab 12.08.
        || d.name             // sehr fruehe Fassungen
        || null;
  }

  /* Womit aufgezeichnet wurde — App, Uebertragungsweg. Getrennt vom Geraet,
     weil beide verschiedene Fragen beantworten. */
  function quelle(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const d = raw.device || {}, s = raw.source || {};
    return s.app || d.protocolName || d.source || null;
  }

  /* Die RR-Reihe. Drei Schreibweisen im Bestand. */
  function rrReihe(raw) {
    if (!raw || typeof raw !== 'object') return [];
    const roh = raw.rrData || raw.rrIntervalsMs || [];
    if (!Array.isArray(roh)) return [];
    if (roh.length && typeof roh[0] === 'object')
      return roh.map(x => x && x.rrMs).filter(x => typeof x === 'number' && x > 0);
    return roh.filter(x => typeof x === 'number' && x > 0);
  }

  /* ── DER NAME WAR SCHON VERGEBEN (04.09.2026) ──
     Erst hiess dieses Objekt `Herkunft`. Im Cockpit gibt es aber bereits ein
     `const Herkunft` (Behandler-Kennzeichnung, index.html:2005) — und dessen
     `geraet()` nimmt KEINE Argumente und liefert den Namen des BEHANDLER-
     Geraets, notfalls einen erfundenen („Geraet 347").

     `const` bindet lexikalisch und beschattet `window.Herkunft` vollstaendig:
     Der Aufruf `Herkunft.geraet(raw)` im Normalisierer landete also still beim
     falschen Objekt, warf NICHT, und haette den Geraetenamen des importierenden
     Rechners als Sensor der Aufnahme eingetragen. Schlimmer als das leere Feld,
     das behoben werden sollte — und genau die erfundene Angabe, vor der die
     Regel oben warnt.

     Aufgefallen ist es nur, weil `quelle` dort nicht existiert und deshalb
     geworfen hat. Eine Kollision, die sich auf `geraet` beschraenkt haette,
     waere nie aufgefallen. Darum: eindeutiger Name. */
  const API = { geraet, quelle, rrReihe };
  global.AufnahmeHerkunft = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
