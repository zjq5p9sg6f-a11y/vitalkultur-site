#!/usr/bin/env python3
"""stempel.py — der Cache-Stempel des Service Workers, abgeleitet statt getippt.

WARUM ES DAS GIBT
  Der Service Worker haelt die App-Huelle unter `VERSION` fest. Aendert sich
  eine Datei, ohne dass VERSION mitwandert, bekommt JEDER, der die App schon
  installiert hat, weiterhin die alte Fassung — und zwar lautlos. Kein Fehler,
  keine Meldung, die Seite ist einfach von gestern.

  Genau das ist am 12.08.2026 passiert: VERSION wurde in einem Commit
  hochgezaehlt, danach kamen zwei weitere Commits an `index.html`. Der Stempel
  stand still, waehrend der Inhalt weiterlief.

  Ein Stempel, den man von Hand setzt, driftet zwangslaeufig — er haengt daran,
  dass jemand daran denkt. Deshalb wird er hier aus dem INHALT abgeleitet.
  Andere Datei, anderer Stempel. Ohne Zutun, ohne Erinnerung.

AUFRUF
  python3 stempel.py --pruefen   # still, Exit 1 wenn der Stempel veraltet ist
  python3 stempel.py --setzen    # schreibt den abgeleiteten Stempel in sw.js

  `--pruefen` gehoert vor jeden Deploy. Es ist eine Pruefung, die ROT werden
  kann — genau dann, wenn sie gebraucht wird.
"""
import hashlib
import pathlib
import re
import sys

HIER = pathlib.Path(__file__).resolve().parent
SW = HIER / "sw.js"
PRAEFIX = "carlon-clinic-"


def kern_dateien():
    """Die Liste, die der Worker selbst vorhaelt — eine Quelle, nicht zwei.

    Waere sie hier nochmal getippt, liefe sie irgendwann gegen die echte
    Liste auseinander und der Stempel wuerde Aenderungen an einer Datei
    uebersehen, die er zu decken behauptet.
    """
    t = SW.read_text()
    m = re.search(r"CORE\s*=\s*\[([\s\S]*?)\]", t)
    if not m:
        raise SystemExit("sw.js: CORE-Liste nicht gefunden — Aufbau geaendert?")
    return [p for p in re.findall(r"'([^']+)'", m.group(1))]


def abgeleitet():
    h = hashlib.sha256()
    fehlend = []
    for name in sorted(kern_dateien()):
        p = HIER / name
        if not p.exists():
            fehlend.append(name)
            continue
        # Der Name gehoert mit hinein: sonst aendert Umbenennen den Stempel nicht.
        h.update(name.encode())
        h.update(p.read_bytes())
    return PRAEFIX + h.hexdigest()[:10], fehlend


def steht_in_sw():
    m = re.search(r"const VERSION = '([^']+)';", SW.read_text())
    return m.group(1) if m else None


def main():
    was = sys.argv[1] if len(sys.argv) > 1 else "--pruefen"
    soll, fehlend = abgeleitet()
    ist = steht_in_sw()

    if fehlend:
        # Eine Datei, die der Worker cachen will und die es nicht gibt, laesst
        # die Installation des Workers fehlschlagen — dann greift GAR kein Cache.
        print(f"  ⚠ In CORE gelistet, aber nicht vorhanden: {', '.join(fehlend)}")

    if was == "--setzen":
        if ist == soll:
            print(f"  Stempel bereits aktuell: {soll}")
            return 0
        SW.write_text(SW.read_text().replace(f"const VERSION = '{ist}';",
                                             f"const VERSION = '{soll}';", 1))
        if steht_in_sw() != soll:
            raise SystemExit("  ✗ Schreiben fehlgeschlagen — sw.js unveraendert.")
        print(f"  Stempel gesetzt: {ist} → {soll}")
        return 0

    if ist == soll:
        print(f"  ✓ Cache-Stempel deckt den Inhalt: {soll}")
        return 0
    print(f"  ✗ Cache-Stempel VERALTET.\n      in sw.js : {ist}\n      Inhalt   : {soll}")
    print("      Bestandsnutzer bekaemen weiter die alte App. `--setzen` behebt es.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
