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

  const API = { geraet, quelle, rrReihe };
  global.Herkunft = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
