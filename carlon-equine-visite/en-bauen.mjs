/* DIE ENGLISCHE VISITE-SEITE WIRD GEBAUT, NICHT GEPFLEGT
   ═══════════════════════════════════════════════════════════════════════
   WARUM ES DIESEN BAU GIBT (12.08.2026):

   Zwei handgepflegte Sprachfassungen sind zwei Wahrheiten. Genau daran ist
   in diesem Projekt schon einmal etwas auseinandergelaufen: ein Claim stand
   doppelt, wurde einmal geheilt — und die englische Fassung behauptete
   danach weiter, was die deutsche nicht mehr behauptete.

   Deshalb ist en/index.html KEINE Kopie, sondern ein Erzeugnis. Der Bau
   liest die deutsche Seite, ersetzt Block fuer Block und schreibt das
   Ergebnis. Aendert jemand einen deutschen Absatz, findet der zugehoerige
   Block hier nicht mehr statt — und der Bau BRICHT AB, mit Angabe der
   Stelle. Stille Drift ist damit ausgeschlossen; man muss die Uebersetzung
   nachziehen, oder es gibt keine englische Seite.

   Aufruf:  node en-bauen.mjs
   Geprueft von: t-englisch.mjs (Struktur-Gleichstand, Rechtsverweise)     */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = dirname(fileURLToPath(import.meta.url));
let s = readFileSync(join(HIER, 'index.html'), 'utf8');

let ersetzt = 0;
const fehlend = [];
/* Genau EINMAL ersetzen. Zwei Treffer heissen: der Block ist nicht
   eindeutig, dann ist die Uebersetzung an einer der Stellen falsch. */
const tausche = (de, en, n = 1) => {
  const treffer = s.split(de).length - 1;
  if (treffer !== n) { fehlend.push({ de: de.slice(0, 70), erwartet: n, gefunden: treffer }); return; }
  s = s.split(de).join(en); ersetzt++;
};

/* ── KOPF: Sprache, Titel, Sozialkarte, hreflang ───────────────────────
   og:locale muss mitwandern — sonst zeigt jede geteilte englische Adresse
   eine deutsche Vorschau. Genau das hat ein Aussenpruefer bemaengelt. */
tausche('<html lang="de">', '<html lang="en">');
tausche('<title>CARLON Equine Visite — die Praxis-Ansicht für Tierärzte &amp; Kliniken</title>',
        '<title>CARLON Equine Visite — the practice view for equine vets &amp; clinics</title>');
tausche('content="CARLON Equine Visite — die browser-lokale Praxis-Ansicht für Tierärzte & Kliniken. Der Halter misst mit der CARLON Equine App, du liest den Verlauf: Triage nach Dringlichkeit, Abfahrroute, Befund-PDF. Auswertung im Browser, kein Konto, verschlüsselt unterwegs."',
        'content="CARLON Equine Visite — the browser-local practice view for equine vets and clinics. The owner records with the CARLON Equine app, you read the trend: triage by urgency, route planning, findings PDF. Analysed in the browser, no account, encrypted in transit."');
tausche('<meta property="og:title" content="CARLON Equine – für Tierärzte & Kliniken">',
        '<meta property="og:title" content="CARLON Equine – for equine vets &amp; clinics">');
tausche('<meta property="og:description" content="Betreuung, die nicht an der Stalltür endet. Der Halter misst, du liest den Verlauf, das Pferd wird früher erreicht — browser-lokal, Auswertung im Browser, nicht in der Cloud.">',
        '<meta property="og:description" content="Care that does not stop at the stable door. The owner records, you read the trend, the horse is reached earlier — browser-local, analysed in the browser, not in the cloud.">');
tausche('<meta property="og:url" content="https://vitalkultur.com/carlon-equine-visite/">',
        '<meta property="og:url" content="https://vitalkultur.com/carlon-equine-visite/en/">');
tausche('<meta property="og:locale" content="de_DE">\n<meta property="og:locale:alternate" content="en_US">',
        '<meta property="og:locale" content="en_US">\n<meta property="og:locale:alternate" content="de_DE">');

/* hreflang und canonical — ohne sie existiert die englische Fassung fuer
   Suchmaschinen nicht, egal wie gut sie uebersetzt ist. x-default zeigt
   auf die deutsche Seite: sie ist die Heimatfassung. */
const HREF_EN = `<link rel="canonical" href="https://vitalkultur.com/carlon-equine-visite/en/">
<link rel="alternate" hreflang="de" href="https://vitalkultur.com/carlon-equine-visite/">
<link rel="alternate" hreflang="en" href="https://vitalkultur.com/carlon-equine-visite/en/">
<link rel="alternate" hreflang="x-default" href="https://vitalkultur.com/carlon-equine-visite/">`;
tausche('<meta name="twitter:card" content="summary_large_image">',
        HREF_EN + '\n<meta name="twitter:card" content="summary_large_image">');

