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
      if (neu) { neu.ereignisse = (p.ereignisse || []).slice(); neu.rrQuelle = 'gurtspeicher'; neu.speicher = { kennung: p.kennung, schlaege: mem.rr.length, verworfen: mem.verworfen, bytes: mem.bytes, geloescht: false }; await DB.put('recordings', neu); }
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
        ${p.zustand === 'laeuft' ? `<div class="st-ev">${Object.entries(this.EREIGNISSE).filter(([k]) => k !== 'notiz').map(([k, v]) => `<button class="btn ghost" onclick="Stall.ereignis('${p.hid}','${k}')">${v}</button>`).join('')}<input id="stNotiz_${p.hid}" placeholder="${en ? 'Note' : 'Notiz'}" onkeydown="if(event.key==='Enter')Stall.ereignis('${p.hid}','notiz')"></div>${(p.ereignisse || []).length ? `<div class="st-meta">${p.ereignisse.slice(-3).map(e => new Date(e.t).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' ' + esc(this.EREIGNISSE[e.typ] + (e.text ? ': ' + e.text : ''))).join(' · ')}</div>` : ''}` : ''}
        <div class="st-knoepfe">${p.zustand === 'laeuft' ? `<button class="btn" onclick="Stall.auslesen('${p.hid}')">${en ? 'Read out and clear' : 'Auslesen und leeren'}</button>${p.dev ? '' : `<button class="btn ghost" onclick="Stall.verbindenLesen('${p.hid}')">${en ? 'Find strap' : 'Gurt suchen'}</button>`}` : p.zustand === 'fertig' ? `${p.recId ? `<button class="btn" onclick="Stall.berichtDialog('${p.recId}')">${en ? 'Report (PDF)' : 'Bericht (PDF)'}</button>` : ''}<button class="btn ghost" onclick="Views.openHorse('${p.hid}')">${en ? 'Open record' : 'Akte öffnen'}</button><button class="btn ghost" onclick="Stall.entfernen('${p.hid}')">${en ? 'Remove' : 'Entfernen'}</button>` : ''}</div></div>`; },
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
        <div class="st-start">${kandidaten.map(h => `<button class="btn primary" onclick="Stall.starten('${h.id}')">${en ? 'Start strap · ' : 'Gurt starten · '}${esc(h.name)}</button>`).join('')}${ps.filter(p => p.zustand === 'fertig' && p.recId).length > 1 ? `<button class="btn" onclick="Stall.berichtDialog(${JSON.stringify(ps.filter(p => p.zustand === 'fertig' && p.recId).map(p => p.recId)).replace(/"/g, '&quot;')})">${en ? 'Round report (PDF)' : 'Sammelbericht (PDF)'}</button>` : ''}${alle > 1 ? `<button class="btn" onclick="Stall.alleAuslesen(${JSON.stringify(ps.map(p => p.hid)).replace(/"/g, '&quot;')})">${en ? 'Read out all' : 'Alle auslesen'} (${alle})</button>` : ''}</div></div>
        <div class="st-grid" id="stGrid">${ps.map(p => this.kachelHTML(p)).join('') || `<div class="st-leer">${en ? 'No strap recording yet. Admit horses to the station, then start their strap.' : 'Noch keine Gurt-Aufnahme. Pferde auf die Station aufnehmen, dann ihren Gurt starten.'}</div>`}</div>
        <div class="station-note"><span><b>${en ? 'Not an alarm system.' : 'Kein Alarmsystem.'}</b> ${en ? 'Radio dropouts are possible; a missing notice does not mean that nothing happened. Does not replace rounds.' : 'Funkabbrüche sind möglich; ein fehlender Hinweis bedeutet nicht, dass kein Ereignis vorliegt. Ersetzt keine Kontrollgänge.'}</span></div></section>`; },
    _kachel(p) { const el = document.querySelector(`[data-stall="${p.hid}"]`); if (!el) return; const d = document.createElement('div'); d.innerHTML = this.kachelHTML(p); el.replaceWith(d.firstElementChild); },
    _neu() { const r = document.getElementById('stRunde'); if (r && this._runde) { r.innerHTML = this.html({ pferde: this._runde.pferde, zielMin: 30 }); return; }
      try { if (typeof Nav !== 'undefined' && (Nav.cur === 'station' || Nav.cur === 'detail')) Nav.refresh(); } catch (_) { } },
    _takt: null,
    an() { if (this._takt) return; this._takt = setInterval(() => { for (const p of Object.values(this.plaetze)) if (p.zustand === 'laeuft') this._kachel(p); }, 5000); this.wiederfinden(); }
  };

  /* ═══ LANGZEITBERICHT 1.1 (20.11.2026, nach Perplexity-Audit R1: 66/80/68/55/72/60) ═══
     Datenqualität beziffert, Ereignisleiste, frühere Aufzeichnungen desselben Pferds, Halterinnen-Blatt, Druck immer hell,
     neutrale Formulierungen. Druckrahmen wie der Reha-Sitzungsbericht (Reha._stil/_einpassen), A4 quer. */
  Stall.BERICHT_VERSION = 'Langzeitbericht 1.1 (2026-11-20)';
  Stall.EREIGNISSE = { fuetterung: 'Fütterung', untersuchung: 'Untersuchung', medikation: 'Medikation', liegen: 'Liegt', unruhe: 'Unruhe', bewegung: 'Bewegung', notiz: 'Notiz' };
  Stall.ereignis = async function (hid, typ) { const p = this.plaetze[hid]; if (!p || !p.startMs) return; let text = '';
    if (typ === 'notiz') { const el = document.getElementById('stNotiz_' + hid); text = (el && el.value || '').trim(); if (!text) return; el.value = ''; }
    (p.ereignisse = p.ereignisse || []).push({ t: Date.now(), typ, text }); State.settings.stallEreignisse = Object.assign(State.settings.stallEreignisse || {}, { [p.kennung]: p.ereignisse }); await State.saveSettings();
    Toast.show((this.EREIGNISSE[typ] || typ) + ' · ' + new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }), 'ok'); this._kachel(p); };
  Stall._kennwerte = function (r) {
    const rr = (r.rr || []).map(Number), t0 = new Date(r.startedAt).getTime(); let acc = 0; const zeit = rr.map(v => (acc += v / 1000));
    const dauer = acc, hfAlle = rr.map(v => 60000 / v), q = (a, p) => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[Math.min(b.length - 1, Math.floor(p * (b.length - 1)))] : null; };
    /* Sprünge getrennt: etwa doppelte Abstände (1,7–2,3 × Vorgänger, typisch lange Pause) und übrige Sprünge > 20 % */
    let dop = 0, spr = 0; for (let i = 1; i < rr.length; i++) { const f = rr[i] / rr[i - 1]; if (f >= 1.7 && f <= 2.3) dop++; else if (Math.abs(f - 1) > 0.2) spr++; }
    let pipe = null; try { const pr = HRVVorstufe.pipeline.process(rr); pipe = { pausen: (pr.avBlockIndices || []).length, ersetzt: (pr.ectopicIndices || []).length + (pr.motionArtifactIndices || []).length, artPct: pr.artifactRatePct, guete: pr.qualityLabel }; } catch (_) { }
    const fenster = (a, b) => { const idx = []; for (let i = 0; i < rr.length; i++) if (zeit[i] > a && zeit[i] <= b) idx.push(i); return idx; };
    let ruhe = null;
    for (let a = 0; a + 300 <= dauer; a += 60) { const idx = fenster(a, a + 300); if (idx.length < 120) continue; let j = 0; for (let k = 1; k < idx.length; k++) if (Math.abs(rr[idx[k]] - rr[idx[k - 1]]) / rr[idx[k - 1]] > 0.2) j++;
      if (j / idx.length > 0.05) continue; const m = q(idx.map(i => hfAlle[i]), 0.5); if (!ruhe || m < ruhe.hf) ruhe = { a, b: a + 300, hf: m, idx }; }
    if (ruhe) { try { const an = HRVVorstufe.analysiere(ruhe.idx.map(i => rr[i]), { skipWelchPSD: true }); ruhe.rmssd = an && an.rmssdMs; } catch (_) { } }
    /* Blöcke: bis 2 h je 5 min, sonst je Stunde; ein Rest unter einem Viertel Block fällt in den vorigen */
    const blk = dauer <= 7200 ? 300 : 3600, bloecke = [], grenzen = []; for (let a = 0; a < dauer; a += blk) grenzen.push(a); if (grenzen.length > 1 && dauer - grenzen[grenzen.length - 1] < blk / 4) grenzen.pop();
    grenzen.forEach((a, gi) => { const b = gi + 1 < grenzen.length ? grenzen[gi + 1] : dauer, idx = fenster(a, b); if (idx.length < 20) return; const h = idx.map(i => hfAlle[i]);
      let j = 0; for (let k = 1; k < idx.length; k++) if (Math.abs(rr[idx[k]] - rr[idx[k - 1]]) / rr[idx[k - 1]] > 0.2) j++;
      const h1 = q(h.slice(0, Math.floor(h.length / 2)), 0.5), h2 = q(h.slice(Math.floor(h.length / 2)), 0.5);
      let rm = null; try { const an = HRVVorstufe.analysiere(idx.map(i => rr[i]), { skipWelchPSD: true }); rm = an && an.rmssdMs; } catch (_) { }
      bloecke.push({ a, b, n: idx.length, med: q(h, 0.5), min: q(h, 0.05), max: q(h, 0.95), spr: 100 * j / Math.max(1, idx.length - 1), rmssd: rm, ungleich: Math.abs(h1 - h2) >= 4 }); });
    return { rr, zeit, t0, dauer, n: rr.length, hfMed: q(hfAlle, 0.5), hf5: q(hfAlle, 0.05), hf95: q(hfAlle, 0.95), dopPct: 100 * dop / Math.max(1, rr.length - 1), sprPct: 100 * spr / Math.max(1, rr.length - 1), dop, spr, pipe, ruhe, bloecke, blk };
  };
  Stall._frueher = function (r) { const alt = State.recordings.filter(x => x.horseId === r.horseId && x.id !== r.id && x.rrQuelle === 'gurtspeicher' && !x.reha && (x.durationSec || 0) >= 1200 && new Date(x.startedAt) < new Date(r.startedAt));
    if (!alt.length) return null; const med = alt.map(x => { const h = (x.rr || []).map(v => 60000 / v).sort((a, b) => a - b); return h[Math.floor(h.length / 2)]; }).sort((a, b) => a - b);
    return { n: alt.length, p25: med[Math.floor(0.25 * (med.length - 1))], p75: med[Math.ceil(0.75 * (med.length - 1))], med: med[Math.floor(med.length / 2)] }; };
  Stall._svgHF = function (k, C, w, h, ber, frueher, ereignisse) {
    const pad = { l: 50, r: 14, t: 16, b: ereignisse && ereignisse.length ? 46 : 30 }, W = w - pad.l - pad.r, H = h - pad.t - pad.b, bin = Math.max(5, Math.round(k.dauer / 600)), pts = [];
    for (let a = 0; a < k.dauer; a += bin) { const v = []; for (let i = 0; i < k.n; i++) if (k.zeit[i] > a && k.zeit[i] <= a + bin) v.push(60000 / k.rr[i]); if (v.length) { v.sort((x, y) => x - y); pts.push([a + bin / 2, v[Math.floor(v.length / 2)]]); } }
    if (pts.length < 2) return '';
    const lo = ber ? ber[0] : Math.floor(Math.min(k.hf5, frueher ? frueher.p25 : 999) / 5) * 5 - 10, hi = ber ? ber[1] : Math.ceil(Math.max(k.hf95, frueher ? frueher.p75 : 0) / 5) * 5 + 10, X = t => pad.l + t / k.dauer * W, Y = v => pad.t + (1 - (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * H;
    let g = `<rect x="0" y="0" width="${w}" height="${h}" fill="${C.bg}"/>`;
    if (frueher) g += `<rect x="${pad.l}" y="${Y(frueher.p75).toFixed(1)}" width="${W}" height="${Math.max(2, Y(frueher.p25) - Y(frueher.p75)).toFixed(1)}" fill="${C.achse}" opacity="0.13"/><text x="${pad.l + W - 4}" y="${(Y(frueher.p75) - 4).toFixed(1)}" text-anchor="end" font-size="10" fill="${C.achse}">frühere Aufzeichnungen dieses Pferds (${frueher.n}), mittlere Hälfte der Mediane</text>`;
    if (k.ruhe) g += `<rect x="${X(k.ruhe.a).toFixed(1)}" y="${pad.t}" width="${Math.max(2, X(k.ruhe.b) - X(k.ruhe.a)).toFixed(1)}" height="${H}" fill="${C.hrv}" opacity="0.16"/>`;
    for (let v = lo; v <= hi; v += (hi - lo > 40 ? 10 : 5)) g += `<line x1="${pad.l}" x2="${pad.l + W}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" stroke="${C.grid}" stroke-width="0.6"/><text x="${pad.l - 6}" y="${(Y(v) + 3.5).toFixed(1)}" text-anchor="end" font-size="10.5" fill="${C.achse}">${v}</text>`;
    const schritt = k.dauer <= 2400 ? 300 : k.dauer <= 3600 ? 600 : k.dauer <= 4 * 3600 ? 1800 : 3600;
    for (let t = 0; t <= k.dauer + 1; t += schritt) { const uhr = new Date(k.t0 + t * 1000).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }); g += `<line x1="${X(t).toFixed(1)}" x2="${X(t).toFixed(1)}" y1="${pad.t}" y2="${pad.t + H}" stroke="${C.grid}" stroke-width="0.6"/><text x="${X(t).toFixed(1)}" y="${pad.t + H + 14}" text-anchor="middle" font-size="10.5" fill="${C.achse}">${uhr}</text>`; }
    g += `<polyline fill="none" stroke="${C.linie}" stroke-width="1.7" stroke-linejoin="round" points="${pts.map(p => X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join(' ')}"/>`;
    for (const e of (ereignisse || [])) { const t = (e.t - k.t0) / 1000; if (t < 0 || t > k.dauer) continue; const x = X(t); g += `<line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${pad.t}" y2="${pad.t + H + 18}" stroke="${C.tempo}" stroke-width="1" stroke-dasharray="3 2"/><text x="${(x + 3).toFixed(1)}" y="${pad.t + H + 30}" font-size="10" fill="${C.tempo}">${esc((Stall.EREIGNISSE[e.typ] || e.typ) + (e.text ? ': ' + e.text : ''))}</text>`; }
    g += `<text x="${pad.l}" y="${pad.t - 4}" font-size="10" fill="${C.achse}" font-weight="700">Schläge/min</text>`;
    return `<svg viewBox="0 0 ${w} ${h}" width="100%" style="display:block;border:1px solid ${C.rand};border-radius:10px">${g}</svg>`;
  };
  Stall._bereich = function (rr) { const q = rr.slice().sort((x, y) => x - y), n = q.length, a = q[Math.floor(0.002 * (n - 1))], b = q[Math.ceil(0.998 * (n - 1))], d = Math.max(60, (b - a) * 0.08);
    return [Math.floor((a - d) / 50) * 50, Math.ceil((b + d) / 50) * 50]; };
  Stall._svgPoinZeit = function (k, C, size) {
    const n = k.n; if (n < 40) return ''; const [lo, hi] = this._bereich(k.rr), pad = 46, W = size - pad - 14, S = v => pad + (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo) * W, Sy = v => 14 + W - (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo) * W;
    const A = [62, 207, 178], B = [246, 183, 60], V = [143, 124, 240], farbe = u => { const m = u < .5 ? [A, B, u * 2] : [B, V, (u - .5) * 2]; return 'rgb(' + m[0].map((x, i) => Math.round(x + (m[1][i] - x) * m[2])).join(',') + ')'; };
    let g = `<rect width="${size}" height="${size + 54}" rx="12" fill="${C.bg}" stroke="${C.rand}"/>`;
    const st = (hi - lo) > 800 ? 200 : (hi - lo) > 400 ? 100 : 50;
    for (let v = Math.ceil(lo / st) * st; v <= hi; v += st) g += `<line x1="${S(v).toFixed(1)}" x2="${S(v).toFixed(1)}" y1="14" y2="${14 + W}" stroke="${C.grid}"/><line x1="${pad}" x2="${pad + W}" y1="${Sy(v).toFixed(1)}" y2="${Sy(v).toFixed(1)}" stroke="${C.grid}"/><text x="${S(v).toFixed(1)}" y="${W + 28}" text-anchor="middle" font-size="9.5" fill="${C.achse}">${fmt0(v)}</text><text x="${pad - 5}" y="${(Sy(v) + 3).toFixed(1)}" text-anchor="end" font-size="9.5" fill="${C.achse}">${fmt0(v)}</text>`;
    g += `<line x1="${S(lo)}" y1="${Sy(lo)}" x2="${S(hi)}" y2="${Sy(hi)}" stroke="${C.achse}" stroke-dasharray="4 4" opacity=".55"/>`;
    const r0 = n > 12000 ? 0.9 : n > 4000 ? 1.2 : 1.6, op = n > 12000 ? 0.5 : 0.75;
    for (let i = 0; i < n - 1; i++) g += `<circle cx="${S(k.rr[i]).toFixed(1)}" cy="${Sy(k.rr[i + 1]).toFixed(1)}" r="${r0}" fill="${farbe(i / (n - 2))}" opacity="${op}"/>`;
    const gy = size + 6, uhr = t => new Date(k.t0 + t * 1000).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    g += `<defs><linearGradient id="lzG"><stop offset="0" stop-color="rgb(62,207,178)"/><stop offset=".5" stop-color="rgb(246,183,60)"/><stop offset="1" stop-color="rgb(143,124,240)"/></linearGradient></defs><rect x="${pad}" y="${gy}" width="${W}" height="8" rx="4" fill="url(#lzG)"/>`;
    g += `<text x="${pad}" y="${gy + 21}" font-size="10" fill="${C.achse}">${uhr(0)}</text><text x="${pad + W / 2}" y="${gy + 21}" text-anchor="middle" font-size="10" fill="${C.achse}">${uhr(k.dauer / 2)}</text><text x="${pad + W}" y="${gy + 21}" text-anchor="end" font-size="10" fill="${C.achse}">${uhr(k.dauer)} Uhr</text>`;
    g += `<text x="${pad + W / 2}" y="${W + 42}" text-anchor="middle" font-size="9.5" fill="${C.achse}">RRₙ (ms)</text><text transform="translate(12 ${14 + W / 2}) rotate(-90)" text-anchor="middle" font-size="9.5" fill="${C.achse}">RRₙ₊₁ (ms)</text>`;
    return `<svg viewBox="0 0 ${size} ${size + 54}" style="width:100%;display:block">${g}</svg>`; };
  /* Zeitfarbe wie im großen Poincaré: u = Anteil der Aufzeichnung (0 Beginn, 1 Ende), Türkis → Bernstein → Violett */
  Stall._farbe = function (u) { const A = [62, 207, 178], B = [246, 183, 60], V = [143, 124, 240], m = u < .5 ? [A, B, u * 2] : [B, V, (u - .5) * 2]; return 'rgb(' + m[0].map((x, i) => Math.round(x + (m[1][i] - x) * m[2])).join(',') + ')'; };
  /* Poincaré je Zeitblock in denselben Zeitfarben, gleiche Achsen, Ellipse aus SD1/SD2 des Blocks */
  Stall._svgPoinKlein = function (k, ix, lo, hi, C, size) {
    if (ix.length < 20) return ''; const pad = 26, W = size - pad - 8, S = v => pad + (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo) * W, Sy = v => 6 + W - (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo) * W;
    const xs = [], ys = []; for (let j = 0; j + 1 < ix.length; j++) if (ix[j + 1] === ix[j] + 1) { xs.push(k.rr[ix[j]]); ys.push(k.rr[ix[j + 1]]); }
    const n = xs.length; if (n < 10) return ''; const m = (xs.reduce((a, b) => a + b, 0) + ys.reduce((a, b) => a + b, 0)) / (2 * n);
    let s1 = 0, s2 = 0; for (let i = 0; i < n; i++) { const d1 = (ys[i] - xs[i]) / Math.SQRT2, d2 = (xs[i] + ys[i]) / Math.SQRT2 - m * Math.SQRT2; s1 += d1 * d1; s2 += d2 * d2; } const sd1 = Math.sqrt(s1 / n), sd2 = Math.sqrt(s2 / n);
    let g = `<rect width="${size}" height="${size}" rx="8" fill="${C.bg}" stroke="${C.rand}"/>`;
    const st = (hi - lo) > 800 ? 200 : 100; for (let v = Math.ceil(lo / st) * st; v <= hi; v += st) g += `<line x1="${S(v).toFixed(1)}" x2="${S(v).toFixed(1)}" y1="6" y2="${6 + W}" stroke="${C.grid}" stroke-width="0.6"/><line x1="${pad}" x2="${pad + W}" y1="${Sy(v).toFixed(1)}" y2="${Sy(v).toFixed(1)}" stroke="${C.grid}" stroke-width="0.6"/><text x="${pad - 3}" y="${(Sy(v) + 3).toFixed(1)}" text-anchor="end" font-size="7.5" fill="${C.achse}">${fmt0(v)}</text>`;
    g += `<line x1="${S(lo)}" y1="${Sy(lo)}" x2="${S(hi)}" y2="${Sy(hi)}" stroke="${C.achse}" stroke-dasharray="3 3" opacity=".5"/>`;
    for (let j = 0; j + 1 < ix.length; j++) if (ix[j + 1] === ix[j] + 1) g += `<circle cx="${S(k.rr[ix[j]]).toFixed(1)}" cy="${Sy(k.rr[ix[j + 1]]).toFixed(1)}" r="1.1" fill="${this._farbe(ix[j] / Math.max(1, k.n - 2))}" opacity=".75"/>`;
    const cx = S(m), cy = Sy(m), sk = W / (hi - lo); g += `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${Math.max(1, sd2 * 2 * sk).toFixed(1)}" ry="${Math.max(1, sd1 * 2 * sk).toFixed(1)}" transform="rotate(-45 ${cx.toFixed(1)} ${cy.toFixed(1)})" fill="none" stroke="${C.linie}" stroke-width="1.1"/>`;
    return { svg: `<svg viewBox="0 0 ${size} ${size}" style="width:100%;display:block">${g}</svg>`, n, sd1, sd2 }; };
  Stall._seiten = function (h, r, k, kpi, fig, opt) {
    const f1 = x => Number(x).toFixed(1).replace('.', ','), dauerTxt = s => { s = Math.round(s / 60); return Math.floor(s / 60) + ' h ' + String(s % 60).padStart(2, '0') + ' min'; }, uhr = t => new Date(k.t0 + t * 1000).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    const sp = r.speicher || {}, C = Reha._C, fr = this._frueher(r), ev = r.ereignisse || [], bed = (opt.bedingungen || {})[r.id] || '';
    const kern = `Aufzeichnung über ${dauerTxt(k.dauer)} aus dem Speicher des Gurts (${fmt0(k.n)} Schläge, ohne Funklücken). Herzfrequenz im Median ${fmt0(k.hfMed)} Schläge/min, die mittleren 90 % der Werte zwischen ${fmt0(k.hf5)} und ${fmt0(k.hf95)}.${k.ruhe ? ` Die fünf Minuten mit der niedrigsten Herzfrequenz lagen von ${uhr(k.ruhe.a)} bis ${uhr(k.ruhe.b)} Uhr (${fmt0(k.ruhe.hf)} Schläge/min${k.ruhe.rmssd != null ? ', RMSSD ' + f1(k.ruhe.rmssd) + ' ms' : ''}).` : ''}${fr ? ` Frühere Aufzeichnungen dieses Pferds: Median ${fmt0(fr.med)} Schläge/min (${fr.n}).` : ''}`;
    const zahl = (n, e, m) => fmt0(n) + ' ' + (n === 1 ? e : m), GUETE = { Excellent: 'sehr gut', Good: 'gut', Fair: 'eingeschränkt', Poor: 'gering', Unusable: 'nicht auswertbar' };
    const dq = k.pipe ? `Datenqualität: ${zahl(k.dop, 'etwa doppelter Abstand', 'etwa doppelte Abstände')} (${f1(k.dopPct)} %, typisch lange Pausen), ${zahl(k.spr, 'übriger Sprung', 'übrige Sprünge')} über 20 % (${f1(k.sprPct)} %); die Bereinigung hat ${zahl(k.pipe.ersetzt, 'Schlag', 'Schläge')} ersetzt und ${zahl(k.pipe.pausen, 'lange Pause', 'lange Pausen')} überbrückt (Equine-Filterkette, Signalgüte ${esc(GUETE[k.pipe.guete] || k.pipe.guete || '–')}).` : '';
    const s1 = `<div class="rh-kern">${kern}</div>
      ${opt.anlass || bed ? `<div class="rh-stamm">${[opt.anlass ? '<b>Anlass (Praxis):</b> ' + esc(opt.anlass) : '', bed ? '<b>Bedingungen:</b> ' + esc(bed) : ''].filter(Boolean).join(' · ')}</div>` : ''}
      <div class="rh-kpis">${kpi('Dauer', dauerTxt(k.dauer).replace(' min', ''), 'min', 'var(--ink)', uhr(0) + '–' + uhr(k.dauer) + ' Uhr')}${kpi('Schläge', fmt0(k.n), '', 'var(--ink)', 'Speicher des Gurts, 1 ms')}${kpi('Herzfrequenz', fmt0(k.hfMed), 'Schläge/min', 'var(--ink)', 'Median · mittlere 90 %: ' + fmt0(k.hf5) + '–' + fmt0(k.hf95))}${k.ruhe ? kpi('Niedrigste 5 min', fmt0(k.ruhe.hf), 'Schläge/min', 'var(--ink)', uhr(k.ruhe.a) + '–' + uhr(k.ruhe.b) + (k.ruhe.rmssd != null ? ' · RMSSD ' + f1(k.ruhe.rmssd) + ' ms' : '')) : ''}${kpi('Datenqualität', k.pipe ? f1(100 - k.pipe.artPct) : '–', '%', 'var(--ink)', 'Anteil unverändert übernommener Schläge')}</div>
      ${dq ? `<div class="rh-mini" style="font-size:10.5px">${dq}</div>` : ''}
      <div class="rh-cap" style="margin-top:8px">Herzfrequenz über die Aufzeichnung${ev.length ? ' · mit Ereignissen' : ''}</div>${this._svgHF(k, C, 1100, ev.length ? 215 : 190, null, fr, ev)}
      ${fig(`Herzfrequenz als Median je ${Math.max(5, Math.round(k.dauer / 600))} s, Uhrzeit auf der Achse. Hell hinterlegt: die fünf Minuten mit der niedrigsten Herzfrequenz (höchstens 5 % Sprünge).${fr ? ' Grau: mittlere Hälfte der Mediane früherer Aufzeichnungen dieses Pferds.' : ''}${ev.length ? ' Gestrichelt: von der Praxis notierte Ereignisse.' : ''} Die HRV aus fünf Minuten ist orientierend und nur mit Abschnitten unter ähnlichen Bedingungen vergleichbar.`)}
      <table class="rh-tab" style="font-size:10.5px"><thead><tr><th>${k.blk === 300 ? '5-min-Block' : 'Stunde'}</th><th>Schläge</th><th>Herzfrequenz (Median)</th><th>mittlere 90 %</th><th>RMSSD (bereinigt)</th><th>Sprünge &gt; 20 %</th></tr></thead><tbody>${k.bloecke.map(b => `<tr><td>${uhr(b.a)}–${uhr(b.b)}</td><td>${fmt0(b.n)}</td><td>${fmt0(b.med)}${b.ungleich ? ' <small style="color:var(--dim)">· nicht gleichförmig</small>' : ''}</td><td>${fmt0(b.min)}–${fmt0(b.max)}</td><td>${b.rmssd != null ? f1(b.rmssd) + ' ms' : '–'}</td><td>${f1(b.spr)} %</td></tr>`).join('').replace(/<td>/g, '<td style="padding:3px 8px">')}</tbody></table>`;
    const ruheRR = k.ruhe ? k.ruhe.idx.map(i => k.rr[i]) : null;
    const P = ruheRR && typeof Report !== 'undefined' && Report._poin ? (() => { const b = ruheRR.slice().sort((x, y) => x - y), lo = Math.floor((b[Math.floor(0.01 * (b.length - 1))] - 60) / 10) * 10, hi = Math.ceil((b[Math.floor(0.99 * (b.length - 1))] + 60) / 10) * 10; return Report._poin(ruheRR, { size: 330, lo, hi }); })() : null;
    const T = ruheRR && typeof Chart !== 'undefined' ? Chart.tachogram(ruheRR, { w: 560, h: 230, color: C.hrv }) : '';
    const sha = '<code class="stSha">wird berechnet</code>';
    const [blo, bhi] = this._bereich(k.rr), klein = k.bloecke.slice(0, 12).map(b => { const ix = []; for (let i = 0; i < k.n; i++) if (k.zeit[i] > b.a && k.zeit[i] <= b.b) ix.push(i);
      const P2 = this._svgPoinKlein(k, ix, blo, bhi, C, 180); return P2 ? `<div class="rh-ps"><div class="rh-pst"><i style="display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:5px;background:${this._farbe(((b.a + b.b) / 2) / k.dauer)}"></i>${uhr(b.a)}–${uhr(b.b)}</div>${P2.svg}<div class="rh-psw">${fmt0(P2.n)} Paare · SD1 ${f1(P2.sd1)} · SD2 ${f1(P2.sd2)} ms</div></div>` : ''; }).join('');
    const s2 = `<div class="rh-zwei" style="grid-template-columns:1fr 1.15fr"><div><div class="rh-cap">Schlag zu Schlag · ganze Aufzeichnung · Farbe = Uhrzeit</div>${this._svgPoinZeit(k, C, 400)}
        ${fig(`Poincaré aller ${fmt0(k.n - 1)} Schlagpaare: jeder Abstand gegen den folgenden, eingefärbt nach Uhrzeit (Farbband). So wird sichtbar, ob sich die Wolke im Lauf der Aufzeichnung verschiebt oder verbreitert. Die Breite der Wolke beschreibt die Änderung von Schlag zu Schlag (SD1 ≈ RMSSD ÷ √2), die Länge langsamere Schwankungen.`)}</div>
      <div><div class="rh-cap">Je ${k.blk === 300 ? '5 Minuten' : 'Stunde'} · gleiche Achsen (${fmt0(blo)}–${fmt0(bhi)} ms)</div><div style="display:grid;grid-template-columns:repeat(${k.bloecke.length > 6 ? 4 : 3},minmax(0,1fr));gap:7px">${klein}</div>
        ${fig('Dieselben Schlagpaare je Zeitblock, in denselben Zeitfarben wie links, mit Ellipse (SD1 quer, SD2 längs, je ±2 SD). Gleiche Achsen in allen Feldern, damit Lage und Größe der Wolken direkt vergleichbar sind.')}</div></div>`;
    const s2b = `<div class="rh-zwei"><div><div class="rh-cap">Die fünf Minuten mit der niedrigsten Herzfrequenz · ${k.ruhe ? uhr(k.ruhe.a) + '–' + uhr(k.ruhe.b) + ' Uhr' : '–'}</div>
        ${T ? `<div class="rh-box" style="padding:6px">${T}</div>${fig('Abstand jedes Schlags zum vorigen in Millisekunden über diese fünf Minuten.')}` : ''}
        ${P ? `<div style="display:grid;grid-template-columns:330px 1fr;gap:12px;align-items:start"><div>${P.svg}</div>${fig(`Poincaré der ${fmt0(P.n)} Schlagpaare: jeder Abstand gegen den folgenden. Die Breite der Wolke beschreibt die Änderung von Schlag zu Schlag (SD1 ≈ RMSSD ÷ √2), die Länge langsamere Schwankungen. Die Aufzeichnung enthält nur Abstände zwischen Schlägen, keine Kurvenform.`)}</div>` : ''}</div>
      <div><div class="rh-box"><div class="rh-bt">Herkunft</div>
        <div class="rh-pv"><span>Pferd</span><b>${esc(h.name)}</b></div><div class="rh-pv"><span>Beginn</span><b>${new Date(k.t0).toLocaleString('de-DE')} (${Intl.DateTimeFormat().resolvedOptions().timeZone})</b></div><div class="rh-pv"><span>Sensor</span><b>${esc((r.source && r.source.sensor) || 'Polar H10')}, Brustgurt im Pferdegurt</b></div>
        <div class="rh-pv"><span>Weg</span><b>${r.rrQuelle === 'gurtspeicher' ? 'Speicher des Gurts (PSFTP), ausgelesen, aus der Datenbank bitgleich gegengelesen, danach im Gurt gelöscht. Bitgleich belegt die vollständige Übertragung, nicht die Messgenauigkeit.' : 'live'}</b></div>
        ${sp.kennung ? `<div class="rh-pv"><span>Kennung im Gurt</span><code>${esc(sp.kennung)}</code></div>` : ''}<div class="rh-pv"><span>Prüfwert</span><span>SHA-256 der RR-Reihe (ms, kommagetrennt): ${sha}</span></div>
        <div class="rh-pv"><span>Software</span><span>${esc(Stall.BERICHT_VERSION)} · ${esc((typeof RehaKern !== 'undefined' && RehaKern.VERSION) || '')} · erstellt ${new Date().toLocaleString('de-DE')}</span></div></div>
      <div class="rh-box"><div class="rh-bt">Methode und Grenzen</div><div class="rh-meth">
        <p><b>Kennwerte.</b> Herzfrequenz = 60.000 ÷ Abstand je Schlag. RMSSD nach Bereinigung mit der Equine-Filterkette, deren Rechenkette mit der CARLON-Equine-App identisch ist (Vergleichstest Export-Zertifikat 20.11.2026, 19/19). Sprünge über 20 % sind eine Sichthilfe; sie können Fehlerkennungen oder echte lange Abstände sein.</p>
        <p><b>Sensor.</b> Der Polar H10 stimmte am ruhenden Pferd und bei Bodenarbeit gut mit einem simultan aufgezeichneten EKG überein (Kapteijn et al. 2022, 28 Pferde); bei stärkerer Bewegung sind Abweichungen möglich.</p>
        <p><b>Grenzen.</b> Beschreibende Aufzeichnung für die Unterlagen der Praxis; kein Alarm- oder Überwachungssystem, kein Medizinprodukt, keine Aussage über den Gesundheitszustand. Fressen, Liegen, Bewegung und Aufregung verändern die Werte.</p></div></div>
      ${opt.anmerkung ? `<div class="rh-box"><div class="rh-bt">Anmerkung der Praxis</div><div class="rh-meth"><p>${esc(opt.anmerkung)}</p><p style="color:var(--dim)">${esc(State.settings.vetName || State.settings.clinicName || '')}</p></div></div>` : ''}</div></div>`;
    const s3 = opt.halter ? `<div class="rh-zwei"><div><div class="rh-box"><div class="rh-bt">Was aufgezeichnet wurde</div><div class="rh-meth" style="font-size:12px;line-height:1.55">
        <p>Ihr Pferd ${esc(h.name)} hat ${dauerTxt(k.dauer)} lang einen Brustgurt getragen. Der Gurt hat jeden Herzschlag mit seinem Abstand zum vorigen gespeichert, insgesamt ${fmt0(k.n)} Schläge, auch wenn die Funkverbindung kurz weg war.</p>
        <p>Das Herz hat in dieser Zeit meist zwischen ${fmt0(k.hf5)} und ${fmt0(k.hf95)} Mal pro Minute geschlagen, in der Mitte ${fmt0(k.hfMed)} Mal.${k.ruhe ? ` Am ruhigsten war es von ${uhr(k.ruhe.a)} bis ${uhr(k.ruhe.b)} Uhr.` : ''}</p>
        <p>Die Zahlen beschreiben nur, was der Gurt gemessen hat. Sie sagen nichts darüber, ob Ihr Pferd gesund oder krank ist. Was die Aufzeichnung für Ihr Pferd bedeutet, bespricht Ihre Praxis mit Ihnen.</p></div></div>
      <div class="rh-box"><div class="rh-bt">Herzschlag über die Aufzeichnung</div>${this._svgHF(k, C, 620, 170, null, null, ev)}</div></div>
      <div><div class="rh-box"><div class="rh-bt">Kurz erklärt</div><div class="rh-meth" style="font-size:11.5px;line-height:1.55">
        <p><b>Herzfrequenz:</b> wie oft das Herz pro Minute schlägt. Beim ruhenden Pferd sind Werte um 30 bis 40 üblich, beim Fressen oder bei Aufregung steigen sie.</p>
        <p><b>RMSSD:</b> wie stark sich die Abstände von Schlag zu Schlag ändern, in Millisekunden. Ein einzelner Wert sagt wenig; aussagekräftig ist der Vergleich mit früheren Messungen unter gleichen Bedingungen.</p>
        <p><b>Speicher des Gurts:</b> der Gurt merkt sich jeden Schlag selbst, darum fehlt nichts, wenn das Handy kurz außer Reichweite war.</p>
        <p><b>Prüfwert:</b> eine Kennziffer der Messreihe. Ändert sich auch nur ein Wert, ändert sich die Ziffer; so lässt sich die Datei jederzeit gegen diesen Bericht prüfen.</p></div></div>
      <div class="rh-box"><div class="rh-bt">Zu Hause weiter beobachten</div><div style="display:flex;gap:14px;align-items:center">${(() => { try { return `<div style="width:92px;flex:none;background:#fff;border-radius:8px;padding:4px">${QR.svg('https://vitalkultur.com/carlon-equine/app/messen.html', { hell: '#ffffff', dunkel: '#04303a' })}</div>`; } catch (_) { return ''; } })()}
        <div class="rh-meth" style="font-size:11.5px;line-height:1.55"><p>Mit der kostenlosen CARLON Messstation im Browser können Sie Ihr Pferd zu Hause in Ruhe messen, am besten immer zur gleichen Tageszeit und vor dem Füttern. Die Aufnahme können Sie an Ihre Praxis weitergeben.</p></div></div></div></div></div>` : null;
    return { seiten: s3 ? [s1, s2, s2b, s3] : [s1, s2, s2b], titel: s3 ? ['Langzeit-Aufzeichnung', 'Schlagfolge über die Zeit', 'Ruhigster Abschnitt · Herkunft', 'Für die Halterin'] : ['Langzeit-Aufzeichnung', 'Schlagfolge über die Zeit', 'Ruhigster Abschnitt · Herkunft'], kern };
  };
  /* Vor dem Druck: Anlass, Bedingungen je Pferd, Anmerkung der Praxis, Halterinnen-Blatt (alles freiwillig) */
  Stall.berichtDialog = function (recIds) { recIds = [].concat(recIds).filter(Boolean); const rs = recIds.map(id => State.recordings.find(x => x.id === id)).filter(Boolean); if (!rs.length) return;
    UI.modal(`<div class="modal-head"><h3>Langzeitbericht</h3><button class="closex" onclick="UI.closeModal()">${IC.x}</button></div><div class="modal-body">
      <div class="field"><label>Anlass (freiwillig, steht klein im Bericht)</label><input id="lzAnlass" placeholder="z. B. Kontrolle nach Futterumstellung"></div>
      ${rs.map(r => { const h = State.horses.find(x => x.id === r.horseId) || {}; return `<div class="field"><label>Bedingungen · ${esc(h.name || '')} (freiwillig)</label><input data-lzbed="${r.id}" placeholder="z. B. Box, Heu um 18 Uhr, ohne Bewegung seit Mittag"></div>`; }).join('')}
      <div class="field"><label>Anmerkung der Praxis (freiwillig)</label><textarea id="lzAnm" rows="2"></textarea></div>
      <label class="rep-chk"><input type="checkbox" id="lzHalter" checked> Seite für die Halterin in Alltagssprache beilegen</label></div>
      <div class="modal-foot"><button class="btn ghost" onclick="UI.closeModal()">Abbrechen</button><button class="btn primary" onclick="Stall._ausDialog(${JSON.stringify(recIds).replace(/"/g, '&quot;')})">Bericht erstellen</button></div>`); };
  Stall._ausDialog = function (ids) { const bed = {}; document.querySelectorAll('[data-lzbed]').forEach(i => { if (i.value.trim()) bed[i.dataset.lzbed] = i.value.trim(); });
    const opt = { anlass: (document.getElementById('lzAnlass') || {}).value || '', anmerkung: (document.getElementById('lzAnm') || {}).value || '', halter: !!(document.getElementById('lzHalter') || {}).checked, bedingungen: bed };
    UI.closeModal(); this.bericht(ids, opt); };
  Stall.bericht = async function (recIds, opt) {
    recIds = [].concat(recIds).filter(Boolean); if (!recIds.length) return; opt = Object.assign({}, typeof opt === 'string' ? {} : opt);
    Reha._C = Reha._CL; const dunkel = false, st = State.settings;          // Druck immer hell (Audit R1: dunkel kostet Kontrast und Toner)
    const praxis = esc(st.clinicName || 'Ihre Praxis'), zusatz = esc([st.clinicAddr, st.clinicWeb].filter(Boolean).join(' · '));
    const logo = st.logo ? `<img src="${st.logo}" style="width:74px;height:58px;object-fit:contain;border:1px solid var(--line);border-radius:8px;background:#fff">` : '';
    let abb = 0; const fig = t => `<div class="rh-fig" style="font-size:10.5px;color:var(--ink);opacity:.78"><b>Abbildung ${++abb}.</b> ${t}</div>`;
    const kpi = (l, w, e, f, u) => `<div class="rh-kpi"><span>${l}</span><b style="color:${f || 'var(--ink)'}">${w}</b><em>${e || ''}</em>${u ? `<div class="rh-ku">${u}</div>` : ''}</div>`;
    const alle = [], ueb = [];
    for (const id of recIds) { const r = State.recordings.find(x => x.id === id); if (!r) continue; const h = State.horses.find(x => x.id === r.horseId) || { name: 'Pferd' };
      const k = this._kennwerte(r), sx = this._seiten(h, r, k, kpi, fig, opt);
      sx.seiten.forEach((x, i) => alle.push(Reha._kopf(sx.titel[i], esc(h.name), new Date(k.t0).toLocaleDateString('de-DE') + (h.stable ? ' · ' + esc(h.stable) : '')) + x));
      ueb.push({ h, k, r, kern: sx.kern }); }
    if (ueb.length > 1) { const dt = s => { s = Math.round(s / 60); return Math.floor(s / 60) + ' h ' + String(s % 60).padStart(2, '0') + ' min'; };
      const zeile = u => `<tr><td><b>${esc(u.h.name)}</b></td><td>${new Date(u.k.t0).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr</td><td>${dt(u.k.dauer)}</td><td>${fmt0(u.k.n)}</td><td>${fmt0(u.k.hfMed)}</td><td>${u.k.ruhe ? fmt0(u.k.ruhe.hf) + (u.k.ruhe.rmssd != null ? ' · ' + Number(u.k.ruhe.rmssd).toFixed(1).replace('.', ',') + ' ms' : '') : '–'}</td><td>${esc((opt.bedingungen || {})[u.r.id] || '–')}</td></tr>`;
      const ber = [Math.floor(Math.min(...ueb.map(u => u.k.hf5)) / 5) * 5 - 10, Math.ceil(Math.max(...ueb.map(u => u.k.hf95)) / 5) * 5 + 10];
      alle.unshift(`${Reha._kopf('Stallrunde · Übersicht', ueb.length + ' Pferde', new Date(ueb[0].k.t0).toLocaleDateString('de-DE') + (ueb[0].h.stable ? ' · ' + esc(ueb[0].h.stable) : ''))}
        <div class="rh-kern">${ueb.length} Pferde, je ein Gurt mit Aufzeichnung im eigenen Speicher; alle Reihen bitgleich gegengelesen.${opt.anlass ? ' Anlass: ' + esc(opt.anlass) + '.' : ''} Je Pferd folgen zwei Seiten${opt.halter ? ' und eine Seite für die Halterin' : ''}.</div>
        <div class="rh-cap" style="margin-top:12px">Herzfrequenz je Pferd · gleiche Achse (${ber[0]}–${ber[1]} Schläge/min)</div><div style="display:grid;grid-template-columns:repeat(${Math.min(3, ueb.length)},minmax(0,1fr));gap:10px">${ueb.map(u => `<div class="rh-box" style="margin:0"><div class="rh-bt">${esc(u.h.name)}</div>${this._svgHF(u.k, Reha._C, 420, 160, ber, null, u.r.ereignisse)}</div>`).join('')}</div>
        <table class="rh-tab"><thead><tr><th>Pferd</th><th>Beginn</th><th>Dauer</th><th>Schläge</th><th>Herzfrequenz (Median)</th><th>Niedrigste 5 min · RMSSD</th><th>Bedingungen</th></tr></thead><tbody>${ueb.map(zeile).join('')}</tbody></table>`); }
    const fuss = (n, m) => `<div class="rh-fuss" style="font-size:10px;color:var(--ink);opacity:.72"><div>Aufgezeichnet mit CARLON Equine Visite (Polar H10, RR 1 ms, Speicher des Gurts). Beschreibende Aufzeichnung für die Unterlagen der Praxis. Kein Medizinprodukt, keine Aussage über den Gesundheitszustand.</div><div class="rh-fz"><span>${praxis}</span><span>Seite ${n} von ${m}</span></div></div>`;
    $('#printArea').innerHTML = Reha._stil(dunkel) + alle.map((x, i) => `<section class="rh-seite"><div class="rh-inh">${x}</div>${fuss(i + 1, alle.length)}</section>`).join('');
    const shaEl = [...document.querySelectorAll('#printArea .stSha')]; for (let i = 0; i < ueb.length; i++) { try { const sha = await Pruefwert.rr(ueb[i].r.rr); if (shaEl[i]) shaEl[i].textContent = sha || '–'; } catch (_) { } }
    Reha._einpassen();
    for (const u of ueb) { try { await Akte.notiere(u.h.id, 'Langzeit-Bericht', { text: u.kern, aufnahme: u.r.id }); } catch (_) { } }
    const alt = document.title; document.title = (ueb.length > 1 ? 'Stallrunde ' : ueb[0].h.name + ' · Langzeit ') + new Date(ueb[0].k.t0).toLocaleDateString('de-DE'); setTimeout(() => { window.print(); document.title = alt; }, 150);
  };
  global.Stall = Stall;
})(typeof window !== 'undefined' ? window : globalThis);
