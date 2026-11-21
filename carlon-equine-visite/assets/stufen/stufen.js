/* STUFEN-BAUSTEIN (21.11.2026): EINE Quelle für die fünf Visite-Stufen – Vergleichstabelle und Stufen-Rechner
   auf Visite- und Reha-Seite, Deutsch und Englisch. Preise und Grenzen stehen NUR hier (und in AGB/Kasse);
   wer eine Zahl ändert, ändert sie für alle Seiten zugleich.
   Einbau:  <div data-stufen="wegweiser" data-seite="visite"></div>  (fünf Kacheln: für wen, Preis, Sprung zum Angebot)
            <div data-stufen="tabelle" data-seite="visite|reha"></div>
            <div data-stufen="rechner" data-seite="visite|reha" data-start="tour|reha" id="umlegen"></div>
            <script src="/carlon-equine-visite/assets/stufen/stufen.js?v=1" defer></script>
   Sprache aus <html lang>. Weitere Sprachen: Block in T ergänzen (Sprachmotor kann ihn übersetzen). */
(function () {
  const ST = [
    { k: 'fahrpraxis', kasse: 'praxis', p: 149, ger: 2, reha: 0, tour: 1, station: 0 },
    { k: 'praxis', kasse: 'klinik', p: 349, ger: 6, reha: 0, tour: 1, station: 1 },
    { k: 'reha', kasse: 'reha', p: 349, ger: 6, reha: 20, tour: 0, station: 0 },
    { k: 'kombi', kasse: 'kombi', p: 590, ger: 8, reha: 40, tour: 1, station: 1 },
    { k: 'center', kasse: 'center', p: 890, ger: Infinity, reha: Infinity, tour: 1, station: 1, audit: 1 }
  ];
  const T = {
    de: {
      name: { fahrpraxis: 'Fahrpraxis', praxis: 'Praxis & Klinik', reha: 'Reha', kombi: 'Klinik + Reha', center: 'Equine Center' },
      fuer: { fahrpraxis: 'Mobile Tierärztin, mobiler Tierarzt', praxis: 'Praxis oder Klinik mit Station', reha: 'Reha-Zentrum ohne eigene Station', kombi: 'Klinik mit Station und Reha-Bereich', center: 'Großes Zentrum, mehrere Bereiche' },
      wwT: 'Fünf Stufen. Welche passt zu Ihnen?', wwRehaSeite: 'Reha-Seite', ab: 'ab ',
      stufe: 'Stufe', fuerWen: 'Für wen', preis: 'Preis netto im Monat', proStandort: ' je Standort', geraete: 'Geräte (Rechner, Tablets, Telefone)', rehaPf: 'Reha-Pferde in 30 Tagen',
      ohne: 'ohne Grenze', zum: 'Zum Angebot', zumKurz: 'Angebot →', tabAria: 'Alle fünf Stufen im Vergleich',
      zeilen: [['Akte, Mess-Link, Messwertbericht mit Ihrem Briefkopf', [1, 1, 1, 1, 1]], ['Stallrunde und Langzeit im Gurt', [1, 1, 1, 1, 1]], ['Team-Ordner mit täglicher Sicherung', [1, 1, 1, 1, 1]], ['Export JSON, CSV, Kubios, FHIR R5', [1, 1, 1, 1, 1]], ['Tourenplanung mit Maps-Übergabe, Wegegeld', [1, 1, 0, 1, 1]], ['Stationswand und Nachsorge', [0, 1, 0, 1, 1]], ['Reha-Aufnahme, Sitzungsbericht, Verlauf', [0, 0, 1, 1, 1]], ['Audit-Mappe und Gerätebuch zum Geräteeinsatz', [0, 0, 0, 0, 1]], ['Rückbericht an Überweiser, Forschungs-Export', [0, 0, 0, 0, 1]]],
      rTitel: 'Welche Stufe passt zu Ihrem Betrieb?', rLead: 'Wählen Sie, was Sie nutzen. Der Rechner nimmt die günstigste Stufe, die das hergibt, und zeigt, wo die nächste beginnt.',
      nutzen: 'Was Sie nutzen', tour: 'Tourenplanung', station: 'Stationswand über Nacht', rehaE: 'Reha-Einheiten am Gerät',
      gerL: 'Geräte mit Cockpit', gerMehr: 'mehr als 8', pfL: 'Reha-Pferde in 30 Tagen', eL: 'Einheiten je Pferd und Woche', bL: 'Ihr Betrag für den Sitzungsbericht je Einheit',
      passt: 'Passende Stufe', imMonat: 'netto im Monat', weil: 'Warum diese Stufe', test: '14 Tage testen', zumAng: 'Zum Angebot',
      grundBasis: 'Kleinste Stufe für Ihre Auswahl', grundGer: n => `${n} Geräte`, grundPf: n => `${n} Reha-Pferde in 30 Tagen`, grundTour: 'Tourenplanung', grundStation: 'Stationswand',
      naechste: (was, s, p) => `Nächster Sprung: ${was} → ${s} für ${p} im Monat.`, abPf: n => `ab ${n} Reha-Pferden`, abGer: n => `ab ${n} Geräten`, keinSprung: 'Darüber gibt es keine Grenze mehr.',
      einh: 'Einheiten im Monat', jeEinh: 'Lizenz je Einheit', einn: 'Einnahmen aus dem Bericht', erg: 'Ergebnis im Monat',
      traegt: (np, E) => `Die Lizenz ist ab ${np} Reha-Pferd${np === 1 ? '' : 'en'} mit ${E} Einheit${E === 1 ? '' : 'en'} je Woche getragen.`, traegtNie: 'Mit diesem Betrag trägt der Bericht die Lizenz in keiner Stufe; ohne eigenen Betrag gehört er zu Ihrem Reha-Paket.',
      grafikT: 'Lizenz und Einnahmen nach Zahl der Reha-Pferde', grafikTG: 'Lizenz nach Zahl der Geräte', lizenz: 'Lizenz (Stufen)', einnahmen: 'Einnahmen aus dem Bericht', pferde: 'Reha-Pferde in 30 Tagen', geraeteAchse: 'Geräte',
      fuss: 'Preise netto. Grenzen je Stufe wie in der Tabelle; über einer Grenze wechseln Sie unter „Abo verwalten“ selbst in die nächste Stufe.',
      fussReha: 'Beispielrechnung ohne Sensoren (einmalig, Fachhandel). Ob und wie Sie den Bericht berechnen, entscheiden Sie; für tierärztliche Leistungen gelten die Gebührenregeln Ihres Landes.',
      eu: v => v.toLocaleString('de-DE', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 }) + ' €', zahl: v => v.toLocaleString('de-DE')
    },
    en: {
      name: { fahrpraxis: 'Mobile practice', praxis: 'Practice & clinic', reha: 'Rehab', kombi: 'Clinic + rehab', center: 'Equine Center' },
      fuer: { fahrpraxis: 'Ambulatory vet', praxis: 'Practice or clinic with a ward', reha: 'Rehab centre without a ward', kombi: 'Clinic with a ward and a rehab unit', center: 'Large centre, several units' },
      wwT: 'Five tiers. Which one fits you?', wwRehaSeite: 'Rehab page', ab: 'from ',
      stufe: 'Tier', fuerWen: 'For', preis: 'Price per month, excl. VAT', proStandort: ' per site', geraete: 'Devices (computers, tablets, phones)', rehaPf: 'Rehab horses in 30 days',
      ohne: 'no limit', zum: 'View offer', zumKurz: 'Offer →', tabAria: 'All five tiers compared',
      zeilen: [['Records, measurement link, measurement report on your letterhead', [1, 1, 1, 1, 1]], ['Yard round and long-term recording in the strap', [1, 1, 1, 1, 1]], ['Team folder with daily backup', [1, 1, 1, 1, 1]], ['Export JSON, CSV, Kubios, FHIR R5', [1, 1, 1, 1, 1]], ['Tour planning with Maps hand-off, mileage', [1, 1, 0, 1, 1]], ['Ward display and aftercare', [0, 1, 0, 1, 1]], ['Rehab recording, session report, progress report', [0, 0, 1, 1, 1]], ['Audit file and equipment log', [0, 0, 0, 0, 1]], ['Report back to the referring vet, research export', [0, 0, 0, 0, 1]]],
      rTitel: 'Which tier suits your business?', rLead: 'Choose what you use. The calculator picks the cheapest tier that covers it and shows where the next one starts.',
      nutzen: 'What you use', tour: 'Tour planning', station: 'Overnight ward display', rehaE: 'Rehab sessions at the equipment',
      gerL: 'Devices with the cockpit', gerMehr: 'more than 8', pfL: 'Rehab horses in 30 days', eL: 'Sessions per horse per week', bL: 'Your charge for the session report',
      passt: 'Matching tier', imMonat: 'a month, excl. VAT', weil: 'Why this tier', test: 'Try for 14 days', zumAng: 'View offer',
      grundBasis: 'Smallest tier for your selection', grundGer: n => `${n} devices`, grundPf: n => `${n} rehab horses in 30 days`, grundTour: 'tour planning', grundStation: 'ward display',
      naechste: (was, s, p) => `Next step up: ${was} → ${s} at ${p} a month.`, abPf: n => `from ${n} rehab horses`, abGer: n => `from ${n} devices`, keinSprung: 'There is no further limit above this.',
      einh: 'Sessions per month', jeEinh: 'Licence per session', einn: 'Income from the report', erg: 'Monthly balance',
      traegt: (np, E) => `The licence pays for itself from ${np} rehab horse${np === 1 ? '' : 's'} with ${E} session${E === 1 ? '' : 's'} per week.`, traegtNie: 'At this charge the report does not cover the licence in any tier; without a separate charge it is part of your rehab package.',
      grafikT: 'Licence and income by number of rehab horses', grafikTG: 'Licence by number of devices', lizenz: 'Licence (tiers)', einnahmen: 'Income from the report', pferde: 'Rehab horses in 30 days', geraeteAchse: 'Devices',
      fuss: 'Prices excl. VAT. Limits per tier as in the table; above a limit you switch to the next tier yourself under “Manage subscription”.',
      fussReha: 'Example calculation without sensors (one-off purchase from specialist retailers). Whether and how you charge for the report is your decision; veterinary fees follow the rules of your country.',
      eu: v => '€' + v.toLocaleString('en-GB', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 }), zahl: v => v.toLocaleString('en-GB')
    }
  };
  const L = (document.documentElement.lang || 'de').slice(0, 2), t = T[L] || T.de, EN = L === 'en';
  const basis = { visite: EN ? '/carlon-equine-visite/en/' : '/carlon-equine-visite/', reha: EN ? '/carlon-equine-visite/reha/en/' : '/carlon-equine-visite/reha/' };
  const AUF = { visite: ['fahrpraxis', 'praxis', 'reha', 'kombi', 'center'], reha: ['reha', 'kombi', 'center'] };
  const ziel = (seite, k) => (AUF[seite].includes(k) ? '' : basis.visite) + '#tarif-' + k;
  const kasse = s => '/carlon-equine/app/?kasse=' + s.kasse + (EN ? '&lang=en' : '');
  const esc = x => String(x).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const css = `.st-ww{margin:var(--sp-34,34px) 0 0}
.st-ww h3{margin:0 0 12px;font-size:clamp(17px,1.8vw,20px);color:var(--text-primary,#f4f4f4);text-align:center}
.st-ww-k{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}
@media (max-width:900px){.st-ww-k{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:480px){.st-ww-k{grid-template-columns:1fr}}
.st-ww a{display:flex;flex-direction:column;gap:4px;padding:14px;border:1px solid var(--border-subtle,rgba(255,255,255,.12));border-radius:14px;background:rgba(0,0,0,.3);text-decoration:none;color:var(--text-secondary,#b8bec4);transition:border-color .2s,transform .2s;min-height:44px}
.st-ww a:hover,.st-ww a:focus-visible{border-color:rgba(62,207,178,.6);transform:translateY(-1px)}
.st-ww a b{color:var(--text-primary,#f4f4f4);font-size:15px}
.st-ww a span{font-size:13px;line-height:1.35}
.st-ww a i{font-style:normal;color:#3ECFB2;font-weight:600;font-size:14px;margin-top:auto}
.st-ww a.st-reha-g{border-color:rgba(242,196,107,.35)}
.st-ww a em{font-style:normal;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#F2C46B}
.st-tab{overflow-x:auto;margin:var(--sp-34,34px) 0 0;border:1px solid var(--border-subtle,rgba(255,255,255,.1));border-radius:14px}
.st-tab table{border-collapse:collapse;width:100%;min-width:720px;font-size:14px}
.st-tab th,.st-tab td{padding:9px 12px;border-bottom:1px solid var(--border-subtle,rgba(255,255,255,.1));text-align:center;color:var(--text-secondary,#b8bec4)}
.st-tab tbody th{text-align:left;color:var(--text-primary,#f4f4f4);font-weight:500}
.st-tab thead th{color:var(--text-primary,#f4f4f4);font-weight:600;vertical-align:bottom}
.st-tab thead a,.st-tab .st-zum a{display:inline-flex;align-items:center;justify-content:center;gap:4px;min-height:40px;padding:4px 10px;border-radius:999px;color:inherit;text-decoration:none;border:1px solid transparent;transition:border-color .2s,background .2s}
.st-tab thead a:hover,.st-tab thead a:focus-visible,.st-tab .st-zum a:hover{border-color:rgba(62,207,178,.55);background:rgba(62,207,178,.08)}
.st-tab thead a:after{content:'↓';font-size:12px;color:#3ECFB2;opacity:.8}
.st-tab thead a.st-weg:after{content:'→'}
.st-tab .st-fuer td{font-size:12.5px;line-height:1.35}
.st-tab .st-zum td a{color:#3ECFB2;font-weight:600}
.st-tab td.st-hier,.st-tab th.st-hier{background:rgba(62,207,178,.06)}
.st-r{margin:28px 0 8px;border:1px solid rgba(62,207,178,.35);border-radius:20px;padding:clamp(16px,2.4vw,26px);background:linear-gradient(180deg,rgba(62,207,178,.06),rgba(12,12,13,.6))}
.st-r h3{margin:0 0 6px;font-size:clamp(19px,2vw,23px);color:var(--text-primary,#f4f4f4)}
.st-r .st-lead{margin:0;color:var(--text-secondary,#b8bec4);font-size:15px;max-width:780px}
.st-chips{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0 4px}
.st-chips label{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:8px 14px;border:1px solid var(--border-subtle,rgba(255,255,255,.14));border-radius:999px;cursor:pointer;color:var(--text-secondary,#b8bec4);font-size:14px;user-select:none}
.st-chips input{accent-color:#3ECFB2;width:18px;height:18px}
.st-chips label:has(input:checked){border-color:rgba(62,207,178,.6);color:var(--text-primary,#f4f4f4);background:rgba(62,207,178,.08)}
.st-ein{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:14px 22px;margin:14px 0 18px}
.st-ein label{display:grid;gap:8px;font-size:13.5px;color:var(--text-secondary,#b8bec4)}
.st-ein output{float:right;color:var(--text-primary,#f4f4f4);font-weight:700;font-variant-numeric:tabular-nums}
.st-ein input[type=range]{width:100%;accent-color:#3ECFB2;min-height:32px}
.st-ein [hidden]{display:none!important}
.st-erg{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1.9fr);gap:16px;align-items:stretch}
@media (max-width:760px){.st-erg{grid-template-columns:1fr}}
.st-wahl{border:1px solid rgba(62,207,178,.55);border-radius:16px;padding:16px;background:rgba(0,0,0,.35);display:flex;flex-direction:column;gap:6px}
.st-wahl .st-k{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#3ECFB2}
.st-wahl .st-n{font-size:clamp(21px,2.3vw,26px);font-weight:700;color:var(--text-primary,#f4f4f4)}
.st-wahl .st-p{font-size:clamp(28px,3.4vw,40px);font-weight:700;color:var(--text-primary,#f4f4f4);font-variant-numeric:tabular-nums}
.st-wahl .st-p small{font-size:14px;font-weight:400;color:var(--text-secondary,#b8bec4);margin-left:6px}
.st-wahl ul{margin:4px 0 0;padding-left:18px;color:var(--text-secondary,#b8bec4);font-size:14px}
.st-wahl .st-sprung{font-size:13.5px;color:var(--text-secondary,#b8bec4);margin:4px 0}
.st-wahl .st-knopf{display:flex;flex-wrap:wrap;gap:8px;margin-top:auto;padding-top:8px}
.st-wahl .st-knopf a{display:inline-flex;align-items:center;min-height:44px;padding:8px 16px;border-radius:999px;text-decoration:none;font-weight:600;font-size:14px}
.st-wahl .st-knopf a.st-a1{background:#3ECFB2;color:#04201b}
.st-wahl .st-knopf a.st-a2{border:1px solid rgba(62,207,178,.55);color:#3ECFB2}
.st-graf{border:1px solid var(--border-subtle,rgba(255,255,255,.1));border-radius:16px;padding:12px 12px 6px;background:rgba(0,0,0,.35)}
.st-graf .st-gt{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--text-secondary,#b8bec4);margin:0 0 4px}
.st-graf svg{display:block;width:100%;height:auto}
.st-zahlen{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr));gap:10px;margin-top:14px}
.st-zahlen>div{border:1px solid var(--border-subtle,rgba(255,255,255,.1));border-radius:14px;padding:12px 14px;background:rgba(0,0,0,.35)}
.st-zahlen span{display:block;font-size:12px;letter-spacing:.05em;text-transform:uppercase;color:var(--text-secondary,#b8bec4)}
.st-zahlen b{display:block;margin-top:4px;font-size:clamp(21px,2.4vw,28px);font-weight:700;color:var(--text-primary,#f4f4f4);font-variant-numeric:tabular-nums}
.st-zahlen .st-gut b{color:#3ECFB2}.st-zahlen .st-neg b{color:#E0A458}
.st-satz{margin:14px 0 4px;color:var(--text-primary,#f4f4f4);font-size:15.5px}
.st-fuss{margin:0;color:var(--text-secondary,#b8bec4);font-size:13px}`;
  const stil = () => { if (document.getElementById('stufen-css')) return; const s = document.createElement('style'); s.id = 'stufen-css'; s.textContent = css; document.head.appendChild(s); };


  function wegweiser(el) {
    const seite = el.dataset.seite || 'visite';
    el.classList.add('st-ww');
    el.innerHTML = `<h3>${esc(t.wwT)}</h3><div class="st-ww-k">${ST.map(s => { const z = ziel(seite, s.k), rg = s.reha > 0;
      return `<a href="${z}" class="${rg ? 'st-reha-g' : ''}">${rg ? `<em>Reha</em>` : '<em>&nbsp;</em>'}<b>${esc(t.name[s.k])}</b><span>${esc(t.fuer[s.k])}</span><i>${esc(t.eu(s.p))}${s.k === 'center' ? esc(t.proStandort) : ''} →</i></a>`; }).join('')}</div>`;
  }
  function tabelle(el) {
    const seite = el.dataset.seite || 'visite';
    const kopf = ST.map(s => { const z = ziel(seite, s.k), weg = !z.startsWith('#'); return `<th scope="col" class="${AUF[seite].includes(s.k) && seite === 'reha' ? 'st-hier' : ''}"><a href="${z}"${weg ? ' class="st-weg"' : ''}>${esc(t.name[s.k])}</a></th>`; }).join('');
    const zelle = (s, v) => `<td class="${seite === 'reha' && AUF.reha.includes(s.k) ? 'st-hier' : ''}">${v}</td>`;
    const z = (titel, f, kl = '') => `<tr class="${kl}"><th scope="row">${esc(titel)}</th>${ST.map(s => zelle(s, f(s))).join('')}</tr>`;
    el.innerHTML = `<div class="st-tab" role="region" aria-label="${esc(t.tabAria)}" tabindex="0"><table><thead><tr><th scope="col">${esc(t.stufe)}</th>${kopf}</tr></thead><tbody>`
      + z(t.fuerWen, s => esc(t.fuer[s.k]), 'st-fuer')
      + z(t.preis, s => t.eu(s.p) + (s.k === 'center' ? esc(t.proStandort) : ''))
      + z(t.geraete, s => isFinite(s.ger) ? s.ger : esc(t.ohne))
      + z(t.rehaPf, s => s.reha === 0 ? '–' : (isFinite(s.reha) ? s.reha : esc(t.ohne)))
      + t.zeilen.map(([n, w]) => `<tr><th scope="row">${esc(n)}</th>${ST.map((s, i) => zelle(s, w[i] ? '✓' : '–')).join('')}</tr>`).join('')
      + `<tr class="st-zum"><th scope="row">${esc(t.zum)}</th>${ST.map(s => zelle(s, `<a href="${ziel(seite, s.k)}">${esc(t.zumKurz)}</a>`)).join('')}</tr>`
      + `</tbody></table></div>`;
  }

  function passend(b) {   // günstigste Stufe, die alle Anforderungen erfüllt
    return ST.filter(s => s.ger >= b.ger && (!b.reha || s.reha >= b.pf) && (!b.tour || s.tour) && (!b.station || s.station))
      .sort((a, c) => a.p - c.p || (b.reha ? c.reha - a.reha : a.reha - c.reha))[0];
  }

  function rechner(el) {
    const seite = el.dataset.seite || 'visite', start = el.dataset.start || 'tour', id = 'st' + Math.random().toString(36).slice(2, 7);
    el.classList.add('st-r');
    el.innerHTML = `<h3>${esc(t.rTitel)}</h3><p class="st-lead">${esc(t.rLead)}</p>
      <div class="st-chips" role="group" aria-label="${esc(t.nutzen)}">
        <label><input type="checkbox" data-w="tour"${start === 'tour' ? ' checked' : ''}> ${esc(t.tour)}</label>
        <label><input type="checkbox" data-w="station"> ${esc(t.station)}</label>
        <label><input type="checkbox" data-w="reha"${start === 'reha' ? ' checked' : ''}> ${esc(t.rehaE)}</label></div>
      <div class="st-ein">
        <label>${esc(t.gerL)} <output data-o="ger"></output><input type="range" data-i="ger" min="1" max="12" value="${start === 'reha' ? 3 : 2}"></label>
        <label data-nur="reha">${esc(t.pfL)} <output data-o="pf"></output><input type="range" data-i="pf" min="1" max="80" value="12"></label>
        <label data-nur="reha">${esc(t.eL)} <output data-o="e"></output><input type="range" data-i="e" min="1" max="7" value="3"></label>
        <label data-nur="reha">${esc(t.bL)} <output data-o="b"></output><input type="range" data-i="b" min="0" max="20" step="0.5" value="5"></label></div>
      <div class="st-erg"><div class="st-wahl" aria-live="polite"></div><div class="st-graf"><p class="st-gt"></p><div class="st-svg"></div></div></div>
      <div class="st-zahlen" data-nur="reha" aria-live="polite"></div>
      <p class="st-satz" data-nur="reha"></p><p class="st-fuss">${esc(t.fuss)} <span data-nur="reha">${esc(t.fussReha)}</span></p>`;
    const $ = s => el.querySelector(s), wert = n => +$(`[data-i="${n}"]`).value, an = w => $(`[data-w="${w}"]`).checked;
    function r() {
      const b = { tour: an('tour'), station: an('station'), reha: an('reha'), ger: wert('ger'), pf: wert('pf'), e: wert('e'), bet: wert('b') };
      el.querySelectorAll('[data-nur="reha"]').forEach(x => x.hidden = !b.reha);
      $('[data-o="ger"]').textContent = b.ger > 8 ? t.gerMehr : b.ger; $('[data-o="pf"]').textContent = b.pf; $('[data-o="e"]').textContent = b.e; $('[data-o="b"]').textContent = t.eu(b.bet);
      const s = passend(b);
      // Grund: welche Anforderung bindet
      const gr = [];
      if (b.ger > 2 || s.ger === b.ger) gr.push(t.grundGer(b.ger > 8 ? '> 8' : b.ger));
      if (b.reha) gr.push(t.grundPf(b.pf)); if (b.tour) gr.push(t.grundTour); if (b.station) gr.push(t.grundStation);
      // nächster Sprung
      let sprung = t.keinSprung;
      if (s.k !== 'center') {
        const kand = [];
        if (b.reha && isFinite(s.reha)) { const n = passend({ ...b, pf: s.reha + 1 }); kand.push([s.reha + 1, t.abPf(s.reha + 1), n]); }
        if (isFinite(s.ger)) { const n = passend({ ...b, ger: s.ger + 1 }); kand.push([99, t.abGer(s.ger + 1), n]); }
        const k = kand.find(x => x[2] && x[2].k !== s.k); if (k) sprung = t.naechste(k[1], t.name[k[2].k], t.eu(k[2].p));
      }
      $('.st-wahl').innerHTML = `<div class="st-k">${esc(t.passt)}</div><div class="st-n">${esc(t.name[s.k])}</div><div class="st-p">${t.eu(s.p)}<small>${esc(t.imMonat)}${s.k === 'center' ? esc(t.proStandort) : ''}</small></div>
        <div class="st-k" style="margin-top:6px">${esc(t.weil)}</div><ul>${gr.map(x => `<li>${esc(x)}</li>`).join('') || `<li>${esc(t.grundBasis)}</li>`}</ul>
        <p class="st-sprung">${esc(sprung)}</p><div class="st-knopf"><a class="st-a1" href="${kasse(s)}">${esc(t.test)} →</a><a class="st-a2" href="${ziel(seite, s.k)}">${esc(t.zumAng)}</a></div>`;
      // Grafik
      const box = $('.st-svg'), W = Math.max(300, Math.min(620, Math.round((box.clientWidth || 560)))), H = W < 420 ? 236 : 240, pl = 48, pr = 10, pt = W < 420 ? 36 : 22, pb = 34, eng = W < 420;
      let g = '', xs, lic, inc = null, xmax, xlab;
      if (b.reha) {
        xmax = 80; xs = Array.from({ length: xmax }, (_, i) => i + 1);
        lic = xs.map(p => passend({ ...b, pf: p }).p);
        inc = xs.map(p => p * b.e * 52 / 12 * b.bet); xlab = t.pferde; $('.st-gt').textContent = t.grafikT;
      } else {
        xmax = 12; xs = Array.from({ length: xmax }, (_, i) => i + 1);
        lic = xs.map(n => passend({ ...b, ger: n }).p); xlab = t.geraeteAchse; $('.st-gt').textContent = t.grafikTG;
      }
      const ymax = Math.max(1000, Math.max(...lic) * 1.6, inc ? Math.min(Math.max(...inc), Math.max(...lic) * 3.2) : 0) * 1.05;
      const X = v => pl + (v - 1) / (xmax - 1) * (W - pl - pr), Y = v => pt + (1 - v / ymax) * (H - pt - pb);
      const step = ymax > 4800 ? 1000 : ymax > 2400 ? 500 : 250;
      for (let v = 0; v <= ymax; v += step) g += `<line x1="${pl}" x2="${W - pr}" y1="${Y(v)}" y2="${Y(v)}" stroke="rgba(255,255,255,.08)"/><text x="${pl - 6}" y="${Y(v) + 3.5}" text-anchor="end" font-size="10" fill="#8a949c">${t.eu(v)}</text>`;
      const tick = b.reha ? (W < 420 ? [1, 20, 40, 60, 80] : [1, 10, 20, 30, 40, 50, 60, 70, 80]) : (W < 420 ? [1, 2, 4, 6, 8, 12] : xs);
      tick.forEach(v => g += `<text x="${X(v)}" y="${H - pb + 14}" text-anchor="middle" font-size="10" fill="#8a949c">${v === 12 && !b.reha ? '>8' : v}</text>`);
      g += `<text x="${(pl + W - pr) / 2}" y="${H - 4}" text-anchor="middle" font-size="10.5" fill="#8a949c">${esc(xlab)}</text>`;
      if (inc) {   // Fläche, wo der Bericht die Lizenz trägt
        let pg = ''; xs.forEach((x, i) => { if (inc[i] >= lic[i]) pg += `<rect x="${X(x) - (W - pl - pr) / (xmax - 1) / 2}" y="${pt}" width="${(W - pl - pr) / (xmax - 1)}" height="${H - pt - pb}" fill="rgba(62,207,178,.07)"/>`; }); g += pg;
        g += `<defs><clipPath id="${id}k"><rect x="${pl}" y="${pt}" width="${W - pl - pr}" height="${H - pt - pb}"/></clipPath></defs><polyline clip-path="url(#${id}k)" fill="none" stroke="#F2C46B" stroke-width="2" points="${xs.map((x, i) => `${X(x)},${Y(inc[i])}`).join(' ')}"/>`;
      }
      let d = `M${X(1)},${Y(lic[0])}`; for (let i = 1; i < xs.length; i++) { d += ` H${(X(xs[i - 1]) + X(xs[i])) / 2} V${Y(lic[i])}`; } d += ` H${X(xmax)}`;
      g += `<path d="${d}" fill="none" stroke="#3ECFB2" stroke-width="2.4"/>`;
      // Sprung-Beschriftung
      for (let i = 1; i < xs.length; i++) if (lic[i] !== lic[i - 1]) g += `<text x="${(X(xs[i - 1]) + X(xs[i])) / 2 + 4}" y="${Y(lic[i]) - 6}" font-size="10" fill="#3ECFB2">${esc(t.name[passend(b.reha ? { ...b, pf: xs[i] } : { ...b, ger: xs[i] }).k])} ${t.eu(lic[i])}</text>`;
      const cur = b.reha ? b.pf : b.ger, ci = cur - 1;
      g += `<line x1="${X(cur)}" x2="${X(cur)}" y1="${pt}" y2="${H - pb}" stroke="rgba(255,255,255,.35)" stroke-dasharray="3 3"/><circle cx="${X(cur)}" cy="${Y(lic[ci])}" r="4.5" fill="#3ECFB2"/>`;
      if (inc && inc[ci] <= ymax) g += `<circle cx="${X(cur)}" cy="${Y(inc[ci])}" r="4.5" fill="#F2C46B"/>`;
      const leg = `<g font-size="10.5"><rect x="${pl + 6}" y="${eng ? pt - 30 : pt - 14}" width="12" height="3" fill="#3ECFB2"/><text x="${pl + 22}" y="${eng ? pt - 26 : pt - 10}" fill="#cfd5da">${esc(t.lizenz)}</text>${inc ? `<rect x="${eng ? pl + 6 : pl + 130}" y="${eng ? pt - 30 + 14 : pt - 14}" width="12" height="3" fill="#F2C46B"/><text x="${eng ? pl + 22 : pl + 146}" y="${eng ? pt - 26 + 14 : pt - 10}" fill="#cfd5da">${esc(t.einnahmen)}</text>` : ''}</g>`;
      $('.st-svg').innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(b.reha ? t.grafikT : t.grafikTG)}">${g}${leg}</svg>`;
      if (b.reha) {
        const N = Math.round(b.pf * b.e * 52 / 12), U = N * b.bet, G = U - s.p;
        $('.st-zahlen').innerHTML = `<div><span>${esc(t.einh)}</span><b>${t.zahl(N)}</b></div><div><span>${esc(t.jeEinh)}</span><b>${N ? t.eu(Math.round(s.p / N * 100) / 100) : '–'}</b></div><div><span>${esc(t.einn)}</span><b>${t.eu(Math.round(U))}</b></div><div class="${G >= 0 ? 'st-gut' : 'st-neg'}"><span>${esc(t.erg)}</span><b>${G >= 0 ? '+' : '−'}${t.eu(Math.abs(Math.round(G)))}</b></div>`;
        let np = 0; for (let p = 1; p <= 400; p++) { if (p * b.e * 52 / 12 * b.bet >= passend({ ...b, pf: p }).p) { np = p; break; } }
        $('.st-satz').textContent = b.bet > 0 && np ? t.traegt(np, b.e) : t.traegtNie;
      }
    }
    el.addEventListener('input', r); r(); let rw = 0; addEventListener('resize', () => { cancelAnimationFrame(rw); rw = requestAnimationFrame(r); });
  }
  function los() { stil(); document.querySelectorAll('[data-stufen="wegweiser"]').forEach(wegweiser); document.querySelectorAll('[data-stufen="tabelle"]').forEach(tabelle); document.querySelectorAll('[data-stufen="rechner"]').forEach(rechner); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', los); else los();
  window.CarlonStufen = { ST, passend };
})();