/* ── Verweise: relative Pfade liegen eine Ebene tiefer ─────────────────
   Die englische Seite liegt in en/ — jeder relative Bildpfad muss hoch. */
s = s.split('src="assets/').join('src="../assets/');
s = s.split('url("assets/').join('url("../assets/');

/* ── RECHTSTEXTE: pro Sprache, nicht pro Marke ─────────────────────────
   Eine englische Verkaufsseite, die auf die deutsche AGB verweist, laesst
   den Leser gegen etwas zustimmen, das er nicht lesen kann. Es gibt
   terms.html und privacy-en.html — sie werden hier verdrahtet.
   Das Impressum bleibt deutsch: es ist eine deutsche Rechtspflicht. */
/* Der AGB-Verweis im Tarifkasten steckt im Rumpftext-Block und wird dort
   mituebersetzt. Hier bleibt nur der Verweis im Anmeldeformular. */
tausche('href="/privacy.html">Datenschutzerklärung</a> ·', 'href="/privacy-en.html">Privacy Policy</a> ·');
tausche('<a href="/privacy.html" data-en="Privacy" data-de="Datenschutz">Datenschutz</a>',
        '<a href="/privacy-en.html">Privacy</a>');
tausche('<a href="/agb.html#visite">AGB</a>', '<a href="/terms.html#visite">Terms</a>');
tausche('<a href="/impressum.html">Impressum</a>', '<a href="/impressum.html">Legal notice</a>');

/* ── Sprachwahl sichtbar machen ────────────────────────────────────────
   Ein Leser, der auf der falschen Fassung landet, muss ohne Adresszeile
   herueberkommen. Der Link traegt hreflang, damit auch Maschinen ihn
   als Sprachwechsel lesen. */
tausche('<a class="nav-equine" href="/carlon-equine/" data-en="&lsaquo; Equine App" data-de="&lsaquo; Equine App">&lsaquo; Equine App</a>',
        '<a class="nav-equine" href="/carlon-equine-visite/" hreflang="de" lang="de">Deutsch</a>\n      <a class="nav-equine" href="/carlon-equine/">&lsaquo; Equine App</a>');

/* ── Der Sprachschalter der Seite darf hier nicht dazwischenfunken ─────
   applyLang() liest den gemeinsamen Speicher-Schluessel. Auf der
   englischen Seite wuerde ein deutscher Merker die Seite zurueckdrehen. */
tausche("window.CARLON_LANG = localStorage.getItem('carlon.viewer.lang') || 'de';",
        "window.CARLON_LANG = 'en';   // feste Sprache dieser Adresse, kein Speicher-Merker");

/* ══════════════════════════════════════════════════════════════════════
   INHALT
   ══════════════════════════════════════════════════════════════════════ */

// Kopfbereich
tausche('CARLON Equine Visite · Praxisansicht für mobile Pferdetierärzte und Kliniken',
        'CARLON Equine Visite · practice view for ambulatory equine vets and clinics');
tausche('Sehen Sie früher, welches Pferd Sie wirklich braucht.',
        'See sooner which horse actually needs you.');
tausche(`Die Halterin misst den Herzrhythmus zu Hause im Stall und schickt Ihnen die Aufnahme
      verschlüsselt. Sie öffnen den Befund im Browser — mit Verlauf, Signalgüte und der
      Abweichung von der individuellen Baseline dieses Pferds.
      <strong>Ohne Konto, ohne Installation, ohne dass die Daten Ihre Praxis verlassen.</strong>`,
`The owner records the heart rhythm at home in the stable and sends you the recording
      encrypted. You open the findings in your browser — with the trend, the signal quality and
      the deviation from this horse's own baseline.
      <strong>No account, no installation, and the data never leaves your practice.</strong>`);
tausche('Cockpit mit 15&nbsp;Demo-Pferden öffnen →', 'Open the cockpit with 15&nbsp;demo horses →', 2);
tausche('>Was es kostet<', '>What it costs<');
tausche('Kein Konto, keine Anmeldung, kein Download. Das Demo-Cockpit ist die vollständige Anwendung mit echten Beispielverläufen.',
        'No account, no sign-up, no download. The demo cockpit is the complete application with real example trends.');
tausche(`<strong>790&nbsp;€ im Jahr</strong> je Praxis oder Standort — oder 79&nbsp;€ monatlich,
      jeweils zzgl. USt. Alle Tierärztinnen und Tierärzte, alle Pferde, alle Geräte.
      Kein Aufpreis je Pferd, keine Sitzplatzgebühr.
      <a href="#preis">Was genau enthalten ist →</a>`,
`<strong>€790 per year</strong> per practice or site — or €79 monthly, plus VAT.
      All vets, all horses, all devices. No per-horse surcharge, no seat fee.
      <a href="#preis">What exactly is included →</a>`);

