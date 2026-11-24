/* STEUERUNG LIVE (22.11.2026, Jan: „falls die Steuerung drahtlos in Echtzeit Daten hergibt, muss das reibungslos und intuitiv einrichtbar sein“)
   Drei Wege, ein Ablauf: (1) WLAN/Netz – Visite fragt jede Sekunde eine Adresse der Steuerung oder eines Gateways ab (JSON, „k=v“ oder CSV-Zeile),
   (2) MQTT über WebSocket – z. B. LOGO! 8.4 an einen Broker im Betrieb, (3) Bluetooth – Gateway mit CARLON-Profil oder eigener Dienst-UUID.
   Einrichten: Weg wählen → Adresse → „Verbinden und testen“ zeigt die ankommenden Werte live mit Vorschlag der Bedeutung → für dieses Gerät speichern.
   In der Aufnahme setzt Visite die Einstellungen dann selbst und legt eine Stufe an, sobald neue Werte haltSec lang stehen. NUR LESEN: Visite sendet
   nichts an die Steuerung (MQTT: nur SUBSCRIBE; HTTP: nur GET; Bluetooth: nur Benachrichtigungen). */
(function (g) {
  'use strict';
  const S = () => g.Steuerung;
  /* Web-Seite (https): Netzwege gesperrt, s. dialog(). Lokal (file:, http://localhost) für Entwicklung offen. */
  const NETZ_GESPERRT = g.location && g.location.protocol === 'https:';
  /* Chrome Local Network Access (ab 142): die Zieladresse muss zum angegebenen Adressraum passen – eigener Rechner = loopback,
     Betriebsnetz (private IP, .local) = local, sonst nichts angeben. Falsche Angabe lässt die Anfrage scheitern (Prüfkreis 22.11.). */
  const raum = url => { try { const h = new URL(url).hostname.replace(/^\[|\]$/g, '');
      if (/^(localhost|127\.|::1$)/.test(h)) return { targetAddressSpace: 'loopback' };
      if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|fd|fc)|\.local$/i.test(h)) return { targetAddressSpace: 'local' }; } catch (_) {} return {}; };
  /* CARLON-Bluetooth-Profil 1.0 für Gateways: ein Dienst, eine Kennlinie mit Benachrichtigung, Inhalt UTF-8 „speed_kmh=4.8;incline_pct=2.0“ oder JSON */
  const BLE = { dienst: 'c4a7a000-5e2d-4f1c-9b6a-0e1e9a5c0001', wert: 'c4a7a001-5e2d-4f1c-9b6a-0e1e9a5c0001' };

  /* Nachricht → flache Schlüssel/Wert-Liste */
  function flach(text, kopf) {
    const t = String(text).trim(); if (!t) return {};
    if (/^[{[]/.test(t)) { try { const o = JSON.parse(t), out = {};
      /* Siemens LOGO! 8.x Cloud/MQTT-Format (Systemhandbuch „Cloud data format“): {"state":{"reported":{"<name>":{"desc":"<bereich>-<typ>-<start>-<anzahl>","value":[…]},"$logotime":…}}}.
         Startnachrichten {"reported":null} und {"$style":1} tragen keine Werte; oft kommen nur geänderte Namen (Delta). */
      if (o && o.state && 'reported' in o.state) { const rep = o.state.reported || {};
        for (const [n, v] of Object.entries(rep)) { if (n.startsWith('$') || !v || !Array.isArray(v.value)) continue;
          v.value.forEach((x, i) => { out[v.value.length > 1 ? n + '[' + i + ']' : n] = x; }); }
        return out; }
      (function lauf(x, p) { if (Array.isArray(x)) x.forEach((v, i) => lauf(v, p + '[' + i + ']'));
        else if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) lauf(v, p ? p + '.' + k : k);
        else out[p] = x; })(o, ''); return out; } catch (_) { return {}; } }
    if (/[=:]/.test(t) && !/^\d{1,2}:\d{2}/.test(t)) { const out = {}; t.split(/[;,&\n]/).forEach(z => { const m = z.match(/^\s*([^=:]+?)\s*[=:]\s*(.*)$/); if (m) out[m[1]] = m[2]; }); return out; }
    if (kopf && kopf.length) { const tr = [';', '\t', ','].find(x => t.includes(x)) || ';', w = t.split(tr), out = {}; kopf.forEach((k, i) => out[k] = w[i]); return out; }
    return {};
  }
  /* Schlüssel → Felder (gleiche Erkennung wie beim Datei-Import) */
  function vorschlag(schluessel) { const m = S().zuordnen(schluessel, -1), out = {}; for (const [i, v] of Object.entries(m)) out[schluessel[i]] = v; return out; }
  function werte(flachObj, map) { const w = {}; for (const [k, m] of Object.entries(map || {})) { if (!(k in flachObj)) continue;
      let v = m.feld === 'reverse' ? (/^(1|true|ja|yes|on)$/i.test(String(flachObj[k])) ? 1 : 0) : S().zahl(flachObj[k]);
      if (typeof flachObj[k] === 'number') v = flachObj[k]; if (!isFinite(v)) continue; if (m.f2c) v = (v - 32) * 5 / 9; else v *= m.faktor || 1; w[m.feld] = Math.round(v * 10) / 10; }
    return w; }

  /* ── Quellen: jede liefert onText(text) und gibt stop() zurück ── */
  function http(cfg, onText, onFehler) {
    let aus = false, t = null;
    const hol = async () => { if (aus) return;
      try { const r = await fetch(cfg.adresse, Object.assign({ cache: 'no-store' }, raum(cfg.adresse))); if (!r.ok) throw new Error('HTTP ' + r.status);
        const x = await r.text(); const z = x.trim().split(/\r?\n/); onText(z.length > 1 && !/^[{[]/.test(x.trim()) ? z[z.length - 1] : x, z.length > 1 ? z[0].split(/[;\t,]/) : null); }
      catch (e) { onFehler && onFehler(e.message || String(e)); }
      t = setTimeout(hol, cfg.intervallMs || 1000); };
    hol(); return () => { aus = true; clearTimeout(t); };
  }
  /* Minimaler MQTT-3.1.1-Client über WebSocket: CONNECT, SUBSCRIBE (QoS 0), PUBLISH empfangen, PINGREQ – nur lesen */
  function mqtt(cfg, onText, onFehler) {
    /* 23.11. (Prüfung Hersteller-Sicht): aus der https-Web-Fassung sperrt der Browser unverschlüsseltes ws:// – klar sagen statt still scheitern */
    if (typeof location !== 'undefined' && location.protocol === 'https:' && /^ws:\/\//i.test(cfg.adresse || '') && !/^ws:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(cfg.adresse || '')) { const E2 = typeof Sprache !== 'undefined' && Sprache.cur === 'en';
      onFehler && onFehler(E2 ? 'From the web version the browser only allows encrypted wss:// (broker with certificate).' : 'Aus der Web-Fassung erlaubt der Browser nur verschlüsseltes wss:// (Broker mit Zertifikat).'); return () => {}; }
    const enc = new TextEncoder(), dec = new TextDecoder();
    const laenge = n => { const b = []; do { let x = n % 128; n = Math.floor(n / 128); if (n > 0) x |= 128; b.push(x); } while (n > 0); return b; };
    const str = s => { const u = enc.encode(s); return [u.length >> 8, u.length & 255, ...u]; };
    const paket = (typ, rest) => new Uint8Array([typ, ...laenge(rest.length), ...rest]);
    let ws; try { ws = new WebSocket(cfg.adresse, 'mqtt'); } catch (e) { onFehler && onFehler(e.message); return () => {}; }
    ws.binaryType = 'arraybuffer'; let ping = null, puffer = new Uint8Array(0);
    ws.onopen = () => { const id = 'carlon-' + Math.random().toString(36).slice(2, 10);
      const flags = (cfg.benutzer ? 0x80 : 0) | (cfg.passwort ? 0x40 : 0) | 0x02;
      ws.send(paket(0x10, [...str('MQTT'), 4, flags, 0, 60, ...str(id), ...(cfg.benutzer ? str(cfg.benutzer) : []), ...(cfg.passwort ? str(cfg.passwort) : [])]));
      ws.send(paket(0x82, [0, 1, ...str(cfg.thema || '#'), 0])); ping = setInterval(() => { try { ws.send(new Uint8Array([0xC0, 0])); } catch (_) {} }, 30000); };
    ws.onmessage = ev => { const neu = new Uint8Array(ev.data), b = new Uint8Array(puffer.length + neu.length); b.set(puffer); b.set(neu, puffer.length); puffer = b;
      while (puffer.length >= 2) { let mult = 1, len = 0, i = 1, c; do { c = puffer[i++]; len += (c & 127) * mult; mult *= 128; } while (c & 128 && i < puffer.length);
        if (puffer.length < i + len) break; const typ = puffer[0] >> 4, body = puffer.subarray(i, i + len);
        if (typ === 2 && body[1] !== 0) onFehler && onFehler('Broker lehnt ab (Code ' + body[1] + ')');
        if (typ === 3) { const tl = (body[0] << 8) | body[1], qos = (puffer[0] >> 1) & 3, ab = 2 + tl + (qos ? 2 : 0); onText(dec.decode(body.subarray(ab)), null, dec.decode(body.subarray(2, 2 + tl))); }
        puffer = puffer.slice(i + len); } };
    ws.onerror = () => onFehler && onFehler('Keine Verbindung zum Broker'); ws.onclose = () => clearInterval(ping);
    return () => { clearInterval(ping); try { ws.send(new Uint8Array([0xE0, 0])); ws.close(); } catch (_) {} };
  }
  function ble(cfg, onText, onFehler) {
    let geraet = null, aus = false; const dienst = (cfg.dienst || BLE.dienst).toLowerCase(), kenn = (cfg.kennlinie || BLE.wert).toLowerCase(), dec = new TextDecoder();
    const warte = ms => new Promise(r => setTimeout(r, ms));
    /* 22.11.2026 (Prüfstand): Verbinden scheitert gelegentlich beim ersten Versuch (Stick frisch gestartet, macOS hält alte Verbindung).
       Darum bis zu 5 Versuche mit Zeitlimit, und nach jeder Trennung (Reichweite, Stromausfall am Gateway) von selbst neu verbinden. */
    const verbinde = async () => { for (let v = 1; v <= 5 && !aus; v++) { try {
        const srv = await Promise.race([geraet.gatt.connect(), warte(10000).then(() => { throw new Error('Zeitüberschreitung beim Verbinden'); })]);
        const d = await srv.getPrimaryService(dienst), k = await d.getCharacteristic(kenn);
        k.addEventListener('characteristicvaluechanged', e => { if (!aus) onText(dec.decode(e.target.value)); }); await k.startNotifications(); return;
      } catch (e) { onFehler && onFehler((e.message || String(e)) + ' · Versuch ' + v); try { geraet.gatt.disconnect(); } catch (_) {} await warte(1000 * v); } } };
    (async () => { try {
      geraet = await navigator.bluetooth.requestDevice({ filters: [{ services: [dienst] }], optionalServices: [dienst] });
      geraet.addEventListener('gattserverdisconnected', () => { if (!aus) { onFehler && onFehler('Gateway getrennt, verbinde neu'); verbinde(); } });
      await verbinde();
    } catch (e) { onFehler && onFehler(e.message || String(e)); } })();
    return () => { aus = true; try { geraet && geraet.gatt.connected && geraet.gatt.disconnect(); } catch (_) {} };
  }
  /* Siemens S7-1200 (ab V4.5) / S7-1500 Web API, Webserver-Funktionshandbuch: POST /api/jsonrpc, Api.Login → result.token,
     danach X-Auth-Token; PlcProgram.Read {var, mode:"simple"} als Batch. Der Webserver sendet laut Handbuch
     Access-Control-Allow-Origin: * und erlaubt X-Auth-Token – Visite liest darum direkt, ohne Gateway. Nur lesende Methoden. */
  function s7(cfg, onText, onFehler) {
    let aus = false, t = null, token = null; const url = cfg.adresse.replace(/\/+$/, '') + '/api/jsonrpc';
    const vars = String(cfg.variablen || '').split(/\n|;/).map(x => x.trim()).filter(Boolean);
    const rpc = async (body) => { const r = await fetch(url, { method: 'POST', cache: 'no-store', ...raum(url), headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { 'X-Auth-Token': token } : {}), body: JSON.stringify(body) });
      if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); };
    const hol = async () => { if (aus) return;
      try {
        if (!token) { const a = await rpc([{ jsonrpc: '2.0', method: 'Api.Login', params: { user: cfg.benutzer || 'Anonymous', password: cfg.passwort || '' }, id: 1 }]);
          const e = Array.isArray(a) ? a[0] : a; if (!e || !e.result || !e.result.token) throw new Error('Anmeldung abgelehnt' + (e && e.error ? ' (' + (e.error.message || e.error.code) + ')' : '')); token = e.result.token; }
        if (!vars.length) throw new Error('Keine Variablen eingetragen');
        const a = await rpc(vars.map((v, i) => ({ jsonrpc: '2.0', method: 'PlcProgram.Read', params: { var: v, mode: 'simple' }, id: i + 10 })));
        const out = {}; let abgelaufen = false;
        (Array.isArray(a) ? a : [a]).forEach(e => { const v = vars[e.id - 10]; if (e.error) { if (e.error.code === 2 || /token|auth/i.test(e.error.message || '')) abgelaufen = true; else onFehler && onFehler(v + ': ' + (e.error.message || e.error.code)); } else if (v != null) out[v] = e.result; });
        if (abgelaufen) token = null; if (Object.keys(out).length) onText(JSON.stringify(out));
      } catch (e) { token = null; onFehler && onFehler(e.message || String(e)); }
      t = setTimeout(hol, cfg.intervallMs || 1000); };
    hol(); return () => { aus = true; clearTimeout(t); };
  }
  const QUELLEN = { http, mqtt, ble, s7 };

  /* Stufen-Automat für die laufende Aufnahme: neue Werte → Einstellung setzen; stehen sie haltSec, Stufe anlegen; Tempo 0 → Belastung Ende */
  function automat(o) {
    const { setze, stufe, ende, abweichung, zurueck, haltSec = 30, schwelle = f => (S().FELDER[f] || {}).schwelle || 0.5 } = o; let zuletzt = null, kand = null, kandAb = 0, beendet = false, weg = false;
    const gleich = (a, b) => a && b && Object.keys(Object.assign({}, a, b)).every(f => a[f] == null || b[f] == null || Math.abs(a[f] - b[f]) < schwelle(f));
    return function (w, jetztMs) { if (!Object.keys(w).length) return; setze(w);
      if (gleich(w, zuletzt)) { kand = null; if (weg) { weg = false; zurueck && zurueck(); } return; }
      if (zuletzt && !weg) { weg = true; abweichung && abweichung(); }   /* erste Abweichung vom Stufenwert = Ende der Stufe (Übergang zählt nicht mit) */
      if (!kand || !gleich(w, kand)) { kand = Object.assign({}, w); kandAb = jetztMs; return; }
      if (jetztMs - kandAb >= haltSec * 1000) { if (w.speedKmh != null && w.speedKmh < 0.3) { if (zuletzt && !beendet) { ende(); beendet = true; } }
        else { stufe(); beendet = false; } zuletzt = kand; kand = null; weg = false; } };
  }

  g.SteuerLive = { BLE, flach, vorschlag, werte, QUELLEN, automat,
    verbinden(profil, onWerte, onFehler, onRoh) { let kopf = null;
      /* Gespeichertes Netz-Profil im Browser: klar melden statt still scheitern (CSP/Mixed Content, 24.11.2026). */
      if (NETZ_GESPERRT && profil.art !== 'ble') { onFehler && onFehler(g.document && g.document.documentElement.lang === 'en'
          ? 'In the browser only the Bluetooth gateway works.' : 'Im Browser funktioniert nur das Bluetooth-Gateway.'); return () => {}; }
      return QUELLEN[profil.art](profil, (text, k) => { if (k) kopf = k; const f = flach(text, kopf); onRoh && onRoh(f); onWerte(werte(f, profil.map), f); }, onFehler); } };
})(typeof window !== 'undefined' ? window : globalThis);

