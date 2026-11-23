/* VORFÜHRUNG REHA (23.11.2026, Jan: „wenn Swen auf die Demo geht … gleich Aquatrainer oder Laufband … muss begeistern“)
   Nur in der Demo. Spielt eine Beispieleinheit im Zeitraffer ab: Die Werte kommen sichtbar aus der Gerätesteuerung, die
   Herzfrequenz läuft mit, Stufen entstehen von selbst, sobald ein Wert 30 s steht (dieselbe Regel wie die echte Live-Anbindung
   in steuerung-live.js), am Ende das Ergebnis je Stufe. Berührt die echte Aufnahme nicht; alle Zahlen sind Beispielwerte. */
(function () {
  'use strict';
  const en = () => typeof Sprache !== 'undefined' && Sprache.cur === 'en';
  const E = (de, e) => en() ? e : de;
  const zahl = (v, d) => { const t = (+v).toFixed(d); return en() ? t : t.replace('.', ','); };
  const HALT = 30, TEMPO = 20;

  /* Ablauf je Gerät: [ab Sekunde, Werte der Steuerung, Ziel-Herzfrequenz, Name der Phase] */
  const ABLAUF = {
    aquatrainer: { name: ['Aquatrainer', 'Aqua trainer'], quelle: 'Siemens LOGO! 8.4 · MQTT', felder: ['speed', 'wasser', 'temp'], ruhe: 36, schritte: [
      [0, { speed: 0, wasser: 0, temp: 18.0 }, 36, ['Ruhe-Referenz', 'Resting reference']],
      [120, { speed: 0, wasser: 40, temp: 18.0 }, 40, ['Wasser läuft ein', 'Water filling']],
      [210, { speed: 4.5, wasser: 40, temp: 18.0 }, 62, ['Schritt, Karpus', 'Walk, carpus']],
      [540, { speed: 5.5, wasser: 40, temp: 18.0 }, 72, ['Schritt zügig, Karpus', 'Brisk walk, carpus']],
      [900, { speed: 5.5, wasser: 55, temp: 18.0 }, 80, ['Schritt zügig, Ellbogen', 'Brisk walk, elbow']],
      [1200, { speed: 3.5, wasser: 40, temp: 18.0 }, 58, ['Auslauf', 'Cool-down']],
      [1380, { speed: 0, wasser: 0, temp: 18.0 }, 42, ['Erholung', 'Recovery']]], ende: 1560 },
    laufband: { name: ['Laufband', 'Treadmill'], quelle: 'Siemens S7-1200 · Webserver', felder: ['speed', 'steigung'], ruhe: 34, schritte: [
      [0, { speed: 0, steigung: 0 }, 34, ['Ruhe-Referenz', 'Resting reference']],
      [180, { speed: 6.0, steigung: 0 }, 58, ['Schritt, eben', 'Walk, flat']],
      [480, { speed: 6.0, steigung: 4 }, 70, ['Schritt, 4 % Steigung', 'Walk, 4 % incline']],
      [780, { speed: 12.0, steigung: 0 }, 104, ['Trab, eben', 'Trot, flat']],
      [1020, { speed: 6.0, steigung: 0 }, 66, ['Schritt, Auslauf', 'Walk, cool-down']],
      [1260, { speed: 0, steigung: 0 }, 44, ['Erholung', 'Recovery']]], ende: 1440 },
    fuehranlage: { name: ['Führanlage', 'Horse walker'], quelle: E('Gateway · Bluetooth', 'Gateway · Bluetooth'), felder: ['speed', 'richtung'], ruhe: 35, schritte: [
      [0, { speed: 0, richtung: 1 }, 35, ['Ruhe-Referenz', 'Resting reference']],
      [180, { speed: 5.5, richtung: 1 }, 56, ['Schritt, rechte Hand', 'Walk, right rein']],
      [600, { speed: 5.5, richtung: -1 }, 57, ['Schritt, linke Hand', 'Walk, left rein']],
      [1020, { speed: 9.5, richtung: -1 }, 88, ['Trab, linke Hand', 'Trot, left rein']],
      [1200, { speed: 5.0, richtung: 1 }, 60, ['Schritt, Auslauf', 'Walk, cool-down']],
      [1380, { speed: 0, richtung: 1 }, 43, ['Erholung', 'Recovery']]], ende: 1560 }
  };
  /* So sieht die Nachricht der Steuerung wirklich aus (Formate wie in steuerung-live.js geprüft) */
  const ROH = {
    aquatrainer: w => `{"state":{"reported":{"Tempo":{"desc":"VM0","value":[${Math.round(w.speed * 10)}]},"Wasser":{"desc":"VM2","value":[${w.wasser}]}}}}`,
    laufband: w => `PlcProgram.Read "DB_Band".Tempo → ${w.speed.toFixed(1)} · .Steigung → ${w.steigung.toFixed(1)}`,
    fuehranlage: w => `speed_kmh=${w.speed.toFixed(1)};direction=${w.richtung}`
  };
  const SYMBOL = {
    aquatrainer: '<svg viewBox="0 0 64 40" width="64" height="40" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="8" width="56" height="26" rx="4"/><path d="M6 22c5-3 9 3 14 0s9 3 14 0 9 3 14 0 8 2 10 1" opacity=".8"/><path d="M8 30h48" stroke-dasharray="3 3"/></svg>',
    laufband: '<svg viewBox="0 0 64 40" width="64" height="40" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 30 L58 22"/><circle cx="10" cy="31" r="3"/><circle cx="54" cy="24" r="3"/><path d="M14 26 L52 20" stroke-dasharray="3 3"/><path d="M50 8v12M50 8h6"/></svg>',
    fuehranlage: '<svg viewBox="0 0 64 40" width="64" height="40" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="32" cy="22" rx="24" ry="14"/><path d="M32 8v28M8 22h48" opacity=".6"/><path d="M50 12l5 2-3 4"/></svg>'
  };
  /* Beispiel: Puls derselben Stufe eine Woche vorher (für die Gegenüberstellung) */
  const VORWOCHE = { aquatrainer: [0, 0, 3, 4, 4, 2, 2], laufband: [0, 3, 4, 5, 3, 2], fuehranlage: [0, 2, 2, 4, 2, 2] };
  const FELD = {
    speed: { de: 'Tempo', en: 'Speed', f: v => typeof Einh !== 'undefined' ? Einh.kmh(v) : zahl(v, 1) + ' km/h' },
    wasser: { de: 'Wasserhöhe', en: 'Water depth', f: v => v ? (typeof Einh !== 'undefined' ? Einh.cm(v) : v + ' cm') + (v >= 50 ? E(' · Ellbogen', ' · elbow') : E(' · Karpus', ' · carpus')) : E('leer', 'empty') },
    temp: { de: 'Wassertemperatur', en: 'Water temp.', f: v => typeof Einh !== 'undefined' ? Einh.c(v) : zahl(v, 1) + ' °C' },
    steigung: { de: 'Steigung', en: 'Incline', f: v => zahl(v, 1) + ' %' },
    richtung: { de: 'Richtung', en: 'Direction', f: v => v > 0 ? E('rechte Hand', 'right rein') : E('linke Hand', 'left rein') }
  };

  const CSS = `
.vf-bg{position:fixed;inset:0;z-index:150;background:rgba(0,2,6,.86);backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;padding:max(12px,env(safe-area-inset-top)) 12px max(12px,env(safe-area-inset-bottom))}
.vf{width:min(1180px,100%);max-height:100%;overflow:auto;background:linear-gradient(160deg,rgba(26,26,30,.96),rgba(18,18,22,.96));border:1px solid var(--border-strong);border-radius:22px;padding:clamp(16px,2.4vw,28px);color:var(--text-primary)}
.vf-k{display:flex;align-items:flex-start;gap:14px;justify-content:space-between;flex-wrap:wrap;margin-bottom:16px}
.vf-k h2{font-family:var(--font-brand);font-size:clamp(20px,2.4vw,28px);font-weight:600;margin:4px 0 0}
.vf-k .eyebrow{color:var(--cyan)}
.vf-x{background:transparent;border:1px solid var(--border);color:var(--text-secondary);border-radius:12px;padding:8px 14px;font:inherit;cursor:pointer}
.vf-wahl{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-top:8px}
@media(max-width:720px){.vf-wahl{grid-template-columns:1fr}}
.vf-g{text-align:left;background:rgba(255,255,255,.02);border:1px solid var(--border);border-radius:18px;padding:20px;color:inherit;font:inherit;cursor:pointer;transition:all .15s;display:grid;gap:8px}
.vf-g:hover,.vf-g:focus-visible{border-color:var(--cyan);background:var(--cyan-g3,rgba(0,200,180,.08));transform:translateY(-2px)}
.vf-g b{font-size:19px;font-family:var(--font-brand)} .vf-g span{color:var(--text-secondary);font-size:13.5px;line-height:1.5}
.vf-g i{font-style:normal;color:var(--cyan);font-size:13px;font-weight:600}
.vf-grid{display:grid;grid-template-columns:minmax(240px,320px) 1fr;gap:16px}
@media(max-width:820px){.vf-grid{grid-template-columns:1fr}}
.vf-box{background:rgba(255,255,255,.025);border:1px solid var(--border-faint);border-radius:16px;padding:16px}
.vf-quelle{display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--text-secondary);margin-bottom:12px}
.vf-punkt{width:9px;height:9px;border-radius:50%;background:var(--good);box-shadow:0 0 0 0 var(--good);animation:vfPuls 1.4s infinite}
@keyframes vfPuls{0%{box-shadow:0 0 0 0 rgba(63,224,164,.6)}70%{box-shadow:0 0 0 8px rgba(63,224,164,0)}100%{box-shadow:0 0 0 0 rgba(63,224,164,0)}}
.vf-wert{display:flex;justify-content:space-between;align-items:baseline;padding:10px 0;border-top:1px solid var(--border-faint);gap:10px}
.vf-wert span{color:var(--text-secondary);font-size:13px} .vf-wert b{font-size:20px;font-variant-numeric:tabular-nums;white-space:nowrap;transition:color .3s}
.vf-wert b.neu{color:var(--cyan)}
.vf-hf{display:flex;align-items:baseline;gap:10px;margin-bottom:6px;flex-wrap:wrap}
.vf-hf b{font-size:clamp(40px,6vw,64px);font-family:var(--font-brand);font-weight:600;line-height:1;font-variant-numeric:tabular-nums}
.vf-hf span{color:var(--text-secondary);font-size:14px}
.vf-uhr{margin-left:auto;font-variant-numeric:tabular-nums;color:var(--text-secondary);font-size:14px}
.vf-svg{width:100%;height:auto;display:block}
.vf-stufen{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;min-height:34px}
.vf-chip{border:1px solid var(--cyan-deep,rgba(0,200,180,.4));background:var(--cyan-g3,rgba(0,200,180,.08));color:var(--text-primary);border-radius:999px;padding:6px 12px;font-size:12.5px;animation:vfEin .5s ease}
.vf-chip.ruhe{border-color:var(--border);background:transparent;color:var(--text-secondary)}
@keyframes vfEin{from{opacity:0;transform:translateY(6px) scale(.96)}to{opacity:1;transform:none}}
.vf-log{margin-top:12px;font-size:12px;color:var(--text-dim);display:grid;gap:4px;max-height:96px;overflow:hidden}
.vf-roh{margin-top:12px;border-top:1px solid var(--border-faint);padding-top:10px}
.vf-roh small{display:block;color:var(--text-dim);font-size:11px;margin-bottom:5px;letter-spacing:.04em;text-transform:uppercase}
.vf-roh code{display:block;font-family:var(--font-mono,ui-monospace,monospace);font-size:11px;line-height:1.5;color:var(--cyan);background:rgba(0,0,0,.35);border:1px solid var(--border-faint);border-radius:8px;padding:8px 10px;word-break:break-all;transition:background .4s}
.vf-roh code.neu{background:rgba(0,200,180,.16)}
.vf-g .vf-sym{color:var(--cyan);opacity:.9}
.vf-besser{color:var(--good);font-weight:600}
.vf-wert-k{margin:10px 0 0;padding:12px 14px;border-radius:12px;background:rgba(63,224,164,.07);border:1px solid rgba(63,224,164,.25);font-size:13.5px;line-height:1.55}
.vf-log div{animation:vfEin .4s ease}
.vf-fuss{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:16px}
.vf-fuss .hinweis{color:var(--text-dim);font-size:12px;margin-left:auto;max-width:520px;line-height:1.5}
.vf-erg{width:100%;border-collapse:collapse;font-size:13.5px;margin-top:6px}
.vf-erg th,.vf-erg td{text-align:left;padding:8px 6px;border-top:1px solid var(--border-faint)} .vf-erg th{color:var(--text-dim);font-weight:500;font-size:12px}
.vf-erg td:nth-child(n+3),.vf-erg th:nth-child(n+3){text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
@media(max-width:640px){.vf-erg td:nth-child(2),.vf-erg th:nth-child(2){display:none}}
`;

  const V = {
    _t: null,
    stil() { if (document.getElementById('vfStil')) return; const s = document.createElement('style'); s.id = 'vfStil'; s.textContent = CSS; document.head.appendChild(s); },
    huelle(inhalt) { this.stil(); this.zu(true); const bg = document.createElement('div'); bg.className = 'vf-bg'; bg.id = 'vfBg';
      bg.innerHTML = `<div class="vf" role="dialog" aria-modal="true" aria-label="${E('Vorführung Reha', 'Rehab demonstration')}">${inhalt}</div>`;
      bg.addEventListener('click', e => { if (e.target === bg) this.zu(); }); document.body.appendChild(bg);
      this._esc = e => { if (e.key === 'Escape') this.zu(); }; document.addEventListener('keydown', this._esc); },
    zu(still) { clearInterval(this._t); this._t = null; const b = document.getElementById('vfBg'); if (b) b.remove(); if (this._esc) document.removeEventListener('keydown', this._esc); this._esc = null; },
    /* Einstieg: Gerät wählen */
    wahl() {
      const k = (id, txt) => `<button class="vf-g" onclick="Vorfuehrung.start('${id}')"><span class="vf-sym">${SYMBOL[id]}</span><b>${E(ABLAUF[id].name[0], ABLAUF[id].name[1])}</b><span>${txt}</span><i>${E('Einheit ansehen ▸', 'Watch a session ▸')}</i></button>`;
      this.huelle(`<div class="vf-k"><div><span class="eyebrow">${E('Reha-Demo · Beispieleinheit im Zeitraffer', 'Rehab demo · example session in time-lapse')}</span>
        <h2>${E('An welchem Gerät trainieren Ihre Pferde?', 'Which equipment do your horses train on?')}</h2></div>
        <button class="vf-x" onclick="Vorfuehrung.zu()">${E('Zur Akte', 'To the record')}</button></div>
        <p style="color:var(--text-secondary);max-width:760px;line-height:1.6;margin:0 0 16px">${E('Sie sehen eine Einheit, wie sie in Visite abläuft: Die Werte kommen aus der Steuerung des Geräts, der Polar H10 liefert die Herzfrequenz, und die Stufen legen sich von selbst an. Danach steht das Ergebnis je Stufe für den Bericht bereit.', 'You see a session as it runs in Visite: the values come from the equipment controller, the Polar H10 delivers heart rate, and the stages create themselves. Afterwards the result per stage is ready for the report.')}</p>
        <div class="vf-wahl">${k('aquatrainer', E('Tempo, Wasserhöhe und Wassertemperatur aus der Steuerung', 'Speed, water depth and water temperature from the controller'))}${k('laufband', E('Tempo und Steigung aus der Steuerung', 'Speed and incline from the controller'))}${k('fuehranlage', E('Tempo und Richtungswechsel aus der Anlage', 'Speed and direction changes from the walker'))}</div>
        <p style="color:var(--text-dim);font-size:12px;margin:14px 0 0">${E('Beispielwerte. Ihre eigene Steuerungsdatei können Sie auf der Prüfseite testen: vitalkultur.com/carlon-equine-visite/geraetedatei/', 'Example values. You can test your own controller file on the check page: vitalkultur.com/carlon-equine-visite/geraetedatei/')}</p>`);
    },
    /* Herzfrequenz-Verlauf vorab berechnen (Sekundenraster), damit Zeitraffer und Ergebnis dieselben Zahlen zeigen */
    rechnen(A) { const hf = []; let h = A.ruhe, x = 7;
      for (let s = 0; s <= A.ende; s++) { const p = this.phase(A, s); const ziel = p[2], tau = ziel > h ? 45 : 70; h += (ziel - h) / tau;
        x = (x * 16807) % 2147483647; const r = (x / 2147483647 - 0.5); hf.push(Math.max(28, h + r * (2 + h * 0.03))); }
      return hf; },
    phase(A, s) { let p = A.schritte[0]; for (const q of A.schritte) if (s >= q[0]) p = q; return p; },
    start(art) {
      const A = ABLAUF[art]; if (!A) return; this.zu(); const hf = this.rechnen(A);
      const h = (typeof State !== 'undefined' && State.horses.find(x => /^comet$/i.test(x.name || ''))) || { name: 'Comet' };
      const werte = A.felder.map(f => `<div class="vf-wert"><span>${E(FELD[f].de, FELD[f].en)}</span><b id="vfW_${f}">–</b></div>`).join('');
      this.huelle(`<div class="vf-k"><div><span class="eyebrow">${E('Reha-Einheit · Beispiel im Zeitraffer', 'Rehab session · example in time-lapse')} · ${h.name}</span>
          <h2>${E(A.name[0], A.name[1])}: ${E('Werte direkt aus der Steuerung', 'values straight from the controller')}</h2></div>
          <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="vf-x" onclick="Vorfuehrung.wahl()">${E('Anderes Gerät', 'Other equipment')}</button><button class="vf-x" onclick="Vorfuehrung.zu()">${E('Schließen', 'Close')}</button></div></div>
        <div class="vf-grid">
          <div class="vf-box"><div class="vf-quelle"><span class="vf-punkt"></span><span>${E('Steuerung verbunden · nur lesend', 'Controller connected · read only')}<br><small style="color:var(--text-dim)">${A.quelle}</small></span></div>
            ${werte}<div class="vf-roh"><small>${E('Nachricht der Steuerung', 'Controller message')}</small><code id="vfRoh">–</code></div><div class="vf-log" id="vfLog"></div></div>
          <div class="vf-box"><div class="vf-hf"><b id="vfHf">–</b><span>${E('Schläge/min · Polar H10', 'bpm · Polar H10')}</span><span class="vf-uhr" id="vfUhr">00:00</span></div>
            <svg class="vf-svg" id="vfSvg" viewBox="0 0 700 220" role="img" aria-label="${E('Herzfrequenz im Verlauf der Einheit', 'Heart rate over the session')}"></svg>
            <div class="vf-stufen" id="vfStufen"></div></div>
        </div>
        <div class="vf-fuss" id="vfFuss"><button class="btn ghost" id="vfPause" onclick="Vorfuehrung.pause()">${E('Anhalten', 'Pause')}</button>
          <span class="hinweis">${E('Zeitraffer 20-fach mit Beispielwerten. Eine Stufe entsteht, sobald die Werte der Steuerung 30 Sekunden stehen; ohne Anbindung tippt das Team die Stufe mit einem Fingertipp.', '20× time-lapse with example values. A stage is created once the controller values hold for 30 seconds; without a connection the team taps the stage with one touch.')}</span></div>`);
      this.lauf = { A, hf, s: 0, art, stufen: [], stand: null, seit: 0, gemeldet: null, pause: false }; this.regel(this.lauf);
      this.zeichnen(true);
      this._t = setInterval(() => this.tick(), 1000 / TEMPO * 4);   // je Takt 4 Sekunden Einheit
    },
    pause() { const L = this.lauf; if (!L) return; L.pause = !L.pause; const b = document.getElementById('vfPause'); if (b) b.textContent = L.pause ? E('Weiter', 'Resume') : E('Anhalten', 'Pause'); },
    tick() { const L = this.lauf; if (!L || L.pause) return; if (!document.getElementById('vfBg')) { this.zu(); return; }
      for (let i = 0; i < 4 && L.s < L.A.ende; i++) { L.s++; this.regel(L); }
      this.zeichnen(); if (L.s >= L.A.ende) { clearInterval(this._t); this._t = null; this.ergebnis(); } },
    /* Dieselbe Regel wie die Live-Anbindung: Werte 30 s stabil → Stufe ab dem Zeitpunkt der Änderung */
    regel(L) { const w = this.phase(L.A, L.s)[1], key = JSON.stringify(w);
      if (key !== L.stand) { if (L.stand !== null) this.log(L, w); L.stand = key; L.seit = L.s; }
      if (L.s - L.seit === HALT && L.gemeldet !== key) { L.gemeldet = key; const p = this.phase(L.A, L.s);
        L.stufen.push({ ab: L.seit, w, name: p[3], ruhe: !w.speed }); this.chip(L, L.stufen[L.stufen.length - 1]); } },
    log(L, w) { const el = document.getElementById('vfLog'); if (!el) return; const alt = L.stand ? JSON.parse(L.stand) : {};
      const teile = L.A.felder.filter(f => alt[f] !== w[f]).map(f => `${E(FELD[f].de, FELD[f].en)} ${FELD[f].f(w[f])}`);
      const roh = document.getElementById('vfRoh'); if (roh) { roh.textContent = ROH[L.art](w); roh.classList.add('neu'); setTimeout(() => roh.classList.remove('neu'), 1200); }
      if (!teile.length) return; const d = document.createElement('div'); d.textContent = this.mmss(L.s) + ' · ' + teile.join(' · '); el.prepend(d); while (el.children.length > 5) el.lastChild.remove(); },
    chip(L, st) { const el = document.getElementById('vfStufen'); if (!el) return; const n = L.stufen.filter(x => !x.ruhe).length;
      const c = document.createElement('span'); c.className = 'vf-chip' + (st.ruhe ? ' ruhe' : '');
      c.textContent = (st.ruhe ? '' : E('Stufe ', 'Stage ') + n + ' · ') + E(st.name[0], st.name[1]) + ' · ' + E('ab ', 'from ') + this.mmss(st.ab); el.appendChild(c); },
    mmss(s) { s = Math.round(s); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); },
    zeichnen(neu) { const L = this.lauf; if (!L) return; const w = this.phase(L.A, L.s)[1];
      for (const f of L.A.felder) { const el = document.getElementById('vfW_' + f); if (!el) continue; const t = FELD[f].f(w[f]); if (el.textContent !== t) { el.textContent = t; if (!neu) { el.classList.add('neu'); setTimeout(() => el.classList.remove('neu'), 1600); } } }
      const roh = document.getElementById('vfRoh'); if (roh && roh.textContent === '–') roh.textContent = ROH[L.art](w);
      const hf = document.getElementById('vfHf'); if (hf) hf.textContent = Math.round(L.hf[L.s]); const u = document.getElementById('vfUhr'); if (u) u.textContent = this.mmss(L.s) + ' / ' + this.mmss(L.A.ende);
      const svg = document.getElementById('vfSvg'); if (!svg) return; const W = 700, H = 220, l = 34, r = 8, o = 10, un = 22;
      const max = Math.max(...L.hf) + 8, min = Math.min(...L.hf) - 6, X = s => l + (W - l - r) * s / L.A.ende, Y = v => o + (H - o - un) * (1 - (v - min) / (max - min));
      let g = ''; for (const v of [40, 60, 80, 100, 120]) if (v > min && v < max) g += `<line x1="${l}" x2="${W - r}" y1="${Y(v)}" y2="${Y(v)}" stroke="currentColor" opacity=".08"/><text x="${l - 6}" y="${Y(v) + 4}" font-size="11" text-anchor="end" fill="currentColor" opacity=".45">${v}</text>`;
      L.stufen.forEach((st, i) => { const bis = (L.stufen[i + 1] || {}).ab != null ? L.stufen[i + 1].ab : L.s; if (st.ruhe) return;
        g += `<rect x="${X(st.ab)}" y="${o}" width="${Math.max(0, X(bis) - X(st.ab))}" height="${H - o - un}" fill="var(--cyan)" opacity="${i % 2 ? .07 : .12}"/>`; });
      const pts = []; for (let s = 0; s <= L.s; s += 4) pts.push(X(s).toFixed(1) + ',' + Y(L.hf[s]).toFixed(1));
      g += `<polyline points="${pts.join(' ')}" fill="none" stroke="var(--cyan)" stroke-width="2.2" stroke-linejoin="round"/>`;
      if (L.s > 0) g += `<circle cx="${X(L.s)}" cy="${Y(L.hf[L.s])}" r="4.5" fill="var(--cyan)"/>`;
      for (let m = 0; m <= L.A.ende; m += 300) g += `<text x="${X(m)}" y="${H - 5}" font-size="11" text-anchor="middle" fill="currentColor" opacity=".45">${m / 60} min</text>`;
      svg.innerHTML = g; },
    ergebnis() { const L = this.lauf, el = document.getElementById('vfFuss'); if (!el) return;
      const mittel = (a, b) => { const s = L.hf.slice(Math.max(a, b - 60), b); return s.reduce((x, y) => x + y, 0) / s.length; };
      const vw = VORWOCHE[L.art] || []; let summe = 0, nStufe = 0;
      const zeilen = L.stufen.map((st, i) => { const bis = (L.stufen[i + 1] || { ab: L.A.ende }).ab, heute = Math.round(mittel(st.ab, bis)), vor = heute + (vw[i] || 0);
        if (!st.ruhe && vw[i]) { summe += vw[i]; nStufe++; }
        return `<tr><td>${st.ruhe ? '' : E('Stufe ', 'Stage ') + L.stufen.slice(0, i + 1).filter(x => !x.ruhe).length + ' · '}${E(st.name[0], st.name[1])}</td><td>${L.A.felder.filter(f => f !== 'temp').map(f => FELD[f].f(st.w[f])).join(' · ')}</td><td>${this.mmss(bis - st.ab)}</td><td>${st.ruhe ? '' : vor + ' ' + E('/min', 'bpm')}</td><td>${heute} ${E('/min', 'bpm')}${!st.ruhe && vw[i] ? ` <span class="vf-besser">−${vw[i]}</span>` : ''}</td></tr>`; }).join('');
      const kern = nStufe ? E(`Bei gleicher Einstellung aus der Steuerung liegt der Puls in ${nStufe} Stufen im Mittel ${zahl(summe / nStufe, 1)} Schläge/min unter der Vorwoche. Genau diese Gegenüberstellung macht den Trainingsfortschritt am Gerät für Tierarzt und Halterin sichtbar.`, `At the same controller setting, heart rate in ${nStufe} stages is on average ${zahl(summe / nStufe, 1)} bpm below the previous week. Exactly this comparison makes training progress on the equipment visible to vet and owner.`) : '';
      const hier = (typeof State !== 'undefined' && State.horses.find(x => /^comet$/i.test(x.name || ''))) || null;
      const box = document.createElement('div'); box.className = 'vf-box'; box.style.marginTop = '16px';
      box.innerHTML = `<span class="eyebrow" style="color:var(--good)">${E('Einheit fertig · Ergebnis je Stufe', 'Session complete · result per stage')}</span>
        <table class="vf-erg"><thead><tr><th>${E('Stufe', 'Stage')}</th><th>${E('Einstellung aus der Steuerung', 'Setting from the controller')}</th><th>${E('Dauer', 'Duration')}</th><th>${E('Vorwoche', 'Prev. week')}</th><th>${E('Heute, letzte 60 s', 'Today, last 60 s')}</th></tr></thead><tbody>${zeilen}</tbody></table>
        ${kern ? `<div class="vf-wert-k">${kern}</div>` : ''}
        <p style="color:var(--text-secondary);font-size:13px;line-height:1.6;margin:12px 0 0">${E('Daraus entstehen der Sitzungsbericht mit dem Briefkopf des Betriebs und der Verlauf über Wochen: derselbe Puls bei gleicher Einstellung, Woche für Woche. Kein Mittippen, keine Zettel.', 'This produces the session report with the practice letterhead and the trend over weeks: the same heart rate at the same setting, week by week. No manual entry, no paper notes.')}</p>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px">${hier && L.art === 'aquatrainer' ? `<button class="btn primary" onclick="Vorfuehrung.bericht()">${E('Sitzungsbericht ansehen', 'View session report')}</button><button class="btn ghost" onclick="Vorfuehrung.zu();Vorfuehrung.zurAkte()">${E('Verlauf über 8 Wochen ansehen', 'See the 8-week trend')}</button>` : ''}
          <button class="btn ${hier && L.art === 'aquatrainer' ? 'ghost' : 'primary'}" onclick="Vorfuehrung.start('${L.art}')">${E('Noch einmal', 'Play again')}</button>
          <button class="btn ghost" onclick="Vorfuehrung.wahl()">${E('Anderes Gerät', 'Other equipment')}</button>
          <a class="btn ghost" href="/carlon-equine-visite/geraetedatei/" target="_blank" rel="noopener">${E('Eigene Steuerungsdatei prüfen', 'Check your own controller file')}</a></div>`;
      el.replaceWith(box); },
    bericht() { try { const h = State.horses.find(x => /^comet$/i.test(x.name || '')); const S = Reha.sitzungen(h.id).slice().sort((x, y) => new Date(y.rec.startedAt) - new Date(x.rec.startedAt)); const l = S[0];
        this.zu(); Reha.drucken(h.id, l.rec.id, 'klinik'); } catch (e) { this.zu(); this.zurAkte(); } },
    zurAkte() { try { const h = State.horses.find(x => /^comet$/i.test(x.name || '')); if (h && typeof Views !== 'undefined') Views.openHorse(h.id);
        setTimeout(() => { const f = document.getElementById('rehaAkte'); if (f) { f.scrollIntoView({ block: 'start' }); window.scrollBy(0, -78); } }, 700); } catch (_) {} },
    /* Demo mit &fokus=reha: Auswahl kommt von selbst (einmal je Aufruf), &geraet=… startet direkt */
    auto() { try { const p = new URLSearchParams(location.search); if (p.get('fokus') !== 'reha' || p.has('nur') || p.get('vf') === '0' || !(State.settings || {}).isDemo) return;
        const g = p.get('geraet'); if (g && ABLAUF[g]) this.start(g); else this.wahl(); } catch (_) {} }
  };
  window.Vorfuehrung = V;
})();