// Abschnitt 1 — Messbedingung
tausche('Der Unterschied, der vor der Messung entsteht', 'The difference that arises before the measurement');
tausche('Ein Pferd, das gerade transportiert wurde, misst nicht sich selbst.',
        'A horse that has just been transported is not measuring itself.');
tausche('Gewohnte Box statt Untersuchungsraum', 'Its own box, not an examination room');
tausche('Sie bekommen die Aufnahme, nicht den Termin', 'You get the recording, not the appointment');
tausche('Wiederholbar, ohne dass jemand fährt', 'Repeatable without anyone driving out');

// Abschnitt 2 — Cockpit
tausche('Was im Cockpit steht', 'What the cockpit shows');
tausche('Ein Blick, dann die Tiefe.', 'One glance, then the depth.');
tausche(`Oben das Urteil und der eine Grund dafür. Darunter alles, was Sie
       zum Nachrechnen brauchen — nichts davon versteckt.`,
`The assessment at the top and the one reason for it. Below it everything you
       need to check the maths — none of it hidden.`);
tausche('<div class="f-k">Triage</div>', '<div class="f-k">Triage</div>');
tausche('Vier Stufen, und daneben steht, welcher Wert sie ausgelöst hat.',
        'Four levels, and next to each the value that triggered it.');
tausche('<div class="f-k">Die Akte</div>', '<div class="f-k">The record</div>');
tausche('Alles, was Sie zum Nachrechnen brauchen — an einer Stelle.',
        'Everything you need to check the maths — in one place.');
tausche('Einordnung mit Begründung', 'A classification with its reason');
tausche('Signalgüte, bevor Sie deuten', 'Signal quality before interpretation');
tausche('Atemwegs-Screening im Verlauf', 'Airway screening over time');
tausche('Die üblichen Ansichten, in guter Auflösung', 'The familiar views, at proper resolution');
tausche('Befund und Abrechnung an einer Stelle', 'Findings and billing in one place');
tausche('Export ohne Sackgasse', 'Export without a dead end');

// Abschnitt 3 — Wissenschaft
tausche('Warum die Zahlen tragen', 'Why the numbers hold', 2);   // Kommentar + Text
tausche('Beim Pferd sind Pausen normal. Wer sie mitrechnet, misst Unsinn.',
        'In horses, pauses are normal. Count them in and you measure nonsense.');
tausche('Dieselbe Filterkette wie in der App, nicht eine nachgebaute',
        'The same filter chain as in the app, not a rebuilt one');
tausche('Was das ausmacht — an zwanzig Ruheaufnahmen geprüft',
        'What difference it makes — tested on twenty resting recordings');
tausche('Und dort, wo es nicht reicht, sagt es das', 'And where it is not enough, it says so');

// Abschnitt 4 — Verlauf
tausche('Was eine Momentaufnahme nicht kann', 'What a snapshot cannot do');
tausche('Die Richtung ist die Information.', 'The direction is the information.');
tausche('Über Wochen statt über Minuten', 'Over weeks rather than minutes');
tausche('Nach einer Umstellung sichtbar', 'Visible after a change');

// Abschnitt 5 — Anschluss
tausche('>Anschluss<', '>Interoperability<');
tausche('Der Befund bleibt nicht in unserem Fenster stehen.',
        'The findings do not stay inside our window.');

// Abschnitt 6 — Arbeitstag
tausche('>Ihr Arbeitstag<', '>Your working day<');
tausche('Zwischen zwei Terminen liegt Ihr Fahrweg.', 'Between two appointments lies your drive.');
/* (weiter unten im Rumpftext uebersetzt — hier waere es doppelt) */
tausche('<div class="f-k">Tagesplan</div>', '<div class="f-k">Day plan</div>');
tausche('Der Tag sortiert sich nach Dringlichkeit, nicht nach der Reihenfolge der Anrufe.',
        'The day sorts itself by urgency, not by the order the calls came in.');
tausche('Karte &amp; Route — die Abfahrfolge, direkt an Google&nbsp;Maps übergeben, statt Adressen abzutippen.',
        'Map &amp; route — the departure order, handed straight to Google&nbsp;Maps instead of retyping addresses.');
tausche('Kompakt — der ganze Tag auf einer Zeitachse, wenn es schnell gehen muss.',
        'Compact — the whole day on one timeline, when it has to be quick.');
tausche('Verwaltung — Fahrtenbuch, Zeiterfassung, abgerechnete Ferneinschätzungen, als CSV heraus.',
        'Administration — mileage log, time tracking, billed remote assessments, exported as CSV.');

