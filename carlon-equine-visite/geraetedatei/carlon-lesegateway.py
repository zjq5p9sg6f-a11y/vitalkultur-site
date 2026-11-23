#!/usr/bin/env python3
"""CARLON Lese-Gateway 1.0 · Modbus TCP → Netzwerk-Adresse für CARLON Equine Visite

Für Steuerungen, die Werte nur über Modbus TCP anbieten (z. B. Siemens LOGO! 8.1 bis 8.3, viele ältere Steuerungen).
Ein Browser kann Modbus nicht selbst lesen. Dieses Programm läuft auf einem Rechner im Betriebsnetz (PC, Raspberry Pi,
Industrie-PC), liest die eingestellten Register NUR LESEND (Funktion 03 oder 04) und stellt sie als JSON unter
http://<rechner>:8090/werte.json bereit. In Visite: Reha-Aufnahme › Live-Werte › Netzwerk-Adresse.

Nur Python 3 (ab 3.8), keine Zusatzpakete. Schreibt nie in die Steuerung.

Aufruf:   python3 carlon-lesegateway.py gateway.json
Beispiel gateway.json:
{
  "steuerung": {"host": "192.168.0.3", "port": 502, "unit": 1, "funktion": 3},
  "takt_s": 1,
  "port": 8090,
  "erlaubt": ["https://vitalkultur.com"],
  "werte": {
    "speed_kmh":      {"register": 0, "faktor": 0.1},
    "incline_pct":    {"register": 1, "faktor": 0.1},
    "water_depth_cm": {"register": 2, "faktor": 1},
    "water_temp_c":   {"register": 3, "faktor": 0.1, "vorzeichen": true}
  }
}
"register" ist die Adresse ab 0, so wie sie im Modbus-Telegramm steht (Holding-Register 40001 = 0). Welcher Wert in
welchem Register liegt, legt das Programm der Steuerung fest; das weiß der Maschinenhersteller.
"""
import json
import socket
import struct
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

STAND = {"werte": {}, "zeit": None, "fehler": "noch keine Antwort"}
ERLAUBT = ["https://vitalkultur.com"]   # nur diese Webseiten dürfen die Werte im Browser lesen (Angabe "erlaubt" in gateway.json)
SPERRE = threading.Lock()


def lesen(cfg, start, anzahl, tid):
    """Ein Modbus-TCP-Lesetelegramm (Funktion 03/04), gibt die Register als Liste zurück."""
    st = cfg["steuerung"]
    fn = int(st.get("funktion", 3))
    if fn not in (3, 4):
        raise ValueError("nur Lesefunktionen 03 und 04 erlaubt")
    pdu = struct.pack(">BHH", fn, start, anzahl)
    adu = struct.pack(">HHHB", tid & 0xFFFF, 0, len(pdu) + 1, int(st.get("unit", 1))) + pdu
    with socket.create_connection((st["host"], int(st.get("port", 502))), timeout=3) as s:
        s.sendall(adu)
        kopf = b""
        while len(kopf) < 7:
            teil = s.recv(7 - len(kopf))
            if not teil:
                raise ConnectionError("Verbindung geschlossen")
            kopf += teil
        _, _, laenge, _ = struct.unpack(">HHHB", kopf)
        rest = b""
        while len(rest) < laenge - 1:
            teil = s.recv(laenge - 1 - len(rest))
            if not teil:
                raise ConnectionError("Verbindung geschlossen")
            rest += teil
    if rest[0] & 0x80:
        raise ValueError("Modbus-Ausnahme %d" % rest[1])
    n = rest[1]
    return list(struct.unpack(">%dH" % (n // 2), rest[2:2 + n]))


def schleife(cfg):
    werte = cfg["werte"]
    regs = [int(w["register"]) for w in werte.values()]
    start, ende = min(regs), max(regs)
    tid = 0
    while True:
        tid += 1
        try:
            r = lesen(cfg, start, ende - start + 1, tid)
            neu = {}
            for name, w in werte.items():
                roh = r[int(w["register"]) - start]
                if w.get("vorzeichen") and roh >= 0x8000:
                    roh -= 0x10000
                neu[name] = round(roh * float(w.get("faktor", 1)), 3)
            with SPERRE:
                STAND.update(werte=neu, zeit=time.strftime("%Y-%m-%dT%H:%M:%S%z"), fehler=None)
        except Exception as e:  # Steuerung aus, Kabel ab: letzter Stand bleibt sichtbar, Fehler wird gemeldet
            with SPERRE:
                STAND["fehler"] = str(e)
        time.sleep(float(cfg.get("takt_s", 1)))


class Antwort(BaseHTTPRequestHandler):
    def kopf(self, code=200):
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        herkunft = self.headers.get("Origin", "")
        if herkunft in ERLAUBT:
            self.send_header("Access-Control-Allow-Origin", herkunft)
            self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Private-Network", "true")   # Chrome: Zugriff aus dem Web ins Betriebsnetz
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.end_headers()

    def do_OPTIONS(self):
        self.kopf(204)

    def do_GET(self):
        if self.path.split("?")[0] not in ("/", "/werte.json"):
            self.kopf(404)
            self.wfile.write(b'{"fehler":"nur /werte.json"}')
            return
        with SPERRE:
            body = dict(STAND["werte"])
            body["_zeit"] = STAND["zeit"]
            if STAND["fehler"]:
                body["_fehler"] = STAND["fehler"]
        self.kopf()
        self.wfile.write(json.dumps(body).encode())

    def log_message(self, *a):
        pass


def main():
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(1)
    cfg = json.load(open(sys.argv[1], encoding="utf-8"))
    ERLAUBT[:] = cfg.get("erlaubt", ERLAUBT)
    threading.Thread(target=schleife, args=(cfg,), daemon=True).start()
    port = int(cfg.get("port", 8090))
    print("CARLON Lese-Gateway: liest %s:%s, bereit unter http://<dieser-rechner>:%d/werte.json"
          % (cfg["steuerung"]["host"], cfg["steuerung"].get("port", 502), port))
    ThreadingHTTPServer(("0.0.0.0", port), Antwort).serve_forever()


if __name__ == "__main__":
    main()
