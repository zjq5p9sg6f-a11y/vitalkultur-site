# Beleg · Lizenz → Funktion

**Die Frage:** Kauft der Euro, was auf dem Angebot steht? Das Klinik-Angebot
verspricht Stationswand, geteilten Ordner und Entlass-Nachsorge für 590 €/Monat.
Bis zum 04.09.2026 war das **gelesen, nie gemessen**.

## Wie die Probe läuft

1. Schlüssel minten (nur Jan, braucht den privaten Schlüssel):
   ```
   cd ~/Developer/carlon-clinic
   node mint-license.js "TEST Pferdeklinik" vet_clinic 1
   ```
2. Cockpit lokal ausliefern und öffnen:
   ```
   cd ~/Developer/vitalkultur-site && python3 -m http.server 8799
   # http://localhost:8799/carlon-equine/app/index.html
   ```
3. In der Browser-Konsole — ruft die **ausgelieferte** `License`, keinen Nachbau:

```js
async function leeren(){                       // IMMER erst leeren.
  State.settings.license = null;               // Sonst kann die Probe nicht
  await State.saveSettings();                  // zwischen „abgelehnt, alter
  await License.loadFromSettings();            // Zustand bleibt" und
  return License.tier();                       // „angenommen" unterscheiden.
}
async function probe(name, key){
  const vor = await leeren();
  let r = null; try { r = await License.activate(key); } catch(e){ r = 'wirft: '+e.message; }
  return {probe:name, ausgangslage:vor, rueckgabe:r,
          stufeDanach:License.tier(), stationDanach:License.can('station')};
}
```

Dann `probe()` mit dem echten Schlüssel und mit drei Fälschungen aufrufen:
Signatur um ein Zeichen verfälscht · Nutzlast auf `tier:'vet_clinic', seats:9999`
aufgebohrt bei echter Signatur · Müll-String.

## Ergebnis 04.09.2026

| Probe | Ausgangslage | Rückgabe | Stufe danach | `station` |
|---|---|---|---|---|
| **Echter Schlüssel** (Gegenprobe: muss wirken) | demo | `true` | **vet_clinic** | **auf** |
| Signatur um 1 Zeichen verfälscht | demo | `false` | demo | zu |
| **Nutzlast aufgebohrt, Signatur echt** | demo | `false` | demo | zu |
| Müll-String | demo | `false` | demo | zu |

Mit echtem Schlüssel gehen **alle zehn** Funktionen auf — `clinicBranding`,
`multiSeat`, `nachsorge`, `station`, `sharedFolder` **und** `pdf`, `csv`,
`routeHandoff`, `coherence`, `ownerFeedback`. Stufe `vet_clinic`, 5 Plätze,
Lizenznehmer-Name durchgereicht.

**Die ECDSA-Prüfung ist echt.** Der klassische Angriff — Nutzlast umschreiben,
echte Signatur dranlassen — wird abgelehnt.

## Der Fehler, den diese Probe zuerst hatte

Der erste Durchlauf entfernte die gute Lizenz **nicht** vor den Fälschungen.
Alle drei meldeten danach `vet_clinic` — und das konnte „abgelehnt, alter
Zustand behalten" (richtig) oder „angenommen" (katastrophal) heißen. Eine
Probe, die zwischen dem Erfolgs- und dem Katastrophenfall nicht unterscheidet,
beweist nichts. `leeren()` vor jeder Fälschung ist der ganze Unterschied.

> Bearbeitet: 2026-09-04 

---

# Beleg · Halter → Tierarzt (versiegelte Kette)

**Die Frage:** Kommt eine Aufnahme, die eine Halterin über den Aushang-Link
macht, wirklich unverfälscht in der Praxis an — und wird sie abgelehnt, wenn
sie an jemand anderen adressiert ist?

Auch dieser Weg war bis zum 04.09.2026 **gelesen, nie durchlaufen**.

## Ergebnis 04.09.2026 (ausgelieferte `Krypto` / `Praxis` / `Importer`)

| Fall | `ok` | Meldung |
|---|---|---|
| **Richtige Praxis** | `true` | Pferdename und alle 60 Schläge unverändert |
| Fremdes Fach | `false` | „An eine andere Praxis adressiert — diese Aufnahme kann nur mit deren Schlüssel geöffnet werden" |
| Chiffrat verfälscht | `false` | „ließ sich mit dem Schlüssel dieses Geräts nicht öffnen" |

Umschlag-Form: `{v, weg, iv, c}` — ECIES P-256 + AES-GCM, die Fachnummer als
AAD gebunden.

**Der Punkt, auf den es ankommt:** Die beiden Ablehnungen haben
**unterschiedliche** Meldungen. Der Code vergleicht die Fachnummer **vor** dem
Entschlüsseln — sonst scheiterte eine fremd adressierte Sendung an der Bindung
und meldete dasselbe wie ein defektes Chiffrat; die Tierärztin suchte den
Fehler dann am falschen Ort. Diese Absicht steht seit heute nicht nur im
Kommentar, sie ist gemessen.

## Probe (Browser-Konsole, lokal ausgeliefert)

```js
const ich = await Praxis.ich();
const umschlag = await Krypto.versiegeln(ich.boxPub, JSON.stringify(aufnahme), ich.fach);
const huelle = {art:'carlon-umschlag', v:1, fach:ich.fach, umschlag};
await Importer.umschlagOeffnen(huelle);                       // muss ok:true
await Importer.umschlagOeffnen({...huelle, fach:'X'+ich.fach.slice(1)});   // muss verweigern
await Importer.umschlagOeffnen({...huelle, umschlag:{...umschlag, c:umschlag.c.slice(0,-4)+'AAAA'}});
```

> Bearbeitet: 2026-09-04 
