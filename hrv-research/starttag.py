#!/usr/bin/env python3
"""Starttag CARLON HRV Research: Beta-Modus → Kauf im App Store (einmal ausführen, dann prüfen + pushen).

Warum ein Skript statt `git revert 7aaa93b f2b0cc5`: Nach den Beta-Commits wurde dieselbe Seite
weiter bearbeitet; der Revert läuft auf Konflikte (geprobt 28.10.2026). Das Skript setzt die
Store-Stellen in den AKTUELLEN Stand ein und bricht laut ab, wenn eine Stelle fehlt.

  python3 hrv-research/starttag.py              # zeigt nur, was es ersetzen würde (Probe ist Standard)
  python3 hrv-research/starttag.py --schreiben  # schreibt index.html + llms.txt, erzeugt de/ neu
Unbekannte Optionen brechen ab: Am 03.11.2026 lief der Starttag versehentlich durch `--help` (damals Standard =
schreiben). Probe als Standard, Schreiben nur ausdrücklich.
Danach: Seite im Simulator prüfen (Knöpfe führen zu apps.apple.com/app/id6826010655), committen, pushen.
"""
import re, subprocess, sys
from pathlib import Path

STORE = "https://apps.apple.com/app/id6826010655"
HIER = Path(__file__).resolve().parent
SEITE = HIER / "index.html"
LLMS = HIER.parent / "llms.txt"
unbekannt = [x for x in sys.argv[1:] if x not in ("--probe", "--schreiben")]
if unbekannt:
    raise SystemExit(f"🔴 unbekannte Option {unbekannt} – erlaubt: --probe (Standard), --schreiben")
probe = "--schreiben" not in sys.argv
s = SEITE.read_text(encoding="utf-8")
zaehler = {}


def ersetze(name, muster, neu, mindestens=1, flags=re.S):
    global s
    s, n = re.subn(muster, neu, s, flags=flags)
    zaehler[name] = n
    if n < mindestens:
        raise SystemExit(f"🔴 {name}: {n} Treffer (erwartet ≥ {mindestens}) — Seite hat sich geändert, Muster anpassen")


# 1. Knöpfe: jedes Beta-Mail-Element wird ein App-Store-Link mit Store-Beschriftung
def knopf(m):
    tag = m.group(0)
    if 'class="btn' in tag:
        return (f'<a class="btn btn-1" href="{STORE}"><span data-en="View on the App Store" '
                f'data-de="Im App Store ansehen">View on the App Store</span> <span aria-hidden="true">→</span></a>')
    return f'<a class="pill" href="{STORE}" data-en="App Store" data-de="App Store">App Store</a>'
ersetze("Knöpfe", r'<a class="(?:btn btn-1|pill)" href="mailto:[^"]*beta[^"]*"[^>]*data-beta[^>]*>.*?</a>', knopf, 3)
# 2. Sprachumschalter setzte die Beta-Mail je Sprache — wird wieder der Preis
ersetze("Sprach-Skript", r"document\.querySelectorAll\('\[data-beta\]'\)\.forEach\(function \(a\) \{.*?\}\);",
        "var p = document.querySelector('.price'); if (p) p.firstChild.nodeValue = lang === 'de' ? '99,99 €' : '€99.99';")
# 3. Preisblock
ersetze("Preis-Label", r'<div class="label" data-en="Before the App Store launch"[^>]*>[^<]*</div>',
        '<div class="label" data-en="One purchase" data-de="Einmal kaufen">One purchase</div>')
ersetze("Preis", r'<div class="price" data-en="[^"]*[Bb]eta[^"]*" data-de="[^"]*">[^<]*</div>',
        '<div class="price">€99.99<small data-en="one-time" data-de="einmalig">one-time</small></div>')
ersetze("Preis-Text", r'(?<=</div>\n)( *)<p class="lead" data-en="[^"]*TestFlight[^"]*" data-de="[^"]*">.*?</p>',
        r'\1<p class="lead" data-en="Everything above, for every study you run. No subscription, no per-participant fees, no account." '
        'data-de="Alles oben, für jede Studie, die Sie durchführen. Kein Abo, keine Gebühren pro Teilnehmer, kein Konto.">'
        'Everything above, for every study you run. No subscription, no per-participant fees, no account.</p>')
