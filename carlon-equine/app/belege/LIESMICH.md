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

## `vorstufe-eichung.json`

Grundlage fuer den Vermerk im Cockpit (`index.html`, FHIR-Bundle-Bauer),
warum die Filterkette dort noch nicht auf die Kennwerte gelegt ist.

**Wie es entstand (14.08.2026):** Ein Befund vom selben Tag las sich als
Portierungsfehler — der Web-Port liefere auf zwei von vier echten Aufnahmen
eine andere RMSSD als die App (8,31 statt 18,27 ms · 9,31 statt 17,56 ms).
Nachgemessen wurde stufenweise: dieselbe Rohserie durch den Browser-Port und
durch eine uebersetzte Fassung der kanonischen Swift-Kette.

| Spalte | Bedeutung |
|---|---|
| `A_roh` | RMSSD ueber die ungefilterte Rohserie |
| `B_schlagzeile_app` | Drop-Pair, Ausschluss nur AV-Block + Lang-Kurz — was der App-Export ausweist |
| `C_droppair_vollstaendig` | dieselbe Regel, Ausschluss ALLER nicht-normalen Schlaege |
| `D_kette_droppair` | Etiketten der Kette, Paare uebersprungen statt Schlag ersetzt |
| `E_kette_ersetzt` | die Kette wie sie laeuft — Port und Swift liefern hier dasselbe |

**Das Ergebnis:** `E` ist auf allen vier Aufnahmen in beiden Sprachen
identisch (|Δ| = 0). Verglichen worden waren `E` gegen `B` — zwei Groessen,
nicht zwei Umsetzungen. Und der Faktor 2 kommt nicht aus „ersetzen statt
ueberspringen" (`D` gegen `E`: 0,17 %), sondern aus der Ausschlussmenge
(`B` gegen `C`: 18,27 gegen 8,08 ms bei der 21-min-Aufnahme).

**Nachrechnen:**

```
jq '[.aufnahmen[] | select(.port_gleich_swift)] | length'  vorstufe-eichung.json   # → 4
jq '.aufnahmen[2] | {B: .B_schlagzeile_app, C: .C_droppair_vollstaendig, E: .E_kette_ersetzt}' vorstufe-eichung.json
```

**Bewacht von** `t-vorstufe-eichung.mjs` im Pruefstand: derselbe Datensatz
laeuft bei jedem Lauf durch beide Umsetzungen, gegen feste Eichwerte und mit
Gegenprobe. Weicht eine Seite ab oder driftet dieser Beleg, faellt die
Strecke rot.
