create or replace function public.complete_game_run(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  m public.matches%rowtype;
  mp public.match_players%rowtype;
  g public.games%rowtype;
  achievement_count integer := 0;
  achievement_xp integer := 0;
  reward_coins integer := 0;
  reward_xp integer := 0;
  new_level integer := 1;
  unlocked jsonb := '[]'::jsonb;
begin
  if caller is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into m from public.matches where id = p_match_id;
  if not found then raise exception 'MATCH_NOT_FOUND'; end if;
  select * into mp from public.match_players where match_id = p_match_id and user_id = caller;
  if not found then raise exception 'NOT_A_PLAYER'; end if;
  select * into g from public.games where id = m.game_id;
  if not found then raise exception 'GAME_NOT_FOUND'; end if;

  reward_coins := case when mp.placement = 1 then 20 else 10 end;
  reward_xp := case when mp.placement = 1 then 15 else 5 end;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', ga.id, 'name', ga.name, 'description', ga.description,
    'icon', ga.icon, 'xp_reward', ga.xp_reward
  ) order by ga.created_at), '[]'::jsonb),
  count(*)::integer,
  coalesce(sum(ga.xp_reward),0)::integer
  into unlocked, achievement_count, achievement_xp
  from public.game_achievements ga
  where ga.game_id = g.id
    and not exists (
      select 1 from public.user_game_achievements uga
      where uga.user_id = caller and uga.achievement_id = ga.id
    );

  insert into public.user_game_achievements(user_id, achievement_id)
  select caller, ga.id
  from public.game_achievements ga
  where ga.game_id = g.id
    and not exists (
      select 1 from public.user_game_achievements uga
      where uga.user_id = caller and uga.achievement_id = ga.id
    )
  on conflict do nothing;

  if achievement_xp > 0 then
    insert into public.xp_transactions(user_id, amount, reason)
    values(caller, achievement_xp, 'game_achievements');
  end if;

  update public.profiles
  set xp = xp + achievement_xp,
      level = greatest(1, 1 + floor((xp + achievement_xp) / 100)::int),
      updated_at = now()
  where id = caller
  returning level into new_level;

  return jsonb_build_object(
    'match_id', m.id, 'game_id', g.id, 'score', coalesce(mp.score,0),
    'placement', coalesce(mp.placement,0), 'coins_earned', reward_coins,
    'match_xp_earned', reward_xp, 'achievement_xp_earned', achievement_xp,
    'total_xp_earned', reward_xp + achievement_xp,
    'achievements_unlocked', unlocked, 'achievements_count', achievement_count,
    'new_level', new_level
  );
end;
$$;

revoke all on function public.complete_game_run(uuid) from public;
grant execute on function public.complete_game_run(uuid) to authenticated;