# 4. Kleingedrucktes + Fußleiste
ersetze("Kleingedrucktes", r'<div class="fine" data-en="iPhone · TestFlight beta[^"]*" data-de="[^"]*">[^<]*</div>',
        '<div class="fine" data-en="One purchase · no account · no subscription · no server" '
        'data-de="Einmal kaufen · kein Konto · kein Abo · kein Server">One purchase · no account · no subscription · no server</div>', 0)
ersetze("Fußleiste", r'<small data-en="[^"]*[Bb]eta · iPhone" data-de="[^"]*">[^<]*</small>',
        '<small data-en="One purchase · iPhone" data-de="Einmal kaufen · iPhone">One purchase · iPhone</small>', 0)
# 5. FAQ sichtbar + Strukturdaten (FAQ, Kauf-Angebot)
FAQ_EN = ("A one-time purchase on the App Store – no subscription, no per-participant fees. Institutions can buy "
          "licenses in volume through Apple School Manager or Apple Business.")
FAQ_DE = ("Ein einmaliger Kauf im App Store – kein Abo, keine Gebühren pro Teilnehmer. Einrichtungen kaufen Lizenzen "
          "in größerer Zahl über Apple School Manager oder Apple Business.")
ersetze("FAQ sichtbar", r'(<summary data-en="What does CARLON HRV Research[\s\xa0]cost\?" data-de="Was kostet CARLON HRV[\s\xa0]Research\?">[^<]*</summary>)<p data-en="During the beta[^"]*" data-de="[^"]*">.*?</p>',
        lambda m: f'{m.group(1)}<p data-en="{FAQ_EN}" data-de="{FAQ_DE}">{FAQ_EN}</p>')
# FAQ-Markup erzeugt der Bau (werkzeuge/faq-ld.py) aus der sichtbaren FAQ – hier nur noch ein Fallback
ersetze("FAQ Schema", r'("name": "What does CARLON HRV Research cost\?", "acceptedAnswer": \{"@type": "Answer", "text": ")During the beta[^"]*(")',
        r'\1A one-time purchase of 99.99 EUR on the App Store, with no subscription and no per-participant fees. '
        r'Institutions can buy licenses in volume through Apple School Manager or Apple Business.\2', 0)
if '"downloadUrl"' not in s:
    ersetze("Kauf-Angebot", r'("@type": "SoftwareApplication",)',
            r'\1\n        "downloadUrl": "' + STORE + r'",\n        "offers": {"@type": "Offer", "price": "99.99", '
            r'"priceCurrency": "EUR", "category": "one-time purchase"},', 1)
# 6. Smart App Banner (Kampagnenpapier 28.10.): native Store-Leiste in Safari, erst ab Starttag
if 'name="apple-itunes-app"' not in s:
    ersetze("Smart App Banner", r'(<meta name="viewport"[^>]*>)', r'\1\n  <meta name="apple-itunes-app" content="app-id=6826010655">', 1)
# 7. Beta-Sätze, die nach dem ersten Skript dazukamen (Research-Probe 26.11.2026: 33 Reste). Leerraum flexibel,
#    weil typo-binden geschützte Leerzeichen und <span class=nw> setzt; jede Stelle muss treffen.
def flex(t):
    return r"(?:\s|&nbsp;|\xa0)+".join(re.escape(w) for w in t.split())
