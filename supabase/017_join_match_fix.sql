-- Fix ambiguous max_players reference in join_match
create or replace function public.join_match(p_match_id uuid)
returns public.match_players
language plpgsql
security definer
set search_path=public
as $function$
declare
  caller uuid := auth.uid();
  m public.matches%rowtype;
  v_max_players integer;
  result_row public.match_players;
begin
  if caller is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into m from public.matches where public.matches.id = p_match_id for update;
  if not found then raise exception 'MATCH_NOT_FOUND'; end if;
  if m.status <> 'waiting' then raise exception 'MATCH_NOT_OPEN'; end if;

  select g.max_players into v_max_players
  from public.games g
  where g.id = m.game_id;

  if v_max_players is null then raise exception 'GAME_NOT_FOUND'; end if;
  if (select count(*) from public.match_players mp where mp.match_id = m.id) >= v_max_players then
    raise exception 'MATCH_FULL';
  end if;

  insert into public.match_players(match_id,user_id)
  values(m.id,caller)
  on conflict do nothing;

  select * into result_row
  from public.match_players mp
  where mp.match_id=m.id and mp.user_id=caller;

  return result_row;
end;
$function$;

revoke all on function public.join_match(uuid) from public;
revoke execute on function public.join_match(uuid) from anon;
grant execute on function public.join_match(uuid) to authenticated;
