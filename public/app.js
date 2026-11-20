/* Fire Angel · edición 2026 · lector */
'use strict';
const FA=window.FA, P={}, CH={}, ORDER=[];
FA.chapters.forEach(c=>{CH[c.id]=c;c.pages.forEach(id=>ORDER.push(id));});
FA.pages.forEach(p=>P[p.id]=p);
const main=document.getElementById('main');
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const md=s=>s.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/(^|[^*])\*([^*]+?)\*(?!\*)/g,'$1<em>$2</em>');
const ico=(n,cls='')=>`<svg class="${cls}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
let store=null;try{store=window.localStorage;store.getItem('x');}catch(e){store=null;}
const sget=k=>{try{return store?store.getItem(k):null}catch(e){return null}};
const sset=(k,v)=>{try{store&&store.setItem(k,v)}catch(e){}};

const META={
 intro:{ico:'intro',bg:'portada',txt:'Qué es Fire Angel, qué necesitas para jugar y la regla de oro del sistema.'},
 historia:{ico:'historia',bg:'ano-cero',txt:'De la lluvia de meteoritos a la Segunda Gran Guerra: Maestro, los Genos, Krayhem y la traición de la Coalición.'},
 mundo:{ico:'mundo',bg:'mapa-zhedra-v2',txt:'El planeta, sus potencias, la Tierra de Nadie, los mares, los cultos y la tecnología del año 791 d. I.'},
 personajes:{ico:'personajes',bg:'gente-tierra-de-nadie',txt:'La creación paso a paso y las doce clases de personaje, de los Dientes de Sable a los Psíquicos.'},
 reglas:{ico:'reglas',bg:'ficha',txt:'Tiradas, combate, salud física y mental y vehículos.'},
 equipo:{ico:'equipo',bg:'mundo-sumret',txt:'Dinero, objetos, el arsenal completo, la tecnología drushal y las armaduras.'},
 master:{ico:'master',bg:'mundo-telhonia',txt:'Cómo dirigir, tipos de campaña, ganchos, tablas para improvisar y una aventura introductoria.'},
 bestiario:{ico:'bestiario',bg:'criatura-karchaer',txt:'La fauna de Zhedra y los enemigos más habituales, con perfiles listos para jugar.'},
 sistema2:{ico:'reglas',bg:'ficha',txt:'Variante táctica opcional: tablero, miniaturas, grados de éxito, relojes y un arsenal ampliado con rasgos.'},
 cuentos:{ico:'cuentos',bg:'relato-wallhaunt',txt:'Relatos ambientados en Zhedra para inspirar partidas.'},
 apendices:{ico:'apendices',bg:'mundo-leidaran',txt:'Glosario, notas de diseño, diarios de la primera partida, material pendiente y créditos.'}
};
const NUMS={};let n=0;FA.chapters.forEach(c=>{if(c.id==='intro'||c.id==='apendices')return;if(c.id==='sistema2'){let j=0;c.pages.forEach(id=>{NUMS[id]='S'+(++j);});return;}n++;let k=0;c.pages.forEach(id=>{if(P[id].parent&&P[id].parent!=='clases-de-personaje'&&P[id].kind==='clase'&&['piroquineticos','telepatas','telequineticos','fisioquineticos'].includes(id))return;NUMS[id]=n+'.'+(++k);});});

/* ---------- glosario ---------- */
const GL=(P.glosario?P.glosario.blocks:[]).filter(b=>b.k==='li').map(b=>{const m=b.t.match(/^\*\*(.+?)\*\*:\s*(.*)$/);return m?[m[1],m[2]]:null;}).filter(Boolean)
 .flatMap(([t,d])=>t.split(/\s*\/\s*/).map(x=>[x,d])).filter(([t])=>t.length>2&&!/^(PV|PNJ|CaC)$/.test(t));
const GLRX=GL.sort((a,b)=>b[0].length-a[0].length).map(([t,d])=>[new RegExp('(^|[^\\p{L}>])('+t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')(?![\\p{L}])','u'),d]);
let glUsed;
function gloss(h){if(!glUsed)return h;const tok=[];
 for(const [rx,d] of GLRX){const k=rx.source;if(glUsed.has(k))continue;
  if(rx.test(h)){h=h.replace(rx,(m,a,t)=>{tok.push(`<abbr class="gl" tabindex="0" data-tip="${esc(d)}">${t}</abbr>`);return a+'\u0001'+(tok.length-1)+'\u0002';});glUsed.add(k);}}
 return h.replace(/\u0001(\d+)\u0002/g,(m,i)=>tok[+i]);}

/* ---------- bloques ---------- */
const D20=ico('reglas');
let hid=0;
function para(b){
 if(/^Ejemplo[.:]/.test(b.t)){const t=b.t.replace(/^Ejemplo[.:]\s*/,'');return `<div class="ejemplo">${D20}<div><b>Ejemplo</b><p>${gloss(md(esc(t)))}</p></div></div>`;}
 let h=b.l?`<strong class="lead">${esc(b.t.slice(0,b.l))}</strong>${gloss(esc(b.t.slice(b.l)))}`:gloss(md(esc(b.t)));
 if(b.f==='i')h=`<em>${h}</em>`; if(b.f==='b')h=`<strong>${h}</strong>`;
 return `<p>${h}</p>`;
}
function tableHTML(id){
 const T=FA.tables[id];if(!T)return '';
 return `<div class="tw rv"><table><caption>${esc(T.title)}</caption><thead><tr>${T.head.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${T.rows.map(r=>`<tr>${r.map((c,i)=>i===0?`<th scope="row">${esc(c)}</th>`:`<td>${gloss(esc(c))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>${T.note?`<p class="tnote">${esc(T.note)}</p>`:''}`;
}
const ATN={fue:'Fue',int:'Int',con:'Con',des:'Des',per:'Per',conoc:'Conoc'};
function statHTML(id){
 const s=FA.bestiary.find(x=>x.id===id);if(!s)return '';
 return `<article class="stat rv" aria-label="Perfil de ${esc(s.n)}"><header><h5>${esc(s.n)}</h5><span class="meta">${esc(s.tipo)} · Iniciativa ${s.ini}</span><span class="am am-${s.am}">Amenaza ${s.am.toLowerCase()}</span></header>
 <div class="attrs">${Object.entries(s.at).map(([k,v])=>`<div><b>${v}</b><span>${ATN[k]}</span></div>`).join('')}</div>
 <div class="rows"><p><b>Puntos de Vida</b></p><div class="pv">${Object.entries(s.pv).map(([k,v])=>`<span>${esc(k)} ${v}</span>`).join('')}</div>
 <p><b>Habilidades:</b> ${s.hab.map(h=>`${esc(h[0])} ${h[1]}`).join(' · ')}</p>
 <table><thead><tr><th>Ataque</th><th>Daño</th><th>Tipo</th><th>Notas</th></tr></thead><tbody>${s.armas.map(a=>`<tr><td>${esc(a[0])}</td><td class="n">${esc(a[1])}</td><td>${esc(a[2])}</td><td>${esc(a[3])}</td></tr>`).join('')}</tbody></table>
 ${s.arm?`<p><b>Absorción:</b> ${esc(s.arm)}</p>`:''}${s.esp.map(e=>`<p>${md(esc(e))}</p>`).join('')}</div></article>`;
}
function toolHTML(id){
 if(id==='catalogo2')return catalogo2();
 if(id==='builder-cta')return `<div class="cta rv">${ico('forge')}<div><b>Creador de personajes</b><p>Sigue los pasos con cálculo automático de puntos, atributos, Puntos de Vida y equipo. Al terminar puedes imprimir la ficha o guardarla.</p></div><a class="btn accent" href="#creador">Abrir el creador ${ico('arrow')}</a></div>`;
 if(id==='generador')return `<div class="gen rv" id="gen"><div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center"><b style="font:700 22px var(--fd);text-transform:uppercase;flex:1">Generador de aventuras</b><button class="btn accent small" type="button" id="genGo">${ico('dice')}Generar aventura</button></div><ol id="genOut" aria-live="polite"><li style="animation:none"><span class="muted" style="grid-column:1/-1">Pulsa el botón para tirar en las seis tablas a la vez.</span></li></ol></div>`;
 return '';
}
function blocks(list){
 let out='',ul=null;
 const flush=()=>{if(ul){out+=`<ul class="list">${ul}</ul>`;ul=null;}};
 for(const b of list){
  if(b.k==='li'){ul=(ul||'')+`<li>${gloss(md(esc(b.t)))}</li>`;continue;}
  flush();
  switch(b.k){
   case 'h3':out+=`<h3 id="s${++hid}">${esc(b.t.replace(/\.$/,''))}</h3>`;break;
   case 'h4':out+=`<h4 id="s${++hid}">${esc(b.t.replace(/\.$/,''))}</h4>`;break;
   case 'story':out+=`<blockquote class="relato"><p>${md(esc(b.t))}</p></blockquote>`;break;
   case 'side':out+=`<aside class="registro">${md(esc(b.t))}</aside>`;break;
   case 'quote':out+=`<p class="pquote">${esc(b.t)}</p>`;break;
   case 'fig':out+=`<figure class="fig rv${/^(emblema|bandera|banda)-/.test(b.src)?' sm':''}"><a href="img/libro/${b.src}${b.src==='mapa-zhedra-v2'?'-full':''}.jpg" target="_blank" rel="noopener" aria-label="${esc(b.t)}: abrir a tamaño completo"><img src="img/libro/${b.src}.jpg?v=3" alt="${esc(b.t)}" loading="lazy"></a><figcaption>${esc(b.t)}</figcaption></figure>`;break;
   case 'wtable':break;
   case 'atable':out+=atable(b);break;
   case 'table':out+=tableHTML(b.id);break;
   case 'stats':out+=b.ids.map(statHTML).join('');break;
   case 'tool':out+=toolHTML(b.id);break;
   default:out+=para(b);
  }
 }
 flush();return out;
}
function atable(b){
 let h='<div class="tw rv"><table><caption>Tabla de armaduras</caption><thead><tr><th scope="col">Armadura</th><th scope="col">Piernas</th><th scope="col">Brazos</th><th scope="col">Torso</th><th scope="col">Cabeza</th></tr></thead><tbody>';
 b.groups.forEach(([g,neg,rows])=>{h+=`<tr class="g"><th colspan="5" scope="rowgroup">${esc(g)} · <span style="color:var(--muted);text-transform:none;letter-spacing:0;font-weight:500">${esc(neg)}</span></th></tr>`;
  rows.forEach(r=>{h+=`<tr><th scope="row">${esc(r[0])}</th>`;for(let i=1;i<9;i+=2)h+=`<td>${r[i]?`${r[i]} P.I. <span class="muted">· ${r[i+1]} ak.</span>`:'<span class="muted">—</span>'}</td>`;h+='</tr>';});});
 return h+'</tbody></table></div><p class="tnote">Cada celda indica los puntos de impacto (P.I.) que absorbe la pieza y su precio en akradios.</p>';
}
function arsenal(tables){
 const rows=[];tables.forEach(t=>{const cat=t.title.replace('Armamento ','');t.groups.forEach(([g,rs])=>rs.forEach(r=>rows.push({cat:cat[0].toUpperCase()+cat.slice(1),g,r})));});
 const notes=tables.filter(t=>t.note).map(t=>`<b>${esc(t.title)}:</b> ${esc(t.note)}`).join(' ');
 setTimeout(()=>arsenalInit(rows),0);
 return `<h3 id="s${++hid}">Arsenal</h3>
 <div class="filters" role="group" aria-label="Filtrar armas"><label for="arsq" class="sr">Buscar arma</label><input id="arsq" type="search" placeholder="Buscar arma o tipo de daño…">
 ${['Todas','Ligero','Medio','Pesado'].map((c,i)=>`<button class="chip" type="button" data-cat="${c}" aria-pressed="${i===0}">${c}</button>`).join('')}
 ${['Todo','Cuerpo a cuerpo','A distancia','Explosivos'].map((c,i)=>`<button class="chip" type="button" data-grp="${c}" aria-pressed="${i===0}">${c}</button>`).join('')}
 <span class="count" id="arsc" aria-live="polite"></span></div>
 <div class="tw"><table id="arst"><caption class="sr">Arsenal de Zhedra</caption><thead><tr>${['Arma','Categoría','Alcance','Daño','Tipo de daño','Cargador','Cadencia','Precio'].map((h,i)=>`<th scope="col" aria-sort="none"><button type="button" data-col="${i}">${h}</button></th>`).join('')}</tr></thead><tbody></tbody></table></div>
 <p class="tnote">${notes} Precios en akradios. CaC: cuerpo a cuerpo.</p>`;
}
function arsenalInit(rows){
 const tb=document.querySelector('#arst tbody');if(!tb)return;
 let cat='Todas',grp='Todo',q='',sort=null,dir=1;
 const nz=s=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
 const val=(x,c)=>{const r=x.r;switch(c){case 0:return r[0];case 1:return ['Ligero','Medio','Pesado'].indexOf(x.cat);case 2:{const m=String(r[1]).match(/(\d+)/);return r[1]==='CaC'?0:m?+m[1]:0;}case 3:return r[2];case 4:return r[3];case 5:return parseInt(r[4])||0;case 6:return parseInt(r[5])||0;case 7:return parseInt(String(r[6]).replace(/\./g,''))||0;}};
 function draw(){
  const nq=nz(q);
  let list=rows.filter(x=>(cat==='Todas'||x.cat===cat)&&(grp==='Todo'||x.g===grp)&&(!nq||nz(x.r[0]+' '+x.r[3]).includes(nq)));
  if(sort!==null)list=list.slice().sort((a,b)=>{const A=val(a,sort),B=val(b,sort);return (typeof A==='number'?A-B:String(A).localeCompare(String(B),'es'))*dir;});
  tb.innerHTML=list.map(x=>`<tr><th scope="row">${esc(x.r[0])}</th><td><span class="tag">${x.cat}</span></td><td>${esc(x.r[1])}</td><td>${esc(x.r[2])}</td><td>${esc(x.r[3])}</td><td class="n">${esc(x.r[4])}</td><td class="n">${esc(x.r[5])}</td><td class="n">${esc(x.r[6])}</td></tr>`).join('')||'<tr><td colspan="8">Ningún arma coincide. Prueba con otro término o pulsa «Todas».</td></tr>';
  document.getElementById('arsc').textContent=list.length+' armas';
 }
 document.getElementById('arsq').addEventListener('input',e=>{q=e.target.value;draw();});
 document.querySelectorAll('[data-cat]').forEach(b=>b.addEventListener('click',()=>{cat=b.dataset.cat;document.querySelectorAll('[data-cat]').forEach(x=>x.setAttribute('aria-pressed',x===b));draw();}));
 document.querySelectorAll('[data-grp]').forEach(b=>b.addEventListener('click',()=>{grp=b.dataset.grp;document.querySelectorAll('[data-grp]').forEach(x=>x.setAttribute('aria-pressed',x===b));draw();}));
 document.querySelectorAll('#arst th button').forEach(b=>b.addEventListener('click',()=>{const c=+b.dataset.col;dir=sort===c?-dir:1;sort=c;document.querySelectorAll('#arst th').forEach(th=>th.setAttribute('aria-sort','none'));b.parentNode.setAttribute('aria-sort',dir>0?'ascending':'descending');draw();}));
 draw();
}
const keyOf=t=>t.toLowerCase().replace(/[.:]/g,'').trim();
function classBody(p){
 const seg=[];let cur={h:null,b:[]};
 p.blocks.forEach(b=>{if(b.k==='h4'){seg.push(cur);cur={h:b,b:[]};}else cur.b.push(b);});seg.push(cur);
 const stats=[];let body='';
 seg.forEach(s=>{
  const k=s.h?keyOf(s.h.t):'';
  if(k==='reglas especiales'&&!s.b.length)return;
  if(k==='atributos'||k==='cuerpo y mente'||k==='habilidades afines'){
   stats.push([s.h.t.replace(/\.$/,''),s.b.map(b=>{const t=b.t.replace(/\.$/,'');const c=/^\+/.test(t)?'up':/^[-−]/.test(t)?'down':/^Usa /.test(t)?'res':'';return `<span class="st ${c}">${esc(t)}</span>`;}).join('')]);return;}
  if(['habilidades adquiridas','dones','acciones de combate','acciones'].includes(k)&&s.b.length&&s.b.every(b=>b.l||b.k!=='body')){
   body+=`<h4 id="s${++hid}">${esc(s.h.t.replace(/\.$/,''))}</h4><div class="cards">`+s.b.filter(b=>b.k==='body').map(b=>`<div class="card rv"><b>${esc(b.t.slice(0,b.l).replace(/\.$/,''))}</b><p>${gloss(esc(b.t.slice(b.l)))}</p></div>`).join('')+'</div>';
   const rest=s.b.filter(b=>b.k!=='body');if(rest.length)body+=blocks(rest);return;}
  body+=(s.h?blocks([s.h]):'')+blocks(s.b);
 });
 return {stats,body};
}


/* ---------- Sistema 2.0: tabs y catálogo ---------- */
function sysTabs(active){
 return `<nav class="systabs" aria-label="Sistema de juego"><a href="#reglas"${active==='v1'?' aria-current="page"':''}><b>Sistema clásico</b><small>v1 · Iniciativa, ataques por turno, PV por zonas</small></a><a href="#sistema2"${active==='v2'?' aria-current="page"':''}><b>Sistema 2.0</b><small>Nuevo · tablero, acciones y relojes</small></a></nav>`;
}
function sysOf(chId){return (chId==='reglas'||chId==='equipo')?'v1':chId==='sistema2'?'v2':null;}
let C2={q:'',o:'Todas',c:'Todas'};
function tip2(k){const S=FA.sistema2,key=k.replace(/\d+/g,'N');const d=S.rasgos[k]||S.rasgos[key];return d?`<abbr class="gl" tabindex="0" data-tip="${esc(d)}">${esc(k)}</abbr>`:esc(k);}
const orig2=o=>o==='nuevo'?'<span class="newtag">nuevo</span>':'v1';
function catalogo2(){
 const S=FA.sistema2;if(!S)return '';
 setTimeout(catInit,0);
 const cap=t=>t.charAt(0).toUpperCase()+t.slice(1);
 const arm=S.armaduras.map(a=>`<tr><th scope="row">${esc(a.n)}</th><td><span class="tag">${esc(a.clase)}</span></td>${['torso','brazos','piernas','cabeza'].map(z=>`<td class="n">${a.reduccion[z]} <span class="muted">(${a.absorcion[z]})</span></td>`).join('')}<td>${esc(a.negativos)}</td></tr>`).join('');
 const esq=S.escudos.map(e=>`<tr><th scope="row">${esc(e.n)}</th><td>${esc(e.req)}</td><td class="n">${e.reduccion} <span class="muted">(${e.absorcion_v1})</span></td></tr>`).join('');
 const mej=S.mejoras.map(m=>`<tr><th scope="row">${esc(m.n)}</th><td>${esc(m.aplica)}</td><td>${esc(m.ranura)}</td><td>${esc(m.efecto)}</td><td class="n">${m.precio}</td><td>${orig2(m.origen)}</td></tr>`).join('');
 const mun=S.municion.map(m=>`<tr><th scope="row">${esc(m.n)}</th><td>${esc(m.efecto)}</td><td class="n">${m.precio}</td><td>${orig2(m.origen)}</td></tr>`).join('');
 const eq=S.equipo.map(m=>`<tr><th scope="row">${esc(m.n)}</th><td>${esc(m.uso)}</td><td class="n">${m.precio}</td><td>${orig2(m.origen)}</td></tr>`).join('');
 const ras=Object.entries(S.rasgos).map(([k,v])=>`<div class="card rv"><b>${esc(k)}</b><p>${esc(v)}</p></div>`).join('');
 return `<h3 id="s${++hid}">Armas</h3>
 <div class="filters" role="group" aria-label="Filtrar armas"><label for="c2q" class="sr">Buscar arma</label><input id="c2q" type="search" placeholder="Buscar arma, rasgo o tipo de daño…">
 ${['Todas','ligero','medio','pesado'].map(c=>`<button class="chip" type="button" data-c2c="${c}">${c==='Todas'?'Todas':cap(c)}</button>`).join('')}
 ${['Todas','v1','nuevo'].map(c=>`<button class="chip" type="button" data-c2o="${c}">${c==='Todas'?'Todo origen':c==='v1'?'Clásicas':'Nuevas'}</button>`).join('')}<span class="count" id="c2c" aria-live="polite"></span></div>
 <div class="tw"><table id="c2t"><caption class="sr">Armas del Sistema 2.0</caption><thead><tr><th scope="col">Arma</th><th scope="col">Daño</th><th scope="col">Tipo</th><th scope="col">Alcance</th><th scope="col">Carg.</th><th scope="col">Cad.</th><th scope="col">Rasgos</th><th scope="col">Precio</th><th scope="col">Origen</th></tr></thead><tbody></tbody></table></div>
 <p class="tnote">Daño: dados + Fuerza o Destreza si lo indica. Alcance en metros (cada casilla son 2 m). Carg.: disparos o cargas; Cad.: cadencia. Precios en akradios. Pasa el cursor o el foco por un rasgo para ver qué hace.</p>
 <h3 id="s${++hid}">Armaduras</h3>
 <div class="tw rv"><table><caption class="sr">Armaduras</caption><thead><tr><th scope="col">Armadura</th><th scope="col">Clase</th><th scope="col">Torso</th><th scope="col">Brazos</th><th scope="col">Piernas</th><th scope="col">Cabeza</th><th scope="col">Negativos</th></tr></thead><tbody>${arm}</tbody></table></div>
 <p class="tnote">Cada celda indica la reducción por impacto en el Sistema 2.0 y, entre paréntesis, la absorción clásica (reducción = absorción ÷ 3, redondeando hacia arriba). Los precios por pieza están en la tabla clásica de Defensas.</p>
 <h3 id="s${++hid}">Escudos</h3>
 <div class="tw rv"><table><caption class="sr">Escudos</caption><thead><tr><th scope="col">Escudo</th><th scope="col">Requisito</th><th scope="col">Reducción</th></tr></thead><tbody>${esq}</tbody></table></div>
 <p class="tnote">Se usan con la reacción: Combate Con Armas contra cualquier ataque; con éxito el ataque baja un grado y la reducción del escudo se suma a la de la armadura. Entre paréntesis, la absorción clásica.</p>
 <h3 id="s${++hid}">Mejoras</h3>
 <div class="tw rv"><table><caption class="sr">Mejoras</caption><thead><tr><th scope="col">Mejora</th><th scope="col">Se monta en</th><th scope="col">Ranura</th><th scope="col">Efecto</th><th scope="col">Precio</th><th scope="col">Origen</th></tr></thead><tbody>${mej}</tbody></table></div>
 <p class="tnote">Cada arma tiene una ranura de accesorio, de boca, de cargador y de núcleo; cada armadura, de torso, de cabeza y general. Una mejora por ranura.</p>
 <h3 id="s${++hid}">Munición especial</h3>
 <div class="tw rv"><table><caption class="sr">Munición</caption><thead><tr><th scope="col">Tipo</th><th scope="col">Efecto</th><th scope="col">Precio por cargador</th><th scope="col">Origen</th></tr></thead><tbody>${mun}</tbody></table></div>
 <h3 id="s${++hid}">Equipo en el tablero y en escena</h3>
 <div class="tw rv"><table><caption class="sr">Equipo</caption><thead><tr><th scope="col">Objeto</th><th scope="col">Uso en el Sistema 2.0</th><th scope="col">Precio</th><th scope="col">Origen</th></tr></thead><tbody>${eq}</tbody></table></div>
 <h3 id="s${++hid}">Rasgos de arma</h3><div class="cards">${ras}</div>
 <h3 id="s${++hid}">Calor</h3><p>${esc(S.calor.regla)}</p>`;
}
function catInit(){
 const tb=document.querySelector('#c2t tbody');if(!tb)return;const S=FA.sistema2;
 const nz2=s=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
 function draw(){
  const q=nz2(C2.q);
  const list=S.armas.filter(a=>(C2.o==='Todas'||a.origen===C2.o)&&(C2.c==='Todas'||a.cat===C2.c)&&(!q||nz2(a.n+' '+(a.tipo||'')+' '+a.grupo+' '+a.rasgos.join(' ')).includes(q)));
  tb.innerHTML=list.map(a=>`<tr><th scope="row">${esc(a.n)}${a.nota?`<br><small class="muted">${esc(a.nota)}</small>`:''}</th><td class="n">${esc(a.dados)}${a.plano?' + '+a.plano:''}</td><td>${esc(a.tipo||'—')}</td><td>${esc(a.alcance||'—')}</td><td class="n">${esc(a.cargador||'—')}</td><td class="n">${a.cadencia||'—'}</td><td>${a.rasgos.map(tip2).join(', ')||'—'}</td><td class="n">${a.precio}</td><td>${orig2(a.origen)}</td></tr>`).join('')||'<tr><td colspan="9">Ningún arma coincide.</td></tr>';
  document.getElementById('c2c').textContent=list.length+' armas';
 }
 const qi=document.getElementById('c2q');qi.value=C2.q;qi.addEventListener('input',e=>{C2.q=e.target.value;draw();});
 [['c2o','o'],['c2c','c']].forEach(([attr,k])=>{const bs=document.querySelectorAll(`[data-${attr}]`);bs.forEach(b=>{b.setAttribute('aria-pressed',b.dataset[attr]===C2[k]);b.addEventListener('click',()=>{C2[k]=b.dataset[attr];bs.forEach(x=>x.setAttribute('aria-pressed',x===b));draw();});});});
 draw();
}

/* ---------- navegación ---------- */
function tree(){
 let h=`<div class="special"><a href="#creador">${ico('forge')}Creador de personajes</a><a href="#relatos">${ico('audio')}Relatos junto al fuego</a><a href="#juego">${ico('personajes')}Partidas online</a><a href="#mesa">${ico('dice')}Tablero táctico</a></div>`;
 FA.chapters.forEach(c=>{
  const M=META[c.id];
  h+=`<div class="grp" data-ch="${c.id}" data-open="false"><button class="ch" type="button" aria-expanded="false" aria-controls="t-${c.id}">${ico(M.ico)}<span><span class="n">${esc(c.num)}</span>${esc(c.title)}</span><svg class="chev" aria-hidden="true"><use href="#i-arrow"/></svg></button><ul id="t-${c.id}"><li><a href="#${c.id}" data-id="${c.id}">Presentación</a></li>`;
  c.pages.forEach(id=>{const p=P[id];const sub=['piroquineticos','telepatas','telequineticos','fisioquineticos'].includes(id);h+=`<li class="${sub?'sub':''}"><a href="#${id}" data-id="${id}">${esc(p.title)}</a></li>`;});
  h+='</ul></div>';
 });
 const t=document.getElementById('tree');t.innerHTML=h;
 t.querySelectorAll('.ch').forEach(b=>b.addEventListener('click',()=>{const g=b.parentNode;const o=g.dataset.open!=='true';g.dataset.open=o;b.setAttribute('aria-expanded',o);}));
}
function setNav(id){
 document.querySelectorAll('#tree a[aria-current]').forEach(a=>a.removeAttribute('aria-current'));
 const a=document.querySelector(`#tree a[data-id="${CSS.escape(id)}"]`)||document.querySelector(`.special a[href="#${CSS.escape(id)}"]`);
 document.querySelectorAll('#tree .grp').forEach(g=>{if(!a||g!==a.closest('.grp')){g.dataset.open='false';g.querySelector('.ch').setAttribute('aria-expanded','false');}});
 if(a){a.setAttribute('aria-current','page');const g=a.closest('.grp');if(g){g.dataset.open='true';g.querySelector('.ch').setAttribute('aria-expanded','true');}a.scrollIntoView({block:'nearest'});}
}
function chOf(id){return FA.chapters.find(c=>c.pages.includes(id));}

/* ---------- vistas ---------- */
const CLS=FA.pages.filter(p=>p.kind==='clase'&&p.img);
function home(){
 const M=META;
 main.innerHTML=`<div class="view-enter">
 <section class="hero" aria-labelledby="ht"><div class="bg" style="background-image:url(img/libro/portada.jpg)"></div>
  <div class="in"><div class="kick">Juego de rol de ciencia ficción · Edición 2026</div><h1 id="ht">Fire <span>Angel</span></h1>
  <p>Zhedra, año 791 después del Impacto. Las máquinas de Maestro duermen bajo la arena, la Coalición caza a los Genos que la salvaron y en la Tierra de Nadie cada ruina esconde algo que alguien quiere. Crea tu personaje y sal ahí fuera.</p>
  <div class="ctas"><a class="btn accent" href="#intro">${ico('intro')}Empieza aquí</a><a class="btn" href="#creador">${ico('forge')}Crear personaje</a><a class="btn" href="#relatos">${ico('audio')}Escuchar la historia</a></div></div></section>
 <section class="sec" aria-labelledby="h-start"><h2 id="h-start">Tu primera partida</h2><p class="lede">Cuatro pasos para pasar de no saber nada a lanzar dados en la Tierra de Nadie.</p>
  <div class="steps"><a class="rv" href="#intro"><b>Lee la introducción</b><span>Qué es el juego y la regla de oro: 1d20 por debajo de tu habilidad.</span></a><a class="rv" href="#trasfondo"><b>Conoce Zhedra</b><span>La historia en diez minutos: Maestro, los Genos y la gran traición.</span></a><a class="rv" href="#creador"><b>Crea tu personaje</b><span>El creador calcula atributos, puntos y equipo por ti.</span></a><a class="rv" href="#aventura"><b>Juega «Carga frágil»</b><span>Una aventura introductoria para el Maestro de Juego.</span></a></div></section>
 <section class="sec" aria-labelledby="h-ch"><h2 id="h-ch">El manual</h2><p class="lede">Diez capítulos reorganizados para leerse de principio a fin o consultarse en mitad de la partida.</p>
  <div class="chgrid">${FA.chapters.map(c=>`<a class="chcard rv" href="#${c.id}"><span class="ico">${ico(M[c.id].ico)}</span><small>${esc(c.num)}</small><b>${esc(c.title)}</b><span>${esc(M[c.id].txt)}</span></a>`).join('')}</div></section>
 <section class="sec" aria-labelledby="h-sys"><h2 id="h-sys">Dos formas de jugar</h2><p class="lede">Elige el sistema que encaje con tu mesa: el clásico de siempre o la variante táctica con tablero.</p>
  <div class="sysgrid"><a class="rv" href="#reglas"><small>Sistema clásico</small><b>Rápido, narrativo, letal</b><span>Un ataque por turno, puntos de vida por zonas y absorción de armadura. Sin tablero.</span></a><a class="rv" href="#sistema2"><small>Sistema 2.0 · nuevo</small><b>Táctico, con tablero</b><span>Grados de éxito, dos acciones, reacciones, relojes, minitableros y un arsenal ampliado.</span></a><a class="rv" href="#juego"><small>Partidas online · nuevo</small><b>Juega con tu grupo</b><span>Cuentas por invitación, campañas, fichas guardadas con equipo, peso y experiencia, notas del máster y una mesa con dados y chat en tiempo real.</span></a><a class="rv" href="#mesa"><small>Tablero táctico · nuevo</small><b>Tablero con niebla de guerra</b><span>Juega el Sistema 2.0 en un tablero por casillas: muros y puertas, cobertura, visión, ataques y daño calculados con las reglas.</span></a></div></section>
 <section class="sec" aria-labelledby="h-cl"><h2 id="h-cl">Doce formas de sobrevivir</h2><p class="lede">Humanos, Genos y psíquicos. Cada clase tiene sus atributos, habilidades y dones propios.</p>
  <div class="classes">${CLS.map(p=>`<a class="cls rv" href="#${p.id}"><img src="img/clases/${p.img}.jpg?v=2" alt="" loading="lazy"><span class="cap">${esc(p.title)}<small>${esc((p.quote||'').replace(/^[«"]|[»"].*$/g,'').slice(0,60))}</small></span></a>`).join('')}</div></section>
 <section class="sec"><div class="feature rv"><div><h3>Relatos junto al fuego</h3><p>Un viejo soldado sin bandera cuenta la historia de Zhedra a unos chavales junto a una hoguera en la Tierra de Nadie. Narraciones en audio con voces en castellano y transcripción sincronizada.</p><a class="btn accent" href="#relatos">${ico('audio')}Escuchar</a></div><img src="img/libro/relato-wallhaunt.jpg" alt="" loading="lazy"></div></section>
 </div>`;
 setNav('inicio');
}
function opener(c){const M=META[c.id];return `<header class="opener"><div class="bg" style="background-image:url(img/libro/${M.bg}.jpg?v=3)"></div><div class="in"><div class="ico">${ico(M.ico)}</div><div class="crumbs"><a href="#inicio">Inicio</a><span aria-hidden="true">/</span><span>${esc(c.num)}</span></div><h1>${esc(c.title)}</h1><p>${esc(M.txt)}</p></div></header>`;}
function chapter(c){
 main.innerHTML=`<div class="view-enter">${opener(c)}<div class="sec">${sysOf(c.id)?sysTabs(sysOf(c.id)):''}<div class="plist">${c.pages.map(id=>{const p=P[id];return `<a class="rv" href="#${id}"><span class="num">${NUMS[id]||''}</span><span>${esc(p.title)}${p.new?'<small>Nuevo en esta edición</small>':''}</span></a>`;}).join('')}</div></div></div>`;
 setNav(c.id);
}
function page(p){
 hid=0;glUsed=new Set(p.id==='glosario'?GLRX.map(x=>x[0].source):[]);
 const c=chOf(p.id),i=ORDER.indexOf(p.id),prev=P[ORDER[i-1]],next=P[ORDER[i+1]];
 const crumbs=`<div class="crumbs"><a href="#inicio">Inicio</a><span aria-hidden="true">/</span><a href="#${c.id}">${esc(c.num)} · ${esc(c.title)}</a></div>`;
 const stab=sysOf(c.id)?sysTabs(sysOf(c.id)):'';
 let body,head;
 if(p.kind==='clase'){
  const {stats,body:b}=classBody(p);body=b;
  head=`${crumbs}<div class="chero">${p.img?`<div class="port"><img src="img/clases/${p.img}.jpg?v=2" alt="Ilustración: ${esc(p.title)}"></div>`:''}<div><h1>${esc(p.title)}</h1>${p.quote?`<p class="pquote">${esc(p.quote)}</p>`:''}${stats.length?`<div class="sts">${stats.map(([t,h])=>`<div><b>${esc(t)}</b>${h}</div>`).join('')}</div>`:''}<a class="btn accent small" href="#creador/${p.parent==='psiquicos'?'psiquicos':p.id}">${ico('forge')}Crear un personaje de esta clase</a></div></div>`;
 }else{
  body=blocks(p.blocks);
  if(p.id==='armamento'){const w=p.blocks.filter(b=>b.k==='wtable');if(w.length)body+=arsenal(w);}
  head=`${crumbs}${stab}<h1 class="ptitle">${esc(p.title)}${p.new?'<span class="newtag">Nuevo</span>':''}</h1>${p.quote?`<p class="pquote">${esc(p.quote)}</p>`:''}`;
 }
 const pn=`<nav class="pnav" aria-label="Página anterior y siguiente">${prev?`<a href="#${prev.id}"><small>${ico('back')} Anterior</small><b>${esc(prev.title)}</b></a>`:''}${next?`<a class="next" href="#${next.id}"><small>Siguiente ${ico('arrow')}</small><b>${esc(next.title)}</b></a>`:''}</nav>`;
 main.innerHTML=`<div class="pg view-enter"><article class="wrap prose">${head}${body}${pn}</article><nav class="otoc" aria-label="En esta página"></nav></div>`;
 buildOtoc();setNav(p.id);
 const gb=document.getElementById('genGo');if(gb)gb.addEventListener('click',genRoll);
}
function buildOtoc(){
 const o=main.querySelector('.otoc');if(!o)return;const hs=[...main.querySelectorAll('.prose h3,.prose h4')];
 if(hs.length<3){o.remove();return;}
 o.innerHTML='<b>En esta página</b>'+hs.map(h=>`<a class="${h.tagName.toLowerCase()}" href="#" data-t="${h.id}">${esc(h.textContent)}</a>`).join('');
 o.querySelectorAll('a').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();const t=document.getElementById(a.dataset.t);t.scrollIntoView({behavior:reduce?'auto':'smooth'});t.setAttribute('tabindex','-1');t.focus({preventScroll:true});}));
 const io=new IntersectionObserver(es=>{es.forEach(e=>{if(e.isIntersecting){o.querySelectorAll('a').forEach(a=>a.classList.toggle('on',a.dataset.t===e.target.id));}});},{rootMargin:'-20% 0px -70% 0px'});
 hs.forEach(h=>io.observe(h));
}
function genRoll(){
 const ks=['gen-encargo','gen-cliente','gen-lugar','gen-complicacion','gen-pnj','gen-botin'],lb=['Encargo','Cliente','Lugar','Complicación','Rasgo del PNJ','Botín'];
 document.getElementById('genOut').innerHTML=ks.map((k,i)=>{const r=1+Math.floor(Math.random()*20);return `<li style="animation-delay:${i*70}ms"><b>${lb[i]}</b><i>${r}</i><span>${esc(FA.tables[k].rows[r-1][1])}</span></li>`;}).join('');
}
function relatos(sel){
 const R=window.RELATOS;if(!R){main.innerHTML='<div class="wrap"><p>Los relatos no están disponibles.</p></div>';return;}
 const L=R.lenos.find(x=>x.id===sel)||R.lenos[0];
 main.innerHTML=`<div class="fogata view-enter"><header class="opener"><div class="bg" style="background-image:url(img/libro/lunas.jpg)"></div><div class="flame" aria-hidden="true"></div><div class="in"><div class="ico">${ico('cuentos')}</div><div class="crumbs"><a href="#inicio">Inicio</a><span aria-hidden="true">/</span><span>Audio</span></div><h1>Relatos junto al fuego</h1><p>Un viejo soldado, una hoguera en la Tierra de Nadie y unos chavales que no saben estarse callados. La historia de Zhedra contada de viva voz.</p></div></header>
 <div class="wrapf"><nav class="lenos" aria-label="Leños">${R.lenos.map(x=>`<a href="#relatos/${x.id}"${x.id===L.id?' aria-current="page"':''}><b>${x.n}</b>${esc(x.title)}</a>`).join('')}</nav>
 <h2 style="font-size:40px;text-transform:uppercase">Leño ${L.n}: ${esc(L.title)}</h2>
 <audio id="lau" controls preload="metadata" src="${L.audio}">Tu navegador no puede reproducir este audio.</audio>
 <div class="cast"><span>El viejo · veterano sin bandera</span><span>Tavi · el novato</span><span>Nera · la escéptica</span></div>
 <div id="lines">${L.lines.map((l,i)=>`<div class="ln${l.who==='El viejo'?'':' kid'}" data-t="${l.t}" role="button" tabindex="0" aria-label="Ir a ${esc(l.who)}, segundo ${Math.round(l.t)}"><span class="w">${esc(l.who)}</span><p>${esc(l.text)}</p></div>`).join('')}</div>
 <p class="note">Pulsa cualquier intervención para saltar a ese momento. El relato se ciñe al trasfondo del manual; los detalles de color son del narrador, no canon.</p></div></div>`;
 const au=document.getElementById('lau'),ls=[...main.querySelectorAll('.ln')];
 ls.forEach(el=>{const go=()=>{au.currentTime=+el.dataset.t;au.play();};el.addEventListener('click',go);el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go();}});});
 au.addEventListener('timeupdate',()=>{let k=-1;ls.forEach((el,i)=>{if(au.currentTime>=+el.dataset.t-0.2)k=i;});ls.forEach((el,i)=>el.classList.toggle('on',i===k));});
 setNav('relatos');
}

