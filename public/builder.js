/* Fire Angel · creador de personajes */
'use strict';
(function(){
const {FA,esc,md,ico,sget,sset}=window.FAapp;const G=FA.game,RU=G.reglas;
const AT=G.atributos,ATN=Object.fromEntries(AT),AB={fue:'Fue',int:'Int',con:'Con',des:'Des',per:'Per',conoc:'Conoc'};
const PAIRS=G.pares;
const CL=Object.fromEntries(G.clases.map(c=>[c.id,c]));
const ATTRX={fuerza:'fue',constitución:'con',percepción:'per',inteligencia:'int',destreza:'des',conocimiento:'conoc'};
const attrIn=d=>{const m=String(d).match(/(?:Atributo|atributo|junto a(?:l)?)\s+(Fuerza|Constitución|Percepción|Inteligencia|Destreza|Conocimiento)/);return m?ATTRX[m[1].toLowerCase()]:'int';};
const STEPS=['Clase','Atributos','Hab. Generales','Hab. Adquiridas','Dones','Puntos gratuitos','Equipo','Ficha'];
const KEY='fa-pj';
const blank=()=>({name:'',player:'',concept:'',cls:'',casa:'',shift:{fue:0,con:0,per:0},gen:{},adq:{},adqTxt:{},donGen:'',donCls:'',pool:1,attrBuy:{},donExtra:[],atk:0,mer:[],def:[],inv:[],step:0});
let S=blank();try{const j=sget(KEY);if(j)S=Object.assign(blank(),JSON.parse(j));}catch(e){}
const save=()=>sset(KEY,JSON.stringify(S));

/* ---------- cálculos ---------- */
function cls(){return CL[S.cls];}
function attrs(){
 const c=cls(),o={};
 PAIRS.forEach(([a,b])=>{const k=a==='fue'?'fue':a==='con'?'con':'per';const d=S.shift[k]||0;o[a]=RU.attrBase+d;o[b]=RU.attrBase-d;});
 if(c)for(const [k,v] of Object.entries(c.mods))o[k]+=v;
 for(const [k,v] of Object.entries(S.attrBuy))o[k]+=v;
 return o;
}
function adqList(){
 const c=cls();const L=G.adq.map(s=>({id:s.id,n:s.n,a:s.a,d:s.d,var:s.var,af:!!c&&c.afines.includes(s.id)}));
 if(c){c.adq.forEach((s,i)=>L.unshift({id:'c-'+i,n:s.n,a:attrIn(s.d),d:s.d,cls:true,af:true}));}
 return L;
}
const aval=(A,a)=>a==='int|con'?Math.max(A.int,A.con):A[a];
function genSpent(){return Object.values(S.gen).reduce((a,b)=>a+b,0);}
function adqCosts(){const L=adqList(),costs=[];L.forEach(s=>{const v=S.adq[s.id]||0;for(let i=0;i<v;i++)costs.push(s.af?1:2);});costs.sort((a,b)=>b-a);let bud=RU.adqPts,over=0,used=0;costs.forEach(c=>{if(bud>=c){bud-=c;used+=c;}else over++;});return {used,over,total:costs.reduce((a,b)=>a+b,0)};}
function merCost(){return S.mer.reduce((a,n)=>a+(G.meritos.find(m=>m.n===n)||{c:0}).c,0);}
function defGain(){return S.def.reduce((a,n)=>a+(G.defectos.find(m=>m.n===n)||{c:0}).c,0);}
function freeUse(){
 const ac=adqCosts();
 const parts={pool:(S.pool-1)*RU.cost.pool,gen:Math.max(0,genSpent()-RU.genPts)*RU.cost.gen,adq:ac.over*RU.cost.adq,attr:Object.values(S.attrBuy).reduce((a,b)=>a+b,0)*RU.cost.attr,don:S.donExtra.length*RU.cost.don,atk:S.atk*RU.cost.ataque,mer:merCost()};
 const used=Object.values(parts).reduce((a,b)=>a+b,0),avail=RU.free+defGain();
 return {parts,used,avail,left:avail-used};
}
function derived(){
 const A=attrs(),c=cls()||{body:{pv:0,sf:0,sm:0},pool:'voluntad'};const dc=A.con-4+(c.body.pv||0);
 const z=RU.pv,pv={Cabeza:z.cabeza+dc,Pecho:z.pecho+dc,'Brazo izq.':z.brazoI+dc,'Brazo der.':z.brazoD+dc,'Pierna izq.':z.piernaI+dc,'Pierna der.':z.piernaD+dc};
 let sf=100+(c.body.sf||0),sm=100+(c.body.sm||0);
 if(S.mer.includes('Corpulento'))sf+=10;if(S.def.includes('Enclenque'))sf-=10;if(S.mer.includes('Calculador'))sm+=10;if(S.def.includes('Apasionado'))sm-=10;if(S.def.includes('Perturbado'))sm-=20;
 const dones=[S.donGen,...S.donExtra];
 const ini=A.int+A.des+(dones.includes('Reflejos')?1:0);
 const money=RU.money*(S.mer.includes('Adinerado')?2:1);
 const spent=S.inv.reduce((a,i)=>a+i.p*(i.q||1),0);
 return {A,pv,sf,sm,ini,atk:1+S.atk,pool:c.pool,poolMax:RU.poolMax[c.pool],money,spent};
}
function issues(){
 const out=[],A=attrs(),c=cls();
 if(!c)out.push([0,'Elige una clase.']);
 if(c&&c.id==='psiquicos'&&!S.casa)out.push([0,'Elige la academia de tu psíquico.']);
 if(!S.name.trim())out.push([0,'Ponle nombre a tu personaje.']);
 for(const [k,v] of Object.entries(A)){if(v>RU.attrMax)out.push([1,`${ATN[k]} supera el máximo de ${RU.attrMax}.`]);if(v<1)out.push([1,`${ATN[k]} no puede bajar de 1.`]);}
 if(genSpent()<RU.genPts)out.push([2,`Te quedan ${RU.genPts-genSpent()} puntos de Habilidades Generales por repartir.`]);
 G.gen.forEach(s=>{const t=(S.gen[s.id]||0)+aval(A,s.a);if(t>RU.genMax)out.push([2,`${s.n} supera el total máximo de ${RU.genMax}.`]);});
 const ac=adqCosts();if(ac.used<RU.adqPts&&ac.over===0)out.push([3,`Te quedan ${RU.adqPts-ac.used} puntos de Habilidades Adquiridas.`]);
 if(!S.donGen)out.push([4,'Elige un don general.']);if(!S.donCls)out.push([4,'Elige un don de clase.']);
 const f=freeUse();if(f.left<0)out.push([5,`Has gastado ${-f.left} puntos gratuitos de más.`]);
 if(S.mer.length>RU.maxMer||S.def.length>RU.maxDef)out.push([5,'Máximo 3 méritos y 3 defectos.']);
 if(S.pool>derived().poolMax)out.push([5,'Superas el máximo de Voluntad/Biofuerza.']);
 const d=derived();if(d.spent>d.money)out.push([6,`Te has pasado ${d.spent-d.money} akradios del presupuesto.`]);
 return out;
}

/* ---------- UI helpers ---------- */
function stepper(id,val,min,max,label){return `<span class="stp" role="group" aria-label="${esc(label)}"><button type="button" data-st="${id}" data-dv="-1" aria-label="Restar a ${esc(label)}" ${val<=min?'disabled':''}>−</button><output aria-live="polite">${val}</output><button type="button" data-st="${id}" data-dv="1" aria-label="Sumar a ${esc(label)}" ${val>=max?'disabled':''}>+</button></span>`;}
function bar(){
 const f=freeUse(),ac=adqCosts(),d=derived();
 const pill=(l,v,t,bad)=>`<span class="pill${bad?' bad':''}"><small>${l}</small><b>${v}</b>${t?`<i>/${t}</i>`:''}</span>`;
 return `<div class="bbar" aria-live="polite">${pill('Generales',RU.genPts-Math.min(genSpent(),RU.genPts),RU.genPts)}${pill('Adquiridas',RU.adqPts-ac.used,RU.adqPts)}${pill('Gratuitos',f.left,f.avail,f.left<0)}${pill('Akradios',d.money-d.spent,d.money,d.spent>d.money)}</div>`;
}
function nav(){return `<ol class="bsteps">${STEPS.map((s,i)=>`<li><button type="button" data-go="${i}" ${i===S.step?'aria-current="step"':''} class="${issues().some(x=>x[0]===i)?'warn':''}"><span>${i+1}</span>${s}</button></li>`).join('')}</ol>`;}

/* ---------- pasos ---------- */
function stepClase(){
 const c=cls();
 return `<h2>¿Quién eres en Zhedra?</h2><p class="muted">Elige una clase. Determina tus modificadores de atributo, tus habilidades afines y tus dones propios. Siempre puedes cambiarla después.</p>
 <div class="pick">${G.clases.map(k=>{const im=k.img||(k.id==='psiquicos'?'telepatas':k.id);return `<button type="button" class="pk" data-cls="${k.id}" aria-pressed="${S.cls===k.id}"><img src="img/clases/${im}.jpg?v=2" alt="" loading="lazy"><span><b>${esc(k.n)}</b><small>${Object.entries(k.mods).map(([a,v])=>`${v>0?'+':'−'}${Math.abs(v)} ${AB[a]}`).join(' · ')} · ${k.pool==='biofuerza'?'Biofuerza':'Voluntad'}</small></span></button>`;}).join('')}</div>
 ${c&&c.id==='psiquicos'?`<fieldset class="fs"><legend>Academia psíquica</legend><div class="radios">${c.casas.map(h=>`<label><input type="radio" name="casa" value="${h.id}" ${S.casa===h.id?'checked':''}> <b>${esc(h.n)}</b> <small>${esc((h.intro[0]||'').slice(0,110))}…</small></label>`).join('')}</div></fieldset>`:''}
 ${c?`<div class="clsinfo"><p>${md(esc(c.intro[0]||''))}</p><p class="muted"><b>Afines:</b> ${c.afines.map(a=>esc((G.adq.find(s=>s.id===a)||{n:a}).n)).join(', ')||'—'}${c.afinesGen?' <em>(propuesta de esta edición)</em>':''}</p><a href="#${c.id}">Leer la clase completa ${ico('arrow')}</a></div>`:''}
 <div class="grid2"><label class="fld">Nombre del personaje<input type="text" data-f="name" value="${esc(S.name)}" placeholder="Ej.: Woden" required></label><label class="fld">Jugador<input type="text" data-f="player" value="${esc(S.player)}"></label></div>
 <label class="fld">Concepto en una frase<input type="text" data-f="concept" value="${esc(S.concept)}" placeholder="Ej.: Trotamundos con demasiadas deudas y muy poca vergüenza"></label>`;
}
function stepAttr(){
 const A=attrs(),c=cls();
 return `<h2>Atributos enfrentados</h2><p class="muted">Todos empiezan en ${RU.attrBase}. Mueve cada control: subir un atributo baja su pareja. Después se aplican los modificadores de tu clase. Ningún atributo puede superar ${RU.attrMax}.</p>
 <div class="pairs">${PAIRS.map(([a,b])=>{const k=a;const d=S.shift[k]||0;return `<div class="pair"><div class="pv2"><span><b>${A[a]}</b>${esc(ATN[a])}${c&&c.mods[a]?` <i>${c.mods[a]>0?'+':''}${c.mods[a]} clase</i>`:''}</span><span><b>${A[b]}</b>${esc(ATN[b])}${c&&c.mods[b]?` <i>${c.mods[b]>0?'+':''}${c.mods[b]} clase</i>`:''}</span></div>
 <input type="range" min="-3" max="3" step="1" value="${d}" data-shift="${k}" aria-label="Reparto entre ${ATN[a]} y ${ATN[b]}" aria-valuetext="${ATN[a]} ${A[a]}, ${ATN[b]} ${A[b]}"><div class="rl"><span>← más ${esc(ATN[a])}</span><span>más ${esc(ATN[b])} →</span></div></div>`;}).join('')}</div>
 <div class="derived"><span>Iniciativa <b>${A.int+A.des}</b></span><span>PV extra por Constitución <b>${A.con-4>=0?'+':''}${A.con-4}</b></span></div>`;
}
function stepGen(){
 const A=attrs(),sp=genSpent();
 return `<h2>Habilidades Generales</h2><p class="muted">Reparte ${RU.genPts} puntos. El total de cada habilidad (puntos + atributo) no puede pasar de ${RU.genMax}. Si te pasas de ${RU.genPts}, cada punto extra cuesta ${RU.cost.gen} puntos gratuitos.</p>
 <div class="tw"><table class="sk"><thead><tr><th scope="col">Habilidad</th><th scope="col">Atributo</th><th scope="col">Puntos</th><th scope="col">Total</th></tr></thead><tbody>${G.gen.map(s=>{const v=S.gen[s.id]||0,at=aval(A,s.a),t=v+at;return `<tr><th scope="row" title="${esc(s.d)}">${esc(s.n)}</th><td>${s.a==='int|con'?'Int/Con':AB[s.a]} ${at}</td><td>${stepper('g:'+s.id,v,0,Math.max(0,RU.genMax-at),s.n)}</td><td class="n tot${t>RU.genMax?' bad':''}">${t}</td></tr>`;}).join('')}</tbody></table></div>
 <p class="muted">Puntos usados: <b>${sp}</b> de ${RU.genPts}${sp>RU.genPts?` (+${(sp-RU.genPts)*RU.cost.gen} gratuitos)`:''}.</p>`;
}
function stepAdq(){
 const A=attrs(),ac=adqCosts(),L=adqList();
 return `<h2>Habilidades Adquiridas</h2><p class="muted">Reparte ${RU.adqPts} puntos. Cada punto cuesta 2, o 1 si la habilidad es <span class="af">afín</span> a tu clase (las propias de la clase siempre lo son). Máximo ${RU.adqMax} por habilidad. Con 0 puntos no puedes usarla. Si te quedas corto, cada punto extra cuesta ${RU.cost.adq} gratuitos.</p>
 <div class="tw"><table class="sk"><thead><tr><th scope="col">Habilidad</th><th scope="col">Atributo</th><th scope="col">Coste</th><th scope="col">Puntos</th><th scope="col">Total</th></tr></thead><tbody>${L.map(s=>{const v=S.adq[s.id]||0,at=aval(A,s.a);return `<tr class="${s.cls?'own':''}"><th scope="row" title="${esc(s.d)}">${esc(s.n)}${s.cls?' <span class="af">clase</span>':s.af?' <span class="af">afín</span>':''}${s.var&&v?`<input class="vt" type="text" data-adqtxt="${s.id}" value="${esc(S.adqTxt[s.id]||'')}" placeholder="¿De qué?" aria-label="Especialidad de ${esc(s.n)}">`:''}</th><td>${s.a==='int|con'?'Int/Con':AB[s.a]} ${at}</td><td>${s.af?1:2}</td><td>${stepper('a:'+s.id,v,0,RU.adqMax,s.n)}</td><td class="n tot">${v?v+at:'—'}</td></tr>`;}).join('')}</tbody></table></div>
 <p class="muted">Coste usado: <b>${ac.used}</b> de ${RU.adqPts}${ac.over?` · ${ac.over} puntos pagados con gratuitos (${ac.over*RU.cost.adq})`:''}.</p>`;
}
function donList(){const c=cls();if(!c)return [];if(c.id==='psiquicos'){const h=c.casas.find(x=>x.id===S.casa);return h?h.dones:[];}return c.dones;}
function stepDones(){
 const cd=donList();
 return `<h2>Dones</h2><p class="muted">Elige un don general y un don de tu clase. Podrás comprar más con puntos gratuitos (${RU.cost.don} cada uno) o con experiencia.</p>
 <div class="grid2 gtop"><fieldset class="fs"><legend>Don general</legend><div class="radios">${G.dones.map(d=>`<label><input type="radio" name="dg" value="${esc(d.n)}" ${S.donGen===d.n?'checked':''}> <b>${esc(d.n)}</b><small>${esc(d.d)}</small></label>`).join('')}</div></fieldset>
 <fieldset class="fs"><legend>Don de clase</legend>${cd.length?`<div class="radios">${cd.map(d=>`<label><input type="radio" name="dc" value="${esc(d.n)}" ${S.donCls===d.n?'checked':''}> <b>${esc(d.n)}</b><small>${esc(d.d)}</small></label>`).join('')}</div>`:'<p class="muted">Elige primero una clase (y, si eres psíquico, tu academia).</p>'}</fieldset></div>`;
}
function stepFree(){
 const f=freeUse(),d=derived(),c=cls();
 const row=(l,v,t)=>`<tr><th scope="row">${l}</th><td class="n">${v}</td><td>${t||''}</td></tr>`;
 return `<h2>Puntos gratuitos, méritos y defectos</h2><p class="muted">Tienes ${RU.free} puntos gratuitos, más los que te den los defectos. Máximo ${RU.maxMer} méritos y ${RU.maxDef} defectos.</p>
 <div class="grid2 gtop"><div>
 <div class="tw"><table><caption>Compras</caption><tbody>
 <tr><th scope="row">${d.pool==='biofuerza'?'Biofuerza':'Voluntad'} <small class="muted">(1 c/u, máx. ${d.poolMax})</small></th><td>${stepper('pool',S.pool,1,d.poolMax,'reserva')}</td></tr>
 ${AT.map(([k,n])=>`<tr><th scope="row">+1 ${esc(n)} <small class="muted">(${RU.cost.attr})</small></th><td>${stepper('ab:'+k,S.attrBuy[k]||0,0,3,'+1 '+n)}</td></tr>`).join('')}
 <tr><th scope="row">Ataque extra <small class="muted">(${RU.cost.ataque})</small></th><td>${stepper('atk',S.atk,0,1,'ataque extra')}</td></tr>
 </tbody></table></div>
 <label class="fld">Don extra (${RU.cost.don} puntos)<select data-donx><option value="">Añadir un don…</option>${[...G.dones,...donList()].filter(x=>x.n!==S.donGen&&x.n!==S.donCls&&!S.donExtra.includes(x.n)).map(x=>`<option>${esc(x.n)}</option>`).join('')}</select></label>
 ${S.donExtra.length?`<p>${S.donExtra.map(n=>`<button type="button" class="chip" data-rmdon="${esc(n)}" aria-label="Quitar ${esc(n)}">${esc(n)} ✕</button>`).join(' ')}</p>`:''}
 <div class="tw"><table><caption>Resumen</caption><tbody>${row('Disponibles',f.avail)}${Object.entries({pool:'Reserva',gen:'Hab. Generales extra',adq:'Hab. Adquiridas extra',attr:'Atributos',don:'Dones extra',atk:'Ataques',mer:'Méritos'}).map(([k,l])=>f.parts[k]?row(l,'−'+f.parts[k]):'').join('')}<tr><th scope="row">Quedan</th><td class="n ${f.left<0?'bad':''}"><b>${f.left}</b></td></tr></tbody></table></div>
 </div><div>
 <fieldset class="fs"><legend>Méritos (${S.mer.length}/${RU.maxMer})</legend><div class="radios">${G.meritos.map(m=>`<label><input type="checkbox" data-mer="${esc(m.n)}" ${S.mer.includes(m.n)?'checked':''} ${!S.mer.includes(m.n)&&S.mer.length>=RU.maxMer?'disabled':''}> <b>${esc(m.n)}</b> <span class="cost">−${m.c}</span><small>${esc(m.d)}</small></label>`).join('')}</div></fieldset>
 <fieldset class="fs"><legend>Defectos (${S.def.length}/${RU.maxDef})</legend><div class="radios">${G.defectos.map(m=>`<label><input type="checkbox" data-def="${esc(m.n)}" ${S.def.includes(m.n)?'checked':''} ${!S.def.includes(m.n)&&S.def.length>=RU.maxDef?'disabled':''}> <b>${esc(m.n)}</b> <span class="cost up">+${m.c}</span><small>${esc(m.d)}</small></label>`).join('')}</div></fieldset>
 </div></div>`;
}
let shopTab='equipo',shopQ='';
function stepEquipo(){
 const d=derived(),c=cls();
 const nz=s=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
 let items=[];
 if(shopTab==='equipo')items=G.equipo.map(e=>({t:'e',n:e.n,p:e.p,info:e.cat.replace('Equipo ',''),d:e.d}));
 if(shopTab==='armas')items=G.armas.map(w=>({t:'w',n:w.r[0],p:parseInt(String(w.r[6]).replace(/\./g,''))||0,info:`${w.r[2]} ${w.r[3]} · ${w.r[1]}`,d:`${w.cat} · ${w.g}. Cargador ${w.r[4]}, cadencia ${w.r[5]}.`}));
 if(shopTab==='armaduras')items=G.armaduras.flatMap(([g,neg,rows])=>rows.map(r=>({t:'a',n:r[0],p:r[2]+r[4]+r[6]+r[8],info:`Torso ${r[5]} · Cabeza ${r[7]} · Brazos ${r[3]} · Piernas ${r[1]}`,d:`${g}. ${neg}.`,pi:{piernas:r[1],brazos:r[3],torso:r[5],cabeza:r[7]}})));
 const nq=nz(shopQ);items=items.filter(i=>!nq||nz(i.n+' '+i.info).includes(nq));
 return `<h2>Equipo inicial</h2><p class="muted">Empiezas con ${d.money} akradios y tu ropa. ${c&&c.kit?`Equipo típico de un ${esc(c.n.replace(/s$/,'').toLowerCase())}: <em>${esc(c.kit)}</em>.`:''}</p>
 <div class="grid2 gtop"><div><div class="filters" role="tablist" aria-label="Tienda">${[['equipo','Equipo'],['armas','Armas'],['armaduras','Armaduras']].map(([k,l])=>`<button type="button" role="tab" class="chip" data-tab="${k}" aria-selected="${shopTab===k}" aria-pressed="${shopTab===k}">${l}</button>`).join('')}<label class="sr" for="shopq">Buscar en la tienda</label><input id="shopq" type="search" value="${esc(shopQ)}" placeholder="Buscar…"></div>
 <ul class="shop">${items.map((i,k)=>`<li><div><b>${esc(i.n)}</b><small>${esc(i.info)}</small></div><span class="n">${i.p} ak.</span><button type="button" class="btn small" data-buy='${esc(JSON.stringify({t:i.t,n:i.n,p:i.p,info:i.info,pi:i.pi}))}' ${d.spent+i.p>d.money?'disabled':''} aria-label="Comprar ${esc(i.n)} por ${i.p} akradios">Añadir</button></li>`).join('')||'<li class="muted">Nada coincide.</li>'}</ul></div>
 <div><h3 class="mini">Inventario</h3>${S.inv.length?`<ul class="inv">${S.inv.map((i,k)=>`<li><span>${esc(i.n)}${i.q>1?` ×${i.q}`:''}<small>${esc(i.info||'')}</small></span><span class="n">${i.p*(i.q||1)} ak.</span><button type="button" class="ib" data-rm="${k}" aria-label="Quitar ${esc(i.n)}">${ico('close')}</button></li>`).join('')}</ul>`:'<p class="muted">Todavía no has comprado nada.</p>'}
 <p class="total">Gastado <b>${d.spent}</b> · Quedan <b class="${d.spent>d.money?'bad':''}">${d.money-d.spent}</b> akradios</p></div></div>`;
}
function sheet(){
 const d=derived(),A=d.A,c=cls(),L=adqList();
 const gen=G.gen.map(s=>[s.n,(S.gen[s.id]||0)+aval(A,s.a)]);
 const adq=L.filter(s=>S.adq[s.id]).map(s=>[s.n+(S.adqTxt[s.id]?` (${S.adqTxt[s.id]})`:''),S.adq[s.id]+aval(A,s.a)]);
 const arm=S.inv.filter(i=>i.t==='a');const wp=S.inv.filter(i=>i.t==='w');
 const casa=c&&c.id==='psiquicos'?(c.casas.find(h=>h.id===S.casa)||{}).n:'';
 const iss=issues();
 return `<div class="sheet" id="sheet"><header class="sh-h"><div><small>Fire Angel · Hoja de personaje</small><h2>${esc(S.name||'Sin nombre')}</h2><p>${esc(c?c.n:'Sin clase')}${casa?' · '+esc(casa):''}${S.concept?' — '+esc(S.concept):''}</p></div>${c&&c.img?`<img src="img/clases/${c.img}.jpg?v=2" alt="">`:''}</header>
 ${iss.length?`<div class="warnbox" role="status"><b>Pendiente:</b><ul>${iss.map(([s,t])=>`<li><button type="button" class="linkb" data-go="${s}">${esc(t)}</button></li>`).join('')}</ul></div>`:''}
 <div class="attrs big">${AT.map(([k,n])=>`<div><b>${A[k]}</b><span>${esc(n)}</span></div>`).join('')}</div>
 <div class="sh-g">
  <section><h3 class="mini">Combate</h3><dl class="kv"><dt>Iniciativa</dt><dd>${d.ini}</dd><dt>Ataques por turno</dt><dd>${d.atk}</dd><dt>${d.pool==='biofuerza'?'Biofuerza':'Voluntad'}</dt><dd>${S.pool}</dd><dt>Salud Física</dt><dd>${d.sf}%</dd><dt>Salud Mental</dt><dd>${d.sm}%</dd></dl>
  <h3 class="mini">Puntos de Vida</h3><dl class="kv">${Object.entries(d.pv).map(([k,v])=>{const z=k.startsWith('Cabeza')?'cabeza':k.startsWith('Pecho')?'torso':k.startsWith('Brazo')?'brazos':'piernas';const pi=arm.reduce((a,i)=>Math.max(a,(i.pi||{})[z]||0),0);return `<dt>${k}</dt><dd>${v}${pi?` <small class="muted">+${pi} P.I.</small>`:''}</dd>`;}).join('')}</dl></section>
  <section><h3 class="mini">Habilidades Generales</h3><dl class="kv">${gen.map(([n,v])=>`<dt>${esc(n)}</dt><dd>${v}</dd>`).join('')}</dl></section>
  <section><h3 class="mini">Habilidades Adquiridas</h3>${adq.length?`<dl class="kv">${adq.map(([n,v])=>`<dt>${esc(n)}</dt><dd>${v}</dd>`).join('')}</dl>`:'<p class="muted">Ninguna.</p>'}
  <h3 class="mini">Dones</h3><p>${[S.donGen,S.donCls,...S.donExtra].filter(Boolean).map(esc).join(' · ')||'—'}</p>
  ${S.mer.length?`<h3 class="mini">Méritos</h3><p>${S.mer.map(esc).join(' · ')}</p>`:''}${S.def.length?`<h3 class="mini">Defectos</h3><p>${S.def.map(esc).join(' · ')}</p>`:''}
  ${c&&c.body.notes.length?`<h3 class="mini">Rasgos de clase</h3><p>${c.body.notes.map(esc).join(' ')}</p>`:''}</section>
  <section><h3 class="mini">Armas</h3>${wp.length?`<ul class="plain">${wp.map(i=>`<li><b>${esc(i.n)}</b> <small>${esc(i.info)}</small></li>`).join('')}</ul>`:'<p class="muted">—</p>'}
  <h3 class="mini">Armadura</h3>${arm.length?`<ul class="plain">${arm.map(i=>`<li><b>${esc(i.n)}</b> <small>${esc(i.info)}</small></li>`).join('')}</ul>`:'<p class="muted">—</p>'}
  <h3 class="mini">Equipo</h3><p>${S.inv.filter(i=>i.t==='e').map(i=>esc(i.n)+(i.q>1?` ×${i.q}`:'')).join(', ')||'—'}</p><p><b>Akradios:</b> ${d.money-d.spent}</p></section>
 </div>${sheet2()}</div>
 <div class="sh-actions">${destinoOnline()?`<button class="btn accent" type="button" data-act="online">${ico('save')}Guardar en mi personaje online</button>`:`<button class="btn" type="button" data-act="subir">${ico('save')}Guardar en la plataforma</button>`}<a class="btn" href="#mesa/pj" data-act="mesa">${ico('dice')}Llevar a la mesa</a><button class="btn accent" type="button" data-act="print">${ico('print')}Imprimir ficha</button><button class="btn" type="button" data-act="export">${ico('save')}Exportar (.json)</button><label class="btn" tabindex="0">Importar<input type="file" accept="application/json" data-act="import" class="sr"></label><button class="btn" type="button" data-act="new">Empezar de nuevo</button></div>`;
}

/* ---------- Sistema 2.0: resumen para la hoja y la mesa ---------- */
const nzb=x=>String(x||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();
function ficha2(){
 const S2=FA.sistema2,R2=window.FA2;if(!S2||!R2||!S.cls)return null;
 const d=derived(),A=d.A,c=cls(),hv=id=>{const s=G.gen.find(x=>x.id===id);return s?(S.gen[id]||0)+aval(A,s.a):0;};
 const adqv=id=>{const s=adqList().find(x=>x.id===id);return s&&S.adq[id]?S.adq[id]+aval(A,s.a):0;};
 const armas=S.inv.filter(i=>i.t==='w').map(i=>S2.armas.find(a=>nzb(a.n)===nzb(i.n))).filter(Boolean);
 const arms=S.inv.filter(i=>i.t==='a').map(i=>S2.armaduras.find(a=>nzb(a.n)===nzb(i.n))).filter(Boolean);
 const armadura=arms.sort((a,b)=>b.absorcion.torso-a.absorcion.torso)[0]||null;
 const escudo=S.inv.filter(i=>i.t==='a'||i.t==='e').map(i=>(S2.escudos||[]).find(a=>nzb(a.n)===nzb(i.n))).filter(Boolean)[0]||null;
 const hab={disparo:hv('disparo'),cca:hv('combate-con-armas'),csa:hv('combate-sin-armas'),atletismo:hv('atletismo'),buscar:hv('buscar'),vista:hv('vista'),informatica:adqv('informática')};
 return {n:S.name||'Sin nombre',clase:c.n,attrs:{fue:A.fue,des:A.des,con:A.con,int:A.int,per:A.per,conoc:A.conoc},hab,
  vitMax:R2.vitalidadMax(A.con,c.body.pv||0),reserva:d.pool==='biofuerza'?'Biofuerza':'Voluntad',reservaN:S.pool,mov:R2.movimiento(hab.atletismo),
  armas,armadura,escudo};
}
function resumen(){
 const f=ficha2();if(!f)return null;
 return {n:f.n,bando:'pj',tipo:'pj',attrs:f.attrs,hab:f.hab,vitMax:f.vitMax,vit:f.vitMax,arma:(f.armas[0]||{}).id||'punos',armadura:f.armadura?f.armadura.id:null,escudo:f.escudo?f.escudo.id:null,vision:12,notas:f.clase};
}
function destinoOnline(){try{return sessionStorage.getItem('fa-editando');}catch(e){return null;}}
function sheet2(){
 const f=ficha2();if(!f)return '';
 const tip=window.__tip2||(x=>esc(x));
 return `<section class="sheet2"><h3 class="mini">Sistema 2.0</h3><div class="sh2g">
  <dl class="kv"><dt>Vitalidad</dt><dd>${f.vitMax}</dd><dt>Heridas</dt><dd>☐ ☐ ☐ <small class="muted">(3 fuera, 4 muerto)</small></dd><dt>${f.reserva}</dt><dd>${f.reservaN} <small class="muted">(1 punto sube un grado, máx. 3 por escena)</small></dd><dt>Movimiento</dt><dd>${f.mov} casillas por acción</dd><dt>Acciones</dt><dd>2 y 1 reacción por ronda</dd>
  <dt>Reacciones</dt><dd>Parar ${f.hab.cca} · Bloquear ${f.hab.csa} · Esquivar disparos ${f.hab.atletismo}</dd><dt>Reducción</dt><dd>${f.armadura?`${f.armadura.reduccion.torso} en torso (${esc(f.armadura.n)})`:'0'}${f.escudo?` · escudo +${f.escudo.reduccion}`:''}</dd></dl>
  <div>${f.armas.length?`<ul class="plain">${f.armas.map(a=>`<li><b>${esc(a.n)}</b> ${esc(a.dados)}${a.plano?'+'+esc(a.plano):''} <small>${esc(a.tipo||'')}${a.alcance_m?' · '+a.alcance_m+' m':' · cuerpo a cuerpo'}${a.cadencia>1?' · cadencia '+a.cadencia:''}</small>${a.rasgos.length?`<br><small>${a.rasgos.map(esc).join(', ')}</small>`:''}</li>`).join('')}</ul>`:'<p class="muted">Sin armas del catálogo.</p>'}
  <p class="muted" style="font-size:13px">Pleno con la mitad de la habilidad o menos (redondeando hacia arriba). <a href="#s2-nucleo">Cómo funciona</a></p></div></div></section>`;
}

/* ---------- para la plataforma: cálculo sobre otra ficha y carga en el creador ---------- */
// Calcula atributos, habilidades y datos derivados de una ficha cualquiera sin tocar la del creador.
function calcular(estado){
 const prev=S;S=Object.assign(blank(),JSON.parse(JSON.stringify(estado||{})));
 try{
  const d=derived(),A=d.A,c=cls(),L=adqList();
  const gen=G.gen.map(s=>({id:s.id,n:s.n,a:s.a,puntos:S.gen[s.id]||0,total:(S.gen[s.id]||0)+aval(A,s.a)}));
  const adq=L.filter(s=>S.adq[s.id]).map(s=>({id:s.id,n:s.n+(S.adqTxt[s.id]?` (${S.adqTxt[s.id]})`:''),a:s.a,af:s.af,puntos:S.adq[s.id],total:S.adq[s.id]+aval(A,s.a)}));
  const adqTodas=L.map(s=>({id:s.id,n:s.n,a:s.a,af:s.af,puntos:S.adq[s.id]||0,total:(S.adq[s.id]||0)+aval(A,s.a)}));
  return {A,d,clase:c||null,casa:c&&c.id==='psiquicos'?(c.casas.find(h=>h.id===S.casa)||null):null,gen,adq,adqTodas,dones:[S.donGen,S.donCls,...S.donExtra].filter(Boolean),donesPosibles:[...G.dones,...donList()].map(x=>x.n),mer:S.mer.slice(),def:S.def.slice(),atk:d.atk,issues:issues()};
 }finally{S=prev;}
}
function cargar(estado,destino){S=Object.assign(blank(),JSON.parse(JSON.stringify(estado||{})));S.step=estado&&estado.name?7:0;save();try{if(destino)sessionStorage.setItem('fa-editando',destino);else sessionStorage.removeItem('fa-editando');}catch(e){}}
function estado(){return JSON.parse(JSON.stringify(S));}
const VIEWS=[stepClase,stepAttr,stepGen,stepAdq,stepDones,stepFree,stepEquipo,sheet];

/* ---------- render ---------- */
let root=null;
function render(el,arg){
 root=el;
 if(arg&&CL[arg]&&S.cls!==arg){S.cls=arg;S.step=0;S.donCls='';S.casa='';save();}
 draw(true);
}
function draw(first){
 const focusSel=document.activeElement&&document.activeElement.dataset?(document.activeElement.dataset.st?`[data-st="${document.activeElement.dataset.st}"][data-dv="${document.activeElement.dataset.dv}"]`:document.activeElement.id?'#'+document.activeElement.id:null):null;
 const y=scrollY;
 root.innerHTML=`<div class="${first?'view-enter ':''}builder"><header class="opener small"><div class="in"><div class="ico">${ico('forge')}</div><div class="crumbs"><a href="#inicio">Inicio</a><span aria-hidden="true">/</span><a href="#creacion-de-personajes">Creación de personajes</a></div><h1>Creador de personajes</h1></div></header>
 <div class="bwrap">${nav()}${bar()}<section class="bstep" aria-labelledby="bst"><h2 id="bst" class="sr">Paso ${S.step+1}: ${STEPS[S.step]}</h2>${VIEWS[S.step]()}</section>
 <div class="bnav">${S.step>0?`<button type="button" class="btn" data-go="${S.step-1}">${ico('back')}${STEPS[S.step-1]}</button>`:'<span></span>'}${S.step<STEPS.length-1?`<button type="button" class="btn accent" data-go="${S.step+1}">${STEPS[S.step+1]} ${ico('arrow')}</button>`:''}</div></div></div>`;
 wire();
 if(!first){scrollTo(0,y);if(focusSel){const f=root.querySelector(focusSel);if(f&&!f.disabled)f.focus({preventScroll:true});}}
}
function upd(fn){fn();save();draw(false);}
function wire(){
 root.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>{S.step=+b.dataset.go;save();draw(false);scrollTo({top:0});root.querySelector('.bstep').setAttribute('tabindex','-1');root.querySelector('.bstep').focus({preventScroll:true});}));
 root.querySelectorAll('[data-cls]').forEach(b=>b.addEventListener('click',()=>upd(()=>{if(S.cls!==b.dataset.cls){S.cls=b.dataset.cls;S.donCls='';S.casa='';Object.keys(S.adq).filter(k=>k.startsWith('c-')).forEach(k=>delete S.adq[k]);}})));
 root.querySelectorAll('[name=casa]').forEach(r=>r.addEventListener('change',()=>upd(()=>{S.casa=r.value;S.donCls='';})));
 root.querySelectorAll('[data-f]').forEach(i=>i.addEventListener('input',()=>{S[i.dataset.f]=i.value;save();}));
 root.querySelectorAll('[data-shift]').forEach(r=>r.addEventListener('input',()=>upd(()=>{S.shift[r.dataset.shift]=+r.value;})));
 root.querySelectorAll('[data-st]').forEach(b=>b.addEventListener('click',()=>upd(()=>{const [k,id]=b.dataset.st.split(':'),dv=+b.dataset.dv;
  if(k==='g')S.gen[id]=Math.max(0,(S.gen[id]||0)+dv);else if(k==='a')S.adq[id]=Math.max(0,(S.adq[id]||0)+dv);else if(k==='ab')S.attrBuy[id]=Math.max(0,(S.attrBuy[id]||0)+dv);else if(k==='pool')S.pool=Math.max(1,S.pool+dv);else if(k==='atk')S.atk=Math.max(0,S.atk+dv);})));
 root.querySelectorAll('[data-adqtxt]').forEach(i=>i.addEventListener('input',()=>{S.adqTxt[i.dataset.adqtxt]=i.value;save();}));
 root.querySelectorAll('[name=dg]').forEach(r=>r.addEventListener('change',()=>upd(()=>{S.donGen=r.value;})));
 root.querySelectorAll('[name=dc]').forEach(r=>r.addEventListener('change',()=>upd(()=>{S.donCls=r.value;})));
 root.querySelectorAll('[data-mer]').forEach(r=>r.addEventListener('change',()=>upd(()=>{const n=r.dataset.mer;S.mer=r.checked?[...S.mer,n]:S.mer.filter(x=>x!==n);})));
 root.querySelectorAll('[data-def]').forEach(r=>r.addEventListener('change',()=>upd(()=>{const n=r.dataset.def;S.def=r.checked?[...S.def,n]:S.def.filter(x=>x!==n);})));
 const dx=root.querySelector('[data-donx]');if(dx)dx.addEventListener('change',()=>upd(()=>{if(dx.value)S.donExtra.push(dx.value);}));
 root.querySelectorAll('[data-rmdon]').forEach(b=>b.addEventListener('click',()=>upd(()=>{S.donExtra=S.donExtra.filter(x=>x!==b.dataset.rmdon);})));
 root.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{shopTab=b.dataset.tab;draw(false);}));
 const sq=root.querySelector('#shopq');if(sq)sq.addEventListener('input',()=>{shopQ=sq.value;const pos=sq.selectionStart;draw(false);const n=root.querySelector('#shopq');n.focus();n.setSelectionRange(pos,pos);});
 root.querySelectorAll('[data-buy]').forEach(b=>b.addEventListener('click',()=>upd(()=>{const it=JSON.parse(b.dataset.buy);const ex=S.inv.find(i=>i.n===it.n&&i.t===it.t);if(ex&&it.t==='e')ex.q=(ex.q||1)+1;else S.inv.push(Object.assign(it,{q:1}));})));
 root.querySelectorAll('[data-rm]').forEach(b=>b.addEventListener('click',()=>upd(()=>{const i=S.inv[+b.dataset.rm];if(i.q>1)i.q--;else S.inv.splice(+b.dataset.rm,1);})));
 root.querySelectorAll('[data-act]').forEach(b=>{const a=b.dataset.act;
  if(a==='import')b.addEventListener('change',()=>{const f=b.files[0];if(!f)return;f.text().then(t=>{try{S=Object.assign(blank(),JSON.parse(t));S.step=7;save();draw(false);}catch(e){alert('El archivo no es una ficha válida.');}});});
  else b.addEventListener('click',()=>{
   if(a==='print')window.print();
   if(a==='online'&&window.PLATAFORMA)window.PLATAFORMA.guardarDesdeCreador(destinoOnline(),estado());
   if(a==='subir'&&window.PLATAFORMA)window.PLATAFORMA.crearDesdeCreador(estado());
   if(a==='export'){const bl=new Blob([JSON.stringify(S,null,1)],{type:'application/json'});const u=URL.createObjectURL(bl);const l=document.createElement('a');l.href=u;l.download=(S.name||'personaje').replace(/\W+/g,'-')+'.json';document.body.appendChild(l);l.click();l.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);}
   if(a==='new'&&confirm('¿Borrar este personaje y empezar otro?')){S=blank();save();draw(false);}
  });});
}
window.BUILDER={render,resumen,calcular,cargar,estado};
})();
