/*!
 * asthma.js — Equine Asthma Screener (Engine v2.4) + Trend Model (Engine v2.5)
 *
 * 1:1-Portierung von EquineAsthmaScreener.swift und EquineAsthmaTrendModel.swift.
 * Reines ES2020, keine Abhaengigkeiten, kein Build. Einbindung per <script src="asthma.js">
 * oder per require() unter Node.
 *
 * WICHTIG — diese Datei ist eine PORTIERUNG, keine Weiterentwicklung:
 * Alle Schwellen, Gewichte, Vergleichsrichtungen und Ausgabetexte sind bewusst
 * identisch zum Swift-Original. Der Screener ist gegen Nyerges-Bohak 2025 EVJ
 * (DOI 10.1111/evj.14414, n=40 mit BAL-Referenz) kalibriert und zusaetzlich
 * Monte-Carlo-verifiziert (Sensitivitaet ~90 %, AUC ~0.95, Spezifitaet ~87 %).
 * Jede eigenmaechtig geaenderte Zahl macht diese Kalibrierung wertlos.
 *
 * Positionierung: starker RULE-OUT, moderater RULE-IN. Beobachtungs-Marker —
 * die Entscheidung trifft immer die Tierarztpraxis. BAL-Zytologie bleibt Goldstandard.
 * („Screening" ist bewusst vermieden: der Begriff bezeichnet die systematische
 *  Reihenuntersuchung auf Krankheit und legt eine diagnostische Zweckbestimmung
 *  nahe. Typ- und Feldnamen bleiben, darauf matchen Import und Schema.)
 */
