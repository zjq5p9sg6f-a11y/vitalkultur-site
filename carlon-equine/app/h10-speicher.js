/* ═══════════════════════════════════════════════════════════════════════════
   h10-speicher.js — Polar-H10-Gurtspeicher (PSFTP, Dienst 0xFEEE) im Browser
   ───────────────────────────────────────────────────────────────────────────
   1:1 nach dem kanonischen App-Client CarlonCore/Sources/CarlonSensor/PolarH10PSFTP.swift
   (hardware-verifiziert gegen H10 Firmware 5.0.0) und der Mac-Gegenprobe
   gurt-attrappe/quelle/psftp-probe.swift. Nichts erfunden, nur übersetzt:
     · Luftpaket RFC76: Kopf = (seq & 0x0F) << 4 | status << 1; status 2 = Zwischen-, 1 = letzter
       Rahmen, 0 = Ende/Fehler (Bytes 1..2 = Fehlercode LE). Große Dateien kommen in mehreren
       Fenstern, jedes endet mit status 1 → 2 s Gnadenfrist, dann fertig.
     · Anfrage = [Länge LE, Bit 15 = 0][PbPFtpOperation]  (GET = 0, REMOVE = 3)
     · Query   = [qid LE, Bit 15 = 1][Parameter]  (14 Start, 15 Stopp, 16 Status)
     · Start-Parameter: sample_type 16 (RR), recording_interval { seconds = 1 }, Kennung
     · SAMPLES.BPB: Feld 28 (Polar-Schema) oder 2 = PbExerciseRRIntervals { 1: RR in ms },
       Feld 1 = Meta (4 = Kennung). Grenzen wie der Kanon: nur < 200 oder > 12 000 ms ist absurd
       (nie 3000 — sonst verschwindet jeder AV-Block 2. Grades samt Zeit).
     · Fehler 106 = nicht gekoppelt → einmal die verschlüsselte MTU-Charakteristik lesen, das
       Betriebssystem koppelt; Fehler 103 = Datei fehlt.
     · Der H10 hat EINEN Aufnahmeplatz: alte Aufnahmen blockieren den Start. Darum zuerst ernten,
       sichern, gegenlesen — und erst dann löschen (Gurtspeicher = Funkloch-Netz, nie verlieren).
   RAHMEN: reines ES2020, keine Abhängigkeiten. Im Browser als <script>, in Node per require().
   ═══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  const UUID = {
    dienst: '0000feee-0000-1000-8000-00805f9b34fb',
    mtu: 'fb005c51-02e7-f387-1cad-8acd2d8df0c8',
    h2d: 'fb005c53-02e7-f387-1cad-8acd2d8df0c8',
  };
  const GRENZE = { untenMs: 200, obenMs: 12000 };
  const RR_TYP = 16;          // PbSampleType SAMPLE_TYPE_RR_INTERVAL
  const RAHMEN_NUTZ = 19;     // Rückfall: 20-Byte-Pakete, Folgepakete mit next-Bit (RFC76 Bit 0)
  /* EIN Paket wie PolarH10PSFTP.swift (maximumWriteValueLength .withResponse = 512 unter CoreBluetooth; Chrome am Mac nutzt
     denselben Stapel). Am echten H10 (18CE9C3D, 20.11.2026) lehnte der Gurt das zweite 20-Byte-Paket ohne next-Bit ab und trennte. */
  const RAHMEN_GROSS = 500;
  const VERSION = 'h10-speicher 1.1 (Port PolarH10PSFTP.swift + h10StartVersuch, Sync-Sitzung, ein Paket, 2026-11-20)';

  /* ── Protobuf, minimal ─────────────────────────────────────────────────── */
  function varint(v) { const o = []; v = Number(v); do { let b = v % 128; v = Math.floor(v / 128); if (v) b |= 0x80; o.push(b); } while (v); return o; }
  function liesVarint(d, i) { let v = 0, f = 1; while (i < d.length) { const b = d[i++]; v += (b & 0x7f) * f; if (!(b & 0x80)) return [v, i]; f *= 128; } return null; }
  /** [[feldnummer, drahttyp, wert]] — Tag als Varint (Feld 28 hat zwei Tag-Bytes 0xE2 0x01) */
  function felder(d) {
    const out = []; let i = 0;
    while (i < d.length) {
      const t = liesVarint(d, i); if (!t) break; i = t[1]; const nr = Math.floor(t[0] / 8), typ = t[0] & 7;
      if (typ === 0) { const v = liesVarint(d, i); if (!v) break; out.push([nr, 0, v[0]]); i = v[1]; }
      else if (typ === 2) { const n = liesVarint(d, i); if (!n) break; i = n[1]; if (i + n[0] > d.length) break; out.push([nr, 2, d.slice(i, i + n[0])]); i += n[0]; }
      else if (typ === 5) i += 4; else if (typ === 1) i += 8; else break;
    }
    return out;
  }
  const text = b => { try { return new TextDecoder().decode(b); } catch (_) { return String.fromCharCode.apply(null, b); } };
  const bytes = s => Array.from(new TextEncoder().encode(s));

  /* ── Anfragen ──────────────────────────────────────────────────────────── */
  function anfrage(befehl, pfad) { const p = bytes(pfad), proto = [0x08, befehl, 0x12, ...varint(p.length), ...p]; return [proto.length & 0xff, (proto.length >> 8) & 0x7f, ...proto]; }
  function query(qid, params) { return [qid & 0xff, ((qid >> 8) & 0x7f) | 0x80, ...(params || [])]; }
  function startParameter(kennung) { const k = bytes(kennung); return [0x08, ...varint(RR_TYP), 0x12, 0x02, 0x18, 0x01, 0x1a, ...varint(k.length), ...k]; }
  /** [Länge LE][Inhalt] abstreifen, wenn die Länge passt (wie stripPSFTPLengthPrefix) */
  function ohneLaenge(d) { if (d.length < 2) return d; const n = d[0] | ((d[1] & 0x7f) << 8); return (n === d.length - 2 || n === d.length) ? d.slice(2) : d; }

  /* ── Antworten lesen ───────────────────────────────────────────────────── */
  function liste(d) {
    return felder(ohneLaenge(d)).filter(f => f[0] === 1 && f[1] === 2).map(f => {
      const e = felder(f[2]), n = e.find(x => x[0] === 1 && x[1] === 2), g = e.find(x => x[0] === 2 && x[1] === 0);
      const name = n ? text(n[2]) : '?'; return { name, groesse: g ? g[2] : 0, ordner: name.endsWith('/') };
    });
  }
  function status(d) { const f = felder(ohneLaenge(d)); const on = f.find(x => x[0] === 1 && x[1] === 0), k = f.find(x => x[0] === 2 && x[1] === 2); return { laeuft: !!(on && on[2]), kennung: k ? text(k[2]) : null }; }
  function rrAusVerschachtelt(n) { const rr = []; for (const [nr, typ, v] of felder(n)) { if (nr !== 1) continue; if (typ === 2) { let i = 0; while (i < v.length) { const x = liesVarint(v, i); if (!x) break; rr.push(x[0]); i = x[1]; } } else if (typ === 0) rr.push(v); } return rr; }
  /** SAMPLES.BPB → { rr, hf, kennung, verworfen } (Kanon parseSamplesBPB) */
  function bpb(roh) {
    // ABWEICHUNG vom Kanon (bewusst, 20.11.2026): Feld 2 gilt NUR dann als RR-Quelle, wenn Feld 28 fehlt.
    // Feld 2 trägt beim H10 die Puls-Sekundenwerte als gepackte Varints. Der Kanon erkennt sie an „alle Bytes
    // 30–220“ – ein ruhendes Pferd liegt aber bei 25–29 bpm, dann würden Pulswerte als RR gelesen.
    const d = ohneLaenge(roh); let rr = [], hf = [], kennung = null, verworfen = 0; const feld2 = [];
    const gut = x => isFinite(x) && x >= GRENZE.untenMs && x <= GRENZE.obenMs; let hat28 = false;
    for (const [nr, typ, v] of felder(d)) {
      if (typ !== 2) continue;
      if (nr === 28) { hat28 = true; const r = rrAusVerschachtelt(v); const g = r.filter(gut); verworfen += r.length - g.length; rr = rr.concat(g); }
      else if (nr === 2) feld2.push(v);
      else if (nr === 1) { const m = felder(v).find(x => x[0] === 4 && x[1] === 2); if (m) kennung = text(m[2]); }
    }
    for (const v of feld2) {
      if (hat28 || (v.length >= 5 && v.every(b => b >= 20 && b <= 220))) { let i = 0; while (i < v.length) { const x = liesVarint(v, i); if (!x) break; hf.push(x[0]); i = x[1]; } }
      else { const r = rrAusVerschachtelt(v); const g = r.filter(gut); verworfen += r.length - g.length; rr = rr.concat(g); }
    }
    return { rr, hf, kennung, verworfen };
  }

  class Fehler extends Error { constructor(code, text) { super(text || ('PSFTP-Fehler ' + code)); this.code = code; } }
  const FEHLERTEXT = { 103: 'Datei im Gurt nicht vorhanden', 106: 'Gurt ist nicht gekoppelt' };

  /* ── Client über eine Web-Bluetooth-Verbindung ─────────────────────────── */
  class Client {
    constructor(server, opt) { this.server = server; this.gross = !(opt && opt.gross === false); this.gnadeMs = (opt && opt.gnadeMs) || 2000; this._kette = Promise.resolve(); this._w = null; this.protokoll = (opt && opt.protokoll) || (() => {}); }
    async init() {
      const svc = await this.server.getPrimaryService(UUID.dienst);
      this.mtu = await svc.getCharacteristic(UUID.mtu);
      try { this.h2d = await svc.getCharacteristic(UUID.h2d); } catch (_) { this.h2d = null; }
      this._ein = e => { const v = e.target.value; this._empfang(new Uint8Array(v.buffer, v.byteOffset, v.byteLength)); };
      this.mtu.addEventListener('characteristicvaluechanged', this._ein);
      await this.mtu.startNotifications();
      return this;
    }
    trennen() { try { this.mtu && this.mtu.removeEventListener('characteristicvaluechanged', this._ein); } catch (_) { } this._abbruch(new Fehler(-1, 'Verbindung getrennt')); }
    _empfang(d) {
      const w = this._w; if (!w || !d.length) return;            // nichts erwartet → verspätete Rahmen verwerfen
      const st = (d[0] & 0x06) >> 1;
      if (st === 0) return this._fertig(d.length >= 3 ? d[1] | (d[2] << 8) : 0);
      w.teile.push(d.slice(1)); w.n += d.length - 1; clearTimeout(w.gnade);
      if (w.fortschritt) try { w.fortschritt(w.n); } catch (_) { }
      if (st === 1) w.gnade = setTimeout(() => this._fertig(0), this.gnadeMs);
      clearTimeout(w.frist); w.frist = setTimeout(() => this._abbruch(new Fehler(-2, 'Zeitüberschreitung')), w.fristMs);
    }
    _fertig(code) {
      const w = this._w; if (!w) return; this._w = null; clearTimeout(w.gnade); clearTimeout(w.frist);
      if (code) return w.nein(new Fehler(code, FEHLERTEXT[code]));
      const out = new Uint8Array(w.n); let o = 0; for (const t of w.teile) { out.set(t, o); o += t.length; } w.ja(out);
    }
    _abbruch(f) { const w = this._w; if (!w) return; this._w = null; clearTimeout(w.gnade); clearTimeout(w.frist); w.nein(f); }
    /** Seriell: eine Operation nach der anderen (wie die Task-Kette im App-Client) */
    _senden(nutz, fristMs, fortschritt) {
      const lauf = () => new Promise((ja, nein) => {
        this._w = { ja, nein, teile: [], n: 0, fortschritt, fristMs: fristMs || 15000, gnade: null };
        this._w.frist = setTimeout(() => this._abbruch(new Fehler(-2, 'Zeitüberschreitung')), this._w.fristMs);
        (async () => {
          if (this.gross && nutz.length <= RAHMEN_GROSS) {
            try { await this.mtu.writeValueWithResponse(new Uint8Array([0x02, ...nutz])); this.protokoll('ein Paket', nutz.length); return; }
            catch (e) { if (!(this.server && this.server.connected) || nutz.length <= RAHMEN_NUTZ) throw e; this.gross = false; this.protokoll('Rückfall auf 20-Byte-Pakete', String(e && e.message)); }
          }
          let off = 0, seq = 0;
          do { const ende = Math.min(off + RAHMEN_NUTZ, nutz.length), st = ende === nutz.length ? 1 : 2;
            await this.mtu.writeValueWithResponse(new Uint8Array([((seq & 0x0f) << 4) | (st << 1) | (seq > 0 ? 1 : 0), ...nutz.slice(off, ende)]));
            off = ende; seq++; } while (off < nutz.length);
        })().catch(e => this._abbruch(e instanceof Fehler ? e : new Fehler(-3, String(e && e.message || e))));
      });
      const p = this._kette.then(lauf, lauf); this._kette = p.catch(() => {}); return p;
    }
    async status() { return status(await this._senden(query(16))); }
    /** Mitteilung Host→Gerät über H2D (ohne Antwort), wie sendNotification in PolarH10PSFTP.swift */
    async mitteilung(id, nutz) { if (!this.h2d) return; const d = new Uint8Array([0x02, id, ...(nutz || [])]);
      await (this.h2d.writeValueWithoutResponse ? this.h2d.writeValueWithoutResponse(d) : this.h2d.writeValue(d)); await new Promise(r => setTimeout(r, 150)); }
    /** Sync-Sitzung (Polar SyncImplementationGuideline): Query 13 + Mitteilung 8 INITIALIZE_SESSION + 0 START_SYNC.
        Ohne sie verweigert der H10 den Aufnahmebefehl (Research-App, hardware-bewiesen 14.08.2026). */
    async sitzungAuf() { await this._senden(query(13)); await this.mitteilung(8); await this.mitteilung(0); }
    async sitzungZu() { try { await this.mitteilung(1, [0x08, 0x01]); await this.mitteilung(9); } catch (_) { } }
    /** Start genau wie h10StartVersuch (ResearchSensorService.swift): STOP auch ohne laufende Aufnahme, Sitzung schließen,
        für den Start eine NEUE Sitzung, darin noch einmal STOP, dann Query 14, Sitzung schließen. */
    async start(kennung) {
      try { await this.sitzungAuf(); } catch (_) { } try { await this.stopp(); } catch (_) { } await this.sitzungZu();
      try { await this.sitzungAuf(); } catch (_) { } try { await this.stopp(); } catch (_) { }
      try { await this._senden(query(14, startParameter(kennung))); } finally { await this.sitzungZu(); }
    }
    async stopp() { await this._senden(query(15)); }
    async liste(pfad) { return liste(await this._senden(anfrage(0, pfad || '/'))); }
    /** Frist wie der App-Client: 15 s + 1 s je 3 KB, höchstens 300 s */
    async datei(pfad, groesse, fortschritt) { return this._senden(anfrage(0, pfad), Math.min(300000, 15000 + ((groesse || 0) / 3000) * 1000), fortschritt); }
    /** Ordner: erst die Dateien, dann den Ordner (Research-App: der Platz wird frei, wenn SAMPLES.BPB weg ist; ein nicht
        leerer Ordner antwortet mit 103). Ein Fehler beim Ordner selbst zählt nicht, die Dateien müssen weg sein. */
    async loeschen(pfad) {
      if (!pfad.endsWith('/')) return void await this._senden(anfrage(3, pfad));
      let inhalt = []; try { inhalt = await this.liste(pfad); } catch (e) { if (e && e.code === 103) return; throw e; }
      for (const f of inhalt) await this._senden(anfrage(3, pfad + f.name));
      try { await this._senden(anfrage(3, pfad)); } catch (_) { }
    }
    /** Kopplung anstoßen: Lesen der verschlüsselten Charakteristik lässt das System koppeln */
    async koppeln() { try { await this.mtu.readValue(); } catch (_) { } await new Promise(r => setTimeout(r, 800)); }
    /** Alle Aufnahmen auf dem Gurt (Ordner mit SAMPLES*), eigener Kopplungs-Rest PROBE wird entfernt */
    async aufnahmen() {
      const out = [];
      for (const e of await this.liste('/')) {
        if (!e.ordner) continue; const ordner = '/' + e.name;
        if (e.name.replace(/\//g, '') === 'PROBE') { try { await this.loeschen(ordner + 'SAMPLES.BPB'); } catch (_) { } try { await this.loeschen(ordner); } catch (_) { } continue; }
        let inhalt = []; try { inhalt = await this.liste(ordner); } catch (_) { continue; }
        for (const f of inhalt) if (/SAMPLES/i.test(f.name)) out.push({ ordner, pfad: ordner + f.name, groesse: f.groesse });
      }
      return out;
    }
    /** Eine Aufnahme laden und lesen */
    async ernte(a, fortschritt) { const roh = await this.datei(a.pfad, a.groesse, fortschritt); return Object.assign({ ordner: a.ordner, pfad: a.pfad, bytes: roh.length }, bpb(roh)); }
  }

  /** Kennung ≤ 32 Zeichen: CV-<Startzeit base36>-<Pferd-Kurzzeichen>. Aus ihr lässt sich ein Fund zuordnen. */
  function kennung(startMs, pferdId) { let h = 0; for (const c of String(pferdId)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return 'CV-' + Math.floor(startMs).toString(36) + '-' + h.toString(36).slice(0, 6); }
  function kennungLesen(k) { const m = /^CV-([0-9a-z]+)-([0-9a-z]+)$/.exec(k || ''); return m ? { startMs: parseInt(m[1], 36), pferd: m[2] } : null; }

  const API = { UUID, GRENZE, VERSION, Client, Fehler, kennung, kennungLesen, _intern: { varint, liesVarint, felder, anfrage, query, startParameter, liste, status, bpb, ohneLaenge } };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else global.H10Speicher = API;
})(typeof window !== 'undefined' ? window : globalThis);
