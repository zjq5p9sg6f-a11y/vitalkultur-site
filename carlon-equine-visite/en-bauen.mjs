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
tausche(`content="CARLON Equine für Pferdepraxen und -kliniken: Die Halterin nimmt die Ruhe-HRV im Stall mit einem Polar-H10-Gurt auf, Sie sehen den Verlauf gegen die eigene Vorgeschichte des Pferds, mit Signalgüte, und planen Ihre Tour nach Strecke. Auswertung im Browser, kein Medizinprodukt."`,
        `content="CARLON Equine for equine practices and clinics: the owner records resting HRV in the stable with a Polar H10 strap, you see the trend against the horse’s own history, with signal quality, and plan your round by distance. Analysis in the browser, not a medical device."`);
tausche('<meta property="og:title" content="CARLON Equine – für Tierärzte & Kliniken">',
        '<meta property="og:title" content="CARLON Equine – for equine vets &amp; clinics">');
tausche(`<meta property="og:description" content="Die Tour geplant. Jedes Pferd mit seinem Verlauf. Die Halterin nimmt im Stall auf, Sie sehen den Verlauf mit Signalgüte — Auswertung im Browser, nicht in der Cloud.">`,
        `<meta property="og:description" content="Your round, planned. Every horse with its trend. The owner records in the stable, you see the trend with signal quality — analysis in the browser, not in the cloud.">`);
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
/* Auch href= — der Muster-Befund haengt an einem href, nicht an einem src.
   t-verweise hat es sofort gemeldet: en/assets/... gibt es nicht. Genau
   dafuer ist die Inventur da; ohne sie waere der Beleg-Link der englischen
   Seite tot gewesen, und tot ist er ausgerechnet an der Stelle, an der ein
   Tierarzt den Beweis sehen will. */
s = s.split('href="assets/').join('href="../assets/');
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
/* Der praezisierte Umsatzsteuer-Absatz traegt die Rechtsverweise erneut —
   beim Umschreiben sind sie wieder deutsch geworden. Ein englischer Leser
   soll nicht gegen einen Text zustimmen, den er nicht lesen kann.
   Generisch statt einzeln: was uebrig bleibt, wird umgehaengt. */
s = s.split('href="/agb.html#visite"').join('href="/terms.html#visite"');
s = s.split('href="/agb.html"').join('href="/terms.html"');
s = s.split('href="/privacy.html"').join('href="/privacy-en.html"');
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
tausche('CARLON Equine Visite · für Tierärztinnen und Tierärzte',
        'CARLON Equine Visite · for veterinary surgeons');
/* Dieselbe Zeile wie in der og:description — Identitaet, nicht Funktion. */
tausche(`Die Tour geplant. Jedes Pferd mit seinem Verlauf.`,
        `Your round, planned. Every horse with its trend.`);
tausche(`Die Halterin nimmt im Stall in Ruhe auf, die Aufnahme kommt verschlüsselt zu Ihnen.
      Vor dem Besuch sehen Sie, wie gut die Aufnahme ist und wie weit die Ruhe-HRV von
      <strong>der eigenen</strong> Vorgeschichte dieses Pferds abweicht — und planen Ihre
      Tour nach Strecke, Termin oder Ihrer eigenen Sortierung.`,
        `The owner records in the stable at rest, and the recording reaches you encrypted.
      Before the visit you see how good the recording is and how far the resting HRV deviates from
      <strong>this horse’s own</strong> history — and plan your round by distance, appointment
      or your own order.`);
tausche('Cockpit mit 15&nbsp;Demo-Pferden öffnen →', 'Open the cockpit with 15&nbsp;demo horses →', 2);
tausche('>Preise &amp; Freischaltung · ab 149&nbsp;€<', '>Pricing &amp; activation · from €149<');
tausche('Das Demo-Cockpit ist die vollständige Anwendung mit vollständigen Beispielverläufen — ohne Konto, ohne Installation. Nichts davon verlässt Ihren Browser von selbst.',
        'The demo cockpit is the complete application with full example trends — no account, no installation. None of it leaves your browser on its own.');
/* Hero-Belege + Visual (13.08.: φ-Split-Kopf) */
tausche('<li><b>Gemessen im Stall,</b> in Ruhe — gegen die eigene Baseline dieses Pferds.</li>',
        '<li><b>Recorded in the stable,</b> at rest — against this horse’s own baseline.</li>');
tausche(`<li><b>Ausgewertet in Ihrem Browser</b> — Pferdedaten erreichen uns nicht — nach unserer Einschätzung ist deshalb kein AVV mit uns nötig.</li>`,
        `<li><b>Analysed in your browser</b> — horse data never reaches us; in our assessment no data processing agreement with us is therefore needed.</li>`);
tausche(`<li><b>Nachvollziehbar</b> — roher und bereinigter Wert nebeneinander, mit Signalgüte und Methodenversion.</li>`,
        `<li><b>Traceable</b> — raw and cleaned value side by side, with signal quality and method version.</li>`);
tausche('title="Demo-Cockpit öffnen"', 'title="Open the demo cockpit"');
tausche(`alt="Pferde-Akte im Cockpit: Kernwerte RMSSD, Ruhe-HF, SDNN und DFA gegen die eigene Vorgeschichte des Pferds, mit Signalgüte und Verlauf"`,
        `alt="Horse record in the cockpit: key values RMSSD, resting HR, SDNN and DFA against the horse’s own history, with signal quality and trend"`);
// Fluss-Leiste im Hero (Stall → Praxis)
tausche('<span class="hf-chip">Im Stall gemessen</span>', '<span class="hf-chip">Recorded in the stable</span>');
tausche('<span class="hf-chip">In Ihrer Praxis gelesen</span>', '<span class="hf-chip">Read in your practice</span>');
tausche(`Echte Ansichten, keine Attrappen — <b>ein Klick öffnet die Anwendung.</b>`,
        `Real views, no mock-ups — <b>one click opens the application.</b>`);
/* Der Preis stand bis 13.08.2026 im Kopf und ist dort entfernt — wer den
   Preis liest, bevor er den Wert kennt, rechnet gegen ein Produkt, das er
   noch nicht verstanden hat. Der Block entfaellt hier mit. */

// Abschnitt 1 — Messbedingung
tausche('Warum die Messung in den Stall gehört', 'The difference that arises before the measurement');
tausche('Ruhe-HRV gibt es nur dort, wo Ruhe ist: im eigenen Stall.',
        'Resting HRV only exists where rest exists: in the horse’s own stable.');
/* Die Abrechnungs-Karte (neu 13.08.2026) — das Geld-Argument stand bisher
   ganz unten auf der Seite. GOT-Ziffern werden GENANNT, nie verrechnet. */
tausche(`Dokumentiert statt erinnert`,
        `Documented, not remembered`);
tausche(`Aufnahme, Messprotokoll und Ihre Notiz liegen zusammen in der Akte — als
         Messwertbericht mit Ihrem Briefkopf oder als Export für Ihre Praxissoftware.`,
        `Recording, measurement protocol and your note sit together in the record — as a
         measurement report on your letterhead or as an export for your practice software.`);
tausche('In der eigenen Box, zur gewohnten Zeit', 'Its own box, not an examination room');
tausche(`Statt Handyvideo: eine standardisierte Aufnahme`,
        `Instead of a phone video: a standardised recording`);
tausche(`Wiederholbar unter gleichen Bedingungen`,
        `Repeatable under the same conditions`);

// Abschnitt 2 — Cockpit
tausche('Was im Cockpit steht', 'What the cockpit shows');
tausche(`Erst der Überblick. Dann die Zahlen, auf denen er beruht.`,
        `The overview first. Then the numbers it rests on.`);
tausche(`Oben die Abweichung von der eigenen Vorgeschichte und der Wert, aus dem sie folgt. Darunter alles,
       was Sie zum Nachrechnen brauchen — nichts davon versteckt.`,
        `At the top the deviation from the horse’s own history and the value it follows from. Below it
       everything you need to check the maths — none of it hidden.`);
tausche(`<div class="f-k">Übersicht</div>`,
        `<div class="f-k">Overview</div>`);
tausche(`Vier Abweichungsstufen, und daneben steht, aus welchem Wert sie folgen.`,
        `Four deviation levels, and next to each the value it follows from.`);
tausche('<div class="f-k">Die Akte</div>', '<div class="f-k">The record</div>');
tausche('Alles, was Sie zum Nachrechnen brauchen — an einer Stelle.',
        'Everything you need to check the maths — in one place.');
tausche(`Abweichung mit Begründung`,
        `Deviation with its reason`);
tausche('Signalgüte, bevor Sie deuten', 'Signal quality before interpretation');
tausche(`Atemmuster-Profil aus der Literatur`,
        `Breathing-pattern profile from the literature`);
