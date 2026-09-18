-- KIIZU 011: allow published community games into matchmaking.
create or replace function public.create_match(p_game_slug text)
returns public.matches language plpgsql security definer set search_path=public as $$
declare caller uuid:=auth.uid(); g public.games%rowtype; m public.matches; generated_code text;
begin
 if caller is null then raise exception 'AUTH_REQUIRED'; end if;
 select * into g from public.games where slug=p_game_slug and (unlocked_by_default=true or is_published=true) limit 1;
 if not found then raise exception 'GAME_NOT_FOUND'; end if;
 select * into m from public.matches where game_id=g.id and status='waiting'
 and (select count(*) from public.match_players mp where mp.match_id=matches.id)<g.max_players
 order by created_at asc limit 1 for update skip locked;
 if m.id is null then
  generated_code:=upper(substr(encode(gen_random_bytes(5),'hex'),1,8));
  insert into public.matches(game_id,host_id,code,status) values(g.id,caller,generated_code,'waiting') returning * into m;
 end if;
 insert into public.match_players(match_id,user_id) values(m.id,caller) on conflict do nothing;
 return m;
end; $$;
revoke all on function public.create_match(text) from public;
grant execute on function public.create_match(text) to authenticated;
