# KIIZU

**KIIZU** es una base funcional para una plataforma social de videojuegos: identidad, mundos, descubrimiento, economía, inventario, progresión y partidas realtime.

## Estado actual

- Landing con identidad visual 3D/futurista y fallback CSS.
- Autenticación real con Supabase Auth.
- Perfil persistente con Coins, XP, nivel y estadísticas.
- Hub social y descubrimiento de mundos.
- Tienda persistente con compras atómicas mediante RPC.
- Inventario persistente.
- Base de avatares, mundos, amigos/social y logros.
- Matchmaking con salas persistentes y Supabase Realtime.
- Partidas con presencia y sincronización de estado.
- Arquitectura modular en HTML/CSS/JS.
- RLS y operaciones sensibles server-side mediante funciones PostgreSQL.

## Configuración

1. Crea un proyecto en Supabase.
2. Ejecuta en orden:
   - `supabase/schema.sql`
   - `supabase/002_platform.sql`
   - `supabase/003_seed.sql`
   - `supabase/004_matchmaking.sql`
   - `supabase/005_realtime.sql`
3. Configura `js/config.js` con la URL pública y la publishable/anon key de tu proyecto.
4. Nunca pongas una service-role key en el frontend.
5. Sirve el proyecto mediante un servidor local. Los módulos ES y Auth no deben probarse abriendo los HTML con `file://`.

## Arquitectura

```
/css
  global.css
/js
  app.js
  auth.js
  coins.js
  game.js
  lobby.js
  login.js
  nav.js
  profile.js
  shop.js
  ui.js
/supabase
  schema.sql
  002_platform.sql
  003_seed.sql
  004_matchmaking.sql
  005_realtime.sql
index.html
login.html
lobby.html
discover.html
shop.html
inventory.html
profile.html
game.html
```

## Seguridad

El navegador nunca recibe una service-role key y no escribe directamente el saldo de Coins. Las compras pasan por `purchase_item()`, que bloquea el perfil, valida propiedad y saldo, descuenta y registra la transacción en una operación atómica.

El matchmaking también usa funciones PostgreSQL para crear/unirse/iniciar salas.

### Próxima capa de producción

La puntuación competitiva y las recompensas finales todavía deben migrarse a un validador server-side/Edge Function por juego. La UI puede sincronizar puntuaciones por Realtime, pero una plataforma comercial no debe confiar en un resultado calculado por el navegador para entregar Coins. Esa separación es intencional.
