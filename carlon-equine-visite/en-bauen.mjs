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
tausche('Betreuung, die nicht an der Stalltür endet.',
        'Care that does not stop at the stable door.');
tausche(`Der Anruf sagt „irgendwie nicht fit". Die Messung, die Ihnen die Halterin aus dem
      Stall schickt, sagt, wie weit dieses Pferd von <strong>seiner eigenen</strong>
      Baseline abweicht — Sie entscheiden mit Datengrundlage, wer heute dran ist und
      wer bis zur Kontrolle warten kann.`,
`The phone call says “not quite right somehow”. The recording the owner sends you from
      the stable says how far this horse deviates from <strong>its own</strong> baseline —
      you decide on evidence who is up today and who can wait until the follow-up.`);
tausche('Cockpit mit 15&nbsp;Demo-Pferden öffnen →', 'Open the cockpit with 15&nbsp;demo horses →', 2);
tausche('>Was es kostet<', '>What it costs<');
tausche('Das Demo-Cockpit ist die vollständige Anwendung mit echten Beispielverläufen — ohne Konto, ohne Installation. Die Daten verlassen Ihre Praxis nicht.',
        'The demo cockpit is the complete application with real example trends — no account, no installation. The data never leaves your practice.');
/* Hero-Belege + Visual (13.08.: φ-Split-Kopf) */
tausche('<li><b>Gemessen im Stall,</b> in Ruhe — gegen die eigene Baseline dieses Pferds.</li>',
        '<li><b>Recorded in the stable,</b> at rest — against this horse’s own baseline.</li>');
tausche('<li><b>Ausgewertet in Ihrem Browser</b> — die Daten bleiben in der Praxis, ein AVV entfällt.</li>',
        '<li><b>Analysed in your browser</b> — the data stays in your practice, no data-processing agreement needed.</li>');
tausche('<li><b>Abrechenbar</b> — die Ferneinschätzung führt die GOT als Ziffer&nbsp;1, den Brief als Ziffer&nbsp;89.</li>',
        '<li><b>Billable</b> — the German fee schedule (GOT) lists the remote assessment as item&nbsp;1, the letter as item&nbsp;89.</li>');
tausche('title="Demo-Cockpit öffnen"', 'title="Open the demo cockpit"');
tausche(`alt="Pferde-Akte im Cockpit: Einstufung Stabil mit Begründung, Kernwerte RMSSD, Ruhe-HF, SDNN und DFA gegen die individuelle Baseline, Trainings-Readiness und Ferneinschätzung"`,
        `alt="Horse record in the cockpit: classification Stable with reasoning, key values RMSSD, resting HR, SDNN and DFA against the individual baseline, training readiness and remote assessment"`);
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
tausche('Die Ferneinschätzung ist abrechenbar', 'Remote assessment is billable');
tausche(`Die Beratung ohne Untersuchung führt die <strong>GOT als Ziffer&nbsp;1</strong>, den
         Tierarztbrief je angefangene 15&nbsp;Minuten als <strong>Ziffer&nbsp;89</strong>. Aus
         einem Anruf ohne Grundlage wird eine Leistung mit einer.`,
`German veterinary fee schedule (GOT) lists advice without examination as <strong>item&nbsp;1</strong>,
         and the veterinary letter per started 15&nbsp;minutes as <strong>item&nbsp;89</strong>. A
         phone call without a basis becomes a service with one.`);
tausche('In der eigenen Box, zur gewohnten Zeit', 'Its own box, not an examination room');
tausche('Aus „Können Sie mal draufschauen?" wird eine Messung',
        'From “could you take a quick look?” to a measurement');
tausche('Wiederholbar, ohne dass jemand fährt', 'Repeatable without anyone driving out');

// Abschnitt 2 — Cockpit
tausche('Was im Cockpit steht', 'What the cockpit shows');
tausche('Erst die Reihenfolge. Dann die Zahlen, die sie begründen.', 'One glance, then the depth.');
tausche(`Oben die Einstufung und der Wert, der sie ausgelöst hat. Darunter alles,
       was Sie zum Nachrechnen brauchen — nichts davon versteckt.`,
`The classification at the top and the value that triggered it. Below it
       everything you need to check the maths — none of it hidden.`);