tausche('Die üblichen Ansichten, in guter Auflösung', 'The familiar views, at proper resolution');
tausche(`Messwertbericht und Dokumentation an einer Stelle`,
        `Measurement report and documentation in one place`);
tausche('Export ohne Sackgasse', 'Export without a dead end');

// Abschnitt 3 — Wissenschaft
tausche('Warum die Zahlen tragen', 'Why the numbers hold', 2);   // Kommentar + Text
tausche('Beim Pferd sind Pausen normal. Wer sie mitrechnet, misst Unsinn.',
        'In horses, pauses are normal. Count them in and you measure nonsense.');
tausche('Misst keinen Mist',
        'No junk in your numbers');
tausche('Zu auffällig ist auch falsch',
        'Too conspicuous is wrong too');
/* Die Gurt-Frage — auf Englisch dieselbe Aussage ohne Betrag. */
tausche(`<strong>Und der Gurt?</strong> Ein Polar&nbsp;H10 ist ein handelsübliches Gerät, überall
      erhältlich und billiger als eine einzige Anfahrt. Wir verkaufen ihn <em>nicht</em> — damit
      Sie ihn frei wählen und bei einem Defekt am selben Tag Ersatz haben, statt auf uns zu warten.
      Bewährt hat sich: <strong>zwei bis drei Leihgurte in der Praxis</strong>, die Sie mitgeben;
      Halterinnen mit mehreren Pferden schaffen sich meist selbst einen an. Ein Gurt reicht für
      beliebig viele Pferde — er wird nur umgeschnallt.`,
`<strong>And the belt?</strong> A Polar&nbsp;H10 is an off-the-shelf device, available everywhere
      and cheaper than a single call-out. We do <em>not</em> sell it — so you can choose freely and
      get same-day replacement if one fails, rather than waiting for us. What works well:
      <strong>two or three loan belts in the practice</strong> that you hand out; owners with
      several horses usually buy their own. One belt serves any number of horses — it simply
      gets moved.`);

/* Das Beleg-Bild: Beschriftung fuer Vorleseprogramme und die Achse. Ein
   aria-label in der falschen Sprache ist schlimmer als keines — es klingt
   fuer den Vorleser wie Kauderwelsch. */
tausche('Die Schlagabstände einer Ruheaufnahme über 642 Schläge. Die Linie verläuft ruhig um 850 Millisekunden. An einer einzigen Stelle springt sie auf 1794 Millisekunden — ein AV-Block mit seinem kurzen Folgeschlag. Diese eine Stelle hebt die RMSSD von 24,2 auf 55,5 Millisekunden.',
        'Beat-to-beat intervals of a resting recording across 642 beats. The line runs steadily around 850 milliseconds. At a single point it jumps to 1794 milliseconds — an AV block with its short follow-on beat. That one point lifts RMSSD from 24.2 to 55.5 milliseconds.');
tausche('<span>642 Schläge · rund 850 ms</span><span>Ausschlag 1794 ms</span>',
        '<span>642 beats · around 850 ms</span><span>spike 1794 ms</span>');

/* Der Beleg zur Filter-Behauptung. Zahlen bleiben Zahlen, aber das
   Dezimalkomma wird zum Punkt — sonst liest ein englischer Leser 24,2
   als Tausenderzahl. */
tausche(`In einer echten Ruheaufnahme — 642 Schläge, 0,31 % Artefaktrate,
         von der Qualitätsanzeige als <em>exzellent</em> geführt — genügen
         <strong>zwei</strong> Schläge, ein AV-Block mit seinem kurzen Folgeschlag,
         um die RMSSD von 24,2 auf 55,5 ms zu heben. <strong>130 % zu hoch</strong> —
         und die Qualitätsanzeige warnt kein einziges Mal. Ein hoher Anteil
         plausibler Schläge sagt nichts darüber, ob der Kennwert stimmt.`,
`In a real resting recording — 642 beats, 0.31 % artefact rate, rated
         <em>excellent</em> by the quality indicator — <strong>two</strong> beats,
         an AV block with its short follow-on beat, are enough to lift RMSSD from
         24.2 to 55.5 ms. <strong>130 % too high</strong> — and the quality
         indicator never warns. A high share of plausible beats says nothing
         about whether the metric is right.`);
tausche('Und dort, wo es nicht reicht, sagt es das', 'And where it is not enough, it says so');

// Abschnitt 4 — Verlauf
tausche('Was eine Momentaufnahme nicht kann', 'What a snapshot cannot do');
tausche('Ein Wert sagt wenig. Erst sein Verlauf gibt ihm Kontext.', 'One value says little. Only its trend gives it context.');
tausche('Über Wochen statt über Minuten', 'Over weeks rather than minutes');
tausche('Nach einer Umstellung sichtbar', 'Visible after a change');

// Abschnitt 5 — Anschluss
tausche('>Anschluss<', '>Interoperability<');
tausche(`Die Daten gehen in Ihre Praxissoftware, nicht in eine Sackgasse.`,
        `The data goes into your practice software, not into a dead end.`);

// Abschnitt 6 — Arbeitstag
tausche('>Ihr Arbeitstag<', '>Your working day<');
tausche('Zwischen zwei Terminen liegt Ihr Fahrweg.', 'Between two appointments lies your drive.');
/* (weiter unten im Rumpftext uebersetzt — hier waere es doppelt) */
tausche('<div class="f-k">Tagesplan</div>', '<div class="f-k">Day plan</div>');
tausche(`Die Tour plant sich nach Strecke und Termin — die Reihenfolge bestimmen Sie.`,
        `The round plans itself by distance and appointment — you set the order.`);
tausche('Karte &amp; Route — die Abfahrfolge, direkt an Google&nbsp;Maps übergeben, statt Adressen abzutippen.',
        'Map &amp; route — the departure order, handed straight to Google&nbsp;Maps instead of retyping addresses.');
tausche('Kompakt — der ganze Tag auf einer Zeitachse, wenn es schnell gehen muss.',
        'Compact — the whole day on one timeline, when it has to be quick.');
tausche(`Dokumentation — Fahrtenbuch, Zeiterfassung, erfasste Leistungen, als CSV heraus.`,
        `Documentation — mileage log, time tracking, recorded services, exported as CSV.`);

// Abschnitt 7 — Grenzen
tausche('Grenzen, die wir selbst ziehen', 'Limits we draw ourselves');
tausche('Was CARLON bewusst nicht tut.', 'What CARLON deliberately does not do.');
tausche('Keine Diagnose', 'No diagnosis');
tausche('Keine Behandlungsempfehlung', 'No treatment recommendation');
tausche('Keine Datenbank bei uns', 'No database at our end');
tausche('Kein Notfallweg', 'Not an emergency channel');

// Abschnitt 8 — Preis
tausche('Ein Preis, eine Praxis', 'One price, one practice');
/* Ueberschrift traegt jetzt zusaetzlich den Betriebs-Bezug; weiter unten. */
/* Ersetzt durch den praeziseren Satz weiter unten (USt. weist Stripe aus). */
/* Die Monatsrate fuehrt (Jan, 13.08.) — die grosse Zahl ist der Anker. */
tausche('oder 1.490&nbsp;€ im Jahr — entspricht 124,17&nbsp;€ im Monat, zwei Monate gespart',
        'or €1,490 per year — €124.17 a month, two months saved');
tausche('An der Kasse für Praxen in Deutschland: 177,31&nbsp;€ im Monat bzw. 1.773,10&nbsp;€ im Jahr, jeweils inkl. 19&nbsp;% USt.',
        'At checkout for practices in Germany: €177.31 a month or €1,773.10 a year, each incl. 19% VAT.');
tausche('Unbegrenzt Pferde, Aufnahmen und Verläufe', 'Unlimited horses, recordings and trends');
tausche('Ein Standort, alle Geräte — ohne Zuschlag je Gerät', 'All staff, all devices of the business');
tausche(`Messwertbericht mit eigenem Briefkopf`,
        `Measurement report on your own letterhead`);
tausche('Export als JSON, CSV, Kubios und FHIR&nbsp;R5', 'Export as JSON, CSV, Kubios and FHIR&nbsp;R5');
tausche('Monatsabo monatlich kündbar, Jahresabo zum Ende der Laufzeit', 'Monthly plan cancellable monthly, annual plan at the end of its term');

// Abschnitt 9 — Demo
tausche('Bevor Sie irgendetwas entscheiden', 'Before you decide anything');
tausche('Fünfzehn Demo-Pferde. Vollständige Beispielverläufe. Kein Konto.',
        'Fifteen demo horses. Complete example trends. No account.');
tausche('Läuft im Browser. Nichts wird installiert, nichts übertragen, nichts angelegt.',
        'Runs in the browser. Nothing installed, nothing transmitted, nothing created.');