/* ---------- router ---------- */
let lastId=null;
function route(){
 const raw=decodeURIComponent(location.hash.slice(1))||'inicio';const [id,arg]=raw.split('/');
 if(id==='creador'&&window.BUILDER){window.BUILDER.render(main,arg);setNav('creador');}
 else if(id==='juego'&&window.PLATAFORMA){window.PLATAFORMA.render(main,arg);setNav('juego');}
 else if(id==='mesa'&&window.MESA_UI){window.MESA_UI.render(main,arg);setNav('mesa');}
 else if(id==='relatos')relatos(arg);
 else if(P[id])page(P[id]);else if(CH[id])chapter(CH[id]);else home();
 document.title=(P[id]?P[id].title+' · ':CH[id]?CH[id].title+' · ':id==='creador'?'Creador de personajes · ':id==='mesa'?'Tablero táctico · ':id==='juego'?'Partidas online · ':'')+'Fire Angel';
 closeMenu();document.body.classList.toggle('en-mesa',id==='mesa');
 if(id!==lastId||!arg){window.scrollTo(0,0);}
 lastId=id;
 if(raw!=='inicio')main.focus({preventScroll:true});
 reveal();progress();
}
window.addEventListener('hashchange',route);
function reveal(){
 const els=main.querySelectorAll('.rv');if(reduce||!('IntersectionObserver' in window)){els.forEach(e=>e.classList.add('in'));return;}
 const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}}),{rootMargin:'0px 0px -6% 0px'});
 els.forEach(e=>io.observe(e));
}
window.FAreveal=reveal;
function progress(){const h=document.documentElement,m=h.scrollHeight-h.clientHeight;document.getElementById('prog').style.width=(m>0?h.scrollTop/m*100:0)+'%';document.getElementById('toTop').hidden=h.scrollTop<900;}
addEventListener('scroll',progress,{passive:true});
document.getElementById('toTop').addEventListener('click',()=>{window.scrollTo({top:0,behavior:reduce?'auto':'smooth'});main.focus({preventScroll:true});});