// Abschnitt 7 — Grenzen
tausche('Grenzen, die wir selbst ziehen', 'Limits we draw ourselves');
tausche('Was CARLON bewusst nicht tut.', 'What CARLON deliberately does not do.');
tausche('Keine Diagnose', 'No diagnosis');
tausche('Keine Behandlungsempfehlung', 'No treatment recommendation');
tausche('Keine Datenbank bei uns', 'No database at our end');
tausche('Kein Notfallweg', 'Not an emergency channel');

// Abschnitt 8 — Preis
tausche('Ein Preis, eine Praxis', 'One price, one practice');
tausche('Kein Staffelmodell, keine Verhandlung.', 'No tiers, no negotiation.');
tausche('<b>790&nbsp;€</b> <span>pro Jahr, zzgl. USt</span>', '<b>€790</b> <span>per year, plus VAT</span>');
tausche('oder 79&nbsp;€ monatlich · das Jahresabo entspricht 65,83&nbsp;€ im Monat',
        'or €79 monthly · the annual plan works out at €65.83 per month');
tausche('Unbegrenzt Pferde, Aufnahmen und Verläufe', 'Unlimited horses, recordings and trends');
tausche('Alle Mitarbeitenden, alle Geräte des Betriebs', 'All staff, all devices of the business');
tausche('Befundbericht mit eigenem Briefkopf', 'Findings report on your own letterhead');
tausche('Export als JSON, CSV, Kubios und FHIR&nbsp;R5', 'Export as JSON, CSV, Kubios and FHIR&nbsp;R5');
tausche('Monatlich kündbar zum Ende der Abrechnungsperiode', 'Cancellable monthly, effective at the end of the billing period');

// Abschnitt 9 — Demo
tausche('Bevor Sie irgendetwas entscheiden', 'Before you decide anything');
tausche('Fünfzehn Demo-Pferde. Echte Verläufe. Kein Konto.',
        'Fifteen demo horses. Real trends. No account.');
tausche('Läuft im Browser. Nichts wird installiert, nichts übertragen, nichts angelegt.',
        'Runs in the browser. Nothing installed, nothing transmitted, nothing created.');

// Formular
tausche('Als Beta-Praxis mitmachen', 'Join as a beta practice');
tausche(`Wer in der Beta mitgestaltet, behält seinen Preis als
         Gründungspartner. Wir melden uns persönlich zurück — meist am selben Tag.`,
`Take part in the beta and you keep your founding-partner price. We reply
         personally — usually the same day.`);
tausche('> Ich bin mobil unterwegs<', '> I work ambulatory<');
tausche('> Wir sind eine Klinik<', '> We are a clinic<');
tausche('<label>Name<input', '<label>Name<input');
tausche('<label>Praxis oder Klinik<input', '<label>Practice or clinic<input');
tausche('<label>E-Mail<input', '<label>Email<input');
tausche('<label>Telefon <span>(falls Ihnen ein Anruf lieber ist)</span>', '<label>Phone <span>(if you would rather be called)</span>');
tausche('<label>Region<input', '<label>Region<input');
tausche('placeholder="z.&nbsp;B. Ortenau, Oberbayern, Münsterland"', 'placeholder="e.g. Ortenau, Bavaria, Münsterland"');
tausche('<label>Etwa wie viele Pferde betreuen Sie?<input', '<label>Roughly how many horses do you look after?<input');
tausche('placeholder="z.&nbsp;B. 180"', 'placeholder="e.g. 180"');
tausche('Was möchten Sie zuerst wissen? <span>(freiwillig)</span>', 'What would you like to know first? <span>(optional)</span>');
tausche('placeholder="Eine Frage, ein Zweifel, ein Wunsch — was auch immer zuerst kommt."',
        'placeholder="A question, a doubt, a wish — whatever comes first."');
tausche('<label>Bitte freilassen<input', '<label>Please leave empty<input');
tausche('Anmeldung absenden →', 'Send registration →');
tausche('Wird gesendet …', 'Sending …');
tausche('Angekommen. Wir melden uns bei Ihnen — meist am selben Tag.',
        'Received. We will get back to you — usually the same day.');
tausche(`Das hat gerade nicht geklappt. Schreiben Sie uns bitte direkt an `,
        `That did not work just now. Please write to us directly at `);
tausche(' — wir antworten genauso schnell.', ' — we answer just as quickly.');

// FAQ
tausche('Häufige Fragen', 'Frequently asked');
tausche('Was Tierärzte uns zuerst fragen.', 'What vets ask us first.');
tausche('Ersetzt CARLON eine Untersuchung?', 'Does CARLON replace an examination?');
tausche('Was braucht die Halterin?', 'What does the owner need?');
tausche('Was passiert nach einer Kündigung?', 'What happens after cancellation?');
tausche('Brauche ich einen Auftragsverarbeitungsvertrag?', 'Do I need a data processing agreement?');