(function (global) {
  'use strict';

  // ===========================================================================
  // Hilfsfunktionen — bilden Swift-Semantik nach, die JavaScript nicht von
  // sich aus hat. Jede einzelne ist gegen das kompilierte Swift-Original
  // gegengeprueft (siehe asthma-vektoren.json).
  // ===========================================================================

  /** Swift `Optional` kennt nur "da" oder "nil". null und undefined sind beides nil.
   *  Achtung: 0 und NaN sind WERTE, nicht nil — genau wie in Swift. */
  function istNil(v) {
    return v === null || v === undefined;
  }

  /** Liest einen optionalen Double. Ein vorhandener, aber nicht-numerischer Wert
   *  ist ein Aufrufer-Fehler: Swift wuerde das gar nicht erst uebersetzen. Wir
   *  werfen laut, statt still eine falsche Auswertung zu erzeugen. */
  function optDouble(v, feldname) {
    if (istNil(v)) return null;
    if (typeof v !== 'number') {
      throw new TypeError('asthma.js: "' + feldname + '" muss eine Zahl oder null sein, war: ' + typeof v);
    }
    return v;
  }

  /** Entspricht Swifts `String(format: "%.1f", x)`.
   *  C-printf schreibt Sonderwerte klein ("nan", "inf") — toFixed() dagegen "NaN".
   *  Ebenso bleibt bei printf das Vorzeichen der negativen Null erhalten. */
  function f1(x) {
    if (Number.isNaN(x)) return 'nan';
    if (x === Infinity) return 'inf';
    if (x === -Infinity) return '-inf';
    if (Object.is(x, -0)) return '-0.0';
    return x.toFixed(1);
  }

  /** Entspricht Swifts String-Interpolation einer Double, also `"\(x)"`.
   *  Swift schreibt IMMER einen Dezimalpunkt: aus 4.0 wird "4.0", aus 3.5 wird "3.5".
   *  JavaScript macht aus 4.0 dagegen "4". Fuer die heutigen Stufen-Grenzen (3.5 und
   *  1.5) ist das folgenlos — wuerde aber jemand eine Grenze auf einen ganzzahligen
   *  Wert setzen, liefen App-Text und Browser-Text still auseinander. Deshalb hier
   *  sauber nachgebildet statt auf den Zufall zu bauen.
   *  (Sehr grosse/kleine Werte stellt Swift exponentiell dar; fuer Schwellen in
   *   diesem Wertebereich spielt das keine Rolle.)
   *  ACHTUNG: Der ".0"-Zweig ist mit den heutigen Grenzen (3.5 / 1.5) nicht
   *  erreichbar und deshalb durch KEINEN Testvektor abgedeckt — er ist Vorsorge
   *  fuer den Fall, dass jemand eine Grenze auf einen ganzzahligen Wert setzt. */
  function swiftDoubleString(x) {
    if (Number.isNaN(x)) return 'nan';
    if (x === Infinity) return 'inf';
    if (x === -Infinity) return '-inf';
    var s = String(x);
    if (/^-?\d+$/.test(s)) s += '.0';
    return s;
  }

  /** Entspricht Swifts `Sequence.min()`: eine Faltung mit `<` ueber die Folge.
   *  Das ist NICHT dasselbe wie Math.min — bei NaN haengt das Ergebnis von der
   *  Reihenfolge ab: [2, NaN] ergibt 2, [NaN, 2] ergibt NaN. */
  function swiftMin(werte) {
    if (werte.length === 0) return null;
    let ergebnis = werte[0];
    for (let i = 1; i < werte.length; i++) {
      if (werte[i] < ergebnis) ergebnis = werte[i];
    }
    return ergebnis;
  }

  /** Gegenstueck zu swiftMin — Faltung mit `>`. */
  function swiftMax(werte) {
    if (werte.length === 0) return null;
    let ergebnis = werte[0];
    for (let i = 1; i < werte.length; i++) {
      if (werte[i] > ergebnis) ergebnis = werte[i];
    }
    return ergebnis;
  }

  /** Entspricht Swifts `Double.rounded()`: kaufmaennisch, halbe Werte VOM
   *  Nullpunkt weg. Math.round rundet halbe Werte immer Richtung +unendlich und
   *  wuerde bei negativen Zahlen abweichen (-2.5 → Swift -3, Math.round -2). */
  function swiftRounded(x) {
    return x < 0 ? -Math.round(-x) : Math.round(x);
  }

  /** Nimmt Date, Millisekunden-Zahl oder ISO-8601-String und liefert Epochen-
   *  SEKUNDEN als Double — dieselbe Einheit, in der Swifts Date rechnet. */
  function alsEpochenSekunden(d, feldname) {
    let ms;
    if (d instanceof Date) ms = d.getTime();
    else if (typeof d === 'number') ms = d;
    else if (typeof d === 'string') ms = Date.parse(d);
    else throw new TypeError('asthma.js: "' + feldname + '" muss Date, Zahl (ms) oder ISO-String sein.');
    if (Number.isNaN(ms)) {
      throw new TypeError('asthma.js: "' + feldname + '" ist kein gueltiges Datum: ' + d);
    }
    return ms / 1000;
  }

  // ===========================================================================
  // TEIL 1 — EquineAsthmaScreener (Engine v2.4)
  // ===========================================================================

  /** Schwellen, kalibriert an Nyerges-Bohak 2025 n=40 BAL. NICHT anfassen. */
  var Thresholds = Object.freeze({
    // Primaer — Mittelpunkt zwischen sEA-Mittelwert und non-sEA-Mittelwert (EVJ-Tabelle)
    sdnnMs: 55.0,          // sEA 41+-14, non-sEA 83+-21
    sd2Ms: 65.0,           // sEA 42+-17, non-sEA 100+-25 (Gini 0.63, Rang 1)
    sd2OverSd1: 1.50,      // sEA 1.1+-0.3, non-sEA 1.7+-0.2
    tinnMs: 300.0,         // sEA 209+-72, non-sEA 398+-105
    totalPowerMs2: 2500.0, // sEA 1503+-1179, non-sEA 4740+-1978 (Marker gedroppt, s.u.)
    dfaAlpha1: 0.70,       // <0.7 = Verlust der fraktalen Skalierung
    sampleEntropy: 0.80,   // <0.8 = pathologische Regelmaessigkeit

    // Sekundaer — Akut-Phase (in n=40 nicht signifikant, p=0.13)
    hrBpm: 45.0,           // >45 = Hypoxie-Kompensation
    lfHfRatio: 0.40,       // <0.4 = HF-Dominanz

    // Stufen-Grenzen (ROC-optimiert an n=40)
    highScoreCut: 3.5,     // Sens ~90 %, Spez ~87 %
    moderateScoreCut: 1.5,
  });

  /** Gini-Gewichte aus der Importance-Rangfolge von Nyerges-Bohak 2025. */
  var Weights = Object.freeze({
    sd2: 2.0,        // Gini 0.63, Rang 1
    sdnn: 1.8,       // Gini 0.56, Rang 2
    sd2sd1: 1.6,     // Gini 0.49, Rang 4
    tinn: 1.6,       // Gini 0.50, Rang 3
    totalPower: 1.4, // Gini 0.48, Rang 5 — Marker inaktiv, Gewicht nur dokumentarisch
    dfa: 1.5,        // CARLON-eigen
    sampEn: 1.0,     // CARLON-eigen (abgewertet)
    secondary: 0.5,  // HR, LF/HF
  });

  /* WORTLAUT NACHGEZOGEN AUS EquineAsthmaScreener.swift:150-154 (14.08.2026).
     „Screener" als Selbstbeschreibung ist in der App in allen neun Sprachen
     weg — das Wort bezeichnet in der regulierten Medizin die systematische
     Reihenuntersuchung auf Krankheit. Diese Datei ist eine 1:1-Portierung;
     der alte Satz war also nicht nur belastet, sondern auch abgedriftet. */
  var DISCLAIMER =
    'Nyerges-Bohák 2025 EVJ DOI 10.1111/evj.14414 (n=40 BAL-bestätigt) beschreibt die ' +
    'PRIMÄREN Marker. LF/HF + HR sind sekundäre Akut-Phase-Indikatoren (p=0.13 in der ' +
    'Studie). Beobachtungs-Marker, kein Diagnostikum — die Abklärung bleibt tierärztlich, ' +
    'BAL-Zytologie ist der Goldstandard. Herkunft und Grenzen: Methoden-Dokumentation.';

  var METHODOLOGY = Object.freeze([
    'nyerges_bohak_2025_evj_57_611_doi_10_1111_evj_14414_n40_bal',
    'carlon_engine_v2_4_gini_weighted',
    'primary_sdnn_sd2_sd2sd1_tinn_totalpower_dfa_sampen',
    'secondary_hr_lfhf_acute_phase_only',
    'novel_pnn50_rmssd_paradox_carlon_ip_patent_candidate',
    'score_cut_3_5_roc_optimal_n40',
    'independent_montecarlo_2026_100M_sens_90_auc_0_95_confirmed',
    'specificity_realistic_87pct_range_80_92_assumption_dependent',
    'positioning_strong_ruleout_prevalence_dependent_rulein_not_diagnostic',
  ]);

  function marker(name, value, threshold, positive, tier, evidence) {
    return { name: name, value: value, threshold: threshold,
             positive: positive, tier: tier, evidence: evidence };
  }

  function unzureichend(interpretation, recommendation, methodology) {
    return {
      suspicion: 'insufficient',
      weightedScore: 0.0,
      primaryPositiveCount: 0,
      secondaryPositiveCount: 0,
      novelPositive: false,
      markers: [],
      dominantPattern: null,
      interpretation: interpretation,
      recommendation: recommendation,
      methodology: methodology,
      disclaimer: DISCLAIMER,
    };
  }

  /**
   * Bewertet eine HRV-Aufnahme auf Hinweise fuer equines Asthma (sEA).
   *
   * Swift kennt benannte Argumente, JavaScript nicht — deshalb ein Objekt.
   * Jedes fehlende Feld gilt als nil (Swift-Optional).
   *
   * @param {Object} eingabe
   * @param {?number} eingabe.meanHrBpm      mittlere Herzfrequenz [bpm]   (Pflicht)
   * @param {?number} eingabe.sdnnMs         SDNN [ms]
   * @param {?number} eingabe.rmssdMs        RMSSD [ms]                    (Pflicht, nur Anwesenheit)
   * @param {?number} eingabe.pnn50Pct       pNN50 [%]                     (derzeit ungenutzt)
   * @param {?number} eingabe.sd1Ms          Poincare SD1 [ms]
   * @param {?number} eingabe.sd2Ms          Poincare SD2 [ms]
   * @param {?number} eingabe.lfHfRatio      LF/HF-Verhaeltnis
   * @param {?number} eingabe.dfaAlpha1      DFA alpha1                    (Pflicht)
   * @param {?number} eingabe.tinnMs         TINN [ms]
   * @param {?number} eingabe.totalPowerMs2  Gesamtleistung [ms^2]         (bewusst wirkungslos)
   * @param {?number} eingabe.sampleEntropy  Sample Entropy
   * @param {?number} eingabe.beatCount      Anzahl Schlaege               (Eingangsschranke)
   * @param {?number} eingabe.durationSec    Aufnahmedauer [s]             (Eingangsschranke)
   * @returns {Object} Ergebnis mit suspicion, weightedScore, markers, ...
   */
  function evaluate(eingabe) {
    var e = eingabe || {};

    var meanHrBpm = optDouble(e.meanHrBpm, 'meanHrBpm');
    var sdnnMs = optDouble(e.sdnnMs, 'sdnnMs');
    var rmssdMs = optDouble(e.rmssdMs, 'rmssdMs');
    var sd1Ms = optDouble(e.sd1Ms, 'sd1Ms');
    var sd2Ms = optDouble(e.sd2Ms, 'sd2Ms');
    var lfHfRatio = optDouble(e.lfHfRatio, 'lfHfRatio');
    var dfaAlpha1 = optDouble(e.dfaAlpha1, 'dfaAlpha1');
    var tinnMs = optDouble(e.tinnMs, 'tinnMs');
    var sampleEntropy = optDouble(e.sampleEntropy, 'sampleEntropy');
    var beatCount = optDouble(e.beatCount, 'beatCount');
    var durationSec = optDouble(e.durationSec, 'durationSec');
    // pnn50Pct und totalPowerMs2 werden bewusst nur entgegengenommen (API-Kompatibilitaet).
    optDouble(e.pnn50Pct, 'pnn50Pct');
    optDouble(e.totalPowerMs2, 'totalPowerMs2');

    // ── EINGANGSSCHRANKE — der wichtigste Riegel der ganzen Engine ───────────
    // Fruehere Fassungen verlangten nur "HR, RMSSD und DFA liegen vor". DFA gibt
    // es ab rund 100 Schlaegen, also ab etwa 3 Minuten — der Screener lief damit
    // auf einem Drittel der Datenmenge, die seine eigene Karte ankuendigt
    // (>=7 min Ruhe, >=200 Schlaege). Das ist nicht bloss unsauber: die Cutoffs
    // fuer SDNN, SD2 und TINN stammen aus deutlich laengeren Ruheaufnahmen. Auf
    // 3 Minuten fallen SDNN und SD2 systematisch kleiner aus — und beide Marker
    // zaehlen genau dann als positiv, wenn sie KLEIN sind. Eine zu kurze Messung
    // ist also nicht bloss ungenau, sondern GERICHTET falsch Richtung auffaellig.
    // Deshalb: verwerfen statt schaetzen. nil gilt als "zu wenig".
    if (istNil(beatCount) || !(beatCount >= 200) || istNil(durationSec) || !(durationSec >= 420)) {
      return unzureichend(
        'Datengrundlage zu klein — die Schwellen stammen aus laengeren Ruheaufnahmen und wuerden auf kurzen Messungen zu haeufig anschlagen.',
        'Aufnahme ≥7 min in ruhiger Box wiederholen (≥200 Schlaege).',
        ['insufficient_duration_or_beatcount_gate_420s_200beats']
      );
    }

    // Zweiter Riegel: die drei Kern-Metriken muessen ueberhaupt vorliegen.
    if (istNil(meanHrBpm) || istNil(rmssdMs) || istNil(dfaAlpha1)) {
      return unzureichend(
        'Kern-Metriken fehlen — die Marker-Auswertung braucht mindestens mean_HR, RMSSD und DFA-α₁ (≥200 beats stationäre Ruhe).',
        'Aufnahme ≥7 min Ruhe in der Box wiederholen.',
        ['insufficient_hrv_input']
      );
    }

    var hr = meanHrBpm;
    var dfa = dfaAlpha1;

    var markers = [];
    var score = 0.0;
    // Die Reihenfolge der Additionen ist bewusst identisch zum Swift-Original:
    // Gleitkomma-Addition ist nicht assoziativ, eine andere Reihenfolge koennte
    // einen Score exakt auf der Stufengrenze auf die andere Seite kippen.

    // PRIMAER: SDNN
    if (!istNil(sdnnMs)) {
      var sdnnPos = sdnnMs < Thresholds.sdnnMs;
      markers.push(marker('SDNN', sdnnMs, Thresholds.sdnnMs, sdnnPos, 'primary',
        'Nyerges-Bohák 2025 Gini 0.56, p<0.001'));
      if (sdnnPos) score += Weights.sdnn;
    }

    // PRIMAER: SD2 (hoechster Gini)
    if (!istNil(sd2Ms)) {
      var sd2Pos = sd2Ms < Thresholds.sd2Ms;
      markers.push(marker('SD2', sd2Ms, Thresholds.sd2Ms, sd2Pos, 'primary',
        'Nyerges-Bohák 2025 Gini 0.63 (#1), p<0.001'));
      if (sd2Pos) score += Weights.sd2;
    }

    // PRIMAER: SD2/SD1 — nur wenn SD1 spuerbar groesser als null ist.
    // Der Riegel sd1 > 1e-6 verhindert die Division durch (nahezu) Null.
    var sd2sd1Positive = false;
    if (!istNil(sd1Ms) && !istNil(sd2Ms) && sd1Ms > 1e-6) {
      var ratio = sd2Ms / sd1Ms;
      var ratioPos = ratio < Thresholds.sd2OverSd1;
      sd2sd1Positive = ratioPos;
      markers.push(marker('SD2/SD1', ratio, Thresholds.sd2OverSd1, ratioPos, 'primary',
        'Nyerges-Bohák 2025 Gini 0.49, p<0.001'));
      if (ratioPos) score += Weights.sd2sd1;
    }

    // PRIMAER: TINN
    if (!istNil(tinnMs)) {
      var tinnPos = tinnMs < Thresholds.tinnMs;
      markers.push(marker('TINN', tinnMs, Thresholds.tinnMs, tinnPos, 'primary',
        'Nyerges-Bohák 2025 Gini 0.50 (#3), p<0.001'));
      if (tinnPos) score += Weights.tinn;
    }

    // TotalPower-Marker am 2026-07-03 GEDROPPT: Nach dem Welch-PSD-Parseval-Fix
    // liegt die App-TotalPower im korrekten Equine-Band 0–0.6 Hz (~18000–23000 ms^2)
    // und passt NICHT mehr zu der auf Nyerges-Bohaks Band-Konvention kalibrierten
    // Schwelle 2500. Der Marker feuerte dadurch nie mehr. Der Parameter bleibt
    // fuer API-Kompatibilitaet erhalten, hat aber KEINE Wirkung. Reaktivierung
    // erst nach Rekalibrierung an einer BAL-bestaetigten Kohorte.

    // PRIMAER: DFA alpha1 (immer vorhanden, s. zweiter Riegel)
    var dfaPos = dfa < Thresholds.dfaAlpha1;
    markers.push(marker('DFA_alpha1', dfa, Thresholds.dfaAlpha1, dfaPos, 'primary',
      'Peng 1995 + human Asthma-Lit; equine ROC pending (Phase-1b)'));
    if (dfaPos) score += Weights.dfa;

    // PRIMAER: SampEn
    if (!istNil(sampleEntropy)) {
      var sampEnPos = sampleEntropy < Thresholds.sampleEntropy;
      markers.push(marker('SampEn', sampleEntropy, Thresholds.sampleEntropy, sampEnPos, 'primary',
        'Richman-Moorman 2000; COPD/Asthma reduziert (PMC12041931)'));
      if (sampEnPos) score += Weights.sampEn;
    }

    // SEKUNDAER: HR-Akut (immer vorhanden)
    var hrPos = hr > Thresholds.hrBpm;
    markers.push(marker('HR_acute', hr, Thresholds.hrBpm, hrPos, 'secondary',
      'Nyerges-Bohák 2025: p=0.13 (n.s.); Akut-Indikator'));
    if (hrPos) score += Weights.secondary;

    // SEKUNDAER: LF/HF-Akut
    if (!istNil(lfHfRatio)) {
      var lfhfPos = lfHfRatio < Thresholds.lfHfRatio;
      markers.push(marker('LF_HF_acute', lfHfRatio, Thresholds.lfHfRatio, lfhfPos, 'secondary',
        'Nyerges-Bohák 2025: p=0.13 (n.s.); Akut-Tachypnoe-Indikator'));
      if (lfhfPos) score += Weights.secondary;
    }

    // Novel-Marker (pNN50/RMSSD-Paradox) am 2026-07-05 ENTFERNT: sEA SENKT RMSSD
    // (55+-20 vs 86+-23). Ein Marker, der RMSSD>120 verlangt, zeigt in die falsche
    // Richtung, feuerte gegen die n=40-Verteilung auf rund null Pferden und ist in
    // keiner Studie beschrieben. Feld bleibt fuer API-Kompatibilitaet erhalten.
    var novelPositive = false;

    var primaryCount = markers.filter(function (m) { return m.tier === 'primary' && m.positive; }).length;
    var secondaryCount = markers.filter(function (m) { return m.tier === 'secondary' && m.positive; }).length;

    // Dominantes Muster
    var dominant = null;
    if (sd2sd1Positive && dfaPos) {
      dominant = 'poincare_loss_plus_dfa_fractal_loss';
    } else if (sd2sd1Positive) {
      dominant = 'poincare_long_term_loss';
    } else if (dfaPos) {
      dominant = 'dfa_fractal_loss';
    }

    // Stufen-Klassifikation (ROC-optimierter Score-Schnitt 3.5)
    var suspicion, interpretation, recommendation;
    if (score >= Thresholds.highScoreCut) {
      suspicion = 'high';
      var secStr = secondaryCount > 0 ? ', + ' + secondaryCount + ' Akut-Marker' : '';
      var patternStr = dominant !== null ? dominant : 'kein dominantes Pattern';
      interpretation = 'Score ' + f1(score) + ' ≥ ' + swiftDoubleString(Thresholds.highScoreCut) + ' ' +
        '(ROC-optimal an n=40 BAL-validated). ' + primaryCount + '/6 PRIMÄRE Marker positiv ' +
        '(Nyerges-Bohák 2025)' + secStr + '. Pattern: ' + patternStr + '. ' +
        'Konsistent mit BAL-bestätigtem sEA-Profil.';
      recommendation = 'Tierarzt-Konsultation: Röschmann-Recovery-Test als Phase-2-Bestätigung ' +
        '(15min Longe + BrPM-Recovery >15min). Bei Bestätigung: BAL-Zytologie. ' +
        'Lo Feudo 2024 Forced-Oscillation als Alternative.';
    } else if (score >= Thresholds.moderateScoreCut) {
      suspicion = 'moderate';
      interpretation = 'Score ' + f1(score) + ' im Grenzbereich ' +
        '[' + swiftDoubleString(Thresholds.moderateScoreCut) + '–' + swiftDoubleString(Thresholds.highScoreCut) + '). ' +
        primaryCount + '/6 PRIMÄRE Marker positiv. ' +
        'Sub-klinisch oder anderer Stressor möglich.';
      recommendation = 'Re-Test in anderer Tageszeit + Stallumgebung. Bei wiederholt ' +
        'erhöhten Markern → Tierarzt + Röschmann-Recovery-Test.';
    } else {
      suspicion = 'low';
      interpretation = 'Score ' + f1(score) + ' < ' + swiftDoubleString(Thresholds.moderateScoreCut) + '. ' +
        primaryCount + '/6 PRIMÄRE Marker positiv. Kein HRV-Hinweis auf Asthma.';
      recommendation = 'Reguläres Monitoring. Bei klinischen Symptomen erneut messen.';
    }

    return {
      suspicion: suspicion,
      weightedScore: score,
      primaryPositiveCount: primaryCount,
      secondaryPositiveCount: secondaryCount,
      novelPositive: novelPositive,
      markers: markers,
      dominantPattern: dominant,
      interpretation: interpretation,
      recommendation: recommendation,
      methodology: METHODOLOGY.slice(),
      disclaimer: DISCLAIMER,
    };
  }

  // ===========================================================================
  // TEIL 2 — EquineAsthmaTrendModel (Engine v2.5)
  // ===========================================================================
  //
  // Behandlungs-Verlauf: longitudinale Score-Trajektorie aus Screener-Auswertungen.
  // Validiert gegen Gehlen 2020 (DOI 10.3390/ani10091563, FU Berlin n=43):
  // Survivors zeigten eine klare HRV-Trajektorie T1→T2→T3, Non-Survivors keine.
  // Die Ausgabe ist immer Beobachtung, nie "Therapie-Erfolg nachgewiesen".

  var TREND_EMOJI = Object.freeze({
    improving: '📈',
    stable: '➡️',
    worsening: '📉',
    insufficientData: '⚪️',
  });

  var REFERENZ_DE = 'Gehlen 2020 Animals n=43 FU Berlin (DOI 10.3390/ani10091563): Survivors zeigten klare HRV-Trajectory T1→T2→T3, Non-Survivors keine.';
  var REFERENZ_EN = 'Gehlen 2020 Animals n=43 FU Berlin (DOI 10.3390/ani10091563): survivors showed a clear HRV trajectory T1→T2→T3, non-survivors none.';

  /**
   * Analysiert Score-Punkte EINES Pferdes auf Behandlungs-Verlauf.
   *
   * @param {Object}   argumente
   * @param {Array}    argumente.points      [{date, weightedScore, suspicion}, ...]
   *                                         date: Date, Epochen-Millisekunden oder ISO-8601-String
   * @param {number}   [argumente.windowDays=30]  betrachtetes Zeitfenster ab "jetzt"
   * @param {Date|number|string} [argumente.now=new Date()]  Referenz-Zeitpunkt (testbar)
   * @param {boolean}  [argumente.isDE=true]      true = deutsche Texte, false = englische
   * @returns {Object} TrendResult
   */
  function analyze(argumente) {
    var a = argumente || {};
    var points = a.points || [];
    var windowDays = istNil(a.windowDays) ? 30 : a.windowDays;
    var isDE = istNil(a.isDE) ? true : !!a.isDE;
    var nowSec = alsEpochenSekunden(istNil(a.now) ? new Date() : a.now, 'now');

    var reference = isDE ? REFERENZ_DE : REFERENZ_EN;
    var cutoffSec = nowSec - windowDays * 86400;

    // Fenster + Filter: Aufnahmen ohne belastbare Auswertung fliegen raus.
    var windowPoints = points
      .map(function (p, index) {
        return {
          dateSec: alsEpochenSekunden(p.date, 'points[' + index + '].date'),
          weightedScore: optDouble(p.weightedScore, 'points[' + index + '].weightedScore'),
          suspicion: p.suspicion,
        };
      })
      .filter(function (p) { return p.dateSec >= cutoffSec && p.suspicion !== 'insufficient'; });

    // Chronologisch sortieren. Der Vergleich ist bewusst als Drei-Wege-Vergleich
    // ausgeschrieben (nicht a-b), damit er sich bei gleichen Zeitstempeln genauso
    // verhaelt wie Swifts Praedikat `$0.date < $1.date`.
    windowPoints.sort(function (x, y) {
      if (x.dateSec < y.dateSec) return -1;
      if (x.dateSec > y.dateSec) return 1;
      return 0;
    });

    function unzureichenderTrend(pointCount, scoreFirst, scoreLast, interpretation, recommendation) {
      return {
        trend: 'insufficientData',
        windowDays: windowDays,
        pointCount: pointCount,
        scoreFirst: scoreFirst,
        scoreLast: scoreLast,
        scoreDelta: null,
        scoreMean: null,
        scoreMin: null,
        scoreMax: null,
        interpretation: interpretation,
        recommendation: recommendation,
        validationReference: reference,
      };
    }

    if (windowPoints.length < 2) {
      return unzureichenderTrend(
        windowPoints.length, null, null,
        isDE ? 'Mindestens 2 Aufnahmen im letzten Zeitraum nötig für Trend-Analyse.'
             : 'At least 2 recordings in the recent window are needed for trend analysis.',
        isDE ? 'Aufnahme-Frequenz ≥1× pro Woche aufbauen für aussagekräftigen Trend.'
             : 'Build up a recording frequency of ≥1× per week for a meaningful trend.'
      );
    }

    // Mindest-Zeitspanne 7 Tage zwischen erstem und letztem Punkt
    var spanDays = (windowPoints[windowPoints.length - 1].dateSec - windowPoints[0].dateSec) / 86400.0;
    if (!(spanDays >= 7.0)) {
      return unzureichenderTrend(
        windowPoints.length,
        windowPoints[0].weightedScore,
        windowPoints[windowPoints.length - 1].weightedScore,
        isDE ? 'Sessions liegen zu eng zusammen (<7 Tage Spanne). Trend benötigt mindestens 1 Woche Beobachtung.'
             : 'Sessions are too close together (<7-day span). A trend needs at least 1 week of observation.',
        isDE ? '1 Aufnahme pro Woche über mindestens 4 Wochen für klaren Therapie-Verlauf.'
             : '1 recording per week over at least 4 weeks for a clear treatment course.'
      );
    }

    var scores = windowPoints.map(function (p) { return p.weightedScore; });
    var scoreFirst = scores[0];
    var scoreLast = scores[scores.length - 1];
    var delta = scoreLast - scoreFirst;
    var mean = scores.reduce(function (summe, wert) { return summe + wert; }, 0) / scores.length;
    var minScore = swiftMin(scores);
    var maxScore = swiftMax(scores);

    var trend, interp, rec;

    // Schwellen kalibriert an der Gehlen-Trajektorie-Empirie:
    // +-1.5 Punkte Delta = klinisch relevant (entspricht dem Umschlagen eines PRIMAER-Markers)
    var spanDaysInt = swiftRounded(spanDays);

    if (delta <= -1.5) {
      trend = 'improving';
      interp = isDE
        ? 'Verbesserung: Score sank von ' + f1(scoreFirst) + ' auf ' + f1(scoreLast) +
          ' (Δ ' + f1(delta) + ') über ' + scores.length + ' Sessions in ' + spanDaysInt +
          ' Tagen. Muster konsistent mit Survivor-Trajectory aus Gehlen 2020.'
        : 'Improvement: score fell from ' + f1(scoreFirst) + ' to ' + f1(scoreLast) +
          ' (Δ ' + f1(delta) + ') over ' + scores.length + ' sessions in ' + spanDaysInt +
          ' days. Pattern consistent with the survivor trajectory in Gehlen 2020.';
      rec = isDE
        ? 'Aktuelle Therapie/Management beibehalten. Monatliche Kontroll-Aufnahmen zur Verlaufssicherung empfohlen.'
        : 'Keep the current therapy/management. Monthly follow-up recordings recommended to confirm the course.';
    } else if (delta >= 1.5) {
      trend = 'worsening';
      interp = isDE
        ? 'Verschlechterung: Score stieg von ' + f1(scoreFirst) + ' auf ' + f1(scoreLast) +
          ' (Δ +' + f1(delta) + ') über ' + scores.length + ' Sessions in ' + spanDaysInt +
          ' Tagen. Muster erfordert Aufmerksamkeit.'
        : 'Worsening: score rose from ' + f1(scoreFirst) + ' to ' + f1(scoreLast) +
          ' (Δ +' + f1(delta) + ') over ' + scores.length + ' sessions in ' + spanDaysInt +
          ' days. Pattern requires attention.';
      rec = isDE
        ? 'Tierarzt-Re-Evaluation empfohlen: Stallumgebung prüfen (Staubbelastung, Heu-Qualität), Allergen-Exposition reduzieren, Medikamenten-Status überprüfen.'
        : 'Veterinary re-evaluation recommended: check stable environment (dust load, hay quality), reduce allergen exposure, review medication status.';
    } else {
      trend = 'stable';
      interp = isDE
        ? 'Stabil: Score-Bereich ' + f1(minScore) + '–' + f1(maxScore) +
          ' (Δ ' + f1(delta) + ') über ' + scores.length + ' Sessions in ' + spanDaysInt +
          ' Tagen. Keine klare Trajektorie in beide Richtungen.'
        : 'Stable: score range ' + f1(minScore) + '–' + f1(maxScore) +
          ' (Δ ' + f1(delta) + ') over ' + scores.length + ' sessions in ' + spanDaysInt +
          ' days. No clear trajectory in either direction.';
      rec = isDE
        ? (scoreLast >= 3.5
            ? 'Trotz Stabilität liegt der Score im auffälligen Bereich. Tierarzt-Konsultation zur Status-Bewertung sinnvoll.'
            : 'Stabil unauffälliger Score. Reguläres Monitoring fortsetzen.')
        : (scoreLast >= 3.5
            ? 'Despite stability the score is in the notable range. A veterinary consultation for status assessment is advisable.'
            : 'Stable, unremarkable score. Continue regular monitoring.');
    }

    return {
      trend: trend,
      windowDays: windowDays,
      pointCount: scores.length,
      scoreFirst: scoreFirst,
      scoreLast: scoreLast,
      scoreDelta: delta,
      scoreMean: mean,
      scoreMin: minScore,
      scoreMax: maxScore,
      interpretation: interp,
      recommendation: rec,
      validationReference: reference,
    };
  }

  // ===========================================================================
  // Export — Browser (globales Objekt) und Node (module.exports)
  // ===========================================================================

  // Thresholds ist im Original `public` und wird deshalb exportiert.
  // Weights ist im Original `private` — bleibt hier ebenfalls im Modul.
  var EquineAsthmaScreener = {
    Thresholds: Thresholds,
    evaluate: evaluate,
  };

  var EquineAsthmaTrendModel = {
    emoji: TREND_EMOJI,
    analyze: analyze,
  };

  global.EquineAsthmaScreener = EquineAsthmaScreener;
  global.EquineAsthmaTrendModel = EquineAsthmaTrendModel;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      EquineAsthmaScreener: EquineAsthmaScreener,
      EquineAsthmaTrendModel: EquineAsthmaTrendModel,
    };
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