/* ---------- menú móvil ---------- */
const mb=document.getElementById('menuBtn'),scrim=document.getElementById('scrim');
function closeMenu(){document.body.classList.remove('open');mb.setAttribute('aria-expanded','false');mb.setAttribute('aria-label','Abrir índice');scrim.hidden=true;}
mb.addEventListener('click',()=>{const o=!document.body.classList.contains('open');document.body.classList.toggle('open',o);mb.setAttribute('aria-expanded',o);mb.setAttribute('aria-label',o?'Cerrar índice':'Abrir índice');scrim.hidden=!o;if(o)document.querySelector('#side a,#side button').focus();});
scrim.addEventListener('click',closeMenu);

/* ---------- tema ---------- */
const tb=document.getElementById('themeBtn');
function syncTheme(){const l=document.documentElement.dataset.theme==='light';tb.innerHTML=`<svg><use href="#i-${l?'moon':'sun'}"/></svg>`;tb.setAttribute('aria-label',l?'Cambiar a tema oscuro':'Cambiar a tema claro');}
tb.addEventListener('click',()=>{const l=document.documentElement.dataset.theme==='light';document.documentElement.dataset.theme=l?'dark':'light';sset('fa-theme',l?'dark':'light');syncTheme();});
if(!document.documentElement.dataset.theme&&matchMedia('(prefers-color-scheme: light)').matches)document.documentElement.dataset.theme='light';
syncTheme();