// Formular
tausche('Als Beta-Praxis mitmachen', 'Join as a beta practice');
tausche(`Wer in der Beta mitgestaltet, behält seinen Preis als
         Gründungspartner. Ihre Anmeldung liest der Entwickler selbst — und meldet
         sich persönlich zurück, meist am selben Tag.`,
`Take part in the beta and you keep your founding-partner price. The developer
         reads every registration personally — and replies, usually the
         same day.`);
tausche('> Ich bin mobil unterwegs<', '> I work ambulatory<');
tausche('> Wir sind eine Klinik<', '> We are a clinic<');
tausche('<label>Name<input', '<label>Name<input');
tausche('<label>Praxis oder Klinik <span>(optional)</span><input', '<label>Practice or clinic <span>(optional)</span><input');
tausche('<label>E-Mail<input', '<label>Email<input');
tausche('<label>Region <span>(optional)</span><input', '<label>Region <span>(optional)</span><input');
tausche('placeholder="z.&nbsp;B. Ortenau, Oberbayern, Münsterland"', 'placeholder="e.g. Ortenau, Bavaria, Münsterland"');
tausche('<label>Etwa wie viele Pferde betreuen Sie? <span>(optional)</span><input', '<label>Roughly how many horses do you look after?<input');
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
tausche('Ersetzt CARLON eine Untersuchung?', 'Does CARLON replace an examination?', 2);
tausche('Was braucht die Halterin?', 'What does the owner need?', 2);
tausche('Was passiert nach einer Kündigung?', 'What happens after cancellation?', 2);
tausche('Brauche ich einen Auftragsverarbeitungsvertrag?', 'Do I need a data processing agreement?', 2);

// Fuss
tausche('Für Tierärzte &amp; Kliniken · Teil von CARLON Equine',
        'For equine vets &amp; clinics · part of CARLON Equine');
tausche('Made in Iffezheim · Deutschland', 'Made in Iffezheim · Germany', 2);   // data-de + Text
tausche('CARLON Equine (die App)', 'CARLON Equine (the app)', 2);   // data-de + Text
tausche(`Kohärenz &amp; Forschung`,
        `Coherence &amp; research`, 2);
/* Der Atemwegs-Absatz ist neu (13.08.2026) — und er ist das staerkste
   Argument der Seite: bei Asthma IST die Umgebung der Gegenstand. */
tausche(`
      <strong>Gleiche Box, gleiche Zeit, gleiches Protokoll.</strong> Nur unter gewohnten
      Bedingungen sind zwei Aufnahmen vergleichbar. Zu Hause, wiederholt über Wochen, entsteht
      so ein Verlauf, der zeigt, wie sich die Ruhe-HRV dieses Pferds nach einer Umstellung in
      Haltung, Fütterung oder Training entwickelt — die Einordnung bleibt bei Ihnen.
    `,
        `
      <strong>Same box, same time, same protocol.</strong> Only under familiar
      conditions are two recordings comparable. At home, repeated over weeks, this builds a
      trend that shows how this horse’s resting HRV develops after a change in
      housing, feeding or training — the interpretation stays with you.
    `);
tausche(`Die Halterin legt den Gurt an, das Pferd steht wie immer. Kein Transport, keine
         Aufregung durch Fremde, kein sperriges Gerät im Weg.`,
        `The owner puts on the belt, the horse stands as it always does. No transport, no
         excitement from strangers, no bulky equipment in the way.`);
tausche(`Die Halterin schickt eine Aufnahme samt Messprotokoll. Sie öffnen sie, wenn es in
         Ihre Planung passt — mit Signalgüte und dem Vergleich zur eigenen Vorgeschichte des Pferds.`,
        `The owner sends a recording with its measurement protocol. You open it when it fits
         your planning — with signal quality and the comparison to the horse’s own history.`);

/* ── 2b · DIE MESSSTATION (neu 13.08.2026) ────────────────────────────
   Der ganze Abschnitt ist neu. Ohne diese Bloecke bliebe er auf der
   englischen Seite deutsch stehen — und zwar STILL, weil der Bauer nur
   meldet, was er ERWARTET und nicht findet, nicht was er nie gesehen hat.
   Genau deshalb prueft t-englisch die Seiten zusaetzlich gegeneinander. */
tausche('<div class="sec-eyebrow">Die Messstation</div>',
        '<div class="sec-eyebrow">The measuring station</div>');
tausche('Eine Messstation, die im Browser läuft — ohne App, ohne Konto.',
        'A measuring station that runs in the browser — no app, no account.');
tausche(`Es gibt <strong>nichts zu installieren</strong>. Die Halterin öffnet Ihren Mess-Link —
      als Nachricht bekommen, auf Ihrer Praxis-Website gefunden oder vom Aushang
      gescannt — und die Messstation ist da: im Browser, ohne Anmeldung. Sie verbindet den
      Polar-H10-Gurt, lässt das Pferd stehen und tippt einmal auf Senden.
      <strong>Kein Onboarding, keine Rückfragen bei Ihnen.</strong> Gemessen wird mit einem
      Android-Telefon oder einem Rechner mit Chrome oder Edge — auf dem iPhone lässt Apple
      Bluetooth im Browser nicht zu. Im Stall genügt ein einziges messfähiges Gerät für
      alle Pferde.`,
`There is <strong>nothing to install</strong>. The owner opens your measuring link —
      received as a message, found on your practice website or scanned from the poster —
      and the measuring station is there: in the browser, no sign-up. She connects the Polar H10 belt, lets
      the horse stand and taps send once.
      <strong>No onboarding, no questions coming back to you.</strong> Recording works on an
      Android phone or a computer with Chrome or Edge — on iPhone, Apple does not permit
      Bluetooth in the browser. One capable device in the barn is enough for
      all horses.`);
tausche(`Bei Ihnen kommt kein Screenshot an, sondern ein Datensatz: alle Schlagabstände im
      Rohzustand, die daraus berechneten Kennwerte und die Signalgüte dazu. Sie sehen also
      nicht nur eine Zahl, sondern auch, <strong>wie sehr Sie ihr trauen können</strong>.
      Ins Cockpit kommt die Datei mit einem Handgriff — hineinziehen, fertig: Signalgüte
      und der Vergleich mit der eigenen Vorgeschichte stehen sofort da.`,
        `What reaches you is not a screenshot but a dataset: every beat interval in its
      raw state, the measures computed from it and the signal quality alongside. So you see
      not just a number but also <strong>how far you can trust it</strong>.
      The file goes into the cockpit with one move — drag it in, done: signal quality
      and the comparison with the horse’s own history are there at once.`);
tausche('Der Aushang führt hierher. Pferdename, zwei Tipps für Ort und Ruhezeit, ein Knopf zum Gurt — ohne Konto.',
        'The poster leads here. Horse name, two taps for place and rest time, one button for the belt — no account.');
tausche('Während der Aufnahme sieht sie, ob das Signal trägt — nicht erst hinterher.',
        'During the recording she can see whether the signal holds — not only afterwards.');
tausche('Das Ergebnis, sofort. <strong>Zwei RMSSD-Werte statt einem</strong> — der rohe und der über nur unauffällige Schlagpaare.',
        'The result, immediately. <strong>Two RMSSD values instead of one</strong> — the raw one and the one over unremarkable beat pairs only.');
tausche('Das Messprotokoll sagt, <strong>wie gut</strong> die Aufnahme ist: auswertbare Schlagpaare, Sensor, Zeitauflösung.',
        'The measurement log states <strong>how good</strong> the recording is: usable beat pairs, sensor, time resolution.');
tausche('Zwei Zahlen, nicht eine', 'Two numbers, not one');
tausche(`Beim Pferd liegen physiologische Pausen — der AV-Block II° ist beim ruhenden Pferd
         normal — und echte Störungen in derselben Serie. Ein Filter kann sie nicht
         unterscheiden, er wirft beides weg. Die Station nennt deshalb den rohen Wert
         <em>und</em> den über unauffällige Paare. Welcher Anteil wovon stammt, entscheiden
         Sie, nicht die Software.`,
        `In horses, physiological pauses — second-degree AV block is normal in a resting
         horse — and genuine artefacts occur in the same series. A filter cannot tell them
         apart; it discards both. The station therefore reports the raw value <em>and</em>
         the one over unremarkable pairs. Which share comes from what is your call, not the
         software's.`);
tausche('Nichts läuft über uns', 'Nothing passes through us');
tausche(`Öffnet Ihre Kundin Ihren Mess-Link, ist die Datei schon auf ihrem Gerät
         <strong>gegen Ihren Schlüssel verschlüsselt</strong>. Sie verschickt sie über den
         Weg, den sie selbst wählt. Wir bekommen sie nicht zu sehen und legen sie nirgends
         ab — deshalb braucht es zwischen uns keinen Auftragsverarbeitungsvertrag.`,
        `The moment your client opens your measuring link, the file is already encrypted
         <strong>against your key</strong> on her device. She sends it by whatever route she
         chooses. We never see it and store it nowhere — which is why no data processing
         agreement is needed between us.`);
