# Belege für öffentliche Aussagen

Was auf einer Seite steht, die jemand liest, braucht hier einen Nachweis,
der sich nachrechnen lässt. Nicht als Zierde — sondern damit eine Aussage
nicht still falsch wird, wenn sich der Code darunter ändert.

## `vorstufe-vergleich.json`

Grundlage für den Satz auf der Visite-Seite:

> „Ohne diese Vorstufe fiel in **acht von zwanzig** Aufnahmen die
> Atemwegs-Einstufung anders aus, jedes Mal zu auffällig. Mit ihr: kein
> einziger Unterschied mehr zur App-Auswertung."

**Wie es entstand (08.08.2026):** Zwanzig synthetische Pferde-Ruheaufnahmen
(deterministisch erzeugt, Ruhepuls 26,7–44,2 bpm, Länge 6,9–20,0 min,
198–562 Schläge) wurden durch drei Ketten geschickt:

| Spalte | Bedeutung |
|---|---|
| `app` | die kompilierte Swift-Kette der iOS-App |
| `alt` | das Browser-Cockpit **ohne** Vorstufe (Stand bis 08.08.) |
| `neu` | das Browser-Cockpit **mit** portierter Vorstufe |

Die Klassen der zwanzig Reihen: saubere Aufnahmen, Artefakte von 1 bis
12 %, AV-Block-Pausen von 5 bis 40, sehr ruhige Pferde nahe der
200-Schlag-Grenze, kurze Aufnahmen an der 420-s-Schranke, und zwei
gezielte Grenzlagen.

**Nachrechnen:**

```
jq '[.[] | select(.kipptAlt)] | length'  vorstufe-vergleich.json   # → 8
jq '[.[] | select(.kipptNeu)] | length'  vorstufe-vergleich.json   # → 0
```

**Bewacht von** `t-versprechen.mjs` im Prüfstand: Der Satz auf der Seite
und die Zahl in dieser Datei müssen übereinstimmen. Ändert sich eines von
beidem, fällt die Strecke rot.

**Was diese Datei NICHT ist:** kein klinischer Nachweis und keine
Studie. Sie belegt ausschließlich, dass zwei Rechenwege bei denselben
Eingaben dasselbe Ergebnis liefern — nicht, dass das Ergebnis medizinisch
richtig ist. Dafür steht die Kalibrierung des Screeners gegen die
veröffentlichte Studie, nicht diese Messung.