// Fuss
tausche('Für Tierärzte &amp; Kliniken · Teil von CARLON Equine',
        'For equine vets &amp; clinics · part of CARLON Equine');
tausche('Made in Iffezheim · Deutschland', 'Made in Iffezheim · Germany', 2);   // data-de + Text
tausche('CARLON Equine (die App)', 'CARLON Equine (the app)', 2);   // data-de + Text
tausche('Therapie &amp; Forschung', 'Therapy &amp; research', 2);   // data-de + Text



/* ── RUMPFTEXT ────────────────────────────────────────────────────────
   Wortgenau aus der deutschen Seite gezogen, nicht abgetippt. Aendert
   sich dort ein Zeichen, findet der Block hier nicht mehr statt und der
   Bau bricht ab — genau so soll es sein. */
tausche(`
      Herzfrequenzvariabilität ist ein Maß für Erholung. Verladen, Fahrt, fremde Halle,
      fremde Menschen — all das verändert genau die Größe, die Sie beurteilen wollen.
      Die Auswertung, die wir einsetzen, verlangt ausdrücklich <strong>mindestens sieben
      Minuten Ruhe in gewohnter Umgebung</strong>. Eine Messung nach der Ankunft in der
      Klinik erfüllt diese Bedingung systematisch nicht.
    `,
        `
      Heart rate variability is a measure of recovery. Loading, the journey, an unfamiliar
      hall, unfamiliar people — all of it changes exactly the quantity you want to assess.
      The analysis we use explicitly requires <strong>at least seven minutes of rest in
      familiar surroundings</strong>. A measurement taken after arrival at the clinic
      systematically fails that condition.
    `);
tausche(`Die Halterin legt den Gurt an, das Pferd steht wie immer. Kein Transport, keine
         Aufregung durch Fremde, kein sperriges Gerät im Weg.`,
        `The owner puts on the belt, the horse stands as it always does. No transport, no
         excitement from strangers, no bulky equipment in the way.`);
tausche(`Die Sendung liegt im Cockpit, wenn Sie Zeit haben. Sie entscheiden danach, ob und
         wann ein Besuch nötig ist — und sehen vorher, wie dringend.`,
        `The recording sits in the cockpit when you have time. You decide afterwards whether
         and when a visit is needed — and you see beforehand how urgent it is.`);
tausche(`Eine Kontrolle in zwei Wochen kostet niemanden eine Anfahrt. Genau daraus entsteht
         der Verlauf, den eine Momentaufnahme nie liefern kann.`,
        `A follow-up in two weeks costs nobody a drive. That is exactly how the trend comes
         about that a snapshot can never deliver.`);
tausche(`<b>Nach Abweichung sortiert</b>, nicht nach Eingang — jedes Pferd gegen seine eigene Baseline, nicht gegen eine Tabelle.`,
        `<b>Sorted by deviation</b>, not by arrival — every horse against its own baseline, not against a table.`);
tausche(`<b>Der Grund steht dabei.</b> Eine Einstufung ohne den auslösenden Wert wäre eine Meinung.`,
        `<b>The reason is shown with it.</b> A classification without the triggering value would be an opinion.`);
tausche(`<b>Die Halterin ist einen Tipp entfernt</b>, direkt von der Karte aus.`,
        `<b>The owner is one tap away</b>, straight from the card.`);
tausche(`<b>Werte gegen die eigene Baseline</b> des Pferds, als Hinweis. Die Deutung bleibt bei Ihnen.`,
        `<b>Values against the horse's own baseline</b>, as an indication. The interpretation stays with you.`);
tausche(`<b>Signalgüte vor der Zahl</b>: wie viele Schlagpaare tragen die Auswertung überhaupt.`,
        `<b>Signal quality before the number</b>: how many beat pairs actually carry the analysis.`);
tausche(`<b>Ferneinschätzung erfassen und abrechnen</b>, ohne die Akte zu verlassen.`,
        `<b>Record and bill the remote assessment</b> without leaving the file.`);
tausche(`Vier Stufen von stabil bis kritisch, immer mit dem Wert, der sie ausgelöst hat —
           und mit der Abweichung von der Baseline <em>dieses</em> Pferds, nicht von einem
           Lehrbuchwert.`,
        `Four levels from stable to critical, always with the value that triggered it —
           and with the deviation from <em>this</em> horse's baseline, not from a textbook
           figure.`);
tausche(`Anteil auswertbarer Schlagpaare, Artefaktrate, korrigierte AV-Block-Pausen.
           Eine Aufnahme, die nichts trägt, sagt Ihnen das — statt eine Zahl zu zeigen.`,
        `Share of usable beat pairs, artefact rate, corrected AV-block pauses.
           A recording that carries nothing tells you so — instead of showing a number.`);