BETA_SAETZE = [
    ("Nav Anwendung EN", "Use cases · Kubios workflow · beta feedback", "Use cases · Kubios workflow · field reports"),
    ("Nav Anwendung DE", "Einsatzbereiche · Kubios-Workflow · Erfahrungen aus der Beta", "Einsatzbereiche · Kubios-Workflow · Erfahrungsberichte"),
    ("Nav FAQ EN", "FAQ · beta access", "FAQ · price and data"),
    ("Nav FAQ DE", "FAQ <span class=nw>· Beta-Zugang</span>", "FAQ <span class=nw>· Preis und Daten</span>"),
    ("Vergleich EN", "; during the beta, Apple’s TestFlight terms apply", ""),
    ("Vergleich DE", "; in der Beta gelten Apples TestFlight-Bedingungen", ""),
    ("Methoden EN", " While the app is distributed as a beta through TestFlight, Apple collects crash logs and usage information – which may include the tester’s name and email address – and any feedback testers send (which can include screenshots of the app), and shares them with the developer.", ""),
    ("Methoden DE", " Solange die App als Beta über TestFlight verteilt wird, erhebt Apple Absturzprotokolle und Nutzungsinformationen – gegebenenfalls mit Name und E-Mail-Adresse der testenden Person – sowie gesendetes Feedback (auch Bildschirmfotos der App) und teilt sie mit dem Entwickler.", ""),
    ("FAQ Daten EN", "During the beta, Apple’s TestFlight shares crash reports, usage information and any feedback you send with us.",
     "Crash reports reach us through Apple only if you allow sharing with app developers in the iPhone settings."),
    ("FAQ Daten DE", "In der Beta teilt Apples TestFlight Absturzberichte, Nutzungsinformationen und von Ihnen gesendetes Feedback mit uns.",
     "Absturzberichte erhalten wir über Apple nur, wenn Sie in den iPhone-Einstellungen das Teilen mit App-Entwicklern erlauben."),
    ("FAQ Abschluss EN", " During the beta, simply export after each session or switch on the study folder – each TestFlight build runs for 90 days, and new builds follow regularly.", ""),
    ("FAQ Abschluss DE", " In der Beta einfach nach jeder Messung exportieren oder den Studienordner einschalten – jeder TestFlight-Build läuft 90 Tage, neue Builds folgen regelmäßig.", ""),
    ("Marke EN", "iPhone and TestFlight are trademarks of Apple Inc.", "iPhone is a trademark of Apple Inc."),
    ("Marke DE", "iPhone und TestFlight sind Marken von Apple Inc.", "iPhone ist eine Marke von Apple Inc."),
]
for name, alt, ersatz in BETA_SAETZE:
    muster = (r"\s?" if alt.startswith(" ") else "") + flex(alt)
    ersetze(name, muster, lambda m, e=ersatz: (" " if e and m.group(0).startswith(" ") else "") + e.strip() if e else "", 1, 0)
rest = re.findall(r"beta|TestFlight", s)
llms = LLMS.read_text(encoding="utf-8")
llms_neu = re.sub(r"In beta via Apple TestFlight \([^)]*\), a one-time App Store purchase at launch;",
                  "One-time purchase on the App Store;", llms)
if "[App Store](" not in llms_neu:
    llms_neu = llms_neu.rstrip("\n") + f"\n- [App Store]({STORE})\n"
print("Ersetzt:", ", ".join(f"{k} {v}" for k, v in zaehler.items()))
print(f"Rest „beta/TestFlight“ auf der Seite: {len(rest)} (Danksagung an Betatester darf bleiben)")
if probe:
    raise SystemExit(0)
SEITE.write_text(s, encoding="utf-8"); LLMS.write_text(llms_neu, encoding="utf-8")
# Bau wie jeden Tag: DE erzeugen, Satzregeln, FAQ-Markup je Sprache aus der sichtbaren FAQ (02.11.2026)
subprocess.run(["bash", str(Path.home() / "Developer/website-werkstatt/research/bau.sh")], check=True)
for f in (SEITE, HIER / "de" / "index.html"):
    r = [x for x in re.findall(r"[^<>\"]{0,40}(?:[Bb]eta|TestFlight)[^<>\"]{0,40}", f.read_text(encoding="utf-8")) if "Betatest" not in x]
    if r:
        raise SystemExit(f"🔴 {f.relative_to(HIER.parent)}: {len(r)} Beta-Reste nach dem Bau, z. B. {r[:3]}")
print(f"✓ Starttag gesetzt — Store-Links auf der Seite: {s.count(STORE)}")
