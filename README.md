# Fire Angel

Juego de rol de ciencia ficción de Zalo. Este repositorio contiene la web completa y la plataforma de juego online:

- **Manual** (público): todas las páginas del libro, el Sistema 2.0, el creador de personajes y los relatos.
- **Partidas online** (`#juego`, con cuenta por invitación): campañas, gestor de personajes (ficha, equipo con peso, dinero en dos monedas, experiencia, narración, historial), notas y guiones del máster, recompensas y una sala en tiempo real con dados, chat, susurros y avisos.
- **Tablero táctico** (`#mesa`): tablero por casillas con niebla de guerra, editor y generador de mazmorras. Hoy funciona en modo local; se conectará a la sala.

## Estructura

| Ruta | Qué es |
|---|---|
| `public/` | La web estática (lo que se sirve tal cual). `content.js` es el manual construido. |
| `public/reglas2.js` | Todas las reglas del Sistema 2.0, compartidas por la web y el servidor. |
| `public/mesa-motor.js` | Modelo del tablero, visión y niebla; preparado para correr en el servidor. |
| `public/plataforma.js` | Interfaz de la plataforma online. |
| `src/worker.js` | Servidor: API (`/api/*`), sala en tiempo real (`/sala/<campaña>`, Durable Object `Sala`) y recursos estáticos. |
| `migrations/` | Esquema de la base de datos D1 `fire-angel`. |
| `test/` | Pruebas de la API y de la interfaz contra `wrangler dev`. |

## Desarrollo local

```sh
npm install
echo 'CODIGO_ARRANQUE="elige-un-codigo"' > .dev.vars
npx wrangler d1 migrations apply fire-angel --local
npx wrangler dev
node test/api.test.mjs          # con el servidor en marcha (usa el código «prueba-arranque»)
```

## Despliegue

Cloudflare Workers despliega desde la rama `main` (Workers Builds). La primera vez:

1. Aplicar las migraciones a la base remota: `npx wrangler d1 migrations apply fire-angel --remote`.
2. Definir el secreto `CODIGO_ARRANQUE` (sirve una sola vez, para crear la cuenta del primer administrador).
3. Entrar en `/#juego`, usar «Tengo una invitación» con ese código y crear la cuenta de administrador.

## Cuentas y seguridad

- Registro solo por invitación: el administrador crea invitaciones generales y cada máster las de su campaña (jugador o espectador, con usos y caducidad).
- Contraseñas con PBKDF2-SHA256 (100.000 iteraciones) y sal propia; sesión en cookie `HttpOnly`, `SameSite=Lax`, 30 días.
- Las tiradas las hace el servidor. Las secretas solo las ven quien tira y el máster. Los espectadores solo miran.
- Un jugador solo ve sus personajes; el máster ve los de su campaña.
