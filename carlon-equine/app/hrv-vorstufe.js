/* ═══════════════════════════════════════════════════════════════════════════
   hrv-vorstufe.js — CARLON Equine · HRV-Vorstufe, portiert aus der iOS-App
   ───────────────────────────────────────────────────────────────────────────
   ZWECK
   Das Browser-Cockpit rechnete bisher auf der ROHEN RR-Reihe. Die App tut das
   nicht: sie schickt jede Aufnahme zuerst durch eine fuenfstufige Filterkette,
   behandelt den physiologischen AV-Block 2. Grades als eigene Kategorie und
   unterdrueckt Kennzahlen, sobald zu viele Artefakte drin sind. Ohne diese
   Vorstufe sieht eine Tierarztpraxis im Cockpit Zahlen, die aus ungefilterten
   Rohdaten stammen (gemessen: RMSSD 889 ms statt 111 ms bei 40 vagalen Pausen).

   Diese Datei ist die 1:1-Portierung dieser Vorstufe. Quellen (Repo-Stand
   2026-08-08), jede Funktion zeilenweise uebernommen:
     · EquineFilterPipeline.swift       — Stage 1-4, Qualitaetsklasse, Artefaktrate
     · EquineMotionBurstDetector.swift  — Burst-Aggregation (von der Pipeline benutzt)
     · HRVPreprocessor.swift            — RMSSD / SDNN / pNN50 / DFA-alpha1
     · HRVKubiosPipeline.swift          — 4-Hz-Spline-Resampling + Welch-PSD
     · EquineHRVAnalyzer.swift          — die zwei Riegel (Z. 224-226), TINN, SampEn,
                                          Poincare (Brennan), die analyze()-Kette

   REGEL BEIM PORTIEREN: keine Schwelle, kein Parameter, keine Reihenfolge
   geaendert. Auch dort nicht, wo der Original-Code erkennbar schief ist — solche
   Stellen stehen als "ABWEICHUNGSNOTIZ" im Kommentar, nicht im Code. Die
   Filterkette ist an echten Pferdedaten kalibriert; sie zu "verbessern" macht
   den Vergleich mit der App wertlos.

   RAHMEN: reines ES2020, keine Abhaengigkeiten, kein Build. Per <script> oder
   per require() einbindbar.
   ═══════════════════════════════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  /* ═══════════════════════════════════════════════════════════════════════
     0 · Mathe-Grundbausteine
     (EquineFilterPipeline.computeMedian / computeQuartileDeviation / computeRMSSD)
     ═══════════════════════════════════════════════════════════════════════ */

  /** Median. Gerade Anzahl → Mittel der beiden mittleren Werte. Leer → 0. */
  function computeMedian(values) {
    if (!values.length) return 0;
    const sorted = values.slice().sort((a, b) => a - b);
    return sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[(sorted.length - 1) / 2];
  }

  /**
   * Quartilsabweichung QD = (Q3 - Q1) / 2.
   * ABWEICHUNGSNOTIZ: Das Original nimmt die Quantile ueber rohe Index-Division
   * (count/4 bzw. 3*count/4) ohne Interpolation — das ist keine Lehrbuch-
   * Quantilsdefinition, aber genau dieses Verhalten kalibriert die Schwelle
   * alpha·QD90 in Stage 2. Uebernommen wie es ist.
   */
  function computeQuartileDeviation(values) {
    if (values.length < 4) return 1.0;
    const sorted = values.slice().sort((a, b) => a - b);
    const q1Idx = Math.floor(sorted.length / 4);
    const q3Idx = Math.floor((3 * sorted.length) / 4);
    return (sorted[q3Idx] - sorted[q1Idx]) / 2;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     1 · Plausibilitaetsspanne  (EquineRRPlausibility)
     ───────────────────────────────────────────────────────────────────────
     Herkunft laut Original: ein publizierter equiner Plausibilitaetsbereich
     existiert nicht, die Spanne ist eine begruendete eigene Festlegung.
     Unten 200 ms (= 300 bpm), oben 8000 ms (= 7,5 bpm; 2026-07-28 von 4000
     angehoben, weil 57 % gesunder sedentaerer Pferde ein laengstes RR > 4 s
     haben). Jenseits 12000 ms (< 5 bpm) auch fuer einen Block-Kandidaten Muell.
     ═══════════════════════════════════════════════════════════════════════ */

  const EquineRRPlausibility = {
    untenMs: 200,
    obenMs: 8000,
    absurdObenMs: 12000,
    gueltig(rrMs) {
      return rrMs >= this.untenMs && rrMs <= this.obenMs;
    },
  };

  /* Beat-Annotation. Nur `normal` geht in die HRV-Rechnung ein. */
  const BeatAnnotation = {
    normal: 'N',                 // Normal Sinus
    avBlockPhysiological: 'A',   // 2°-AV-Block (vagal, beim Pferd NORMAL)
    ectopic: 'E',                // Vorhof/Ventrikel-ektopisch
    motionArtifact: 'M',         // Hardware/Bewegung
    unclassified: '?',           // Low-Quality
  };
  function includeInHRV(ann) {
    return ann === BeatAnnotation.normal;
  }

  /* Stage-2-Klassen (Lipponen & Tarvainen 2019). */
  const BeatClass = {
    normal: 'normal',
    ectopic: 'ectopic',   // NPN/PNP-Muster
    missed: 'missed',     // PN-Muster, RR > 1.5×medRR
    extra: 'extra',       // zwei aufeinanderfolgende kurze ≈ medRR
    short: 'short',       // RR < 0.7×medRR
    long: 'long',         // RR > 1.5×medRR ohne AV-Muster
  };

  /* ═══════════════════════════════════════════════════════════════════════
     2 · Stage 1 — T-Wellen-Refraktaerfilter (equine-exklusiv)
     ───────────────────────────────────────────────────────────────────────
     Beim Pferd erreicht die T-Welle bis 80 % der R-Zacken-Amplitude. Ein
     Standard-R-Peakdetektor haelt sie oft fuer eine R-Zacke → kuenstlich kurzes
     RR (~300-400 ms). Loesung: RR < 0.5 × lokaler Median → mit dem naechsten
     RR verschmelzen. Die Indizes der verschmolzenen Schlaege gehen an Stage 3.
     ═══════════════════════════════════════════════════════════════════════ */

  function stage1TWaveRefractoryFilter(rr) {
    if (rr.length < 10) return { merged: rr.slice(), mergeCount: 0, mergedIndices: [] };
    const result = [];
    const mergedIdxs = [];
    let skipNext = false;
    let mergeCount = 0;
    for (let i = 0; i < rr.length; i++) {
      if (skipNext) { skipNext = false; continue; }
      // Nur benachbarte, NICHT verschmolzene RR fuer den Median (keine Kontamination)
      const windowStart = Math.max(0, i - 5);
      const windowEnd = Math.min(rr.length, i + 5);
      const window = rr.slice(windowStart, windowEnd).filter((v) => v >= 300 && v <= 3500);
      if (!window.length) { result.push(rr[i]); continue; }
      const med = computeMedian(window);
      const refractory = 0.5 * med;
      if (rr[i] < refractory && rr[i] > 100 && i + 1 < rr.length) {
        result.push(rr[i] + rr[i + 1]);
        mergedIdxs.push(result.length - 1);   // Index im verschmolzenen Array
        skipNext = true;
        mergeCount += 1;
      } else {
        result.push(rr[i]);
      }
    }
    return { merged: result, mergeCount: mergeCount, mergedIndices: mergedIdxs };
  }

  /* ═══════════════════════════════════════════════════════════════════════
     3 · Stage 2 — Lipponen-Tarvainen 2019, 5-Typen-Klassifikation
     ───────────────────────────────────────────────────────────────────────
     Schwelle = alpha · QD90 der Sukzessivdifferenzen, alpha = 5.2 (unter
     Normalverteilung werden damit 99,95 % der Schlaege normal klassifiziert).
     ACHTUNG: das ist ein MENSCHLICHER Klassifikator. Stage 3 darf ihn
     ueberstimmen — siehe dort.
     ═══════════════════════════════════════════════════════════════════════ */

  function stage2LipponenTarvainenClassification(rr) {
    if (rr.length < 5) {
      return { classes: new Array(rr.length).fill(BeatClass.normal), qd90: 0 };
    }

    const dRR = [];
    for (let i = 1; i < rr.length; i++) dRR.push(rr[i] - rr[i - 1]);

    const qd90Global = computeQuartileDeviation(dRR);
    const alpha = 5.2;
    const threshold = alpha * qd90Global;

    const classes = [BeatClass.normal];   // erster Schlag immer normal

    for (let i = 1; i < rr.length; i++) {
      const dRRprev = i > 1 ? dRR[i - 2] : 0;
      const dRRcurr = dRR[i - 1];
      const dRRnext = i < rr.length - 1 ? dRR[i] : 0;

      // Lokaler Median ueber 10 umgebende Schlaege
      const windowStart = Math.max(0, i - 5);
      const windowEnd = Math.min(rr.length, i + 5);
      const localMedian = computeMedian(rr.slice(windowStart, windowEnd));
      const ratio = rr[i] / localMedian;

      // Typ 1: ektopisch — NPN- bzw. PNP-Muster
      if (dRRprev < 0 && dRRcurr > threshold && dRRnext < 0) { classes.push(BeatClass.ectopic); continue; }
      if (dRRprev > 0 && dRRcurr < -threshold && dRRnext > 0) { classes.push(BeatClass.ectopic); continue; }

      // Typ 2: ausgelassen/lang (PN-Muster, RR > 1.5×medRR)
      if (ratio > 1.5) { classes.push(BeatClass.missed); continue; }

      // Typ 3: Extraschlag (zwei aufeinanderfolgende kurze, Summe ≈ medRR)
      if (ratio < 0.7 && i + 1 < rr.length) {
        const nextRatio = rr[i + 1] / localMedian;
        if (nextRatio < 0.7) {
          const combined = (rr[i] + rr[i + 1]) / localMedian;
          if (Math.abs(combined - 1.0) < 0.2) { classes.push(BeatClass.extra); continue; }
        }
      }

      // Typ 4: kurz
      if (ratio < 0.7) { classes.push(BeatClass.short); continue; }

      // Typ 5: lang (ohne AV-Muster)
      // ABWEICHUNGSNOTIZ: dieser Zweig ist im Original TOT — `ratio > 1.5` hat
      // oben schon zu `.missed` gefuehrt. `.long` kann daher nie entstehen.
      // Unveraendert uebernommen, damit der Zustandsraum identisch bleibt.
      if (ratio > 1.5) { classes.push(BeatClass.long); continue; }

      classes.push(BeatClass.normal);
    }

    return { classes: classes, qd90: qd90Global };
  }

  /* ═══════════════════════════════════════════════════════════════════════
     4 · Stage 3 — ⭐ Equiner AV-Block-Spezialfilter
     ───────────────────────────────────────────────────────────────────────
     Der AV-Block 2. Grades ist beim ruhenden Pferd bei 40-90 % der Tiere
     PHYSIOLOGISCH (Nissen 2022, van Loon 2019). Lipponen-Tarvainen stuft ihn
     zwangslaeufig als ektopisch ein, sobald das Vorzeichen der vorherigen
     Differenz zufaellig passt — die Sinusarrhythmie wuerfelt das aus. Deshalb
     laeuft die AV-Pruefung auch fuer `.ectopic`, und die artspezifische Regel
     ueberstimmt das menschliche Muster.

     Kriterium: Verhaeltnis zum lokalen Median (Fenster ±10) in [1.8, 2.2] UND
     beide Nachbarn innerhalb ±25 % des Medians (Isolationstest).
     ═══════════════════════════════════════════════════════════════════════ */

  function stage3EquineAVBlockReclassification(rrMs, classes) {
    const annotations = [];

    for (let i = 0; i < classes.length; i++) {
      const cls = classes[i];
      if (cls === BeatClass.normal) {
        annotations.push(BeatAnnotation.normal);
      } else if (cls === BeatClass.ectopic || cls === BeatClass.missed || cls === BeatClass.long) {
        const rueckfall = (cls === BeatClass.ectopic)
          ? BeatAnnotation.ectopic
          : BeatAnnotation.motionArtifact;
        if (!(i > 0 && i < rrMs.length)) { annotations.push(rueckfall); continue; }

        // Fenster 10 Beats (Sprint E.16 BUG #1.4): groessere N sind robuster
        // gegen vorherige AVBs im Fenster, weil ein einzelner AVB den Median
        // nicht dominiert.
        const windowStart = Math.max(0, i - 10);
        const windowEnd = Math.min(rrMs.length, i + 10);
        const localMedian = computeMedian(rrMs.slice(windowStart, windowEnd));
        const ratio = rrMs[i] / localMedian;

        if (ratio >= 1.8 && ratio <= 2.2) {
          // Isolationstest (van Loon 2019): beim physiologischen Block kehren die
          // Nachbarn zum Median zurueck. Pathologische Bloecke / Bewegungsartefakte
          // zeigen chaotische, verschobene Nachbarn.
          const prevRR = i > 0 ? rrMs[i - 1] : localMedian;
          const nextRR = i < rrMs.length - 1 ? rrMs[i + 1] : localMedian;
          const prevDeviation = Math.abs(prevRR - localMedian) / localMedian;
          const nextDeviation = Math.abs(nextRR - localMedian) / localMedian;
          if (prevDeviation < 0.25 && nextDeviation < 0.25) {
            annotations.push(BeatAnnotation.avBlockPhysiological);
          } else {
            annotations.push(BeatAnnotation.motionArtifact);
          }
        } else if (ratio > 2.2) {
          annotations.push(BeatAnnotation.motionArtifact);   // hochgradig oder Artefakt
        } else {
          // ABWEICHUNGSNOTIZ: im Original steht hier
          //   annotations.append(cls == .ectopic ? .ectopic : .ectopic)
          // — beide Zweige liefern dasselbe. Der Kommentar daneben behauptet
          // etwas anderes ("ausgelassen/lang bleibt wie bisher"), aber der Code
          // stuft ausnahmslos auf ektopisch zurueck. Uebernommen wie er ist.
          annotations.push(BeatAnnotation.ectopic);
        }
      } else {
        // .short, .extra
        annotations.push(BeatAnnotation.motionArtifact);
      }
    }

    // ── NACHLAUF: der Schlag NACH einem AV-Block ist normal ────────────────
    // Der Sprung hinauf und sofort wieder hinunter erfuellt das NPN-Muster an
    // ZWEI Stellen — der Nachbar erbt sonst den Fehlalarm. Zurueckgestuft wird
    // nur, wenn der Folgeschlag TATSAECHLICH wieder nahe am lokalen Median liegt
    // (±25 %); eine echte Extrasystole nach einem Block bleibt erkannt.
    for (let i = 0; i < annotations.length; i++) {
      if (annotations[i] !== BeatAnnotation.avBlockPhysiological) continue;
      const j = i + 1;
      if (!(j < annotations.length && annotations[j] === BeatAnnotation.ectopic && j < rrMs.length)) continue;
      const fensterStart = Math.max(0, j - 10);
      const fensterEnde = Math.min(rrMs.length, j + 10);
      const median = computeMedian(rrMs.slice(fensterStart, fensterEnde));
      if (!(median > 0)) continue;
      if (Math.abs(rrMs[j] - median) / median < 0.25) {
        annotations[j] = BeatAnnotation.normal;
      }
    }

    return annotations;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     5 · Stage 4 — Cubic-Spline-Korrektur (equine Schwellen)
     ───────────────────────────────────────────────────────────────────────
     Jeder nicht-normale Schlag (also auch der AV-Block!) wird durch eine
     Catmull-Rom-Interpolation aus den naechsten je zwei normalen Nachbarn
     ersetzt. GENAU HIER entsteht der Unterschied, den die ausgewiesene
     Artefaktrate NICHT zeigt: die Rate zaehlt den AV-Block nicht mit, die
     Korrektur ersetzt ihn trotzdem.
     ═══════════════════════════════════════════════════════════════════════ */

  /* ABWEICHUNGSNOTIZ: `equineCorrectionThresholds` (very_low 1.2 / low 0.9 /
     medium 0.6 / strong 0.4 s) ist im Original deklariert, wird aber von
     stage4 NIE gelesen — die Korrektur laeuft rein ueber die Annotation. Der
     Methodik-String behauptet trotzdem "equine_thresholds_0.4_1.2s". Zur
     Dokumentation mitportiert, ebenfalls ungenutzt. */
  const equineCorrectionThresholds = { very_low: 1.2, low: 0.9, medium: 0.6, strong: 0.4 };

  /**
   * Cubic-Spline (Catmull-Rom) durch die Stuetzstellen, ausgewertet bei x.
   * Bei genau 2 Stuetzstellen linearer Rueckfall.
   */
  function cubicSplineInterpolate(x, supports) {
    const pts = supports.slice().sort((a, b) => a.x - b.x);
    if (pts.length < 2) return pts.length ? pts[0].y : 0;
    if (pts.length === 2) {
      const p0 = pts[0], p1 = pts[1];
      if (p1.x === p0.x) return p0.y;
      return p0.y + (p1.y - p0.y) * (x - p0.x) / (p1.x - p0.x);
    }
    let bracketIdx = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      if (pts[i].x <= x && x <= pts[i + 1].x) { bracketIdx = i; break; }
      if (i === pts.length - 2) bracketIdx = i;
    }
    const p1 = pts[bracketIdx];
    const p2 = pts[bracketIdx + 1];
    const p0 = bracketIdx > 0 ? pts[bracketIdx - 1] : { x: 2 * p1.x - p2.x, y: p1.y };
    const p3 = bracketIdx + 2 < pts.length ? pts[bracketIdx + 2] : { x: 2 * p2.x - p1.x, y: p2.y };
    const t = (x - p1.x) / (p2.x - p1.x);
    const t2 = t * t;
    const t3 = t2 * t;
    return 0.5 * (
      (2 * p1.y) +
      (-p0.y + p3.y) * t +
      (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
      (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
    );
  }

  function stage4CubicSplineCorrection(rrMs, classes) {
    const corrected = rrMs.slice();
    const needsCorrection = [];
    for (let i = 0; i < classes.length; i++) if (!includeInHRV(classes[i])) needsCorrection.push(i);

    for (const idx of needsCorrection) {
      // Je die naechsten 2 normalen Schlaege links und rechts suchen
      const leftIdx = [];
      const rightIdx = [];
      for (let j = idx - 1; j >= 0; j--) {
        if (classes[j] === BeatAnnotation.normal) { leftIdx.push(j); if (leftIdx.length >= 2) break; }
      }
      for (let j = idx + 1; j < rrMs.length; j++) {
        if (classes[j] === BeatAnnotation.normal) { rightIdx.push(j); if (rightIdx.length >= 2) break; }
      }
      // ABWEICHUNGSNOTIZ: Der Kommentar im Original sagt "mindestens 2 Punkte
      // noetig", die Bedingung prueft aber >= 1 je Seite. Ein Rand-Artefakt kann
      // damit linear statt kubisch korrigiert werden. Bedingung uebernommen.
      if (!(leftIdx.length >= 1 && rightIdx.length >= 1)) continue;

      const supports = leftIdx.concat(rightIdx).map((j) => ({ x: j, y: rrMs[j] }));
      corrected[idx] = cubicSplineInterpolate(idx, supports);
    }
    return { corrected: corrected, annotations: classes };
  }

  /* ═══════════════════════════════════════════════════════════════════════
     6 · Qualitaetsklasse
     ───────────────────────────────────────────────────────────────────────
     ⚠️ HERKUNFT DER 10-%-GRENZE (Original-Vermerk, unveraendert weitergegeben):
     die App berief sich frueher auf "ter Woort 2022"; eine gezielte Recherche
     (2026-07-21) konnte diese Publikation NICHT auffinden. Ein publizierter
     equiner Grenzwert existiert nicht. Die 10 % sind eine konservative EIGENE
     Festlegung — nicht als Literaturwert nach aussen geben.
     ═══════════════════════════════════════════════════════════════════════ */

  const QualityClass = {
    1: 'Excellent',
    2: 'Good (Time-Domain only)',
    3: 'Poor (HR only)',
    4: 'Unusable — discard',
  };

  function computeQualityClass(annotations) {
    if (!annotations.length) return 4;
    let nonNormal = 0;
    for (const a of annotations) {
      if (a !== BeatAnnotation.normal && a !== BeatAnnotation.avBlockPhysiological) nonNormal++;
    }
    const pct = (nonNormal / annotations.length) * 100;
    if (pct < 1.0) return 1;
    if (pct < 3.0) return 2;
    if (pct < 10.0) return 3;
    return 4;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     7 · Motion-Burst-Aggregation  (EquineMotionBurstDetector)
     ───────────────────────────────────────────────────────────────────────
     Macht aus N Einzel-Artefakten K klinisch lesbare Episoden ("7 Bewegungs-
     Episoden, laengste 16 s" statt "38 Einzelartefakte verteilt").
     Der AV-Block gilt hier ausdruecklich NICHT als Artefakt.
     Geht in keine der neun Kennzahlen ein — mitportiert, weil er Teil des
     Pipeline-Ergebnisses ist, das die Chart-Schicht liest.
     ═══════════════════════════════════════════════════════════════════════ */

  const MOTION_BURST_MAX_BEAT_GAP = 3;

  function istBurstArtefakt(ann) {
    return ann === BeatAnnotation.ectopic
        || ann === BeatAnnotation.motionArtifact
        || ann === BeatAnnotation.unclassified;
  }

  function detectMotionBursts(annotations, rrMs) {
    if (annotations.length !== rrMs.length || !annotations.length) {
      return { bursts: [], totalArtifactBeats: 0, totalDurationSec: 0, burstDensityPerMinute: 0, methodology: 'no input' };
    }
    const artifactIndices = [];
    for (let i = 0; i < annotations.length; i++) if (istBurstArtefakt(annotations[i])) artifactIndices.push(i);
    if (!artifactIndices.length) {
      return { bursts: [], totalArtifactBeats: 0, totalDurationSec: 0, burstDensityPerMinute: 0,
               methodology: 'burst-aggregation gap<=' + MOTION_BURST_MAX_BEAT_GAP };
    }

    const clusters = [];
    let current = [artifactIndices[0]];
    for (const idx of artifactIndices.slice(1)) {
      if (idx - current[current.length - 1] <= MOTION_BURST_MAX_BEAT_GAP) current.push(idx);
      else { clusters.push(current); current = [idx]; }
    }
    clusters.push(current);

    const cumTime = [0];
    for (const rr of rrMs) cumTime.push(cumTime[cumTime.length - 1] + rr / 1000.0);
    const totalSec = cumTime[cumTime.length - 1];

    const bursts = [];
    let totalArtifacts = 0;
    let totalBurstDuration = 0;

    for (const cluster of clusters) {
      const startIdx = cluster[0];
      const endIdx = cluster[cluster.length - 1];
      const startT = startIdx > 0 ? cumTime[startIdx] : 0;
      const endT = cumTime[Math.min(endIdx + 1, cumTime.length - 1)];

      const lo = Math.max(0, startIdx - 1);
      const hi = Math.min(rrMs.length - 1, endIdx + 1);
      let peakDelta = 0;
      for (let i = lo + 1; i <= hi; i++) {
        const delta = Math.abs(rrMs[i] - rrMs[i - 1]);
        if (delta > peakDelta) peakDelta = delta;
      }

      const windowBeats = endIdx - startIdx + 1;
      const counts = {};
      for (const i of cluster) counts[annotations[i]] = (counts[annotations[i]] || 0) + 1;
      // ABWEICHUNGSNOTIZ: Swift bestimmt das Maximum ueber ein Dictionary, dessen
      // Iterationsreihenfolge nicht festgelegt ist — bei Gleichstand ist die
      // dominante Annotation dort NICHT deterministisch. Hier feste Reihenfolge
      // (erstes Maximum in der Aufzaehlungsreihenfolge unten), damit das
      // Browser-Ergebnis reproduzierbar bleibt. Betrifft keine Kennzahl.
      let dominant = BeatAnnotation.motionArtifact, best = -1;
      for (const a of ['N', 'A', 'E', 'M', '?']) {
        if ((counts[a] || 0) > best) { best = counts[a] || 0; dominant = a; }
      }
      if (best <= 0) dominant = BeatAnnotation.motionArtifact;

      const durationSec = endT - startT;
      let severity;
      if (windowBeats >= 7 || durationSec > 8 || peakDelta > 800) severity = 'severe';
      else if (windowBeats >= 3 || durationSec > 3) severity = 'moderate';
      else severity = 'mild';

      bursts.push({
        startBeatIndex: startIdx, endBeatIndex: endIdx,
        startTimeSec: startT, endTimeSec: endT,
        beatCount: windowBeats, artifactCount: cluster.length,
        peakDeltaRRMs: peakDelta, severity: severity,
        dominantAnnotation: dominant, durationSec: durationSec,
      });
      totalArtifacts += cluster.length;
      totalBurstDuration += durationSec;
    }

    return {
      bursts: bursts,
      totalArtifactBeats: totalArtifacts,
      totalDurationSec: totalBurstDuration,
      burstDensityPerMinute: totalSec > 0 ? (bursts.length * 60.0) / totalSec : 0,
      methodology: 'Burst-aggregation post-Lipponen-Tarvainen, gap<=' + MOTION_BURST_MAX_BEAT_GAP
                 + ' beats, severity by (beat-count, duration, peak-dRR)',
    };
  }

  /* ═══════════════════════════════════════════════════════════════════════
     8 · Die Pipeline  (EquineFilterPipeline.process)
     ═══════════════════════════════════════════════════════════════════════ */

  function pipelineProcess(rrIntervalsMs) {
    // Stage 0+1: Plausibilitaet markieren + T-Wellen-Merge.
    // RR werden BEHALTEN (nicht entfernt) — ausserhalb der Spanne = motionArtifact.
    const stage1 = stage1TWaveRefractoryFilter(rrIntervalsMs);
    // Stage 2
    const stage2 = stage2LipponenTarvainenClassification(stage1.merged);
    // Stage 3
    const stage3 = stage3EquineAVBlockReclassification(stage1.merged, stage2.classes);
    // Stage 3.5: T-Wellen-Merges aus Stage 1 nachtragen
    for (const idx of stage1.mergedIndices) if (idx < stage3.length) stage3[idx] = BeatAnnotation.motionArtifact;
    // Stage 3.6: Plausibilitaet.
    // Die artspezifische AV-Regel hat HOEHERE Autoritaet als die stumpfe
    // Absolutgrenze: bei tiefster Vagotonie kann ein physiologischer doppelter
    // Block 6-8 s erreichen; den darf die Grenze nicht zu Motion umstempeln,
    // sonst wird eine echte Pause weginterpoliert. Nur >12 s kippt auch ihn.
    const n36 = Math.min(stage1.merged.length, stage3.length);
    for (let i = 0; i < n36; i++) {
      const rr = stage1.merged[i];
      const istPhysiologischerBlock = stage3[i] === BeatAnnotation.avBlockPhysiological;
      const absurd = !isFinite(rr) || rr < EquineRRPlausibility.untenMs || rr > EquineRRPlausibility.absurdObenMs;
      if (absurd || (!istPhysiologischerBlock && !EquineRRPlausibility.gueltig(rr))) {
        stage3[i] = BeatAnnotation.motionArtifact;
      }
    }
    // Stage 4
    const stage4 = stage4CubicSplineCorrection(stage1.merged, stage3);
    const qc = computeQualityClass(stage4.annotations);

    const avIdx = [], ectIdx = [], motIdx = [];
    for (let i = 0; i < stage4.annotations.length; i++) {
      const ann = stage4.annotations[i];
      if (ann === BeatAnnotation.avBlockPhysiological) avIdx.push(i);
      else if (ann === BeatAnnotation.ectopic) ectIdx.push(i);
      else if (ann === BeatAnnotation.motionArtifact) motIdx.push(i);
    }
    let normalCount = 0;
    for (const a of stage4.annotations) if (a === BeatAnnotation.normal) normalCount++;
    const normalPct = (normalCount / Math.max(1, stage4.annotations.length)) * 100;

    // ── DER AV-BLOCK IST KEIN ARTEFAKT ────────────────────────────────────
    // Hier stand frueher `100 - normalPct`. Damit zaehlte jeder physiologische
    // AV-Block als Artefakt — waehrend Qualitaetsklasse und Burst-Detector ihn
    // ausdruecklich AUSNEHMEN. Dieselbe Aufnahme meldete dann gleichzeitig
    // "excellent" und "0,5 % Artefakte". Beim ruhenden Pferd ist der Block bei
    // 40-90 % der Tiere physiologisch; ihn mitzuzaehlen bestraft ausgerechnet
    // die entspanntesten Tiere — und die Zahl geht in den Riegel ein.
    //
    // ⚠️ FOLGE, DIE MAN KENNEN MUSS: eine ausgewiesene Artefaktrate von 0,00 %
    // heisst NICHT, dass die Reihe unveraendert blieb. Stage 4 korrigiert die
    // AV-Bloecke trotzdem. Gemessen: eine Reihe mit 0,00 % Artefakten und
    // trotzdem 480 % SDNN-Unterschied zur ungefilterten Rechnung.
    let avBlockCount = 0;
    for (const a of stage4.annotations) if (a === BeatAnnotation.avBlockPhysiological) avBlockCount++;
    const bewertbar = Math.max(1, stage4.annotations.length - avBlockCount);
    const artifactPct = ((stage4.annotations.length - normalCount - avBlockCount) / bewertbar) * 100;

    const medianRR = computeMedian(stage1.merged);
    const methodology = [
      'stage0_plausibility_equine_range_' + Math.trunc(EquineRRPlausibility.untenMs) + '_' + Math.trunc(EquineRRPlausibility.obenMs) + 'ms',
      'stage1_twave_refractory_filter_0.5x_medRR',
      'stage2_lipponen_tarvainen_2019_alpha5.2_QD90',
      'stage3_equine_av_block_1.8_2.2x_medRR_isolated',
      'stage4_cubic_spline_equine_thresholds_0.4_1.2s',
      'ground_truth_van_loon_de_clercq_2017',
      'stage5_motion_burst_aggregation_jan_stall_pattern_2026',
    ];

    const burstResult = detectMotionBursts(stage4.annotations, stage4.corrected);

    return {
      rawCount: rrIntervalsMs.length,
      cleanRR: stage4.corrected,
      annotations: stage4.annotations,
      avBlockIndices: avIdx,
      ectopicIndices: ectIdx,
      motionArtifactIndices: motIdx,
      tWaveMergedCount: stage1.mergeCount,
      normalBeatPct: normalPct,
      artifactRatePct: artifactPct,
      qualityClass: qc,
      qualityLabel: QualityClass[qc],
      medianRR: medianRR,
      alpha: 5.2,
      quartileDeviation: stage2.qd90,
      methodology: methodology,
      motionBursts: burstResult.bursts,
      /** Nur `normal`-Schlaege — was die App in die HRV-Rechnung laesst. */
      get validBeatsForHRV() {
        const out = [];
        for (let i = 0; i < this.cleanRR.length; i++) if (includeInHRV(this.annotations[i])) out.push(this.cleanRR[i]);
        return out;
      },
    };
  }

  /* ═══════════════════════════════════════════════════════════════════════
     9 · Zeitbereich  (HRVPreprocessor)
     ───────────────────────────────────────────────────────────────────────
     ACHTUNG Nenner: RMSSD und SDNN teilen beide durch (n-1). Die im Cockpit
     bisher benutzte Ableitung `deriveRMSSD` teilt durch n. Bei n ≈ 400 sind das
     0,1 % — irrelevant gegenueber der Filterung, aber es ist ein Unterschied.
     ═══════════════════════════════════════════════════════════════════════ */

  function computeRMSSD(rrs) {
    if (rrs.length < 2) return 0;
    let sumSq = 0;
    for (let i = 1; i < rrs.length; i++) { const d = rrs[i] - rrs[i - 1]; sumSq += d * d; }
    return Math.sqrt(sumSq / (rrs.length - 1));
  }

  function computeSDNN(rrs) {
    if (rrs.length < 2) return 0;
    let sum = 0;
    for (const v of rrs) sum += v;
    const mean = sum / rrs.length;
    let sumSq = 0;
    for (const v of rrs) sumSq += (v - mean) * (v - mean);
    return Math.sqrt(sumSq / (rrs.length - 1));
  }

  function computePNN50(rrs) {
    if (rrs.length < 2) return 0;
    let count50 = 0;
    for (let i = 1; i < rrs.length; i++) if (Math.abs(rrs[i] - rrs[i - 1]) > 50) count50++;
    return (count50 / (rrs.length - 1)) * 100.0;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     10 · DFA-alpha1  (HRVPreprocessor.computeDFA, Peng 1995)
     ───────────────────────────────────────────────────────────────────────
     Skalen 4-16 Schlaege, harte Untergrenze 64 Schlaege. Die Aufrufstelle in
     der App verlangt zusaetzlich n >= 100.
     ═══════════════════════════════════════════════════════════════════════ */

  function computeDFA(rrIntervalsMs, scaleMin, scaleMax, minBeats) {
    if (rrIntervalsMs.length < minBeats) return null;
    if (!(scaleMin >= 2 && scaleMax > scaleMin)) return null;

    // 1. Integrieren (kumulierte Summe der mittelwertbereinigten Reihe)
    let sum = 0;
    for (const v of rrIntervalsMs) sum += v;
    const mean = sum / rrIntervalsMs.length;
    const integrated = new Array(rrIntervalsMs.length);
    let run = 0;
    for (let i = 0; i < rrIntervalsMs.length; i++) { run += (rrIntervalsMs[i] - mean); integrated[i] = run; }

    // 2. F(n) je Skala
    const logN = [], logFn = [];
    for (let scale = scaleMin; scale <= scaleMax; scale++) {
      if (integrated.length < scale * 4) continue;
      const nWindows = Math.floor(integrated.length / scale);
      let sumVariance = 0;
      for (let w = 0; w < nWindows; w++) {
        const start = w * scale;
        const segment = integrated.slice(start, start + scale);
        let xSum = 0; for (let i = 0; i < scale; i++) xSum += i;
        const xMean = xSum / scale;
        let ySum = 0; for (let i = 0; i < scale; i++) ySum += segment[i];
        const yMean = ySum / scale;
        let num = 0, den = 0;
        for (let i = 0; i < scale; i++) { const dx = i - xMean; num += dx * (segment[i] - yMean); den += dx * dx; }
        const slope = den > 0 ? num / den : 0;
        const intercept = yMean - slope * xMean;
        let rss = 0;
        for (let i = 0; i < scale; i++) { const r = segment[i] - (slope * i + intercept); rss += r * r; }
        sumVariance += rss;
      }
      const fn = Math.sqrt(sumVariance / (nWindows * scale));
      if (fn > 0) { logN.push(Math.log(scale)); logFn.push(Math.log(fn)); }
    }
    if (logN.length < 4) return null;

    // 3. Steigung von log(F) gegen log(n)
    let xs = 0; for (const v of logN) xs += v;
    let ys = 0; for (const v of logFn) ys += v;
    const xMean = xs / logN.length, yMean = ys / logFn.length;
    let num = 0, den = 0;
    for (let i = 0; i < logN.length; i++) { const dx = logN[i] - xMean; num += dx * (logFn[i] - yMean); den += dx * dx; }
    return den > 0 ? num / den : null;
  }

  function computeDFAAlpha1(rrIntervalsMs) {
    return computeDFA(rrIntervalsMs, 4, 16, 64);
  }

  /* ═══════════════════════════════════════════════════════════════════════
     11 · Frequenzbereich — 4-Hz-Spline-Resampling + Welch-PSD
     ───────────────────────────────────────────────────────────────────────
     DAS IST DER TEIL, DER DEN GROESSTEN UNTERSCHIED MACHT.
     Das Cockpit rechnete Lomb-Scargle direkt auf den ungleichmaessigen RR und
     lag dadurch um Faktor 2-9 zu NIEDRIG; der Marker LF_HF_acute (Schwelle
     < 0,40) kippte damit in 16 von 19 Testreihen.

     Die App macht es anders und genau so wird es hier gemacht:
       1. natuerlicher kubischer Spline durch (kumulierte Zeit, RR) → 4 Hz
       2. Welch: Hann-Fenster 256 Punkte (= 64 s), 50 % Ueberlappung
       3. direkte DFT je Segment, Parseval-korrekte Normierung
          (== scipy scaling='density')
       4. Trapez-Integration ueber die equinen Baender

     Aufloesung: df = 4/256 = 0,0156 Hz → im equinen LF-Band (0,01-0,07 Hz)
     liegen nur 3-4 Stuetzstellen. Das ist grob, aber es ist die Aufloesung, mit
     der die App-Werte und die Marker-Schwellen kalibriert sind.
     ═══════════════════════════════════════════════════════════════════════ */

  /** Equine Baender (Visser 2002, Stucke 2015, Wonghanchao 2025). */
  const BandConfigEquine = {
    vlfHi: 0.01, lfHi: 0.07, hfHi: 0.60,
    label: 'Equine-Visser-2002',
    citation: 'Visser 2002, Stucke 2015 Review, Wonghanchao 2025',
  };
  /** Humane Baender (Task Force ESC/NASPE 1996) — fuer Vollstaendigkeit. */
  const BandConfigHuman = {
    vlfHi: 0.04, lfHi: 0.15, hfHi: 0.40,
    label: 'Human-TF-1996',
    citation: 'Task Force ESC/NASPE 1996 — Circulation 93(5):1043-1065',
  };

  function naturalCubicSplineSecondDerivs(xs, ys) {
    const n = xs.length;
    const u = new Array(n).fill(0);
    const y2 = new Array(n).fill(0);
    for (let i = 1; i < n - 1; i++) {
      const sig = (xs[i] - xs[i - 1]) / (xs[i + 1] - xs[i - 1]);
      const p = sig * y2[i - 1] + 2.0;
      y2[i] = (sig - 1.0) / p;
      u[i] = (ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]) - (ys[i] - ys[i - 1]) / (xs[i] - xs[i - 1]);
      u[i] = (6.0 * u[i] / (xs[i + 1] - xs[i - 1]) - sig * u[i - 1]) / p;
    }
    for (let k = n - 2; k >= 0; k--) y2[k] = y2[k] * y2[k + 1] + u[k];
    return y2;
  }

  function evaluateCubicSpline(x, xs, ys, y2) {
    let klo = 0;
    let khi = xs.length - 1;
    while (khi - klo > 1) {
      const k = Math.floor((khi + klo) / 2);
      if (xs[k] > x) khi = k; else klo = k;
    }
    const h = xs[khi] - xs[klo];
    if (!(h > 0)) return ys[klo];
    const a = (xs[khi] - x) / h;
    const b = (x - xs[klo]) / h;
    return a * ys[klo] + b * ys[khi]
         + ((a * a * a - a) * y2[klo] + (b * b * b - b) * y2[khi]) * (h * h) / 6.0;
  }

  /**
   * Ungleichmaessige RR auf ein gleichmaessiges 4-Hz-Raster bringen.
   * ABWEICHUNGSNOTIZ: der Doku-Kommentar im Original sagt "Value: 1000/RR
   * (instant HR)" — der Code legt aber RR IN MILLISEKUNDEN auf die Achse. Die
   * PSD ist deshalb in ms²/Hz, wie die Rueckgabetypen es auch behaupten. Der
   * Code hat recht, der Kommentar nicht. Uebernommen ist der CODE.
   */
  function cubicSplineResampleTo4Hz(rrIntervalsMs) {
    const fs = 4.0;
    // Crash-Guard: max 5000 RR (~80 min bei 60 bpm)
    const capped = rrIntervalsMs.length > 5000 ? rrIntervalsMs.slice(0, 5000) : rrIntervalsMs;
    if (capped.length < 4) return { samples: [], fs: fs };

    const times = [], values = [];
    let cumSec = 0;
    for (const rr of capped) {
      if (!(isFinite(rr) && rr > 0)) continue;
      cumSec += rr / 1000.0;
      times.push(cumSec);
      values.push(rr);
    }
    if (!times.length || !(times[times.length - 1] > 0)) return { samples: [], fs: fs };
    const totalSec = times[times.length - 1];
    // Crash-Guard: max 8192 Samples (= 2048 s bei 4 Hz)
    const nSamples = Math.min(8192, Math.trunc(totalSec * fs));
    if (nSamples < 32) return { samples: [], fs: fs };

    const y2 = naturalCubicSplineSecondDerivs(times, values);
    const out = new Array(nSamples);
    for (let i = 0; i < nSamples; i++) out[i] = evaluateCubicSpline(i / fs, times, values, y2);
    return { samples: out, fs: fs };
  }

  function integrateBand(freqs, psd, low, high) {
    let sum = 0;
    for (let k = 1; k < freqs.length; k++) {
      const fLo = freqs[k - 1];
      const fHi = freqs[k];
      if (fHi < low || fLo > high) continue;
      // ABWEICHUNGSNOTIZ: das Original integriert den GANZEN Bin, sobald er das
      // Band beruehrt — es schneidet an der Bandgrenze nicht ab. Ein Bin an der
      // Grenze zaehlt damit voll in BEIDE Baender. Bei df = 0,0156 Hz und einem
      // LF-Band von 0,06 Hz Breite ist das kein Rundungsfehler, sondern Teil der
      // Kalibrierung. Unveraendert uebernommen.
      sum += 0.5 * (psd[k - 1] + psd[k]) * (fHi - fLo);
    }
    return sum;
  }

  /**
   * Welch-Periodogramm mit Hann-Fenster und direkter DFT.
   * ABWEICHUNGSNOTIZ: Die App fragt hier zuerst
   * `UserDefaults.bool(forKey: "rr.disable_welchpsd")` ab (Debug-Notausschalter
   * nach zwei SIGSEGV im vDSP-Pfad). Im Browser gibt es dieses Flag nicht; der
   * Vorgabewert ist false, also wird immer gerechnet — identisches Verhalten.
   */
  function welchPSD(samples, fs, bandConfig, segmentLength, overlapPct) {
    segmentLength = (segmentLength === undefined) ? 256 : segmentLength;
    overlapPct = (overlapPct === undefined) ? 0.5 : overlapPct;

    if (samples.length < segmentLength) return null;
    const maxTotal = segmentLength + Math.trunc(segmentLength * (1.0 - overlapPct)) * 200;
    const capped = samples.length > maxTotal ? samples.slice(0, maxTotal) : samples;
    for (const v of capped) if (!isFinite(v)) return null;

    const step = Math.trunc(segmentLength * (1.0 - overlapPct));
    if (!(step > 0)) return null;
    const halfN = Math.floor(segmentLength / 2);

    // Symmetrisches Hann-Fenster (== scipy). winSumSq stammt aus DEMSELBEN
    // Array, das das Signal fenstert → jede konstante Fenster-Skalierung kuerzt
    // sich in der PSD exakt heraus.
    const hann = new Array(segmentLength);
    for (let n = 0; n < segmentLength; n++) {
      hann[n] = 0.5 * (1.0 - Math.cos(2.0 * Math.PI * n / (segmentLength - 1)));
    }
    let winSumSq = 0;
    for (const w of hann) winSumSq += w * w;

    // DFT-Basis einmalig vorberechnen
    const cosT = new Array(halfN + 1), sinT = new Array(halfN + 1);
    for (let k = 0; k <= halfN; k++) {
      const w = 2.0 * Math.PI * k / segmentLength;
      const ck = new Array(segmentLength), sk = new Array(segmentLength);
      for (let n = 0; n < segmentLength; n++) { ck[n] = Math.cos(w * n); sk[n] = Math.sin(w * n); }
      cosT[k] = ck; sinT[k] = sk;
    }

    const psdAccum = new Array(halfN + 1).fill(0);
    let segCount = 0;
    let segStart = 0;
    const segment = new Array(segmentLength);
    while (segStart + segmentLength <= capped.length) {
      let sum = 0;
      for (let i = 0; i < segmentLength; i++) { segment[i] = capped[segStart + i]; sum += segment[i]; }
      const mean = sum / segmentLength;
      for (let i = 0; i < segmentLength; i++) segment[i] = (segment[i] - mean) * hann[i];
      for (let k = 0; k <= halfN; k++) {
        let re = 0, im = 0;
        const ck = cosT[k], sk = sinT[k];
        for (let n = 0; n < segmentLength; n++) { re += segment[n] * ck[n]; im -= segment[n] * sk[n]; }
        psdAccum[k] += re * re + im * im;
      }
      segCount += 1;
      segStart += step;
    }
    if (!(segCount > 0)) return null;

    // Einseitige Welch-PSD (Parseval-korrekt, == scipy scaling='density'):
    //   PSD[k] = |X[k]|² / (segCount · fs · Σw²), ×2 fuer k zwischen 0 und Nyquist
    const scale = 1.0 / (segCount * fs * winSumSq);
    const freqs = new Array(halfN + 1);
    const psd = new Array(halfN + 1);
    for (let k = 0; k <= halfN; k++) {
      freqs[k] = k * fs / segmentLength;
      const factor = (k === 0 || k === halfN) ? 1.0 : 2.0;
      psd[k] = psdAccum[k] * scale * factor;
    }

    const lfPow = integrateBand(freqs, psd, bandConfig.vlfHi, bandConfig.lfHi);
    const hfPow = integrateBand(freqs, psd, bandConfig.lfHi, bandConfig.hfHi);
    const totalPow = integrateBand(freqs, psd, 0, bandConfig.hfHi);
    const ratio = hfPow > 0 ? lfPow / hfPow : 0;

    return {
      frequencyHz: freqs,
      powerDensity: psd,
      lfPowerMs2: lfPow,
      hfPowerMs2: hfPow,
      lfHfRatio: ratio,
      totalPowerMs2: totalPow,
      bandConfig: bandConfig,
      methodology: 'Welch periodogram, Hann ' + segmentLength + 'pt, ' + Math.trunc(overlapPct * 100)
                 + '% overlap, ' + segCount + ' segs, fs=' + fs + 'Hz, bands=' + bandConfig.label
                 + ' [' + bandConfig.citation + ']',
    };
  }

  /* ═══════════════════════════════════════════════════════════════════════
     12 · TINN  (EquineHRVAnalyzer.computeTINN, Task Force 1996)
     ───────────────────────────────────────────────────────────────────────
     Binbreite 7,8125 ms (= 1/128 s, historischer Holter-Standard).
     Nyerges-Bohák 2025: sEA 209±72 ms vs. gesund 398±105 ms.
     ═══════════════════════════════════════════════════════════════════════ */

  function computeTINN(rrMs, binWidthMs) {
    binWidthMs = (binWidthMs === undefined) ? 7.8125 : binWidthMs;
    if (rrMs.length < 50) return null;
    const sorted = rrMs.slice().sort((a, b) => a - b);
    const minRR = sorted[0], maxRR = sorted[sorted.length - 1];
    if (!(maxRR > minRR)) return null;

    const nBins = Math.trunc(Math.ceil((maxRR - minRR) / binWidthMs)) + 1;
    if (nBins < 4) return null;

    const counts = new Array(nBins).fill(0);
    for (const rr of rrMs) {
      const idx = Math.min(nBins - 1, Math.max(0, Math.trunc((rr - minRR) / binWidthMs)));
      counts[idx] += 1;
    }

    let peakIdx = 0;
    for (let i = 1; i < nBins; i++) if (counts[i] > counts[peakIdx]) peakIdx = i;
    const peakCount = counts[peakIdx];
    const peakX = minRR + (peakIdx + 0.5) * binWidthMs;

    // Bin-Mitten einmal vorberechnen (identische Arithmetik, nur nicht im Kern)
    const binCenter = new Array(nBins);
    for (let k = 0; k < nBins; k++) binCenter[k] = minRR + (k + 0.5) * binWidthMs;

    let bestTINN = binWidthMs;
    let bestSSE = Infinity;

    for (let nIdx = 0; nIdx <= peakIdx; nIdx++) {
      const N = binCenter[nIdx];
      for (let xIdx = peakIdx; xIdx < nBins; xIdx++) {
        const X = binCenter[xIdx];
        if (X <= N) continue;
        let sse = 0;
        for (let k = 0; k < nBins; k++) {
          const bc = binCenter[k];
          let tri = 0;
          if (bc >= N && bc <= peakX) tri = peakCount * (bc - N) / Math.max(peakX - N, 1e-9);
          else if (bc > peakX && bc <= X) tri = peakCount * (X - bc) / Math.max(X - peakX, 1e-9);
          const diff = counts[k] - tri;
          sse += diff * diff;
        }
        if (sse < bestSSE) { bestSSE = sse; bestTINN = X - N; }
      }
    }
    return bestTINN;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     13 · Sample Entropy  (Richman & Moorman 2000, m=2, r=0.2×SD)
     ───────────────────────────────────────────────────────────────────────
     O(n²)-Deckel bei 3000 Schlaegen (Export-Freeze-Fix): SampEn ist ab
     ~1000-5000 Schlaegen statistisch gesaettigt, gerechnet wird auf dem
     JUENGSTEN Fenster (zusammenhaengend → Temporalstruktur bleibt erhalten).
     A = 0 heisst: kein Template-Paar bleibt bei m+1 in der Toleranz. SampEn ist
     dort NICHT DEFINIERT — es wird kein Ersatzwert erfunden, sondern null
     zurueckgegeben.
     ═══════════════════════════════════════════════════════════════════════ */

  function computeSampleEntropy(rrInput, m, rFactor, maxN) {
    m = (m === undefined) ? 2 : m;
    rFactor = (rFactor === undefined) ? 0.2 : rFactor;
    maxN = (maxN === undefined) ? 3000 : maxN;

    const rrMs = rrInput.length > maxN ? rrInput.slice(rrInput.length - maxN) : rrInput;
    const n = rrMs.length;
    if (n < 2 * m + 1) return null;

    let sum = 0;
    for (const v of rrMs) sum += v;
    const mean = sum / n;
    let sumSq = 0;
    for (const v of rrMs) sumSq += (v - mean) * (v - mean);
    const sd = Math.sqrt(sumSq / (n - 1));
    if (!(sd > 0)) return null;
    const r = rFactor * sd;

    function countMatches(dim) {
      const nLocal = n - dim + 1;
      if (!(nLocal > 1)) return 0;
      let count = 0;
      for (let i = 0; i < nLocal - 1; i++) {
        for (let j = i + 1; j < nLocal; j++) {
          let maxDiff = 0;
          for (let k = 0; k < dim; k++) {
            const diff = Math.abs(rrMs[i + k] - rrMs[j + k]);
            if (diff > maxDiff) maxDiff = diff;
            if (maxDiff > r) break;
          }
          if (maxDiff <= r) count += 1;
        }
      }
      return count;
    }

    const a = countMatches(m + 1);
    const b = countMatches(m);
    if (!(b > 0)) return null;
    if (!(a > 0)) return null;
    return -Math.log(a / b);
  }

  /* ═══════════════════════════════════════════════════════════════════════
     14 · Deceleration Capacity (Bauer 2006) — Beigabe, nicht im Screener
     ═══════════════════════════════════════════════════════════════════════ */

  function computeDecelerationCapacity(rrMs) {
    if (rrMs.length < 4) return null;
    let dcSum = 0, anchorCount = 0;
    for (let l = 2; l < rrMs.length - 1; l++) {
      if (!(rrMs[l] > rrMs[l - 1])) continue;
      dcSum += (rrMs[l + 1] + rrMs[l] - rrMs[l - 1] - rrMs[l - 2]) / 4.0;
      anchorCount += 1;
    }
    if (!(anchorCount > 0)) return null;
    return dcSum / anchorCount;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     15 · DIE KETTE — EquineHRVAnalyzer.analyze()
     ───────────────────────────────────────────────────────────────────────
     DIE ZWEI RIEGEL (EquineHRVAnalyzer.swift Z. 224-226) — der eigentliche
     Grund, warum diese Datei existiert:

       · Artefaktrate >= 10 %  →  analyze() gibt GAR NICHTS zurueck (null).
         Dieselbe Grenze, an der die Live-Schicht "HRV pausiert" anzeigt.
         Sie ist eine konservative EIGENE Festlegung, kein Literaturwert.

       · Artefaktrate >= 5 %   →  KEIN DFA-alpha1, KEIN TINN, KEINE
         Sample-Entropie (Task Force ESC 1996). Diese drei werten genau die
         Feinstruktur aus, die die Korrektur glaettet — sie reagieren auf
         ersetzte Schlaege weit empfindlicher als Mittelwertsmasse.

     Wer diese Riegel weglaesst, bekommt Zahlen, wo die App bewusst schweigt.
     Genau das war der gefaehrlichste der gemessenen Kipper: die App sagt "kann
     ich nicht beurteilen", das Cockpit sagte "hoher Verdacht".

     Weitere Schranken der App, ebenfalls uebernommen:
       cleanRR < 30 Schlaege → null · PSD erst ab 60 Schlaegen und 64 Samples
       DFA erst ab 100 Schlaegen · SampEn erst ab 200 Schlaegen
       TINN erst ab 50 Schlaegen (in computeTINN)
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Die App-Vorstufe auf einer rohen RR-Reihe (ms).
   *
   * @param {number[]} rrIntervalsMs  rohe RR-Intervalle in Millisekunden
   * @param {object}  [opts]
   * @param {boolean} [opts.liveMode=false]      wie in der App: ueberspringt PSD, DFA, TINN, SampEn
   * @param {boolean} [opts.skipWelchPSD=false]  nur die PSD ueberspringen
   * @returns {object|null}  null = die App wuerde hier KEIN Ergebnis liefern
   *   (zu kurz oder Artefaktrate >= 10 %). Sonst ein Objekt mit den Kennzahlen;
   *   einzelne Felder sind null, wenn der jeweilige Riegel greift.
   */
  function analysiere(rrIntervalsMs, opts) {
    opts = opts || {};
    const liveMode = !!opts.liveMode;
    const skipWelchPSD = !!opts.skipWelchPSD;

    // Stage 0: Filterkette (useEquineSpecificFilters = true, der App-Standard)
    const pipeline = pipelineProcess(rrIntervalsMs);

    if (pipeline.cleanRR.length < 30) {
      return null;   // App: guard pipeline.cleanRR.count >= 30 else { return nil }
    }

    // ── ARTEFAKT-RIEGEL 1 ─────────────────────────────────────────────────
    const artefaktRate = pipeline.artifactRatePct;
    if (!(artefaktRate < 10.0)) {
      return null;   // App: guard artefaktRate < 10.0 else { return nil }
    }
    // ── ARTEFAKT-RIEGEL 2 ─────────────────────────────────────────────────
    const nichtlineareBelastbar = artefaktRate < 5.0;

    const corrected = pipeline.cleanRR;

    // Stage 3: Zeitbereich
    const rmssd = computeRMSSD(corrected);
    const sdnn = computeSDNN(corrected);
    const pnn50 = computePNN50(corrected);

    // Stage 4: Poincaré.
    // SD2 ueber die BRENNAN-IDENTITAET SD2² = 2·SDNN² − 0,5·RMSSD² — NICHT ueber
    // die direkte Summen-Varianz der gedrehten Punktwolke. Beide Wege sind
    // mathematisch fast, aber nicht ganz identisch (die direkte Form zieht die
    // mittlere Differenz ab); auf denselben Daten unterscheiden sie sich um
    // rund 0,6 %. Der Screener ist auf die Brennan-Form kalibriert.
    const sd1 = rmssd / Math.sqrt(2.0);
    const sd2Squared = 2 * sdnn * sdnn - 0.5 * rmssd * rmssd;
    const sd2 = sd2Squared > 0 ? Math.sqrt(sd2Squared) : 0;
    const sd2sd1Ratio = sd2 > 0 ? sd2 / sd1 : 0;   // SD2/SD1, nicht umgekehrt (Wonghanchao)

    // Stage 5: Herzfrequenz
    let rrSum = 0;
    for (const v of corrected) rrSum += v;
    const meanRR = rrSum / corrected.length;
    const meanHR = 60000.0 / Math.max(meanRR, 1);

    // Stage 6: Deceleration Capacity
    const dc = computeDecelerationCapacity(corrected);

    // Stage 7.5: Frequenzbereich (Welch, equine Baender)
    let lfHfRatio = null, totalPowerMs2 = null, lfPowerMs2 = null, hfPowerMs2 = null;
    let vlfPowerMs2 = null, lfNuPct = null, hfNuPct = null, psdMethodology = null;
    if (!(liveMode || skipWelchPSD) && corrected.length >= 60) {
      const resampled = cubicSplineResampleTo4Hz(corrected);
      if (resampled.samples.length >= 64) {
        const psd = welchPSD(resampled.samples, resampled.fs, BandConfigEquine);
        if (psd) {
          const lfHf = psd.lfPowerMs2 + psd.hfPowerMs2;
          lfPowerMs2 = psd.lfPowerMs2;
          hfPowerMs2 = psd.hfPowerMs2;
          totalPowerMs2 = psd.totalPowerMs2;
          lfHfRatio = psd.lfHfRatio;
          vlfPowerMs2 = Math.max(0, psd.totalPowerMs2 - psd.lfPowerMs2 - psd.hfPowerMs2);
          lfNuPct = lfHf > 0 ? (psd.lfPowerMs2 / lfHf) * 100 : 0;
          hfNuPct = lfHf > 0 ? (psd.hfPowerMs2 / lfHf) * 100 : 0;
          psdMethodology = psd.methodology;
        }
      }
    }

    // Stage 8: DFA-alpha1 — Riegel 2
    let dfaAlpha1 = null;
    if (nichtlineareBelastbar && corrected.length >= 100) {
      // Live + n > 500 rechnet die App auf den LETZTEN 500 Schlaegen (bounded
      // O(500²)); die Vollsession bleibt der Final-Analyse vorbehalten.
      const dfaInput = (liveMode && corrected.length > 500) ? corrected.slice(corrected.length - 500) : corrected;
      dfaAlpha1 = computeDFAAlpha1(dfaInput);
    }

    // Stage 9a: TINN + SampEn — Riegel 2
    const tinnMs = (liveMode || !nichtlineareBelastbar) ? null : computeTINN(corrected);
    const sampleEntropy = (liveMode || !nichtlineareBelastbar || corrected.length < 200)
      ? null
      : computeSampleEntropy(corrected, 2, 0.2);

    return {
      // ── die neun Werte, die der Asthma-Screener liest ──────────────────
      meanHrBpm: meanHR,
      sdnnMs: sdnn,
      rmssdMs: rmssd,
      sd1Ms: sd1,
      sd2Ms: sd2,
      lfHfRatio: lfHfRatio,
      dfaAlpha1: dfaAlpha1,
      tinnMs: tinnMs,
      sampleEntropy: sampleEntropy,
      // ── die zwei weiteren, die derselbe Screener zusaetzlich braucht ───
      pnn50Pct: pnn50,
      totalPowerMs2: totalPowerMs2,
      beatCount: corrected.length,
      durationSec: rrSum / 1000.0,
      // ── Kontext ───────────────────────────────────────────────────────
      sd2sd1Ratio: sd2sd1Ratio,
      decelCapacityMs: dc,
      vlfPowerMs2: vlfPowerMs2,
      lfPowerMs2: lfPowerMs2,
      hfPowerMs2: hfPowerMs2,
      lfNuPct: lfNuPct,
      hfNuPct: hfNuPct,
      // ── Vorstufen-Zustand: WARUM ein Wert fehlt ────────────────────────
      artefaktRatePct: artefaktRate,
      nichtlineareBelastbar: nichtlineareBelastbar,
      avBlockCount: pipeline.avBlockIndices.length,
      ectopicBeatCount: pipeline.ectopicIndices.length,
      motionArtifactCount: pipeline.motionArtifactIndices.length,
      tWaveMergeCount: pipeline.tWaveMergedCount,
      qualityClass: pipeline.qualityClass,
      pipelineQuality: pipeline.qualityLabel,
      correctedRR: corrected,
      beatAnnotations: pipeline.annotations,
      motionBursts: pipeline.motionBursts,
      methodologyFlags: pipeline.methodology.concat([
        'equine_strong_filter_50ms',
        'equine_frequency_bands_visser_2002_stucke_2015',
        'av_block_detection_equine_specific',
        'sd2_sd1_ratio_inverted_per_equine_convention',
        'dc_bauer_2006',
        'dfa_alpha1_n_gte_250_required',
        'welch_psd_hann_256pt_50pct_overlap_4hz_resampled',
      ]),
      psdMethodology: psdMethodology,
    };
  }

  /**
   * Warum die App bei dieser Reihe schweigen wuerde — fuer eine ehrliche
   * Anzeige im Cockpit ("kann nicht beurteilt werden, weil …") statt einer
   * leeren Kachel.
   */
  function abbruchGrund(rrIntervalsMs) {
    const p = pipelineProcess(rrIntervalsMs);
    if (p.cleanRR.length < 30) return 'zu wenige auswertbare Schlaege (' + p.cleanRR.length + ' < 30)';
    if (!(p.artifactRatePct < 10.0)) {
      return 'Artefaktrate ' + p.artifactRatePct.toFixed(1) + ' % — ab 10 % gibt die App kein Ergebnis aus';
    }
    return null;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     16 · Export
     ═══════════════════════════════════════════════════════════════════════ */

  const HRVVorstufe = {
    // Haupteinstieg
    analysiere: analysiere,
    abbruchGrund: abbruchGrund,
    // Filterkette einzeln (fuer Charts / Beat-Annotationen)
    pipeline: {
      process: pipelineProcess,
      stage1TWaveRefractoryFilter: stage1TWaveRefractoryFilter,
      stage2LipponenTarvainenClassification: stage2LipponenTarvainenClassification,
      stage3EquineAVBlockReclassification: stage3EquineAVBlockReclassification,
      stage4CubicSplineCorrection: stage4CubicSplineCorrection,
      computeQualityClass: computeQualityClass,
      detectMotionBursts: detectMotionBursts,
      equineCorrectionThresholds: equineCorrectionThresholds,
    },
    // Kennzahlen einzeln
    metrics: {
      computeRMSSD: computeRMSSD,
      computeSDNN: computeSDNN,
      computePNN50: computePNN50,
      computeDFA: computeDFA,
      computeDFAAlpha1: computeDFAAlpha1,
      computeTINN: computeTINN,
      computeSampleEntropy: computeSampleEntropy,
      computeDecelerationCapacity: computeDecelerationCapacity,
      cubicSplineResampleTo4Hz: cubicSplineResampleTo4Hz,
      welchPSD: welchPSD,
      computeMedian: computeMedian,
      computeQuartileDeviation: computeQuartileDeviation,
    },
    // Konstanten
    EquineRRPlausibility: EquineRRPlausibility,
    BeatAnnotation: BeatAnnotation,
    BeatClass: BeatClass,
    QualityClass: QualityClass,
    BandConfig: { equine: BandConfigEquine, human: BandConfigHuman },
    VERSION: '1.0.0 (Port-Stand Repo 2026-08-08)',
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = HRVVorstufe;
  global.HRVVorstufe = HRVVorstufe;
})(typeof globalThis !== 'undefined' ? globalThis : this);
