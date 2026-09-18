-- KIIZU room browser
create or replace function public.get_game_rooms(p_game_slug text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare caller uuid := auth.uid(); result jsonb;
begin
 if caller is null then raise exception 'AUTH_REQUIRED'; end if;
 select coalesce(jsonb_agg(x order by x.created_at asc),'[]'::jsonb) into result
 from (
  select m.id,m.code,m.host_id,m.created_at,g.max_players,
   coalesce((select count(*) from public.match_players mp where mp.match_id=m.id),0)::int player_count,
   coalesce((select p.username from public.profiles p where p.id=m.host_id),'Jugador') host_username
  from public.matches m join public.games g on g.id=m.game_id
  where g.slug=p_game_slug and m.status='waiting'
   and coalesce((select count(*) from public.match_players mp where mp.match_id=m.id),0)<g.max_players
  order by m.created_at asc limit 30
 ) x;
 return result;
end; $$;
create or replace function public.create_match_room(p_game_slug text)
returns public.matches language plpgsql security definer set search_path=public as $$
declare caller uuid:=auth.uid(); g public.games%rowtype; m public.matches%rowtype;
begin
 if caller is null then raise exception 'AUTH_REQUIRED'; end if;
 select * into g from public.games where slug=p_game_slug and (unlocked_by_default=true or is_published=true) limit 1;
 if not found then raise exception 'GAME_NOT_FOUND'; end if;
 insert into public.matches(game_id,host_id,code,status) values(g.id,caller,upper(substr(md5(caller::text||clock_timestamp()::text||random()::text),1,8)),'waiting') returning * into m;
 insert into public.match_players(match_id,user_id) values(m.id,caller);
 return m;
end; $$;
revoke all on function public.get_game_rooms(text) from public;
revoke execute on function public.get_game_rooms(text) from anon;
grant execute on function public.get_game_rooms(text) to authenticated;
revoke all on function public.create_match_room(text) from public;
revoke execute on function public.create_match_room(text) from anon;
grant execute on function public.create_match_room(text) to authenticated;