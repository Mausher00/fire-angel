/* Fire Angel · Sistema 2.0 · módulo de reglas compartido
   Una sola implementación para el lector, los dados, el creador, la mesa y (más adelante) el servidor.
   Sin dependencias del navegador: funciona en Node y en un Worker de Cloudflare.
   Las reglas son las de fuentes/src/40…41-s2-*.md. Si cambia una regla, se cambia aquí. */
(function (root, factory) {
  const R = factory();
  if (typeof module === 'object' && module.exports) module.exports = R;
  else root.FA2 = R;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- azar ---------- */
  // rng() devuelve un número en [0, 1). Por defecto, crypto si existe (como hará el servidor).
  function rngDefecto() {
    const c = (typeof crypto !== 'undefined' && crypto.getRandomValues) ? crypto : null;
    if (c) { const a = new Uint32Array(1); c.getRandomValues(a); return a[0] / 4294967296; }
    return Math.random();
  }
  // Generador con semilla (mulberry32): mismo número, mismo resultado. Para generadores reproducibles.
  function semilla(s) {
    let a = s >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0; let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const d = (caras, rng) => 1 + Math.floor((rng || rngDefecto)() * caras);

  /* ---------- grados de éxito ---------- */
  const GRADOS = ['complicacion', 'fallo', 'exito', 'pleno'];
  const NOMBRE = { complicacion: 'Complicación', fallo: 'Fallo', exito: 'Éxito', pleno: 'Pleno' };
  const umbralPleno = hab => Math.ceil(hab / 2);

  // Grado de una tirada natural r (1-20) contra la habilidad ya modificada.
  function grado(r, hab) {
    if (r === 20) return 'complicacion';
    if (r === 1) return 'pleno';
    if (r <= umbralPleno(hab)) return 'pleno';
    return r <= hab ? 'exito' : 'fallo';
  }
  // Subir o bajar grados. La complicación no sube con reserva y bajar un éxito da fallo.
  function bajar(g, n) {
    n = n == null ? 1 : n;
    let i = GRADOS.indexOf(g);
    for (let k = 0; k < n; k++) if (i > 1) i--;          // de pleno a éxito a fallo; nunca a complicación
    return GRADOS[i];
  }
  function subir(g) {
    if (g === 'fallo') return 'exito';
    if (g === 'exito') return 'pleno';
    return g;                                             // pleno se queda; la complicación no se arregla
  }
  const acierta = g => g === 'exito' || g === 'pleno';

  // Ventaja y desventaja: no se acumulan y se anulan entre sí. Recibe una lista de +1 / -1.
  function combinarVentaja(fuentes) {
    const v = fuentes.some(x => x > 0), dv = fuentes.some(x => x < 0);
    return v && !dv ? 1 : dv && !v ? -1 : 0;
  }

  // Tirada completa: 1d20 (2d20 con ventaja o desventaja) contra hab + mod.
  function tirar(hab, opt) {
    opt = opt || {};
    const rng = opt.rng, adv = opt.ventaja || 0, t = (hab || 0) + (opt.mod || 0);
    const a = d(20, rng); let r = a, b = null;
    if (adv) { b = d(20, rng); r = adv > 0 ? Math.min(a, b) : Math.max(a, b); }
    let g = grado(r, t);
    if (opt.bajar) g = bajar(g, opt.bajar);
    if (opt.subir) g = subir(g);
    return { dados: b === null ? [a] : [a, b], r, objetivo: t, umbral: umbralPleno(t), ventaja: adv, grado: g };
  }

  /* ---------- dados de daño ---------- */
  // "2d6", "1d10+2", "3d6+Fue" (el atributo se pasa en attrs).
  function parseDados(expr) {
    const m = String(expr || '').trim().match(/^(\d*)d(\d+)\s*(?:([+-])\s*(\d+))?$/i);
    if (!m) return null;
    return { n: +(m[1] || 1), caras: +m[2], plano: m[3] ? (m[3] === '-' ? -1 : 1) * +m[4] : 0 };
  }
  function tirarDados(expr, opt) {
    opt = opt || {};
    const p = parseDados(expr); if (!p) return { total: 0, dados: [], extra: [] };
    const dados = []; for (let i = 0; i < p.n; i++) dados.push(d(p.caras, opt.rng));
    const extra = []; for (let i = 0; i < (opt.extra || 0); i++) extra.push(d(p.caras, opt.rng));
    const total = dados.concat(extra).reduce((s, x) => s + x, 0) + p.plano + (opt.plano || 0);
    return { total, dados, extra, plano: p.plano + (opt.plano || 0) };
  }

  /* ---------- tablero ---------- */
  const CASILLA_M = 2;
  const movimiento = atletismo => Math.max(3, Math.floor((atletismo || 0) / 2));   // casillas por acción de mover
  function banda(distM, alcanceM, casillasCaC) {
    if (!alcanceM) return distM <= CASILLA_M * (casillasCaC || 1) ? 'cac' : 'fuera'; // cuerpo a cuerpo: adyacente (rasgo alcance: 2)
    if (distM > alcanceM) return 'fuera';
    if (distM <= alcanceM / 4) return 'corta';
    if (distM <= alcanceM / 2) return 'media';
    return 'larga';
  }
  const BANDA = { cac: 'Cuerpo a cuerpo', corta: 'Corta', media: 'Media', larga: 'Larga (desventaja)', fuera: 'Fuera de alcance' };

  /* ---------- rasgos de arma ---------- */
  // rasgo(arma, 'perforante') -> número (o true) si lo tiene; null si no.
  function rasgo(arma, nombre) {
    const r = ((arma && arma.rasgos) || []).find(x => x.toLowerCase().indexOf(nombre) === 0);
    if (!r) return null;
    const n = r.match(/\d+/); return n ? +n[0] : true;
  }

  /* ---------- armadura y daño ---------- */
  // armadura: objeto del catálogo (absorcion por zona y clase) o null. escudo: reducción extra si reacciona con él.
  function reduccion(armadura, tipo, opt) {
    opt = opt || {};
    const zona = opt.zona || 'torso';
    let r = armadura ? Math.ceil(((armadura.absorcion || {})[zona] || 0) / 3) : 0;
    r += opt.extra || 0;                                           // dones: +⌈N/3⌉, escudo…
    const t = String(tipo || '').toLowerCase();
    if (t === 'devastador') return 0;
    if (t.indexOf('energ') === 0 && (!armadura || armadura.clase === 'ligera')) return opt.extra || 0;
    if (t === 'perforante avanzado') return Math.floor(r / 2);
    return r;
  }
  const impactosRafaga = (g, cadencia) =>
    !acierta(g) ? 0 : (!cadencia || cadencia < 2 || g === 'exito') ? 1 : Math.max(2, Math.ceil(cadencia / 2));

  // Daño de un ataque que ya ha acertado. arma del catálogo; attrs del atacante {fue,des,...}.
  function danio(arma, g, opt) {
    opt = opt || {};
    const imp = opt.impactos != null ? opt.impactos : impactosRafaga(g, arma.cadencia);
    const plano = arma.plano ? (opt.attrs || {})[String(arma.plano).toLowerCase()] || 0 : 0;
    const red = Math.max(0, reduccion(opt.armadura, arma.tipo, { zona: opt.zona, extra: opt.reduccionExtra }) - (+rasgo(arma, 'perforante') || 0));
    const extraPleno = g === 'pleno' && !opt.maniobra ? (rasgo(arma, 'brutal') ? 2 : 1) : 0;
    const detalle = [];
    let total = 0;
    for (let i = 0; i < imp; i++) {
      const t = tirarDados(arma.dados, { rng: opt.rng, plano, extra: extraPleno });
      const neto = Math.max(g === 'pleno' ? 1 : 0, t.total - red);
      detalle.push({ dados: t.dados, extra: t.extra, plano, bruto: t.total, reduccion: red, neto });
      total += neto;
    }
    return { total, impactos: imp, reduccion: red, detalle };
  }

  /* ---------- Vitalidad y Heridas ---------- */
  const vitalidadMax = (con, extra) => 25 + (con || 4) - 4 + (extra || 0);
  // estado: {vit, vitMax, heridas, esbirro}. Devuelve un estado nuevo y qué ha pasado.
  function aplicarDanio(estado, dmg) {
    const s = Object.assign({}, estado), ev = [];
    if (dmg <= 0 || s.muerto || (s.fuera && s.esbirro)) return { estado: s, eventos: ev };
    if (s.fuera) { s.heridas = (s.heridas || 0) + 1; s.muerto = true; ev.push('herida', 'muerto'); return { estado: s, eventos: ev }; }
    s.vit -= dmg;
    if (s.vit > 0) return { estado: s, eventos: ev };
    if (s.esbirro) { s.vit = 0; s.fuera = true; ev.push('fuera'); return { estado: s, eventos: ev }; }
    s.heridas = (s.heridas || 0) + 1; ev.push('herida');
    const limite = s.heridasFuera || 3;
    if (s.heridas >= limite + 1) { s.vit = 0; s.fuera = true; s.muerto = true; ev.push('muerto'); }
    else if (s.heridas >= limite) { s.vit = 0; s.fuera = true; ev.push('fuera'); }
    else s.vit = Math.floor(s.vitMax / 2);                       // el daño que sobra se pierde
    return { estado: s, eventos: ev };
  }
  const acciones = tipo => tipo === 'jefe' ? 3 : 2;
  const tieneReaccion = tipo => tipo !== 'esbirro';

  /* ---------- ataque completo ---------- */
  // Reúne las circunstancias en ventaja/desventaja y grados, como dice el combate táctico.
  // c: {apuntar, cobertura: 'ligera'|'pesada'|null, banda, ayuda, otras: [+1/-1]}
  function circunstancias(c) {
    c = c || {};
    const f = [], notas = [];
    if (c.apuntar) { f.push(1); notas.push('apuntar: ventaja'); }
    if (c.ayuda) { f.push(1); notas.push('ayuda: ventaja'); }
    if (c.cobertura === 'ligera') { f.push(-1); notas.push('cobertura ligera: desventaja'); }
    if (c.banda === 'larga') { f.push(-1); notas.push('alcance largo: desventaja'); }
    (c.otras || []).forEach(x => f.push(x));
    if (c.arma && rasgo(c.arma, 'pesada') && (c.fue || 0) < 5) { f.push(-1); notas.push('arma pesada sin Fuerza 5: desventaja'); }
    const bajarG = c.cobertura === 'pesada' ? 1 : 0;
    if (bajarG) notas.push('cobertura pesada: baja un grado');
    const subirG = c.apuntar && c.banda === 'larga' && c.arma && rasgo(c.arma, 'apuntado') ? 1 : 0;
    if (subirG) notas.push('apuntado a distancia larga: sube un grado');
    return { ventaja: combinarVentaja(f), bajar: bajarG, subir: subirG, notas };
  }

  /* ---------- calor ---------- */
  const CALOR_TOPE = 4;
  function calorDisparo(calor, valor) {
    const n = (calor || 0) + (valor || 0);
    return { calor: Math.min(n, CALOR_TOPE), sobrecalentada: n >= CALOR_TOPE, danoPropio: n > CALOR_TOPE };
  }
  const calorFinRonda = (calor, disparo) => disparo ? calor : Math.max(0, (calor || 0) - 2);
  const valorCalor = arma => { const r = (arma.rasgos || []).find(x => /^calor/i.test(x)); return r ? (+(r.match(/\d+/) || [1])[0]) : 0; };


  /* ---------- peso y carga (contenido nuevo; el manual no tiene reglas de peso) ---------- */
  // Peso estimado en kg de un objeto del catálogo. Es una propuesta: cada objeto se puede corregir a mano.
  const PESO_ARMA = { 'Cuerpo a cuerpo': { ligero: 1, medio: 3, pesado: 7 }, 'A distancia': { ligero: 1.5, medio: 4, pesado: 14 }, 'Explosivos': { ligero: 0.5, medio: 1.5, pesado: 6 } };
  const PESO_ARMADURA = { ligera: 6, media: 12, pesada: 22 };
  const PESO_EQUIPO = [
    [/droide|veh[ií]culo|moto|coche|cami[oó]n|montura|nave|aerodeslizador/i, 0],
    [/raci[oó]n|comida|cantimplora/i, 0.5], [/mochila/i, 1.5], [/tienda/i, 4], [/saco de dormir/i, 2], [/cuerda|cable/i, 2],
    [/linterna|mechero|agenda|ganz[uú]a|tarjeta|comunicador|reloj|gafas|visor|mira|silenciador/i, 0.3],
    [/botiqu[ií]n|kit|equipo de/i, 1.5], [/granada|bengala/i, 0.5], [/munici[oó]n|cargador/i, 0.5], [/traje|armadura|chaleco/i, 4],
    [/escudo port[aá]til/i, 3], [/herramienta|taladro|soldador/i, 3]
  ];
  function pesoEstimado(obj) {
    if (!obj) return 0;
    if (obj.grupo && PESO_ARMA[obj.grupo]) return PESO_ARMA[obj.grupo][obj.cat] || 2;
    if (obj.clase && PESO_ARMADURA[obj.clase] != null) return PESO_ARMADURA[obj.clase];
    if (/escudo/i.test(obj.n || '') && obj.reduccion != null) return { 2: 3, 4: 6, 5: 10 }[obj.reduccion] || 5;
    const n = obj.n || '';
    for (const [rx, kg] of PESO_EQUIPO) if (rx.test(n)) return kg;
    return 1;
  }
  // Capacidad según la Fuerza: libre hasta Fue × 5 kg, cargado hasta × 10, sobrecargado hasta × 15.
  function estadoCarga(kg, fue) {
    const f = Math.max(1, fue || 4), libre = f * 5, cargado = f * 10, maximo = f * 15;
    if (kg <= libre) return { nivel: 'libre', txt: 'Sin penalización', libre, cargado, maximo };
    if (kg <= cargado) return { nivel: 'cargado', txt: 'Cargado: −1 casilla de movimiento y −2 a Atletismo y Sigilo', libre, cargado, maximo, mov: -1, mod: -2 };
    if (kg <= maximo) return { nivel: 'sobrecargado', txt: 'Sobrecargado: movimiento a la mitad y desventaja en Atletismo, Sigilo y combate', libre, cargado, maximo, movMitad: true, desventaja: true };
    return { nivel: 'inmovil', txt: 'Demasiado peso: no puede moverse', libre, cargado, maximo, inmovil: true };
  }

  /* ---------- experiencia (tabla «Experiencia» del manual) ---------- */
  // Coste en PX de subir un punto: habilidad = su nuevo total (+1 si es adquirida no afín); atributo 8; don 20; ataque 25.
  const costePX = (tipo, nuevoTotal, afin) => tipo === 'atributo' ? 8 : tipo === 'don' ? 20 : tipo === 'ataque' ? 25 : nuevoTotal + (afin === false ? 1 : 0);
  // Hitos por PX totales: cada 10, un punto de habilidad gratis; cada 30, un don; cada 70, un ataque.
  const hitos = total => ({ hab: Math.floor((total || 0) / 10), don: Math.floor((total || 0) / 30), ataque: Math.floor((total || 0) / 70) });

  return {
    version: '2.0-2026-11-20',
    rngDefecto, semilla, d,
    GRADOS, NOMBRE, umbralPleno, grado, bajar, subir, acierta, combinarVentaja, tirar,
    parseDados, tirarDados,
    CASILLA_M, movimiento, banda, BANDA,
    rasgo, reduccion, impactosRafaga, danio,
    vitalidadMax, aplicarDanio, acciones, tieneReaccion,
    circunstancias,
    CALOR_TOPE, calorDisparo, calorFinRonda, valorCalor,
    pesoEstimado, estadoCarga, costePX, hitos
  };
});
