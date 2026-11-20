/* ═══ STATIONSMONITOR · Nacht-Aufnahme im Gurt (20.11.2026) ═══════════════════════════════════════════════════════
   Jan: „alle Pferde intern im H10-Speicher aufnehmen und zusätzlich auf der Stallwand den Puls sehen, den die H10 rausschreien“.
   Ablauf je Pferd: einmal verbinden → Gurtspeicher-Aufnahme starten (h10-speicher.js, Ablauf wie Research h10StartVersuch) →
   Verbindung trennen. Die Wand liest danach den Puls OHNE Verbindung aus dem Advertising (Polar Manufacturer Data 0x006B,
   letztes Byte = HF; am echten H10 18CE9C3D gemessen: 48/48 Pakete, ~2,7 s, 0–1 bpm zur GATT-HF). Morgens: verbinden, stoppen,
   auslesen, als Aufnahme in die Akte, bitgleich aus der Datenbank gegenlesen, erst dann den Gurt leeren.
   Mitlesen braucht Chrome mit „enable-experimental-web-platform-features“ (Stallwand-PC). Ohne das Flag bleibt der Gurt
   verbunden und die Wand zeigt die Verbindungs-HF (Grenze laut Recherche etwa 5–8 Gurte je Rechner).
   Kein Alarm- oder Diagnosesystem: beschreibend, keine Schwellen.                                                        */
