insert into public.games (slug, name, description, min_players, max_players, unlocked_by_default)
values
('reaction', 'Reaction Arena', 'Reacciona antes que los demás.', 1, 8, true),
('quickclick', 'Quick Click', 'Pulsa y consigue la mayor puntuación.', 1, 8, true),
('memory', 'Memory', 'Encuentra las parejas.', 1, 8, true),
('obstacle', 'Obstacle Run', 'Supera el circuito.', 1, 8, true),
('race', 'Race', 'Corre hasta la meta.', 2, 8, true),
('survival', 'Survival', 'Aguanta hasta el final.', 2, 8, true)
on conflict (slug) do nothing;

insert into public.worlds (slug, name, description, category)
values
('central-hub', 'Central Hub', 'El punto de encuentro de KIIZU.', 'social'),
('neon-city', 'Neon City', 'Una ciudad nocturna para explorar.', 'social'),
('game-arena', 'Game Arena', 'La arena competitiva.', 'competitive'),
('beach-party', 'Beach Party', 'Un mundo relajado para eventos.', 'casual')
on conflict (slug) do nothing;

insert into public.achievements (slug, name, description, icon, xp_reward)
values
('first-win', 'First Win', 'Gana tu primera partida.', '🏆', 100),
('games-100', '100 Games', 'Juega 100 partidas.', '🎮', 500),
('speed-demon', 'Speed Demon', 'Consigue una marca de reacción destacada.', '⚡', 150),
('social-player', 'Social Player', 'Añade tu primer amigo.', '👥', 100),
('winning-streak', 'Winning Streak', 'Consigue una racha de victorias.', '🔥', 250)
on conflict (slug) do nothing;
