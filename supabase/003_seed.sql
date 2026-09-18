-- KIIZU base seed.
-- Los mundos no se precargan: la comunidad los crea con KIIZU Engine.
-- Esto mantiene el catálogo limpio y evita mezclar juegos demo con obras publicadas.

insert into public.achievements (slug, name, description, icon, xp_reward)
values
('first-win', 'First Win', 'Gana tu primera partida.', '🏆', 100),
('games-100', '100 Games', 'Juega 100 partidas.', '🎮', 500),
('speed-demon', 'Speed Demon', 'Consigue una marca de reacción destacada.', '⚡', 150),
('social-player', 'Social Player', 'Añade tu primer amigo.', '👥', 100),
('winning-streak', 'Winning Streak', 'Consigue una racha de victorias.', '🔥', 250)
on conflict (slug) do nothing;
