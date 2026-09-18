-- Match state with public player details for room UI
create or replace function public.get_match_state(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
declare
  caller uuid := auth.uid();
  m public.matches%rowtype;
  players jsonb;
begin
  if caller is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into m from public.matches
  where public.matches.id=p_match_id
    and exists(select 1 from public.match_players mp where mp.match_id=p_match_id and mp.user_id=caller);
  if not found then raise exception 'MATCH_NOT_FOUND'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'user_id',mp.user_id,'score',mp.score,'placement',mp.placement,
    'username',coalesce(p.username,'Jugador'),'avatar_url',p.avatar_url
  ) order by mp.joined_at),'[]'::jsonb)
  into players from public.match_players mp
  left join public.profiles p on p.id=mp.user_id
  where mp.match_id=p_match_id;
  return jsonb_build_object('match',to_jsonb(m),'players',players);
end;
$function$;
revoke all on function public.get_match_state(uuid) from public;
revoke execute on function public.get_match_state(uuid) from anon;
grant execute on function public.get_match_state(uuid) to authenticated;