/* BAUKASTEN Produktseiten – Verhalten (16.11.2026): Leiste, FAQ-/Aufklapper-Zählung, Live-App im Gerät, Einblenden, Galerie. */
/* Mitlaufende Leiste (C6 Fable: „kein mitlaufender Knopf“) – erscheint, sobald der Kopf verlassen ist, verschwindet am Preis-Abschnitt. */
(function(){var l=document.getElementById('leiste'),k=document.querySelector('.hero'),p=document.getElementById('preis');if(!l||!k||!('IntersectionObserver' in window))return;
var imKopf=true,amPreis=false,b=l.querySelector('.leiste-b'),b2=l.querySelector('.leiste-b2'),de=(document.documentElement.lang||'de').indexOf('en')!==0,kauf=false,f=function(){l.hidden=imKopf||amPreis;};
addEventListener('scroll',function(){var h=document.documentElement,jetzt=(h.scrollTop+innerHeight/2)>h.scrollHeight*0.5;if(jetzt===kauf)return;kauf=jetzt;
 if(kauf){b.textContent=de?'Praxis-Abo wählen · 149 € →':'Choose practice plan · €149 →';b.href='/carlon-equine/app/?kasse=praxis';b2.textContent='Demo';b2.href='/carlon-equine/app/?demo=today';}
 else{b.textContent=de?'Demo öffnen →':'Open demo →';b.href='/carlon-equine/app/?demo=today';b2.textContent=de?'Tarife':'Plans';b2.href='#preis';}},{passive:true});
new IntersectionObserver(function(e){imKopf=e[0].isIntersecting;f();}).observe(k);
if(p)new IntersectionObserver(function(e){amPreis=e[0].isIntersecting;f();},{threshold:.15}).observe(p);})();

/* FAQ-Klicks zählen (GoatCounter, cookiefrei, ohne Personenbezug; je Aufruf einmal) – welche Frage interessiert? */
(function(){var sp=(document.documentElement.lang||'de').indexOf('en')===0?'en':'de',schon={};
document.querySelectorAll('details[data-spur-auf]').forEach(function(d){d.addEventListener('toggle',function(){
if(!d.open)return;var n=d.getAttribute('data-spur-auf');if(schon[n])return;var g=window.goatcounter;if(!g||!g.count)return;
schon[n]=1;g.count({path:'visite-'+sp+'/'+n,title:n,event:true});});});})();

/* Live-Akte im Gerät (16.11.2026, Jan: „Original-App, spulbar, zoombar – man muss sehen, was man kauft“).
   Erst Standbild (schnell), auf Tipp lädt das Cockpit selbst im Tablet-Format 1180×820 – exakt ins Glas eingepasst. */
(function(){document.querySelectorAll('.pz-live').forEach(function(box){var k=box.querySelector('.pz-start');if(!k)return;
k.addEventListener('click',function(){var img=box.querySelector('img');
var glas=document.createElement('div');glas.className='pz-glas';var f=document.createElement('iframe');f.src=box.getAttribute('data-app');f.title=k.textContent;
glas.appendChild(f);img.replaceWith(glas);k.remove();
var pass=function(){f.style.transform='scale('+(glas.clientWidth/1180)+')';};pass();addEventListener('resize',pass);
if(window.goatcounter&&goatcounter.count)goatcounter.count({path:'visite-live-akte',title:'live-akte',event:true});});});})();

(function(){var sel='section h2,section .sec-lead,.feature,.shots,.gurt-block,.pz-block,.beleg-breit,.tarif,.faq-liste,details.mehr.gross,.geraete';
var els=[].slice.call(document.querySelectorAll(sel)).filter(function(e){return !e.closest('.hero')&&!e.closest('.rv')});
if(!('IntersectionObserver' in window)||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
els.forEach(function(e){var b=e.getBoundingClientRect();if(b.top>innerHeight)e.classList.add('rv');});
var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}});},{rootMargin:'0px 0px -8% 0px'});
els.forEach(function(e){if(e.classList.contains('rv'))io.observe(e);});})();

/* Galerie – initGal (Kanon Breathwork/Research) auf jede Bildreihe angewandt */
(function(){document.querySelectorAll('.shots.three').forEach(function(vp){var slides=[].slice.call(vp.querySelectorAll('.shot'));if(slides.length<2)return;
var nav=document.createElement('div');nav.className='gal-nav';nav.innerHTML='<button class="gal-btn gal-prev" type="button" aria-label="Zurück">‹</button><span class="gal-meta"></span><button class="gal-btn gal-next" type="button" aria-label="Weiter">›</button>';vp.after(nav);
var meta=nav.querySelector('.gal-meta'),a=0,up=function(i){a=i;slides.forEach(function(x,j){x.classList.toggle('is-active',j===i);});meta.textContent=(i+1)+' / '+slides.length;};
var pl=false,waehle=function(){pl=false;var c=vp.getBoundingClientRect().left+vp.clientWidth/2,b=0,bd=1e9;slides.forEach(function(x,j){var r=x.getBoundingClientRect(),d=Math.abs(r.left+r.width/2-c);if(d<bd){bd=d;b=j;}});if(b!==a)up(b);};
vp.addEventListener('scroll',function(){if(!pl){pl=true;requestAnimationFrame(waehle);}},{passive:true});
var geh=function(i){i=Math.max(0,Math.min(slides.length-1,i));slides[i].scrollIntoView({behavior:'smooth',inline:'center',block:'nearest'});};
nav.querySelector('.gal-prev').onclick=function(){geh(a-1);};nav.querySelector('.gal-next').onclick=function(){geh(a+1);};up(0);});})();