(function (global) {
  'use strict';
  const POLAR = 0x006B, VERLAUF_MAX = 30000;
  const Stall = {
    plaetze: {},                                   // hid → { dev, kennung, startMs, gurt, hf, hfT, verlauf:[[t,hf]], zustand, text }
    mitlesen() { return !!(global.BluetoothDevice && 'watchAdvertisements' in BluetoothDevice.prototype); },
    en() { return typeof Sprache !== 'undefined' && Sprache.cur === 'en'; },
    _laden() { const l = (State.settings && State.settings.stall) || []; for (const e of l) if (!this.plaetze[e.hid]) this.plaetze[e.hid] = Object.assign({ verlauf: [], zustand: 'laeuft' }, e); },
    async _merken() { State.settings.stall = Object.values(this.plaetze).filter(p => p.zustand === 'laeuft' || p.zustand === 'fehler').map(p => ({ hid: p.hid, kennung: p.kennung, startMs: p.startMs, gurt: p.gurt })); await State.saveSettings(); },
    _hf(e) { const m = e.manufacturerData && e.manufacturerData.get(POLAR); if (!m || !m.byteLength) return null; const v = m.getUint8(m.byteLength - 1); return v >= 15 && v <= 250 ? v : null; },
    _beobachten(p) {
      const dev = p.dev; if (!dev || dev._stall) return; dev._stall = true;
      dev.addEventListener('advertisementreceived', e => { const hf = this._hf(e); if (hf == null) return; this._wert(p, hf, e.rssi); });
      if (this.mitlesen()) dev.watchAdvertisements().catch(err => { p.text = (this.en() ? 'Listening failed: ' : 'Mitlesen nicht möglich: ') + err.message; this._kachel(p); });
    },
    _wert(p, hf, rssi) { const t = Date.now(); p.hf = hf; p.hfT = t; p.rssi = rssi; p.verlauf.push([t, hf]); if (p.verlauf.length > VERLAUF_MAX) p.verlauf.splice(0, p.verlauf.length - VERLAUF_MAX); this._kachel(p); },
    /* Abends: Gurt diesem Pferd zuordnen und Aufnahme im Gurt starten (Nutzergeste nötig: Web Bluetooth) */
    async starten(hid) {
      const h = State.horses.find(x => x.id === hid); if (!h) return; const en = this.en();
      if (!(navigator.bluetooth && await navigator.bluetooth.getAvailability().catch(() => false))) { Toast.show(en ? 'This device has no Bluetooth in the browser. Use Chrome or Edge on a PC or Android.' : 'Dieses Gerät hat im Browser kein Bluetooth. Chrome oder Edge am PC oder auf Android verwenden.', 'warn'); return; }
      const p = this.plaetze[hid] = Object.assign(this.plaetze[hid] || { verlauf: [] }, { hid, zustand: 'verbindet', text: '' }); this._neu();
      try {
        const dev = await navigator.bluetooth.requestDevice({ filters: h.gurt ? [{ name: h.gurt }] : [{ services: ['heart_rate'] }], optionalServices: ['heart_rate', 'battery_service', H10Speicher.UUID.dienst], optionalManufacturerData: [POLAR] });
        p.dev = dev; p.gurt = dev.name;
        if (h.gurt !== dev.name) { h.gurt = dev.name; try { await DB.put('horses', h); } catch (_) { } }
        const g = await dev.gatt.connect(); const c = await new H10Speicher.Client(g).init();
        p.text = en ? 'Saving older recordings in the strap …' : 'Ältere Aufnahmen im Gurt werden gesichert …'; this._kachel(p);
        try { await c.sitzungAuf(); } catch (_) { }
        try { const st = await c.status(); if (st.laeuft) await c.stopp(); } catch (_) { }
        for (const a of await c.aufnahmen()) { const e = await c.ernte(a); if (typeof RehaLive !== 'undefined' && await RehaLive.fundSichern(e)) await c.loeschen(a.ordner); }
        p.startMs = Date.now(); p.kennung = H10Speicher.kennung(p.startMs, hid);
        await c.start(p.kennung);
        const st2 = await c.status(); if (!st2.laeuft) throw new Error(en ? 'strap did not start recording' : 'Gurt hat die Aufnahme nicht gestartet');
        p.zustand = 'laeuft'; p.text = ''; await this._merken();
        if (this.mitlesen()) { try { c.trennen(); } catch (_) { } try { dev.gatt.disconnect(); } catch (_) { } this._beobachten(p); }
        else { const hr = await (await g.getPrimaryService('heart_rate')).getCharacteristic('heart_rate_measurement');
          hr.addEventListener('characteristicvaluechanged', ev => { const v = ev.target.value, f = v.getUint8(0); this._wert(p, (f & 1) ? v.getUint16(1, true) : v.getUint8(1), null); }); await hr.startNotifications(); p.verbunden = true; }
        Toast.show((en ? 'Recording in the strap: ' : 'Aufnahme im Gurt läuft: ') + h.name, 'ok');
      } catch (e) { p.zustand = p.kennung ? 'laeuft' : 'fehler'; p.text = (en ? 'Not started: ' : 'Nicht gestartet: ') + ((e && e.message) || e); if (!p.kennung) delete this.plaetze[hid]; Toast.show(p.text, 'warn'); }
      this._neu();
    },
    /* Morgens: auslesen → Akte → bitgleich gegenlesen → erst dann im Gurt löschen */
    async auslesen(hid) {
      const p = this.plaetze[hid], h = State.horses.find(x => x.id === hid); if (!p || !h) return; const en = this.en();
      p.zustand = 'liest'; p.text = en ? 'Connecting …' : 'Verbinde …'; this._kachel(p);
      try {
        let dev = p.dev;
        if (!dev || !dev.gatt) dev = p.dev = await navigator.bluetooth.requestDevice({ filters: [{ name: p.gurt || h.gurt }], optionalServices: ['heart_rate', 'battery_service', H10Speicher.UUID.dienst], optionalManufacturerData: [POLAR] });
        const g = await dev.gatt.connect(); const c = await new H10Speicher.Client(g).init();
        await c.stopp(); try { await c.sitzungAuf(); } catch (_) { }
        const z = (await c.aufnahmen()).find(a => a.ordner === '/' + p.kennung + '/'); if (!z) throw new Error(en ? 'recording not found in the strap' : 'Aufnahme im Gurt nicht gefunden');
        const mem = await c.ernte(z, n => { p.text = (en ? 'Reading strap memory … ' : 'Gurtspeicher wird gelesen … ') + (z.groesse ? Math.min(99, Math.round(n / z.groesse * 100)) : '') + ' %'; this._kachel(p); });
        if (!mem.rr || mem.rr.length < 30) throw new Error(en ? 'too few beats in the strap' : 'zu wenige Schläge im Gurt');
        const id = await this._inAkte(h, p, mem);
        const gespeichert = State.recordings.find(r => r.id === id) || (await DB.get('recordings', id));
        const gleich = gespeichert && Array.isArray(gespeichert.rr) && gespeichert.rr.length === mem.rr.length && gespeichert.rr.every((x, i) => Number(x) === mem.rr[i]);
        if (!gleich) throw new Error(en ? 'saved series differs, strap NOT cleared' : 'Gespeicherte Reihe weicht ab, Gurt NICHT geleert');
        await c.loeschen(z.ordner); try { await c.sitzungZu(); } catch (_) { } try { c.trennen(); dev.gatt.disconnect(); } catch (_) { }
        p.zustand = 'fertig'; p.text = (en ? 'In the record · ' : 'In der Akte · ') + fmt0(mem.rr.length) + (en ? ' beats · strap cleared' : ' Schläge · Gurt geleert'); p.recId = id; await this._merken();
        Toast.show(h.name + ': ' + p.text, 'ok');
      } catch (e) { p.zustand = 'laeuft'; p.text = (en ? 'Read-out failed: ' : 'Auslesen nicht möglich: ') + ((e && e.message) || e) + (en ? ' · recording stays in the strap' : ' · Aufnahme bleibt im Gurt'); Toast.show(p.text, 'warn'); }
      this._neu();
    },
    async _inAkte(h, p, mem) {
      const start = new Date(p.startMs).toISOString(); let t = 0;
      const raw = { schema: { name: 'carlon_equine_v1', version: '1.2', softwareBuild: 'CARLON Equine Visite · Stationsmonitor' },
        subject: { id: h.subjectId, nameAtTime: h.name, species: 'horse' },
        session: { id: p.kennung, startedAt: start, intent: 'rest', notes: 'Stationsmonitor · Nacht-Aufnahme im Gurtspeicher (' + (p.gurt || 'Polar H10') + ')' },
        rrData: mem.rr.map(v => { const o = { tSec: Math.round(t * 1000) / 1000, rrMs: v }; t += v / 1000; return o; }),
        provenance: { source: 'CARLON Equine Visite · Stationsmonitor', sensor: p.gurt || 'Polar H10', weg: 'Polar H10 Gurtspeicher (PSFTP)', kennung: p.kennung } };
      const datei = new File([JSON.stringify(raw)], 'CARLON_' + h.name.replace(/[^\p{L}\p{N}]+/gu, '_') + '_' + start.slice(0, 19).replace(/[:T]/g, '-') + '_Station.json', { type: 'application/json' });
      const { parsed } = await Importer.scan([datei]); if (!parsed || !parsed.length) throw new Error('Import');
      const vor = new Set(State.recordings.map(r => r.id)); const r = await Importer.ingest(parsed[0].n);
      await State.load(); const neu = State.recordings.find(x => !vor.has(x.id) && x.horseId === h.id) || State.recordings.filter(x => x.horseId === h.id).slice(-1)[0];
      if (neu) { neu.rrQuelle = 'gurtspeicher'; neu.speicher = { kennung: p.kennung, schlaege: mem.rr.length, verworfen: mem.verworfen, bytes: mem.bytes, geloescht: false }; await DB.put('recordings', neu); }
      return neu ? neu.id : (r && r.id);
    },
    /* Nach dem Neuladen: erlaubte Gurte wiederfinden (getDevices liegt ebenfalls hinter dem Flag) */
    async wiederfinden() { this._laden(); if (!(navigator.bluetooth && navigator.bluetooth.getDevices)) return;
      try { const ds = await navigator.bluetooth.getDevices(); for (const p of Object.values(this.plaetze)) { const d = ds.find(x => x.name === p.gurt); if (d && !p.dev) { p.dev = d; this._beobachten(p); } } } catch (_) { } },
    /* ── Darstellung auf der Stationswand ── */
    _dauer(ms) { const m = Math.floor(ms / 60000); return Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0') + ' h'; },
    _spark(v) { const w = 260, hh = 54, jetzt = Date.now(), a = jetzt - 3600e3, pts = v.filter(x => x[0] >= a); if (pts.length < 2) return `<svg class="st-spark" viewBox="0 0 ${w} ${hh}"></svg>`;
      const lo = Math.min(...pts.map(x => x[1])) - 3, hi = Math.max(...pts.map(x => x[1])) + 3, X = t => (t - a) / 3600e3 * w, Y = f => hh - 4 - (f - lo) / Math.max(1, hi - lo) * (hh - 8);
      return `<svg class="st-spark" viewBox="0 0 ${w} ${hh}" preserveAspectRatio="none" aria-hidden="true"><polyline fill="none" stroke="#3ECFB2" stroke-width="1.6" stroke-linejoin="round" points="${pts.map(x => X(x[0]).toFixed(1) + ',' + Y(x[1]).toFixed(1)).join(' ')}"/></svg>`; },
    kachelHTML(p) { const h = State.horses.find(x => x.id === p.hid) || { name: '?' }, en = this.en(), alt = p.hfT ? Math.round((Date.now() - p.hfT) / 1000) : null;
      const sig = p.zustand !== 'laeuft' ? '' : alt == null ? (en ? 'waiting for signal' : 'warte auf Signal') : alt < 20 ? (en ? `signal ${alt} s ago` : `Signal vor ${alt} s`) : (en ? `no signal for ${Math.round(alt / 60)} min · strap keeps recording` : `seit ${Math.round(alt / 60)} min kein Signal · Gurt zeichnet weiter auf`);
      return `<div class="st-kachel ${p.zustand}" data-stall="${p.hid}"><div class="st-k1"><b>${esc(h.name)}</b>${h.box != null ? `<span>Box ${esc(String(h.box))}</span>` : ''}</div>
        <div class="st-hf ${alt != null && alt >= 20 ? 'alt' : ''}">${p.hf != null && p.zustand === 'laeuft' ? p.hf : '–'}<small>bpm</small></div>${this._spark(p.verlauf || [])}
        <div class="st-meta">${p.zustand === 'laeuft' && p.startMs ? (en ? 'Recording in strap for ' : 'Im Gurt seit ') + new Date(p.startMs).toLocaleTimeString(en ? 'en-GB' : 'de-DE', { hour: '2-digit', minute: '2-digit' }) + ' · ' + this._dauer(Date.now() - p.startMs) : ''}${sig ? ' · ' + sig : ''}</div>
        ${p.zustand === 'laeuft' && p.startMs && this._ziel ? (() => { const s2 = Math.floor((Date.now() - p.startMs) / 1000), z = this._ziel * 60, f = Math.min(1, s2 / z), mm = x => Math.floor(x / 60) + ':' + String(x % 60).padStart(2, '0');
          return `<div class="st-ziel ${f >= 1 ? 'ok' : ''}"><i style="width:${(f * 100).toFixed(1)}%"></i><span>${mm(Math.min(s2, 99 * 60))} / ${mm(z)}${f >= 1 ? (en ? ' · ✓ ready to evaluate' : ' · ✓ auswertbar') : ''}</span></div>`; })() : ''}
        ${p.text ? `<div class="st-text">${esc(p.text)}</div>` : ''}
        <div class="st-knoepfe">${p.zustand === 'laeuft' ? `<button class="btn" onclick="Stall.auslesen('${p.hid}')">${en ? 'Read out and clear' : 'Auslesen und leeren'}</button>${p.dev ? '' : `<button class="btn ghost" onclick="Stall.verbindenLesen('${p.hid}')">${en ? 'Find strap' : 'Gurt suchen'}</button>`}` : p.zustand === 'fertig' ? `<button class="btn ghost" onclick="Views.openHorse('${p.hid}')">${en ? 'Open record' : 'Akte öffnen'}</button><button class="btn ghost" onclick="Stall.entfernen('${p.hid}')">${en ? 'Remove' : 'Entfernen'}</button>` : ''}</div></div>`; },
    async verbindenLesen(hid) { const p = this.plaetze[hid]; if (!p) return; try { p.dev = await navigator.bluetooth.requestDevice({ filters: [{ name: p.gurt }], optionalServices: ['heart_rate', 'battery_service', H10Speicher.UUID.dienst], optionalManufacturerData: [POLAR] }); this._beobachten(p); this._neu(); } catch (_) { } },
    /* Nacheinander, ohne neuen Dialog: die Gurte sind aus dem Start bekannt (je ein Tipp nur, wenn die Seite neu geladen wurde) */
    async alleAuslesen(hids) { for (const hid of hids) { const p = this.plaetze[hid]; if (p && p.zustand === 'laeuft') await this.auslesen(hid); } },
    /* STALLRUNDE (Fahrpraxis, 20.11.2026): alle Pferde dieses Stalls, je ein Gurt, Ziel 30 min, am Ende alle auslesen */
    stallrunde(hid) { const h = State.horses.find(x => x.id === hid); if (!h) return; const en = this.en();
      const stall = String(h.stable || '').trim(), pferde = State.horses.filter(x => stall ? String(x.stable || '').trim() === stall : x.id === hid).map(x => x.id);
      this._runde = { pferde, titel: stall || h.name };
      UI.modal(`<div class="modal-head"><h3>${en ? 'Stable round' : 'Stallrunde'} · ${esc(stall || h.name)}</h3><button class="closex" onclick="UI.closeModal()">${IC.x}</button></div><div class="modal-body" id="stRunde">${this.html({ pferde, zielMin: 30 })}</div>`, { wide: true }); },
    async entfernen(hid) { delete this.plaetze[hid]; await this._merken(); this._neu(); },
    html(opt) { this._laden(); opt = opt || {}; const en = this.en(); this._ziel = opt.zielMin || this._ziel || null;
      const menge = opt.pferde ? new Set(opt.pferde) : null, ps = Object.values(this.plaetze).filter(p => !menge || menge.has(p.hid));
      const kandidaten = State.horses.filter(h => (menge ? menge.has(h.id) : h.onStation) && !this.plaetze[h.id]);
      const alle = ps.filter(p => p.zustand === 'laeuft').length;
      return `<section class="panel st-panel"><div class="st-kopf"><div><span class="eyebrow">${en ? 'Overnight · recording in the strap' : 'Über Nacht · Aufnahme im Gurt'}</span><h2>${en ? 'Station monitor' : 'Stationsmonitor'}</h2>
        <p>${en ? 'Each strap records internally; the wall shows the pulse the strap broadcasts, without a connection. In the morning, read out each strap: the record checks it bit by bit and only then clears the strap.' : 'Jeder Gurt zeichnet in sich selbst auf; die Wand zeigt den Puls, den der Gurt ohne Verbindung sendet. Morgens jeden Gurt auslesen: die Akte prüft bitgleich und leert den Gurt erst danach.'}</p>
        ${this.mitlesen() ? '' : `<p class="st-flag">${en ? 'Listening without a connection needs Chrome with “Experimental Web Platform features” (chrome://flags). Without it each strap stays connected (about 5–8 per computer).' : 'Mitlesen ohne Verbindung braucht Chrome mit „Experimental Web Platform features“ (chrome://flags) auf dem Stallwand-Rechner. Ohne die Einstellung bleibt jeder Gurt verbunden (etwa 5–8 je Rechner).'}</p>`}</div>
        <div class="st-start">${kandidaten.map(h => `<button class="btn primary" onclick="Stall.starten('${h.id}')">${en ? 'Start strap · ' : 'Gurt starten · '}${esc(h.name)}</button>`).join('')}${alle > 1 ? `<button class="btn" onclick="Stall.alleAuslesen(${JSON.stringify(ps.map(p => p.hid)).replace(/"/g, '&quot;')})">${en ? 'Read out all' : 'Alle auslesen'} (${alle})</button>` : ''}</div></div>
        <div class="st-grid" id="stGrid">${ps.map(p => this.kachelHTML(p)).join('') || `<div class="st-leer">${en ? 'No strap recording yet. Admit horses to the station, then start their strap.' : 'Noch keine Gurt-Aufnahme. Pferde auf die Station aufnehmen, dann ihren Gurt starten.'}</div>`}</div>
        <div class="station-note"><span><b>${en ? 'Not an alarm system.' : 'Kein Alarmsystem.'}</b> ${en ? 'Radio dropouts are possible; a missing notice does not mean that nothing happened. Does not replace rounds.' : 'Funkabbrüche sind möglich; ein fehlender Hinweis bedeutet nicht, dass kein Ereignis vorliegt. Ersetzt keine Kontrollgänge.'}</span></div></section>`; },
    _kachel(p) { const el = document.querySelector(`[data-stall="${p.hid}"]`); if (!el) return; const d = document.createElement('div'); d.innerHTML = this.kachelHTML(p); el.replaceWith(d.firstElementChild); },
    _neu() { const r = document.getElementById('stRunde'); if (r && this._runde) { r.innerHTML = this.html({ pferde: this._runde.pferde, zielMin: 30 }); return; }
      try { if (typeof Nav !== 'undefined' && (Nav.cur === 'station' || Nav.cur === 'detail')) Nav.refresh(); } catch (_) { } },
    _takt: null,
    an() { if (this._takt) return; this._takt = setInterval(() => { for (const p of Object.values(this.plaetze)) if (p.zustand === 'laeuft') this._kachel(p); }, 5000); this.wiederfinden(); }
  };
  global.Stall = Stall;
})(typeof window !== 'undefined' ? window : globalThis);
