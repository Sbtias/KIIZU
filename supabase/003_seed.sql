insert into public.games (slug, name, description, min_players, max_players, unlocked_by_default, is_published, game_config)
values
('reaction', 'KIIZU Adventure', 'Explora un mundo 2D, supera obstáculos y llega a la meta.', 1, 8, true, true, '{"world":"adventure","objective":"Llega a la meta","time_limit":120}'::jsonb),
('quickclick', 'KIIZU Run', 'Corre por plataformas 2D, recoge monedas y alcanza la meta.', 1, 8, true, true, '{"world":"race","objective":"Corre hasta la meta","time_limit":90}'::jsonb),
('memory', 'KIIZU Puzzle World', 'Explora el mundo 2D y descubre una ruta hasta la meta.', 1, 8, true, true, '{"world":"adventure","objective":"Explora y encuentra objetos","time_limit":120}'::jsonb),
('obstacle', 'KIIZU Arena', 'Cruza una arena 2D con plataformas, obstáculos y otros jugadores.', 1, 8, true, true, '{"world":"adventure","objective":"Supera los obstáculos","time_limit":120}'::jsonb),
('race', 'KIIZU Race', 'Compite en una carrera 2D hasta la meta.', 1, 8, true, true, '{"world":"race","objective":"Llega primero a la meta","time_limit":90}'::jsonb),
('survival', 'KIIZU Mine', 'Explora una zona minera 2D, recoge recursos y alcanza la salida.', 1, 8, true, true, '{"world":"mine","objective":"Recolecta recursos y llega a la meta","time_limit":120}'::jsonb)
on conflict (slug) do nothing;

insert into public.achievements (slug, name, description, icon, xp_reward)
values
('first-win', 'First Win', 'Gana tu primera partida.', '🏆', 100),
('games-100', '100 Games', 'Juega 100 partidas.', '🎮', 500),
('speed-demon', 'Speed Demon', 'Consigue una marca de reacción destacada.', '⚡', 150),
('social-player', 'Social Player', 'Añade tu primer amigo.', '👥', 100),
('winning-streak', 'Winning Streak', 'Consigue una racha de victorias.', '🔥', 250)
on conflict (slug) do nothing;
