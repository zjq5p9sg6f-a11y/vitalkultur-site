/* ════════════════════════════════════════════════════════════════════════
   DER EINE SCHALTER
   ════════════════════════════════════════════════════════════════════════

   false = Beta. Kein offener Verkauf, Zugang nur ueber Lizenzschluessel,
           die Bezahlseite zeigt die Bewerbung als Gruendungs-Partner.
   true  = Verkauf offen. Preistabelle sichtbar, Stripe-Kasse aktiv,
           Impressum nennt den Verkauf.

   Diese eine Zeile umlegen, den Wert in sw.js (VERSION) hochzaehlen, pushen.
   Sonst nichts.

   Warum eine eigene Datei und keine Konstante in index.html: das Impressum
   ist eine getrennte statische Seite und muss dieselbe Aussage treffen. Steht
   die Zeile an zwei Stellen, laeuft sie irgendwann auseinander — und dann
   verkauft die App, waehrend das Impressum "kein offener Verkauf" behauptet.
   Genau diese Sorte Widerspruch faellt zuerst jemandem auf, der Aerger sucht.

   Der Schalter schaltet NICHT die Zahlungsfaehigkeit frei. Dafuer muessen im
   Stripe-LIVE-Konto (acct_1U1RtGFYqQiMtCiD, nicht die Sandbox) zwei Dinge
   erledigt sein, die nur Jan selbst tun kann:
     1. Unternehmen verifizieren (Firmierung, Steuernummer, Ausweis,
        Geschaeftskonto) — Stripe zeigt das als "Verifizieren Sie Ihr
        Unternehmen".
     2. Zwei Zahlungs-Links ueber 79 € / Monat und 790 € / Jahr anlegen und
        in License.CHECKOUT.live eintragen.
   Solange dort noch Platzhalter stehen, sperrt License.checkoutLink() die
   Kasse von sich aus — der Schalter allein kann also keinen Kunden in eine
   tote oder falsche Kasse schicken.                                        */

window.CARLON_LIVE = false;

/* ════════════════════════════════════════════════════════════════════════
   DER ZWEITE SCHALTER — das Postfach
   ════════════════════════════════════════════════════════════════════════

   false = DATEIWEG. Die Station legt eine Datei an, die Besitzerin verschickt
           sie ueber ihren eigenen Kanal (Teilen-Blatt: WhatsApp, Mail,
           Signal, AirDrop). Nichts liegt bei uns, nichts geht durch uns
           hindurch.
   true  = POSTFACH. Der Zwischenspeicher nimmt die Aufnahme entgegen und die
           Praxis holt sie ab. Bequemer — die Praxis sieht "1 Aufnahme neu" —
           aber es macht uns zum Auftragsverarbeiter.

   WARUM DAS NICHT NUR EIN SCHALTER, SONDERN EINE PREISFRAGE IST
   Mit Zwischenspeicher braucht JEDE einzelne Praxis einen
   Auftragsverarbeitungsvertrag. Das ist eine Unterschrift je Kunde, ein
   Dokument je Kunde, eine Pflicht je Kunde — dauerhaft, und es waechst mit
   dem Umsatz. Bei 30 Praxen sind das 30 Vertraege und 30 Aktualisierungen bei
   jeder Aenderung. Ohne Zwischenspeicher: null.

   Das ist keine Ersparnis von ein paar hundert Euro Anwaltsprosa, das ist die
   Abschaffung einer Steuer auf Wachstum.

   DESHALB BLEIBT DER CODE GEBAUT UND AUS. Das Postfach ist ab jetzt die
   Komfortfunktion, die eine Klinik DAZUBUCHT, wenn sie danach fragt. Dann
   braucht es einen AVV — und dann gibt es auch den Kunden, der ihn bezahlt.
   Erst verkaufen, dann die Buerokratie, die der Verkauf finanziert.

   WAS DER SCHALTER NICHT ABSCHALTET: die Verschluesselung. Sie ist das
   Produkt, nicht das Beiwerk. Eine rohe JSON ueber WhatsApp waere schlechter
   als das Postfach, nicht besser — dann laege der Datensatz im Klartext auf
   Metas Servern und in zwei Chat-Sicherungen. Wer einen Aushang gescannt hat,
   verschickt Chiffrat; wer keinen hat, verschickt einen Datensatz, der so arm
   ist, dass der Transportweg egal ist.

   MIT DEM POSTFACH SCHLAEFT AUCH DER RUECKWEG. Die Praxis legte den Befund
   bisher ins Fach der Besitzerin zurueck. Ohne Fach schickt sie das
   Befund-PDF ueber ihren eigenen Kanal — so wie Praxen Befunde seit jeher
   uebermitteln, und dabei ist sie Verantwortliche, nicht wir.               */

window.CARLON_POSTFACH = false;

/* KANONISCHE ADRESSE — die eine Stelle, unter der die Messstation dauerhaft
   erreichbar ist.
   ═══════════════════════════════════════════════════════════════════════
   WARUM DAS HIER STEHT UND NICHT AUS location.href KOMMT:
   Eine Einladung und ein QR-Aushang merken sich die Adresse, unter der sie
   erzeugt wurden. Wird das Cockpit gerade lokal, ueber einen Tunnel oder
   unter einer Vorschau-Adresse betrieben, zeigt das gedruckte Blatt genau
   dorthin — und ist tot, sobald die Adresse verschwindet.
   Ein Aushang in einer Stallgasse haengt Jahre. Er MUSS auf eine Adresse
   zeigen, die es in Jahren noch gibt.
   Beim Umzug (etwa auf carlon.app) wird hier EINE Zeile geaendert; alte
   Blaetter bleiben nur gueltig, wenn die alte Adresse weiterleitet. */
window.CARLON_KANON = 'https://vitalkultur.com/carlon-equine/app/';
