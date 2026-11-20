/* Fire Angel · servidor de la plataforma de juego
   Sirve la web (recursos estáticos) y la API de /api/*; /sala/<campaña> abre la sala en tiempo real.
   Datos en D1 (binding DB); cada campaña tiene una Sala (Durable Object con SQLite). */
import R0 from '../public/reglas2.js';
const R = R0 || globalThis.FA2;

const DIA = 86400000;
const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
const error = (status, txt) => json({ error: txt }, status);
const ahora = () => Date.now();
const uid = (n = 16) => { const a = new Uint8Array(n); crypto.getRandomValues(a); return [...a].map(b => b.toString(36).padStart(2, '0')).join('').slice(0, n * 1.5 | 0); };
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const sha = async s => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));

/* ---------- contraseñas: PBKDF2-SHA256 ---------- */
async function derivar(clave, sal) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(clave), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(sal), iterations: 100000 }, k, 256));
}
function igual(a, b) { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }

/* ---------- sesión ---------- */
function cookie(req, nombre) { const m = (req.headers.get('cookie') || '').match(new RegExp('(?:^|; )' + nombre + '=([^;]+)')); return m ? m[1] : null; }
async function usuario(req, env) {
  const t = cookie(req, 'fa_s'); if (!t) return null;
  const u = await env.DB.prepare('SELECT u.id, u.nombre, u.admin FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id WHERE s.token = ? AND s.caduca > ?').bind(await sha(t), ahora()).first();
  return u ? { id: u.id, nombre: u.nombre, admin: !!u.admin } : null;
}
async function abrirSesion(env, usuarioId, req) {
  const t = uid(32);
  await env.DB.prepare('INSERT INTO sesiones (token, usuario_id, caduca) VALUES (?, ?, ?)').bind(await sha(t), usuarioId, ahora() + 30 * DIA).run();
  const seguro = new URL(req.url).protocol === 'https:' ? '; Secure' : '';
  return `fa_s=${t}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 86400}${seguro}`;
}
async function cuerpo(req) { try { return await req.json(); } catch (e) { return {}; } }
const NOMBRE_OK = /^[\p{L}\p{N}_.\- ]{3,32}$/u;

/* ---------- permisos ---------- */
async function rolEn(env, campanaId, usuarioId) {
  const m = await env.DB.prepare('SELECT rol FROM miembros WHERE campana_id = ? AND usuario_id = ?').bind(campanaId, usuarioId).first();
  return m ? m.rol : null;
}
// Puede ver un personaje su dueño y el máster de una campaña en la que juega; editarlo, los mismos.
async function accesoPersonaje(env, pj, u) {
  if (pj.usuario_id === u.id) return 'dueño';
  const m = await env.DB.prepare(`SELECT 1 FROM miembros mj JOIN miembros mm ON mm.campana_id = mj.campana_id
    WHERE mj.personaje_id = ? AND mm.usuario_id = ? AND mm.rol = 'master'`).bind(pj.id, u.id).first();
  return m ? 'master' : null;
}

/* ---------- personajes: forma de los datos ---------- */
function pjVacio(nombre) {
  return {
    v: 1, ficha: null,                       // estado del creador (sistema clásico)
    vivo: { vit: null, heridas: 0, reserva: null, estados: [], notas: '' },
    inventario: [], dinero: { akradios: 800, creditos: 0 },
    px: { total: 0, gastados: 0, hitos: { hab: 0, don: 0, ataque: 0 } }, mejoras: [],
    narracion: { concepto: '', aspecto: '', personalidad: '', trasfondo: '', objetivos: '', contactos: '', secretos: '', diario: [] },
    nombre
  };
}

