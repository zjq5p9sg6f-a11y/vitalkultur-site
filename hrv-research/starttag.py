#!/usr/bin/env python3
"""Starttag CARLON HRV Research: Beta-Modus → Kauf im App Store (einmal ausführen, dann prüfen + pushen).

Warum ein Skript statt `git revert 7aaa93b f2b0cc5`: Nach den Beta-Commits wurde dieselbe Seite
weiter bearbeitet; der Revert läuft auf Konflikte (geprobt 28.10.2026). Das Skript setzt die
Store-Stellen in den AKTUELLEN Stand ein und bricht laut ab, wenn eine Stelle fehlt.

  python3 hrv-research/starttag.py          # schreibt index.html + llms.txt, erzeugt de/ neu
  python3 hrv-research/starttag.py --probe  # zeigt nur, was es ersetzen würde
Danach: Seite im Simulator prüfen (Knöpfe führen zu apps.apple.com/app/id6826010655), committen, pushen.
"""
import re, subprocess, sys
from pathlib import Path

STORE = "https://apps.apple.com/app/id6826010655"
HIER = Path(__file__).resolve().parent
SEITE = HIER / "index.html"
LLMS = HIER.parent / "llms.txt"
probe = "--probe" in sys.argv
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
        'data-de="Alles oben, für jede Studie, die du machst. Kein Abo, keine Gebühren pro Proband, kein Konto.">'
        'Everything above, for every study you run. No subscription, no per-participant fees, no account.</p>')
# 4. Kleingedrucktes + Fußleiste
ersetze("Kleingedrucktes", r'<div class="fine" data-en="iPhone · TestFlight beta[^"]*" data-de="[^"]*">[^<]*</div>',
        '<div class="fine" data-en="One purchase · no account · no subscription · no server" '
        'data-de="Einmal kaufen · kein Konto · kein Abo · kein Server">One purchase · no account · no subscription · no server</div>', 0)
ersetze("Fußleiste", r'<small data-en="[^"]*[Bb]eta · iPhone" data-de="[^"]*">[^<]*</small>',
        '<small data-en="One purchase · iPhone" data-de="Einmal kaufen · iPhone">One purchase · iPhone</small>', 0)
# 5. FAQ sichtbar + Strukturdaten (FAQ, Kauf-Angebot)
FAQ_EN = ("A one-time purchase on the App Store – no subscription, no per-participant fees. Institutions can buy "
          "licenses in volume through Apple School Manager or Apple Business Manager.")
FAQ_DE = ("Ein einmaliger Kauf im App Store – kein Abo, keine Gebühren pro Proband. Einrichtungen kaufen Lizenzen "
          "in größerer Zahl über Apple School Manager oder Apple Business Manager.")
ersetze("FAQ sichtbar", r'(<summary data-en="What does it cost\?" data-de="Was kostet sie\?">[^<]*</summary>)<p data-en="During the beta[^"]*" data-de="[^"]*">.*?</p>',
        lambda m: f'{m.group(1)}<p data-en="{FAQ_EN}" data-de="{FAQ_DE}">{FAQ_EN}</p>')
ersetze("FAQ Schema", r'("name": "What does it cost\?", "acceptedAnswer": \{"@type": "Answer", "text": ")During the beta[^"]*(")',
        r'\1A one-time purchase of 99.99 EUR on the App Store, with no subscription and no per-participant fees. '
        r'Institutions can buy licenses in volume through Apple School Manager or Apple Business Manager.\2')
if '"downloadUrl"' not in s:
    ersetze("Kauf-Angebot", r'("@type": "SoftwareApplication",)',
            r'\1\n        "downloadUrl": "' + STORE + r'",\n        "offers": {"@type": "Offer", "price": "99.99", '
            r'"priceCurrency": "EUR", "category": "one-time purchase"},', 1)
# 6. Smart App Banner (Kampagnenpapier 28.10.): native Store-Leiste in Safari, erst ab Starttag
if 'name="apple-itunes-app"' not in s:
    ersetze("Smart App Banner", r'(<meta name="viewport"[^>]*>)', r'\1\n  <meta name="apple-itunes-app" content="app-id=6826010655">', 1)
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
subprocess.run(["python3", str(Path.home() / "Developer/WimHofBreathwork/scripts/app-tour/sprachseite.py"),
                "hrv-research/index.html", "de", "CARLON HRV Research – HRV-Studien-App für Polar H10 & Movesense Flash",
                "iPhone-App für HRV-Studien: bis zu vier Polar H10 oder Movesense Flash, Phasenmarker, DFA α1 und "
                "Original-RR für Kubios, Python und R."], cwd=HIER.parent, check=True)
print(f"✓ Starttag gesetzt — Store-Links auf der Seite: {s.count(STORE)}")
