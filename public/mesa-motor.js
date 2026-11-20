/* Fire Angel · Mesa · motor del tablero
   Modelo de datos y lógica del tablero, sin dibujo ni DOM. Es lo que ejecutará la sala del servidor:
   en modo local corre en el navegador del máster y la interfaz solo recibe lo que devuelve vista().
   Muros, puertas y ventanas son aristas entre casillas, con propiedades de vista y paso separadas. */
(function (root, factory) {
  const M = factory(root.FA2 || (typeof require === 'function' ? require('./reglas2.js') : null));
  if (typeof module === 'object' && module.exports) module.exports = M;
  else root.MESA = M;
})(typeof self !== 'undefined' ? self : this, function (R) {
  'use strict';

  /* ---------- códigos ---------- */
  const SUELO = { ROCA: 0, METAL: 1, TIERRA: 2, REJILLA: 3, AGUA: 4 };
  const SUELO_N = ['Roca (macizo)', 'Suelo metálico', 'Tierra', 'Rejilla', 'Agua poco profunda'];
  const ARISTA = { NADA: 0, MURO: 1, PUERTA: 2, ABIERTA: 3, VENTANA: 4, SECRETA: 5, CERRADA_LLAVE: 6 };
  const ARISTA_N = ['Sin muro', 'Muro', 'Puerta cerrada', 'Puerta abierta', 'Ventana o mampara', 'Puerta secreta', 'Puerta con cerradura'];
  const COB_N = ['Sin cobertura', 'Cobertura ligera', 'Cobertura pesada'];
  const bloqueaVista = c => c === 1 || c === 2 || c === 5 || c === 6;
  const bloqueaPaso = c => c === 1 || c === 2 || c === 4 || c === 5 || c === 6;
  const esPuerta = c => c === 2 || c === 3 || c === 5 || c === 6;

  /* ---------- estado ---------- */
  function crear(w, h, opt) {
    opt = opt || {};
    const n = w * h;
    return {
      version: 1, nombre: opt.nombre || 'Tablero sin nombre', w, h,
      celdas: new Array(n).fill(opt.suelo == null ? SUELO.METAL : opt.suelo),
      cobertura: new Array(n).fill(0),
      humo: new Array(n).fill(0),
      aristasH: new Array(w * (h + 1)).fill(0),       // borde superior de (x,y): índice y*w+x, y de 0 a h
      aristasV: new Array((w + 1) * h).fill(0),       // borde izquierdo de (x,y): índice y*(w+1)+x, x de 0 a w
      llaves: {},                                      // 'h12' / 'v40' -> id de llave que abre esa puerta
      descubiertas: {},                                // puertas secretas ya descubiertas
      fichas: [], objetos: [],
      niebla: { modo: 'grupo', explorado: new Array(n).fill(0), recuerdo: {} },
      ronda: 1, bando: 'pj', registro: [],
      notas: '', fondo: null, semilla: null, tema: null
    };
  }
  const idx = (s, x, y) => y * s.w + x;
  const dentro = (s, x, y) => x >= 0 && y >= 0 && x < s.w && y < s.h;
  const solida = (s, x, y) => !dentro(s, x, y) || s.celdas[idx(s, x, y)] === SUELO.ROCA;

  // Clave y código de la arista entre (x,y) y su vecina en la dirección dada.
  function claveArista(s, x, y, dir) {
    switch (dir) {
      case 'N': return 'h' + (y * s.w + x);
      case 'S': return 'h' + ((y + 1) * s.w + x);
      case 'W': return 'v' + (y * (s.w + 1) + x);
      case 'E': return 'v' + (y * (s.w + 1) + x + 1);
    }
  }
  function leerClave(s, k) { const i = +k.slice(1); return k[0] === 'h' ? s.aristasH[i] : s.aristasV[i]; }
  function ponerClave(s, k, c) { const i = +k.slice(1); if (k[0] === 'h') s.aristasH[i] = c; else s.aristasV[i] = c; }
  const arista = (s, x, y, dir) => leerClave(s, claveArista(s, x, y, dir));
  const DIRS = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };

  // Celdas a ambos lados de una arista.
  function ladosArista(s, k) {
    const i = +k.slice(1);
    if (k[0] === 'h') { const x = i % s.w, y = Math.floor(i / s.w); return [[x, y - 1], [x, y]]; }
    const x = i % (s.w + 1), y = Math.floor(i / (s.w + 1)); return [[x - 1, y], [x, y]];
  }

  /* ---------- movimiento ---------- */
  function pasoOrto(s, x, y, dir) {
    const [dx, dy] = DIRS[dir], nx = x + dx, ny = y + dy;
    if (!dentro(s, nx, ny) || solida(s, nx, ny)) return false;
    return !bloqueaPaso(arista(s, x, y, dir));
  }
  // Diagonal solo si los dos caminos ortogonales están libres (no se cortan esquinas).
  function paso(s, x, y, dx, dy) {
    if (!dx) return pasoOrto(s, x, y, dy < 0 ? 'N' : 'S');
    if (!dy) return pasoOrto(s, x, y, dx < 0 ? 'W' : 'E');
    const h = dx < 0 ? 'W' : 'E', v = dy < 0 ? 'N' : 'S';
    return pasoOrto(s, x, y, h) && pasoOrto(s, x + dx, y, v) && pasoOrto(s, x, y, v) && pasoOrto(s, x, y + dy, h);
  }
  // Casillas alcanzables en 'max' pasos. No se atraviesan enemigos; los aliados sí, pero no se termina en ellos.
  function alcanzables(s, f, max) {
    const ocup = new Map(); s.fichas.forEach(o => { if (o !== f && !o.fuera) ocup.set(idx(s, o.x, o.y), o); });
    const dist = new Map([[idx(s, f.x, f.y), 0]]), cola = [[f.x, f.y]];
    while (cola.length) {
      const [x, y] = cola.shift(), d0 = dist.get(idx(s, x, y));
      if (d0 >= max) continue;
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy, k = idx(s, nx, ny);
        if (!dentro(s, nx, ny) || dist.has(k) || !paso(s, x, y, dx, dy)) continue;
        const o = ocup.get(k);
        if (o && o.bando !== f.bando) continue;
        dist.set(k, d0 + 1); cola.push([nx, ny]);
      }
    }
    for (const k of ocup.keys()) dist.delete(k);
    dist.delete(idx(s, f.x, f.y));
    return dist;
  }

  /* ---------- línea de visión ---------- */
  // Recorre la cuadrícula de (ax,ay) a (bx,by) en coordenadas de casilla con decimales.
  // Devuelve {libre, ventana}: si algo bloquea la vista y si se ha cruzado una ventana.
  function rayo(s, ax, ay, bx, by) {
    let cx = Math.floor(ax), cy = Math.floor(ay);
    const tx = Math.floor(bx), ty = Math.floor(by);
    const dx = bx - ax, dy = by - ay;
    const sx = dx > 0 ? 1 : dx < 0 ? -1 : 0, sy = dy > 0 ? 1 : dy < 0 ? -1 : 0;
    const tdx = sx ? Math.abs(1 / dx) : Infinity, tdy = sy ? Math.abs(1 / dy) : Infinity;
    let tmx = sx ? ((sx > 0 ? cx + 1 - ax : ax - cx) * tdx) : Infinity;
    let tmy = sy ? ((sy > 0 ? cy + 1 - ay : ay - cy) * tdy) : Infinity;
    let ventana = false, guard = 0;
    const cruzaX = (x, y) => arista(s, x, y, sx > 0 ? 'E' : 'W');
    const cruzaY = (x, y) => arista(s, x, y, sy > 0 ? 'S' : 'N');
    const opaca = (x, y) => (x !== tx || y !== ty) && (solida(s, x, y) || s.humo[idx(s, x, y)]);
    while ((cx !== tx || cy !== ty) && guard++ < 400) {
      if (Math.abs(tmx - tmy) < 1e-9) {                 // por una esquina exacta: basta un camino libre
        const a1 = cruzaX(cx, cy), a2 = cruzaY(cx + sx, cy), b1 = cruzaY(cx, cy), b2 = cruzaX(cx, cy + sy);
        const okA = !bloqueaVista(a1) && !opaca(cx + sx, cy) && !bloqueaVista(a2);
        const okB = !bloqueaVista(b1) && !opaca(cx, cy + sy) && !bloqueaVista(b2);
        if (!okA && !okB) return { libre: false, ventana };
        if ((okA && (a1 === 4 || a2 === 4)) || (!okA && (b1 === 4 || b2 === 4))) ventana = true;
        cx += sx; cy += sy; tmx += tdx; tmy += tdy;
      } else if (tmx < tmy) {
        const c = cruzaX(cx, cy); if (bloqueaVista(c)) return { libre: false, ventana };
        if (c === 4) ventana = true; cx += sx; tmx += tdx;
      } else {
        const c = cruzaY(cx, cy); if (bloqueaVista(c)) return { libre: false, ventana };
        if (c === 4) ventana = true; cy += sy; tmy += tdy;
      }
      if (opaca(cx, cy)) return { libre: false, ventana };
    }
    return { libre: true, ventana };
  }
  const PUNTOS = [[0.5, 0.5], [0.15, 0.15], [0.85, 0.15], [0.15, 0.85], [0.85, 0.85]];
  // ¿Ve la casilla (x0,y0) a la (x1,y1)? Basta con que un rayo desde el centro llegue a algún punto de la casilla.
  function ve(s, x0, y0, x1, y1) {
    let res = null;
    for (const [px, py] of PUNTOS) {
      const r = rayo(s, x0 + 0.5, y0 + 0.5, x1 + px, y1 + py);
      if (r.libre) { if (!r.ventana) return { libre: true, ventana: false }; res = r; }
    }
    return res || { libre: false, ventana: false };
  }
  // Campo de visión: conjunto de índices de casilla visibles desde (x,y) con radio en casillas.
  function campoVision(s, x, y, radio) {
    const out = new Set([idx(s, x, y)]);
    for (let yy = Math.max(0, y - radio); yy <= Math.min(s.h - 1, y + radio); yy++)
      for (let xx = Math.max(0, x - radio); xx <= Math.min(s.w - 1, x + radio); xx++) {
        if ((xx - x) * (xx - x) + (yy - y) * (yy - y) > radio * radio + radio) continue;
        if (ve(s, x, y, xx, yy).libre) out.add(idx(s, xx, yy));
      }
    return out;
  }

  /* ---------- niebla ---------- */
  // Quién mira: 'master', 'grupo' (todos los PJ) o el id de una ficha.
  function observadores(s, quien) {
    if (quien === 'master') return [];
    return s.fichas.filter(f => !f.fuera && (quien === 'grupo' ? f.bando === 'pj' : f.id === quien));
  }
  function visiblesPara(s, quien) {
    const v = new Set();
    observadores(s, quien).forEach(f => campoVision(s, f.x, f.y, f.vision || 12).forEach(i => v.add(i)));
    return v;
  }
  // Actualiza lo explorado por el grupo y lo que recuerda de cada arista. Devuelve el conjunto visible.
  function actualizarNiebla(s) {
    const v = visiblesPara(s, 'grupo'), N = s.niebla;
    v.forEach(i => {
      N.explorado[i] = 1;
      const x = i % s.w, y = Math.floor(i / s.w);
      for (const dir of 'NSEW') { const k = claveArista(s, x, y, dir); N.recuerdo[k] = aristaVisible(s, k); }
    });
    return v;
  }
  // Lo que un jugador cree que es una arista: la puerta secreta sin descubrir parece muro.
  function aristaVisible(s, k) {
    const c = leerClave(s, k);
    return c === ARISTA.SECRETA && !s.descubiertas[k] ? ARISTA.MURO : c;
  }

  // Lo único que recibe la interfaz. Para un jugador no incluye nada que no haya visto.
  // estado por casilla: 0 sin descubrir, 1 descubierta y no visible, 2 visible ahora.
  function vista(s, quien) {
    const n = s.w * s.h;
    const vis = quien === 'master' ? visiblesPara(s, 'grupo') : visiblesPara(s, quien === 'grupo' ? 'grupo' : quien);
    const exp = s.niebla.explorado;
    const estado = new Array(n);
    for (let i = 0; i < n; i++) estado[i] = vis.has(i) ? 2 : exp[i] ? 1 : 0;
    if (quien === 'master') {
      return {
        master: true, w: s.w, h: s.h, nombre: s.nombre, estado,
        celdas: s.celdas.slice(), cobertura: s.cobertura.slice(), humo: s.humo.slice(),
        aristasH: s.aristasH.slice(), aristasV: s.aristasV.slice(), llaves: Object.assign({}, s.llaves), descubiertas: Object.assign({}, s.descubiertas),
        fichas: s.fichas.map(f => Object.assign({}, f)), objetos: s.objetos.map(o => Object.assign({}, o)),
        ronda: s.ronda, bando: s.bando, fondo: s.fondo
      };
    }
    const celdas = new Array(n).fill(-1), cobertura = new Array(n).fill(0), humo = new Array(n).fill(0);
    for (let i = 0; i < n; i++) if (estado[i]) { celdas[i] = s.celdas[i]; cobertura[i] = s.cobertura[i]; humo[i] = estado[i] === 2 ? s.humo[i] : 0; }
    const aH = new Array(s.aristasH.length).fill(0), aV = new Array(s.aristasV.length).fill(0);
    const pon = (k, c) => { const i = +k.slice(1); if (k[0] === 'h') aH[i] = c; else aV[i] = c; };
    for (const k in s.niebla.recuerdo) pon(k, s.niebla.recuerdo[k]);
    vis.forEach(i => { const x = i % s.w, y = Math.floor(i / s.w); for (const dir of 'NSEW') { const k = claveArista(s, x, y, dir); pon(k, aristaVisible(s, k)); } });
    const propias = quien === 'grupo' ? (f => f.bando === 'pj') : (f => f.id === quien || f.bando === 'pj');
    const fichas = s.fichas.filter(f => propias(f) || (vis.has(idx(s, f.x, f.y)) && !f.oculto)).map(f => {
      if (f.bando === 'pj') return Object.assign({}, f);
      // De los enemigos el jugador ve nombre, posición y si están heridos; no sus números.
      return { id: f.id, n: f.n, bando: f.bando, tipo: f.tipo, x: f.x, y: f.y, fuera: f.fuera, herido: f.vit < f.vitMax || (f.heridas || 0) > 0 };
    });
    const objetos = s.objetos.filter(o => !o.oculto && (vis.has(idx(s, o.x, o.y)) || (o.fijo && exp[idx(s, o.x, o.y)])))
      .map(o => ({ id: o.id, tipo: o.tipo, n: o.n, x: o.x, y: o.y, texto: o.publico ? o.texto : '' }));
    return { master: false, w: s.w, h: s.h, nombre: s.nombre, estado, celdas, cobertura, humo, aristasH: aH, aristasV: aV, llaves: {}, descubiertas: {}, fichas, objetos, ronda: s.ronda, bando: s.bando, fondo: s.fondo };
  }

  /* ---------- combate en el tablero ---------- */
  const distanciaCasillas = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  const distanciaM = (a, b) => distanciaCasillas(a, b) * R.CASILLA_M;
  // Cobertura del objetivo frente al atacante: la de su casilla o la de la casilla vecina en dirección al atacante.
  // Una ventana en la línea de tiro cuenta como cobertura ligera. "Cubrirse" junto a una cobertura da pesada.
  function coberturaEntre(s, at, ob) {
    const sx = Math.sign(at.x - ob.x), sy = Math.sign(at.y - ob.y);
    let c = s.cobertura[idx(s, ob.x, ob.y)];
    const vecinas = [[ob.x + sx, ob.y + sy], [ob.x + sx, ob.y], [ob.x, ob.y + sy]];
    if (distanciaCasillas(at, ob) > 1) vecinas.forEach(([x, y]) => { if (dentro(s, x, y) && (x !== ob.x || y !== ob.y)) c = Math.max(c, s.cobertura[idx(s, x, y)]); });
    const l = ve(s, at.x, at.y, ob.x, ob.y);
    if (l.ventana) c = Math.max(c, 1);
    if (ob.cubierto && c >= 1) c = 2;
    return c === 2 ? 'pesada' : c === 1 ? 'ligera' : null;
  }
  const lineaDeTiro = (s, at, ob) => ve(s, at.x, at.y, ob.x, ob.y).libre;
  // ¿Hay cobertura a una casilla? (para reaccionar contra disparos saltando a ella)
  function coberturaAdyacente(s, f) {
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++)
      if (dentro(s, f.x + dx, f.y + dy) && s.cobertura[idx(s, f.x + dx, f.y + dy)]) return true;
    return false;
  }

  /* ---------- puertas y objetos ---------- */
  // Aristas adyacentes a una ficha que se pueden abrir o cerrar.
  function puertasCerca(s, f) {
    const out = [];
    for (const dir of 'NSEW') {
      const k = claveArista(s, f.x, f.y, dir), c = leerClave(s, k);
      if (esPuerta(c) && (c !== ARISTA.SECRETA || s.descubiertas[k])) out.push({ k, c, dir });
    }
    return out;
  }
  function alternarPuerta(s, k, f) {
    const c = leerClave(s, k);
    if (c === ARISTA.ABIERTA) { ponerClave(s, k, ARISTA.PUERTA); return { ok: true, txt: 'cierra la puerta' }; }
    if (c === ARISTA.PUERTA) { ponerClave(s, k, ARISTA.ABIERTA); return { ok: true, txt: 'abre la puerta' }; }
    if (c === ARISTA.SECRETA) { if (!s.descubiertas[k]) return { ok: false, txt: 'no hay ninguna puerta' }; ponerClave(s, k, ARISTA.ABIERTA); return { ok: true, txt: 'abre la puerta secreta' }; }
    if (c === ARISTA.CERRADA_LLAVE) {
      const ll = s.llaves[k];
      if (f && ll && (f.llaves || []).indexOf(ll) >= 0) { ponerClave(s, k, ARISTA.ABIERTA); return { ok: true, txt: 'abre la cerradura con la llave' }; }
      return { ok: false, txt: 'la puerta tiene cerradura' + (ll ? '' : '') };
    }
    return { ok: false, txt: 'no es una puerta' };
  }
  // Recoger lo que haya en la casilla al llegar (llaves y objetos sueltos).
  function recoger(s, f) {
    const aqui = s.objetos.filter(o => o.x === f.x && o.y === f.y && o.tipo === 'llave');
    aqui.forEach(o => { f.llaves = f.llaves || []; if (f.llaves.indexOf(o.llave) < 0) f.llaves.push(o.llave); });
    s.objetos = s.objetos.filter(o => aqui.indexOf(o) < 0);
    return aqui;
  }
  // Buscar puertas secretas alrededor: con éxito se descubren las que estén a 1 casilla.
  function buscarSecretas(s, f) {
    const halladas = [];
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      const x = f.x + dx, y = f.y + dy; if (!dentro(s, x, y)) continue;
      for (const dir of 'NSEW') { const k = claveArista(s, x, y, dir); if (leerClave(s, k) === ARISTA.SECRETA && !s.descubiertas[k]) { s.descubiertas[k] = true; halladas.push(k); } }
    }
    return halladas;
  }

  /* ---------- ronda ---------- */
  function nuevaRonda(s) {
    s.ronda++; s.bando = 'pj';
    s.fichas.forEach(f => {
      f.acc = R.acciones(f.tipo); f.reac = R.tieneReaccion(f.tipo) ? 1 : 0; f.cubierto = false;
      if (!f.disparoRonda && f.calor) f.calor = R.calorFinRonda(f.calor, false);
      f.disparoRonda = false;
    });
  }

  /* ---------- fichas ---------- */
  let contador = 0;
  function nuevaFicha(datos) {
    const f = Object.assign({
      id: 'f' + Date.now().toString(36) + (contador++).toString(36), n: 'Ficha', bando: 'pj', tipo: 'pj',
      x: 0, y: 0, vision: 12, oculto: false,
      attrs: { fue: 5, des: 5, con: 5 }, hab: { disparo: 11, cca: 11, csa: 9, atletismo: 9 },
      arma: 'fusil-de-asalto', armadura: 'armadura-de-infanteria', escudo: null,
      heridas: 0, llaves: [], calor: 0, notas: ''
    }, datos || {});
    if (f.vitMax == null) f.vitMax = f.tipo === 'pj' ? R.vitalidadMax(f.attrs.con) : 10;
    if (f.vit == null) f.vit = f.vitMax;
    f.acc = R.acciones(f.tipo); f.reac = R.tieneReaccion(f.tipo) ? 1 : 0;
    return f;
  }

  /* ---------- generador de mazmorras ---------- */
  // Plantillas de enemigo: las mismas de las simulaciones de «Equilibrio y simulaciones».
  const PLANTILLAS = {
    esbirro: { n: 'Esbirro', bando: 'enemigo', tipo: 'esbirro', vitMax: 10, hab: { disparo: 12, cca: 10, csa: 9, atletismo: 9 }, arma: 'fusil-de-asalto', armadura: 'armadura-de-infanteria', vision: 10 },
    bandido: { n: 'Bandido', bando: 'enemigo', tipo: 'esbirro', vitMax: 7, hab: { disparo: 11, cca: 10, csa: 9, atletismo: 9 }, arma: 'pistola', armadura: 'cuero-endurecido', vision: 10 },
    oficial: { n: 'Oficial', bando: 'enemigo', tipo: 'elite', vitMax: 24, hab: { disparo: 14, cca: 12, csa: 10, atletismo: 10 }, arma: 'fusil-de-asalto', armadura: 'armadura-de-infanteria', vision: 12 },
    veterano: { n: 'Veterano Genosol', bando: 'enemigo', tipo: 'elite', vitMax: 20, hab: { disparo: 14, cca: 12, csa: 11, atletismo: 11 }, arma: 'fusil-de-asalto', armadura: 'armadura-genosol', vision: 12 },
    cabecilla: { n: 'Cabecilla', bando: 'enemigo', tipo: 'jefe', vitMax: 26, hab: { disparo: 14, cca: 13, csa: 11, atletismo: 11 }, arma: 'escopeta', armadura: 'armadura-de-placas', vision: 12 },
    civil: { n: 'Civil', bando: 'pnj', tipo: 'esbirro', vitMax: 6, hab: { disparo: 6, cca: 6, csa: 6, atletismo: 8 }, arma: 'cuchillo', armadura: null, vision: 10 }
  };
  const TEMAS = {
    instalacion: { n: 'Instalación industrial', suelo: SUELO.METAL, pasillo: SUELO.REJILLA, puerta: 0.85, cob: ['Cajas de carga', 'Bloque de hormigón'], salas: ['Sala de control', 'Almacén', 'Barracones', 'Laboratorio', 'Generador', 'Taller'] },
    bunker: { n: 'Búnker militar', suelo: SUELO.METAL, pasillo: SUELO.METAL, puerta: 0.95, cob: ['Sacos terreros', 'Muro de hormigón'], salas: ['Armería', 'Puesto de mando', 'Barracones', 'Comunicaciones', 'Enfermería', 'Calabozo'] },
    ruinas: { n: 'Ruinas anteriores a la Caída', suelo: SUELO.TIERRA, pasillo: SUELO.TIERRA, puerta: 0.35, cob: ['Escombros', 'Columna caída'], salas: ['Salón derruido', 'Cripta', 'Galería', 'Archivo', 'Patio', 'Cámara sellada'] }
  };
  function generar(opt) {
    opt = Object.assign({ w: 40, h: 30, salas: 9, tema: 'instalacion', semilla: Date.now() % 100000, amenaza: 'novatos' }, opt || {});
    const rnd = R.semilla(opt.semilla), ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
    const T = TEMAS[opt.tema] || TEMAS.instalacion;
    const s = crear(opt.w, opt.h, { suelo: SUELO.ROCA, nombre: T.n + ' · semilla ' + opt.semilla });
    s.semilla = opt.semilla; s.tema = opt.tema;
    const sala = new Array(s.w * s.h).fill(-1), rooms = [];
    for (let t = 0; t < 400 && rooms.length < opt.salas; t++) {
      const w = ri(4, 9), h = ri(4, 7), x = ri(1, s.w - w - 1), y = ri(1, s.h - h - 1);
      if (rooms.some(r => x < r.x + r.w + 2 && x + w + 2 > r.x && y < r.y + r.h + 2 && y + h + 2 > r.y)) continue;
      rooms.push({ x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1), id: rooms.length });
    }
    rooms.forEach(r => { for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) { s.celdas[idx(s, x, y)] = T.suelo; sala[idx(s, x, y)] = r.id; } });
    // Conexiones: árbol mínimo por distancia más algún bucle.
    const enl = [], dentroArbol = [0], fuera = rooms.slice(1).map(r => r.id);
    const dd = (a, b) => Math.abs(rooms[a].cx - rooms[b].cx) + Math.abs(rooms[a].cy - rooms[b].cy);
    while (fuera.length) {
      let best = null;
      dentroArbol.forEach(a => fuera.forEach(b => { if (!best || dd(a, b) < best[2]) best = [a, b, dd(a, b)]; }));
      enl.push([best[0], best[1]]); dentroArbol.push(best[1]); fuera.splice(fuera.indexOf(best[1]), 1);
    }
    for (let k = 0; k < Math.max(1, rooms.length >> 2); k++) { const a = ri(0, rooms.length - 1), b = ri(0, rooms.length - 1); if (a !== b && !enl.some(e => (e[0] === a && e[1] === b) || (e[0] === b && e[1] === a))) enl.push([a, b, 'extra']); }
    const entradas = new Map();                  // clave de arista -> sala a la que se entra
    function cavar(a, b) {
      let x = rooms[a].cx, y = rooms[a].cy; const tx = rooms[b].cx, ty = rooms[b].cy, horizontalPrimero = rnd() < 0.5;
      const pasos = [];
      const ir = (ex, ey) => { while (x !== ex || y !== ey) { const nx = x + Math.sign(ex - x), ny = y + Math.sign(ey - y); pasos.push([x, y, nx, ny]); x = nx; y = ny; } };
      if (horizontalPrimero) { ir(tx, y); ir(tx, ty); } else { ir(x, ty); ir(tx, ty); }
      pasos.forEach(([x0, y0, x1, y1]) => {
        const i1 = idx(s, x1, y1);
        if (s.celdas[i1] === SUELO.ROCA) s.celdas[i1] = T.pasillo;
        const r0 = sala[idx(s, x0, y0)], r1 = sala[i1];
        if (r0 !== r1) { const dir = x1 > x0 ? 'E' : x1 < x0 ? 'W' : y1 > y0 ? 'S' : 'N'; entradas.set(claveArista(s, x0, y0, dir), r1 >= 0 ? r1 : r0); }
      });
    }
    enl.forEach(([a, b]) => cavar(a, b));
    // Muros finos entre salas y pasillos (excepto en las entradas) y puertas en las entradas.
    for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
      const i = idx(s, x, y); if (s.celdas[i] === SUELO.ROCA) continue;
      for (const dir of 'SE') {
        const [dx, dy] = DIRS[dir], nx = x + dx, ny = y + dy; if (!dentro(s, nx, ny) || solida(s, nx, ny)) continue;
        const k = claveArista(s, x, y, dir), a = sala[i], b = sala[idx(s, nx, ny)];
        if (a !== b) ponerClave(s, k, entradas.has(k) ? (rnd() < T.puerta ? ARISTA.PUERTA : ARISTA.NADA) : ARISTA.MURO);
      }
    }
    // Recorrido por casillas con aristas bloqueadas tratadas como paso (las puertas se abren).
    function bfs(desde, bloqueadas) {
      const dist = new Map([[idx(s, desde[0], desde[1]), 0]]), q = [desde];
      while (q.length) {
        const [x, y] = q.shift(), d0 = dist.get(idx(s, x, y));
        for (const dir of 'NSEW') {
          const [dx, dy] = DIRS[dir], nx = x + dx, ny = y + dy; if (!dentro(s, nx, ny) || solida(s, nx, ny)) continue;
          const k = claveArista(s, x, y, dir), c = leerClave(s, k);
          if (c === ARISTA.MURO || c === ARISTA.VENTANA || (bloqueadas && bloqueadas.has(k))) continue;
          const ni = idx(s, nx, ny); if (dist.has(ni)) continue; dist.set(ni, d0 + 1); q.push([nx, ny]);
        }
      }
      return dist;
    }
    const inicio = rooms[0];
    const d0 = bfs([inicio.cx, inicio.cy]);
    const lejos = rooms.slice(1).reduce((m, r) => (d0.get(idx(s, r.cx, r.cy)) || 0) > (d0.get(idx(s, m.cx, m.cy)) || 0) ? r : m, rooms[1] || inicio);
    // Cerradura: todas las entradas de la sala objetivo; la llave en una sala alcanzable sin pasar por ellas.
    const cerr = new Set([...entradas.entries()].filter(([k, r]) => r === lejos.id).map(([k]) => k));
    if (cerr.size && rooms.length > 2) {
      const sin = bfs([inicio.cx, inicio.cy], cerr);
      const candidatas = rooms.filter(r => r !== inicio && r !== lejos && sin.has(idx(s, r.cx, r.cy)));
      if (candidatas.length) {
        cerr.forEach(k => { ponerClave(s, k, ARISTA.CERRADA_LLAVE); s.llaves[k] = 'k1'; });
        const rk = candidatas[ri(0, candidatas.length - 1)];
        s.objetos.push({ id: 'o-k1', tipo: 'llave', n: 'Tarjeta de acceso', llave: 'k1', x: rk.x + ri(0, rk.w - 1), y: rk.y + ri(0, rk.h - 1), texto: 'Abre la sala objetivo.' });
        lejos.cerrada = true;
      }
    }
    // Una puerta secreta: un enlace extra que no sea de la sala objetivo.
    const extra = [...entradas.keys()].filter(k => !cerr.has(k) && leerClave(s, k) === ARISTA.PUERTA);
    if (extra.length > 3 && rnd() < 0.7) ponerClave(s, extra[ri(0, extra.length - 1)], ARISTA.SECRETA);
    // Contenido de las salas.
    const libre = (x, y) => !solida(s, x, y) && !s.fichas.some(f => f.x === x && f.y === y) && !s.objetos.some(o => o.x === x && o.y === y);
    function sitio(r) { for (let t = 0; t < 40; t++) { const x = r.x + ri(0, r.w - 1), y = r.y + ri(0, r.h - 1); if (libre(x, y)) return [x, y]; } return null; }
    rooms.forEach((r, i) => {
      r.funcion = i === 0 ? 'Entrada' : r === lejos ? 'Objetivo' : T.salas[ri(0, T.salas.length - 1)];
      const area = r.w * r.h, nc = area >= 30 ? ri(2, 4) : area >= 20 ? ri(0, 2) : 0;
      for (let k = 0; k < nc; k++) { const p = sitio(r); if (p && p[0] > r.x && p[0] < r.x + r.w - 1) s.cobertura[idx(s, p[0], p[1])] = rnd() < 0.6 ? 1 : 2; }
      if (opt.tema !== 'ruinas' && i > 0 && rnd() < 0.35) { const p = sitio(r); if (p) s.objetos.push({ id: 'o-c' + i, tipo: 'consola', n: 'Consola', x: p[0], y: p[1], fijo: true, texto: 'Informática para acceder a los registros o a las puertas.' }); }
      s.objetos.push({ id: 'o-s' + i, tipo: 'nota', n: r.funcion, x: r.cx, y: r.cy, oculto: true, texto: 'Sala: ' + r.funcion + (r.cerrada ? ' (cerrada con llave)' : '') });
    });
    // PJ en la entrada.
    for (let k = 0; k < 4; k++) { const p = sitio(inicio); if (p) s.fichas.push(nuevaFicha({ n: 'PJ ' + (k + 1), x: p[0], y: p[1], arma: ['fusil-de-asalto', 'pistola-pesada', 'espada-larga', 'subfusil'][k], armadura: ['armadura-de-infanteria', 'traje-de-kevlar', 'armadura-de-placas', 'cuero-endurecido'][k], hab: { disparo: 11, cca: 11, csa: 9, atletismo: 10 }, attrs: { fue: 5, des: 5, con: 7 } })); }
    // Enemigos según la amenaza calibrada: Novatos, 6 esbirros y un oficial repartidos; Veteranos, más.
    const resto = rooms.filter(r => r !== inicio && r !== lejos);
    const grupos = opt.amenaza === 'veteranos'
      ? [['oficial', 'esbirro', 'esbirro', 'esbirro'], ['veterano', 'veterano', 'esbirro', 'esbirro'], ['esbirro', 'esbirro', 'esbirro']]
      : [['esbirro', 'esbirro', 'esbirro', 'esbirro'], ['oficial', 'esbirro', 'esbirro']];
    grupos.forEach((g, gi) => {
      const r = gi === grupos.length - 1 ? lejos : (resto[ri(0, Math.max(0, resto.length - 1))] || lejos);
      g.forEach((p, k) => { const q = sitio(r); if (q) s.fichas.push(nuevaFicha(Object.assign({}, PLANTILLAS[p], { n: PLANTILLAS[p].n + ' ' + (gi + 1) + '.' + (k + 1), x: q[0], y: q[1], hab: Object.assign({}, PLANTILLAS[p].hab), attrs: { fue: 5, des: 5, con: 5 } }))); });
    });
    s.salas = rooms.map(r => ({ x: r.x, y: r.y, w: r.w, h: r.h, funcion: r.funcion }));
    actualizarNiebla(s);
    return s;
  }

  // Comprobaciones de un tablero: salas aisladas, llaves que no se pueden alcanzar…
  function validar(s) {
    const avisos = [];
    const pj = s.fichas.find(f => f.bando === 'pj');
    if (!pj) { avisos.push('No hay ninguna ficha de PJ.'); return avisos; }
    const q = [[pj.x, pj.y]], vistos = new Set([idx(s, pj.x, pj.y)]), llaves = new Set();
    let cambio = true;
    while (cambio) {
      cambio = false;
      for (let i = 0; i < q.length; i++) {
        const [x, y] = q[i];
        s.objetos.forEach(o => { if (o.tipo === 'llave' && o.x === x && o.y === y && !llaves.has(o.llave)) { llaves.add(o.llave); cambio = true; } });
        for (const dir of 'NSEW') {
          const [dx, dy] = DIRS[dir], nx = x + dx, ny = y + dy; if (!dentro(s, nx, ny) || solida(s, nx, ny)) continue;
          const k = claveArista(s, x, y, dir), c = leerClave(s, k);
          if (c === ARISTA.MURO || c === ARISTA.VENTANA) continue;
          if (c === ARISTA.CERRADA_LLAVE && !llaves.has(s.llaves[k])) continue;
          const ni = idx(s, nx, ny); if (vistos.has(ni)) continue; vistos.add(ni); q.push([nx, ny]); cambio = true;
        }
      }
    }
    let aisladas = 0; for (let i = 0; i < s.celdas.length; i++) if (s.celdas[i] !== SUELO.ROCA && !vistos.has(i)) aisladas++;
    if (aisladas) avisos.push(aisladas + ' casillas no se pueden alcanzar desde los PJ (puede ser intencionado).');
    s.objetos.filter(o => o.tipo === 'llave' && !vistos.has(idx(s, o.x, o.y))).forEach(o => avisos.push('La llave «' + o.n + '» no se puede alcanzar.'));
    return avisos;
  }

  return {
    SUELO, SUELO_N, ARISTA, ARISTA_N, COB_N, bloqueaVista, bloqueaPaso, esPuerta,
    crear, idx, dentro, solida, claveArista, leerClave, ponerClave, arista, ladosArista,
    paso, alcanzables, rayo, ve, campoVision, visiblesPara, actualizarNiebla, vista,
    distanciaCasillas, distanciaM, coberturaEntre, lineaDeTiro, coberturaAdyacente,
    puertasCerca, alternarPuerta, recoger, buscarSecretas, nuevaRonda, nuevaFicha,
    PLANTILLAS, TEMAS, generar, validar
  };
});
