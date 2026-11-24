/* BESTAND-KERN (24.11.2026): Spalten einer Praxis-CSV erkennen – EINE Quelle für das Cockpit (Bestand übernehmen)
   und die öffentliche Prüfseite /carlon-equine-visite/praxisprogramm/. Läuft ohne Cockpit, liest nur, speichert nichts. */
const BestandKern={
  FELDER:[
    ['name','Pferd',['pferd','pferdename','tiername','patient','patientenname','nameDesPferdes','horse','horsename','rufname','tier']],
    ['owner','Halterin / Besitzer',['besitzer','halter','halterin','eigentümer','eigentuemer','kunde','kundin','kundenname','tierhalter','tierbesitzer','owner','client','kontakt']],
    ['vorname','Vorname (Halterin)',['vorname','firstname']],
    ['nachname','Nachname (Halterin)',['nachname','familienname','lastname','surname']],
    ['phone','Telefon',['telefon','tel','handy','mobil','mobiltelefon','telefonnummer','phone','mobile']],
    ['mail','E-Mail',['email','mail','emailadresse']],
    ['stable','Stall',['stall','stallname','betrieb','hof','reitstall','stable','yard']],
    ['street','Straße',['straße','strasse','str','adresse','anschrift','address','street','stalladresse']],
    ['plz','PLZ',['plz','postleitzahl','zip','postcode']],
    ['ort','Ort',['ort','wohnort','stadt','city','town','gemeinde']],
    ['breed','Rasse',['rasse','breed']],
    ['clinicPMS','Patienten-Nr. (Praxissoftware)',['patientennummer','patientennr','patientenid','patnr','tiernummer','tiernr','pmsid','id','nr','nummer']],
    ['ueln','UELN',['ueln','lebensnummer']],
    ['microchip','Mikrochip',['chip','mikrochip','transponder','microchip','chipnummer']],
    ['passport','Equidenpass-Nr.',['pass','equidenpass','passnummer','passnr','passport']],
    ['lat','Breitengrad',['lat','breitengrad','latitude','breite']],
    ['lng','Längengrad',['lng','lon','laengengrad','längengrad','longitude','laenge']],
    ['notes','Notiz',['notiz','notizen','bemerkung','bemerkungen','hinweis','notes']],
    ['fr_impfung','Impfung fällig',['impfungfällig','impfungfaellig','nächsteimpfung','naechsteimpfung','impfung']],
    ['fr_wurm','Entwurmung fällig',['entwurmungfällig','wurmkur','entwurmung']],
    ['fr_zahn','Zahnkontrolle fällig',['zahnkontrolle','zähne','zahn']],
  ],
  _norm(s){ return String(s||'').toLowerCase().replace(/^﻿/,'').replace(/[^a-z0-9äöüß]/g,''); },
  /* Excel unter Windows speichert CSV oft in Windows-1252 – als UTF-8 gelesen
     würden aus „Müller“ Fragezeichen. Erst streng UTF-8, sonst 1252. */
  async text(datei){
    const b=await datei.arrayBuffer();
    try{ return new TextDecoder('utf-8',{fatal:true}).decode(b); }catch(e){ return new TextDecoder('windows-1252').decode(b); }
  },
  /* RFC-4180-Leser: Trennzeichen ; , oder Tab, Anführungszeichen, Zeilenumbrüche in Feldern. */
  zerlege(text){
    const t=String(text).replace(/^﻿/,'');
    const kopf=t.split(/\r?\n/)[0]||'';
    const zahl=c=>kopf.split(c).length;
    const trenn=[';','\t',','].sort((a,b)=>zahl(b)-zahl(a))[0];
    const zeilen=[]; let z=[], f='', inQ=false;
    for(let i=0;i<t.length;i++){
      const c=t[i];
      if(inQ){ if(c==='"'){ if(t[i+1]==='"'){ f+='"'; i++; } else inQ=false; } else if(c==='\r'&&t[i+1]==='\n'){ f+='\n'; i++; } else f+=c; continue; }
      if(c==='"') inQ=true;
      else if(c===trenn){ z.push(f); f=''; }
      else if(c==='\n'||c==='\r'){ if(c==='\r'&&t[i+1]==='\n') i++; z.push(f); f=''; if(z.some(x=>x.trim())) zeilen.push(z.map(x=>x.trim())); z=[]; }
      else f+=c;
    }
    z.push(f); if(z.some(x=>x.trim())) zeilen.push(z.map(x=>x.trim()));
    return zeilen;
  },
  /* Spalte → Feld. Jede Spalte bekommt das Feld mit dem SPEZIFISCHSTEN Treffer (exakt vor „enthält“, längeres
     Muster vor kürzerem): „Besitzer Vorname“ ist der Vorname, nicht die Halterin. Jedes Feld höchstens einmal. */
  zuordnen(kopf){
    const k=kopf.map(h=>this._norm(h)), map=kopf.map(()=>''), kand=[];
    k.forEach((h,i)=>{ for(const [feld,,muster] of this.FELDER) for(const m of muster){ const n=this._norm(m);
      if(h===n) kand.push({i,feld,w:1000+n.length}); else if(n.length>=4&&h.includes(n)) kand.push({i,feld,w:n.length+(feld==='vorname'||feld==='nachname'?20:0)}); } });   // „Besitzer Vorname“ = Vorname
    kand.sort((a,b)=>b.w-a.w); const belegt=new Set();
    for(const x of kand){ if(map[x.i]||belegt.has(x.feld)) continue; map[x.i]=x.feld; belegt.add(x.feld); }
    /* Eine Spalte nur „Name“: mit Halterin-Spalte ist es das Pferd, sonst die Halterin (reines Adressbuch). */
    const iName=k.findIndex((h,j)=>!map[j]&&(h==='name'||h==='namen'));
    if(iName>=0) map[iName]=belegt.has('name')?(belegt.has('owner')?'':'owner'):(belegt.has('owner')||belegt.has('nachname')?'name':'owner');
    return map;
  },
  zeilenZuDaten(zeilen,map){
    return zeilen.map(z=>{
      const d={}; map.forEach((feld,i)=>{ if(feld&&z[i]) d[feld]=(d[feld]?d[feld]+' ':'')+z[i]; });
      if(!d.owner&&(d.vorname||d.nachname)) d.owner=[d.vorname,d.nachname].filter(Boolean).join(' ');
      d.place=[d.street,[d.plz,d.ort].filter(Boolean).join(' ')].filter(Boolean).join(', ');
      /* Datum aus Excel: 12.04.2026, 12.4.26 oder 2026-04-12 → ISO */
      for(const k of ['fr_impfung','fr_wurm','fr_zahn']) if(d[k]){ const m=String(d[k]).match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/); const iso=m?`${m[3].length===2?'20'+m[3]:m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:(/^\d{4}-\d{2}-\d{2}$/.test(d[k])?d[k]:''); if(iso) d[k]=iso; else delete d[k]; }
      return d;
    });
  },
};
if(typeof window!=='undefined') window.BestandKern=BestandKern;
