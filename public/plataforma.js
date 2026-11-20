/* Fire Angel · Plataforma de juego online (apartado #juego)
   Cuentas por invitación, campañas, gestor de personajes (ficha, equipo con peso, experiencia, narración),
   notas del máster y sala en tiempo real (dados, chat, avisos). Necesita el servidor de Cloudflare (src/worker.js). */
'use strict';
(function () {
  const { FA, esc, md, ico, sget, sset } = window.FAapp;
  const R = window.FA2, S2 = FA.sistema2, G = FA.game;
  const AT = G.atributos, ATN = Object.fromEntries(AT);
  const ESTADO = { yo: undefined, disponible: null, pjs: null, camps: null };
  let main = null, sala = null;

  /* ---------- servidor ---------- */
  async function api(metodo, ruta, cuerpo) {
    let r;
    try { r = await fetch('/api' + ruta, { method: metodo, credentials: 'same-origin', headers: cuerpo ? { 'content-type': 'application/json' } : {}, body: cuerpo ? JSON.stringify(cuerpo) : undefined }); }
    catch (e) { throw new Error('No hay conexión con el servidor.'); }
    const tipo = r.headers.get('content-type') || '';
    if (!tipo.includes('application/json')) { ESTADO.disponible = false; throw new Error('La plataforma no está disponible aquí.'); }
    const j = await r.json();
    if (!r.ok) { const e = new Error(j.error || 'Error ' + r.status); e.status = r.status; throw e; }
    return j;
  }
  async function comprobar() {
    if (ESTADO.yo !== undefined && ESTADO.disponible !== null) return;
    try { const j = await api('GET', '/yo'); ESTADO.disponible = true; ESTADO.yo = j.usuario; }
    catch (e) { ESTADO.disponible = false; ESTADO.yo = null; }
  }
  function aviso(txt, malo) {
    let a = document.getElementById('pAviso');
    if (!a) { a = document.createElement('div'); a.id = 'pAviso'; a.className = 'paviso'; a.setAttribute('role', 'status'); document.body.appendChild(a); }
    a.textContent = txt; a.classList.toggle('malo', !!malo); a.hidden = false;
    clearTimeout(aviso.t); aviso.t = setTimeout(() => { a.hidden = true; }, 4200);
  }
  const fallo = e => aviso(e.message || String(e), true);
  const fecha = ts => new Date(ts).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const fechaMundo = f => f ? `día ${f.dia}, ciclo ${f.ciclo}, ${f.anio} d. I.` : '';
  const opt = (v, n, s) => `<option value="${esc(v)}"${s ? ' selected' : ''}>${esc(n)}</option>`;
  const num = x => (Math.round(x * 10) / 10).toLocaleString('es-ES');
  function copiar(txt) { if (navigator.clipboard) navigator.clipboard.writeText(txt).then(() => aviso('Copiado.'), () => aviso('Cópialo a mano.', true)); }

  /* ---------- armazón de la vista ---------- */
  function marco(titulo, migas, cuerpo, extra) {
    return `<div class="plat view-enter"><header class="phead"><div class="crumbs"><a href="#inicio">Inicio</a><span aria-hidden="true">/</span><a href="#juego">Partidas online</a>${migas || ''}</div>
      <div class="phrow"><h1>${titulo}</h1>${ESTADO.yo ? `<div class="pyo"><span>${ico('personajes')}${esc(ESTADO.yo.nombre)}${ESTADO.yo.admin ? ' <small>admin</small>' : ''}</span><button class="btn small" type="button" data-salir>Salir</button></div>` : ''}</div>${extra || ''}</header>
      <div class="pbody">${cuerpo}</div></div>`;
  }
  function enlazarComun() {
    main.querySelectorAll('[data-salir]').forEach(b => b.addEventListener('click', async () => { try { await api('POST', '/salir'); } catch (e) {} ESTADO.yo = null; cerrarSala(); location.hash = '#juego'; render(main); }));
  }

  /* ---------- entrada ---------- */
  async function render(el, arg) {
    main = el; cerrarSalaSiSale(arg);
    main.innerHTML = `<div class="plat"><p class="muted" style="padding:40px">Cargando…</p></div>`;
    await comprobar();
    if (!ESTADO.disponible) { main.innerHTML = marco('Partidas online', '', noDisponible()); return; }
    if (arg && arg.startsWith('inv-')) return vistaInvitacion(arg.slice(4));
    if (!ESTADO.yo) return vistaEntrar();
    if (arg && arg.startsWith('pj-')) return vistaPersonaje(arg.slice(3));
    if (arg && arg.startsWith('c-')) return vistaCampana(arg.slice(2));
    return vistaInicio();
  }
  function noDisponible() {
    return `<div class="pcard"><h2>La plataforma necesita su servidor</h2><p>Las partidas online (cuentas, personajes guardados, campañas y la sala en tiempo real) funcionan en la web alojada en Cloudflare. Esta copia solo tiene el manual, el creador y el tablero en modo local.</p><p><a class="btn" href="#mesa">${ico('dice')}Abrir el tablero local</a> <a class="btn" href="#creador">${ico('forge')}Crear personaje</a></p></div>`;
  }
  function vistaEntrar(codigo, info) {
    main.innerHTML = marco('Partidas online', '', `<div class="pgrid2">
      <form class="pcard pform" data-entrar><h2>Entrar</h2><label>Nombre de usuario<input name="nombre" autocomplete="username" required></label><label>Contraseña<input name="clave" type="password" autocomplete="current-password" required></label><button class="btn accent" type="submit">Entrar</button></form>
      <form class="pcard pform" data-registro><h2>Tengo una invitación</h2>${info ? `<p>Te invitan${info.campana ? ` a la campaña <b>${esc(info.campana)}</b> como ${esc(info.rol)}` : ''}${info.de ? ` (de ${esc(info.de)})` : ''}.</p>` : '<p class="muted">El máster o el administrador te dan un código o un enlace.</p>'}
       <label>Código de invitación<input name="codigo" value="${esc(codigo || '')}" required></label><label>Elige un nombre de usuario<input name="nombre" autocomplete="username" required minlength="3" maxlength="32"></label><label>Elige una contraseña (mínimo 8)<input name="clave" type="password" autocomplete="new-password" required minlength="8"></label><button class="btn accent" type="submit">Crear cuenta</button></form></div>
      <p class="muted psmall">Solo se guarda tu nombre de usuario y una huella cifrada de tu contraseña. Sin correo, sin cookies de terceros.</p>`);
    main.querySelector('[data-entrar]').addEventListener('submit', async e => { e.preventDefault(); const f = new FormData(e.target); try { const j = await api('POST', '/entrar', { nombre: f.get('nombre'), clave: f.get('clave') }); ESTADO.yo = j.usuario; render(main); } catch (er) { fallo(er); } });
    main.querySelector('[data-registro]').addEventListener('submit', async e => { e.preventDefault(); const f = new FormData(e.target); try { const j = await api('POST', '/registro', { codigo: f.get('codigo'), nombre: f.get('nombre'), clave: f.get('clave') }); ESTADO.yo = j.usuario; ESTADO.camps = null; aviso('¡Bienvenido a la mesa!'); location.hash = '#juego'; render(main); } catch (er) { fallo(er); } });
  }
  async function vistaInvitacion(codigo) {
    let info = null; try { info = await api('GET', '/invitaciones/' + encodeURIComponent(codigo)); } catch (e) { aviso(e.message, true); }
    if (!ESTADO.yo) return vistaEntrar(codigo, info);
    main.innerHTML = marco('Invitación', '', `<div class="pcard"><h2>${info && info.campana ? 'Unirte a ' + esc(info.campana) : 'Invitación'}</h2>${info ? `<p>Entrarás como <b>${esc(info.rol)}</b>.</p><button class="btn accent" type="button" data-acepta>Aceptar</button>` : '<p>Esta invitación no es válida o ha caducado.</p>'}</div>`);
    enlazarComun();
    const b = main.querySelector('[data-acepta]'); if (b) b.addEventListener('click', async () => { try { const j = await api('POST', '/invitaciones/aceptar', { codigo }); ESTADO.camps = null; location.hash = '#juego/c-' + j.campana_id; } catch (e) { fallo(e); } });
  }

  /* ---------- inicio: mis personajes y mis campañas ---------- */
  async function vistaInicio() {
    let pjs = [], camps = [];
    try { [pjs, camps] = await Promise.all([api('GET', '/personajes'), api('GET', '/campanas')]); ESTADO.pjs = pjs; ESTADO.camps = camps; } catch (e) { fallo(e); }
    const CL = Object.fromEntries(G.clases.map(c => [c.id, c]));
    const local = window.BUILDER && window.BUILDER.estado ? window.BUILDER.estado() : null;
    main.innerHTML = marco('Partidas online', '', `
     <section><div class="psec"><h2>Mis personajes</h2><div class="pacc">${local && local.name ? `<button class="btn small accent" type="button" data-subir>${ico('save')}Subir «${esc(local.name)}» del creador</button>` : ''}<a class="btn small" href="#creador" data-nuevo>${ico('forge')}Crear en el creador</a></div></div>
      <div class="pcards">${pjs.map(p => { const c = CL[p.clase]; return `<a class="pcp" href="#juego/pj-${p.id}">${c && c.img ? `<img src="img/clases/${c.img}.jpg?v=2" alt="">` : `<span class="ph">${esc((p.nombre || '?')[0])}</span>`}<span><b>${esc(p.nombre)}</b><small>${esc(c ? c.n : 'Sin clase')}${p.concepto ? ' · ' + esc(p.concepto) : ''}</small><small>${p.px.total - p.px.gastados} PX por gastar · actualizado ${fecha(p.actualizado)}</small></span></a>`; }).join('') || '<p class="muted">Aún no tienes personajes. Créalo en el creador y súbelo aquí.</p>'}</div></section>
     <section><div class="psec"><h2>Mis campañas</h2><form class="pacc" data-nuevacamp><label class="sr" for="ncamp">Nombre de la campaña</label><input id="ncamp" name="nombre" placeholder="Nombre de una campaña nueva" required maxlength="80"><button class="btn small accent" type="submit">Crear y dirigir</button></form></div>
      <div class="pcards">${camps.map(c => `<a class="pcc" href="#juego/c-${c.id}"><span class="rol rol-${c.rol}">${c.rol === 'master' ? 'Máster' : c.rol === 'jugador' ? 'Jugador' : 'Espectador'}</span><b>${esc(c.nombre)}</b><small>Máster: ${esc(c.master)} · ${c.jugadores} jugador${c.jugadores === 1 ? '' : 'es'} · ${fechaMundo(c.ajustes.fecha)}</small>${c.descripcion ? `<small>${esc(c.descripcion.slice(0, 140))}</small>` : ''}</a>`).join('') || '<p class="muted">No estás en ninguna campaña. Crea una para dirigir o pide un enlace de invitación a tu máster.</p>'}</div></section>
     ${ESTADO.yo.admin ? `<section class="pcard"><h2>Administración</h2><p class="psmall">Invita a alguien a la plataforma sin meterlo en una campaña (por ejemplo, a otro máster).</p><button class="btn small" type="button" data-invgen>Crear invitación general</button><div data-invres></div></section>` : ''}
     <section class="pcard"><h2>Tu cuenta</h2><form class="pform prow" data-clave><label>Contraseña actual<input name="actual" type="password" autocomplete="current-password" required></label><label>Nueva<input name="nueva" type="password" autocomplete="new-password" minlength="8" required></label><button class="btn small" type="submit">Cambiar contraseña</button></form></section>`);
    enlazarComun();
    const sb = main.querySelector('[data-subir]'); if (sb) sb.addEventListener('click', () => crearDesdeCreador(local));
    main.querySelector('[data-nuevo]').addEventListener('click', () => { try { sessionStorage.removeItem('fa-editando'); } catch (e) {} });
    main.querySelector('[data-nuevacamp]').addEventListener('submit', async e => { e.preventDefault(); try { const j = await api('POST', '/campanas', { nombre: new FormData(e.target).get('nombre') }); location.hash = '#juego/c-' + j.id; } catch (er) { fallo(er); } });
    const ig = main.querySelector('[data-invgen]'); if (ig) ig.addEventListener('click', async () => { try { const j = await api('POST', '/invitaciones', { rol: 'usuario', dias: 14 }); const url = location.origin + location.pathname + '#juego/inv-' + j.codigo; main.querySelector('[data-invres]').innerHTML = `<p class="psmall">Enlace válido 14 días, un uso: <code>${esc(url)}</code> <button class="btn small" type="button" data-cp="${esc(url)}">Copiar</button></p>`; main.querySelector('[data-cp]').addEventListener('click', ev => copiar(ev.target.dataset.cp)); } catch (e) { fallo(e); } });
    main.querySelector('[data-clave]').addEventListener('submit', async e => { e.preventDefault(); const f = new FormData(e.target); try { await api('POST', '/clave', { actual: f.get('actual'), nueva: f.get('nueva') }); aviso('Contraseña cambiada.'); e.target.reset(); } catch (er) { fallo(er); } });
  }

  /* ---------- puente con el creador ---------- */
  function inventarioDesdeCreador(inv) {
    return (inv || []).map(i => {
      const ref = i.t === 'w' ? S2.armas.find(a => a.n.toLowerCase() === i.n.toLowerCase()) : i.t === 'a' ? S2.armaduras.find(a => a.n.toLowerCase() === i.n.toLowerCase()) : null;
      return { id: 'i' + Math.random().toString(36).slice(2, 9), n: i.n, t: i.t === 'w' ? 'arma' : i.t === 'a' ? 'armadura' : 'equipo', ref: ref ? ref.id : null, q: i.q || 1, peso: R.pesoEstimado(ref || { n: i.n }), precio: i.p, equipado: i.t !== 'e', notas: i.info || '' };
    });
  }
  async function crearDesdeCreador(ficha) {
    if (!ficha || !ficha.name) { aviso('El personaje del creador no tiene nombre todavía.', true); return; }
    const gastado = (ficha.inv || []).reduce((a, i) => a + i.p * (i.q || 1), 0), base = G.reglas.money * ((ficha.mer || []).includes('Adinerado') ? 2 : 1);
    try {
      const j = await api('POST', '/personajes', { ficha, datos: { inventario: inventarioDesdeCreador(ficha.inv), dinero: { akradios: Math.max(0, base - gastado), creditos: 0 }, narracion: { concepto: ficha.concept || '', aspecto: '', personalidad: '', trasfondo: '', objetivos: '', contactos: '', secretos: '', diario: [] } } });
      aviso('Personaje guardado en la plataforma.'); location.hash = '#juego/pj-' + j.id;
    } catch (e) { fallo(e); }
  }
  async function guardarDesdeCreador(pid, ficha) {
    try {
      const pj = await api('GET', '/personajes/' + pid); const d = pj.datos; d.ficha = ficha; d.nombre = ficha.name || d.nombre;
      await api('PUT', '/personajes/' + pid, { version: pj.version, datos: d, historial: ['Ficha editada en el creador.'] });
      try { sessionStorage.removeItem('fa-editando'); } catch (e) {}
      aviso('Ficha guardada.'); location.hash = '#juego/pj-' + pid;
    } catch (e) { fallo(e); }
  }

  /* ---------- gestor de personaje ---------- */
  let PJ = null, pjTab = 'ficha';
  function efectiva(d) {
    const f = JSON.parse(JSON.stringify(d.ficha || {}));
    f.gen = f.gen || {}; f.adq = f.adq || {}; f.attrBuy = f.attrBuy || {}; f.donExtra = f.donExtra || []; f.atk = f.atk || 0;
    (d.mejoras || []).forEach(m => {
      if (m.tipo === 'hab') { const k = m.grupo === 'adq' ? 'adq' : 'gen'; f[k][m.id] = (f[k][m.id] || 0) + 1; }
      if (m.tipo === 'atributo') f.attrBuy[m.id] = (f.attrBuy[m.id] || 0) + 1;
      if (m.tipo === 'don' && m.n) f.donExtra.push(m.n);
      if (m.tipo === 'ataque') f.atk++;
    });
    return f;
  }
  function calc(d) { return d.ficha && window.BUILDER && window.BUILDER.calcular ? window.BUILDER.calcular(efectiva(d)) : null; }
  function pesoTotal(d) { return d.inventario.filter(i => !i.guardado).reduce((a, i) => a + (+i.peso || 0) * (+i.q || 1), 0); }
  async function guardarPJ(historial) {
    try { const r = await api('PUT', '/personajes/' + PJ.id, { version: PJ.version, datos: PJ.datos, historial }); PJ.version = r.version; return true; }
    catch (e) { if (e.status === 409) { aviso('La ficha ha cambiado en otro sitio; la recargo.', true); await cargarPJ(PJ.id); pintarPJ(); } else fallo(e); return false; }
  }
  async function cargarPJ(id) { PJ = await api('GET', '/personajes/' + id); }
  async function vistaPersonaje(id) {
    try { await cargarPJ(id); } catch (e) { main.innerHTML = marco('Personaje', '', `<div class="pcard"><p>${esc(e.message)}</p></div>`); enlazarComun(); return; }
    if (!ESTADO.camps) { try { ESTADO.camps = await api('GET', '/campanas'); } catch (e) { ESTADO.camps = []; } }
    pintarPJ();
  }
  function pintarPJ() {
    const d = PJ.datos, c = calc(d), clase = c && c.clase;
    const tabs = [['ficha', 'Ficha'], ['equipo', 'Equipo y carga'], ['px', 'Experiencia'], ['narracion', 'Narración'], ['historial', 'Historial']];
    const cuerpo = `<nav class="ptabs" role="tablist">${tabs.map(([k, n]) => `<button type="button" role="tab" aria-selected="${pjTab === k}" data-ptab="${k}">${n}</button>`).join('')}</nav><div class="ppanel">${({ ficha: pFicha, equipo: pEquipo, px: pPX, narracion: pNarr, historial: () => '<p class="muted">Cargando…</p>' })[pjTab](d, c)}</div>`;
    const extra = `<p class="psub">${clase ? esc(clase.n) : 'Sin clase'}${c && c.casa ? ' · ' + esc(c.casa.n) : ''}${d.narracion.concepto ? ' — ' + esc(d.narracion.concepto) : ''}${PJ.acceso === 'master' ? ' · <b>ves esta ficha como máster</b>' : ''}</p>`;
    main.innerHTML = marco(esc(PJ.nombre), `<span aria-hidden="true">/</span><span>Personaje</span>`, cuerpo, extra);
    enlazarComun();
    main.querySelectorAll('[data-ptab]').forEach(b => b.addEventListener('click', () => { pjTab = b.dataset.ptab; pintarPJ(); }));
    ({ ficha: eFicha, equipo: eEquipo, px: ePX, narracion: eNarr, historial: eHist })[pjTab](d, c);
  }
  function pFicha(d, c) {
    if (!c) return `<div class="pcard"><p>Este personaje aún no tiene ficha de reglas.</p><button class="btn accent" type="button" data-editar>${ico('forge')}Hacer la ficha en el creador</button></div>`;
    const A = c.A, body = (c.clase && c.clase.body) || {}, vmax = R.vitalidadMax(A.con, body.pv || 0), v = d.vivo;
    const vit = v.vit == null ? vmax : v.vit, reservaN = (d.ficha.pool || 1), reserva = v.reserva == null ? reservaN : v.reserva;
    const carga = R.estadoCarga(pesoTotal(d), A.fue), mov = R.movimiento((c.gen.find(g => g.id === 'atletismo') || {}).total || 0);
    const armas = d.inventario.filter(i => i.t === 'arma' && i.equipado && !i.guardado).map(i => ({ i, a: S2.armas.find(x => x.id === i.ref) }));
    const arm = d.inventario.filter(i => i.t === 'armadura' && i.equipado && !i.guardado).map(i => S2.armaduras.find(x => x.id === i.ref)).filter(Boolean).sort((a, b) => b.absorcion.torso - a.absorcion.torso)[0];
    const img = c.clase && (c.clase.img || (c.clase.id === 'psiquicos' ? 'telepatas' : null));
    return `<div class="pficha">${img ? `<img class="pret" src="img/clases/${img}.jpg?v=2" alt="">` : ''}
     <div class="attrs big">${AT.map(([k, n]) => `<div><b>${A[k]}</b><span>${esc(n)}</span></div>`).join('')}</div>
     <section class="pcard pvivo"><h3>En juego · Sistema 2.0</h3>
      <div class="pstats">${stp('vit', 'Vitalidad', vit, 0, vmax, `/ ${vmax}`)}${stp('heridas', 'Heridas', v.heridas || 0, 0, 4, '/ 3 fuera · 4 muerte')}${stp('reserva', c.d.pool === 'biofuerza' ? 'Biofuerza' : 'Voluntad', reserva, 0, reservaN, `/ ${reservaN}`)}</div>
      <p class="psmall">Movimiento <b>${Math.max(1, carga.movMitad ? Math.floor(mov / 2) : mov + (carga.mov || 0))}</b> casillas por acción · 2 acciones y 1 reacción · Reducción <b>${arm ? arm.reduccion.torso : 0}</b>${arm ? ` (${esc(arm.n)})` : ''} · Carga: <b class="carga-${carga.nivel}">${esc(carga.txt)}</b></p>
      <label class="pform">Estados y notas rápidas<input data-estados value="${esc(v.notas || '')}" placeholder="Aturdido, sin munición de reserva…"></label>
      <div class="pacc"><button class="btn small" type="button" data-descanso>Descanso completo</button><button class="btn small" type="button" data-editar>${ico('forge')}Editar la ficha en el creador</button></div></section>
     <section class="pcard"><h3>Armas a mano</h3>${armas.length ? `<ul class="plist2">${armas.map(({ i, a }) => `<li><b>${esc(i.n)}</b> ${a ? `${esc(a.dados)}${a.plano ? '+' + esc(a.plano) : ''} ${esc(a.tipo || '')} · ${a.alcance_m ? a.alcance_m + ' m' : 'cuerpo a cuerpo'}${a.cadencia > 1 ? ' · cadencia ' + a.cadencia : ''}<br><small>${a.rasgos.map(esc).join(', ')}</small>` : '<small class="muted">sin datos en el catálogo</small>'}</li>`).join('')}</ul>` : '<p class="muted">Marca armas como equipadas en «Equipo y carga».</p>'}</section>
     <div class="pgrid2"><section class="pcard"><h3>Habilidades generales</h3><dl class="kv">${c.gen.map(g => `<dt>${esc(g.n)}</dt><dd>${g.total}</dd>`).join('')}</dl></section>
      <section class="pcard"><h3>Habilidades adquiridas</h3>${c.adq.length ? `<dl class="kv">${c.adq.map(g => `<dt>${esc(g.n)}</dt><dd>${g.total}</dd>`).join('')}</dl>` : '<p class="muted">Ninguna.</p>'}
       <h3>Dones</h3><p>${c.dones.map(esc).join(' · ') || '—'}</p>${c.atk > 1 ? `<p>Ataques comprados: ${c.atk - 1}</p>` : ''}${c.mer.length ? `<h3>Méritos</h3><p>${c.mer.map(esc).join(' · ')}</p>` : ''}${c.def.length ? `<h3>Defectos</h3><p>${c.def.map(esc).join(' · ')}</p>` : ''}</section></div></div>`;
  }
  const stp = (k, n, v, min, max, sub) => `<div class="pst"><span>${n}</span><div class="stp"><button type="button" data-vv="${k}" data-dv="-1" aria-label="Restar ${n}" ${v <= min ? 'disabled' : ''}>−</button><output>${v}</output><button type="button" data-vv="${k}" data-dv="1" aria-label="Sumar ${n}" ${v >= max ? 'disabled' : ''}>+</button></div><small>${sub}</small></div>`;
  function eFicha(d, c) {
    const ed = main.querySelectorAll('[data-editar]');
    ed.forEach(b => b.addEventListener('click', () => { if (!window.BUILDER) return; window.BUILDER.cargar(d.ficha || { name: PJ.nombre }, PJ.id); location.hash = '#creador'; }));
    if (!c) return;
    const A = c.A, vmax = R.vitalidadMax(A.con, ((c.clase && c.clase.body) || {}).pv || 0), rmax = d.ficha.pool || 1;
    let t = null;
    main.querySelectorAll('[data-vv]').forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.vv, dv = +b.dataset.dv, v = d.vivo;
      if (k === 'vit') v.vit = Math.max(0, Math.min(vmax, (v.vit == null ? vmax : v.vit) + dv));
      if (k === 'heridas') v.heridas = Math.max(0, Math.min(4, (v.heridas || 0) + dv));
      if (k === 'reserva') v.reserva = Math.max(0, Math.min(rmax, (v.reserva == null ? rmax : v.reserva) + dv));
      pintarPJ(); clearTimeout(t); t = setTimeout(() => guardarPJ(), 600);
    }));
    const es = main.querySelector('[data-estados]'); if (es) es.addEventListener('change', () => { d.vivo.notas = es.value.slice(0, 300); guardarPJ(); });
    const ds = main.querySelector('[data-descanso]'); if (ds) ds.addEventListener('click', async () => { d.vivo.vit = null; d.vivo.reserva = null; if (await guardarPJ(['Descanso completo: Vitalidad y reserva al máximo (las Heridas se curan aparte).'])) pintarPJ(); });
  }

  /* ---------- equipo, dinero y peso ---------- */
  let tiendaQ = '', tiendaT = 'arma';
  function catalogo() {
    const L = [];
    S2.armas.forEach(a => L.push({ t: 'arma', n: a.n, ref: a.id, precio: a.precio, peso: R.pesoEstimado(a), info: `${a.dados}${a.plano ? '+' + a.plano : ''} ${a.tipo || ''} · ${a.alcance_m ? a.alcance_m + ' m' : 'CaC'}` }));
    S2.armaduras.forEach(a => { const g = (G.armaduras.flatMap(([, , rows]) => rows).find(r => r[0] === a.n)); L.push({ t: 'armadura', n: a.n, ref: a.id, precio: g ? g[2] + g[4] + g[6] + g[8] : a.precio || 0, peso: R.pesoEstimado(a), info: `reducción ${a.reduccion.torso} · ${a.clase}` }); });
    (S2.escudos || []).forEach(a => L.push({ t: 'armadura', n: a.n, ref: a.id, precio: a.precio || 0, peso: R.pesoEstimado(a), info: `escudo +${a.reduccion}` }));
    G.equipo.forEach(e => L.push({ t: 'equipo', n: e.n, ref: null, precio: e.p, peso: R.pesoEstimado(e), info: e.cat }));
    S2.equipo.filter(e => e.origen === 'nuevo').forEach(e => L.push({ t: 'equipo', n: e.n, ref: e.id, precio: e.precio, peso: R.pesoEstimado(e), info: 'nuevo · ' + (e.uso || '').slice(0, 60) }));
    S2.municion.forEach(e => L.push({ t: 'equipo', n: 'Munición: ' + e.n, ref: e.id, precio: e.precio_x_cargador || e.precio || 0, peso: 0.5, info: e.efecto }));
    return L;
  }
  function campDelPJ() { return (ESTADO.camps || []).find(c => c.personaje_id === PJ.id) || null; }
  function pEquipo(d, c) {
    const fue = c ? c.A.fue : 4, total = pesoTotal(d), carga = R.estadoCarga(total, fue), camp = campDelPJ(), cambio = camp ? camp.ajustes.cambio || 1 : null;
    const pct = Math.min(100, total / carga.maximo * 100);
    const nq = tiendaQ.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const tienda = tiendaQ.length >= 2 ? catalogo().filter(x => (tiendaT === 'todo' || x.t === tiendaT) && x.n.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes(nq)).slice(0, 25) : [];
    return `<div class="pgrid2"><section class="pcard"><h3>Dinero</h3>
      <div class="pdin"><label>Akradios<input type="number" data-din="akradios" value="${d.dinero.akradios}"></label><label>Créditos coalicionarios<input type="number" data-din="creditos" value="${d.dinero.creditos}"></label></div>
      <p class="psmall">Cada moneda solo vale en su territorio: el akradio fuera de la Coalición y el crédito dentro.</p>
      ${cambio ? `<form class="prow pform" data-cambio><label>Cambiar<input name="cant" type="number" min="1" required></label><label>de<select name="de">${opt('akradios', 'akradios a créditos')}${opt('creditos', 'créditos a akradios')}</select></label><button class="btn small" type="submit">Cambiar</button></form><p class="psmall">Tipo del máster en «${esc(camp.nombre)}»: 1 akradio = ${num(cambio)} créditos.</p>` : '<p class="psmall muted">Para cambiar moneda, el personaje tiene que estar en una campaña (el tipo lo fija su máster).</p>'}</section>
     <section class="pcard"><h3>Carga</h3><div class="pbarra carga-${carga.nivel}"><span style="width:${pct}%"></span><i style="left:${carga.libre / carga.maximo * 100}%"></i><i style="left:${carga.cargado / carga.maximo * 100}%"></i></div>
      <p><b>${num(total)} kg</b> de ${num(carga.libre)} kg sin penalización (Fuerza ${fue} × 5) · máximo ${num(carga.maximo)} kg</p><p class="psmall carga-${carga.nivel}">${esc(carga.txt)}</p>
      <p class="psmall muted">Los pesos son estimaciones nuevas de esta edición: corrígelos si tu objeto pesa otra cosa. Lo marcado «en la base» no cuenta.</p></section></div>
     <section class="pcard"><h3>Inventario</h3><div class="tw"><table class="pinv"><thead><tr><th>Objeto</th><th>Cant.</th><th>Peso (kg)</th><th>Total</th><th>Equipado</th><th>En la base</th><th></th></tr></thead><tbody>
      ${d.inventario.map((i, k) => `<tr><th scope="row"><input data-inv="${k}" data-k="n" value="${esc(i.n)}" aria-label="Nombre"><small>${esc(i.notas || '')}</small></th><td><input type="number" min="0" data-inv="${k}" data-k="q" value="${i.q}" aria-label="Cantidad"></td><td><input type="number" min="0" step="0.1" data-inv="${k}" data-k="peso" value="${i.peso}" aria-label="Peso por unidad"></td><td class="n">${num((+i.peso || 0) * (+i.q || 1))}</td><td>${i.t !== 'equipo' ? `<input type="checkbox" data-inv="${k}" data-k="equipado"${i.equipado ? ' checked' : ''} aria-label="Equipado">` : ''}</td><td><input type="checkbox" data-inv="${k}" data-k="guardado"${i.guardado ? ' checked' : ''} aria-label="En la base"></td><td><button class="ib" type="button" data-quita="${k}" aria-label="Quitar ${esc(i.n)}">${ico('close')}</button></td></tr>`).join('') || '<tr><td colspan="7" class="muted">Vacío.</td></tr>'}
      </tbody></table></div>
      <form class="prow pform" data-libre><label>Objeto suelto<input name="n" required placeholder="Ej.: Tarjeta del Astillero 15"></label><label>Peso (kg)<input name="peso" type="number" min="0" step="0.1" value="0.5"></label><label>Cantidad<input name="q" type="number" min="1" value="1"></label><button class="btn small" type="submit">Añadir</button></form></section>
     <section class="pcard"><h3>Tienda</h3><div class="prow"><input type="search" data-tq value="${esc(tiendaQ)}" placeholder="Buscar en el catálogo…" aria-label="Buscar en el catálogo"><select data-tt aria-label="Tipo">${opt('arma', 'Armas', tiendaT === 'arma')}${opt('armadura', 'Armaduras y escudos', tiendaT === 'armadura')}${opt('equipo', 'Equipo y munición', tiendaT === 'equipo')}${opt('todo', 'Todo', tiendaT === 'todo')}</select><select data-pago aria-label="Pagar con">${opt('akradios', 'Pagar en akradios')}${opt('creditos', 'Pagar en créditos')}</select></div>
      ${tiendaQ.length >= 2 ? `<ul class="ptienda">${tienda.map((x, k) => `<li><span><b>${esc(x.n)}</b><small>${esc(x.info || '')} · ${num(x.peso)} kg</small></span><span class="n">${x.precio}</span><button class="btn small" type="button" data-compra="${k}">Comprar</button><button class="btn small" type="button" data-coge="${k}">Añadir sin pagar</button></li>`).join('') || '<li class="muted">Nada coincide.</li>'}</ul>` : '<p class="psmall muted">Escribe al menos dos letras. El precio sale en la moneda con la que pagas.</p>'}</section>`;
  }
  function eEquipo(d) {
    let t = null; const guarda = (h) => { clearTimeout(t); t = setTimeout(() => guardarPJ(h), 500); };
    main.querySelectorAll('[data-din]').forEach(el => el.addEventListener('change', () => { const k = el.dataset.din, antes = d.dinero[k]; d.dinero[k] = Math.round(+el.value || 0); guardarPJ([`Dinero: ${k} de ${antes} a ${d.dinero[k]}.`]); }));
    const cf = main.querySelector('[data-cambio]'); if (cf) cf.addEventListener('submit', async e => {
      e.preventDefault(); const f = new FormData(cf), cant = Math.round(+f.get('cant') || 0), de = f.get('de'), a = de === 'akradios' ? 'creditos' : 'akradios', cambio = campDelPJ().ajustes.cambio || 1;
      if (cant <= 0 || d.dinero[de] < cant) { aviso('No tienes tanto dinero.', true); return; }
      const recibe = Math.floor(de === 'akradios' ? cant * cambio : cant / cambio);
      d.dinero[de] -= cant; d.dinero[a] += recibe;
      if (await guardarPJ([`Cambia ${cant} ${de} por ${recibe} ${a}.`])) pintarPJ();
    });
    main.querySelectorAll('[data-inv]').forEach(el => el.addEventListener('change', () => {
      const i = d.inventario[+el.dataset.inv], k = el.dataset.k;
      i[k] = el.type === 'checkbox' ? el.checked : k === 'n' ? el.value.slice(0, 80) : Math.max(0, +el.value || 0);
      guarda(); if (k !== 'n') pintarPJ();
    }));
    main.querySelectorAll('[data-quita]').forEach(b => b.addEventListener('click', async () => { const [i] = d.inventario.splice(+b.dataset.quita, 1); if (await guardarPJ([`Quita del inventario: ${i.n}.`])) pintarPJ(); }));
    main.querySelector('[data-libre]').addEventListener('submit', async e => { e.preventDefault(); const f = new FormData(e.target); d.inventario.push({ id: 'i' + Date.now().toString(36), n: String(f.get('n')).slice(0, 80), t: 'equipo', ref: null, q: Math.max(1, +f.get('q') || 1), peso: Math.max(0, +f.get('peso') || 0), precio: 0, notas: '' }); if (await guardarPJ([`Añade: ${f.get('n')}.`])) pintarPJ(); });
    const tq = main.querySelector('[data-tq]'), tt = main.querySelector('[data-tt]');
    tq.addEventListener('input', () => { tiendaQ = tq.value; const pos = tq.selectionStart; pintarPJ(); const n = main.querySelector('[data-tq]'); n.focus(); n.setSelectionRange(pos, pos); });
    tt.addEventListener('change', () => { tiendaT = tt.value; pintarPJ(); });
    const lista = () => { const nq = tiendaQ.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); return catalogo().filter(x => (tiendaT === 'todo' || x.t === tiendaT) && x.n.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes(nq)).slice(0, 25); };
    const meter = x => d.inventario.push({ id: 'i' + Date.now().toString(36), n: x.n, t: x.t, ref: x.ref, q: 1, peso: x.peso, precio: x.precio, equipado: x.t !== 'equipo', notas: x.info || '' });
    main.querySelectorAll('[data-compra]').forEach(b => b.addEventListener('click', async () => {
      const x = lista()[+b.dataset.compra], pago = main.querySelector('[data-pago]').value;
      if (d.dinero[pago] < x.precio) { aviso(`No te llega: cuesta ${x.precio} y tienes ${d.dinero[pago]}.`, true); return; }
      d.dinero[pago] -= x.precio; meter(x); if (await guardarPJ([`Compra ${x.n} por ${x.precio} ${pago}.`])) pintarPJ();
    }));
    main.querySelectorAll('[data-coge]').forEach(b => b.addEventListener('click', async () => { const x = lista()[+b.dataset.coge]; meter(x); if (await guardarPJ([`Añade ${x.n} sin pagar.`])) pintarPJ(); }));
  }

  /* ---------- experiencia ---------- */
  function pPX(d, c) {
    if (!c) return '<div class="pcard"><p>Primero haz la ficha en el creador.</p></div>';
    const libres = d.px.total - d.px.gastados, H = R.hitos(d.px.total), usados = d.px.hitos || { hab: 0, don: 0, ataque: 0 };
    const hl = { hab: H.hab - (usados.hab || 0), don: H.don - (usados.don || 0), ataque: H.ataque - (usados.ataque || 0) };
    const fila = (tipo, id, n, total, af, grupo, max) => { const coste = R.costePX(tipo, total + 1, grupo === 'adq' ? af : undefined); const tope = total >= max; return `<tr><th scope="row">${esc(n)}${grupo === 'adq' && !af ? ' <small class="muted">no afín</small>' : ''}</th><td class="n">${total}</td><td class="n">${tope ? '—' : coste}</td><td><button class="btn small" type="button" data-sube="${tipo}" data-id="${esc(id)}" data-g="${grupo || ''}" data-coste="${coste}" ${tope || libres < coste ? 'disabled' : ''}>+1 con PX</button>${tipo === 'hab' && hl.hab > 0 && !tope ? ` <button class="btn small" type="button" data-hito="hab" data-id="${esc(id)}" data-g="${grupo}">+1 con hito</button>` : ''}</td></tr>`; };
    return `<div class="pgrid2"><section class="pcard"><h3>Puntos de experiencia</h3><div class="pstats"><div class="pst"><span>Ganados</span><b>${d.px.total}</b></div><div class="pst"><span>Gastados</span><b>${d.px.gastados}</b></div><div class="pst"><span>Por gastar</span><b>${libres}</b></div></div>
       <p class="psmall">El máster da los PX al terminar la sesión. Costes del manual: una habilidad cuesta su nuevo total (+1 si es adquirida y no afín); un atributo, 8; un don, 20; un ataque extra, 25.</p></section>
      <section class="pcard"><h3>Hitos</h3><p class="psmall">Cada 10 PX ganados: un punto de habilidad gratis. Cada 30: un don. Cada 70: un ataque.</p><p>Puntos de habilidad: <b>${hl.hab}</b> · Dones: <b>${hl.don}</b> · Ataques: <b>${hl.ataque}</b></p>
       ${d.mejoras.length ? `<button class="btn small" type="button" data-deshacer>Deshacer la última mejora</button>` : ''}</section></div>
     <div class="pgrid2"><section class="pcard"><h3>Atributos, dones y ataques</h3><div class="tw"><table><thead><tr><th>Mejora</th><th>Ahora</th><th>PX</th><th></th></tr></thead><tbody>
       ${AT.map(([k, n]) => fila('atributo', k, n, c.A[k], null, null, G.reglas.attrMax)).join('')}</tbody></table></div>
       <form class="prow pform" data-don><label>Don nuevo<select name="n">${c.donesPosibles.filter(x => !c.dones.includes(x)).map(x => opt(x, x)).join('')}</select></label><button class="btn small" type="submit" name="con" value="px" ${libres < 20 ? 'disabled' : ''}>Comprar (20 PX)</button>${hl.don > 0 ? '<button class="btn small" type="submit" name="con" value="hito">Con hito</button>' : ''}</form>
       <div class="pacc"><button class="btn small" type="button" data-ataque="px" ${libres < 25 ? 'disabled' : ''}>Ataque extra (25 PX)</button>${hl.ataque > 0 ? '<button class="btn small" type="button" data-ataque="hito">Ataque extra con hito</button>' : ''}</div></section>
      <section class="pcard"><h3>Habilidades generales</h3><div class="tw"><table><thead><tr><th>Habilidad</th><th>Total</th><th>PX</th><th></th></tr></thead><tbody>${c.gen.map(g => fila('hab', g.id, g.n, g.total, true, 'gen', 20)).join('')}</tbody></table></div></section></div>
     <section class="pcard"><h3>Habilidades adquiridas</h3><p class="psmall">Las que tienen 0 puntos se aprenden desde aquí.</p><div class="tw"><table><thead><tr><th>Habilidad</th><th>Total</th><th>PX</th><th></th></tr></thead><tbody>${c.adqTodas.map(g => fila('hab', g.id, g.n + (g.puntos ? '' : ' (sin aprender)'), g.total, g.af, 'adq', 20)).join('')}</tbody></table></div></section>`;
  }
  function ePX(d, c) {
    if (!c) return;
    d.px.hitos = d.px.hitos || { hab: 0, don: 0, ataque: 0 };
    const aplicar = async (m, txt) => { d.mejoras.push(Object.assign(m, { ts: Date.now() })); if (m.coste) d.px.gastados += m.coste; if (m.hito) d.px.hitos[m.hito] = (d.px.hitos[m.hito] || 0) + 1; if (await guardarPJ([txt])) pintarPJ(); };
    const nombreHab = (id, g) => ((g === 'adq' ? c.adqTodas : c.gen).find(x => x.id === id) || { n: id }).n;
    main.querySelectorAll('[data-sube]').forEach(b => b.addEventListener('click', () => {
      const tipo = b.dataset.sube, id = b.dataset.id, coste = +b.dataset.coste;
      if (tipo === 'atributo') aplicar({ tipo, id, coste }, `Sube ${ATN[id]} (${coste} PX).`);
      else aplicar({ tipo: 'hab', grupo: b.dataset.g, id, coste }, `Sube ${nombreHab(id, b.dataset.g)} (${coste} PX).`);
    }));
    main.querySelectorAll('[data-hito]').forEach(b => b.addEventListener('click', () => aplicar({ tipo: 'hab', grupo: b.dataset.g, id: b.dataset.id, coste: 0, hito: 'hab' }, `Sube ${nombreHab(b.dataset.id, b.dataset.g)} con un hito.`)));
    const df = main.querySelector('[data-don]'); if (df) df.addEventListener('submit', e => { e.preventDefault(); const n = new FormData(df).get('n'), con = e.submitter && e.submitter.value; if (!n) return; aplicar(con === 'hito' ? { tipo: 'don', n, coste: 0, hito: 'don' } : { tipo: 'don', n, coste: 20 }, `Nuevo don: ${n}${con === 'hito' ? ' (hito)' : ' (20 PX)'}.`); });
    main.querySelectorAll('[data-ataque]').forEach(b => b.addEventListener('click', () => aplicar(b.dataset.ataque === 'hito' ? { tipo: 'ataque', coste: 0, hito: 'ataque' } : { tipo: 'ataque', coste: 25 }, 'Ataque extra.')));
    const dz = main.querySelector('[data-deshacer]'); if (dz) dz.addEventListener('click', async () => { const m = d.mejoras.pop(); if (m.coste) d.px.gastados -= m.coste; if (m.hito) d.px.hitos[m.hito]--; if (await guardarPJ(['Deshace la última mejora.'])) pintarPJ(); });
  }

  /* ---------- narración ---------- */
  const CAMPOS = [['concepto', 'Concepto en una frase', 1], ['aspecto', 'Aspecto', 3], ['personalidad', 'Personalidad, manías y voz', 3], ['trasfondo', 'Trasfondo', 8], ['objetivos', 'Objetivos', 3], ['contactos', 'Contactos, aliados y enemigos', 4], ['secretos', 'Secretos (solo los ves tú y tu máster)', 3]];
  function pNarr(d) {
    return `<form class="pcard pform" data-narr>${CAMPOS.map(([k, n, rows]) => rows === 1 ? `<label>${n}<input name="${k}" value="${esc(d.narracion[k] || '')}" maxlength="200"></label>` : `<label>${n}<textarea name="${k}" rows="${rows}" maxlength="20000">${esc(d.narracion[k] || '')}</textarea></label>`).join('')}<button class="btn accent" type="submit">Guardar</button></form>
     <section class="pcard"><h3>Diario del personaje</h3><form class="pform" data-diario><label>Nueva entrada<textarea name="txt" rows="3" maxlength="5000" required placeholder="Lo que pasó, lo que piensa tu personaje…"></textarea></label><button class="btn small" type="submit">Añadir al diario</button></form>
      <ol class="pdiario">${(d.narracion.diario || []).slice().reverse().map((e, k) => `<li><time>${fecha(e.ts)}${e.mundo ? ' · ' + esc(e.mundo) : ''}</time><p>${md(esc(e.txt)).replace(/\n/g, '<br>')}</p></li>`).join('') || '<li class="muted">Vacío.</li>'}</ol></section>`;
  }
  function eNarr(d) {
    main.querySelector('[data-narr]').addEventListener('submit', async e => { e.preventDefault(); const f = new FormData(e.target); CAMPOS.forEach(([k]) => { d.narracion[k] = String(f.get(k) || ''); }); if (await guardarPJ(['Actualiza la narración.'])) aviso('Guardado.'); });
    main.querySelector('[data-diario]').addEventListener('submit', async e => { e.preventDefault(); const camp = campDelPJ(); d.narracion.diario = d.narracion.diario || []; d.narracion.diario.push({ ts: Date.now(), txt: String(new FormData(e.target).get('txt')), mundo: camp ? fechaMundo(camp.ajustes.fecha) : '' }); if (await guardarPJ(['Nueva entrada en el diario.'])) pintarPJ(); });
  }
  async function eHist() {
    try { const h = await api('GET', `/personajes/${PJ.id}/historial`); main.querySelector('.ppanel').innerHTML = `<section class="pcard"><ol class="pdiario">${h.map(x => `<li><time>${fecha(x.ts)} · ${esc(x.autor || '')}</time><p>${esc(x.texto)}</p></li>`).join('')}</ol>${PJ.acceso === 'dueño' ? `<button class="btn small" type="button" data-borrapj>Borrar este personaje</button>` : ''}</section>`;
      const bp = main.querySelector('[data-borrapj]'); if (bp) { let armado = false; bp.addEventListener('click', async () => { if (!armado) { armado = true; bp.textContent = 'Pulsa otra vez para borrarlo para siempre'; return; } try { await api('DELETE', '/personajes/' + PJ.id); location.hash = '#juego'; } catch (e) { fallo(e); } }); }
    } catch (e) { fallo(e); }
  }

  /* ---------- campaña ---------- */
  let C = null, cTab = 'mesa';
  async function vistaCampana(id) {
    try { C = await api('GET', '/campanas/' + id); } catch (e) { main.innerHTML = marco('Campaña', '', `<div class="pcard"><p>${esc(e.message)}</p></div>`); enlazarComun(); return; }
    if (!ESTADO.pjs) { try { ESTADO.pjs = await api('GET', '/personajes'); } catch (e) { ESTADO.pjs = []; } }
    pintarC();
  }
  function pintarC() {
    const esM = C.rol === 'master';
    const tabs = [['mesa', 'Mesa'], ['grupo', 'Grupo'], ['notas', esM ? 'Notas y guiones' : 'Notas'], ...(esM ? [['ajustes', 'Ajustes e invitaciones']] : [])];
    if (!tabs.some(([k]) => k === cTab)) cTab = 'mesa';
    const extra = `<p class="psub">Máster: ${esc(C.master)} · ${fechaMundo(C.ajustes.fecha)} · Sistema ${esc(C.ajustes.sistema || C.sistema)} · tú eres <b>${C.rol}</b></p>`;
    main.innerHTML = marco(esc(C.nombre), `<span aria-hidden="true">/</span><span>Campaña</span>`, `<nav class="ptabs" role="tablist">${tabs.map(([k, n]) => `<button type="button" role="tab" aria-selected="${cTab === k}" data-ctab="${k}">${n}</button>`).join('')}</nav><div class="ppanel" id="cPanel"></div>`, extra);
    enlazarComun();
    main.querySelectorAll('[data-ctab]').forEach(b => b.addEventListener('click', () => { cTab = b.dataset.ctab; pintarC(); }));
    ({ mesa: cMesa, grupo: cGrupo, notas: cNotas, ajustes: cAjustes })[cTab]();
  }
  function cGrupo() {
    const P = main.querySelector('#cPanel'), esM = C.rol === 'master', yo = ESTADO.yo.id, mio = C.miembros.find(m => m.usuario_id === yo);
    P.innerHTML = `<section class="pcard"><h3>Miembros</h3><ul class="pmiem">${C.miembros.map(m => `<li><span class="rol rol-${m.rol}">${m.rol}</span><b>${esc(m.nombre)}</b>${m.personaje ? ` · ${m.personaje_id && (esM || m.usuario_id === yo) ? `<a href="#juego/pj-${m.personaje_id}">${esc(m.personaje)}</a>` : esc(m.personaje)}` : m.rol === 'jugador' ? ' · <span class="muted">sin personaje</span>' : ''}${esM && m.usuario_id !== yo ? ` <button class="btn small" type="button" data-expulsa="${m.usuario_id}">Expulsar</button>` : ''}</li>`).join('')}</ul>
      ${mio && mio.rol === 'jugador' ? `<form class="prow pform" data-elige><label>Tu personaje en esta campaña<select name="p">${opt('', '— ninguno —', !mio.personaje_id)}${(ESTADO.pjs || []).map(p => opt(p.id, p.nombre, p.id === mio.personaje_id)).join('')}</select></label><button class="btn small" type="submit">Guardar</button></form>` : ''}
      ${mio && !esM ? '<button class="btn small" type="button" data-salgo>Salir de la campaña</button>' : ''}</section>
      ${esM ? `<form class="pcard pform" data-recomp><h3>Recompensa al cerrar la sesión</h3><fieldset class="pchecks"><legend>Personajes</legend>${C.miembros.filter(m => m.personaje_id).map(m => `<label><input type="checkbox" name="pj" value="${m.personaje_id}" checked> ${esc(m.personaje)} <small class="muted">(${esc(m.nombre)})</small></label>`).join('') || '<p class="muted">Ningún jugador ha elegido personaje todavía.</p>'}</fieldset>
       <div class="prow"><label>PX<input name="px" type="number" min="0" max="500" value="5"></label><label>Akradios<input name="ak" type="number" value="0"></label><label>Créditos<input name="cr" type="number" value="0"></label></div>
       <div class="prow"><label>Objeto (opcional)<input name="obj" placeholder="Ej.: Tarjeta de acceso"></label><label>Peso (kg)<input name="peso" type="number" step="0.1" min="0" value="0.5"></label></div>
       <label>Motivo<input name="motivo" placeholder="Sesión 3: el rescate en el Caronte"></label><button class="btn accent" type="submit">Dar recompensa</button></form>` : ''}`;
    P.querySelectorAll('[data-expulsa]').forEach(b => { let armado = false; b.addEventListener('click', async () => { if (!armado) { armado = true; b.textContent = '¿Seguro?'; return; } try { await api('DELETE', `/campanas/${C.id}/miembros/${b.dataset.expulsa}`); vistaCampana(C.id); } catch (e) { fallo(e); } }); });
    const el = P.querySelector('[data-elige]'); if (el) el.addEventListener('submit', async e => { e.preventDefault(); try { await api('PATCH', `/campanas/${C.id}/miembros/${yo}`, { personaje_id: new FormData(el).get('p') || null }); ESTADO.camps = null; aviso('Personaje asignado.'); vistaCampana(C.id); } catch (er) { fallo(er); } });
    const sg = P.querySelector('[data-salgo]'); if (sg) sg.addEventListener('click', async () => { try { await api('DELETE', `/campanas/${C.id}/miembros/${yo}`); ESTADO.camps = null; location.hash = '#juego'; } catch (e) { fallo(e); } });
    const rf = P.querySelector('[data-recomp]'); if (rf) rf.addEventListener('submit', async e => { e.preventDefault(); const f = new FormData(rf); const obj = String(f.get('obj') || '').trim();
      try { const r = await api('POST', `/campanas/${C.id}/recompensa`, { personajes: f.getAll('pj'), px: +f.get('px'), akradios: +f.get('ak'), creditos: +f.get('cr'), motivo: f.get('motivo'), objetos: obj ? [{ n: obj, peso: +f.get('peso') || 0, t: 'equipo' }] : [] }); aviso(`Recompensa dada a ${r.personajes.length} personaje${r.personajes.length === 1 ? '' : 's'}.`); if (sala) sala.enviar({ t: 'chat', txt: `El máster reparte: ${f.get('px')} PX${obj ? ', ' + obj : ''}${f.get('motivo') ? ' (' + f.get('motivo') + ')' : ''}.` }); } catch (er) { fallo(er); } });
  }
  async function cNotas() {
    const P = main.querySelector('#cPanel'), esM = C.rol === 'master';
    let notas = []; try { notas = await api('GET', `/campanas/${C.id}/notas`); } catch (e) { fallo(e); }
    const TIPOS = { nota: 'Nota', guion: 'Guion de sesión', escena: 'Escena', pnj: 'PNJ', lugar: 'Lugar', faccion: 'Facción', lore: 'Trasfondo', documento: 'Documento para los jugadores' };
    const editor = n => `<form class="pcard pform" data-nota="${n ? n.id : ''}"><div class="prow"><label>Título<input name="titulo" value="${esc(n ? n.titulo : '')}" required maxlength="120"></label><label>Tipo<select name="tipo">${Object.entries(TIPOS).map(([k, v]) => opt(k, v, n && n.tipo === k)).join('')}</select></label><label>Quién la ve<select name="visible">${opt('master', 'Solo el máster', !n || n.visible === 'master')}${opt('grupo', 'Todo el grupo', n && n.visible === 'grupo')}</select></label></div>
      <label>Texto (admite **negrita** y *cursiva*)<textarea name="cuerpo" rows="10" maxlength="100000">${esc(n ? n.cuerpo : '')}</textarea></label><div class="pacc"><button class="btn accent small" type="submit">Guardar</button>${n ? '<button class="btn small" type="button" data-borranota>Borrar</button>' : ''}<button class="btn small" type="button" data-cancela>Cancelar</button></div></form>`;
    P.innerHTML = `${esM ? '<button class="btn small accent" type="button" data-nueva>Nueva nota</button>' : ''}<div id="nEd"></div>
      <div class="pnotas">${notas.map(n => `<article class="pcard pnota"><header><h3>${esc(n.titulo)}</h3><small>${esc(TIPOS[n.tipo] || n.tipo)} · ${n.visible === 'grupo' ? 'visible para el grupo' : 'solo máster'} · ${fecha(n.actualizado)}</small></header><div class="ptexto">${n.cuerpo.split(/\n{2,}/).map(p => `<p>${md(esc(p)).replace(/\n/g, '<br>')}</p>`).join('')}</div>${esM ? `<div class="pacc"><button class="btn small" type="button" data-edita="${n.id}">Editar</button>${n.visible !== 'grupo' ? `<button class="btn small" type="button" data-revela="${n.id}">Mostrar a la mesa</button>` : ''}</div>` : ''}</article>`).join('') || '<p class="muted">No hay notas.</p>'}</div>`;
    const abrir = n => { const ed = P.querySelector('#nEd'); ed.innerHTML = editor(n); const f = ed.querySelector('form');
      f.addEventListener('submit', async e => { e.preventDefault(); const d = Object.fromEntries(new FormData(f)); try { if (n) await api('PUT', `/campanas/${C.id}/notas/${n.id}`, d); else await api('POST', `/campanas/${C.id}/notas`, d); cNotas(); } catch (er) { fallo(er); } });
      f.querySelector('[data-cancela]').addEventListener('click', () => { ed.innerHTML = ''; });
      const bn = f.querySelector('[data-borranota]'); if (bn) { let armado = false; bn.addEventListener('click', async () => { if (!armado) { armado = true; bn.textContent = '¿Seguro?'; return; } await api('DELETE', `/campanas/${C.id}/notas/${n.id}`); cNotas(); }); }
      f.querySelector('input').focus(); };
    const nv = P.querySelector('[data-nueva]'); if (nv) nv.addEventListener('click', () => abrir(null));
    P.querySelectorAll('[data-edita]').forEach(b => b.addEventListener('click', () => abrir(notas.find(x => x.id === b.dataset.edita))));
    P.querySelectorAll('[data-revela]').forEach(b => b.addEventListener('click', async () => { const n = notas.find(x => x.id === b.dataset.revela); try { await api('PUT', `/campanas/${C.id}/notas/${n.id}`, Object.assign({}, n, { visible: 'grupo' })); if (sala) sala.enviar({ t: 'aviso', titulo: n.titulo, txt: n.cuerpo.slice(0, 3900) }); aviso('Nota visible para el grupo y mostrada en la mesa.'); cNotas(); } catch (e) { fallo(e); } }));
  }
  function cAjustes() {
    const P = main.querySelector('#cPanel'), f = C.ajustes.fecha || { dia: 1, ciclo: 1, anio: 791 };
    P.innerHTML = `<form class="pcard pform" data-aj><h3>Campaña</h3><label>Nombre<input name="nombre" value="${esc(C.nombre)}" maxlength="80"></label><label>Descripción para los jugadores<textarea name="descripcion" rows="3" maxlength="2000">${esc(C.descripcion)}</textarea></label>
      <div class="prow"><label>Día (1-40)<input name="dia" type="number" min="1" max="40" value="${f.dia}"></label><label>Ciclo (1-10)<input name="ciclo" type="number" min="1" max="10" value="${f.ciclo}"></label><label>Año (d. I.)<input name="anio" type="number" value="${f.anio}"></label></div>
      <label>Tipo de cambio: 1 akradio = <input name="cambio" type="number" step="0.01" min="0.01" value="${C.ajustes.cambio || 1}"> créditos coalicionarios</label>
      <label>Sistema<select name="sistema">${opt('2.0', 'Sistema 2.0', (C.ajustes.sistema || '2.0') === '2.0')}${opt('v1', 'Sistema clásico', C.ajustes.sistema === 'v1')}</select></label><button class="btn accent small" type="submit">Guardar</button></form>
     <section class="pcard"><h3>Invitar</h3><form class="prow pform" data-inv><label>Como<select name="rol">${opt('jugador', 'Jugador')}${opt('espectador', 'Espectador')}</select></label><label>Usos<input name="usos" type="number" min="1" max="20" value="1"></label><label>Días<input name="dias" type="number" min="1" max="30" value="7"></label><button class="btn small" type="submit">Crear enlace</button></form><div data-invres></div><p class="psmall">Quien no tenga cuenta la crea con el enlace; quien ya la tenga entra y acepta.</p></section>
     <section class="pcard"><h3>Borrar la campaña</h3><p class="psmall">Se borran sus notas y su registro. Los personajes de los jugadores no se tocan.</p><button class="btn small" type="button" data-borrac>Borrar campaña</button></section>`;
    P.querySelector('[data-aj]').addEventListener('submit', async e => { e.preventDefault(); const d = new FormData(e.target);
      try { const r = await api('PATCH', '/campanas/' + C.id, { nombre: d.get('nombre'), descripcion: d.get('descripcion'), ajustes: { fecha: { dia: Math.max(1, Math.min(40, +d.get('dia'))), ciclo: Math.max(1, Math.min(10, +d.get('ciclo'))), anio: +d.get('anio') || 791 }, cambio: +d.get('cambio') || 1, sistema: d.get('sistema') } }); C.ajustes = r.ajustes; C.nombre = d.get('nombre'); C.descripcion = d.get('descripcion'); ESTADO.camps = null; aviso('Guardado.'); pintarC(); } catch (er) { fallo(er); } });
    P.querySelector('[data-inv]').addEventListener('submit', async e => { e.preventDefault(); const d = new FormData(e.target);
      try { const j = await api('POST', '/invitaciones', { campana_id: C.id, rol: d.get('rol'), usos: +d.get('usos'), dias: +d.get('dias') }); const url = location.origin + location.pathname + '#juego/inv-' + j.codigo; P.querySelector('[data-invres]').innerHTML = `<p class="psmall">Enlace (${j.usos} uso${j.usos > 1 ? 's' : ''}, caduca ${fecha(j.caduca)}): <code>${esc(url)}</code> <button class="btn small" type="button" data-cp>Copiar</button></p>`; P.querySelector('[data-cp]').addEventListener('click', () => copiar(url)); } catch (er) { fallo(er); } });
    const bc = P.querySelector('[data-borrac]'); let armado = false; bc.addEventListener('click', async () => { if (!armado) { armado = true; bc.textContent = 'Pulsa otra vez para borrarla para siempre'; return; } try { await api('DELETE', '/campanas/' + C.id); ESTADO.camps = null; location.hash = '#juego'; } catch (e) { fallo(e); } });
  }

  /* ---------- mesa: sala en tiempo real ---------- */
  const GRADO_N = { pleno: 'Pleno', exito: 'Éxito', fallo: 'Fallo', complicacion: 'Complicación' };
  let misHabs = [];
  async function cMesa() {
    const P = main.querySelector('#cPanel'), esM = C.rol === 'master', mio = C.miembros.find(m => m.usuario_id === ESTADO.yo.id);
    misHabs = [];
    if (mio && mio.personaje_id) { try { const pj = await api('GET', '/personajes/' + mio.personaje_id); const c = calc(pj.datos); if (c) misHabs = [...c.gen, ...c.adq].map(h => ({ n: h.n, v: h.total })).concat(AT.map(([k, n]) => ({ n, v: c.A[k] }))); } catch (e) {} }
    P.innerHTML = `<div class="pmesa"><section class="pcard plog"><header><h3>Registro de la mesa</h3><span class="ppres" id="mPres"></span></header><ol id="mLog" aria-live="polite"></ol>
       <form class="prow pform" data-chat><label class="sr" for="mChat">Mensaje</label><input id="mChat" name="txt" placeholder="Escribe a la mesa…" maxlength="1000" autocomplete="off"><select name="para" aria-label="Para">${opt('', 'A todos')}</select><button class="btn small" type="submit">Enviar</button></form></section>
      <aside class="pcard ptira"><h3>Tirar</h3>${C.rol === 'espectador' ? '<p class="muted">Los espectadores solo miran.</p>' : `<form class="pform" data-tira>
       <label>Habilidad<select name="hab">${misHabs.length ? misHabs.map((h, k) => opt(k, `${h.n} (${h.v})`)).join('') : ''}${opt('libre', 'Valor a mano…', !misHabs.length)}</select></label>
       <div class="prow"><label>Valor<input name="valor" type="number" min="0" max="40" value="10"></label><label>Mod.<input name="mod" type="number" min="-20" max="20" value="0"></label></div>
       <div class="prow"><label>Sistema<select name="sistema">${opt('2.0', 'Sistema 2.0', (C.ajustes.sistema || '2.0') === '2.0')}${opt('v1', 'Clásico', C.ajustes.sistema === 'v1')}</select></label><label>Circunstancia<select name="ventaja">${opt(0, 'Normal')}${opt(1, 'Ventaja')}${opt(-1, 'Desventaja')}</select></label></div>
       <label class="pchk"><input type="checkbox" name="secreta"> Secreta (solo tú${esM ? '' : ' y el máster'})</label><button class="btn accent" type="submit">${ico('dice')}Tirar 1d20</button></form>
       <form class="prow pform" data-libres><label>Dados<input name="expr" placeholder="2d6+3" maxlength="20" required></label><button class="btn small" type="submit">Tirar</button></form>`}
       ${esM ? `<details class="pmas"><summary>Herramientas del máster</summary><form class="pform" data-aviso><label>Mostrar a la mesa: título<input name="titulo" maxlength="120"></label><label>Texto<textarea name="txt" rows="4" maxlength="4000"></textarea></label><button class="btn small" type="submit">Mostrar</button></form><button class="btn small" type="button" data-borralog>Vaciar el registro</button></details>` : ''}
       <p class="psmall"><a href="#mesa">${ico('dice')}Tablero táctico</a> <span class="muted">(por ahora en modo local; se conectará a esta sala)</span></p></aside></div>`;
    abrirSala(C.id);
    const ft = P.querySelector('[data-tira]');
    if (ft) {
      const sel = ft.querySelector('[name=hab]'), val = ft.querySelector('[name=valor]');
      const sync = () => { if (sel.value !== 'libre') val.value = misHabs[+sel.value].v; val.readOnly = sel.value !== 'libre'; };
      sel.addEventListener('change', sync); sync();
      ft.addEventListener('submit', e => { e.preventDefault(); const f = new FormData(ft); const h = sel.value === 'libre' ? null : misHabs[+sel.value];
        sala.enviar({ t: 'tirada', hab: +f.get('valor'), mod: +f.get('mod'), sistema: f.get('sistema'), ventaja: +f.get('ventaja'), secreta: !!f.get('secreta'), etiqueta: h ? h.n : 'Tirada' }); });
      P.querySelector('[data-libres]').addEventListener('submit', e => { e.preventDefault(); sala.enviar({ t: 'dados', expr: new FormData(e.target).get('expr'), secreta: !!ft.querySelector('[name=secreta]').checked }); });
    }
    P.querySelector('[data-chat]').addEventListener('submit', e => { e.preventDefault(); const f = new FormData(e.target), txt = String(f.get('txt') || '').trim(); if (!txt) return; sala.enviar({ t: 'chat', txt, para: f.get('para') || null }); e.target.txt.value = ''; });
    const fa = P.querySelector('[data-aviso]'); if (fa) fa.addEventListener('submit', e => { e.preventDefault(); const f = new FormData(fa); sala.enviar({ t: 'aviso', titulo: f.get('titulo'), txt: f.get('txt') }); fa.reset(); });
    const bl = P.querySelector('[data-borralog]'); if (bl) { let armado = false; bl.addEventListener('click', () => { if (!armado) { armado = true; bl.textContent = '¿Seguro?'; return; } sala.enviar({ t: 'borrar' }); armado = false; bl.textContent = 'Vaciar el registro'; }); }
  }
  function entradaHTML(e) {
    const quien = `<b>${esc(e.de_nombre)}</b>`, hora = `<time>${new Date(e.ts).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</time>`;
    if (e.tipo === 'chat') return `<li class="lchat${e.para ? ' susurro' : ''}">${hora}${quien}${e.para ? ' <small>susurra</small>' : ''}: ${esc(e.txt)}</li>`;
    if (e.tipo === 'aviso') return `<li class="laviso">${hora}<b>${esc(e.titulo || 'El máster muestra')}</b><div>${e.txt.split(/\n{2,}/).map(p => `<p>${md(esc(p)).replace(/\n/g, '<br>')}</p>`).join('')}</div></li>`;
    if (e.tipo === 'dados') return `<li class="ltir${e.secreto ? ' secreta' : ''}">${hora}${quien} tira ${esc(e.expr)}: <span class="dd">${e.dados.join(' + ')}</span> = <b class="big">${e.total}</b>${e.secreto ? ' <small>secreta</small>' : ''}</li>`;
    if (e.tipo === 'tirada') { const cls = e.grado === 'pleno' ? 'crit' : e.grado === 'exito' ? 'ok' : 'ko';
      return `<li class="ltir${e.secreto ? ' secreta' : ''}">${hora}${quien} · ${esc(e.etiqueta)} ${e.objetivo}${e.ventaja ? (e.ventaja > 0 ? ' con ventaja' : ' con desventaja') : ''}${e.sistema === 'v1' ? ' <small>clásico</small>' : ''}: <span class="dd">${e.dados.join(' y ')}</span> <b class="big ${cls}">${e.r}</b> <b class="${cls}">${e.sistema === 'v1' ? (e.grado === 'pleno' ? 'Crítico' : e.grado === 'complicacion' ? 'Fallo crítico' : GRADO_N[e.grado]) : GRADO_N[e.grado]}</b>${e.secreto ? ' <small>secreta</small>' : ''}</li>`; }
    return '';
  }
  function abrirSala(cid) {
    if (sala && sala.cid === cid && sala.ws.readyState <= 1) { sala.pintar(); return; }
    cerrarSala();
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const s = { cid, log: [], presentes: [], ws: null, intentos: 0 };
    s.pintar = () => {
      const L = document.getElementById('mLog'); if (!L) return;
      const abajo = L.scrollHeight - L.scrollTop - L.clientHeight < 40;
      L.innerHTML = s.log.map(entradaHTML).join('') || '<li class="muted">Aún no ha pasado nada. Saluda o tira algo.</li>';
      if (abajo) L.scrollTop = L.scrollHeight;
      const pr = document.getElementById('mPres'); if (pr) pr.textContent = s.presentes.length ? 'Conectados: ' + s.presentes.map(p => p.nombre).join(', ') : '';
      const para = main && main.querySelector('[data-chat] [name=para]');
      if (para) { const v = para.value; para.innerHTML = opt('', 'A todos') + s.presentes.filter(p => p.id !== ESTADO.yo.id).map(p => opt(p.id, 'Susurrar a ' + p.nombre + (p.rol === 'master' ? ' (máster)' : ''), p.id === v)).join(''); }
    };
    s.conectar = () => {
      s.ws = new WebSocket(`${proto}//${location.host}/sala/${cid}`);
      s.ws.onmessage = ev => {
        const m = JSON.parse(ev.data);
        if (m.t === 'hola') { s.log = m.registro; s.presentes = m.presentes; s.intentos = 0; }
        else if (m.t === 'entrada') { s.log.push(m.e); if (s.log.length > 300) s.log.shift(); if (m.e.tipo === 'aviso' && m.e.de !== ESTADO.yo.id) aviso('El máster muestra algo en la mesa.'); }
        else if (m.t === 'presencia') s.presentes = m.presentes;
        else if (m.t === 'borrado') s.log = [];
        else if (m.t === 'error') aviso(m.txt, true);
        s.pintar();
      };
      s.ws.onclose = () => { if (sala !== s || s.cerrada) return; const espera = Math.min(15000, 1000 * Math.pow(2, s.intentos++)); setTimeout(() => { if (sala === s && !s.cerrada) s.conectar(); }, espera); };
    };
    s.enviar = msg => { if (s.ws && s.ws.readyState === 1) s.ws.send(JSON.stringify(msg)); else aviso('Sin conexión con la sala; reintentando…', true); };
    s.ping = setInterval(() => { if (s.ws && s.ws.readyState === 1) s.ws.send('{"t":"ping"}'); }, 45000);
    sala = s; s.conectar(); s.pintar();
  }
  function cerrarSala() { if (sala) { sala.cerrada = true; clearInterval(sala.ping); try { sala.ws.close(); } catch (e) {} sala = null; } }
  function cerrarSalaSiSale(arg) { if (sala && !(arg && arg === 'c-' + sala.cid)) cerrarSala(); }
  window.addEventListener('hashchange', () => { if (!location.hash.startsWith('#juego')) cerrarSala(); });

  window.PLATAFORMA = { render, crearDesdeCreador, guardarDesdeCreador };
})();