tausche('RR-Tachogramm und Atemkurve — dieselben Rohdaten, die Sie danach im Cockpit auswerten.',
        'RR tachogram and breathing curve — the same raw data you then analyse in the cockpit.');
tausche('Ein Tipp öffnet das Teilen-Blatt ihres Telefons. Der Satz darunter ist die ganze Datenschutz-Zusage.',
        'One tap opens her phone\'s share sheet. The sentence below it is the entire privacy commitment.');
tausche(`Sie können die Station <strong>sofort selbst ausprobieren</strong> — auch ohne Gurt:
      sie spielt eine echte Aufnahme ab.
      <a href="/carlon-equine/app/messen.html">Messstation öffnen →</a>`,
`You can <strong>try the station yourself right now</strong> — even without a belt: it
      replays a real recording.
      <a href="/carlon-equine/app/messen.html">Open the measuring station →</a>`);
/* Die Bildbeschreibungen sind für blinde Leser der einzige Zugang zum Bild —
   auf einer englischen Seite müssen sie englisch sein. */
tausche('alt="Messstation im Browser des Telefons: Startbildschirm mit dem Hinweis, dass die Aufnahme auf dem Gerät entsteht und für die Praxis verschlüsselt wird"',
        'alt="Measuring station in the phone browser: start screen stating that the recording is created on the device and encrypted for the practice"');
tausche('alt="Laufende Messung: Puls, Zahl der erfassten Herzschläge, Dauer und eine Ampel für die Signalgüte"',
        'alt="Recording in progress: pulse, number of captured heartbeats, duration and a signal-quality indicator"');
tausche('alt="Ergebnis der Messung: 324 Herzschläge, 9:25 Minuten, Ø Puls 34 bpm, RMSSD 130,3 ms und daneben der Wert über nur unauffällige Paare, 76,2 ms"',
        'alt="Recording result: 324 heartbeats, 9:25 minutes, mean pulse 34 bpm, RMSSD 130.3 ms and next to it the value over unremarkable pairs only, 76.2 ms"');
tausche('alt="Messprotokoll: Signalgüte, auswertbare Schlagpaare 319 von 323, Aufnahmedauer, Sensorbezeichnung und Zeitauflösung 1/1024 Sekunde"',
        'alt="Measurement log: signal quality, 319 of 323 usable beat pairs, recording duration, sensor designation and time resolution of 1/1024 second"');
tausche('alt="RR-Tachogramm über 324 Schläge und darunter die aus der Herzschlag-Modulation abgeleitete Atemkurve"',
        'alt="RR tachogram over 324 beats and below it the breathing curve derived from heartbeat modulation"');
tausche('alt="Der Sende-Knopf An die Praxis senden mit dem Hinweis, dass die Datei auf dem Gerät entsteht und es auf einem selbst gewählten Weg verlässt"',
        'alt="The send button reading Send to the practice, with the note that the file is created on the device and leaves it by a route of your choosing"');
tausche(`Die nächste Aufnahme entsteht in derselben Box nach demselben Protokoll. Genau daraus
         entsteht der Verlauf, den eine Momentaufnahme nie liefern kann.`,
        `The next recording is made in the same box under the same protocol. Exactly that
         builds the trend a snapshot can never provide.`);
tausche(`<b>Nach Abweichung sortiert</b>, nicht nach Eingang — jedes Pferd gegen seine eigene Baseline, nicht gegen eine Tabelle.`,
        `<b>Sorted by deviation</b>, not by arrival — every horse against its own baseline, not against a table.`);
tausche(`<b>Der Wert steht dabei.</b> Eine Stufe ohne den zugrunde liegenden Wert wäre eine Meinung — sie beschreibt Messwerte, keinen Gesundheitszustand.`,
        `<b>The value is shown alongside.</b> A level without its underlying value would be an opinion — it describes measurements, not a state of health.`);
tausche(`<b>Die Halterin ist einen Tipp entfernt</b>, direkt von der Karte aus.`,
        `<b>The owner is one tap away</b>, straight from the card.`);
tausche(`<b>Werte gegen die eigene Baseline</b> des Pferds, als Hinweis. Die Deutung bleibt bei Ihnen.`,
        `<b>Values against the horse's own baseline</b>, as an indication. The interpretation stays with you.`);
tausche(`<b>Signalgüte vor der Zahl</b>: wie viele Schlagpaare tragen die Auswertung überhaupt.`,
        `<b>Signal quality before the number</b>: how many beat pairs actually carry the analysis.`);
tausche(`<b>Beobachtungsnotiz und Messwertbericht</b>, ohne die Akte zu verlassen.`,
        `<b>Observation note and measurement report</b>, without leaving the record.`);
tausche(`Vier Stufen von „im Eigenbereich“ bis „deutliche Abweichung“, immer mit dem Wert, aus dem sie folgen —
           und mit der Abweichung von der Baseline <em>dieses</em> Pferds, nicht von einem&nbsp;Lehrbuchwert.`,
        `Four levels from “within own range” to “marked deviation”, always with the value they follow from —
           and with the deviation from <em>this</em> horse’s baseline, not from a&nbsp;textbook value.`);
tausche(`Anteil auswertbarer Schlagpaare, Artefaktrate, korrigierte AV-Block-Pausen.
           Eine Aufnahme, die nichts trägt, sagt Ihnen das — statt eine Zahl zu zeigen.`,
        `Share of usable beat pairs, artefact rate, corrected AV-block pauses.
           A recording that carries nothing tells you so — instead of showing a number.`);
tausche(`Fünf HRV-Kennwerte, einzeln aufgeführt, verglichen mit den Gruppenmitteln einer
           veröffentlichten Vergleichsstudie (Nyerges-Bohák 2025, Equine Veterinary Journal, n&nbsp;=&nbsp;40).
           Die Studie berichtet Gruppenunterschiede, <strong>keine Schwellenwerte</strong> — unsere
           Vergleichsgrenzen sind eine eigene Ableitung, offen dokumentiert in der Methodik.
           Ein Messmuster, <strong>keine gesundheitliche Einstufung</strong>.`,
        `Five HRV measures, listed individually, compared with the group means of a
           published comparison study (Nyerges-Bohák 2025, Equine Veterinary Journal, n&nbsp;=&nbsp;40).
           The study reports group differences, <strong>no threshold values</strong> — our
           comparison limits are our own derivation, documented openly in the methodology.
           A measurement pattern, <strong>not a health classification</strong>.`);
tausche(`Tachogramm, Poincaré, Spektrum, DFA, Histogramm — dieselben Darstellungen wie
           in der iOS-App, im Vollbild neu gezeichnet statt hochskaliert.`,
        `Tachogram, Poincaré, spectrum, DFA, histogram — the same views as in the iOS app,
           redrawn at full size rather than scaled up.`);
tausche(`Messwertbericht mit Ihrem Briefkopf, Rückmeldung an die Halterin, und eine
           Übersicht über Leistungen, Fahrten und Zeiten.`,
        `A measurement report on your own letterhead, feedback to the owner, and an overview
           of services, trips and times.`);
tausche(`JSON, CSV, Kubios-kompatibel — und <strong>FHIR&nbsp;R5</strong> mit
           LOINC-Codes für die Praxissoftware.`,
        `JSON, CSV, Kubios-compatible — and <strong>FHIR&nbsp;R5</strong> with
           LOINC codes for your practice software.`);
tausche(`
      Ein ruhendes Pferd zeigt AV-Block-Pausen — physiologisch, kein Befund. Rechnet man
      sie roh mit, steigen SDNN und RMSSD dramatisch, und die Kennwerte, die bei
      <em>kleinen</em> Werten anschlagen, kippen ins Gegenteil.
    `,
        `
      A resting horse shows AV-block pauses — physiological, not a finding. Count them in
      raw and SDNN and RMSSD rise dramatically, and the measures that respond to
      <em>small</em> values flip into the opposite.
    `);
tausche(`AV-Block-Pausen, Bewegungs-Artefakte, unplausible Schläge — die Auswertung
         erkennt und korrigiert sie, <strong>bevor</strong> ein Kennwert entsteht. Ob
         eine Aufnahme aus der App kommt oder aus der Browser-Station: Sie bekommen
         denselben, bereinigten Wert. Und wenn eine Datei die Kette nachweislich
         <em>nicht</em> durchlaufen hat, steht das im Bericht — dann sind es rohe
         Werte, und der Bericht sagt es, statt eine Bereinigung zu behaupten.
         <a href="/carlon-equine/methodik.html">Jede Stufe mit ihrem Schwellenwert →</a>`,
        `AV-block pauses, motion artefacts, implausible beats — the analysis detects
         and corrects them <strong>before</strong> any metric is computed. Whether a
         recording comes from the app or from the browser station: you get the same,
         cleaned value. And where a file demonstrably did <em>not</em> pass through
         the chain, the report says so — those are raw values, and the report states
         it instead of claiming a correction that never happened.
         <a href="/carlon-equine/methodik.html">Every stage with its threshold →</a>`);
