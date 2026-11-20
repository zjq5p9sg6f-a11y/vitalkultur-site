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
        <div class="st-knoepfe">${p.zustand === 'laeuft' ? `<button class="btn" onclick="Stall.auslesen('${p.hid}')">${en ? 'Read out and clear' : 'Auslesen und leeren'}</button>${p.dev ? '' : `<button class="btn ghost" onclick="Stall.verbindenLesen('${p.hid}')">${en ? 'Find strap' : 'Gurt suchen'}</button>`}` : p.zustand === 'fertig' ? `${p.recId ? `<button class="btn" onclick="Stall.bericht('${p.recId}')">${en ? 'Report (PDF)' : 'Bericht (PDF)'}</button>` : ''}<button class="btn ghost" onclick="Views.openHorse('${p.hid}')">${en ? 'Open record' : 'Akte öffnen'}</button><button class="btn ghost" onclick="Stall.entfernen('${p.hid}')">${en ? 'Remove' : 'Entfernen'}</button>` : ''}</div></div>`; },
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
        <div class="st-start">${kandidaten.map(h => `<button class="btn primary" onclick="Stall.starten('${h.id}')">${en ? 'Start strap · ' : 'Gurt starten · '}${esc(h.name)}</button>`).join('')}${ps.filter(p => p.zustand === 'fertig' && p.recId).length > 1 ? `<button class="btn" onclick="Stall.bericht(${JSON.stringify(ps.filter(p => p.zustand === 'fertig' && p.recId).map(p => p.recId)).replace(/"/g, '&quot;')})">${en ? 'Round report (PDF)' : 'Sammelbericht (PDF)'}</button>` : ''}${alle > 1 ? `<button class="btn" onclick="Stall.alleAuslesen(${JSON.stringify(ps.map(p => p.hid)).replace(/"/g, '&quot;')})">${en ? 'Read out all' : 'Alle auslesen'} (${alle})</button>` : ''}</div></div>
        <div class="st-grid" id="stGrid">${ps.map(p => this.kachelHTML(p)).join('') || `<div class="st-leer">${en ? 'No strap recording yet. Admit horses to the station, then start their strap.' : 'Noch keine Gurt-Aufnahme. Pferde auf die Station aufnehmen, dann ihren Gurt starten.'}</div>`}</div>
        <div class="station-note"><span><b>${en ? 'Not an alarm system.' : 'Kein Alarmsystem.'}</b> ${en ? 'Radio dropouts are possible; a missing notice does not mean that nothing happened. Does not replace rounds.' : 'Funkabbrüche sind möglich; ein fehlender Hinweis bedeutet nicht, dass kein Ereignis vorliegt. Ersetzt keine Kontrollgänge.'}</span></div></section>`; },
    _kachel(p) { const el = document.querySelector(`[data-stall="${p.hid}"]`); if (!el) return; const d = document.createElement('div'); d.innerHTML = this.kachelHTML(p); el.replaceWith(d.firstElementChild); },
    _neu() { const r = document.getElementById('stRunde'); if (r && this._runde) { r.innerHTML = this.html({ pferde: this._runde.pferde, zielMin: 30 }); return; }
      try { if (typeof Nav !== 'undefined' && (Nav.cur === 'station' || Nav.cur === 'detail')) Nav.refresh(); } catch (_) { } },
    _takt: null,
    an() { if (this._takt) return; this._takt = setInterval(() => { for (const p of Object.values(this.plaetze)) if (p.zustand === 'laeuft') this._kachel(p); }, 5000); this.wiederfinden(); }
  };

  /* ═══ LANGZEITBERICHT (20.11.2026, Jan: „PDF-Berichte in höchster Qualität“) ═══
     Druckrahmen, Typografie und Einpassen wie der Reha-Sitzungsbericht (Reha._stil/_einpassen), A4 quer, hell oder dunkel.
     Beschreibend: Herzfrequenz über die Aufnahme, Blöcke, ruhigster 5-min-Abschnitt mit HRV; keine Bewertung, kein Alarm. */
  Stall._kennwerte = function (r) {
    const rr = (r.rr || []).map(Number), t0 = new Date(r.startedAt).getTime(); let acc = 0; const zeit = rr.map(v => (acc += v / 1000));
    const dauer = acc, hfAlle = rr.map(v => 60000 / v), q = (a, p) => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[Math.min(b.length - 1, Math.floor(p * (b.length - 1)))] : null; };
    let spr = 0; for (let i = 1; i < rr.length; i++) if (Math.abs(rr[i] - rr[i - 1]) / rr[i - 1] > 0.2) spr++;
    const fenster = (a, b) => { const idx = []; for (let i = 0; i < rr.length; i++) if (zeit[i] > a && zeit[i] <= b) idx.push(i); return idx; };
    /* ruhigster 5-min-Abschnitt: niedrigste mittlere HF bei höchstens 5 % Sprüngen, Schritt 60 s */
    let ruhe = null;
    for (let a = 0; a + 300 <= dauer; a += 60) { const idx = fenster(a, a + 300); if (idx.length < 120) continue; let j = 0; for (let k = 1; k < idx.length; k++) if (Math.abs(rr[idx[k]] - rr[idx[k - 1]]) / rr[idx[k - 1]] > 0.2) j++;
      if (j / idx.length > 0.05) continue; const m = idx.reduce((x, i) => x + hfAlle[i], 0) / idx.length; if (!ruhe || m < ruhe.hf) ruhe = { a, b: a + 300, hf: m, idx }; }
    if (ruhe) { try { const an = HRVVorstufe.analysiere(ruhe.idx.map(i => rr[i]), { skipWelchPSD: true }); ruhe.rmssd = an && an.rmssdMs; ruhe.sdnn = an && an.sdnnMs; } catch (_) { } }
    /* Blöcke: bis 2 h in 5-min-Blöcken, sonst stündlich */
    const blk = dauer <= 7200 ? 300 : 3600, bloecke = [];
    for (let a = 0; a < dauer; a += blk) { const idx = fenster(a, Math.min(dauer, a + blk)); if (idx.length < 20) continue; const h = idx.map(i => hfAlle[i]); let j = 0; for (let k = 1; k < idx.length; k++) if (Math.abs(rr[idx[k]] - rr[idx[k - 1]]) / rr[idx[k - 1]] > 0.2) j++;
      let rm = null; try { const an = HRVVorstufe.analysiere(idx.map(i => rr[i]), { skipWelchPSD: true }); rm = an && an.rmssdMs; } catch (_) { }
      bloecke.push({ a, b: Math.min(dauer, a + blk), n: idx.length, med: q(h, 0.5), min: q(h, 0.05), max: q(h, 0.95), spr: 100 * j / Math.max(1, idx.length - 1), rmssd: rm }); }
    return { rr, zeit, t0, dauer, n: rr.length, hfMed: q(hfAlle, 0.5), hf5: q(hfAlle, 0.05), hf95: q(hfAlle, 0.95), sprPct: 100 * spr / Math.max(1, rr.length - 1), ruhe, bloecke, blk };
  };
  Stall._svgHF = function (k, C, w, h, ber) {
    const pad = { l: 46, r: 14, t: 12, b: 30 }, W = w - pad.l - pad.r, H = h - pad.t - pad.b, bin = Math.max(5, Math.round(k.dauer / 600)), pts = [];
    for (let a = 0; a < k.dauer; a += bin) { let s = 0, n = 0; for (let i = 0; i < k.n; i++) if (k.zeit[i] > a && k.zeit[i] <= a + bin) { s += 60000 / k.rr[i]; n++; } if (n) pts.push([a + bin / 2, s / n]); }
    if (pts.length < 2) return '';
    const lo = ber ? ber[0] : Math.floor(Math.min(...pts.map(p => p[1])) / 5) * 5 - 5, hi = ber ? ber[1] : Math.ceil(Math.max(...pts.map(p => p[1])) / 5) * 5 + 5, X = t => pad.l + t / k.dauer * W, Y = v => pad.t + (1 - (v - lo) / (hi - lo)) * H;
    let g = `<rect x="0" y="0" width="${w}" height="${h}" fill="${C.bg}"/>`;
    if (k.ruhe) g += `<rect x="${X(k.ruhe.a).toFixed(1)}" y="${pad.t}" width="${(X(k.ruhe.b) - X(k.ruhe.a)).toFixed(1)}" height="${H}" fill="${C.hrv}" opacity="0.14"/><text x="${((X(k.ruhe.a) + X(k.ruhe.b)) / 2).toFixed(1)}" y="${pad.t + 11}" text-anchor="middle" font-size="9" fill="${C.hrv}" font-weight="700">ruhigste 5 min</text>`;
    for (let v = lo; v <= hi; v += (hi - lo > 40 ? 10 : 5)) g += `<line x1="${pad.l}" x2="${pad.l + W}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" stroke="${C.grid}" stroke-width="0.6"/><text x="${pad.l - 6}" y="${(Y(v) + 3).toFixed(1)}" text-anchor="end" font-size="9" fill="${C.achse}">${v}</text>`;
    const schritt = k.dauer <= 3600 ? 600 : k.dauer <= 4 * 3600 ? 1800 : 3600;
    for (let t = 0; t <= k.dauer; t += schritt) { const uhr = new Date(k.t0 + t * 1000).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }); g += `<line x1="${X(t).toFixed(1)}" x2="${X(t).toFixed(1)}" y1="${pad.t}" y2="${pad.t + H}" stroke="${C.grid}" stroke-width="0.6"/><text x="${X(t).toFixed(1)}" y="${h - 10}" text-anchor="middle" font-size="9" fill="${C.achse}">${uhr}</text>`; }
    g += `<polyline fill="none" stroke="${C.puls}" stroke-width="1.6" stroke-linejoin="round" points="${pts.map(p => X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join(' ')}"/>`;
    g += `<text x="${pad.l}" y="${pad.t - 2}" font-size="9" fill="${C.achse}" font-weight="700">bpm</text>`;
    return `<svg viewBox="0 0 ${w} ${h}" width="100%" style="display:block;border:1px solid ${C.rand};border-radius:10px">${g}</svg>`;
  };
  Stall._seiten = function (h, r, k, kpi, fig) {
    const f1 = x => Number(x).toFixed(1).replace('.', ','); const mm = s => { s = Math.round(s); return Math.floor(s / 3600) + ' h ' + String(Math.floor(s % 3600 / 60)).padStart(2, '0') + ' min'; }, uhr = t => new Date(k.t0 + t * 1000).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    const sp = r.speicher || {}, kern = `Aufnahme über ${mm(k.dauer)} im Gurtspeicher (${fmt0(k.n)} Schläge${r.rrQuelle === 'gurtspeicher' ? ', aus der Datenbank bitgleich gegengelesen, danach Gurt geleert' : ''}). Herzfrequenz im Median ${fmt0(k.hfMed)} bpm (5.–95. Perzentil ${fmt0(k.hf5)}–${fmt0(k.hf95)}).${k.ruhe ? ` Ruhigster 5-min-Abschnitt ${uhr(k.ruhe.a)}–${uhr(k.ruhe.b)}: ${fmt0(k.ruhe.hf)} bpm${k.ruhe.rmssd != null ? ', RMSSD ' + f1(k.ruhe.rmssd) + ' ms' : ''}.` : ' Kein 5-min-Abschnitt mit höchstens 5 % Sprüngen.'}`;
    const C = Reha._C;
    const s1 = `<div class="rh-kern">${kern}</div>
      <div class="rh-kpis">${kpi('Dauer', Math.floor(k.dauer / 3600) + ':' + String(Math.floor(k.dauer % 3600 / 60)).padStart(2, '0'), 'h', 'var(--ink)', uhr(0) + '–' + uhr(k.dauer))}${kpi('Schläge', fmt0(k.n), '', 'var(--ink)', 'Gurtspeicher, 1 ms')}${kpi('HF Median', fmt0(k.hfMed), 'bpm', 'var(--acc2)', '5.–95. Perzentil ' + fmt0(k.hf5) + '–' + fmt0(k.hf95))}${k.ruhe ? kpi('Ruhigste 5 min', fmt0(k.ruhe.hf), 'bpm', 'var(--acc)', (k.ruhe.rmssd != null ? 'RMSSD ' + f1(k.ruhe.rmssd) + ' ms · ' : '') + uhr(k.ruhe.a) + '–' + uhr(k.ruhe.b)) : ''}${kpi('Sprünge > 20 %', f1(k.sprPct), '%', k.sprPct < 5 ? 'var(--ink)' : 'var(--acc2)', 'Anteil der Schlagpaare')}</div>
      <div class="rh-cap" style="margin-top:10px">Herzfrequenz über die Aufnahme</div>${this._svgHF(k, C, 1000, 230)}
      ${fig(`Herzfrequenz als Mittel je ${Math.max(5, Math.round(k.dauer / 600))} s, Uhrzeit auf der Achse. Hell hinterlegt: der ruhigste 5-min-Abschnitt (niedrigste mittlere Herzfrequenz bei höchstens 5 % Sprüngen). Seine HRV ist orientierend: 5 min sind ein kurzes Fenster, vergleichbar nur mit Abschnitten unter ähnlichen Bedingungen (Tageszeit, Fütterung, Umgebung).`)}
      <table class="rh-tab"><thead><tr><th>${k.blk === 300 ? '5-min-Block' : 'Stunde'}</th><th>Schläge</th><th>HF Median</th><th>HF 5.–95. Perzentil</th><th>RMSSD (bereinigt)</th><th>Sprünge &gt; 20 %</th></tr></thead><tbody>${k.bloecke.map(b => `<tr><td>${uhr(b.a)}–${uhr(b.b)}</td><td>${fmt0(b.n)}</td><td>${fmt0(b.med)} bpm</td><td>${fmt0(b.min)}–${fmt0(b.max)} bpm</td><td>${b.rmssd != null ? f1(b.rmssd) + ' ms' : '–'}</td><td style="color:${b.spr < 5 ? 'var(--ink)' : 'var(--acc2)'}">${f1(b.spr)} %</td></tr>`).join('')}</tbody></table>`;
    const ruheRR = k.ruhe ? k.ruhe.idx.map(i => k.rr[i]) : null;
    const P = ruheRR && typeof Report !== 'undefined' && Report._poin ? (() => { const b = ruheRR.slice().sort((x, y) => x - y), lo = Math.floor((b[Math.floor(0.01 * (b.length - 1))] - 60) / 10) * 10, hi = Math.ceil((b[Math.floor(0.99 * (b.length - 1))] + 60) / 10) * 10; return Report._poin(ruheRR, { size: 400, lo, hi }); })() : null;
    const s2 = `<div class="rh-zwei"><div><div class="rh-cap">Schlag zu Schlag · ruhigster Abschnitt</div>${P ? P.svg : '<div class="rh-mini">Kein ruhiger Abschnitt für ein Poincaré-Bild.</div>'}${P ? fig(`Poincaré der ${fmt0(P.n)} Schlagpaare aus ${uhr(k.ruhe.a)}–${uhr(k.ruhe.b)}: jeder Abstand gegen den folgenden. Breite der Wolke ≈ Änderung von Schlag zu Schlag (SD1 ≈ RMSSD ÷ √2), Länge = langsamere Schwankungen.`) : ''}</div>
      <div><div class="rh-box"><div class="rh-bt">Herkunft</div>
        <div class="rh-pv"><span>Pferd</span><b>${esc(h.name)}</b></div><div class="rh-pv"><span>Beginn</span><b>${new Date(k.t0).toLocaleString('de-DE')}</b></div><div class="rh-pv"><span>Sensor</span><b>${esc((r.source && r.source.sensor) || sp.sensor || 'Polar H10')}</b></div>
        <div class="rh-pv"><span>Weg</span><b>${r.rrQuelle === 'gurtspeicher' ? 'Gurtspeicher (PSFTP), ausgelesen, bitgleich gegengelesen, Gurt danach geleert' : 'live'}</b></div>
        ${sp.kennung ? `<div class="rh-pv"><span>Kennung im Gurt</span><code>${esc(sp.kennung)}</code></div>` : ''}<div class="rh-pv"><span>RR-Reihe SHA-256</span><code id="stSha">wird berechnet</code></div></div>
      <div class="rh-box"><div class="rh-bt">Methode und Grenzen</div><div class="rh-meth">
        <p><b>Aufnahme.</b> Polar-H10-Brustgurt im Pferdegurt; RR-Intervalle in 1 ms aus dem internen Speicher des Gurts, unabhängig von der Funkverbindung.</p>
        <p><b>Kennwerte.</b> Herzfrequenz = 60.000 ÷ RR je Schlag. RMSSD nach Bereinigung mit derselben Filterkette wie die CARLON-Equine-App (Kreuztest Visite = App gültig). Sprünge &gt; 20 % zum vorigen Abstand sind eine Sichthilfe; sie können Fehlerkennungen oder echte lange Abstände sein, was nur ein EKG unterscheidet.</p>
        <p><b>Grenzen.</b> Beschreibende Aufzeichnung, kein Alarm- oder Überwachungssystem und keine Diagnose. Die Einordnung macht die Tierärztin oder der Tierarzt. Bewegung, Fressen und Aufregung verändern die Werte; Abschnitte sind deshalb nur unter ähnlichen Bedingungen vergleichbar.</p></div></div></div></div>`;
    return { seiten: [s1, s2], kern };
  };
  Stall.bericht = async function (recIds, thema) {
    recIds = [].concat(recIds).filter(Boolean); if (!recIds.length) return; thema = thema || (State.settings && State.settings.rehaThema) || 'hell';
    const dunkel = thema === 'dunkel'; Reha._C = dunkel ? Reha._CD : Reha._CL; const st = State.settings;
    const praxis = esc(st.clinicName || 'Ihre Praxis'), zusatz = esc([st.clinicAddr, st.clinicWeb].filter(Boolean).join(' · '));
    const logo = st.logo ? `<img src="${st.logo}" style="width:74px;height:58px;object-fit:contain;border:1px solid var(--line);border-radius:8px;background:#fff">` : '';
    let abb = 0; const fig = t => `<div class="rh-fig"><b>Abbildung ${++abb}.</b> ${t}</div>`;
    const kpi = (l, w, e, f, u) => `<div class="rh-kpi"><span>${l}</span><b style="color:${f || 'var(--ink)'}">${w}</b><em>${e || ''}</em>${u ? `<div class="rh-ku">${u}</div>` : ''}</div>`;
    const alle = []; const ueb = [];
    for (const id of recIds) { const r = State.recordings.find(x => x.id === id); if (!r) continue; const h = State.horses.find(x => x.id === r.horseId) || { name: 'Pferd' };
      const k = this._kennwerte(r), sx = this._seiten(h, r, k, kpi, fig);
      const kopf = `<div class="rh-kopf">${logo}<div style="flex:1"><div class="rh-ein">${praxis}</div><div class="rh-tit">Langzeit-Aufnahme</div><div class="rh-zus">${zusatz}</div></div><div style="text-align:right"><div class="rh-pf">${esc(h.name)}</div><div class="rh-zus">${new Date(k.t0).toLocaleDateString('de-DE')} · ${h.stable ? esc(h.stable) : ''}</div></div></div>`;
      for (const x of sx.seiten) alle.push(kopf + x); ueb.push({ h, k, r, kern: sx.kern }); }
    if (ueb.length > 1) { const zeile = u => `<tr><td><b>${esc(u.h.name)}</b></td><td>${new Date(u.k.t0).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</td><td>${fmt0(u.k.dauer / 60)} min</td><td>${fmt0(u.k.n)}</td><td>${fmt0(u.k.hfMed)} bpm</td><td>${u.k.ruhe ? fmt0(u.k.ruhe.hf) + ' bpm' + (u.k.ruhe.rmssd != null ? ' · ' + Number(u.k.ruhe.rmssd).toFixed(1).replace('.', ',') + ' ms' : '') : '–'}</td><td>${Number(u.k.sprPct).toFixed(1).replace('.', ',')} %</td></tr>`;
      alle.unshift(`<div class="rh-kopf">${logo}<div style="flex:1"><div class="rh-ein">${praxis}</div><div class="rh-tit">Stallrunde · Übersicht</div><div class="rh-zus">${zusatz}</div></div><div style="text-align:right"><div class="rh-pf">${ueb.length} Pferde</div><div class="rh-zus">${new Date(ueb[0].k.t0).toLocaleDateString('de-DE')}</div></div></div>
        <div class="rh-kern">${ueb.length} Pferde, je ein Gurt mit Aufnahme im eigenen Speicher; alle Reihen bitgleich gegengelesen. Je Pferd folgen zwei Seiten mit Verlauf, Blöcken, ruhigstem Abschnitt und Herkunft.</div>
        <div class="rh-cap" style="margin-top:12px">Herzfrequenz je Pferd, gleiche Achse</div><div style="display:grid;grid-template-columns:repeat(${Math.min(3, ueb.length)},minmax(0,1fr));gap:10px">${(() => { const ber = [Math.floor(Math.min(...ueb.map(u => u.k.hf5)) / 5) * 5 - 10, Math.ceil(Math.max(...ueb.map(u => u.k.hf95)) / 5) * 5 + 10]; return ueb.map(u => `<div class="rh-box" style="margin:0"><div class="rh-bt">${esc(u.h.name)}</div>${this._svgHF(u.k, Reha._C, 420, 150, ber)}</div>`).join(''); })()}</div>
        <table class="rh-tab"><thead><tr><th>Pferd</th><th>Beginn</th><th>Dauer</th><th>Schläge</th><th>HF Median</th><th>Ruhigste 5 min · RMSSD</th><th>Sprünge &gt; 20 %</th></tr></thead><tbody>${ueb.map(zeile).join('')}</tbody></table>`); }
    const fuss = (n, m) => `<div class="rh-fuss"><div>Aufgezeichnet mit CARLON Equine Visite (Polar H10, RR 1 ms, Gurtspeicher). Kein Medizinprodukt, keine Diagnose; Beurteilung durch die Tierärztin oder den Tierarzt.</div><div class="rh-fz"><span>${praxis}</span><span>Seite ${n} von ${m}</span></div></div>`;
    $('#printArea').innerHTML = Reha._stil(dunkel) + alle.map((x, i) => `<section class="rh-seite"><div class="rh-inh">${x}</div>${fuss(i + 1, alle.length)}</section>`).join('');
    for (const u of ueb) { try { const sha = await Pruefwert.rr(u.r.rr); const el = document.getElementById('stSha'); if (el) { el.textContent = sha || '–'; el.removeAttribute('id'); } } catch (_) { } }
    Reha._einpassen();
    for (const u of ueb) { try { await Akte.notiere(u.h.id, 'Langzeit-Bericht', { text: u.kern, aufnahme: u.r.id }); } catch (_) { } }
    const alt = document.title; document.title = (ueb.length > 1 ? 'Stallrunde ' : ueb[0].h.name + ' · Langzeit ') + new Date(ueb[0].k.t0).toLocaleDateString('de-DE'); setTimeout(() => { window.print(); document.title = alt; }, 150);
  };
  global.Stall = Stall;
})(typeof window !== 'undefined' ? window : globalThis);