/* ---------- API ---------- */
async function api(req, env, url) {
  const p = url.pathname.replace(/^\/api/, '').replace(/\/$/, '');
  const m = req.method;
  const seg = p.split('/').filter(Boolean);

  // Registro con código de invitación (o código de arranque para el primer administrador).
  if (p === '/registro' && m === 'POST') {
    const b = await cuerpo(req);
    const nombre = String(b.nombre || '').trim(), clave = String(b.clave || ''), codigo = String(b.codigo || '').trim();
    if (!NOMBRE_OK.test(nombre)) return error(400, 'El nombre debe tener entre 3 y 32 letras, números, espacios, puntos o guiones.');
    if (clave.length < 8) return error(400, 'La contraseña debe tener al menos 8 caracteres.');
    let inv = null, admin = 0;
    const hayUsuarios = await env.DB.prepare('SELECT COUNT(*) n FROM usuarios').first('n');
    if (!hayUsuarios && env.CODIGO_ARRANQUE && igual(codigo, env.CODIGO_ARRANQUE)) admin = 1;
    else {
      inv = await env.DB.prepare('SELECT * FROM invitaciones WHERE codigo = ? AND caduca > ? AND usos > 0').bind(codigo, ahora()).first();
      if (!inv) return error(403, 'La invitación no es válida o ha caducado.');
    }
    if (await env.DB.prepare('SELECT 1 FROM usuarios WHERE nombre = ?').bind(nombre).first()) return error(409, 'Ese nombre ya existe.');
    const id = 'u' + uid(10), sal = uid(16), hash = await derivar(clave, sal);
    const ops = [env.DB.prepare('INSERT INTO usuarios (id, nombre, hash, sal, admin, creado) VALUES (?, ?, ?, ?, ?, ?)').bind(id, nombre, hash, sal, admin, ahora())];
    if (inv) {
      ops.push(env.DB.prepare('UPDATE invitaciones SET usos = usos - 1 WHERE codigo = ?').bind(codigo));
      if (inv.campana_id && inv.rol !== 'usuario') ops.push(env.DB.prepare('INSERT OR IGNORE INTO miembros (campana_id, usuario_id, rol) VALUES (?, ?, ?)').bind(inv.campana_id, id, inv.rol));
    }
    await env.DB.batch(ops);
    return json({ ok: true, usuario: { id, nombre, admin: !!admin } }, 201, { 'set-cookie': await abrirSesion(env, id, req) });
  }
  if (p === '/entrar' && m === 'POST') {
    const b = await cuerpo(req);
    const u = await env.DB.prepare('SELECT * FROM usuarios WHERE nombre = ?').bind(String(b.nombre || '').trim()).first();
    if (!u || !igual(await derivar(String(b.clave || ''), u.sal), u.hash)) return error(401, 'Nombre o contraseña incorrectos.');
    await env.DB.prepare('DELETE FROM sesiones WHERE caduca < ?').bind(ahora()).run();
    return json({ ok: true, usuario: { id: u.id, nombre: u.nombre, admin: !!u.admin } }, 200, { 'set-cookie': await abrirSesion(env, u.id, req) });
  }
  if (p === '/arranque' && m === 'GET') {
    const n = await env.DB.prepare('SELECT COUNT(*) n FROM usuarios').first('n');
    return json({ necesita: !n, disponible: !!env.CODIGO_ARRANQUE });
  }

  if (seg[0] === 'invitaciones' && seg[1] && seg[1] !== 'aceptar' && m === 'GET') {
    const inv = await env.DB.prepare(`SELECT i.rol, i.caduca, i.usos, c.nombre campana, us.nombre de FROM invitaciones i LEFT JOIN campanas c ON c.id = i.campana_id JOIN usuarios us ON us.id = i.creada_por WHERE i.codigo = ?`).bind(seg[1]).first();
    if (!inv || inv.caduca < ahora() || inv.usos < 1) return error(404, 'La invitación no es válida o ha caducado.');
    return json(inv);
  }

  const u = await usuario(req, env);
  if (p === '/yo' && m === 'GET') return json({ usuario: u });
  if (!u) return error(401, 'Tienes que entrar primero.');

  if (p === '/salir' && m === 'POST') {
    const t = cookie(req, 'fa_s'); if (t) await env.DB.prepare('DELETE FROM sesiones WHERE token = ?').bind(await sha(t)).run();
    return json({ ok: true }, 200, { 'set-cookie': 'fa_s=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0' });
  }
  if (p === '/clave' && m === 'POST') {
    const b = await cuerpo(req), fila = await env.DB.prepare('SELECT * FROM usuarios WHERE id = ?').bind(u.id).first();
    if (!igual(await derivar(String(b.actual || ''), fila.sal), fila.hash)) return error(403, 'La contraseña actual no es correcta.');
    if (String(b.nueva || '').length < 8) return error(400, 'La contraseña nueva debe tener al menos 8 caracteres.');
    const sal = uid(16); await env.DB.prepare('UPDATE usuarios SET hash = ?, sal = ? WHERE id = ?').bind(await derivar(b.nueva, sal), sal, u.id).run();
    return json({ ok: true });
  }

  /* ---- invitaciones ---- */
  if (p === '/invitaciones' && m === 'POST') {
    const b = await cuerpo(req), rol = ['jugador', 'espectador', 'usuario'].includes(b.rol) ? b.rol : 'jugador';
    if (b.campana_id) { if ((await rolEn(env, b.campana_id, u.id)) !== 'master') return error(403, 'Solo el máster de la campaña invita a ella.'); }
    else if (!u.admin) return error(403, 'Solo un administrador crea invitaciones sin campaña.');
    const codigo = uid(12), dias = Math.min(30, Math.max(1, +b.dias || 7)), usos = Math.min(20, Math.max(1, +b.usos || 1));
    await env.DB.prepare('INSERT INTO invitaciones (codigo, creada_por, campana_id, rol, usos, caduca) VALUES (?, ?, ?, ?, ?, ?)').bind(codigo, u.id, b.campana_id || null, rol, usos, ahora() + dias * DIA).run();
    return json({ codigo, caduca: ahora() + dias * DIA, usos, rol }, 201);
  }
  if (p === '/invitaciones/aceptar' && m === 'POST') {
    const b = await cuerpo(req), inv = await env.DB.prepare('SELECT * FROM invitaciones WHERE codigo = ? AND caduca > ? AND usos > 0').bind(String(b.codigo || ''), ahora()).first();
    if (!inv || !inv.campana_id) return error(403, 'La invitación no es válida o ha caducado.');
    if (await rolEn(env, inv.campana_id, u.id)) return json({ ok: true, campana_id: inv.campana_id, ya: true });
    await env.DB.batch([env.DB.prepare('INSERT INTO miembros (campana_id, usuario_id, rol) VALUES (?, ?, ?)').bind(inv.campana_id, u.id, inv.rol), env.DB.prepare('UPDATE invitaciones SET usos = usos - 1 WHERE codigo = ?').bind(inv.codigo)]);
    return json({ ok: true, campana_id: inv.campana_id });
  }
  /* ---- campañas ---- */
  if (p === '/campanas' && m === 'GET') {
    const r = await env.DB.prepare(`SELECT c.id, c.nombre, c.descripcion, c.sistema, c.ajustes, mi.rol, mi.personaje_id, um.nombre master,
      (SELECT COUNT(*) FROM miembros x WHERE x.campana_id = c.id AND x.rol = 'jugador') jugadores
      FROM miembros mi JOIN campanas c ON c.id = mi.campana_id JOIN usuarios um ON um.id = c.master_id WHERE mi.usuario_id = ? ORDER BY c.creado DESC`).bind(u.id).all();
    return json(r.results.map(c => ({ ...c, ajustes: JSON.parse(c.ajustes) })));
  }
  if (p === '/campanas' && m === 'POST') {
    const b = await cuerpo(req), nombre = String(b.nombre || '').trim().slice(0, 80);
    if (!nombre) return error(400, 'Ponle nombre a la campaña.');
    const id = 'c' + uid(10);
    const ajustes = { fecha: { dia: 1, ciclo: 1, anio: 791 }, cambio: 1, sistema: '2.0' };
    await env.DB.batch([
      env.DB.prepare('INSERT INTO campanas (id, nombre, descripcion, master_id, sistema, ajustes, creado) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(id, nombre, String(b.descripcion || '').slice(0, 2000), u.id, '2.0', JSON.stringify(ajustes), ahora()),
      env.DB.prepare('INSERT INTO miembros (campana_id, usuario_id, rol) VALUES (?, ?, ?)').bind(id, u.id, 'master')
    ]);
    return json({ id }, 201);
  }
  if (seg[0] === 'campanas' && seg[1]) {
    const cid = seg[1], rol = await rolEn(env, cid, u.id);
    if (!rol) return error(404, 'No perteneces a esa campaña.');
    const esM = rol === 'master';
    if (seg.length === 2 && m === 'GET') {
      const c = await env.DB.prepare('SELECT c.*, um.nombre master FROM campanas c JOIN usuarios um ON um.id = c.master_id WHERE c.id = ?').bind(cid).first();
      const mi = await env.DB.prepare(`SELECT mi.usuario_id, us.nombre, mi.rol, mi.personaje_id, p.nombre personaje FROM miembros mi JOIN usuarios us ON us.id = mi.usuario_id LEFT JOIN personajes p ON p.id = mi.personaje_id WHERE mi.campana_id = ? ORDER BY mi.rol, us.nombre`).bind(cid).all();
      return json({ id: c.id, nombre: c.nombre, descripcion: c.descripcion, sistema: c.sistema, master: c.master, ajustes: JSON.parse(c.ajustes), rol, miembros: mi.results });
    }
    if (seg.length === 2 && m === 'PATCH') {
      if (!esM) return error(403, 'Solo el máster cambia la campaña.');
      const b = await cuerpo(req), c = await env.DB.prepare('SELECT * FROM campanas WHERE id = ?').bind(cid).first();
      const aj = Object.assign(JSON.parse(c.ajustes), b.ajustes || {});
      if (aj.cambio != null) aj.cambio = Math.max(0.01, Math.min(100, +aj.cambio || 1));
      await env.DB.prepare('UPDATE campanas SET nombre = ?, descripcion = ?, ajustes = ? WHERE id = ?').bind(String(b.nombre || c.nombre).slice(0, 80), b.descripcion != null ? String(b.descripcion).slice(0, 2000) : c.descripcion, JSON.stringify(aj), cid).run();
      return json({ ok: true, ajustes: aj });
    }
    if (seg.length === 2 && m === 'DELETE') {
      if (!esM) return error(403, 'Solo el máster borra la campaña.');
      await env.DB.prepare('DELETE FROM campanas WHERE id = ?').bind(cid).run();
      return json({ ok: true });
    }
    // Miembros: el jugador elige su personaje; el máster puede expulsar o cambiar rol.
    if (seg[2] === 'miembros' && seg[3] && m === 'PATCH') {
      const b = await cuerpo(req), objetivo = seg[3];
      if (objetivo !== u.id && !esM) return error(403, 'No puedes cambiar a otro miembro.');
      if (b.personaje_id !== undefined) {
        if (b.personaje_id) { const pj = await env.DB.prepare('SELECT usuario_id FROM personajes WHERE id = ?').bind(b.personaje_id).first(); if (!pj || pj.usuario_id !== objetivo) return error(400, 'Ese personaje no es de ese jugador.'); }
        await env.DB.prepare('UPDATE miembros SET personaje_id = ? WHERE campana_id = ? AND usuario_id = ?').bind(b.personaje_id || null, cid, objetivo).run();
      }
      if (b.rol && esM && objetivo !== u.id && ['jugador', 'espectador'].includes(b.rol)) await env.DB.prepare('UPDATE miembros SET rol = ? WHERE campana_id = ? AND usuario_id = ?').bind(b.rol, cid, objetivo).run();
      return json({ ok: true });
    }
    if (seg[2] === 'miembros' && seg[3] && m === 'DELETE') {
      if (seg[3] !== u.id && !esM) return error(403, 'No puedes expulsar a otro miembro.');
      if (seg[3] === u.id && esM) return error(400, 'El máster no puede salir de su campaña; bórrala si ya no la usas.');
      await env.DB.prepare('DELETE FROM miembros WHERE campana_id = ? AND usuario_id = ?').bind(cid, seg[3]).run();
      return json({ ok: true });
    }
    // Fichas de los personajes de la campaña (el máster las ve todas; los jugadores, un resumen público).
    if (seg[2] === 'personajes' && m === 'GET') {
      const r = await env.DB.prepare(`SELECT p.id, p.nombre, p.usuario_id, p.datos, us.nombre jugador FROM miembros mi JOIN personajes p ON p.id = mi.personaje_id JOIN usuarios us ON us.id = p.usuario_id WHERE mi.campana_id = ?`).bind(cid).all();
      return json(r.results.map(x => { const d = JSON.parse(x.datos); return esM || x.usuario_id === u.id ? { id: x.id, nombre: x.nombre, jugador: x.jugador, datos: d } : { id: x.id, nombre: x.nombre, jugador: x.jugador, publico: { concepto: d.narracion.concepto, aspecto: d.narracion.aspecto, clase: d.ficha && d.ficha.cls } }; }));
    }
    // El máster da experiencia (y opcionalmente dinero u objetos) a uno o varios personajes.
    if (seg[2] === 'recompensa' && m === 'POST') {
      if (!esM) return error(403, 'Solo el máster da recompensas.');
      const b = await cuerpo(req), ids = Array.isArray(b.personajes) ? b.personajes : [];
      const px = Math.max(0, Math.min(500, +b.px || 0)), motivo = String(b.motivo || '').slice(0, 200);
      const ak = Math.round(+b.akradios || 0), cr = Math.round(+b.creditos || 0), objetos = Array.isArray(b.objetos) ? b.objetos.slice(0, 20) : [];
      const hechos = [];
      for (const pid of ids) {
        if (!(await env.DB.prepare('SELECT 1 FROM miembros WHERE campana_id = ? AND personaje_id = ?').bind(cid, pid).first())) continue;
        const fila = await env.DB.prepare('SELECT * FROM personajes WHERE id = ?').bind(pid).first(); const d = JSON.parse(fila.datos);
        d.px.total += px; d.dinero.akradios += ak; d.dinero.creditos += cr;
        objetos.forEach(o => d.inventario.push(Object.assign({ id: 'i' + uid(6), q: 1, peso: 0, origen: 'recompensa' }, o)));
        const texto = `Recompensa del máster${motivo ? ' (' + motivo + ')' : ''}: ${[px && px + ' PX', ak && ak + ' akradios', cr && cr + ' créditos', objetos.length && objetos.map(o => o.n).join(', ')].filter(Boolean).join(', ')}.`;
        await env.DB.batch([env.DB.prepare('UPDATE personajes SET datos = ?, version = version + 1, actualizado = ? WHERE id = ?').bind(JSON.stringify(d), ahora(), pid), env.DB.prepare('INSERT INTO historial (personaje_id, autor_id, texto, ts) VALUES (?, ?, ?, ?)').bind(pid, u.id, texto, ahora())]);
        hechos.push(pid);
      }
      return json({ ok: true, personajes: hechos });
    }
    // Notas de la campaña: el máster ve todas; el grupo, las marcadas como visibles.
    if (seg[2] === 'notas') {
      if (seg.length === 3 && m === 'GET') {
        const r = await env.DB.prepare(`SELECT id, titulo, tipo, cuerpo, visible, actualizado FROM notas WHERE campana_id = ? ${esM ? '' : "AND visible = 'grupo'"} ORDER BY actualizado DESC`).bind(cid).all();
        return json(r.results);
      }
      if (!esM) return error(403, 'Solo el máster escribe notas de campaña.');
      const b = await cuerpo(req);
      const campos = [String(b.titulo || 'Sin título').slice(0, 120), String(b.tipo || 'nota').slice(0, 20), String(b.cuerpo || '').slice(0, 100000), b.visible === 'grupo' ? 'grupo' : 'master', ahora()];
      if (seg.length === 3 && m === 'POST') { const id = 'n' + uid(10); await env.DB.prepare('INSERT INTO notas (id, campana_id, autor_id, titulo, tipo, cuerpo, visible, actualizado) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(id, cid, u.id, ...campos).run(); return json({ id }, 201); }
      if (seg[3] && m === 'PUT') { await env.DB.prepare('UPDATE notas SET titulo = ?, tipo = ?, cuerpo = ?, visible = ?, actualizado = ? WHERE id = ? AND campana_id = ?').bind(...campos, seg[3], cid).run(); return json({ ok: true }); }
      if (seg[3] && m === 'DELETE') { await env.DB.prepare('DELETE FROM notas WHERE id = ? AND campana_id = ?').bind(seg[3], cid).run(); return json({ ok: true }); }
    }
    return error(404, 'Ruta desconocida.');
  }

  /* ---- personajes ---- */
  if (p === '/personajes' && m === 'GET') {
    const r = await env.DB.prepare('SELECT id, nombre, datos, actualizado FROM personajes WHERE usuario_id = ? ORDER BY actualizado DESC').bind(u.id).all();
    return json(r.results.map(x => { const d = JSON.parse(x.datos); return { id: x.id, nombre: x.nombre, actualizado: x.actualizado, clase: d.ficha && d.ficha.cls, concepto: d.narracion.concepto, px: d.px }; }));
  }
  if (p === '/personajes' && m === 'POST') {
    const b = await cuerpo(req), nombre = String(b.nombre || (b.ficha && b.ficha.name) || 'Sin nombre').trim().slice(0, 60);
    const n = await env.DB.prepare('SELECT COUNT(*) n FROM personajes WHERE usuario_id = ?').bind(u.id).first('n');
    if (n >= 30) return error(400, 'Has llegado al máximo de 30 personajes.');
    const d = pjVacio(nombre);
    if (b.ficha) d.ficha = b.ficha;
    if (b.datos) Object.assign(d, b.datos, { v: 1 });
    const id = 'p' + uid(10);
    await env.DB.batch([env.DB.prepare('INSERT INTO personajes (id, usuario_id, nombre, datos, actualizado) VALUES (?, ?, ?, ?, ?)').bind(id, u.id, nombre, JSON.stringify(d), ahora()), env.DB.prepare('INSERT INTO historial (personaje_id, autor_id, texto, ts) VALUES (?, ?, ?, ?)').bind(id, u.id, 'Personaje creado.', ahora())]);
    return json({ id }, 201);
  }
  if (seg[0] === 'personajes' && seg[1]) {
    const pj = await env.DB.prepare('SELECT * FROM personajes WHERE id = ?').bind(seg[1]).first();
    if (!pj) return error(404, 'Ese personaje no existe.');
    const acc = await accesoPersonaje(env, pj, u); if (!acc) return error(404, 'Ese personaje no existe.');
    if (seg.length === 2 && m === 'GET') return json({ id: pj.id, nombre: pj.nombre, version: pj.version, actualizado: pj.actualizado, acceso: acc, datos: JSON.parse(pj.datos) });
    if (seg.length === 2 && m === 'PUT') {
      const b = await cuerpo(req);
      if (b.version != null && +b.version !== pj.version) return error(409, 'Alguien ha cambiado la ficha mientras la editabas. Recárgala.');
      const d = b.datos; if (!d || typeof d !== 'object') return error(400, 'Faltan los datos.');
      const txt = JSON.stringify(d); if (txt.length > 400000) return error(413, 'La ficha es demasiado grande.');
      const nombre = String(d.nombre || pj.nombre).slice(0, 60);
      const ops = [env.DB.prepare('UPDATE personajes SET nombre = ?, datos = ?, version = version + 1, actualizado = ? WHERE id = ?').bind(nombre, txt, ahora(), pj.id)];
      (Array.isArray(b.historial) ? b.historial.slice(0, 10) : []).forEach(h => ops.push(env.DB.prepare('INSERT INTO historial (personaje_id, autor_id, texto, ts) VALUES (?, ?, ?, ?)').bind(pj.id, u.id, String(h).slice(0, 300), ahora())));
      await env.DB.batch(ops);
      return json({ ok: true, version: pj.version + 1 });
    }
    if (seg.length === 2 && m === 'DELETE') {
      if (acc !== 'dueño') return error(403, 'Solo su jugador borra un personaje.');
      await env.DB.batch([env.DB.prepare('UPDATE miembros SET personaje_id = NULL WHERE personaje_id = ?').bind(pj.id), env.DB.prepare('DELETE FROM personajes WHERE id = ?').bind(pj.id)]);
      return json({ ok: true });
    }
    if (seg[2] === 'historial' && m === 'GET') {
      const r = await env.DB.prepare('SELECT h.texto, h.ts, us.nombre autor FROM historial h LEFT JOIN usuarios us ON us.id = h.autor_id WHERE h.personaje_id = ? ORDER BY h.ts DESC LIMIT 200').bind(pj.id).all();
      return json(r.results);
    }
  }
  return error(404, 'Ruta desconocida.');
}

/* ---------- entrada ---------- */
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    try {
      if (url.pathname.startsWith('/api/')) {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          const o = req.headers.get('origin'); if (o && new URL(o).host !== url.host) return error(403, 'Origen no permitido.');
        }
        return await api(req, env, url);
      }
      if (url.pathname.startsWith('/sala/')) {
        const cid = url.pathname.split('/')[2];
        if (req.headers.get('upgrade') !== 'websocket') return error(426, 'Hace falta WebSocket.');
        const o = req.headers.get('origin'); if (o && new URL(o).host !== url.host) return error(403, 'Origen no permitido.');
        const u = await usuario(req, env); if (!u) return error(401, 'Tienes que entrar primero.');
        const rol = await rolEn(env, cid, u.id); if (!rol) return error(403, 'No perteneces a esa campaña.');
        const h = new Headers(req.headers); h.set('x-fa-usuario', JSON.stringify({ id: u.id, nombre: u.nombre, rol, campana: cid }));
        return env.SALA.get(env.SALA.idFromName(cid)).fetch(new Request(req.url, { headers: h }));
      }
      return env.ASSETS.fetch(req);
    } catch (e) {
      console.error(e);
      return error(500, 'Error interno del servidor.');
    }
  }
};