tausche(`Ungefiltert wirkt ein ruhendes Pferd systematisch auffälliger, als es ist.
         Eine Übersicht, die zu oft Abweichungen zeigt, ist so wertlos wie eine, die keine zeigt —
         deshalb wird erst bereinigt, dann verglichen. Damit eine Abweichung
         auffällt, weil sie im Pferd liegt. Nicht in der Messung.`,
        `Unfiltered, a resting horse looks systematically more conspicuous than it is.
         An overview that shows deviations too often is as worthless as one that shows none —
         so the data is cleaned first, compared second. So that a deviation
         stands out because it lies in the horse. Not in the measurement.`);
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
tausche(`Haltung, Fütterung, Management, Training: Die nächste Aufnahme entsteht im
           eigenen Stall nach demselben Protokoll. Als Beobachtung — die Bewertung
           bleibt bei Ihnen.`,
        `Housing, feeding, management, training: the next recording is made in the
           horse’s own stable under the same protocol. As an observation — the assessment
           stays with you.`);
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
tausche(`<b>Standard ist die kürzeste Strecke.</b> Auf Wunsch sortieren Sie Pferde mit deutlicher Abweichung nach vorn, per Greifpunkt verschieben Sie jeden Stopp — die Software ordnet, Sie entscheiden.`,
        `<b>The default is the shortest route.</b> If you wish, you move horses with a marked deviation to the front, and drag any stop by its handle — the software arranges, you decide.`);
tausche(`<b>Nichts davon verlässt Ihr Gerät von selbst</b> — erst Ihr Tipp übergibt
            die Route an die Karten-App.`,
        `<b>None of it leaves your device on its own</b> — only your tap hands
            the route to the maps app.`);
