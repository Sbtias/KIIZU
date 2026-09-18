# KIIZU
 https://chatgpt.com/g/g-p-6aac70af834081919d676a710d305512-minijuegos/project
KIIZU es una plataforma social de minijuegos centrada en **crear, jugar, personalizar y socializar**.

## Principios del producto

- Producción muestra únicamente datos reales de Supabase.
- No se usan usuarios, jugadores, visitas, likes, rankings, Coins o estadísticas ficticias.
- Supabase Auth gestiona contraseñas, sesiones, confirmación y recuperación.
- Coins, compras, publicaciones, likes y equipamiento se validan en PostgreSQL.
- No hay NPCs ni mundos 3D en el producto actual.
- La interfaz usa un sistema visual propio, simple y consistente.

## Funciones actuales

- Registro/login con Supabase Auth.
- Confirmación de correo y recuperación de contraseña.
- Perfil con progreso y logros realmente desbloqueados.
- Presencia online basada en heartbeat y última actividad real.
- Hub con cuentas creadas y usuarios conectados reales.
- Catálogo y marketplace.
- Inventario persistente.
- Creador de ropa 2D con guardado y publicación.
- Likes únicos por usuario.
- Compra de ropa con transferencia atómica de Coins al creador.
- Equipar/quitar ropa.
- Creación de minijuegos basada en mecánicas seguras y configurables.
- Publicación de minijuegos.
- Matchmaking con Supabase Realtime.
- Partidas singleplayer y multiplayer según los límites definidos en la base de datos.

## Base de datos

Ejecutar los archivos en este orden:

1. `supabase/schema.sql`
2. `supabase/002_platform.sql`
3. `supabase/003_seed.sql`
4. `supabase/004_matchmaking.sql`
5. `supabase/005_realtime.sql`
6. `supabase/006_presence.sql`
7. `supabase/007_clothing.sql`
8. `supabase/008_retire_worlds.sql`
9. `supabase/009_equipment.sql`
10. `supabase/010_game_creator.sql`
11. `supabase/011_matchmaking_published_games.sql`
12. `supabase/012_reports.sql`

Después configura `js/config.js` con la URL pública y la publishable/anon key de Supabase.

## Estructura

```
/
├── css/global.css
├── js/
│   ├── app.js
│   ├── auth.js
│   ├── coins.js
│   ├── creator.js
│   ├── game.js
│   ├── game-creator.js
│   ├── inventory.js
│   ├── lobby.js
│   ├── login.js
│   ├── nav.js
│   ├── profile.js
│   ├── shop.js
│   └── ui.js
└── supabase/
    ├── schema.sql
    └── 002–012 migrations
```

## Seguridad

El frontend nunca recibe una service-role key ni modifica directamente Coins. Las operaciones sensibles utilizan RPC/security definer y RLS.

La presencia no crea usuarios artificiales. Un usuario cuenta como online solo mientras su `last_seen` sea reciente.

Las puntuaciones competitivas calculadas por el navegador todavía no otorgan automáticamente Coins/XP. Para economía competitiva real hace falta validar cada mecánica en servidor antes de conceder recompensas.

## Desarrollo

Usa GitHub Pages para producción y un servidor local para desarrollo. Configura en Supabase Auth la URL de producción y las URLs de redirección permitidas.