tausche(`HRV-basierte Marker mit ihren Schwellen, einzeln aufgeführt. Kalibriert gegen
           eine veröffentlichte Studie mit BAL-Referenz. Ein <strong>Screening</strong>,
           ausdrücklich keine Diagnose.`,
        `HRV-based markers with their thresholds, listed individually. Calibrated against
           a published study with a BAL reference. A <strong>screening</strong>,
           explicitly not a diagnosis.`);
tausche(`Tachogramm, Poincaré, Spektrum, DFA, Histogramm — dieselben Darstellungen wie
           in der iOS-App, im Vollbild neu gezeichnet statt hochskaliert.`,
        `Tachogram, Poincaré, spectrum, DFA, histogram — the same views as in the iOS app,
           redrawn at full size rather than scaled up.`);
tausche(`Befundbericht mit Ihrem Briefkopf, Rückmeldung an die Halterin, und eine
           Übersicht, was noch offen ist.`,
        `A findings report on your own letterhead, feedback to the owner, and an overview
           of what is still open.`);
tausche(`JSON, CSV, Kubios-kompatibel — und <strong>FHIR&nbsp;R5</strong> mit
           LOINC-Codes für die Praxissoftware.`,
        `JSON, CSV, Kubios-compatible — and <strong>FHIR&nbsp;R5</strong> with
           LOINC codes for your practice software.`);
tausche(`
      Ein ruhendes Pferd zeigt AV-Block-Pausen — physiologisch, kein Befund. Rechnet man
      sie roh mit, steigen SDNN und RMSSD dramatisch, und die Marker, die bei
      <em>kleinen</em> Werten anschlagen, kippen ins Gegenteil.
    `,
        `
      A resting horse shows AV-block pauses — physiological, not a finding. Count them in
      raw and SDNN and RMSSD rise dramatically, and the markers that respond to
      <em>small</em> values flip into the opposite.
    `);
tausche(`Fünf Stufen, AV-Block-Erkennung mit Spline-Korrektur, Bewegungs-Artefakte,
         Plausibilitätsgrenzen. Wir haben sie aus dem Original portiert und Wert für Wert
         gegen die kompilierte Fassung geprüft, auf Bitmuster.`,
        `Five stages, AV-block detection with spline correction, motion artefacts,
         plausibility limits. We ported them from the original and checked value by value
         against the compiled version, bit pattern for bit pattern.`);
tausche(`Ohne diese Vorstufe fiel in <strong>acht von zwanzig</strong> Aufnahmen die
         Atemwegs-Einstufung anders aus, jedes Mal zu auffällig. Mit ihr: kein einziger
         Unterschied mehr zur App-Auswertung.`,
        `Without this stage, the airway classification came out differently in
         <strong>eight out of twenty</strong> recordings, every time too conspicuous. With
         it: not a single difference from the app's analysis remains.`);
tausche(`Zu wenige Schläge, zu kurz, zu viele Artefakte — dann steht „Datengrundlage zu
         klein" und kein Urteil. Ein Werkzeug, das immer etwas sagt, ist kein Werkzeug.`,
        `Too few beats, too short, too many artefacts — then it says “insufficient data”
         and gives no verdict. A tool that always says something is not a tool.`);
tausche(`
      Ein einzelner HRV-Wert beim Pferd sagt wenig — es gibt keinen belastbaren
      Normwert, an dem man ihn messen könnte. Aussagekräftig wird er erst gegen die
      eigene Vorgeschichte des Tieres.
    `,
        `
      A single HRV value in a horse says little — there is no robust normal value to
      measure it against. It only becomes meaningful against the animal's own history.
    `);
tausche(`Jede neue Aufnahme reiht sich ein. Sie sehen, ob sich die Marker verbessern,
           halten oder verschlechtern — mit Zeitfenster, Anzahl der Messungen und der
           Veränderung als Zahl.`,
        `Every new recording joins the line. You see whether the markers improve, hold or
           deteriorate — with the time window, the number of measurements and the change
           as a figure.`);
tausche(`Haltung, Fütterung, Management, Rekonvaleszenz: Die Kontrollmessung kostet
           keine Anfahrt, also findet sie auch statt. Als Beobachtung — die Bewertung
           bleibt bei Ihnen.`,
        `Housing, feeding, management, convalescence: the follow-up measurement costs no
           drive, so it actually happens. As an observation — the assessment stays with
           you.`);