/* ---------- búsqueda ---------- */
const nz=s=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
const IDX=FA.pages.map(p=>{const t=p.blocks.map(b=>b.t||'').join(' · ');return {p,t,n:nz(p.title+' · '+t)};});
const q=document.getElementById('q'),res=document.getElementById('results');let sel=-1;
function search(s){
 const n=nz(s.trim());if(n.length<2){res.hidden=true;q.setAttribute('aria-expanded','false');return;}
 const hits=IDX.map(x=>{const i=x.n.indexOf(n);return i<0?null:{x,i,score:(nz(x.p.title).includes(n)?0:1)};}).filter(Boolean).sort((a,b)=>a.score-b.score).slice(0,9);
 res.innerHTML=hits.length?hits.map((h,k)=>{const off=Math.max(0,h.i-(h.x.p.title.length+3)-50);const sn=h.x.t.slice(off,off+150);const ni=nz(sn).indexOf(n);const snh=ni<0?esc(sn):esc(sn.slice(0,ni))+'<mark>'+esc(sn.slice(ni,ni+n.length))+'</mark>'+esc(sn.slice(ni+n.length));return `<a role="option" id="r${k}" href="#${h.x.p.id}" aria-selected="false"><b>${esc(h.x.p.title)}</b><small>${off?'…':''}${snh}…</small></a>`;}).join(''):'<p class="muted" style="padding:10px 12px;margin:0">Sin resultados.</p>';
 res.hidden=false;q.setAttribute('aria-expanded','true');sel=-1;
}
q.addEventListener('input',()=>search(q.value));
q.addEventListener('keydown',e=>{const as=[...res.querySelectorAll('a')];
 if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();sel=(sel+(e.key==='ArrowDown'?1:-1)+as.length)%as.length;as.forEach((a,i)=>a.setAttribute('aria-selected',i===sel));if(as[sel]){q.setAttribute('aria-activedescendant',as[sel].id);as[sel].scrollIntoView({block:'nearest'});}}
 else if(e.key==='Enter'&&as.length){e.preventDefault();location.hash=(as[sel]||as[0]).getAttribute('href');res.hidden=true;q.value='';q.blur();}
 else if(e.key==='Escape'){res.hidden=true;q.blur();}});
