-- Fire Angel · plataforma de juego · esquema inicial
CREATE TABLE usuarios (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE COLLATE NOCASE,
  hash TEXT NOT NULL,
  sal TEXT NOT NULL,
  admin INTEGER NOT NULL DEFAULT 0,
  creado INTEGER NOT NULL
);
CREATE TABLE sesiones (
  token TEXT PRIMARY KEY,          -- sha-256 del token de la cookie
  usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  caduca INTEGER NOT NULL
);
CREATE INDEX sesiones_usuario ON sesiones(usuario_id);
CREATE TABLE campanas (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  descripcion TEXT NOT NULL DEFAULT '',
  master_id TEXT NOT NULL REFERENCES usuarios(id),
  sistema TEXT NOT NULL DEFAULT '2.0',
  ajustes TEXT NOT NULL DEFAULT '{}', -- fecha del mundo, tipo de cambio, etc.
  creado INTEGER NOT NULL
);
CREATE TABLE miembros (
  campana_id TEXT NOT NULL REFERENCES campanas(id) ON DELETE CASCADE,
  usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  rol TEXT NOT NULL CHECK (rol IN ('master','jugador','espectador')),
  personaje_id TEXT,
  PRIMARY KEY (campana_id, usuario_id)
);
CREATE TABLE invitaciones (
  codigo TEXT PRIMARY KEY,
  creada_por TEXT NOT NULL REFERENCES usuarios(id),
  campana_id TEXT REFERENCES campanas(id) ON DELETE CASCADE,
  rol TEXT NOT NULL DEFAULT 'jugador' CHECK (rol IN ('jugador','espectador','usuario')),
  usos INTEGER NOT NULL DEFAULT 1,
  caduca INTEGER NOT NULL
);
CREATE TABLE personajes (
  id TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  datos TEXT NOT NULL,             -- JSON: ficha del creador, estado vivo, inventario, dinero, PX, narración
  version INTEGER NOT NULL DEFAULT 1,
  actualizado INTEGER NOT NULL
);
CREATE INDEX personajes_usuario ON personajes(usuario_id);
CREATE TABLE historial (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  personaje_id TEXT NOT NULL REFERENCES personajes(id) ON DELETE CASCADE,
  autor_id TEXT NOT NULL,
  texto TEXT NOT NULL,
  ts INTEGER NOT NULL
);
CREATE INDEX historial_pj ON historial(personaje_id, ts);
CREATE TABLE notas (
  id TEXT PRIMARY KEY,
  campana_id TEXT NOT NULL REFERENCES campanas(id) ON DELETE CASCADE,
  autor_id TEXT NOT NULL,
  titulo TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'nota',
  cuerpo TEXT NOT NULL DEFAULT '',
  visible TEXT NOT NULL DEFAULT 'master' CHECK (visible IN ('master','grupo')),
  actualizado INTEGER NOT NULL
);
CREATE INDEX notas_campana ON notas(campana_id);