tausche('<div class="f-k">Triage</div>', '<div class="f-k">Triage</div>');
tausche('Vier Stufen, und daneben steht, welcher Wert sie ausgelöst hat.',
        'Four levels, and next to each the value that triggered it.');
tausche('<div class="f-k">Die Akte</div>', '<div class="f-k">The record</div>');
tausche('Alles, was Sie zum Nachrechnen brauchen — an einer Stelle.',
        'Everything you need to check the maths — in one place.');
tausche('Einordnung mit Begründung', 'A classification with its reason');
tausche('Signalgüte, bevor Sie deuten', 'Signal quality before interpretation');
tausche('Atemwegs-Marker im Verlauf', 'Airway markers over time');
tausche('Die üblichen Ansichten, in guter Auflösung', 'The familiar views, at proper resolution');
tausche('Befund und Abrechnung an einer Stelle', 'Findings and billing in one place');
tausche('Export ohne Sackgasse', 'Export without a dead end');

// Abschnitt 3 — Wissenschaft
tausche('Warum die Zahlen tragen', 'Why the numbers hold', 2);   // Kommentar + Text
tausche('Beim Pferd sind Pausen normal. Wer sie mitrechnet, misst Unsinn.',
        'In horses, pauses are normal. Count them in and you measure nonsense.');
tausche('Dieselbe Filterkette wie in der App, nicht eine nachgebaute',
        'The same filter chain as in the app, not a rebuilt one');
tausche('Was das ausmacht — an zwanzig eigenen Ruheaufnahmen geprüft',
        'What difference it makes — tested on twenty of our own resting recordings');
tausche('Und dort, wo es nicht reicht, sagt es das', 'And where it is not enough, it says so');

// Abschnitt 4 — Verlauf
tausche('Was eine Momentaufnahme nicht kann', 'What a snapshot cannot do');
tausche('Ein Wert sagt wenig. Sein Verlauf sagt alles.', 'The direction is the information.');
tausche('Über Wochen statt über Minuten', 'Over weeks rather than minutes');
tausche('Nach einer Umstellung sichtbar', 'Visible after a change');

// Abschnitt 5 — Anschluss
tausche('>Anschluss<', '>Interoperability<');
tausche('Der Befund geht in Ihre Praxissoftware, nicht in eine Sackgasse.',
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
/* Ueberschrift traegt jetzt zusaetzlich den Betriebs-Bezug; weiter unten. */
/* Ersetzt durch den praeziseren Satz weiter unten (USt. weist Stripe aus). */
/* Die Monatsrate fuehrt (Jan, 13.08.) — die grosse Zahl ist der Anker. */
tausche('oder 790&nbsp;€ im Jahr — entspricht 65,83&nbsp;€ im Monat, zwei Monate gespart',
        'or €790 per year — €65.83 a month, two months saved');
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
         Gründungspartner. Ihre Anmeldung liest der Entwickler selbst — und meldet
         sich persönlich zurück, meist am selben Tag.`,
`Take part in the beta and you keep your founding-partner price. The developer
         reads your registration himself — and replies personally, usually the
         same day.`);
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
tausche('Ersetzt CARLON eine Untersuchung?', 'Does CARLON replace an examination?', 2);
tausche('Was braucht die Halterin?', 'What does the owner need?', 2);
tausche('Was passiert nach einer Kündigung?', 'What happens after cancellation?', 2);
tausche('Brauche ich einen Auftragsverarbeitungsvertrag?', 'Do I need a data processing agreement?', 2);

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
      Transport, fremde Umgebung, fremde Menschen — jeder dieser Reize verschiebt genau die
      autonome Balance, die Sie beurteilen wollen. Der Messort ist bei der Ruhe-HRV keine
      Nebensache, sondern Teil der Methode: Die Atemwegs-Auswertung verlangt
      <strong>mindestens sieben Minuten Ruhe in gewohnter Umgebung</strong> — darunter gibt
      sie kein Ergebnis aus. Nach Verladung
      und Fahrt ist diese Bedingung systematisch nicht erfüllt — in der eigenen Box ist sie
      es jeden Tag.
    `,
        `
      Transport, unfamiliar surroundings, unfamiliar people — each of these stimuli shifts
      exactly the autonomic balance you want to assess. For resting HRV the measurement
      site is not a side issue but part of the method: the airway analysis requires
      <strong>at least seven minutes of rest in familiar surroundings</strong> — below that
      it returns no result. After
      loading and a journey this condition is systematically unmet — in the horse's own
      box it is met every day.
    `);