res.addEventListener('click',()=>{res.hidden=true;q.value='';});
document.addEventListener('click',e=>{if(!e.target.closest('.search'))res.hidden=true;});
document.addEventListener('keydown',e=>{if(e.key==='/'&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)){e.preventDefault();q.focus();}});

/* ---------- dados ---------- */
const dp=document.getElementById('dice'),db=document.getElementById('diceBtn'),dout=document.getElementById('dout'),dlog=document.getElementById('dlog');
function dOpen(o){dp.hidden=!o;db.setAttribute('aria-expanded',o);if(o)document.getElementById('dskill').focus();else db.focus();}
db.addEventListener('click',()=>dOpen(dp.hidden));document.getElementById('diceClose').addEventListener('click',()=>dOpen(false));
dp.addEventListener('keydown',e=>{if(e.key==='Escape')dOpen(false);});
const R=n=>1+Math.floor(Math.random()*n);
function show(big,cls,txt,log){dout.classList.remove('roll');void dout.offsetWidth;dout.classList.add('roll');dout.innerHTML=`<span class="big ${cls}">${big}</span><span>${txt}</span>`;const li=document.createElement('li');li.textContent=log;dlog.prepend(li);while(dlog.children.length>12)dlog.lastChild.remove();}
const dsys=document.getElementById('dsys');if(dsys){dsys.value=sget('fa-dsys')||'v1';dsys.addEventListener('change',()=>sset('fa-dsys',dsys.value));}
document.getElementById('dtestGo').addEventListener('click',()=>{const sk=+document.getElementById('dskill').value||0,m=+document.getElementById('dmod').value,t=sk+m,v2=dsys&&dsys.value==='v2',adv=v2?+document.getElementById('dadv').value:0;
 let r=R(20),r2=null,r1=r;if(adv){r2=R(20);r=adv>0?Math.min(r1,r2):Math.max(r1,r2);}
 let cls,txt;
 if(v2){const pl=window.FA2?FA2.umbralPleno(t):Math.ceil(t/2),g=window.FA2?FA2.grado(r,t):(r===20?'complicacion':(r===1||r<=pl)?'pleno':r<=t?'exito':'fallo');if(g==='complicacion'){cls='ko';txt='<b>Complicación.</b> Falla y el Maestro introduce un problema.';}else if(g==='pleno'){cls='crit';txt=`<b>Pleno</b> (${pl} o menos): dado de daño extra o maniobra.`;}else if(g==='exito'){cls='ok';txt=`<b>Éxito</b> (necesitabas ${t} o menos).`;}else{cls='ko';txt=`<b>Fallo</b> (necesitabas ${t} o menos).`;}
  show(r,cls,txt+(r2!==null?` <span class="muted">${adv>0?'Ventaja':'Desventaja'}: ${r1} y ${r2}.</span>`:''),`2.0 d20${adv>0?'↑':adv<0?'↓':''} ≤ ${t}: ${r}`);return;}
 if(r===20){cls='ko';txt='<b>Fallo crítico.</b> Algo sale muy mal.';}else if(r===sk){cls='crit';txt='<b>¡Acierto crítico!</b> Éxito máximo; ignora negativos.';}else if(r<=t){cls='ok';txt=`<b>Éxito</b> (necesitabas ${t} o menos).`;}else{cls='ko';txt=`<b>Fallo</b> (necesitabas ${t} o menos).`;}
 show(r,cls,txt,`d20 ≤ ${t}: ${r}`);});