tausche(`
      CARLON erfasst Ihre Leistungen, Fahrten und Zeiten dort, wo sie entstehen, und gibt sie
      als CSV heraus. Was Sie davon wie abrechnen, entscheiden Sie nach der tatsächlich
      erbrachten Leistung — die Software rechnet nicht ab und verspricht keinen Erlös.
    `,
        `
      CARLON records your services, trips and times where they arise, and exports them
      as CSV. What you invoice and how is your decision, based on the work actually
      done — the software does not invoice and promises no revenue.
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
tausche(`Ihre Pferdedaten liegen im Speicher Ihres Geräts. Wir haben keinen Zugriff und
           könnten sie auch nicht löschen. Die Aufnahme der Halterin läuft gar nicht erst
           über uns: Sie schickt Ihnen eine Datei — geöffnet über Ihren Mess-Link, ist sie
           von der ersten Sekunde an für Ihre Praxis verschlüsselt.`,
        `Your horse data lives in your device's storage. We have no access and could not
           delete it either. The owner's recording never passes through us at all: she
           sends you a file — opened via your measuring link, it is encrypted for your
           practice from the very first second.`);
tausche(`Eine zugeschickte Datei ist kein Anruf. Bei akuten Beschwerden gilt, was immer
           gilt — unmittelbar tierärztlich handeln.`,
        `A file someone sends you is not a phone call. In acute cases what always applies
           still applies — act veterinarily, immediately.`);
tausche(`
      Ein Betrieb — eine Praxis oder ein Standort — mit allen tierärztlichen und
      tiermedizinischen Mitarbeitenden und auf beliebig vielen Geräten dieses Betriebs.
      Es gibt <strong>keine Gebühr je Pferd, je Nutzer oder je Gerät</strong> und keine Grenze für Aufnahmen.
    `,
        `
      One business — one practice or one site — with all veterinary staff and on any
      number of that business's devices. There is <strong>no fee per horse, per user or
      per device</strong> and no limit on recordings.
    `);
/* (Der Absatz mit dem Angebot steht weiter unten in der praezisierten
   Fassung — hier waere er doppelt.) */
tausche(`
      Das Demo-Cockpit ist nicht ein Video und keine Bildstrecke, sondern die vollständige
      Anwendung. Öffnen Sie eine Akte, drehen Sie an den Ansichten, erstellen Sie einen
      Messwertbericht. Ein Pferd im Bestand zeigt einen Abwärtsverlauf über vier Wochen — sehen Sie
      selbst, ab wann er sichtbar wird.
    `,
        `
      The demo cockpit is not a video and not a slideshow, but the complete application.
      Open a record, work the views, create a measurement report. One horse in the list shows a
      downward trend over four weeks — see for yourself from when it becomes visible.
    `);
tausche(`Nein. CARLON bereitet Verlaufsdaten auf und hilft bei der Reihenfolge. Ob eine
           klinische Untersuchung, weitere Diagnostik oder eine Behandlung nötig ist,
           entscheiden ausschließlich Sie.`,
        `No. CARLON prepares trend data and helps with the order of visits. Whether a
           clinical examination, further diagnostics or treatment is needed is decided by
           you alone.`);
tausche(`Einen Polar-H10-Brustgurt und ein Android-Gerät oder einen Rechner mit
           Chrome oder Edge. Auf iPhone und iPad lässt Apple Bluetooth im Browser nicht zu;
           die Seite führt dort auf ein messfähiges Gerät.`,
        `A Polar H10 chest belt and an Android device or a computer with
           Chrome or Edge. On iPhone and iPad, Apple does not permit Bluetooth in the
           browser; the page directs you to a capable device there.`);
tausche(`Die Anwendung wechselt in einen funktionsreduzierten Modus. Ihre Daten bleiben
           auf dem Gerät und lassen sich weiterhin öffnen und exportieren. Wir könnten sie
           gar nicht löschen — sie liegen bei Ihnen.`,
        `The application switches to a reduced mode. Your data stays on the device and can
           still be opened and exported. We could not delete it — it is with you.`);
tausche(`Nein. Das Cockpit läuft vollständig in Ihrem Browser, und auch die Aufnahme der
           Halterin erreicht uns nicht: Ihre Messstation legt eine Datei auf ihrem eigenen
           Gerät an, die sie Ihnen selbst schickt. Es gibt keinen Zwischenspeicher bei uns —
           und damit nichts, worüber ein Auftragsverarbeitungsvertrag zu schließen wäre.`,
        `No. The cockpit runs entirely in your browser, and the owner's recording never
           reaches us either: her measuring station creates a file on her own device, which
           she sends to you herself. There is no relay at our end — and therefore nothing a
           data processing agreement could be about.`);


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


/* ── STRUKTURIERTE DATEN ──────────────────────────────────────────────
   Die FAQ-Antworten stehen im Schema OHNE Zeilenumbrueche, die sichtbaren
   Absaetze MIT. Deshalb hier noch einmal einzeln — und wortgleich zur
   englischen Fassung des sichtbaren Textes, sonst faellt t-schemadaten.
   Google verlangt genau diese Uebereinstimmung. */
tausche('CARLON Equine Visite — the practice view for equine vets &amp; clinics</title>',
        'CARLON Equine Visite — the practice view for equine vets &amp; clinics</title>');
tausche('"applicationSubCategory": "Veterinärmedizinische Praxis-Software"',
        '"applicationSubCategory": "Veterinary practice software"');
tausche('"operatingSystem": "Web (Chrome, Edge, Safari)"',
        '"operatingSystem": "Web (Chrome, Edge, Safari)"');
tausche(`"description": "Browser-Werkzeug für Pferdepraxen und -kliniken: Tourenplanung, Ruhe-HRV-Verlauf je Pferd gegen die eigene Vorgeschichte, Signalgüte, Messwertbericht und Export als FHIR R5. Kein Medizinprodukt, keine Diagnose."`,
        `"description": "Browser tool for equine practices and clinics: round planning, resting HRV trend per horse against its own history, signal quality, measurement report and export as FHIR R5. Not a medical device, not a diagnosis."`);
tausche('"audienceType": "Tierärztinnen und Tierärzte, Pferdekliniken"',
        '"audienceType": "Equine veterinarians and equine clinics"');
tausche('"text": "Nein. CARLON bereitet Verlaufsdaten auf und hilft bei der Reihenfolge. Ob eine klinische Untersuchung, weitere Diagnostik oder eine Behandlung nötig ist, entscheiden ausschließlich Sie."',
        '"text": "No. CARLON prepares trend data and helps with the order of visits. Whether a clinical examination, further diagnostics or treatment is needed is decided by you alone."');
tausche('"text": "Einen Polar-H10-Brustgurt und ein Android-Gerät oder einen Rechner mit Chrome oder Edge. Auf iPhone und iPad lässt Apple Bluetooth im Browser nicht zu; die Seite führt dort auf ein messfähiges Gerät."',
        '"text": "A Polar H10 chest belt and an Android device or a computer with Chrome or Edge. On iPhone and iPad, Apple does not permit Bluetooth in the browser; the page directs you to a capable device there."');

/* Die zwei neuen FAQ-Karten (13.08., Persona-Pass) — Frage-Titel stehen
   doppelt (Karte + JSON-LD-name), daher n=2; die Antworten getrennt als
   Karten-Block und als JSON-LD-Zeile. */
tausche('Was taugt eine Messung von Laienhand?',
        'How good can a layperson’s recording be?', 2);
tausche(`Jede Aufnahme bringt ihr Messprotokoll mit: Anteil auswertbarer Schlagpaare,
           Artefaktrate, Sensor, Zeitauflösung. Eine Aufnahme, die nichts trägt, wird genau
           so ausgewiesen — Sie deuten nie blind. Und die Rohdaten liegen bei: jeder
           einzelne Schlagabstand.`,
        `Every recording carries its own measurement report: share of usable beat pairs,
           artefact rate, sensor, timing resolution. A recording that carries nothing is
           flagged as exactly that — you never interpret blind. And the raw data comes
           with it: every single beat interval.`);
tausche('"text": "Jede Aufnahme bringt ihr Messprotokoll mit: Anteil auswertbarer Schlagpaare, Artefaktrate, Sensor, Zeitauflösung. Eine Aufnahme, die nichts trägt, wird genau so ausgewiesen — Sie deuten nie blind. Und die Rohdaten liegen bei: jeder einzelne Schlagabstand."',
        '"text": "Every recording carries its own measurement report: share of usable beat pairs, artefact rate, sensor, timing resolution. A recording that carries nothing is flagged as exactly that — you never interpret blind. And the raw data comes with it: every single beat interval."');
tausche(`Worauf beruht das Atemmuster-Profil?`,
        `What is the breathing-pattern profile based on?`, 2);
tausche(`Auf einer veröffentlichten Vergleichsstudie (Nyerges-Bohák 2025, Equine Veterinary
           Journal, n = 40), die Gruppenunterschiede in SD2, SDNN, TINN und SD2/SD1 berichtet —
           einen Schwellenwert enthält sie nicht. Unsere Vergleichsgrenzen liegen zwischen ihren
           Gruppenmitteln; das ist eine eigene Ableitung, kein Literaturwert, und jede Grenze
           steht einzeln in der Methodik. Das Profil beschreibt ein Messmuster — es stellt
           nichts fest und ersetzt keine Untersuchung.`,
        `On a published comparison study (Nyerges-Bohák 2025, Equine Veterinary
           Journal, n = 40) that reports group differences in SD2, SDNN, TINN and SD2/SD1 —
           it contains no threshold value. Our comparison limits sit between its group
           means; that is our own derivation, not a value from the literature, and every limit
           is listed individually in the methodology. The profile describes a measurement
           pattern — it establishes nothing and replaces no examination.`);
tausche(`"text": "Auf einer veröffentlichten Vergleichsstudie (Nyerges-Bohák 2025, Equine Veterinary Journal, n = 40), die Gruppenunterschiede in SD2, SDNN, TINN und SD2/SD1 berichtet — einen Schwellenwert enthält sie nicht. Unsere Vergleichsgrenzen liegen zwischen ihren Gruppenmitteln; das ist eine eigene Ableitung, kein Literaturwert, und jede Grenze steht einzeln in der Methodik. Das Profil beschreibt ein Messmuster — es stellt nichts fest und ersetzt keine Untersuchung."`,
        `"text": "On a published comparison study (Nyerges-Bohák 2025, Equine Veterinary Journal, n = 40) that reports group differences in SD2, SDNN, TINN and SD2/SD1 — it contains no threshold value. Our comparison limits sit between its group means; that is our own derivation, not a value from the literature, and every limit is listed individually in the methodology. The profile describes a measurement pattern — it establishes nothing and replaces no examination."`);
tausche('"text": "Die Anwendung wechselt in einen funktionsreduzierten Modus. Ihre Daten bleiben auf dem Gerät und lassen sich weiterhin öffnen und exportieren. Wir könnten sie gar nicht löschen — sie liegen bei Ihnen."',
        '"text": "The application switches to a reduced mode. Your data stays on the device and can still be opened and exported. We could not delete it — it is with you."');
tausche('"text": "Nein. Das Cockpit läuft vollständig in Ihrem Browser, und auch die Aufnahme der Halterin erreicht uns nicht: Ihre Messstation legt eine Datei auf ihrem eigenen Gerät an, die sie Ihnen selbst schickt. Es gibt keinen Zwischenspeicher bei uns — und damit nichts, worüber ein Auftragsverarbeitungsvertrag zu schließen wäre."',
        '"text": "No. The cockpit runs entirely in your browser, and the owner\'s recording never reaches us either: her measuring station creates a file on her own device, which she sends to you herself. There is no relay at our end — and therefore nothing a data processing agreement could be about."');
tausche('"url": "https://vitalkultur.com/carlon-equine-visite/",',
        '"url": "https://vitalkultur.com/carlon-equine-visite/en/",');


/* Muster-Bericht — das Artefakt, an dem ein Tierarzt uns beurteilt.
   Rollentrennung (13.08.2026): die Software liefert den BERICHT, den
   Befund macht die Praxis — deshalb hier nie "findings". */
tausche('Sehen Sie den Bericht, bevor Sie irgendetwas entscheiden.',
        'See the report before you decide anything.');
tausche(`Aus dem Demo-Bestand erzeugt (fiktive Beispieldaten) — Kennwerte, Puls- und HRV-Kurve,
        Poincaré, RR-Verteilung, Leistungsspektrum in den equinen Bandgrenzen und der RMSSD-Verlauf über
        Wochen, dazu „Methode &amp; Grenzen" mit Quellen.
        Der Bericht liefert die Daten; den Befund macht Ihre Praxis.`,
`Generated from the demo library (fictitious sample data) — key values, heart-rate and HRV
        curve, Poincaré plot, RR distribution, power spectrum in the equine frequency bands and the RMSSD
        trend across weeks, plus a "Method & limits" section naming the sources.
        The report delivers the data; the findings are made by your practice.`);
tausche('>Muster-Bericht als PDF<', '>Sample report (PDF)<');


/* Umsatzsteuer — WESSEN. Der Kern der Klaerung vom 12.08.2026. */
/* Die Nutzen-Schwelle vor dem Preis (15.08.2026). GOT-Ziffern bleiben
   auch auf Englisch stehen — sie sind der deutsche Gebuehrenrahmen und
   werden nicht uebersetzt, nur erklaert. */
tausche(`Vergleichbare Systeme im Pferdesport rechnen <em>je Pferd</em> oder mit eigenem Sensor ab;
      hier nutzen Sie einen handelsüblichen Polar-H10-Gurt. Testen Sie den ganzen Ablauf vorher
      im Demo-Cockpit — ohne Konto.`,
        `Comparable systems in equine sport bill <em>per horse</em> or with their own sensor;
      here you use an off-the-shelf Polar H10 strap. Try the whole workflow first
      in the demo cockpit — no account.`);

tausche('<div class="tarif-preis"><b>149&nbsp;€</b> <span>netto im Monat · USt. weist Stripe aus</span></div>',
        '<div class="tarif-preis"><b>149&nbsp;€</b> <span>net per month · VAT charged by Stripe</span></div>');
tausche(`Das Angebot richtet sich ausschließlich an Unternehmer im Sinne des § 14 BGB.
        Für das Browser-Cockpit tritt <strong>Stripe als Verkäufer im eigenen Namen</strong> auf
        (Merchant of Record): Sie erhalten von dort eine Rechnung mit ausgewiesener Umsatzsteuer
        für Ihren Vorsteuerabzug; mit gültiger EU-USt-IdNr. greift das Reverse-Charge-Verfahren.
        Vitalkultur selbst ist Kleinunternehmer nach § 19 UStG. Einzelheiten in`,
`This offer is directed exclusively at businesses within the meaning of § 14 BGB.
        For the browser cockpit, <strong>Stripe acts as the seller in its own name</strong>
        (merchant of record): you receive an invoice from Stripe showing VAT for your input-tax
        deduction; with a valid EU VAT ID the reverse-charge procedure applies.
        Vitalkultur itself is a small business under § 19 UStG. Details in`);


/* Positiv behauptet statt doppelt verneint (Copy-CI §12). */
tausche('Ein Preis für den ganzen Betrieb.',
        'One price for the whole business.');
/* im Rumpftext-Block mituebersetzt */
/* in der Hero-Preiszeile mituebersetzt */

// Lightbox (Bedienelemente sind aria-only — sichtbar sind nur Zeichen)
tausche('aria-label="Bildansicht"', 'aria-label="Image view"');
tausche('aria-label="Schließen"', 'aria-label="Close"');
tausche('aria-label="Vorheriges Bild"', 'aria-label="Previous image"');
tausche('aria-label="Nächstes Bild"', 'aria-label="Next image"');


/* ══ NEUE BLOECKE (13.08., Persona-/Kybernetik-Audit) ══════════════════ */

// Hero: Beta-Satz (verschwindet bei CARLON_LIVE=true von selbst)
tausche('<span id="heroBeta"> Wir sind in der Beta und begleiten jede Praxis persönlich — wer jetzt einsteigt, behält seinen Preis als Gründungspartner.</span>',
        '<span id="heroBeta"> We are in beta and accompany every practice personally — join now and you keep your price as a founding partner.</span>');

// Kundin-erlebt-Praxis-Karte (Messstation)
tausche('Ihre Kundin erlebt Ihre Praxis, nicht unsere Software',
        'Your client experiences your practice, not our software');
tausche(`Sie misst über Ihren Mess-Link auf Ihre Empfehlung, und die Rückmeldung trägt
         Ihren Briefkopf. Jede Aufnahme zwischen zwei Besuchen wird zu einem
         Kontaktpunkt Ihrer Praxis.`,
        `She records via your measuring link on your recommendation, and the reply carries
         your letterhead. Every recording between two visits becomes a
         touchpoint of your practice.`);

// Physiologie-Lead (Warum die Zahlen tragen)
tausche(`
      Die Herzratenvariabilität wird mit der Aktivität des autonomen Nervensystems in
      Verbindung gebracht — dem Wechselspiel aus Sympathikus und Parasympathikus. Sie ist
      damit kein Ablesen eines Zustands: einen belastbaren Normwert gibt es beim Pferd
      nicht. Für die Abweichungsstufen zählt deshalb die eigene Vorgeschichte des Pferds. Nur das
      Atemmuster-Profil vergleicht zusätzlich mit festen Grenzen — und die sind aus den
      Gruppenmitteln einer Studie abgeleitet, nicht aus ihr übernommen (Nyerges-Bohák 2025).
    `,
        `
      Heart rate variability is associated with the activity of the autonomic nervous
      system — the interplay of sympathetic and parasympathetic tone. It is therefore not
      a readout of a state: there is no robust normal value in the horse. That is why the
      deviation levels rest on the horse's own history. Only the breathing-pattern profile
      additionally compares with fixed limits — and those are derived from the group means of a
      study, not taken from it (Nyerges-Bohák 2025).
    `);

// Start-Sektion (So beginnt Ihre Praxis)
tausche('<div class="sec-eyebrow">Der Start</div>', '<div class="sec-eyebrow">Getting started</div>');
tausche('<h2>So beginnt Ihre Praxis.</h2>', '<h2>How your practice begins.</h2>');
tausche('<div class="u-k">Schritt 1</div>', '<div class="u-k">Step 1</div>');
tausche('<div class="u-k">Schritt 2</div>', '<div class="u-k">Step 2</div>');
tausche('<div class="u-k">Schritt 3</div>', '<div class="u-k">Step 3</div>');
tausche('<h3>Mess-Link teilen</h3>', '<h3>Share your measuring link</h3>');
tausche(`Ihr Cockpit erzeugt Ihren persönlichen Mess-Link — er trägt Ihren Schlüssel.
           Verschicken Sie ihn als Nachricht, setzen Sie ihn auf Ihre Praxis-Website —
           oder drucken Sie ihn als QR-Aushang für Stallgasse und Wartezimmer.`,
        `Your cockpit creates your personal measuring link — it carries your key.
           Send it as a message, put it on your practice website — or print it as a
           QR poster for the barn aisle and the waiting room.`);
tausche('<h3>Die Halterin öffnet und misst</h3>', '<h3>The owner opens it and records</h3>');
tausche(`Ein Tipp auf den Link oder ein Scan, und die Messstation ist da — im Browser,
           ohne App, ohne Konto. Jede Aufnahme ist von der ersten Sekunde an für Ihre
           Praxis verschlüsselt; die Datei schickt die Halterin auf dem Weg, den sie
           ohnehin nutzt.`,
        `One tap on the link or one scan, and the measuring station is there — in the
           browser, no app, no account. Every recording is encrypted for your practice
           from the very first second; the owner sends you the file on whatever channel
           she already uses.`);
tausche('<h3>Datei ins Cockpit ziehen</h3>', '<h3>Drag the file into the cockpit</h3>');
tausche(`Signalgüte und der Vergleich mit der eigenen Vorgeschichte stehen sofort da —
           der Messwertbericht ist aus der Akte heraus erstellt, die Einordnung machen Sie.`,
        `Signal quality and the comparison with the horse's own history are there at once —
           the measurement report is created straight from the record, the interpretation is yours.`);

// FAQ: Nacht-Einwand + Baseline (Titel doppelt: Karte + JSON-LD-name)
tausche('Entsteht daraus eine Pflicht, ständig hinzusehen?',
        'Does this create a duty to keep watching?', 2);
tausche(`Nein. CARLON sendet keine Alarme, und die Halterin sieht keine Einstufung —
           die entsteht erst in Ihrem Cockpit, wenn Sie es öffnen. Eine zugeschickte
           Datei ist eine Zusendung wie eine E-Mail: Wann Sie sie sichten, bestimmen
           Sie und kommunizieren es wie bisher. Für den Notfall gilt, was immer gilt:
           der Anruf.`,
        `No. CARLON sends no alerts, and the owner sees no classification — it only
           comes into being in your cockpit, when you open it. A file sent to you is a
           delivery like an email: when you review it is up to you, communicated to your
           clients as before. For emergencies, what has always applied still applies:
           the phone call.`);
tausche('"text": "Nein. CARLON sendet keine Alarme, und die Halterin sieht keine Einstufung — die entsteht erst in Ihrem Cockpit, wenn Sie es öffnen. Eine zugeschickte Datei ist eine Zusendung wie eine E-Mail: Wann Sie sie sichten, bestimmen Sie und kommunizieren es wie bisher. Für den Notfall gilt, was immer gilt: der Anruf."',
        '"text": "No. CARLON sends no alerts, and the owner sees no classification — it only comes into being in your cockpit, when you open it. A file sent to you is a delivery like an email: when you review it is up to you, communicated to your clients as before. For emergencies, what has always applied still applies: the phone call."');
tausche('Woher kommt die Baseline?', 'Where does the baseline come from?', 2);
tausche(`Aus den Ruhemessungen dieses Pferds selbst: Ab vier eigenen Aufnahmen gilt der
           Wert als individuelle Baseline. Bis dahin zeigt das Cockpit offen an, dass der
           Vergleichswert noch aus dem Referenz-Datensatz stammt — und wie viele eigene
           Aufnahmen noch fehlen. Es tut nicht so, als wüsste es schon etwas.`,
        `From this horse's own resting recordings: from four recordings on, the value
           counts as an individual baseline. Until then the cockpit openly shows that the
           comparison value still comes from the reference dataset — and how many of the
           horse's own recordings are still missing. It does not pretend to know
           something it does not.`);
tausche('"text": "Aus den Ruhemessungen dieses Pferds selbst: Ab vier eigenen Aufnahmen gilt der Wert als individuelle Baseline. Bis dahin zeigt das Cockpit offen an, dass der Vergleichswert noch aus dem Referenz-Datensatz stammt — und wie viele eigene Aufnahmen noch fehlen. Es tut nicht so, als wüsste es schon etwas."',
        '"text": "From this horse\'s own resting recordings: from four recordings on, the value counts as an individual baseline. Until then the cockpit openly shows that the comparison value still comes from the reference dataset — and how many of the horse\'s own recordings are still missing. It does not pretend to know something it does not."');



// Evidenz-Marke (Comet-Audit) — nur der uebersetzbare Chip
tausche('<span>n = 40 · Vergleichsgruppen 20 / 20</span>',
        '<span>n = 40 · comparison groups 20 / 20</span>');
tausche('<span>Schwellen: eigene Ableitung</span>', '<span>Thresholds: our own derivation</span>');
tausche(`aria-label="Bezugsstudie des Atemmuster-Profils"`,
        `aria-label="Reference study of the breathing-pattern profile"`);


// Zwei Preis-Stufen (13.08.)


/* Klinik-Tarif + Abgrenzung (13.11.2026, Ganzheits-Kreis Runde 2) */
tausche(`<div class="tarif-name">Für Pferdepraxen</div>`, `<div class="tarif-name">For equine practices</div>`);
tausche(`<div class="tarif-name">Für Pferdekliniken</div>`, `<div class="tarif-name">For equine clinics</div>`);
tausche(`<div class="tarif-alt">oder 3.490&nbsp;€ im Jahr — entspricht 290,83&nbsp;€ im Monat, zwei Monate gespart</div>`, `<div class="tarif-alt">or €3,490 a year — equivalent to €290.83 a month, two months saved</div>`);
tausche(`<div class="tarif-alt">An der Kasse für Kliniken in Deutschland: 415,31&nbsp;€ im Monat bzw. 4.153,10&nbsp;€ im Jahr, jeweils inkl. 19&nbsp;% USt.</div>`, `<div class="tarif-alt">At checkout for clinics in Germany: €415.31 a month or €4,153.10 a year, each incl. 19&nbsp;% VAT.</div>`);
tausche(`<li>Alles aus der Praxis-Stufe</li>`, `<li>Everything in the practice plan</li>`);
tausche(`<li>Gemeinsamer Bestand über Ihren Klinik-Ordner auf dem vorhandenen Netzlaufwerk — jedes Gerät sieht denselben Stand, ohne Cloud</li>`, `<li>Shared records via your clinic folder on your existing network drive — every device sees the same state, no cloud</li>`);
tausche(`<li>Stationswand für den Monitor im Stationszimmer</li>`, `<li>Station wall for the monitor in the ward</li>`);
tausche(`<li>Mehrere Plätze in einer Lizenz</li>`, `<li>Several seats in one licence</li>`);
tausche(`<li>Feste Methodenversion je Auswertung — für Archiv und Studien</li>`, `<li>A fixed method version per analysis — for archives and studies</li>`);
tausche(`<div class="eyebrow">Einordnung</div>`, `<div class="eyebrow">Positioning</div>`);
tausche(`<h2>Wofür CARLON gebaut ist — und wofür andere Werkzeuge da sind.</h2>`, `<h2>What CARLON is built for — and what other tools are for.</h2>`);
tausche(`<h3>Belastung im Training und Galopp</h3><p>Die Domäne spezialisierter Trainingssysteme mit eigenem Sensor, etwa Arioneo Equimetre oder EQUIMO.</p>`, `<h3>Load in training and at the gallop</h3><p>The domain of dedicated training systems with their own sensor, such as Arioneo Equimetre or EQUIMO.</p>`);
tausche(`<h3>Gangbild und Bewegung</h3><p>Die Domäne der Video-Ganganalyse, etwa Sleip.</p>`, `<h3>Gait and movement</h3><p>The domain of video gait analysis, such as Sleip.</p>`);
tausche(`<h3>Schneller Live-Puls am Telefon</h3><p>Dafür reicht die kostenlose Polar-Equine-App.</p>`, `<h3>A quick live pulse on the phone</h3><p>The free Polar Equine app does that.</p>`);
tausche(`<h3>Ruhe-HRV im eigenen Stall, als Verlauf</h3><p><strong>CARLON Equine:</strong> wiederholbare Aufnahmen gegen die eigene Vorgeschichte, AV-Pausen sauber getrennt, Auswertung im Browser, FHIR&nbsp;R5 — ein Preis für den Betrieb.</p>`, `<h3>Resting HRV in the horse’s own stable, as a trend</h3><p><strong>CARLON Equine:</strong> repeatable recordings against the horse’s own history, AV pauses cleanly separated, analysis in the browser, FHIR&nbsp;R5 — one price for the practice.</p>`);
tausche('Nur für Tierarztpraxen und Pferdekliniken — Bestellung ausschließlich als Unternehmen (§ 14 BGB).', 'For veterinary practices and equine clinics only — orders exclusively as a business (§ 14 BGB).');

/* 13.11. Conversion C0 */
tausche('<p class="rollen-weiche"><a href="#arbeitstag">Für Fahrpraxen ↓</a> · <a href="#klinik">Für Pferdekliniken ↓</a></p>', '<p class="rollen-weiche"><a href="#arbeitstag">For mobile practices ↓</a> · <a href="#klinik">For equine clinics ↓</a></p>');
tausche('>Die Bereinigung an 15 Beispielpferden selbst prüfen →<', '>Check the cleaning yourself on 15 example horses →<');
tausche('>Zu den Tarifen ↓<', '>To the plans ↓<');
tausche('<div class="sec-eyebrow">Für Pferdekliniken</div>', '<div class="sec-eyebrow">For equine clinics</div>');
tausche('<h2>Auf Station derselbe Stand. Zu Hause geht der Verlauf weiter.</h2>', '<h2>The same picture on the ward. At home the trend continues.</h2>');
tausche('alt="Stationswand: alle aufgenommenen Pferde als Kacheln mit bereinigtem RMSSD, Ruhe-HF, Abweichung von der eigenen Basis, Signalgüte und Protokoll"', 'alt="Ward wall: all recorded horses as tiles with cleaned RMSSD, resting HR, deviation from their own baseline, signal quality and protocol"');
tausche('<div class="f-k">Stationswand · Klinik-Ordner</div>', '<div class="f-k">Ward wall · clinic folder</div>');
tausche('<h3>Ein Bildschirm im Stationszimmer, auf dem das ganze Team dasselbe sieht.</h3>', '<h3>One screen in the ward office where the whole team sees the same thing.</h3>');
tausche('<li><b>Übersichtswand ohne Alarme</b> — jede Box mit bereinigtem RMSSD, Ruhe-HF, Signalgüte und Protokoll, sortiert nach Abweichung von der eigenen Basis.</li>', '<li><b>Overview wall without alarms</b> — every box with cleaned RMSSD, resting HR, signal quality and protocol, sorted by deviation from its own baseline.</li>');
tausche('<li><b>Gemeinsamer Klinik-Ordner</b> auf Ihrem vorhandenen Netzlaufwerk — jedes Gerät im Haus liest denselben Stand, ohne Cloud.</li>', '<li><b>Shared clinic folder</b> on your existing network drive — every device in the building reads the same state, no cloud.</li>');
tausche('<li><b>Nach der Entlassung</b> geben Sie den Mess-Link mit: Die nächsten Ruheaufnahmen aus der gewohnten Box landen in derselben Akte.</li>', '<li><b>After discharge</b> you hand over the recording link: the next resting recordings from the horse’s usual stable land in the same record.</li>');
tausche('<li><b>Feste Methodenversion</b> je Auswertung — für Archiv, Fallbesprechung und Studien.</li>', '<li><b>Fixed method version</b> per analysis — for archive, case review and studies.</li>');
tausche('>Stationswand im Demo ansehen →<', '>See the ward wall in the demo →<');
tausche('<div class="g-k">Persönlich, nicht anonym</div>', '<div class="g-k">Personal, not anonymous</div>');
tausche(`<p><b>Entwickelt und betreut von Jan Rohwedder</b> (Vitalkultur, Iffezheim). Es gibt noch keine
         Referenzlogos auf dieser Seite — und wir erfinden auch keine. Stattdessen erreichen Sie den
         Entwickler direkt, vor und nach dem Kauf.</p>`, `<p><b>Built and supported by Jan Rohwedder</b> (Vitalkultur, Iffezheim, Germany). There are no
         reference logos on this page yet — and we won’t invent any. Instead you reach the
         developer directly, before and after you buy.</p>`);
tausche('<p class="g-kontakt">Frage vorab? Schreiben Sie an', '<p class="g-kontakt">A question first? Write to');
tausche(' — Antwort meist am selben Tag.</p>', ' — usually answered the same day.</p>');
tausche('>Praxis-Abo wählen · 149&nbsp;€ / Monat →<', '>Choose practice plan · €149 / month →<');
tausche('>Oder erst eine persönliche Einführung ↓<', '>Or a personal introduction first ↓<');
tausche('>Klinik-Abo wählen · 349&nbsp;€ / Monat →<', '>Choose clinic plan · €349 / month →<');
tausche('>Klinik-Ordner vorab im Gespräch klären ↓<', '>Discuss the clinic folder first ↓<');
if (fehlend.length) {
  console.error('\n  ✗ Der Bau bricht ab — diese Bloecke gibt es in index.html nicht (mehr):\n');
  for (const f of fehlend) console.error(`      ${f.erwartet}× erwartet, ${f.gefunden}× gefunden:  „${f.de}…"`);
  console.error('\n  Die deutsche Seite hat sich geaendert. Uebersetzung nachziehen, dann neu bauen.\n');
  process.exit(1);
}

mkdirSync(join(HIER, 'en'), { recursive: true });
writeFileSync(join(HIER, 'en', 'index.html'), s, 'utf8');
console.log(`  ✓ en/index.html gebaut · ${ersetzt} Bloecke ersetzt · ${s.length} Zeichen`);
