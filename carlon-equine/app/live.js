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