if(dsys){const sync=()=>{document.getElementById('dadvw').hidden=dsys.value!=='v2';};dsys.addEventListener('change',sync);sync();}
dp.querySelectorAll('[data-d]').forEach(b=>b.addEventListener('click',()=>{const d=+b.dataset.d,r=R(d);show(r,'',d===100?'Porcentaje':`1d${d}`,`d${d===100?'%':d}: ${r}`);}));

/* ---------- glosario: tooltips ---------- */
const tip=document.getElementById('tip');
function tipShow(el){tip.textContent=el.dataset.tip;tip.hidden=false;const r=el.getBoundingClientRect();const w=tip.offsetWidth;tip.style.left=Math.max(8,Math.min(innerWidth-w-8,r.left+r.width/2-w/2))+'px';tip.style.top=(r.top>120?r.top-tip.offsetHeight-8:r.bottom+8)+'px';}
document.addEventListener('mouseover',e=>{const a=e.target.closest('abbr.gl');if(a)tipShow(a);});
document.addEventListener('mouseout',e=>{if(e.target.closest('abbr.gl'))tip.hidden=true;});
document.addEventListener('focusin',e=>{const a=e.target.closest&&e.target.closest('abbr.gl');if(a)tipShow(a);else tip.hidden=true;});
document.addEventListener('keydown',e=>{if(e.key==='Escape')tip.hidden=true;});
addEventListener('scroll',()=>{tip.hidden=true;},{passive:true});

window.FAapp={P,FA,esc,md,ico,sget,sset,reveal};
document.addEventListener('DOMContentLoaded',()=>{tree();route();});
