/* Fire Angel · Mesa de juego (apartado #mesa)
   Interfaz del tablero. En modo local este navegador hace de servidor: todo lo que se dibuja sale de
   MESA.vista(estado, quien), igual que lo que enviará la sala de Cloudflare a cada jugador. */
'use strict';
(function () {
  const { FA, esc, ico, sget, sset } = window.FAapp;
  const R = window.FA2, M = window.MESA, S2 = FA.sistema2;
  const AR = Object.fromEntries(S2.armas.map(a => [a.id, a]));
  const AM = Object.fromEntries(S2.armaduras.map(a => [a.id, a]));
  const ES = Object.fromEntries((S2.escudos || []).map(a => [a.id, a]));
  const KEY = 'fa-mesa';
  const HAB = { disparo: 'Disparo', cca: 'Combate Con Armas', csa: 'Combate Sin Armas', atletismo: 'Atletismo', buscar: 'Buscar', vista: 'Vista', informatica: 'Informática' };
  const TIPO_N = { pj: 'Personaje jugador', esbirro: 'Esbirro (sin reacción)', elite: 'Élite', jefe: 'Jefe (3 acciones)', civil: 'Civil' };
  const BANDO_N = { pj: 'PJ', enemigo: 'Enemigo', pnj: 'PNJ' };

  /* ---------- estado de la interfaz ---------- */
  let ST = null, V = null, root = null, cv = null, cx = null;
  const UI = { quien: 'master', modo: 'jugar', herr: 'muro', suelo: 1, sel: null, accion: null, tab: 'ficha', zoom: 1, ox: 20, oy: 20, nieblaMaster: true,
    plantilla: 'esbirro', llave: 'k1', textoObj: '', atq: null, hover: null, secreta: false, undo: [], redo: [], genOpt: { tema: 'instalacion', salas: 9, w: 40, h: 30, amenaza: 'novatos', semilla: '' } };
  const T = () => Math.round(30 * UI.zoom);

  function cargar() {
    try { const j = sget(KEY); if (j) { ST = JSON.parse(j); return; } } catch (e) {}
    ST = M.generar({ semilla: 791 });
    log('Mesa nueva: tablero de ejemplo generado (semilla 791). Pulsa «Generar» para otro o «Editar» para dibujar el tuyo.', 'evento');
  }
  let tGuardar = null;
  function guardar() {
    clearTimeout(tGuardar);
    tGuardar = setTimeout(() => {
      try { sset(KEY, JSON.stringify(ST)); }
      catch (e) { try { const c = Object.assign({}, ST, { fondo: null }); sset(KEY, JSON.stringify(c)); aviso('La imagen de fondo es demasiado grande para guardarse en este navegador; el resto sí se ha guardado.'); } catch (e2) {} }
    }, 300);
  }
  function snapshot() { UI.undo.push(JSON.stringify(Object.assign({}, ST, { fondo: null }))); if (UI.undo.length > 40) UI.undo.shift(); UI.redo = []; }
  function deshacer(rehacer) {
    const de = rehacer ? UI.redo : UI.undo, a = rehacer ? UI.undo : UI.redo;
    if (!de.length) return; const fondo = ST.fondo;
    a.push(JSON.stringify(Object.assign({}, ST, { fondo: null })));
    ST = JSON.parse(de.pop()); ST.fondo = fondo; cambio();
  }

  /* ---------- registro ---------- */
  function log(txt, tipo, opt) {
    opt = opt || {};
    ST.registro.unshift({ t: Date.now(), txt, tipo: tipo || 'evento', secreto: !!opt.secreto, html: opt.html || null, r: ST.ronda });
    if (ST.registro.length > 300) ST.registro.length = 300;
  }
  let avisoT = null;
  function aviso(txt) {
    const a = root && root.querySelector('#mAviso'); if (!a) return;
    a.textContent = txt; a.hidden = false; clearTimeout(avisoT); avisoT = setTimeout(() => { a.hidden = true; }, 4500);
  }

  /* ---------- utilidades de fichas ---------- */
  const ficha = id => ST.fichas.find(f => f.id === id);
  const fichaV = id => V && V.fichas.find(f => f.id === id);
  const esMaster = () => UI.quien === 'master';
  const puedeMandar = f => f && (esMaster() || (f.bando === 'pj' && (UI.quien === 'grupo' || UI.quien === f.id)));
  const armaDe = f => AR[f.arma] || AR['punos'] || { n: 'Desarmado', dados: '1d3', tipo: 'contundente', grupo: 'Cuerpo a cuerpo', rasgos: [] };
  const habArma = (f, a) => a.grupo === 'Cuerpo a cuerpo' ? (/pu[ñn]o|patada/i.test(a.n) ? 'csa' : 'cca') : 'disparo';
  const iniciales = n => (n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  function movFicha(f) { const m = R.movimiento((f.hab || {}).atletismo || 0); return f.lenta ? Math.max(1, Math.floor(m / 2)) : m; }

  /* ---------- ciclo ---------- */
  function cambio(sinNiebla) {
    if (!sinNiebla) M.actualizarNiebla(ST);
    if (UI.quien !== 'master' && UI.quien !== 'grupo' && !ficha(UI.quien)) UI.quien = 'grupo';
    V = M.vista(ST, UI.quien);
    if (UI.sel && !fichaV(UI.sel)) { UI.sel = null; UI.accion = null; }
    guardar(); dibujar(); panel(); barra();
  }

  /* ---------- render principal ---------- */
  function render(main, arg) {
    if (!ST) cargar();
    if (arg === 'pj' && window.BUILDER && window.BUILDER.resumen) {
      const r = window.BUILDER.resumen();
      if (r) { const ini = ST.fichas.find(f => f.bando === 'pj') || { x: 1, y: 1 }, pos = libreCerca(ini.x, ini.y);
        if (pos) { snapshot(); const f = M.nuevaFicha(Object.assign(r, { x: pos[0], y: pos[1] })); ST.fichas.push(f); UI.sel = f.id; UI.tab = 'ficha'; log(`${f.n} llega a la mesa desde el creador de personajes.`); } }
      try { history.replaceState(null, '', '#mesa'); } catch (e) {}
    }
    main.innerHTML = `<div class="mesa view-enter">
  <header class="mbar">
   <div class="mtit"><small>Tablero táctico · Sistema 2.0 · modo local</small><b id="mNombre"></b></div>
   <label class="msel"><span>Ver como</span><select id="mQuien" aria-label="Ver el tablero como"></select></label>
   <div class="seg" role="group" aria-label="Modo"><button type="button" data-modo="jugar">Jugar</button><button type="button" data-modo="editar">Editar</button></div>
   <div class="mronda" id="mRonda"></div>
  </header>
  <div class="mgrid">
   <div class="mboard" id="mBoard">
    <canvas id="mCanvas" tabindex="0" role="application" aria-label="Tablero de juego. Selecciona una ficha en el panel lateral y usa las flechas para moverla."></canvas>
    <div class="mzoom"><button class="ib" type="button" data-z="1" aria-label="Acercar">+</button><button class="ib" type="button" data-z="-1" aria-label="Alejar">−</button><button class="ib" type="button" data-z="0" aria-label="Centrar">⌖</button></div>
    <div class="mhover" id="mHover" aria-live="off"></div>
    <div class="maviso" id="mAviso" role="status" hidden></div>
   </div>
   <aside class="mside" aria-label="Panel de la mesa">
    <div class="mtabs" role="tablist"></div>
    <div class="mpanel" id="mPanel"></div>
   </aside>
  </div>
  <p class="mnote">Modo local: este navegador hace de servidor y guarda la mesa en él. Lo que ves «como jugador» es exactamente lo que recibirá cada jugador cuando la mesa se conecte en red (fase siguiente). Reglas: <a href="#s2-combate">combate táctico</a> · <a href="#s2-nucleo">núcleo</a> · <a href="#s2-equipo">arsenal</a>.</p>
 </div>`;
    root = main.querySelector('.mesa'); cv = root.querySelector('#mCanvas'); cx = cv.getContext('2d');
    root.querySelector('#mQuien').addEventListener('change', e => { UI.quien = e.target.value; UI.sel = null; UI.accion = null; UI.atq = null; if (!esMaster() && UI.modo === 'editar') UI.modo = 'jugar'; cambio(true); });
    root.querySelectorAll('[data-modo]').forEach(b => b.addEventListener('click', () => { if (b.dataset.modo === 'editar' && !esMaster()) { aviso('Solo el máster edita el tablero. Cambia «Ver como» a Máster.'); return; } UI.modo = b.dataset.modo; UI.accion = null; UI.atq = null; UI.tab = UI.modo === 'editar' ? 'editor' : 'ficha'; cambio(true); }));
    root.querySelectorAll('[data-z]').forEach(b => b.addEventListener('click', () => { const z = +b.dataset.z; if (!z) centrar(); else zoomEn(z > 0 ? 1.2 : 1 / 1.2, cv.clientWidth / 2, cv.clientHeight / 2); }));
    eventosCanvas();
    new ResizeObserver(() => dibujar()).observe(root.querySelector('#mBoard'));
    cambio(); if (!UI.centrado) { centrar(); UI.centrado = true; }
    setTimeout(() => { if (window.FAreveal) window.FAreveal(); }, 0);
  }

  function barra() {
    if (!root) return;
    root.querySelector('#mNombre').textContent = ST.nombre;
    const q = root.querySelector('#mQuien');
    q.innerHTML = `<option value="master">Máster (lo ve todo)</option><option value="grupo">Jugadores (vista del grupo)</option>` +
      ST.fichas.filter(f => f.bando === 'pj').map(f => `<option value="${f.id}">Jugador: ${esc(f.n)}</option>`).join('');
    q.value = UI.quien;
    root.querySelectorAll('[data-modo]').forEach(b => b.setAttribute('aria-pressed', b.dataset.modo === UI.modo));
    root.querySelector('#mRonda').innerHTML = `<span>Ronda <b>${ST.ronda}</b> · turno de <b>${ST.bando === 'pj' ? 'los PJ' : 'los enemigos'}</b></span>` +
      (esMaster() ? `<button class="btn small" type="button" id="mTurno">Pasar turno</button><button class="btn small" type="button" id="mRondaN">Nueva ronda</button>` : '');
    const bt = root.querySelector('#mTurno'); if (bt) bt.addEventListener('click', () => { ST.bando = ST.bando === 'pj' ? 'enemigo' : 'pj'; log(`Turno de ${ST.bando === 'pj' ? 'los PJ' : 'los enemigos'}.`); cambio(true); });
    const bn = root.querySelector('#mRondaN'); if (bn) bn.addEventListener('click', () => { M.nuevaRonda(ST); log(`Empieza la ronda ${ST.ronda}. Acciones y reacciones restablecidas.`); cambio(true); });
  }

  /* ---------- dibujo ---------- */
  const COL = { pj: '#4fb3a6', enemigo: '#d0503d', pnj: '#d9b26a' };
  function hash(i) { let x = (i + 1) * 2654435761 >>> 0; x ^= x >>> 13; x = Math.imul(x, 1274126177) >>> 0; return (x >>> 8) / 16777216; }
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  let imgFondo = null, imgFondoSrc = null;
  function dibujar() {
    if (!cv || !V) return;
    const box = cv.parentNode, dpr = window.devicePixelRatio || 1;
    const W = box.clientWidth, H = box.clientHeight;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + 'px'; cv.style.height = H + 'px'; }
    const c = cx; c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = '#07090b'; c.fillRect(0, 0, W, H);
    const t = T(), ox = UI.ox, oy = UI.oy;
    c.save(); c.translate(ox, oy);
    // fondo opcional
    if (V.fondo && V.fondo.img) {
      if (imgFondoSrc !== V.fondo.img) { imgFondo = new Image(); imgFondo.onload = () => dibujar(); imgFondo.src = V.fondo.img; imgFondoSrc = V.fondo.img; }
      if (imgFondo && imgFondo.complete) { c.globalAlpha = 1; c.drawImage(imgFondo, 0, 0, V.w * t, V.h * t); }
    }
    const conFondo = !!(V.fondo && V.fondo.img);
    const x0 = Math.max(0, Math.floor(-ox / t)), y0 = Math.max(0, Math.floor(-oy / t));
    const x1 = Math.min(V.w - 1, Math.ceil((W - ox) / t)), y1 = Math.min(V.h - 1, Math.ceil((H - oy) / t));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * V.w + x, e = V.estado[i], s = V.celdas[i], px = x * t, py = y * t;
      if (!V.master && e === 0) continue;
      suelo(c, s, px, py, t, i, conFondo);
      if (V.cobertura[i]) cobertura(c, V.cobertura[i], px, py, t);
      if (V.humo[i]) { c.fillStyle = 'rgba(190,190,190,.55)'; c.beginPath(); c.arc(px + t * .35, py + t * .45, t * .3, 0, 7); c.arc(px + t * .65, py + t * .55, t * .32, 0, 7); c.fill(); }
    }
    // rejilla (solo donde hay algo conocido)
    c.strokeStyle = 'rgba(255,255,255,.07)'; c.lineWidth = 1; c.beginPath();
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * V.w + x; if ((V.master || V.estado[i]) && V.celdas[i] > 0) c.rect(x * t + .5, y * t + .5, t, t); }
    c.stroke();
    // alcance de movimiento / objetivos
    if (UI.accion === 'mover' && UI.sel) {
      const f = ficha(UI.sel); if (f) { const m = movFicha(f), al = M.alcanzables(ST, f, m * Math.max(1, f.acc)); al.forEach((d, k) => { const x = k % V.w, y = Math.floor(k / V.w); if (!V.master && !V.estado[k]) return; c.fillStyle = d <= m ? 'rgba(79,179,166,.28)' : 'rgba(217,178,106,.22)'; c.fillRect(x * t + 1, y * t + 1, t - 2, t - 2); }); }
    }
    aristas(c, t, x0, y0, x1, y1);
    V.objetos.forEach(o => objeto(c, o, t));
    if (V.master && V.salas === undefined && ST.salas && UI.modo === 'editar') {
      c.font = `600 ${Math.max(10, t * .38)}px "Barlow Condensed",sans-serif`; c.fillStyle = 'rgba(255,255,255,.55)';
      ST.salas.forEach(r => c.fillText(r.funcion, r.x * t + 4, r.y * t + t * .42));
    }
    V.fichas.forEach(f => token(c, f, t));
    // niebla
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const e = V.estado[y * V.w + x];
      if (V.master) { if (!UI.nieblaMaster) continue; if (e === 0) { c.fillStyle = 'rgba(0,0,0,.42)'; c.fillRect(x * t, y * t, t, t); } else if (e === 1) { c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(x * t, y * t, t, t); } }
      else if (e === 1) { c.fillStyle = 'rgba(4,6,10,.62)'; c.fillRect(x * t, y * t, t, t); }
    }
    if (UI.atq && UI.atq.ob) { const a = ficha(UI.atq.at), b = ficha(UI.atq.ob); if (a && b) { c.strokeStyle = '#e2886b'; c.setLineDash([6, 4]); c.lineWidth = 2; c.beginPath(); c.moveTo((a.x + .5) * t, (a.y + .5) * t); c.lineTo((b.x + .5) * t, (b.y + .5) * t); c.stroke(); c.setLineDash([]); } }
    if (UI.hover && UI.modo === 'editar') { c.strokeStyle = 'rgba(217,178,106,.9)'; c.lineWidth = 2; if (UI.hover.k) { const [a, b] = M.ladosArista(V, UI.hover.k); const hz = UI.hover.k[0] === 'h'; c.beginPath(); if (hz) { c.moveTo(b[0] * t, b[1] * t); c.lineTo((b[0] + 1) * t, b[1] * t); } else { c.moveTo(b[0] * t, b[1] * t); c.lineTo(b[0] * t, (b[1] + 1) * t); } c.stroke(); } else c.strokeRect(UI.hover.x * t + 1, UI.hover.y * t + 1, t - 2, t - 2); }
    if (UI.rect) { const r = UI.rect; c.strokeStyle = '#d9b26a'; c.setLineDash([4, 3]); c.strokeRect(Math.min(r.x0, r.x1) * t, Math.min(r.y0, r.y1) * t, (Math.abs(r.x1 - r.x0) + 1) * t, (Math.abs(r.y1 - r.y0) + 1) * t); c.setLineDash([]); }
    c.restore();
  }
  function suelo(c, s, px, py, t, i, conFondo) {
    const h = hash(i);
    if (s === 0) { c.fillStyle = '#16181b'; c.fillRect(px, py, t, t); c.strokeStyle = 'rgba(255,255,255,.05)'; c.beginPath(); for (let k = -t; k < t; k += t / 3) { c.moveTo(px + k, py + t); c.lineTo(px + k + t, py); } c.save(); c.beginPath(); c.rect(px, py, t, t); c.clip(); c.beginPath(); for (let k = -t; k < t; k += t / 3) { c.moveTo(px + k, py + t); c.lineTo(px + k + t, py); } c.stroke(); c.restore(); return; }
    if (conFondo) return;
    if (s === 1) { c.fillStyle = `hsl(210,6%,${24 + h * 4}%)`; c.fillRect(px, py, t, t); c.strokeStyle = 'rgba(0,0,0,.35)'; c.strokeRect(px + 2.5, py + 2.5, t - 5, t - 5); c.fillStyle = 'rgba(255,255,255,.12)'; [[4, 4], [t - 5, 4], [4, t - 5], [t - 5, t - 5]].forEach(([a, b]) => c.fillRect(px + a, py + b, 1.5, 1.5)); }
    else if (s === 2) { c.fillStyle = `hsl(28,${22 + h * 10}%,${22 + h * 5}%)`; c.fillRect(px, py, t, t); c.fillStyle = 'rgba(0,0,0,.18)'; for (let k = 0; k < 4; k++) c.fillRect(px + hash(i * 7 + k) * t, py + hash(i * 13 + k) * t, 2, 2); }
    else if (s === 3) { c.fillStyle = '#2a2e33'; c.fillRect(px, py, t, t); c.strokeStyle = 'rgba(0,0,0,.5)'; c.beginPath(); for (let k = t / 5; k < t; k += t / 5) { c.moveTo(px + k, py); c.lineTo(px + k, py + t); c.moveTo(px, py + k); c.lineTo(px + t, py + k); } c.stroke(); }
    else if (s === 4) { c.fillStyle = `hsl(200,35%,${22 + h * 5}%)`; c.fillRect(px, py, t, t); c.strokeStyle = 'rgba(255,255,255,.12)'; c.beginPath(); c.moveTo(px + t * .2, py + t * (.4 + h * .2)); c.quadraticCurveTo(px + t * .5, py + t * .3, px + t * .8, py + t * (.4 + h * .2)); c.stroke(); }
  }
  function cobertura(c, v, px, py, t) {
    if (v === 1) { c.strokeStyle = '#c9a36a'; c.lineWidth = 1.5; c.fillStyle = 'rgba(150,110,60,.55)'; c.fillRect(px + t * .2, py + t * .25, t * .38, t * .38); c.strokeRect(px + t * .2, py + t * .25, t * .38, t * .38); c.fillRect(px + t * .45, py + t * .45, t * .35, t * .32); c.strokeRect(px + t * .45, py + t * .45, t * .35, t * .32); }
    else { c.fillStyle = '#6d7178'; c.fillRect(px + t * .12, py + t * .12, t * .76, t * .76); c.strokeStyle = '#2b2d31'; c.lineWidth = 2; c.strokeRect(px + t * .12, py + t * .12, t * .76, t * .76); c.beginPath(); c.moveTo(px + t * .12, py + t * .5); c.lineTo(px + t * .88, py + t * .5); c.stroke(); }
  }
  function aristas(c, t, x0, y0, x1, y1) {
    const dib = (cod, ax, ay, bx, by, k) => {
      if (!cod) return;
      c.lineCap = 'round';
      if (cod === 1 || (cod === 5 && !V.master)) { c.strokeStyle = '#c9c2b6'; c.lineWidth = Math.max(3, t * .14); line(ax, ay, bx, by); return; }
      if (cod === 4) { c.strokeStyle = '#8fc6e8'; c.lineWidth = 2; const nx = by - ay ? 2 : 0, ny = bx - ax ? 2 : 0; line(ax - nx, ay - ny, bx - nx, by - ny); line(ax + nx, ay + ny, bx + nx, by + ny); return; }
      if (cod === 5) { c.strokeStyle = '#c9c2b6'; c.lineWidth = Math.max(3, t * .14); c.setLineDash([t * .18, t * .12]); line(ax, ay, bx, by); c.setLineDash([]); c.strokeStyle = '#e2886b'; c.lineWidth = 1.5; line(ax, ay, bx, by); return; }
      const mx = (ax + bx) / 2, my = (ay + by) / 2, hz = ay === by;
      c.strokeStyle = '#c9c2b6'; c.lineWidth = Math.max(3, t * .14);
      line(ax, ay, hz ? ax + t * .15 : ax, hz ? ay : ay + t * .15); line(bx, by, hz ? bx - t * .15 : bx, hz ? by : by - t * .15);
      if (cod === 3) { c.strokeStyle = '#9b7b52'; c.lineWidth = 3; if (hz) line(ax + t * .15, ay, ax + t * .15, ay + t * .6); else line(ax, ay + t * .15, ax + t * .6, ay + t * .15); return; }
      c.fillStyle = cod === 6 ? '#b8862f' : '#8a6a44'; const L = t * .7, Wd = Math.max(4, t * .18);
      if (hz) c.fillRect(mx - L / 2, my - Wd / 2, L, Wd); else c.fillRect(mx - Wd / 2, my - L / 2, Wd, L);
      if (cod === 6) { c.fillStyle = '#1a1210'; c.beginPath(); c.arc(mx, my, Wd * .32, 0, 7); c.fill(); }
    };
    function line(a, b, c2, d) { cx.beginPath(); cx.moveTo(a, b); cx.lineTo(c2, d); cx.stroke(); }
    for (let y = y0; y <= y1 + 1; y++) for (let x = x0; x <= x1; x++) { const k = y * V.w + x; dib(V.aristasH[k], x * t, y * t, (x + 1) * t, y * t, 'h' + k); }
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1 + 1; x++) { const k = y * (V.w + 1) + x; dib(V.aristasV[k], x * t, y * t, x * t, (y + 1) * t, 'v' + k); }
  }
  function objeto(c, o, t) {
    const px = o.x * t, py = o.y * t;
    if (o.tipo === 'llave') { c.strokeStyle = '#e8c15a'; c.lineWidth = 2; c.beginPath(); c.arc(px + t * .35, py + t * .5, t * .13, 0, 7); c.moveTo(px + t * .48, py + t * .5); c.lineTo(px + t * .8, py + t * .5); c.moveTo(px + t * .7, py + t * .5); c.lineTo(px + t * .7, py + t * .64); c.stroke(); }
    else if (o.tipo === 'consola') { c.fillStyle = '#1b2a33'; c.fillRect(px + t * .2, py + t * .22, t * .6, t * .42); c.strokeStyle = '#59c1e0'; c.lineWidth = 1.5; c.strokeRect(px + t * .2, py + t * .22, t * .6, t * .42); c.fillStyle = '#59c1e0'; c.fillRect(px + t * .3, py + t * .32, t * .3, t * .05); c.fillRect(px + t * .3, py + t * .42, t * .2, t * .05); c.fillStyle = '#3b4249'; c.fillRect(px + t * .4, py + t * .64, t * .2, t * .14); }
    else if (o.tipo === 'nota') { c.fillStyle = 'rgba(226,136,107,.9)'; c.beginPath(); c.moveTo(px + t * .5, py + t * .85); c.lineTo(px + t * .3, py + t * .45); c.arc(px + t * .5, py + t * .4, t * .2, Math.PI * .85, Math.PI * 2.15); c.closePath(); c.fill(); }
    else { c.fillStyle = '#d9b26a'; c.beginPath(); c.arc(px + t / 2, py + t / 2, t * .15, 0, 7); c.fill(); }
  }
  function token(c, f, t) {
    const px = (f.x + .5) * t, py = (f.y + .5) * t, r = t * .38;
    c.save();
    if (f.oculto && V.master) c.globalAlpha = .5;
    c.fillStyle = f.fuera ? '#3a3a3a' : COL[f.bando] || '#999';
    c.beginPath(); c.arc(px, py, r, 0, 7); c.fill();
    c.lineWidth = UI.sel === f.id ? 3 : 1.5; c.strokeStyle = UI.sel === f.id ? '#fff' : 'rgba(0,0,0,.6)'; c.stroke();
    if (UI.atq && UI.atq.ob === f.id) { c.strokeStyle = '#e2886b'; c.lineWidth = 3; c.beginPath(); c.arc(px, py, r + 3, 0, 7); c.stroke(); }
    c.fillStyle = '#0d0b0a'; c.font = `700 ${Math.max(9, t * .34)}px "Barlow Condensed",sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(f.fuera ? '✕' : iniciales(f.n), px, py + 1);
    if (f.vitMax && !f.fuera) { const p = Math.max(0, f.vit / f.vitMax); c.fillStyle = 'rgba(0,0,0,.7)'; c.fillRect(px - r, py + r + 1, r * 2, 3); c.fillStyle = p > .5 ? '#86b88a' : p > .25 ? '#d9b26a' : '#e07565'; c.fillRect(px - r, py + r + 1, r * 2 * p, 3); }
    else if (f.herido && !f.fuera) { c.fillStyle = '#e07565'; c.beginPath(); c.arc(px + r * .75, py - r * .75, t * .09, 0, 7); c.fill(); }
    if (f.heridas) { c.fillStyle = '#e07565'; for (let k = 0; k < f.heridas; k++) c.fillRect(px - r + k * 5, py - r - 4, 3, 3); }
    c.restore();
  }

  /* ---------- vista: pan y zoom ---------- */
  function centrar() {
    if (!cv || !V) return; const W = cv.clientWidth, H = cv.clientHeight;
    const pj = ST.fichas.filter(f => f.bando === 'pj');
    UI.zoom = Math.max(W < 600 ? .9 : .5, Math.min(1.6, Math.min(W / (V.w * 30), H / (V.h * 30)) * 1.6));
    const t = T(); const cxm = pj.length ? pj.reduce((a, f) => a + f.x, 0) / pj.length : V.w / 2, cym = pj.length ? pj.reduce((a, f) => a + f.y, 0) / pj.length : V.h / 2;
    UI.ox = W / 2 - (cxm + .5) * t; UI.oy = H / 2 - (cym + .5) * t; dibujar();
  }
  function zoomEn(f, mx, my) { const t0 = T(); UI.zoom = Math.max(.35, Math.min(3, UI.zoom * f)); const t1 = T(); UI.ox = mx - (mx - UI.ox) * t1 / t0; UI.oy = my - (my - UI.oy) * t1 / t0; dibujar(); }
  function celdaEn(e) { const r = cv.getBoundingClientRect(), t = T(); const fx = (e.clientX - r.left - UI.ox) / t, fy = (e.clientY - r.top - UI.oy) / t; return { x: Math.floor(fx), y: Math.floor(fy), fx, fy }; }
  function aristaEn(p) {
    const X = Math.round(p.fx), Y = Math.round(p.fy), dv = Math.abs(p.fx - X), dh = Math.abs(p.fy - Y);
    if (dv < dh) { const y = Math.floor(p.fy); if (X < 0 || X > ST.w || y < 0 || y >= ST.h) return null; return 'v' + (y * (ST.w + 1) + X); }
    const x = Math.floor(p.fx); if (Y < 0 || Y > ST.h || x < 0 || x >= ST.w) return null; return 'h' + (Y * ST.w + x);
  }
  function eventosCanvas() {
    let drag = null, pintando = false, ultima = null;
    cv.addEventListener('wheel', e => { e.preventDefault(); const r = cv.getBoundingClientRect(); zoomEn(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('pointerdown', e => {
      cv.focus({ preventScroll: true });
      const p = celdaEn(e);
      const pan = e.button === 1 || e.button === 2 || e.shiftKey || (UI.modo === 'jugar' && !hayAlgoEn(p));
      if (pan) { drag = { x: e.clientX, y: e.clientY, ox: UI.ox, oy: UI.oy, mov: 0, p }; cv.setPointerCapture(e.pointerId); return; }
      if (UI.modo === 'editar') { snapshot(); pintando = true; ultima = null; if (UI.herr === 'sala') UI.rect = { x0: p.x, y0: p.y, x1: p.x, y1: p.y }; else editar(p, true); cv.setPointerCapture(e.pointerId); }
      else clicJuego(p);
    });
    cv.addEventListener('pointermove', e => {
      const p = celdaEn(e);
      if (drag) { drag.mov += Math.abs(e.movementX) + Math.abs(e.movementY); UI.ox = drag.ox + e.clientX - drag.x; UI.oy = drag.oy + e.clientY - drag.y; dibujar(); return; }
      const esArista = UI.modo === 'editar' && ['muro', 'puerta', 'ventana', 'secreta', 'cerradura', 'sinmuro'].includes(UI.herr);
      UI.hover = esArista ? { k: aristaEn(p) } : { x: p.x, y: p.y };
      if (pintando) {
        if (UI.herr === 'sala') { UI.rect.x1 = p.x; UI.rect.y1 = p.y; }
        else { const id = esArista ? UI.hover.k : p.x + ',' + p.y; if (id !== ultima) { ultima = id; editar(p, false); } }
      }
      hoverInfo(p); dibujar();
    });
    const fin = e => {
      if (drag && drag.mov < 4 && UI.modo === 'jugar') clicJuego(drag.p);
      drag = null;
      if (pintando) { pintando = false; if (UI.herr === 'sala' && UI.rect) { sala(UI.rect); UI.rect = null; } cambio(); }
    };
    cv.addEventListener('pointerup', fin); cv.addEventListener('pointercancel', fin);
    cv.addEventListener('pointerleave', () => { UI.hover = null; root.querySelector('#mHover').textContent = ''; dibujar(); });
    cv.addEventListener('keydown', e => {
      const f = UI.sel && ficha(UI.sel); const d = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.key];
      if (d && f && UI.modo === 'jugar' && puedeMandar(f)) { e.preventDefault(); mover(f, f.x + d[0], f.y + d[1]); }
      else if (d) { e.preventDefault(); UI.ox -= d[0] * 40; UI.oy -= d[1] * 40; dibujar(); }
      if (e.key === 'Escape') { UI.accion = null; UI.atq = null; cambio(true); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && esMaster()) { e.preventDefault(); deshacer(e.shiftKey); }
    });
  }
  function hayAlgoEn(p) { return V.fichas.some(f => f.x === p.x && f.y === p.y) || (UI.accion === 'mover' && UI.sel) || (UI.accion === 'atacar'); }
  function hoverInfo(p) {
    const el = root.querySelector('#mHover'); if (!M.dentro(V, p.x, p.y)) { el.textContent = ''; return; }
    const i = p.y * V.w + p.x; if (!V.master && !V.estado[i]) { el.textContent = `(${p.x}, ${p.y}) sin descubrir`; return; }
    const parts = [`(${p.x}, ${p.y})`, M.SUELO_N[V.celdas[i]] || ''];
    if (V.cobertura[i]) parts.push(M.COB_N[V.cobertura[i]]);
    if (V.humo[i]) parts.push('Humo');
    const f = V.fichas.find(q => q.x === p.x && q.y === p.y); if (f) parts.push(f.n);
    const o = V.objetos.find(q => q.x === p.x && q.y === p.y); if (o) parts.push(o.n);
    const s = UI.sel && ficha(UI.sel); if (s && (s.x !== p.x || s.y !== p.y)) parts.push(`${M.distanciaM(s, p)} m`);
    el.textContent = parts.filter(Boolean).join(' · ');
  }

  /* ---------- juego ---------- */
  function clicJuego(p) {
    if (!M.dentro(ST, p.x, p.y)) return;
    const f = V.fichas.find(q => q.x === p.x && q.y === p.y && !q.fuera) || V.fichas.find(q => q.x === p.x && q.y === p.y);
    const sel = UI.sel && ficha(UI.sel);
    if (UI.accion === 'atacar' && sel && f && f.id !== sel.id) { prepararAtaque(sel, ficha(f.id)); return; }
    if (UI.accion === 'mover' && sel && !f) { mover(sel, p.x, p.y); return; }
    if (f) { UI.sel = f.id; UI.atq = null; UI.accion = null; UI.tab = 'ficha'; cambio(true); return; }
    UI.accion = null; cambio(true);
  }
  function mover(f, x, y) {
    if (!puedeMandar(f)) { aviso('Esa ficha no es tuya.'); return; }
    const m = movFicha(f), al = M.alcanzables(ST, f, m * 2), d = al.get(M.idx(ST, x, y));
    if (d == null) { aviso('No se puede llegar ahí: muro, puerta cerrada, ficha enemiga o demasiado lejos.'); return; }
    const coste = Math.ceil(d / m);
    if (!esMaster() && coste > f.acc) { aviso(`Hacen falta ${coste} acciones y te quedan ${f.acc}.`); return; }
    f.x = x; f.y = y; f.acc = Math.max(0, f.acc - coste); f.cubierto = false;
    const cogido = M.recoger(ST, f);
    log(`${f.n} se mueve ${d} casilla${d > 1 ? 's' : ''} (${d * 2} m)${esMaster() && coste > (f.acc + coste) ? '' : ''}. ${coste} acción${coste > 1 ? 'es' : ''}.`);
    cogido.forEach(o => log(`${f.n} recoge: ${o.n}.`));
    if (f.acc <= 0 && !esMaster()) UI.accion = null;
    cambio();
  }
  function gastar(f, n, txt) {
    if (!esMaster() && f.acc < n) { aviso('No te quedan acciones. El máster puede empezar una ronda nueva.'); return false; }
    f.acc = Math.max(0, f.acc - n); if (txt) log(`${f.n} ${txt}`); return true;
  }

  /* ---------- ataque ---------- */
  function prepararAtaque(at, ob) {
    if (!puedeMandar(at)) return;
    const a = armaDe(at);
    UI.atq = { at: at.id, ob: ob.id, zona: 'torso', hab: habArma(at, a), ayuda: false, otras: 0, fase: 'prep', maniobra: false, secreto: false };
    UI.tab = 'ficha'; cambio(true);
  }
  function calcAtaque() {
    const A = UI.atq, at = ficha(A.at), ob = ficha(A.ob); if (!at || !ob) return null;
    const arma = armaDe(at), dist = M.distanciaM(at, ob);
    const cac = arma.grupo === 'Cuerpo a cuerpo';
    const bnd = R.banda(dist, cac ? (arma.alcance_m || null) : arma.alcance_m, R.rasgo(arma, 'alcance') ? 2 : 1);
    const lt = M.lineaDeTiro(ST, at, ob), cob = cac ? null : M.coberturaEntre(ST, at, ob);
    const zonaMod = { torso: 0, cabeza: -5, pierna: -2, brazo: -2 }[A.zona];
    const circ = R.circunstancias({ apuntar: !!at.apuntar, ayuda: A.ayuda, cobertura: A.cobForzada !== undefined ? A.cobForzada : cob, banda: bnd, arma, fue: (at.attrs || {}).fue, otras: A.otras ? [A.otras] : [] });
    const hab = (at.hab || {})[A.hab] || 0;
    const sobrecal = R.valorCalor(arma) && (at.calor || 0) >= R.CALOR_TOPE;
    return { at, ob, arma, dist, banda: bnd, lt, cob, zonaMod, circ, hab, objetivo: hab + zonaMod, sobrecal };
  }
  function tirarAtaque() {
    const c = calcAtaque(); if (!c) return;
    if (!esMaster() && c.at.acc < 1) { aviso('No te quedan acciones.'); return; }
    const A = UI.atq;
    const tir = R.tirar(c.hab, { mod: c.zonaMod, ventaja: c.circ.ventaja, bajar: c.circ.bajar, subir: c.circ.subir });
    c.at.acc = Math.max(0, c.at.acc - 1); c.at.apuntar = false;
    const cv = R.valorCalor(c.arma);
    if (cv) { const h = R.calorDisparo(c.at.calor, cv); c.at.calor = h.calor; c.at.disparoRonda = true; A.calorMsg = h.danoPropio ? 'El arma estaba al límite: el tirador sufre 1d6 sin reducción.' : h.sobrecalentada ? 'El arma queda sobrecalentada.' : ''; if (h.danoPropio) { const d6 = R.d(6); c.at.vit = Math.max(0, c.at.vit - d6); A.calorMsg += ` (${d6})`; } }
    A.tir = tir; A.grado = tir.grado; A.fase = 'tirada';
    const puedeReac = R.acierta(tir.grado) && c.ob.reac > 0 && R.tieneReaccion(c.ob.tipo) && !c.ob.fuera;
    log(`${c.at.n} ataca a ${c.ob.n} con ${c.arma.n} (${HAB[A.hab]} ${c.objetivo}${tir.ventaja ? (tir.ventaja > 0 ? ', ventaja' : ', desventaja') : ''}): ${tir.dados.join(' y ')} → ${R.NOMBRE[tir.grado]}.${c.circ.notas.length ? ' ' + c.circ.notas.join('; ') + '.' : ''}`, 'tirada', { secreto: A.secreto });
    if (!R.acierta(tir.grado)) { A.fase = 'hecho'; A.res = tir.grado === 'complicacion' ? 'Complicación: el Maestro introduce un problema (arma encasquillada, pierdes la posición, alarma…).' : 'Falla.'; }
    else if (!puedeReac) A.fase = 'danio';
    else A.fase = 'reaccion';
    cambio(true);
  }
  function reaccionar(tipo) {
    const A = UI.atq, c = calcAtaque(); if (!c) return;
    if (tipo) {
      const hab = (c.ob.hab || {})[tipo] || 0, t = R.tirar(hab);
      c.ob.reac = 0;
      const ok = R.acierta(t.grado);
      if (ok) A.grado = R.bajar(A.grado);
      A.reac = { tipo, t, ok };
      log(`${c.ob.n} reacciona (${HAB[tipo]} ${hab}): ${t.r} → ${ok ? 'el ataque baja un grado' : 'no lo evita'}.`, 'tirada', { secreto: A.secreto });
    }
    A.fase = R.acierta(A.grado) ? 'danio' : 'hecho'; if (A.fase === 'hecho') A.res = 'La reacción evita el ataque.';
    cambio(true);
  }
  function aplicarDanio() {
    const A = UI.atq, c = calcAtaque(); if (!c) return;
    const zonaArm = A.zona === 'pierna' ? 'piernas' : A.zona === 'brazo' ? 'brazos' : A.zona;
    const escudo = A.reac && A.reac.ok !== undefined && A.reac.tipo === 'cca' && c.ob.escudo && ES[c.ob.escudo] ? ES[c.ob.escudo].reduccion : 0;
    const dm = R.danio(c.arma, A.grado, { attrs: c.at.attrs, armadura: AM[c.ob.armadura] || null, zona: zonaArm, reduccionExtra: escudo, maniobra: A.maniobra });
    const noLetal = R.rasgo(c.arma, 'no letal');
    const antes = { vit: c.ob.vit, heridas: c.ob.heridas || 0 };
    const res = R.aplicarDanio({ vit: c.ob.vit, vitMax: c.ob.vitMax, heridas: c.ob.heridas || 0, esbirro: c.ob.tipo === 'esbirro' || c.ob.tipo === 'civil', fuera: c.ob.fuera, muerto: c.ob.muerto, heridasFuera: c.ob.heridasFuera || 3 }, dm.total);
    if (noLetal && res.eventos.indexOf('herida') >= 0) { res.estado.heridas = antes.heridas; res.estado.vit = 0; res.estado.fuera = true; res.estado.muerto = false; res.eventos = ['inconsciente']; }
    Object.assign(c.ob, { vit: res.estado.vit, heridas: res.estado.heridas || 0, fuera: !!res.estado.fuera, muerto: !!res.estado.muerto });
    const efectos = [];
    if (A.grado === 'pleno' && A.zona === 'cabeza') efectos.push('aturdido 1 ronda');
    if (A.zona === 'pierna') { c.ob.lenta = true; efectos.push('movimiento a la mitad'); }
    if (A.zona === 'brazo') efectos.push('desventaja con lo que lleve en esa mano');
    if (A.grado === 'pleno') ['aturde', 'derriba', 'incendiaria'].forEach(r => { if (R.rasgo(c.arma, r)) efectos.push('rasgo ' + r); });
    const ev = { herida: 'sufre una Herida', fuera: 'queda fuera de combate', muerto: 'muere', inconsciente: 'cae inconsciente' };
    const det = dm.detalle.map(d => `${d.dados.concat(d.extra).join('+')}${d.plano ? '+' + d.plano : ''}${d.reduccion ? '−' + d.reduccion : ''}=${d.neto}`).join(', ');
    A.res = `${dm.impactos > 1 ? dm.impactos + ' impactos: ' : ''}${det} → ${dm.total} de daño.${res.eventos.length ? ' ' + c.ob.n + ' ' + res.eventos.map(e => ev[e]).join(' y ') + '.' : ''}${efectos.length ? ' Efectos: ' + efectos.join(', ') + '.' : ''}${A.maniobra ? ' Pleno usado para una maniobra (empujar, derribar, desarmar o flanquear).' : ''}`;
    log(`Daño a ${c.ob.n}: ${A.res}`, 'tirada', { secreto: A.secreto });
    A.fase = 'hecho'; cambio(true);
  }

  /* ---------- edición ---------- */
  function editar(p, primero) {
    const s = ST, H = UI.herr;
    const arTools = { muro: 1, puerta: 2, ventana: 4, secreta: 5, cerradura: 6, sinmuro: 0 };
    if (H in arTools) { const k = aristaEn(p); if (!k) return; M.ponerClave(s, k, arTools[H]); if (H === 'cerradura') s.llaves[k] = UI.llave || 'k1'; else delete s.llaves[k]; dibujarRapido(); return; }
    if (!M.dentro(s, p.x, p.y)) return;
    const i = M.idx(s, p.x, p.y);
    switch (H) {
      case 'suelo': s.celdas[i] = UI.suelo; break;
      case 'roca': s.celdas[i] = 0; s.cobertura[i] = 0; break;
      case 'cobl': s.cobertura[i] = s.cobertura[i] === 1 && primero ? 0 : 1; break;
      case 'cobp': s.cobertura[i] = s.cobertura[i] === 2 && primero ? 0 : 2; break;
      case 'humo': s.humo[i] = primero ? (s.humo[i] ? 0 : 1) : 1; break;
      case 'revelar': s.niebla.explorado[i] = 1; break;
      case 'ocultar': s.niebla.explorado[i] = 0; break;
      case 'borrar': s.fichas = s.fichas.filter(f => f.x !== p.x || f.y !== p.y); s.objetos = s.objetos.filter(o => o.x !== p.x || o.y !== p.y); break;
      case 'pj': case 'enemigo': case 'pnj': if (!primero) return; if (M.solida(s, p.x, p.y)) { aviso('No se puede poner una ficha en roca.'); return; }
        if (s.fichas.some(f => f.x === p.x && f.y === p.y)) { aviso('Ya hay una ficha en esa casilla.'); return; }
        { const base = H === 'pj' ? { n: 'PJ ' + (s.fichas.filter(f => f.bando === 'pj').length + 1), attrs: { fue: 5, des: 5, con: 7 } } : Object.assign({}, M.PLANTILLAS[H === 'pnj' ? 'civil' : UI.plantilla]);
          if (base.hab) base.hab = Object.assign({}, base.hab);
          const f = M.nuevaFicha(Object.assign(base, { x: p.x, y: p.y }));
          if (H !== 'pj') { const n = s.fichas.filter(q => q.n.indexOf(base.n) === 0).length; if (n) f.n = base.n + ' ' + (n + 1); }
          s.fichas.push(f); UI.sel = f.id; }
        break;
      case 'llave': case 'consola': case 'nota': if (!primero) return;
        s.objetos = s.objetos.filter(o => o.x !== p.x || o.y !== p.y);
        s.objetos.push({ id: 'o' + Date.now().toString(36), tipo: H, n: H === 'llave' ? 'Llave ' + (UI.llave || 'k1') : H === 'consola' ? 'Consola' : (UI.textoObj || 'Nota del máster').slice(0, 40), llave: H === 'llave' ? (UI.llave || 'k1') : undefined, x: p.x, y: p.y, fijo: H === 'consola', oculto: H === 'nota', texto: UI.textoObj || '' });
        break;
    }
    dibujarRapido();
  }
  function dibujarRapido() { V = M.vista(ST, UI.quien); dibujar(); }
  function sala(r) {
    const xa = Math.max(0, Math.min(r.x0, r.x1)), xb = Math.min(ST.w - 1, Math.max(r.x0, r.x1)), ya = Math.max(0, Math.min(r.y0, r.y1)), yb = Math.min(ST.h - 1, Math.max(r.y0, r.y1));
    for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) { ST.celdas[M.idx(ST, x, y)] = UI.suelo || 1; }
    for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
      if (y === ya && !M.solida(ST, x, y - 1)) M.ponerClave(ST, M.claveArista(ST, x, y, 'N'), 1);
      if (y === yb && !M.solida(ST, x, y + 1)) M.ponerClave(ST, M.claveArista(ST, x, y, 'S'), 1);
      if (x === xa && !M.solida(ST, x - 1, y)) M.ponerClave(ST, M.claveArista(ST, x, y, 'W'), 1);
      if (x === xb && !M.solida(ST, x + 1, y)) M.ponerClave(ST, M.claveArista(ST, x, y, 'E'), 1);
      ['N', 'S', 'E', 'W'].forEach(d => { const inner = (d === 'N' && y > ya) || (d === 'S' && y < yb) || (d === 'W' && x > xa) || (d === 'E' && x < xb); if (inner) M.ponerClave(ST, M.claveArista(ST, x, y, d), 0); });
    }
  }

  /* ---------- panel lateral ---------- */
  function tabs() {
    const L = UI.modo === 'editar' ? [['editor', 'Editor'], ['ficha', 'Ficha'], ['registro', 'Registro'], ['reglas', 'Reglas']]
      : [['ficha', 'Ficha'], ['registro', 'Registro'], ['reglas', 'Reglas']];
    if (esMaster()) { L.push(['generar', 'Generar']); L.push(['tablero', 'Tablero']); }
    if (!L.some(([k]) => k === UI.tab)) UI.tab = L[0][0];
    const el = root.querySelector('.mtabs');
    el.innerHTML = L.map(([k, n]) => `<button type="button" role="tab" aria-selected="${UI.tab === k}" data-tab="${k}">${n}</button>`).join('');
    el.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => { UI.tab = b.dataset.tab; panel(); }));
  }
  function panel() {
    if (!root) return; tabs();
    const P = root.querySelector('#mPanel');
    P.innerHTML = ({ ficha: pFicha, registro: pRegistro, reglas: pReglas, editor: pEditor, generar: pGenerar, tablero: pTablero })[UI.tab]();
    enlazar(P);
  }
  const opt = (v, n, s) => `<option value="${esc(v)}"${s ? ' selected' : ''}>${esc(n)}</option>`;
  function pFicha() {
    const lista = V.fichas.filter(f => esMaster() || f.bando === 'pj' || true);
    let h = `<div class="mlist" role="list" aria-label="Fichas en el tablero">${lista.map(f => `<button type="button" role="listitem" class="mfi${UI.sel === f.id ? ' on' : ''}" data-selfi="${f.id}"><i style="background:${f.fuera ? '#3a3a3a' : COL[f.bando]}">${esc(iniciales(f.n))}</i><span>${esc(f.n)}<small>${BANDO_N[f.bando] || ''}${f.vitMax ? ` · Vit. ${f.vit}/${f.vitMax}` : f.herido ? ' · herido' : ''}${f.heridas ? ` · ${f.heridas} Her.` : ''}${f.fuera ? ' · fuera' : ''}</small></span></button>`).join('') || '<p class="muted">No hay fichas a la vista.</p>'}</div>`;
    const f = UI.sel && fichaV(UI.sel);
    if (!f) return h + `<p class="muted mhint">Toca una ficha en el tablero o en la lista. Arrastra el tablero para moverte y usa la rueda o los botones para el zoom.${esMaster() ? ' Como máster puedes mover cualquier ficha y saltarte el límite de acciones.' : ''}</p>`;
    const full = ficha(f.id), mando = puedeMandar(full);
    if (!mando && f.bando !== 'pj') return h + `<section class="mcard"><h3>${esc(f.n)}</h3><p>${BANDO_N[f.bando]}${f.herido ? ' · herido' : ''}${f.fuera ? ' · fuera de combate' : ''}</p><p class="muted">Solo el máster ve sus números.</p></section>`;
    const a = armaDe(full), arm = AM[full.armadura];
    h += `<section class="mcard"><header><h3>${esc(full.n)}</h3><small>${TIPO_N[full.tipo] || full.tipo} · ${BANDO_N[full.bando]}</small></header>
     <div class="mstats"><div><b>${full.vit}/${full.vitMax}</b><span>Vitalidad</span></div><div><b>${full.heridas || 0}/${(full.heridasFuera || 3)}</b><span>Heridas</span></div><div><b>${full.acc}</b><span>Acciones</span></div><div><b>${full.reac ? 'Sí' : 'No'}</b><span>Reacción</span></div><div><b>${movFicha(full)}</b><span>Mov. (cas.)</span></div></div>
     <p class="msmall"><b>${esc(a.n)}</b>: ${esc(a.dados)}${a.plano ? '+' + esc(a.plano) : ''} ${esc(a.tipo || '')}${a.alcance_m ? ` · ${a.alcance_m} m` : ' · cuerpo a cuerpo'}${a.cadencia > 1 ? ` · cadencia ${a.cadencia}` : ''}${a.rasgos.length ? ' · ' + a.rasgos.map(rasgoTip).join(', ') : ''}${R.valorCalor(a) ? ` · Calor ${full.calor || 0}/${R.CALOR_TOPE}` : ''}<br><b>${arm ? esc(arm.n) : 'Sin armadura'}</b>${arm ? `: reducción ${arm.reduccion.torso} en torso` : ''}${full.escudo && ES[full.escudo] ? ` · ${esc(ES[full.escudo].n)} (+${ES[full.escudo].reduccion} al reaccionar)` : ''}${full.llaves && full.llaves.length ? `<br>Llaves: ${full.llaves.map(esc).join(', ')}` : ''}${full.apuntar ? '<br><b>Apuntando</b>: ventaja en el siguiente ataque.' : ''}${full.cubierto ? '<br><b>Cubierto</b> hasta su siguiente turno.' : ''}</p>`;
    if (mando && !full.fuera && UI.modo === 'jugar') {
      const puertas = M.puertasCerca(ST, full);
      h += `<div class="macc" role="group" aria-label="Acciones">
       <button type="button" class="btn small${UI.accion === 'mover' ? ' accent' : ''}" data-acc="mover">Moverse</button>
       <button type="button" class="btn small${UI.accion === 'atacar' ? ' accent' : ''}" data-acc="atacar">Atacar</button>
       <button type="button" class="btn small" data-acc="apuntar">Apuntar</button>
       <button type="button" class="btn small" data-acc="cubrirse">Cubrirse</button>
       <button type="button" class="btn small" data-acc="buscar">Buscar</button>
       ${R.valorCalor(a) && full.calor ? '<button type="button" class="btn small" data-acc="enfriar">Enfriar arma</button>' : ''}
       ${puertas.map(p => `<button type="button" class="btn small" data-puerta="${p.k}">${p.c === 3 ? 'Cerrar' : 'Abrir'} puerta (${{ N: 'norte', S: 'sur', E: 'este', W: 'oeste' }[p.dir]})</button>`).join('')}
      </div>`;
      if (UI.accion === 'mover') h += `<p class="mhint">Toca una casilla resaltada: en verde con 1 acción, en ocre con 2. También puedes usar las flechas del teclado con el tablero seleccionado.</p>`;
      if (UI.accion === 'atacar' && !UI.atq) h += `<p class="mhint">Toca la ficha objetivo en el tablero.</p>`;
    }
    if (UI.atq && UI.atq.at === full.id) h += pAtaque();
    h += `<details class="mtir"><summary>Tirada de habilidad</summary><div class="mrow"><select id="mTirHab">${Object.entries(full.hab || {}).map(([k, v]) => opt(k, (HAB[k] || k) + ' ' + v)).join('')}</select><select id="mTirAdv">${opt(0, 'Normal')}${opt(1, 'Ventaja')}${opt(-1, 'Desventaja')}</select><input id="mTirMod" type="number" value="0" aria-label="Modificador" style="width:64px"><button class="btn small accent" type="button" data-tirhab>Tirar</button></div></details>`;
    if (esMaster()) h += pEditarFicha(full);
    return h;
  }
  function rasgoTip(k) { const key = k.replace(/\d+/g, 'N'), d = S2.rasgos[key] || S2.rasgos[k]; return d ? `<abbr class="gl" tabindex="0" data-tip="${esc(d)}">${esc(k)}</abbr>` : esc(k); }
  function pAtaque() {
    const A = UI.atq, c = calcAtaque(); if (!c) return '';
    let h = `<section class="mcard matq"><header><h3>Ataque a ${esc(c.ob.n)}</h3><button class="ib" type="button" data-atqx aria-label="Cancelar ataque">✕</button></header>`;
    if (A.fase === 'prep') {
      const cobTxt = c.cob ? (c.cob === 'pesada' ? 'pesada (baja un grado)' : 'ligera (desventaja)') : 'ninguna';
      h += `<dl class="kv"><dt>Distancia</dt><dd>${c.dist} m · ${R.BANDA[c.banda]}</dd><dt>Línea de tiro</dt><dd>${c.lt ? 'libre' : '<b class="bad">bloqueada</b>'}</dd><dt>Cobertura</dt><dd>${cobTxt}</dd></dl>
      <div class="mrow"><label>Habilidad <select data-atq="hab">${['disparo', 'cca', 'csa'].map(k => opt(k, HAB[k] + ' ' + ((c.at.hab || {})[k] || 0), A.hab === k)).join('')}</select></label>
      <label>Zona <select data-atq="zona">${opt('torso', 'Torso', A.zona === 'torso')}${opt('cabeza', 'Cabeza (−5, aturde)', A.zona === 'cabeza')}${opt('pierna', 'Pierna (−2)', A.zona === 'pierna')}${opt('brazo', 'Brazo (−2)', A.zona === 'brazo')}</select></label></div>
      <div class="mrow"><label><input type="checkbox" data-atq="ayuda"${A.ayuda ? ' checked' : ''}> Un aliado ayuda (ventaja)</label>${esMaster() ? `<label>Circunstancias <select data-atq="otras">${opt(0, 'Ninguna', !A.otras)}${opt(1, 'A favor (ventaja)', A.otras === 1)}${opt(-1, 'En contra (desventaja)', A.otras === -1)}</select></label><label>Cobertura <select data-atq="cob">${opt('auto', 'Automática', A.cobForzada === undefined)}${opt('', 'Ninguna', A.cobForzada === null)}${opt('ligera', 'Ligera', A.cobForzada === 'ligera')}${opt('pesada', 'Pesada', A.cobForzada === 'pesada')}</select></label><label><input type="checkbox" data-atq="secreto"${A.secreto ? ' checked' : ''}> Tirada secreta</label>` : ''}</div>
      <p class="msmall">Tiras <b>${HAB[A.hab]} ${c.hab}${c.zonaMod ? ' ' + c.zonaMod : ''} = ${c.objetivo}</b> · pleno con ${R.umbralPleno(c.objetivo)} o menos${c.circ.ventaja ? ` · <b>${c.circ.ventaja > 0 ? 'ventaja' : 'desventaja'}</b>` : ''}${c.circ.notas.length ? '<br>' + c.circ.notas.map(esc).join(' · ') : ''}</p>
      ${c.banda === 'fuera' ? '<p class="bad">Fuera de alcance.</p>' : ''}${!c.lt ? '<p class="bad">No hay línea de tiro.</p>' : ''}${c.sobrecal ? '<p class="bad">El arma está sobrecalentada: enfríala antes (una acción). El máster puede forzar el disparo.</p>' : ''}
      <button class="btn accent" type="button" data-atqgo${(c.banda === 'fuera' || !c.lt || c.sobrecal) && !esMaster() ? ' disabled' : ''}>Atacar (1 acción)</button>`;
    } else {
      const t = A.tir;
      h += `<div class="mres"><span class="big ${t.grado === 'pleno' ? 'crit' : R.acierta(t.grado) ? 'ok' : 'ko'}">${t.r}</span><span><b>${R.NOMBRE[t.grado]}</b>${t.dados.length > 1 ? ` <small class="muted">(${t.dados.join(' y ')})</small>` : ''}${A.grado !== t.grado ? ` → <b>${R.NOMBRE[A.grado]}</b> tras la reacción` : ''}${A.calorMsg ? `<br><small>${esc(A.calorMsg)}</small>` : ''}</span></div>`;
      if (A.fase === 'reaccion') {
        const cac = c.arma.grupo === 'Cuerpo a cuerpo', ob = c.ob, esc2 = ob.escudo && ES[ob.escudo];
        const ops = cac ? [['cca', 'Parar'], ['csa', 'Bloquear']] : (esc2 ? [['cca', 'Cubrirse con el escudo']] : [['atletismo', M.coberturaAdyacente(ST, ob) ? 'Saltar a la cobertura' : 'Tirarse al suelo']]);
        if (!cac && esc2) ops.push(['atletismo', 'Tirarse al suelo']);
        h += `<p class="msmall">${esc(ob.n)} puede reaccionar una vez por ronda: con éxito el ataque baja un grado.</p><div class="macc">${ops.map(([k, n]) => `<button class="btn small" type="button" data-reac="${k}">${n} (${HAB[k]} ${(ob.hab || {})[k] || 0})</button>`).join('')}<button class="btn small" type="button" data-reac="">No reaccionar</button></div>`;
      } else if (A.fase === 'danio') {
        h += `${A.grado === 'pleno' ? `<label class="msmall"><input type="checkbox" data-atq="maniobra"${A.maniobra ? ' checked' : ''}> Usar el pleno para una maniobra (empujar, derribar, desarmar o flanquear) en vez del dado extra</label>` : ''}<button class="btn accent" type="button" data-danio>Tirar daño</button>`;
      } else h += `<p>${esc(A.res || '')}</p><button class="btn small" type="button" data-atqx>Cerrar</button>`;
    }
    return h + '</section>';
  }
  function pEditarFicha(f) {
    const armas = S2.armas.slice().sort((a, b) => a.n.localeCompare(b.n, 'es'));
    return `<details class="mtir"><summary>Editar ficha (máster)</summary><form class="mform" data-form="${f.id}">
     <label>Nombre <input name="n" value="${esc(f.n)}"></label>
     <div class="mrow"><label>Bando <select name="bando">${Object.entries(BANDO_N).map(([k, n]) => opt(k, n, f.bando === k)).join('')}</select></label><label>Tipo <select name="tipo">${Object.entries(TIPO_N).map(([k, n]) => opt(k, n, f.tipo === k)).join('')}</select></label></div>
     <div class="mrow"><label>Vitalidad <input name="vit" type="number" value="${f.vit}"></label><label>Máx. <input name="vitMax" type="number" value="${f.vitMax}"></label><label>Heridas <input name="heridas" type="number" min="0" max="4" value="${f.heridas || 0}"></label></div>
     <div class="mrow">${Object.keys(HAB).filter(k => ['disparo', 'cca', 'csa', 'atletismo', 'buscar'].includes(k)).map(k => `<label>${HAB[k]} <input name="hab.${k}" type="number" value="${(f.hab || {})[k] || 0}"></label>`).join('')}</div>
     <div class="mrow">${['fue', 'des', 'con'].map(k => `<label>${k[0].toUpperCase() + k.slice(1)} <input name="attrs.${k}" type="number" value="${(f.attrs || {})[k] || 0}"></label>`).join('')}<label>Visión <input name="vision" type="number" value="${f.vision || 12}"></label></div>
     <label>Arma <select name="arma">${armas.map(a => opt(a.id, a.n + ' · ' + a.dados + (a.alcance_m ? ' · ' + a.alcance_m + ' m' : ''), f.arma === a.id)).join('')}</select></label>
     <label>Armadura <select name="armadura">${opt('', 'Sin armadura', !f.armadura)}${S2.armaduras.map(a => opt(a.id, a.n + ' · red. ' + a.reduccion.torso, f.armadura === a.id)).join('')}</select></label>
     <label>Escudo <select name="escudo">${opt('', 'Ninguno', !f.escudo)}${(S2.escudos || []).map(a => opt(a.id, a.n + ' · +' + a.reduccion, f.escudo === a.id)).join('')}</select></label>
     <div class="mrow"><label><input type="checkbox" name="oculto"${f.oculto ? ' checked' : ''}> Oculta a los jugadores</label><label><input type="checkbox" name="fuera"${f.fuera ? ' checked' : ''}> Fuera de combate</label></div>
     <div class="mrow"><button class="btn small accent" type="submit">Guardar</button><button class="btn small" type="button" data-curar="${f.id}">Curar del todo</button><button class="btn small" type="button" data-borrafi="${f.id}">Quitar del tablero</button></div>
    </form></details>`;
  }
  function pRegistro() {
    const L = ST.registro.filter(e => esMaster() || !e.secreto);
    return `<div class="mrow"><button class="btn small" type="button" data-copylog>Copiar registro</button>${esMaster() ? '<button class="btn small" type="button" data-clearlog>Vaciar</button>' : ''}</div>
    <ol class="mlog">${L.map(e => `<li class="${e.tipo}${e.secreto ? ' sec' : ''}"><time>R${e.r} · ${new Date(e.t).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</time>${e.secreto ? '<b>Secreta</b> ' : ''}${esc(e.txt)}</li>`).join('') || '<li class="muted">Aún no hay nada.</li>'}</ol>`;
  }
  let reglasQ = '';
  function pReglas() {
    const p = FA.pages.find(x => x.id === 's2-combate');
    const bl = p ? p.blocks : [];
    let body = '', ul = '';
    const fl = () => { if (ul) { body += `<ul>${ul}</ul>`; ul = ''; } };
    bl.forEach(b => { const t = esc(b.t || '').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>'); if (b.k === 'li') { ul += `<li>${t}</li>`; return; } fl(); if (b.k === 'h3') body += `<h4>${t}</h4>`; else if (b.k === 'h4') body += `<h5>${t}</h5>`; else if (b.k === 'quote') return; else if (b.t) body += `<p>${t}</p>`; });
    fl();
    return `<div class="mreglas"><p class="msmall">Resumen del <a href="#s2-combate">combate táctico del Sistema 2.0</a>. El tablero aplica estas reglas al calcular cobertura, alcance, reacciones y daño.</p>
     <details open><summary>Combate táctico</summary>${body}</details>
     <details><summary>Grados de éxito</summary><ul><li><b>Pleno</b>: igual o menos que la mitad de la habilidad (redondeando hacia arriba), o un 1 natural.</li><li><b>Éxito</b>: igual o menos que la habilidad.</li><li><b>Fallo</b>: más que la habilidad.</li><li><b>Complicación</b>: un 20 natural.</li><li>Ventaja y desventaja: 2d20, el mejor o el peor; no se acumulan y se anulan.</li><li>Reserva (Voluntad o Biofuerza): 1 punto tras tirar sube un grado; máximo 3 por escena.</li></ul><p><a href="#s2-nucleo">Abrir el núcleo del sistema</a></p></details>
     <details><summary>Buscar arma o rasgo</summary><input type="search" id="mRegQ" placeholder="Nombre de arma o rasgo…" value="${esc(reglasQ)}"><div id="mRegRes">${buscarRegla(reglasQ)}</div></details></div>`;
  }
  function buscarRegla(q) {
    const nz = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    if (!q || q.length < 2) return '<p class="muted msmall">Escribe al menos dos letras.</p>';
    const n = nz(q);
    const ar = S2.armas.filter(a => nz(a.n).includes(n) || a.rasgos.some(r => nz(r).includes(n))).slice(0, 12);
    const rs = Object.entries(S2.rasgos).filter(([k]) => nz(k).includes(n));
    return (rs.map(([k, v]) => `<p class="msmall"><b>${esc(k)}</b>: ${esc(v)}</p>`).join('') +
      (ar.length ? `<table class="mtab"><thead><tr><th>Arma</th><th>Daño</th><th>Alc.</th><th>Rasgos</th></tr></thead><tbody>${ar.map(a => `<tr><td>${esc(a.n)}</td><td>${esc(a.dados)}${a.plano ? '+' + esc(a.plano) : ''}<br><small>${esc(a.tipo || '')}</small></td><td>${a.alcance_m ? a.alcance_m + ' m' : 'CaC'}</td><td>${a.rasgos.map(rasgoTip).join(', ')}</td></tr>`).join('')}</tbody></table>` : '')) || '<p class="muted msmall">Nada coincide.</p>';
  }
  function pEditor() {
    const H = (k, n, tip) => `<button type="button" class="chip" data-herr="${k}" aria-pressed="${UI.herr === k}" title="${esc(tip || n)}">${n}</button>`;
    return `<div class="medit">
     <h4>Terreno</h4><div class="chips">${H('sala', 'Sala', 'Arrastra un rectángulo: suelo con muros alrededor')}${H('suelo', 'Suelo')}${H('roca', 'Roca')}</div>
     <label class="msmall">Tipo de suelo <select id="mSuelo">${M.SUELO_N.map((n, i) => i ? opt(i, n, UI.suelo === i) : '').join('')}</select></label>
     <h4>Muros y puertas</h4><div class="chips">${H('muro', 'Muro')}${H('puerta', 'Puerta')}${H('ventana', 'Ventana')}${H('secreta', 'Puerta secreta')}${H('cerradura', 'Cerradura')}${H('sinmuro', 'Quitar')}</div>
     <label class="msmall">Llave de la cerradura <input id="mLlave" value="${esc(UI.llave)}" size="6"></label>
     <h4>Cobertura y vista</h4><div class="chips">${H('cobl', 'Ligera')}${H('cobp', 'Pesada')}${H('humo', 'Humo')}</div>
     <h4>Fichas y objetos</h4><div class="chips">${H('pj', 'PJ')}${H('enemigo', 'Enemigo')}${H('pnj', 'PNJ')}${H('llave', 'Llave')}${H('consola', 'Consola')}${H('nota', 'Nota del máster')}${H('borrar', 'Borrar')}</div>
     <label class="msmall">Plantilla de enemigo <select id="mPlant">${Object.entries(M.PLANTILLAS).filter(([k]) => k !== 'civil').map(([k, p]) => opt(k, `${p.n} (${TIPO_N[p.tipo]}, Vit. ${p.vitMax})`, UI.plantilla === k)).join('')}</select></label>
     <label class="msmall">Texto del próximo objeto o nota <input id="mTxtObj" value="${esc(UI.textoObj)}"></label>
     ${window.BUILDER && window.BUILDER.resumen ? '<button class="btn small" type="button" data-impPJ>Añadir mi personaje del creador</button>' : ''}
     <h4>Niebla</h4><div class="chips">${H('revelar', 'Revelar')}${H('ocultar', 'Ocultar')}</div>
     <div class="mrow"><button class="btn small" type="button" data-niebla="todo">Revelar todo</button><button class="btn small" type="button" data-niebla="reset">Reiniciar niebla</button><label class="msmall"><input type="checkbox" id="mNM"${UI.nieblaMaster ? ' checked' : ''}> Sombrear lo que no ven los jugadores</label></div>
     <div class="mrow"><button class="btn small" type="button" data-undo>Deshacer</button><button class="btn small" type="button" data-redo>Rehacer</button><button class="btn small" type="button" data-validar>Comprobar tablero</button></div>
     <p class="mhint">Muros y puertas van en los bordes entre casillas: pasa el cursor cerca de un borde y haz clic o arrastra. Mayúsculas + arrastrar, o botón derecho, mueve el tablero.</p></div>`;
  }
  function pGenerar() {
    const g = UI.genOpt;
    return `<form class="mform" data-gen>
     <label>Tema <select name="tema">${Object.entries(M.TEMAS).map(([k, t]) => opt(k, t.n, g.tema === k)).join('')}</select></label>
     <div class="mrow"><label>Salas <input name="salas" type="number" min="3" max="20" value="${g.salas}"></label><label>Ancho <input name="w" type="number" min="20" max="100" value="${g.w}"></label><label>Alto <input name="h" type="number" min="16" max="100" value="${g.h}"></label></div>
     <label>Amenaza <select name="amenaza">${opt('novatos', 'Para Novatos (6 esbirros y un oficial)', g.amenaza === 'novatos')}${opt('veteranos', 'Para Veteranos (más grupos y élites)', g.amenaza === 'veteranos')}</select></label>
     <label>Semilla (vacío = al azar) <input name="semilla" value="${esc(g.semilla)}" inputmode="numeric"></label>
     <button class="btn accent" type="submit">${ico('dice')}Generar tablero</button>
     <p class="mhint">El generador une las salas con pasillos, pone puertas, cierra la sala objetivo con una cerradura y deja la llave en una sala a la que se puede llegar antes (lo comprueba), esconde a veces una puerta secreta y reparte cobertura, consolas y enemigos con los números calibrados del Sistema 2.0. Con la misma semilla sale el mismo tablero. Sustituye al tablero actual (puedes deshacer).</p></form>`;
  }
  function pTablero() {
    return `<form class="mform" data-tab-form>
     <label>Nombre <input name="nombre" value="${esc(ST.nombre)}"></label>
     <div class="mrow"><label>Ancho <input name="w" type="number" min="5" max="120" value="${ST.w}"></label><label>Alto <input name="h" type="number" min="5" max="120" value="${ST.h}"></label><button class="btn small" type="button" data-nuevo>Tablero vacío</button></div>
     <label>Notas del máster<textarea name="notas" rows="4">${esc(ST.notas || '')}</textarea></label>
     <button class="btn small accent" type="submit">Guardar cambios</button></form>
     <h4>Imagen de fondo</h4><p class="msmall">Sube un plano o un mapa propio; se ajusta al tamaño del tablero, debajo de la cuadrícula. Las losetas generadas por código se ocultan donde haya fondo.</p>
     <div class="mrow"><label class="btn small">Subir imagen<input type="file" accept="image/*" id="mFondo" class="sr"></label>${ST.fondo ? '<button class="btn small" type="button" data-sinfondo>Quitar fondo</button>' : ''}</div>
     <h4>Copia de seguridad</h4><p class="msmall">El tablero se guarda solo en este navegador. Copia el JSON para guardarlo fuera o pásalo a otro equipo.</p>
     <div class="mrow"><button class="btn small" type="button" data-export>Copiar JSON</button><button class="btn small" type="button" data-import>Cargar JSON pegado</button></div>
     <textarea id="mJson" rows="5" placeholder="Pega aquí un tablero en JSON y pulsa «Cargar JSON pegado»." aria-label="JSON del tablero"></textarea>`;
  }

  /* ---------- eventos del panel ---------- */
  function enlazar(P) {
    const on = (sel, fn, ev) => P.querySelectorAll(sel).forEach(el => el.addEventListener(ev || 'click', e => fn(el, e)));
    on('[data-selfi]', el => { UI.sel = el.dataset.selfi; UI.atq = null; UI.accion = null; const f = ficha(UI.sel); if (f) { const t = T(), W = cv.clientWidth, H = cv.clientHeight; if ((f.x + .5) * t + UI.ox < 0 || (f.x + .5) * t + UI.ox > W || (f.y + .5) * t + UI.oy < 0 || (f.y + .5) * t + UI.oy > H) { UI.ox = W / 2 - (f.x + .5) * t; UI.oy = H / 2 - (f.y + .5) * t; } } cambio(true); });
    on('[data-acc]', el => {
      const f = ficha(UI.sel); if (!f) return; const a = el.dataset.acc;
      if (a === 'mover' || a === 'atacar') { UI.accion = UI.accion === a ? null : a; UI.atq = null; cambio(true); return; }
      if (a === 'apuntar' && gastar(f, 1, 'apunta (ventaja en el siguiente ataque).')) f.apuntar = true;
      if (a === 'cubrirse') { if (!M.coberturaAdyacente(ST, f)) { aviso('Para cubrirse hace falta una cobertura en tu casilla o a una casilla.'); return; } if (gastar(f, 1, 'se cubre (cobertura pesada hasta su siguiente turno).')) f.cubierto = true; }
      if (a === 'enfriar' && gastar(f, 1, 'enfría su arma.')) f.calor = 0;
      if (a === 'buscar') {
        if (!gastar(f, 1)) return;
        const hab = (f.hab || {}).buscar || 10, t = R.tirar(hab);
        let txt = `${f.n} busca (Buscar ${hab}): ${t.r} → ${R.NOMBRE[t.grado]}.`;
        if (R.acierta(t.grado)) { const h = M.buscarSecretas(ST, f); txt += h.length ? ` ¡Encuentra ${h.length} puerta${h.length > 1 ? 's' : ''} secreta${h.length > 1 ? 's' : ''}!` : ' No encuentra nada.'; }
        log(txt, 'tirada');
      }
      cambio();
    });
    on('[data-puerta]', el => { const f = ficha(UI.sel), r = M.alternarPuerta(ST, el.dataset.puerta, f); log(`${f.n} ${r.ok ? r.txt : 'intenta abrir: ' + r.txt}.`); if (!r.ok) aviso(r.txt[0].toUpperCase() + r.txt.slice(1) + '. Hace falta la llave o que el máster la abra.'); cambio(); });
    on('[data-atqx]', () => { UI.atq = null; UI.accion = null; cambio(true); });
    on('[data-atq]', (el) => { const k = el.dataset.atq, A = UI.atq; if (!A) return; if (el.type === 'checkbox') A[k] = el.checked; else if (k === 'otras') A.otras = +el.value; else if (k === 'cob') { if (el.value === 'auto') delete A.cobForzada; else A.cobForzada = el.value || null; } else A[k] = el.value; panel(); }, 'change');
    on('[data-atqgo]', tirarAtaque);
    on('[data-reac]', el => reaccionar(el.dataset.reac));
    on('[data-danio]', aplicarDanio);
    on('[data-tirhab]', () => { const f = ficha(UI.sel), k = P.querySelector('#mTirHab').value, adv = +P.querySelector('#mTirAdv').value, mod = +P.querySelector('#mTirMod').value || 0; const t = R.tirar((f.hab || {})[k] || 0, { ventaja: adv, mod }); log(`${f.n} tira ${HAB[k] || k} ${((f.hab || {})[k] || 0) + mod}${adv ? (adv > 0 ? ' con ventaja' : ' con desventaja') : ''}: ${t.dados.join(' y ')} → ${R.NOMBRE[t.grado]}.`, 'tirada'); UI.tab = 'registro'; cambio(true); });
    on('form[data-form]', (el, e) => {
      e.preventDefault(); snapshot(); const f = ficha(el.dataset.form), fd = new FormData(el);
      for (const [k, v] of fd.entries()) {
        if (k.includes('.')) { const [a, b] = k.split('.'); f[a] = f[a] || {}; f[a][b] = +v; }
        else if (['vit', 'vitMax', 'heridas', 'vision'].includes(k)) f[k] = +v; else f[k] = v || null;
      }
      f.oculto = !!fd.get('oculto'); f.fuera = !!fd.get('fuera'); if (!f.fuera) f.muerto = false;
      f.acc = Math.min(f.acc, R.acciones(f.tipo)) || R.acciones(f.tipo);
      log(`El máster edita la ficha de ${f.n}.`); cambio();
    }, 'submit');
    on('[data-curar]', el => { const f = ficha(el.dataset.curar); snapshot(); Object.assign(f, { vit: f.vitMax, heridas: 0, fuera: false, muerto: false, lenta: false }); log(`${f.n} se recupera del todo.`); cambio(); });
    on('[data-borrafi]', el => { snapshot(); ST.fichas = ST.fichas.filter(f => f.id !== el.dataset.borrafi); UI.sel = null; cambio(); });
    on('[data-copylog]', () => copiar(ST.registro.filter(e => esMaster() || !e.secreto).slice().reverse().map(e => `R${e.r} ${new Date(e.t).toLocaleTimeString('es-ES')} ${e.secreto ? '[secreta] ' : ''}${e.txt}`).join('\n')));
    on('[data-clearlog]', () => { ST.registro = []; cambio(true); });
    const rq = P.querySelector('#mRegQ'); if (rq) rq.addEventListener('input', () => { reglasQ = rq.value; P.querySelector('#mRegRes').innerHTML = buscarRegla(reglasQ); });
    // editor
    on('[data-herr]', el => { UI.herr = el.dataset.herr; panel(); });
    const sv = (id, fn) => { const el = P.querySelector(id); if (el) el.addEventListener('change', () => fn(el)); };
    sv('#mSuelo', el => { UI.suelo = +el.value; }); sv('#mLlave', el => { UI.llave = el.value.trim() || 'k1'; }); sv('#mPlant', el => { UI.plantilla = el.value; }); sv('#mTxtObj', el => { UI.textoObj = el.value; }); sv('#mNM', el => { UI.nieblaMaster = el.checked; dibujar(); });
    on('[data-niebla]', el => { snapshot(); if (el.dataset.niebla === 'todo') ST.niebla.explorado.fill(1); else { ST.niebla.explorado.fill(0); ST.niebla.recuerdo = {}; } cambio(); });
    on('[data-undo]', () => deshacer(false)); on('[data-redo]', () => deshacer(true));
    on('[data-validar]', () => { const av = M.validar(ST); aviso(av.length ? av.join(' ') : 'Todo correcto: se puede llegar a todas las salas y a todas las llaves.'); });
    on('[data-impPJ]', () => {
      const r = window.BUILDER.resumen(); if (!r) { aviso('Crea primero un personaje en el creador.'); return; }
      const ini = ST.fichas.find(f => f.bando === 'pj') || { x: 1, y: 1 };
      const pos = libreCerca(ini.x, ini.y); if (!pos) { aviso('No hay sitio libre cerca de los PJ.'); return; }
      snapshot(); const f = M.nuevaFicha(Object.assign(r, { x: pos[0], y: pos[1] })); ST.fichas.push(f); UI.sel = f.id; log(`${f.n} llega a la mesa desde el creador de personajes.`); cambio();
    });
    // generar
    on('form[data-gen]', (el, e) => {
      e.preventDefault(); const fd = new FormData(el); const g = UI.genOpt;
      g.tema = fd.get('tema'); g.salas = +fd.get('salas'); g.w = +fd.get('w'); g.h = +fd.get('h'); g.amenaza = fd.get('amenaza'); g.semilla = fd.get('semilla').trim();
      const sem = g.semilla ? (parseInt(g.semilla, 10) || [...g.semilla].reduce((a, c) => a * 31 + c.charCodeAt(0) >>> 0, 7)) : Math.floor(Math.random() * 1e6);
      snapshot(); const reg = ST.registro; ST = M.generar({ tema: g.tema, salas: g.salas, w: g.w, h: g.h, amenaza: g.amenaza, semilla: sem }); ST.registro = reg;
      log(`Nuevo tablero: ${ST.nombre}.`); UI.sel = null; UI.atq = null; UI.quien = 'master'; cambio(); centrar();
    }, 'submit');
    // tablero
    on('form[data-tab-form]', (el, e) => {
      e.preventDefault(); snapshot(); const fd = new FormData(el); ST.nombre = fd.get('nombre') || ST.nombre; ST.notas = fd.get('notas');
      const w = Math.max(5, Math.min(120, +fd.get('w'))), h = Math.max(5, Math.min(120, +fd.get('h')));
      if (w !== ST.w || h !== ST.h) redimensionar(w, h);
      cambio(); aviso('Guardado.');
    }, 'submit');
    on('[data-nuevo]', () => { snapshot(); const reg = ST.registro; ST = M.crear(ST.w, ST.h, { suelo: 0, nombre: 'Tablero nuevo' }); ST.registro = reg; UI.modo = 'editar'; UI.tab = 'editor'; UI.herr = 'sala'; cambio(); aviso('Tablero vacío: dibuja salas con la herramienta «Sala» y añade puertas en los bordes.'); });
    const fi = P.querySelector('#mFondo'); if (fi) fi.addEventListener('change', () => { const file = fi.files[0]; if (!file) return; const rd = new FileReader(); rd.onload = () => reducirImagen(rd.result, img => { ST.fondo = { img }; cambio(true); aviso('Fondo añadido.'); }); rd.readAsDataURL(file); });
    on('[data-sinfondo]', () => { ST.fondo = null; cambio(true); panel(); });
    on('[data-export]', () => { const j = JSON.stringify(Object.assign({}, ST, { registro: [] })); P.querySelector('#mJson').value = j; copiar(j); });
    on('[data-import]', () => { try { const o = JSON.parse(P.querySelector('#mJson').value); if (!o.w || !o.celdas || !o.aristasH) throw 0; snapshot(); const reg = ST.registro; ST = o; ST.registro = ST.registro && ST.registro.length ? ST.registro : reg; ST.niebla = ST.niebla || { modo: 'grupo', explorado: new Array(o.w * o.h).fill(0), recuerdo: {} }; UI.sel = null; cambio(); centrar(); aviso('Tablero cargado.'); } catch (e) { aviso('Ese texto no es un tablero válido.'); } });
  }
  function libreCerca(x, y) {
    for (let r = 0; r < 6; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const nx = x + dx, ny = y + dy; if (M.dentro(ST, nx, ny) && !M.solida(ST, nx, ny) && !ST.fichas.some(f => f.x === nx && f.y === ny)) return [nx, ny]; }
    return null;
  }
  function redimensionar(w, h) {
    const n = M.crear(w, h, { suelo: 0, nombre: ST.nombre });
    for (let y = 0; y < Math.min(h, ST.h); y++) for (let x = 0; x < Math.min(w, ST.w); x++) { const a = M.idx(ST, x, y), b = y * w + x; n.celdas[b] = ST.celdas[a]; n.cobertura[b] = ST.cobertura[a]; n.humo[b] = ST.humo[a]; n.niebla.explorado[b] = ST.niebla.explorado[a]; }
    for (let y = 0; y <= Math.min(h, ST.h); y++) for (let x = 0; x < Math.min(w, ST.w); x++) n.aristasH[y * w + x] = ST.aristasH[y * ST.w + x];
    for (let y = 0; y < Math.min(h, ST.h); y++) for (let x = 0; x <= Math.min(w, ST.w); x++) n.aristasV[y * (w + 1) + x] = ST.aristasV[y * (ST.w + 1) + x];
    Object.assign(n, { fichas: ST.fichas.filter(f => f.x < w && f.y < h), objetos: ST.objetos.filter(o => o.x < w && o.y < h), registro: ST.registro, ronda: ST.ronda, bando: ST.bando, notas: ST.notas, fondo: ST.fondo });
    ST = n;
  }
  function reducirImagen(src, cb) {
    const img = new Image(); img.onload = () => { const m = 2400, k = Math.min(1, m / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); cb(c.toDataURL('image/webp', .82)); }; img.src = src;
  }
  function copiar(txt) {
    const ok = () => aviso('Copiado al portapapeles.');
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(ok, () => aviso('No se ha podido copiar: selecciona el texto y cópialo a mano.'));
    else aviso('Tu navegador no deja copiar desde aquí.');
  }

  window.MESA_UI = { render, _estado: () => ST, _ui: UI };
})();