/* ---------- Sala: tiempo real de una campaña ----------
   WebSocket con hibernación: mientras nadie escribe, no consume duración.
   Las tiradas las hace el servidor; las secretas solo las ven quien tira y el máster.
   Guarda el registro (últimas 500 entradas) en su SQLite. */
export class Sala {
  constructor(ctx, env) {
    this.ctx = ctx; this.env = env;
    ctx.blockConcurrencyWhile(async () => {
      ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS registro (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER, tipo TEXT, de TEXT, de_nombre TEXT, para TEXT, secreto INTEGER, datos TEXT)`);
    });
  }
  async fetch(req) {
    const info = JSON.parse(req.headers.get('x-fa-usuario'));
    const par = new WebSocketPair();
    this.ctx.acceptWebSocket(par[1]);
    par[1].serializeAttachment(info);
    const historial = this.leer(info, 150);
    par[1].send(JSON.stringify({ t: 'hola', yo: info, registro: historial, presentes: this.presentes() }));
    this.difundir({ t: 'presencia', presentes: this.presentes() });
    return new Response(null, { status: 101, webSocket: par[0] });
  }
  presentes() {
    const vistos = new Map();
    this.ctx.getWebSockets().forEach(ws => { const a = ws.deserializeAttachment(); if (a) vistos.set(a.id, { id: a.id, nombre: a.nombre, rol: a.rol }); });
    return [...vistos.values()];
  }
  puedeVer(e, info) { return !e.secreto && !e.para || info.rol === 'master' || e.de === info.id || e.para === info.id; }
  leer(info, n) {
    const filas = this.ctx.storage.sql.exec('SELECT * FROM registro ORDER BY id DESC LIMIT ?', n * 2).toArray();
    return filas.map(f => ({ id: f.id, ts: f.ts, tipo: f.tipo, de: f.de, de_nombre: f.de_nombre, para: f.para, secreto: !!f.secreto, ...JSON.parse(f.datos) })).filter(e => this.puedeVer(e, info)).slice(0, n).reverse();
  }
  guardar(e) {
    const datos = Object.assign({}, e); ['id', 'ts', 'tipo', 'de', 'de_nombre', 'para', 'secreto'].forEach(k => delete datos[k]);
    const r = this.ctx.storage.sql.exec('INSERT INTO registro (ts, tipo, de, de_nombre, para, secreto, datos) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id', e.ts, e.tipo, e.de, e.de_nombre, e.para || null, e.secreto ? 1 : 0, JSON.stringify(datos)).one();
    e.id = r.id;
    this.ctx.storage.sql.exec('DELETE FROM registro WHERE id <= ?', e.id - 500);
    return e;
  }
  difundir(msg, filtro) {
    const txt = JSON.stringify(msg);
    this.ctx.getWebSockets().forEach(ws => { const a = ws.deserializeAttachment(); if (!filtro || filtro(a)) { try { ws.send(txt); } catch (e) {} } });
  }
  publicar(e) { this.guardar(e); this.difundir({ t: 'entrada', e }, a => a && this.puedeVer(e, a)); }
  async webSocketMessage(ws, raw) {
    const a = ws.deserializeAttachment(); let m;
    try { m = JSON.parse(raw); } catch (e) { return; }
    if (typeof raw === 'string' && raw.length > 8000) return;
    const base = { ts: Date.now(), de: a.id, de_nombre: a.nombre };
    if (a.rol === 'espectador' && m.t !== 'ping') return;            // los espectadores solo miran
    switch (m.t) {
      case 'ping': ws.send(JSON.stringify({ t: 'pong' })); return;
      case 'chat': {
        const txt = String(m.txt || '').trim().slice(0, 1000); if (!txt) return;
        this.publicar({ ...base, tipo: 'chat', txt, para: m.para || null }); return;
      }
      case 'tirada': {                                                // habilidad del Sistema 2.0 o del clásico
        const hab = Math.max(0, Math.min(40, +m.hab || 0)), mod = Math.max(-20, Math.min(20, +m.mod || 0));
        const sistema = m.sistema === 'v1' ? 'v1' : '2.0', etiqueta = String(m.etiqueta || 'Tirada').slice(0, 80);
        const secreto = !!m.secreta;
        let res;
        if (sistema === '2.0') { const t = R.tirar(hab, { mod, ventaja: Math.sign(+m.ventaja || 0) }); res = { dados: t.dados, r: t.r, objetivo: t.objetivo, umbral: t.umbral, ventaja: t.ventaja, grado: t.grado }; }
        else { const r = R.d(20), obj = hab + mod; res = { dados: [r], r, objetivo: obj, grado: r === 20 ? 'complicacion' : r === hab ? 'pleno' : r <= obj ? 'exito' : 'fallo', clasico: true }; }
        this.publicar({ ...base, tipo: 'tirada', secreto, etiqueta, sistema, ...res });
        return;
      }
      case 'dados': {                                                 // notación libre: 2d6+3, 1d20…
        const expr = String(m.expr || '').replace(/\s+/g, '').slice(0, 20), p = R.parseDados(expr);
        if (!p || p.n > 20 || p.caras > 1000) { ws.send(JSON.stringify({ t: 'error', txt: 'Escribe los dados como 2d6+3.' })); return; }
        const t = R.tirarDados(expr);
        this.publicar({ ...base, tipo: 'dados', secreto: !!m.secreta, expr, dados: t.dados, total: t.total, etiqueta: String(m.etiqueta || '').slice(0, 80) });
        return;
      }
      case 'aviso': {                                                 // el máster muestra un texto o un documento a la mesa
        if (a.rol !== 'master') return;
        this.publicar({ ...base, tipo: 'aviso', titulo: String(m.titulo || '').slice(0, 120), txt: String(m.txt || '').slice(0, 4000) });
        return;
      }
      case 'borrar': {
        if (a.rol !== 'master') return;
        this.ctx.storage.sql.exec('DELETE FROM registro');
        this.difundir({ t: 'borrado' });
        return;
      }
    }
  }
  async webSocketClose(ws, code) { try { ws.close(code, 'adiós'); } catch (e) {} this.difundir({ t: 'presencia', presentes: this.presentes().filter(p => true) }); }
  async webSocketError(ws) { this.difundir({ t: 'presencia', presentes: this.presentes() }); }
}
