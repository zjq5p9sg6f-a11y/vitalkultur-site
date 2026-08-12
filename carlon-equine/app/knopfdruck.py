#!/usr/bin/env python3
"""knopfdruck.py — was steht zwischen jetzt und dem offenen Verkauf?

Beantwortet EINE Frage: Kann der Schalter umgelegt werden, ohne dass etwas
still kaputtgeht? Kein Deploy, kein Schreiben — nur nachsehen und berichten.

  python3 knopfdruck.py

Die Regel dahinter: der Schalter in live.js oeffnet die Kasse, aber er macht
uns nicht zahlungsfaehig. Was zusaetzlich stimmen muss, steht hier — geprueft,
nicht behauptet. Was nur Jan selbst tun kann (Stripe-Verifizierung), wird als
solches ausgewiesen statt uebergangen.
"""
import pathlib
import re
import subprocess
import sys

HIER = pathlib.Path(__file__).resolve().parent
G, R, Y, D, N = "\033[32m", "\033[31m", "\033[33m", "\033[2m", "\033[0m"


def lies(name):
    p = HIER / name
    return p.read_text(errors="replace") if p.exists() else ""


def main():
    befunde = []   # (schwere, titel, detail)   schwere: 'sperre' | 'hinweis' | 'ok'

    # ── 1. Der Schalter ────────────────────────────────────────────────────
    live_js = lies("live.js")
    m = re.search(r"window\.CARLON_LIVE\s*=\s*(true|false)", live_js)
    schalter = m.group(1) if m else None
    if schalter is None:
        befunde.append(("sperre", "Schalter nicht lesbar",
                        "live.js enthaelt kein `window.CARLON_LIVE = …`."))
    else:
        befunde.append(("ok", f"Schalter steht auf {schalter}",
                        "Beta: kein offener Verkauf, Zugang ueber Lizenzschluessel."
                        if schalter == "false" else "Verkauf ist OFFEN."))

    # ── 2. Cache-Stempel ───────────────────────────────────────────────────
    try:
        r = subprocess.run([sys.executable, str(HIER / "stempel.py"), "--pruefen"],
                           capture_output=True, text=True, timeout=60)
        if r.returncode == 0:
            befunde.append(("ok", "Cache-Stempel deckt den Inhalt", ""))
        else:
            befunde.append(("sperre", "Cache-Stempel veraltet",
                            "Bestandsnutzer bekaemen die alte App. `python3 stempel.py --setzen`"))
    except Exception as e:
        befunde.append(("hinweis", "Cache-Stempel nicht pruefbar", str(e)))

    # ── 3. Die Kasse ───────────────────────────────────────────────────────
    # Ein Testlink im Echtbetrieb zieht kein Geld ein und faellt niemandem auf.
    # Die Links liegen in CHECKOUT_ALL.live / .test; ein Getter waehlt anhand
    # des Schalters. Wer hier `CHECKOUT` sucht, findet nichts — und darf das
    # NICHT als "unauffaellig" verbuchen. Erste Fassung dieses Skripts tat
    # genau das und meldete "keine Sperre", ohne die Kasse je gesehen zu haben.
    # Was der Pruefer nicht lesen kann, ist eine Sperre, kein Hinweis.
    ix = lies("index.html")
    mc = re.search(r"CHECKOUT_ALL\s*:\s*\{([\s\S]{0,1800}?)\n\s{2}\}", ix)
    getter = re.search(r"get\s+CHECKOUT\s*\(\s*\)\s*\{[^}]*CHECKOUT_ALL\[[^\]]*LIVE", ix)
    if not mc:
        befunde.append(("sperre", "Zahlungslinks NICHT PRUEFBAR",
                        "CHECKOUT_ALL in index.html nicht lesbar — Aufbau geaendert? "
                        "Ohne Einsicht in die Kasse darf hier nichts freigegeben werden."))
    else:
        block = mc.group(1)
        live_blk = re.search(r"live\s*:\s*\{([\s\S]*?)\}", block)
        echt = re.findall(r"https://[^\s'\"]+", live_blk.group(1)) if live_blk else []
        echt_test = [u for u in echt if "/test_" in u]
        if not live_blk or len(echt) < 2:
            befunde.append(("sperre", "Live-Zahlungslinks unvollstaendig",
                            f"{len(echt)} von 2 gefunden (Monat + Jahr). "
                            "Nur Jan kann sie in Stripe anlegen."))
        elif echt_test:
            befunde.append(("sperre", "Testlink im Live-Satz",
                            f"{len(echt_test)} Link(s) mit /test_ unter CHECKOUT_ALL.live — "
                            "zoege kein Geld ein und faellt erst der Buchhaltung auf."))
        else:
            befunde.append(("ok", "2 Live-Zahlungslinks hinterlegt (Monat + Jahr)", ""))
        if not getter:
            befunde.append(("sperre", "Linksatz haengt nicht am Schalter",
                            "`get CHECKOUT()` waehlt nicht mehr ueber LIVE — dann muesste "
                            "jemand beim Umlegen daran denken. Genau das soll er nicht muessen."))
        else:
            befunde.append(("ok", "Linksatz folgt dem Schalter automatisch", ""))

    # Angezeigter Preis gegen den Betrag, fuer den der Link gilt.
    mb = re.search(r"CHECKOUT_BETRAG\s*:\s*\{\s*month\s*:\s*(\d+)\s*,\s*year\s*:\s*(\d+)", ix)
    mp = re.search(r"soloMonat\s*:\s*(\d+)[\s\S]{0,120}?soloJahr\s*:\s*(\d+)", ix)
    if mb and mp:
        if (mb.group(1), mb.group(2)) == (mp.group(1), mp.group(2)):
            befunde.append(("ok", f"Preis und Zahlungslink stimmen ueberein ({mp.group(1)} € / {mp.group(2)} €)", ""))
        else:
            befunde.append(("sperre", "Angezeigter Preis weicht vom Zahlungslink ab",
                            f"angezeigt {mp.group(1)}/{mp.group(2)} €, Link gilt fuer {mb.group(1)}/{mb.group(2)} €."))

    # ── 4. Rechtliches erreichbar ──────────────────────────────────────────
    # Wer verkauft, braucht Impressum und Datenschutz von JEDER Seite aus.
    seiten = ["index.html", "landing.html", "messen.html", "senden.html",
              "partner.html", "beileger.html"]
    ohne = [s for s in seiten if lies(s) and not re.search(r"impressum\.html", lies(s))]
    if ohne:
        befunde.append(("sperre", "Impressum nicht von jeder Seite erreichbar",
                        "fehlt in: " + ", ".join(ohne)))
    else:
        befunde.append(("ok", f"Impressum von allen {len(seiten)} Seiten erreichbar", ""))

    if not (HIER / "agb.html").exists():
        befunde.append(("hinweis", "Keine AGB-Seite vorhanden",
                        "In der Beta ohne Vertrag vertretbar. Vor OFFENEM Verkauf klaeren."))

    # ── Bericht ────────────────────────────────────────────────────────────
    sperren = [b for b in befunde if b[0] == "sperre"]
    print(f"\n  CARLON EQUINE — bereit fuer den Verkauf?\n  {'─' * 58}")
    for schwere, titel, detail in befunde:
        zeichen = {"ok": f"{G}✓{N}", "sperre": f"{R}✗{N}", "hinweis": f"{Y}~{N}"}[schwere]
        print(f"  {zeichen} {titel}")
        if detail:
            print(f"      {D}{detail}{N}")
    print(f"  {'─' * 58}")
    if sperren:
        print(f"  {R}{len(sperren)} Sperre(n){N} — Schalter jetzt umlegen waere ein stiller Schaden.\n")
    else:
        print(f"  {G}Keine Sperre.{N} Umlegen: live.js auf true, "
              f"`python3 stempel.py --setzen`, committen, pushen.\n")
    return 1 if sperren else 0


if __name__ == "__main__":
    sys.exit(main())