/* Der Atemwegs-Absatz ist neu (13.08.2026) — und er ist das staerkste
   Argument der Seite: bei Asthma IST die Umgebung der Gegenstand. */
tausche(`
      <strong>Beim equinen Asthma ist das nicht nur eine Bedingung, sondern der ganze
      Punkt.</strong> Was das Pferd belastet, steht im Stall: Einstreu, Heu, Lüftung. Eine
      Messung in der Klinik nimmt ausgerechnet die Umgebung heraus, um die es geht. Zu Hause,
      wiederholt über Wochen, sehen Sie stattdessen, was Sie wirklich wissen wollen — ob die
      Umstellung gewirkt hat.
    `,
        `
      <strong>For equine asthma this is not merely a condition — it is the entire
      point.</strong> What burdens the horse is in the stable: bedding, hay, ventilation. A
      recording taken at the clinic removes precisely the environment in question. At home,
      repeated over weeks, you see instead what you actually want to know — whether the
      change worked.
    `);
tausche(`Die Halterin legt den Gurt an, das Pferd steht wie immer. Kein Transport, keine
         Aufregung durch Fremde, kein sperriges Gerät im Weg.`,
        `The owner puts on the belt, the horse stands as it always does. No transport, no
         excitement from strangers, no bulky equipment in the way.`);
tausche(`Statt Anruf und Handyvideo schickt die Halterin eine standardisierte Aufnahme
         samt Messprotokoll. Sie öffnen sie, wenn Sie Zeit haben — und sehen vorher,
         wie dringend es ist.`,
        `Instead of a phone call and a shaky video, the owner sends a standardised
         recording with its measurement report. You open it when you have time — and
         see beforehand how urgent it is.`);

/* ── 2b · DIE MESSSTATION (neu 13.08.2026) ────────────────────────────
   Der ganze Abschnitt ist neu. Ohne diese Bloecke bliebe er auf der
   englischen Seite deutsch stehen — und zwar STILL, weil der Bauer nur
   meldet, was er ERWARTET und nicht findet, nicht was er nie gesehen hat.
   Genau deshalb prueft t-englisch die Seiten zusaetzlich gegeneinander. */
tausche('<div class="sec-eyebrow">Die Messstation</div>',
        '<div class="sec-eyebrow">The measuring station</div>');
tausche('Eine Messstation, die im Browser läuft — ohne App, ohne Konto.',
        'A measuring station that runs in the browser — no app, no account.');
tausche(`Es gibt <strong>nichts zu installieren</strong>. Die Halterin scannt Ihren Aushang, und
      die Messstation ist da — im Browser, ohne Anmeldung. Sie verbindet den
      Polar-H10-Gurt, lässt das Pferd stehen und tippt einmal auf Senden.
      <strong>Kein Onboarding, keine Rückfragen bei Ihnen.</strong> Gemessen wird mit einem
      Android-Telefon oder einem Rechner mit Chrome oder Edge — auf dem iPhone lässt Apple
      Bluetooth im Browser nicht zu. Im Stall genügt ein einziges messfähiges Gerät für
      alle Pferde.`,
`There is <strong>nothing to install</strong>. The owner scans your poster and the measuring
      station is there — in the browser, no sign-up. She connects the Polar H10 belt, lets
      the horse stand and taps send once.
      <strong>No onboarding, no questions coming back to you.</strong> Recording works on an
      Android phone or a computer with Chrome or Edge — on iPhone, Apple does not permit
      Bluetooth in the browser. One capable device in the barn is enough for
      all horses.`);