/* ── Einrichten und Einbindung in die Reha-Aufnahme ── */
(function () {
  if (typeof window === 'undefined') return;
  const L = window.SteuerLive, en = () => typeof Sprache !== 'undefined' && Sprache.cur === 'en', esc2 = x => String(x).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const NAMEN = { speedKmh: ['Tempo (km/h)', 'Speed (km/h)'], inclinePercent: ['Steigung (%)', 'Incline (%)'], waterHeightCm: ['Wasserhöhe (cm)', 'Water height (cm)'], waterTempC: ['Wassertemperatur (°C)', 'Water temp. (°C)'], vibrationHz: ['Frequenz (Hz)', 'Frequency (Hz)'], reverse: ['Rückwärts', 'Reverse'], radiusM: ['Radius (m)', 'Radius (m)'] };
  const ui = {
    stop: null, roh: {}, cfg: null, art: null,
    profil(art) { return ((State.settings.steuerLive || {})[art]) || null; },
    einrichten(art) { this.art = art; const alt = this.profil(art) || {}; this.cfg = Object.assign({ art: 'http', adresse: '', thema: '', map: {}, haltSec: 30, auto: true }, alt); this.roh = {}; this.dialog(); },
    dialog() { const E = en(), c = this.cfg, n = f => NAMEN[f][E ? 1 : 0];
      const wege = [['http', E ? 'Network address' : 'Netzwerk-Adresse', E ? 'Controller or gateway in your Wi-Fi, e.g. http://192.168.0.10/werte.json' : 'Steuerung oder Gateway im WLAN, z. B. http://192.168.0.10/werte.json'],
        ['mqtt', 'MQTT', E ? 'Broker in your business, e.g. wss://broker.local:8884 and the topic' : 'Broker im Betrieb, z. B. wss://broker.local:8884 und das Thema'],
        ['s7', 'Siemens S7-1200 / S7-1500', E ? 'Directly via the controller’s web server (firmware V4.5 or later), user and variable names' : 'Direkt über den Webserver der Steuerung (ab Firmware V4.5), Benutzer und Variablennamen'],
        ['ble', 'Bluetooth', E ? 'Gateway with the CARLON profile, no address needed' : 'Gateway mit CARLON-Profil, keine Adresse nötig']]
        /* 24.11.2026 (Jan): Seit der CSP vom 24.11. (connect-src nur feste Hosts) und wegen Mixed Content (http im WLAN aus
           einer https-Seite) erreichen WLAN-Abruf, MQTT und S7 im Browser keine Geräte. Im Web bleibt nur Bluetooth. */
        .filter(([k]) => !NETZ_GESPERRT || k === 'ble');
      if (NETZ_GESPERRT && c.art !== 'ble') c.art = 'ble';
      const keys = Object.keys(this.roh);
      UI.modal(`<div class="modal-head"><button class="closex" onclick="SteuerLiveUI.schliessen()">${IC.x}</button><h3>${E ? 'Live values from the controller' : 'Live-Werte aus der Steuerung'}</h3></div><div class="modal-body">
        <p style="margin:0 0 12px;color:var(--text-secondary)">${E ? 'Visite only reads. It sends nothing to the controller.' : 'Visite liest nur. Es sendet nichts an die Steuerung.'}</p>
        ${NETZ_GESPERRT ? `<p style="margin:0 0 12px;color:var(--text-secondary)">${E ? 'In the browser only the Bluetooth gateway works. Network address, MQTT and S7 cannot be reached from a secure web page.' : 'Im Browser funktioniert nur das Bluetooth-Gateway. Netzwerk-Adresse, MQTT und S7 sind aus einer sicheren Webseite nicht erreichbar.'}</p>` : ''}
        <div style="display:grid;gap:8px">${wege.map(([k, t, h]) => `<label style="display:flex;gap:10px;align-items:flex-start;border:1px solid ${c.art === k ? 'var(--cyan)' : 'var(--border-subtle)'};border-radius:12px;padding:10px 12px;cursor:pointer"><input type="radio" name="slArt" value="${k}" ${c.art === k ? 'checked' : ''} style="margin-top:4px"><span><b>${t}</b><br><span style="font-size:13px;color:var(--text-secondary)">${h}</span></span></label>`).join('')}</div>
        ${c.art !== 'ble' ? `<label style="display:block;margin-top:12px">${E ? 'Address' : 'Adresse'}<input data-sl="adresse" value="${esc2(c.adresse || '')}" placeholder="${c.art === 'mqtt' ? 'wss://broker.local:8884' : c.art === 's7' ? 'https://192.168.0.1' : 'http://192.168.0.10/werte.json'}" style="width:100%;padding:9px 10px;margin-top:4px"></label>` : ''}
        ${c.art === 's7' ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px"><label>${E ? 'User (read only)' : 'Benutzer (nur lesen)'}<input data-sl="benutzer" value="${esc2(c.benutzer || '')}" placeholder="Anonymous" style="width:100%;padding:9px 10px;margin-top:4px"></label><label>${E ? 'Password' : 'Passwort'}<input data-sl="passwort" type="password" value="${esc2(c.passwort || '')}" autocomplete="off" style="width:100%;padding:9px 10px;margin-top:4px"></label></div>
        <label style="display:block;margin-top:8px">${E ? 'Variables, one per line' : 'Variablen, eine je Zeile'}<textarea data-sl="variablen" rows="3" placeholder='"Laufband".Tempo&#10;"Laufband".Steigung' style="width:100%;padding:9px 10px;margin-top:4px;font-family:ui-monospace,Menlo,monospace">${esc2(c.variablen || '')}</textarea></label>` : ''}
        ${c.art === 'mqtt' ? `<label style="display:block;margin-top:8px">${E ? 'Topic' : 'Thema'}<input data-sl="thema" value="${esc2(c.thema || '')}" placeholder="laufband/werte" style="width:100%;padding:9px 10px;margin-top:4px"></label>` : ''}
        <div style="margin-top:12px"><button class="btn primary" onclick="SteuerLiveUI.testen()">${this.stop ? (E ? 'Connected · reconnect' : 'Verbunden · neu verbinden') : (E ? 'Connect and test' : 'Verbinden und testen')}</button> <span id="slStatus" style="margin-left:8px;color:var(--text-secondary);font-size:13px"></span></div>
        <table class="tbl" id="slTab" style="width:100%;font-size:13px;margin-top:12px">${keys.length ? `<tr><th>${E ? 'Value from controller' : 'Wert der Steuerung'}</th><th>${E ? 'Live' : 'Live'}</th><th>${E ? 'Meaning' : 'Bedeutung'}</th><th title="${E ? 'e.g. 0.1 if the controller sends 48 for 4.8' : 'z. B. 0,1, wenn die Steuerung 48 für 4,8 sendet'}">${E ? 'Factor' : 'Faktor'}</th><th>${E ? 'In Visite' : 'In Visite'}</th></tr>` + keys.map(k => `<tr><td><b>${esc2(k)}</b></td><td data-live="${esc2(k)}">${esc2(this.roh[k])}</td><td><select data-key="${esc2(k)}"><option value="">${E ? '– ignore –' : '– nicht übernehmen –'}</option>${Object.keys(NAMEN).map(f => `<option value="${f}"${(c.map[k] || {}).feld === f ? ' selected' : ''}>${n(f)}</option>`).join('')}</select></td><td>${c.map[k] ? `<input data-faktor="${esc2(k)}" value="${String(c.map[k].faktor ?? 1).replace('.', E ? '.' : ',')}" inputmode="decimal" style="width:70px;padding:5px 6px">` : ''}</td><td data-umg="${esc2(k)}">${c.map[k] ? esc2(this.umgerechnet(k)) : ''}</td></tr>`).join('') : `<tr><td style="color:var(--text-secondary)">${E ? 'After connecting, the incoming values appear here.' : 'Nach dem Verbinden erscheinen hier die ankommenden Werte.'}</td></tr>`}</table>
        <label style="display:flex;gap:8px;align-items:center;margin-top:12px"><input type="checkbox" data-sl="auto" ${c.auto ? 'checked' : ''}> ${E ? `Create a stage automatically when values stay ${c.haltSec} s` : `Stufe selbst anlegen, wenn Werte ${c.haltSec} s stehen`}</label></div>
        <div class="modal-foot"><button class="btn ghost" onclick="SteuerLiveUI.schliessen()">${E ? 'Cancel' : 'Abbrechen'}</button>${this.profil(this.art) ? `<button class="btn ghost" onclick="SteuerLiveUI.loeschen()">${E ? 'Remove' : 'Entfernen'}</button>` : ''}<button class="btn primary" ${Object.keys(c.map).length ? '' : 'disabled'} onclick="SteuerLiveUI.speichern()">${E ? 'Save for this equipment' : 'Für dieses Gerät speichern'}</button></div>`, { wide: true });
      const m = document.getElementById('modalBg'); if (!m) return;
      m.addEventListener('change', e => { const t = e.target;
        if (t.name === 'slArt') { this.cfg.art = t.value; this.trennen(); this.roh = {}; this.dialog(); }
        else if (t.dataset.key != null) { if (t.value) this.cfg.map[t.dataset.key] = Object.assign(L.vorschlag([t.dataset.key])[t.dataset.key] || { faktor: 1 }, { feld: t.value }); else delete this.cfg.map[t.dataset.key]; this.dialog(); }
        else if (t.dataset.sl === 'auto') this.cfg.auto = t.checked;
        else if (t.dataset.faktor != null) { const v = parseFloat(String(t.value).replace(',', '.')); if (isFinite(v) && v !== 0 && this.cfg.map[t.dataset.faktor]) { this.cfg.map[t.dataset.faktor].faktor = v; this.dialog(); } } });
      m.addEventListener('input', e => { const t = e.target; if (['adresse', 'thema', 'benutzer', 'passwort', 'variablen'].includes(t.dataset.sl)) this.cfg[t.dataset.sl] = t.dataset.sl === 'variablen' ? t.value : t.value.trim(); }); },
    umgerechnet(k) { const m = this.cfg.map[k], roh = this.roh[k]; if (!m || roh == null) return ''; const w = L.werte({ [k]: roh }, { [k]: m })[m.feld]; if (w == null) return '';
      const E = en(), ein = { speedKmh: 'km/h', inclinePercent: '%', waterHeightCm: 'cm', waterTempC: '°C', vibrationHz: 'Hz', radiusM: 'm', reverse: '' }[m.feld] || ''; return String(w).replace('.', E ? '.' : ',') + ' ' + ein; },
    status(t, ok) { const s = document.getElementById('slStatus'); if (s) { s.textContent = t; s.style.color = ok ? 'var(--cyan)' : 'var(--amber,#F2C46B)'; } },
    testen() { const E = en(); this.trennen(); let n = 0, neu = false;
      this.stop = L.verbinden(this.cfg, () => {}, f => this.status((E ? 'No data: ' : 'Keine Daten: ') + f, false), f => { n++;
        for (const [k, v] of Object.entries(f)) { if (!(k in this.roh)) neu = true; this.roh[k] = v; }
        if (neu) { neu = false; const v = L.vorschlag(Object.keys(this.roh)); for (const [k, m] of Object.entries(v)) if (!this.cfg.map[k]) this.cfg.map[k] = m; this.dialog(); }
        for (const [k, v] of Object.entries(f)) { const z = document.querySelector(`[data-live="${CSS.escape(k)}"]`); if (z) z.textContent = v; const u = document.querySelector(`[data-umg="${CSS.escape(k)}"]`); if (u) u.textContent = this.umgerechnet(k); }
        this.status((E ? 'Receiving · ' : 'Empfang · ') + n + (E ? ' messages' : ' Nachrichten'), true); }); },
    trennen() { if (this.stop) { try { this.stop(); } catch (_) {} this.stop = null; } },
    schliessen() { this.trennen(); UI.closeModal(); if (typeof RehaLive !== 'undefined' && RehaLive.aktiv) RehaLive.zeichnen(); },
    speichern() { const c = Object.assign({}, this.cfg); State.settings.steuerLive = Object.assign({}, State.settings.steuerLive, { [this.art]: c }); State.saveSettings(); this.schliessen();
      Toast.show(en() ? 'Live values saved for this equipment' : 'Live-Werte für dieses Gerät gespeichert', 'ok'); },
    loeschen() { const s = Object.assign({}, State.settings.steuerLive); delete s[this.art]; State.settings.steuerLive = s; State.saveSettings(); this.schliessen(); },
    /* in der Aufnahme: mit gespeichertem Profil verbinden und Einstellungen/Stufen selbst setzen */
    aufnahme(R) { const p = this.profil(R.art); if (!p || R._live) return; let letzte = 0;
      const auto = L.automat({ haltSec: p.haltSec || 30, setze: w => { const G = RehaKern.GERAETE[R.art]; let geaendert = false;
          for (const [f, v] of Object.entries(w)) if ((G.felder || []).includes(f) && R.akt[f] !== v) { R.akt[f] = v; geaendert = true; }
          R._liveZeit = Date.now(); if (geaendert && Date.now() - letzte > 500) { letzte = Date.now(); R.zeichnen(); } },
        stufe: () => { if (p.auto !== false && R.start) R.stufe(); }, ende: () => { if (p.auto !== false && R.start) R.ende(); },
        abweichung: () => { const z = R.log[R.log.length - 1]; if (p.auto !== false && R.start && z && z.device !== 'keines' && z.endSec == null) { z.endSec = R.t(); try { R.entwurf(); } catch (_) {} } },
        zurueck: () => { const z = R.log[R.log.length - 1]; if (z && z.endSec != null) { delete z.endSec; try { R.entwurf(); } catch (_) {} } } });
      /* Viele Steuerungen melden nur Änderungen (LOGO! MQTT: Delta + Herzschlag). Darum letzte Werte merken und jede Sekunde
         prüfen, ob sie lange genug stehen – nicht nur beim Eintreffen einer Nachricht. */
      let stand = null; const takt = setInterval(() => { if (stand) auto(Object.assign({}, stand), Date.now()); }, 1000);
      const stop = L.verbinden(p, w => { if (Object.keys(w).length) { stand = Object.assign({}, stand, w); auto(Object.assign({}, stand), Date.now()); } }, f => { R._liveFehler = f; });
      R._live = () => { clearInterval(takt); stop(); }; },
    aufnahmeEnde(R) { if (R._live) { try { R._live(); } catch (_) {} R._live = null; } }
  };
  window.SteuerLiveUI = ui;
})();
