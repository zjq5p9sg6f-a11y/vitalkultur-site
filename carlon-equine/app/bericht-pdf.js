/* BERICHT ALS PDF ZUM TEILEN (23.11.2026, Jan: „reibungsloser Dokumentationsprozess bis zum fertigen Bericht“)
   Ein Tipp → PDF im Teilen-Blatt (WhatsApp, Mail, AirDrop) statt Druckdialog → Datei sichern → anhängen.
   Weg (Versuch 23.11., werkzeuge/pdf-versuch): Der BROWSER zeichnet jede Berichtsseite selbst (SVG foreignObject → Canvas),
   also pixelgleich mit dem Druck; jsPDF setzt die Seiten als Bild und legt den echten Text unsichtbar darüber (durchsuchbar).
   Kein Nachbau des Layouts → kein verrutschtes Wort. Lädt jsPDF erst bei Bedarf (lib/, offline im Service Worker).
   Rückfall: Teilen nicht möglich → Datei laden; Zeichnen gesperrt (Safari) → Druckdialog wie bisher. */
(function () {
  'use strict';
  const en = () => typeof Sprache !== 'undefined' && Sprache.cur === 'en';
  const E = (de, e) => en() ? e : de;
  let _lib = null, _font = null;
  /* CSS-Variablen der App (Schriften, Farben) für die gezeichnete Kopie: sonst andere Schrift → anderes Layout als gemessen */
  const vars = () => { const cs = getComputedStyle(document.documentElement); const o = []; for (let i = 0; i < cs.length; i++) { const p = cs[i]; if (p.startsWith('--')) o.push(p + ':' + cs.getPropertyValue(p).trim().replace(/"/g, "'")); } return o.join(';'); };
  /* Wurzel- und Grundschrift wie in der App: rem bezieht sich in der Kopie auf <svg>, nicht auf <html> */
  /* Zeilenhöhe RELATIV weitergeben (23.11.): getComputedStyle liefert „24px“; fest vererbt bekäme jede kleine Schrift 24-px-Zeilen → Seiten zu hoch */
  const wurzel = () => { const r = getComputedStyle(document.documentElement), b = getComputedStyle(document.body), lh = parseFloat(b.lineHeight) / parseFloat(b.fontSize);
    return { svg: `font-size:${r.fontSize}`, div: `font-family:${b.fontFamily.replace(/"/g, "'")};font-size:${b.fontSize};line-height:${isFinite(lh) && lh > 0 ? +lh.toFixed(4) : 'normal'};letter-spacing:${b.letterSpacing};color:${b.color}` }; };
  const ladeLib = () => _lib || (_lib = new Promise((res, rej) => { if (window.jspdf) return res(window.jspdf);
    const s = document.createElement('script'); s.src = 'lib/jspdf-4.2.1.umd.min.js'; s.onload = () => res(window.jspdf); s.onerror = () => { _lib = null; rej(new Error('jsPDF nicht geladen')); }; document.head.appendChild(s); }));
  const alsDataUrl = async (u) => { const b = await (await fetch(u)).blob(); return await new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); }); };
  const schrift = () => _font || (_font = Promise.all(['assets/fonts/inter-variable.woff2', 'assets/fonts/jost-variable.woff2'].map(u => alsDataUrl(u).catch(() => null)))
    .then(([i, j]) => (i ? `@font-face{font-family:Inter;src:url(${i}) format("woff2");font-weight:100 900}` : '') + (j ? `@font-face{font-family:Jost;src:url(${j}) format("woff2");font-weight:100 900}` : '')));

  /* Seiten = .rh-seite (A4 quer, Reha) bzw. jedes direkte Kind mit fester Seitengröße; sonst ganze Fläche als eine Seite */
  function seitenVon(pa) { const s = [...pa.querySelectorAll('.rh-seite')]; return s.length ? s : [pa]; }

  /* FLIESSTEXT-BERICHTE (Messwertbericht u. a.): Browser zeichnet den ganzen Bericht in A4-Satzbreite; geschnitten wird nur an
     freien Zeilen (nie durch Text, Tabellenzeile oder Grafik), ausdrückliche Umbrüche (.pr-neue-seite) gelten; Fuß + Seitenzahl je Seite. */
  async function fliessend(pa, opt, jsPDF, ff) {
    /* BLOCKWEISE (23.11.2026): jeder Block (Kopf, Kennzahlen, Grafik mit Überschrift, Tabelle) wird einzeln vom Browser gezeichnet;
       die Seiten entstehen aus den GEZEICHNETEN Höhen. Kein Block wird getrennt, Überschriften wandern mit, .pr-neue-seite gilt;
       nur Blöcke höher als eine Seite werden an einer freien Zeile geteilt. */
    const R = { o: 15, u: 17, l: 14, re: 14 }, BW = 210 - R.l - R.re, BH = 297 - R.o - R.u;
    const alt = pa.getAttribute('style') || ''; pa.style.cssText = `display:block;position:fixed;left:-100000px;top:0;width:${BW}mm;background:#fff;z-index:-1`;
    const druckRegeln = css => { let o = ''; const re = /@media\s+print\s*\{/g; let m;
      while ((m = re.exec(css))) { let t = 1, j = re.lastIndex; while (j < css.length && t) { if (css[j] === '{') t++; else if (css[j] === '}') t--; j++; } o += css.slice(re.lastIndex, j - 1) + '\n'; re.lastIndex = j; } return o; };
    const roh = [...document.querySelectorAll('style')].filter(x => pa.contains(x) || /#printArea|\.pr-/.test(x.textContent)).map(x => x.textContent);
    const nurDruck = roh.map(druckRegeln).join('\n').replace(/@page\s*\{[^{}]*(\{[^{}]*\}[^{}]*)*\}/g, '')
      .split('}').filter(b => /#printArea|\.pr-|\.rh-/.test(b.split('{')[0] || '')).map(b => b + '}').join('\n');
    const live = document.createElement('style'); live.id = 'bpDruckLive'; live.textContent = nurDruck; document.head.appendChild(live);
    try {
      const q = pa.getBoundingClientRect(), W = Math.round(q.width), pxmm = W / BW, Hs = Math.floor(BH * pxmm), F = opt.schaerfe || 2.2;
      const stil = (roh.join('\n') + '\n' + roh.map(druckRegeln).join('\n')).replace(/@page\s*\{[^{}]*(\{[^{}]*\}[^{}]*)*\}/g, '')
        + `\n#printArea{display:block!important;position:static!important;left:auto!important;width:${W}px!important;background:#fff!important}`;
      const wz = wurzel(), vv = vars();
      /* Blöcke bilden: Kinder des Berichts; Behälter höher als eine Seite werden aufgelöst (außer „nicht trennen“) */
      const bloecke = []; const zerlege = (el, tiefe) => { for (const k of el.children) { if (k.tagName === 'STYLE' || k.tagName === 'SCRIPT') continue;
          const b = k.getBoundingClientRect(), cs = getComputedStyle(k), marke = k.classList.contains('pr-neue-seite') || /page|always/.test(cs.breakBefore + cs.pageBreakBefore);
          if (marke && !b.height) { bloecke.push({ marke: true }); continue; } if (!b.height || cs.display === 'none') continue;
          if (b.height > Hs * 0.95 && k.children.length > 1 && tiefe < 4 && !/avoid/.test(cs.breakInside + cs.pageBreakInside) && !/^(FIGURE|TABLE|SVG|IMG)$/i.test(k.tagName)) { if (marke) bloecke.push({ marke: true }); zerlege(k, tiefe + 1); continue; }
          bloecke.push({ el: k, b, mt: parseFloat(cs.marginTop) || 0, mb: parseFloat(cs.marginBottom) || 0, marke, kopf: /^H[1-6]$/.test(k.tagName) || (b.height < 70 && k.children.length <= 2 && !/^(TABLE|FIGURE|IMG|SVG)$/i.test(k.tagName) && k.textContent.trim().length < 90) }); } };
      zerlege(pa, 0);
      /* einen Block zeichnen (eigene Kopie, gleiche Stile); gezeichnete Höhe = letzte Zeile mit Inhalt */
      const zeichne = async (bk) => { const el = bk.el, b = bk.b, x = b.left - q.left, Hp = Math.ceil(b.height * 1.25 + 40);
        const kl = el.cloneNode(true); for (const im of kl.querySelectorAll('img')) if (im.src && !im.src.startsWith('data:')) { try { im.src = await alsDataUrl(im.src); } catch (_) { } }
        if (kl.tagName === 'IMG' && kl.src && !kl.src.startsWith('data:')) { try { kl.src = await alsDataUrl(kl.src); } catch (_) { } }
        kl.style.margin = '0'; kl.style.width = b.width + 'px';
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${Hp}" style="${wz.svg}"><foreignObject x="0" y="0" width="${W}" height="${Hp}"><div xmlns="http://www.w3.org/1999/xhtml" style="width:${W}px;background:#fff;${wz.div};${vv}"><style><![CDATA[${ff}${stil.replace(/\]\]>/g, ']] >')}]]></style><div id="printArea" style="padding-left:${x}px">${new XMLSerializer().serializeToString(kl)}</div></div></foreignObject></svg>`;
        const bild = new Image(); await new Promise((res, rej) => { bild.onload = res; bild.onerror = () => rej(new Error('Bericht nicht zeichenbar')); bild.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
        const cv = document.createElement('canvas'); cv.width = W * F; cv.height = Hp * F; const cx = cv.getContext('2d', { willReadFrequently: true }); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(bild, 0, 0, cv.width, cv.height);
        cv.toDataURL('image/png').slice(0, 8);   /* wirft bei gesperrtem Zeichnen (Safari) → Rückfall Druck */
        const d = cx.getImageData(0, 0, cv.width, cv.height).data, leer = y => { for (let i = y * cv.width * 4, e = i + cv.width * 4; i < e; i += 4) if (d[i] < 245 || d[i + 1] < 245 || d[i + 2] < 245) return false; return true; };
        let h = cv.height; while (h > 1 && leer(h - 1)) h--; const hb = Math.max(h / F, b.height * 0.5);
        bk.cv = cv; bk.hd = Math.ceil(hb); bk.ratio = bk.hd / b.height; bk.frei = y => { const yy = Math.round(y * F), max = Math.max(6, cv.width * 0.01); let n = 0; for (let i = yy * cv.width * 4, e = i + cv.width * 4; i < e; i += 4) if ((d[i] < 235 || d[i + 1] < 235 || d[i + 2] < 235) && ++n > max) return false; return true; }; };
      for (const bk of bloecke) if (bk.el) await zeichne(bk);
      /* Seiten setzen */
      const seiten = [[]]; let y = 0, lastMb = 0;
      const neu = () => { if (seiten[seiten.length - 1].length) seiten.push([]); y = 0; lastMb = 0; };
      for (let k = 0; k < bloecke.length; k++) { const bk = bloecke[k]; if (bk.marke && !bk.el) { neu(); continue; } if (bk.marke) neu();
        const abst = y ? Math.max(lastMb, bk.mt) : 0;
        /* Überschrift nie allein am Seitenende: mit dem nächsten Block zusammen prüfen */
        const nxt = bloecke[k + 1] && bloecke[k + 1].el && !bloecke[k + 1].marke ? bloecke[k + 1] : null;
        const bedarf = abst + bk.hd + (bk.kopf && nxt ? Math.max(bk.mb, nxt.mt) + Math.min(nxt.hd, Hs * 0.25) : 0);
        if (y && y + bedarf > Hs) neu();
        if (bk.hd <= Hs - y) { seiten[seiten.length - 1].push({ bk, y: y + (y ? abst : 0), von: 0, bis: bk.hd }); y += (y ? abst : 0) + bk.hd; lastMb = bk.mb; continue; }
        /* höher als der Rest der Seite (nur möglich, wenn höher als eine ganze Seite): an freien Zeilen teilen */
        let von = 0; while (von < bk.hd - 1) { const platz = Hs - y; let bis = Math.min(bk.hd, von + platz);
          if (bis < bk.hd) { let z = bis; while (z > von + platz * 0.5 && !bk.frei(z)) z--; if (z > von + platz * 0.5) bis = z; }
          seiten[seiten.length - 1].push({ bk, y, von, bis }); y += bis - von; von = bis; if (von < bk.hd - 1) neu(); }
        lastMb = bk.mb; }
      if (!seiten[seiten.length - 1].length) seiten.pop();
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true }); doc.setProperties({ title: opt.titel || 'Bericht', creator: 'CARLON Equine Visite' });
      const n = seiten.length, mm = BW / W;
      window.__bpDiag = { Hs, bloecke: bloecke.length, seiten: seiten.map(s2 => s2.length) };
      for (let i = 0; i < n; i++) { if (i) doc.addPage('a4', 'portrait');
        const pc = document.createElement('canvas'); pc.width = W * F; pc.height = Hs * F; const px = pc.getContext('2d'); px.fillStyle = '#fff'; px.fillRect(0, 0, pc.width, pc.height);
        for (const t of seiten[i]) px.drawImage(t.bk.cv, 0, Math.round(t.von * F), t.bk.cv.width, Math.round((t.bis - t.von) * F), 0, Math.round(t.y * F), t.bk.cv.width, Math.round((t.bis - t.von) * F));
        doc.addImage(pc.toDataURL('image/jpeg', 0.88), 'JPEG', R.l, R.o, BW, BH, undefined, 'FAST');
        doc.setFont('helvetica'); doc.setFontSize(7); doc.setTextColor(138, 154, 168);
        if (opt.fuss) doc.text(String(opt.fuss).slice(0, 160), R.l, 297 - 9);
        doc.text((en() ? 'Page ' : 'Seite ') + (i + 1) + (en() ? ' of ' : ' von ') + n, 210 - R.re, 297 - 9, { align: 'right' });
        /* unsichtbare Textebene je Block, auf die gezeichnete Höhe skaliert */
        for (const t of seiten[i]) { const el = t.bk.el, b = t.bk.b, rt = t.bk.ratio || 1; const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let tn;
          while ((tn = tw.nextNode())) { const s2 = tn.textContent.replace(/\s+/g, ' ').trim(); if (!s2 || !tn.parentElement) continue; const rg = document.createRange(); rg.selectNodeContents(tn); const bb = rg.getBoundingClientRect(); if (!bb.width) continue;
            const yb = (bb.bottom - b.top) * rt; if (yb <= t.von || yb > t.bis + 2) continue; const pt = parseFloat(getComputedStyle(tn.parentElement).fontSize) * mm * 72 / 25.4; doc.setFontSize(Math.max(1, pt));
            try { doc.text(s2.replace(/[\u2212\u2013]/g, '-').replace(/\u2192/g, '->'), R.l + (bb.left - q.left) * mm, R.o + (t.y + yb - t.von) * mm - pt * 0.09, { renderingMode: 'invisible', maxWidth: bb.width * mm + 2 }); } catch (_) { } } } }
      return doc.output('blob');
    } finally { live.remove(); if (alt) pa.setAttribute('style', alt); else pa.removeAttribute('style'); }
  }

  async function erzeugen(pa, opt) {
    opt = opt || {}; const { jsPDF } = await ladeLib(); const ff = await schrift();
    if (!pa.querySelector('.rh-seite')) return fliessend(pa, opt, jsPDF, ff);
    const alt = pa.getAttribute('style') || ''; pa.style.cssText = 'display:block;position:fixed;left:-100000px;top:0;width:297mm;z-index:-1';
    try {
      const stil = [...pa.querySelectorAll('style')].map(s => s.textContent).join('\n');
      const seiten = seitenVon(pa); const r0 = seiten[0].getBoundingClientRect();
      const quer = r0.width >= r0.height, Bmm = quer ? 297 : 210, Hmm = quer ? 210 : 297;
      const doc = new jsPDF({ orientation: quer ? 'landscape' : 'portrait', unit: 'mm', format: 'a4', compress: true });
      doc.setProperties({ title: opt.titel || 'Bericht', creator: 'CARLON Equine Visite' });
      const F = opt.schaerfe || 2.2;
      for (let i = 0; i < seiten.length; i++) {
        const el = seiten[i], q = el.getBoundingClientRect(), W = Math.round(q.width), H = Math.round(q.height);
        if (i) doc.addPage('a4', quer ? 'landscape' : 'portrait');
        /* SELBSTPRÜFUNG (23.11.): Kopie bricht Text minimal anders um als die Seite → nach dem Zeichnen den Streifen über der Fußlinie
           im BILD messen; liegt dort Inhalt, Seite 3 % kleiner neu zeichnen (höchstens 6×). Unabhängig von Browser und Schrift. */
        const fu = el.querySelector('.rh-fuss'), fy = fu ? (fu.getBoundingClientRect().top - q.top) / q.height : 0, z0 = parseFloat((el.querySelector('.rh-inh') || {}).style?.zoom) || 1;
        let cv, cx;
        for (let v = 0; v < 7; v++) {
          const kl = el.cloneNode(true); const ih = kl.querySelector('.rh-inh'); if (ih && v) ih.style.zoom = +(z0 * Math.pow(0.97, v)).toFixed(3);
          for (const im of kl.querySelectorAll('img')) if (im.src && !im.src.startsWith('data:')) { try { im.src = await alsDataUrl(im.src); } catch (_) { } }
          const xhtml = new XMLSerializer().serializeToString(kl);
          const wz = wurzel(); const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" style="${wz.svg}"><foreignObject x="0" y="0" width="${W}" height="${H}"><div xmlns="http://www.w3.org/1999/xhtml" id="printArea" style="width:${W}px;${wz.div};${vars()}"><style><![CDATA[${ff}${(stil).replace(/\]\]>/g, "]] >")}]]></style>${xhtml}</div></foreignObject></svg>`;
          const bild = new Image(); bild.decoding = 'sync';
          await new Promise((res, rej) => { bild.onload = res; bild.onerror = () => rej(new Error('Seite nicht zeichenbar')); bild.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
          cv = document.createElement('canvas'); cv.width = W * F; cv.height = H * F ; cx = cv.getContext('2d');
          cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(bild, 0, 0, cv.width, cv.height);
          if (!fy) break; const y0 = Math.round(fy * cv.height), d = cx.getImageData(0, y0 - 5 * F, cv.width, 3 * F).data; let dk = 0;
          for (let j = 0; j < d.length; j += 4) if (d[j] + d[j + 1] + d[j + 2] < 600) dk++; if (dk / (d.length / 4) < 0.01) break;
        }
        const jpg = cv.toDataURL('image/jpeg', 0.86);   // wirft in Safari (foreignObject „verunreinigt“ die Fläche) → Rückfall Druck
        doc.addImage(jpg, 'JPEG', 0, 0, Bmm, Hmm, undefined, 'FAST');
        /* unsichtbare Textebene an derselben Stelle: PDF bleibt durchsuchbar und kopierbar */
        const mm = Bmm / q.width; doc.setFont('helvetica');
        const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n;
        while ((n = tw.nextNode())) { const t = n.textContent.replace(/\s+/g, ' ').trim(); if (!t || !n.parentElement) continue;
          const rg = document.createRange(); rg.selectNodeContents(n); const b = rg.getBoundingClientRect(); if (!b.width || !b.height) continue;
          const pt = parseFloat(getComputedStyle(n.parentElement).fontSize) * mm * 72 / 25.4; doc.setFontSize(Math.max(1, pt));
          try { doc.text(t.replace(/[\u2212\u2013]/g, '-').replace(/\u2192/g, '->'), (b.left - q.left) * mm, (b.bottom - q.top) * mm - pt * 0.09, { renderingMode: 'invisible', maxWidth: b.width * mm + 2 }); } catch (_) { } }
      }
      return doc.output('blob');
    } finally { if (alt) pa.setAttribute('style', alt); else pa.removeAttribute('style'); }
  }

  const dateiname = t => (String(t || 'Bericht').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Bericht') + '.pdf';

  /* Teilen mit Datei; ohne Teilen-Funktion: Datei laden (iOS braucht octet-stream); Abbruch durch Nutzer ist kein Fehler */
  async function teilen(blob, titel, text) {
    const name = dateiname(titel); const datei = new File([blob], name, { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [datei] })) {
      try { await navigator.share({ files: [datei], title: titel || name, text: text || '' }); return 'geteilt'; }
      catch (e) { if (e && e.name === 'AbortError') return 'abgebrochen'; }
    }
    const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const url = URL.createObjectURL(ios ? new Blob([blob], { type: 'application/octet-stream' }) : blob);
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000); return 'geladen';
  }

  /* Vorbereiten: Bericht bauen lassen (ohne Druckdialog), PDF erzeugen, merken. Teilen danach sofort im Tipp (Nutzergeste verfällt sonst). */
  const vorrat = new Map(); let kette = Promise.resolve();
  async function vorbereiten(schluessel, bauen, titel) {
    if (vorrat.has(schluessel)) return vorrat.get(schluessel);
    const p = kette = kette.catch(() => {}).then(async () => { await bauen(); const pa = document.getElementById('printArea'); return { blob: await erzeugen(pa, { titel }), titel }; });   /* nacheinander: alle Berichte teilen sich #printArea */
    vorrat.set(schluessel, p); p.catch(() => vorrat.delete(schluessel)); return p;
  }

  /* „BERICHT FERTIG“-BLATT für alle Berichte: statt sofort zu drucken → Senden (PDF ins Teilen-Menü) oder Drucken.
     PDF entsteht beim Öffnen aus dem aktuellen #printArea; „Senden“ ist ein frischer Tipp (Nutzergeste gilt). */
  async function ausgabe(o) {
    o = o || {}; const pa = document.getElementById('printArea'); if (!pa || typeof UI === 'undefined') { if (o.druck) o.druck(); return; }
    const titel = o.titel || document.title, schl = 'ausgabe|' + titel + '|' + Date.now();
    const p = kette = kette.catch(() => {}).then(async () => ({ blob: await erzeugen(pa, { titel, fuss: o.fuss }), titel })); vorrat.set(schl, p); p.catch(() => vorrat.delete(schl));
    UI.modal(`<div class="modal-head"><button class="closex" onclick="UI.closeModal()">${(typeof IC !== 'undefined' && IC.x) || '×'}</button><h3>${E('Bericht fertig', 'Report ready')}</h3></div><div class="modal-body">
      <p style="margin:0 0 4px;font-weight:600">${String(titel).replace(/[<>&]/g, '')}</p><p style="margin:0 0 14px;font-size:12.5px;color:var(--text-dim)" id="baStand">${E('PDF wird vorbereitet …', 'Preparing PDF …')}</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" id="baSenden" disabled>${E('Als PDF senden', 'Send as PDF')}</button><button class="btn ghost" id="baDruck">${E('Drucken', 'Print')}</button></div>
      <p style="margin:12px 0 0;font-size:12.5px;color:var(--text-secondary)">${E('Senden öffnet das Teilen-Menü mit angehängtem PDF: WhatsApp, Mail, AirDrop.', 'Send opens the share sheet with the PDF attached: WhatsApp, mail, AirDrop.')}</p></div>`);
    const st = document.getElementById('baStand'), bs = document.getElementById('baSenden'), bd = document.getElementById('baDruck');
    bd.onclick = () => { UI.closeModal(); if (o.druck) o.druck(); };
    p.then(() => { if (st) { st.textContent = E('bereit', 'ready'); st.style.color = 'var(--good)'; } if (bs) bs.disabled = false; })
     .catch(() => { if (st) { st.textContent = E('PDF auf diesem Gerät nicht möglich, bitte „Drucken“ (dort „Als PDF sichern“).', 'PDF not possible on this device, please use “Print” (“Save as PDF”).'); st.style.color = 'var(--amber)'; } if (bs) bs.remove(); });
    bs.onclick = async () => { const v = await p; const r = await teilen(v.blob, v.titel, o.text || '');
      if (r === 'geladen' && typeof Toast !== 'undefined') Toast.show(E('PDF gespeichert (Download-Ordner) · zum Anhängen bereit', 'PDF saved (downloads) · ready to attach'), 'ok');
      if (r !== 'abgebrochen') { UI.closeModal(); if (o.nachSenden) try { await o.nachSenden(r); } catch (_) { } } };
    return p;
  }

  window.BerichtPDF = { erzeugen, teilen, vorbereiten, dateiname, ausgabe, _vorrat: vorrat,
    /* Knopf-Helfer: wartet auf das vorbereitete PDF, teilt es; scheitert das Zeichnen, bleibt der Druck als Rückweg */
    async senden(schluessel, bauen, titel, text, druck) {
      try { const v = await vorbereiten(schluessel, bauen, titel); const r = await teilen(v.blob, v.titel, text);
        if (r === 'geladen' && typeof Toast !== 'undefined') Toast.show(E('PDF gespeichert (Download-Ordner) · zum Anhängen bereit', 'PDF saved (downloads) · ready to attach'), 'ok');
        return r; }
      catch (e) { if (typeof Toast !== 'undefined') Toast.show(E('PDF hier nicht möglich, Druckdialog öffnet sich („Als PDF sichern“)', 'PDF not possible here, the print dialog opens (“Save as PDF”)'), 'warn'); if (druck) druck(); return 'druck'; } }
  };
})();