tausche(`Bei Ihnen kommt kein Screenshot an, sondern ein Datensatz: alle Schlagabstände im
      Rohzustand, die daraus berechneten Kennwerte und die Signalgüte dazu. Sie sehen also
      nicht nur eine Zahl, sondern auch, <strong>wie sehr Sie ihr trauen können</strong>.
      Ins Cockpit kommt die Datei mit einem Handgriff — hineinziehen, fertig: Signalgüte,
      Baseline-Abgleich und Einstufung stehen sofort da.`,
`What reaches you is not a screenshot but a dataset: every beat-to-beat interval in its raw
      state, the metrics derived from it, and the signal quality alongside. So you see not
      just a number, but also <strong>how far you can trust it</strong>.
      Into the cockpit the file goes with one motion — drag it in, done: signal quality,
      baseline comparison and classification are there at once.`);
tausche('Der Aushang führt hierher. Ein Feld für den Pferdenamen, ein Knopf zum Gurt — mehr steht nicht im Weg.',
        'The poster leads here. One field for the horse\'s name, one button for the belt — nothing else in the way.');
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
tausche(`Hat Ihre Kundin Ihren Aushang gescannt, ist die Datei schon auf ihrem Telefon
         <strong>gegen Ihren Schlüssel verschlüsselt</strong>. Sie verschickt sie über den
         Weg, den sie selbst wählt. Wir bekommen sie nicht zu sehen und legen sie nirgends
         ab — deshalb braucht es zwischen uns keinen Auftragsverarbeitungsvertrag.`,
        `If your client scanned your poster, the file is already encrypted
         <strong>against your key</strong> on her phone. She sends it by whatever route she
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
tausche(`HRV-basierte Marker mit ihren Schwellen, einzeln aufgeführt — kalibriert an
           einer BAL-referenzierten Studie (Nyerges-Bohák 2025, Equine Veterinary
           Journal, n = 40). Ein <strong>Beobachtungshinweis</strong>, ausdrücklich
           keine Diagnose: Die BAL-Zytologie bleibt der Goldstandard.`,
        `HRV-based markers with their thresholds, listed individually — calibrated against
           a BAL-referenced study (Nyerges-Bohák 2025, Equine Veterinary Journal,
           n = 40). An <strong>observational note</strong>, explicitly not a
           diagnosis: BAL cytology remains the gold standard.`);
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
tausche(`<b>Nichts davon verlässt Ihr Gerät von selbst</b> — erst Ihr Tipp übergibt
            die Route an die Karten-App.`,
        `<b>None of it leaves your device on its own</b> — only your tap hands
            the route to the maps app.`);
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
           könnten sie auch nicht löschen. Die Aufnahme der Halterin läuft gar nicht erst
           über uns: Sie schickt Ihnen eine Datei — hat sie Ihren Aushang gescannt, ist die
           für Ihre Praxis verschlüsselt.`,
        `Your patients live in your device's storage. We have no access and could not
           delete them either. The owner's recording never passes through us at all: she
           sends you a file — and if she scanned your poster, that file is encrypted for
           your practice.`);
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
      One business — one practice or one site — with all veterinary and veterinary-nursing
      staff and on any number of that business's devices. There is <strong>no fee per horse,
      per user or per device</strong>, and no limit on recordings.
    `);
/* (Der Absatz mit dem Angebot steht weiter unten in der praezisierten
   Fassung — hier waere er doppelt.) */
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
tausche('"description": "Browser-lokale Praxis-Ansicht für Pferdetierärzte und Kliniken: Triage nach biometrischer Dringlichkeit, Verlauf über Wochen, Abfahrroute, Befundbericht und Export als FHIR R5. Kein Medizinprodukt, keine Diagnose."',
        '"description": "Browser-local practice view for equine vets and clinics: triage by biometric urgency, trends over weeks, route planning, findings report and export as FHIR R5. Not a medical device, not a diagnosis."');
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
tausche('Welche Evidenz steht hinter den Atemwegs-Markern?',
        'What evidence sits behind the airway markers?', 2);
tausche(`Die Marker sind an einer veröffentlichten, BAL-referenzierten Studie kalibriert
           (Nyerges-Bohák 2025, Equine Veterinary Journal, n = 40) und werden mit ihren
           Schwellen einzeln ausgewiesen. Die BAL-Zytologie bleibt der Goldstandard — der
           Verlauf ersetzt sie nicht, er begründet, wann sie ansteht.`,
        `The markers are calibrated against a published, BAL-referenced study
           (Nyerges-Bohák 2025, Equine Veterinary Journal, n = 40) and are shown
           individually with their thresholds. BAL cytology remains the gold standard —
           the trend does not replace it, it substantiates when it is due.`);
tausche('"text": "Die Marker sind an einer veröffentlichten, BAL-referenzierten Studie kalibriert (Nyerges-Bohák 2025, Equine Veterinary Journal, n = 40) und werden mit ihren Schwellen einzeln ausgewiesen. Die BAL-Zytologie bleibt der Goldstandard — der Verlauf ersetzt sie nicht, er begründet, wann sie ansteht."',
        '"text": "The markers are calibrated against a published, BAL-referenced study (Nyerges-Bohák 2025, Equine Veterinary Journal, n = 40) and are shown individually with their thresholds. BAL cytology remains the gold standard — the trend does not replace it, it substantiates when it is due."');
tausche('"text": "Die Anwendung wechselt in einen funktionsreduzierten Modus. Ihre Daten bleiben auf dem Gerät und lassen sich weiterhin öffnen und exportieren. Wir könnten sie gar nicht löschen — sie liegen bei Ihnen."',
        '"text": "The application switches to a reduced mode. Your data stays on the device and can still be opened and exported. We could not delete it — it is with you."');
tausche('"text": "Nein. Das Cockpit läuft vollständig in Ihrem Browser, und auch die Aufnahme der Halterin erreicht uns nicht: Ihre Messstation legt eine Datei auf ihrem eigenen Gerät an, die sie Ihnen selbst schickt. Es gibt keinen Zwischenspeicher bei uns — und damit nichts, worüber ein Auftragsverarbeitungsvertrag zu schließen wäre."',
        '"text": "No. The cockpit runs entirely in your browser, and the owner\'s recording never reaches us either: her measuring station creates a file on her own device, which she sends to you herself. There is no relay at our end — and therefore nothing a data processing agreement could be about."');
tausche('"url": "https://vitalkultur.com/carlon-equine-visite/",',
        '"url": "https://vitalkultur.com/carlon-equine-visite/en/",');


/* Muster-Befund — das Artefakt, an dem ein Tierarzt uns beurteilt. */
tausche('Sehen Sie den Befund, bevor Sie irgendetwas entscheiden.',
        'See the findings report before you decide anything.');
tausche(`Zwei Seiten, aus dem Demo-Bestand erzeugt — mit Ihrem Briefkopf, den Kennwerten,
        Verlauf und Poincaré, und einem Abschnitt „Methode &amp; Grenzen", der die Quellen nennt.
        Genau dieses Dokument geben Sie weiter.`,
`Two pages, generated from the demo library — with your letterhead, the key values, the
        trend and the Poincaré plot, plus a "Method & limits" section naming the sources.
        This is the document you pass on.`);
tausche('>Muster-Befund als PDF<', '>Sample findings report (PDF)<');


/* Umsatzsteuer — WESSEN. Der Kern der Klaerung vom 12.08.2026. */
tausche('<span>netto im Monat · USt. weist Stripe aus</span>',
        '<span>net per month · VAT charged by Stripe</span>');
tausche(`Das Angebot richtet sich ausschließlich an Unternehmer im Sinne des § 14 BGB.
        <strong>Wir selbst rechnen als Kleinunternehmer nach § 19 UStG ohne Umsatzsteuer ab.</strong>
        Für das Browser-Cockpit tritt <strong>Stripe als Verkäufer im eigenen Namen</strong> auf
        (Merchant of Record) und weist die Umsatzsteuer nach seinen Verhältnissen aus; mit
        gültiger EU-USt-IdNr. greift dort das Reverse-Charge-Verfahren. Einzelheiten in`,
`This offer is directed exclusively at entrepreneurs within the meaning of § 14 BGB.
        <strong>We ourselves invoice without VAT under the German small-business rule (§ 19 UStG).</strong>
        For the browser cockpit, <strong>Stripe acts as the seller in its own name</strong>
        (merchant of record) and charges VAT according to its own status; with a valid EU VAT ID
        the reverse-charge procedure applies there. Details in`);


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
tausche(`Sie scannt Ihren Aushang, misst auf Ihre Empfehlung, und die Rückmeldung trägt
         Ihren Briefkopf. Die Kontrolle nach der Umstellung, die bisher am Fahrweg
         scheiterte, wird zu einem Kontaktpunkt Ihrer Praxis.`,
        `She scans your poster, records on your recommendation, and the reply carries
         your letterhead. The follow-up after a management change that used to fail on
         the drive out becomes a touchpoint of your practice.`);

// Physiologie-Lead (Warum die Zahlen tragen)
tausche(`
      Die Herzratenvariabilität liest die Balance des autonomen Nervensystems ab — das
      Wechselspiel aus Sympathikus und Parasympathikus, das sich unter Belastung des
      Organismus verschiebt. Für die Einstufung zählt deshalb die eigene Baseline des
      Pferds; nur die Atemwegs-Marker tragen zusätzlich studienbasierte Schwellen
      (Nyerges-Bohák 2025).
    `,
        `
      Heart rate variability reads the balance of the autonomic nervous system — the
      interplay of sympathetic and parasympathetic tone that shifts when the organism is
      under strain. That is why the classification rests on the horse's own baseline;
      only the airway markers additionally carry study-based thresholds
      (Nyerges-Bohák 2025).
    `);

// Start-Sektion (So beginnt Ihre Praxis)
tausche('<div class="sec-eyebrow">Der Start</div>', '<div class="sec-eyebrow">Getting started</div>');
tausche('<h2>So beginnt Ihre Praxis.</h2>', '<h2>How your practice begins.</h2>');
tausche('<div class="u-k">Schritt 1</div>', '<div class="u-k">Step 1</div>');
tausche('<div class="u-k">Schritt 2</div>', '<div class="u-k">Step 2</div>');
tausche('<div class="u-k">Schritt 3</div>', '<div class="u-k">Step 3</div>');
tausche('<h3>Aushang drucken</h3>', '<h3>Print your poster</h3>');
tausche(`Sie drucken aus dem Cockpit Ihren Aushang — er trägt Ihren QR-Code und Ihren
           Schlüssel. Er hängt in der Stallgasse oder liegt im Wartezimmer.`,
        `You print your poster from the cockpit — it carries your QR code and your
           key. It hangs in the barn aisle or sits in the waiting room.`);
tausche('<h3>Die Halterin scannt</h3>', '<h3>The owner scans</h3>');
tausche(`Ab dem Scan ist jede Aufnahme von der ersten Sekunde an für Ihre Praxis
           verschlüsselt. Die Halterin misst und schickt Ihnen die Datei auf dem Weg,
           den sie ohnehin nutzt.`,
        `From the scan on, every recording is encrypted for your practice from the very
           first second. The owner records and sends you the file on whatever channel
           she already uses.`);
tausche('<h3>Datei ins Cockpit ziehen</h3>', '<h3>Drag the file into the cockpit</h3>');
tausche(`Signalgüte, Baseline-Abgleich und Einstufung stehen sofort — die Triage
           ordnet das Pferd ein, der Befund ist aus der Akte heraus erstellt.`,
        `Signal quality, baseline comparison and classification are there at once — the
           triage places the horse, and the findings report is created straight from the
           record.`);

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


if (fehlend.length) {
  console.error('\n  ✗ Der Bau bricht ab — diese Bloecke gibt es in index.html nicht (mehr):\n');
  for (const f of fehlend) console.error(`      ${f.erwartet}× erwartet, ${f.gefunden}× gefunden:  „${f.de}…"`);
  console.error('\n  Die deutsche Seite hat sich geaendert. Uebersetzung nachziehen, dann neu bauen.\n');
  process.exit(1);
}

mkdirSync(join(HIER, 'en'), { recursive: true });
writeFileSync(join(HIER, 'en', 'index.html'), s, 'utf8');
console.log(`  ✓ en/index.html gebaut · ${ersetzt} Bloecke ersetzt · ${s.length} Zeichen`);