tausche(`
      Jede Aufnahme lässt sich als <strong>FHIR&nbsp;R5</strong> ausgeben — als
      <code>Observation</code> mit LOINC-Codes und UCUM-Einheiten, das Pferd als
      <code>Patient</code> mit den Kennungen, die Sie ohnehin führen: Praxissoftware-Nummer,
      UELN, Mikrochip, Pass. Dazu JSON, CSV und ein Kubios-kompatibler Export für die
      Forschung, und ein SHA-256-Prüfwert je Datensatz für die Dokumentation.
    `,
        `
      Every recording can be exported as <strong>FHIR&nbsp;R5</strong> — as an
      <code>Observation</code> with LOINC codes and UCUM units, the horse as a
      <code>Patient</code> with the identifiers you already keep: practice software number,
      UELN, microchip, passport. Plus JSON, CSV and a Kubios-compatible export for research,
      and a SHA-256 checksum per record for your documentation.
    `);
tausche(`Die Auswertung ist die eine Hälfte. Die andere ist der Tag, an dem
       Sie sie unterbringen müssen — und der entscheidet, ob ein Werkzeug den ersten
       Monat überlebt.`,
        `The analysis is one half. The other is the day you have to fit it into — and that
       is what decides whether a tool survives its first month.`);
tausche(`<b>Die Einstufung ordnet die Stopps.</b> Was Sie anders sehen, schieben Sie per Greifpunkt um — die Software schlägt vor, sie entscheidet nicht.`,
        `<b>The classification orders the stops.</b> Where you see it differently you drag the card — the software suggests, it does not decide.`);
tausche(`<b>Nichts davon verlässt Ihr Gerät</b> — auch die Adressen nicht.`,
        `<b>None of it leaves your device</b> — not even the addresses.`);
tausche(`
      Die schriftliche oder fernmündliche Beratung ohne Untersuchung ist in der
      <strong>GOT als Ziffer&nbsp;1</strong> geführt, der Tierarztbrief je angefangene
      15&nbsp;Minuten als <strong>Ziffer&nbsp;89</strong>. Was das bei Ihrem Satz ergibt,
      rechnen Sie besser als wir — CARLON erfasst die Ferneinschätzung nur an der Stelle,
      an der sie entsteht, und gibt sie als CSV heraus.
    `,
        `
      Written or telephone advice without examination is listed in the German veterinary
      fee schedule (GOT) as <strong>item&nbsp;1</strong>, the veterinary letter per started
      15&nbsp;minutes as <strong>item&nbsp;89</strong>. What that comes to at your rate you
      can work out better than we can — CARLON only records the remote assessment where it
      arises, and exports it as CSV.
    `);
tausche(`Die Software zeigt Messwerte, Signalqualität, Verlauf und Abweichung. Die
           medizinische Deutung bleibt vollständig bei Ihnen. CARLON Equine Visite ist
           kein Medizinprodukt im Sinne der Verordnung (EU) 2017/745.`,
        `The software shows measured values, signal quality, trend and deviation. The
           medical interpretation remains entirely with you. CARLON Equine Visite is not a
           medical device within the meaning of Regulation (EU) 2017/745.`);
tausche(`Auch wenn ein Verlauf eindeutig aussieht: Ob etwas geändert wird, steht nirgends
           auf dem Schirm. Das ist Ihre Entscheidung, nicht die einer Kennzahl.`,
        `Even when a trend looks unambiguous: whether anything is changed appears nowhere
           on the screen. That is your decision, not a metric's.`);
tausche(`Ihre Patienten liegen im Speicher Ihres Geräts. Wir haben keinen Zugriff und
           könnten sie auch nicht löschen. Was zwischen Halterin und Praxis läuft, ist
           verschlüsselt und für uns unlesbar.`,
        `Your patients live in your device's storage. We have no access and could not
           delete them either. What passes between owner and practice is encrypted and
           unreadable to us.`);
tausche(`Eine Sendung ist kein Anruf. Bei akuten Beschwerden gilt, was immer gilt —
           unmittelbar tierärztlich handeln.`,
        `A recording is not a phone call. In acute cases what always applies still applies —
           act veterinarily, immediately.`);
tausche(`
      Ein Betrieb — eine Praxis oder ein Standort — mit allen tierärztlichen und
      tiermedizinischen Mitarbeitenden und auf beliebig vielen Geräten dieses Betriebs.
      Es gibt keinen Aufpreis je Pferd und keine Grenze für Aufnahmen.
    `,
        `
      One business — one practice or one site — with all veterinary and veterinary-nursing
      staff and on any number of that business's devices. There is no per-horse surcharge
      and no limit on recordings.
    `);
tausche(`
        Das Angebot richtet sich ausschließlich an Unternehmer im Sinne des § 14 BGB.
        Zahlung, Rechnung und Umsatzsteuer laufen über unseren Zahlungsdienstleister als
        Merchant of Record. Einzelheiten in
        <a href="/agb.html#visite">§ 12a unserer AGB</a> und in der
        <a href="/privacy.html">Datenschutzerklärung</a>.
      `,
        `
        This offer is directed exclusively at entrepreneurs within the meaning of § 14 BGB.
        Payment, invoicing and VAT run through our payment provider as merchant of record.
        Details in
        <a href="/terms.html#visite">§ 12a of our Terms</a> and in the
        <a href="/privacy-en.html">Privacy Policy</a>.
      `);
