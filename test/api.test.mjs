// Pruebas de la API contra wrangler dev (http://127.0.0.1:8787)
import assert from 'node:assert/strict';
const B = 'http://127.0.0.1:8787';
const jar = {};
async function call(who, method, path, body) {
  const r = await fetch(B + path, { method, headers: { 'content-type': 'application/json', cookie: jar[who] || '', origin: B }, body: body ? JSON.stringify(body) : undefined });
  const sc = r.headers.get('set-cookie'); if (sc) jar[who] = sc.split(';')[0];
  let j = null; try { j = await r.json(); } catch (e) {}
  return { s: r.status, j };
}
let r = await call('zalo', 'POST', '/api/registro', { codigo: 'mal', nombre: 'Zalo', clave: '12345678' }); assert.equal(r.s, 403);
r = await call('zalo', 'POST', '/api/registro', { codigo: 'prueba-arranque', nombre: 'Zalo', clave: 'clave-zalo-1' }); assert.equal(r.s, 201); assert.ok(r.j.usuario.admin);
r = await call('zalo', 'GET', '/api/yo'); assert.equal(r.j.usuario.nombre, 'Zalo');
r = await call('x', 'POST', '/api/registro', { codigo: 'prueba-arranque', nombre: 'Otro', clave: '12345678' }); assert.equal(r.s, 403, 'arranque solo una vez');
r = await call('zalo', 'POST', '/api/campanas', { nombre: 'Carga frágil' }); assert.equal(r.s, 201); const cid = r.j.id;
r = await call('zalo', 'POST', '/api/invitaciones', { campana_id: cid, rol: 'jugador', usos: 2 }); assert.equal(r.s, 201); const inv = r.j.codigo;
r = await call('ana', 'GET', '/api/invitaciones/' + inv); assert.equal(r.j.campana, 'Carga frágil');
r = await call('ana', 'POST', '/api/registro', { codigo: inv, nombre: 'Ana', clave: 'clave-ana-1' }); assert.equal(r.s, 201);
r = await call('ana', 'GET', '/api/campanas'); assert.equal(r.j[0].rol, 'jugador');
r = await call('ana', 'POST', '/api/personajes', { ficha: { name: 'Kara Vosk', cls: 'mercenarios' } }); assert.equal(r.s, 201); const pid = r.j.id;
r = await call('ana', 'PATCH', `/api/campanas/${cid}/miembros/${(await call('ana','GET','/api/yo')).j.usuario.id}`, { personaje_id: pid }); assert.equal(r.s, 200);
r = await call('zalo', 'GET', '/api/personajes/' + pid); assert.equal(r.j.acceso, 'master');
r = await call('zalo', 'POST', `/api/campanas/${cid}/recompensa`, { personajes: [pid], px: 12, akradios: 50, motivo: 'Sesión 1', objetos: [{ n: 'Tarjeta de acceso', peso: 0.1 }] }); assert.deepEqual(r.j.personajes, [pid]);
r = await call('ana', 'GET', '/api/personajes/' + pid); assert.equal(r.j.datos.px.total, 12); assert.equal(r.j.datos.dinero.akradios, 850); const ver = r.j.version;
const d = r.j.datos; d.narracion.concepto = 'Mercenaria endeudada';
r = await call('ana', 'PUT', '/api/personajes/' + pid, { version: ver, datos: d, historial: ['Cambia el concepto.'] }); assert.equal(r.s, 200);
r = await call('ana', 'PUT', '/api/personajes/' + pid, { version: ver, datos: d }); assert.equal(r.s, 409, 'conflicto de versión');
r = await call('ana', 'GET', `/api/personajes/${pid}/historial`); assert.equal(r.j.length, 3);
// un tercero no ve el personaje
r = await call('zalo', 'POST', '/api/invitaciones', { rol: 'usuario' }); const inv2 = r.j.codigo;
r = await call('luis', 'POST', '/api/registro', { codigo: inv2, nombre: 'Luis', clave: 'clave-luis-1' }); assert.equal(r.s, 201);
r = await call('luis', 'GET', '/api/personajes/' + pid); assert.equal(r.s, 404);
r = await call('luis', 'GET', '/api/campanas/' + cid); assert.equal(r.s, 404);
// notas
r = await call('zalo', 'POST', `/api/campanas/${cid}/notas`, { titulo: 'Secreto', cuerpo: 'El cliente miente.' });
r = await call('zalo', 'POST', `/api/campanas/${cid}/notas`, { titulo: 'Rumores', cuerpo: 'Dicen que…', visible: 'grupo' });
r = await call('ana', 'GET', `/api/campanas/${cid}/notas`); assert.equal(r.j.length, 1); assert.equal(r.j[0].titulo, 'Rumores');
r = await call('ana', 'POST', `/api/campanas/${cid}/notas`, { titulo: 'x' }); assert.equal(r.s, 403);
// origen ajeno
r = await fetch(B + '/api/campanas', { method: 'POST', headers: { 'content-type': 'application/json', cookie: jar.zalo, origin: 'https://malo.example' }, body: '{}' }); assert.equal(r.status, 403);
// sala por WebSocket
function abrir(who) { return new Promise((ok, ko) => { const ws = new WebSocket(B.replace('http', 'ws') + '/sala/' + cid, { headers: { cookie: jar[who], origin: B } }); const q = []; ws.onmessage = e => q.push(JSON.parse(e.data)); ws.onopen = () => ok({ ws, q }); ws.onerror = ko; }); }
const z = await abrir('zalo'), a = await abrir('ana');
await new Promise(s => setTimeout(s, 300));
assert.equal(a.q[0].t, 'hola');
a.ws.send(JSON.stringify({ t: 'tirada', hab: 12, etiqueta: 'Disparo', ventaja: 1 }));
z.ws.send(JSON.stringify({ t: 'tirada', hab: 14, etiqueta: 'Percepción del jefe', secreta: true }));
a.ws.send(JSON.stringify({ t: 'chat', txt: 'Hola mesa' }));
a.ws.send(JSON.stringify({ t: 'dados', expr: '2d6+1' }));
await new Promise(s => setTimeout(s, 500));
const ea = a.q.filter(m => m.t === 'entrada').map(m => m.e), ez = z.q.filter(m => m.t === 'entrada').map(m => m.e);
console.log('Ana ve', ea.map(e => e.tipo + ':' + (e.etiqueta || e.txt || e.expr) + (e.grado ? '=' + e.grado : '')));
console.log('Zalo ve', ez.map(e => e.tipo + ':' + (e.etiqueta || e.txt || e.expr)));
assert.ok(!ea.some(e => e.secreto), 'la tirada secreta no llega al jugador');
assert.ok(ez.some(e => e.secreto));
const ws3 = await abrir('ana'); await new Promise(s => setTimeout(s, 300)); assert.equal(ws3.q[0].registro.length, 3, 'historial al entrar');
[z, a, ws3].forEach(x => x.ws.close());
const rech = await new Promise(ok => { const w = new WebSocket(B.replace('http', 'ws') + '/sala/' + cid, { headers: { cookie: jar.luis, origin: B } }); w.onopen = () => ok('abierta'); w.onerror = () => ok('rechazada'); }); assert.equal(rech, 'rechazada', 'sin permiso no entra en la sala');
console.log('API OK');