tausche(`
      Zum Einordnen: Der Jahrespreis liegt in der Größenordnung eines einzelnen
      Praxisbesuchs mit Anfahrt. Ob sich das trägt, entscheiden Sie am besten an Ihren
      eigenen Zahlen — nicht an unseren.
    `,
        `
      For scale: the annual price is in the region of a single practice visit including the
      drive. Whether that pays off is best decided against your own figures — not ours.
    `);
tausche(`
      Das Demo-Cockpit ist nicht ein Video und keine Bildstrecke, sondern die vollständige
      Anwendung. Öffnen Sie eine Akte, drehen Sie an den Ansichten, drucken Sie einen
      Befund. Ein Pferd im Bestand zeigt einen Abwärtsverlauf über vier Wochen — sehen Sie
      selbst, ab wann er auffällt.
    `,
        `
      The demo cockpit is not a video and not a slideshow, but the complete application.
      Open a file, work the views, print a findings report. One horse in the list shows a
      downward trend over four weeks — see for yourself from when it becomes noticeable.
    `);
tausche(`Nein. CARLON bereitet Verlaufsdaten auf und hilft bei der Reihenfolge. Ob eine
           klinische Untersuchung, weitere Diagnostik oder eine Behandlung nötig ist,
           entscheiden ausschließlich Sie.`,
        `No. CARLON prepares trend data and helps with the order of visits. Whether a
           clinical examination, further diagnostics or treatment is needed is decided by
           you alone.`);
tausche(`Einen handelsüblichen Brustgurt und ein Android-Gerät oder einen Rechner mit
           Chrome oder Edge. Auf iPhone und iPad lässt Apple Bluetooth im Browser nicht zu;
           die Seite führt dort auf ein messfähiges Gerät.`,
        `A commercially available chest belt and an Android device or a computer with
           Chrome or Edge. On iPhone and iPad, Apple does not permit Bluetooth in the
           browser; the page directs you to a capable device there.`);
tausche(`Die Anwendung wechselt in einen funktionsreduzierten Modus. Ihre Daten bleiben
           auf dem Gerät und lassen sich weiterhin öffnen und exportieren. Wir könnten sie
           gar nicht löschen — sie liegen bei Ihnen.`,
        `The application switches to a reduced mode. Your data stays on the device and can
           still be opened and exported. We could not delete it — it is with you.`);
tausche(`Das Cockpit läuft vollständig in Ihrem Browser; Patientendaten erreichen uns
           nicht. Für den verschlüsselten Transportweg zwischen Halterin und Praxis klären
           wir die Einordnung derzeit anwaltlich ab und sagen Ihnen das Ergebnis, bevor Sie
           es brauchen.`,
        `The cockpit runs entirely in your browser; patient data never reaches us. For the
           encrypted transport path between owner and practice we are currently having the
           classification clarified by a lawyer and will tell you the outcome before you
           need it.`);


/* Der Datenschutz-Hinweis am Formular. Er MUSS in der Sprache stehen, in der
   getippt wird — eine englische Seite mit deutschem Hinweis informiert
   niemanden. Recht gilt pro Sprache und pro handelnder Seite. */
tausche(`Wir speichern Ihre Angaben ausschließlich, um Ihre Anmeldung zu bearbeiten
        (Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;b DSGVO), auf unserem eigenen Dienst — nicht bei
        einem Formularanbieter — und löschen sie spätestens nach 180&nbsp;Tagen.
        Kein Newsletter, keine Weitergabe.`,
        `We store your details solely in order to process your registration
        (Art.&nbsp;6(1)(b) GDPR), on our own service — not with a form provider — and delete
        them after 180&nbsp;days at the latest. No newsletter, no sharing.`);
tausche('Teil der Vitalkultur-App-Familie', 'Part of the Vitalkultur app family', 2);

if (fehlend.length) {
  console.error('\n  ✗ Der Bau bricht ab — diese Bloecke gibt es in index.html nicht (mehr):\n');
  for (const f of fehlend) console.error(`      ${f.erwartet}× erwartet, ${f.gefunden}× gefunden:  „${f.de}…"`);
  console.error('\n  Die deutsche Seite hat sich geaendert. Uebersetzung nachziehen, dann neu bauen.\n');
  process.exit(1);
}

mkdirSync(join(HIER, 'en'), { recursive: true });
writeFileSync(join(HIER, 'en', 'index.html'), s, 'utf8');
console.log(`  ✓ en/index.html gebaut · ${ersetzt} Bloecke ersetzt · ${s.length} Zeichen`);
