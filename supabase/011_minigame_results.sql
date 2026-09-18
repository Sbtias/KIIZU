-- KIIZU 011: secure result submission for playable minigames.
create or replace function public.submit_match_score(p_match_id uuid,p_score integer)
returns public.matches
language plpgsql security definer set search_path=public
as $$
declare
 caller uuid:=auth.uid();
 m public.matches%rowtype;
 total integer;
 submitted integer;
begin
 if caller is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_score < 0 or p_score > 1000000 then raise exception 'INVALID_SCORE'; end if;
 select * into m from public.matches where id=p_match_id for update;
 if not found then raise exception 'MATCH_NOT_FOUND'; end if;
 if m.status not in ('starting','playing') then raise exception 'MATCH_NOT_PLAYING'; end if;
 if not exists(select 1 from public.match_players where match_id=p_match_id and user_id=caller) then raise exception 'NOT_A_PLAYER'; end if;
 update public.match_players set score=p_score,placement=0 where match_id=p_match_id and user_id=caller;
 select count(*) into total from public.match_players where match_id=p_match_id;
 select count(*) into submitted from public.match_players where match_id=p_match_id and placement=0;
 if submitted=total then
   with ranked as (
     select user_id,row_number() over(order by score desc,joined_at asc)::integer as place
     from public.match_players where match_id=p_match_id
   )
   update public.match_players mp set placement=r.place from ranked r
   where mp.match_id=p_match_id and mp.user_id=r.user_id;
   update public.matches set status='finished',finished_at=now() where id=p_match_id returning * into m;
 else
   update public.matches set status='playing' where id=p_match_id and status='starting' returning * into m;
   if m.id is null then select * into m from public.matches where id=p_match_id; end if;
 end if;
 return m;
end;
$$;
revoke all on function public.submit_match_score(uuid,integer) from public;
grant execute on function public.submit_match_score(uuid,integer) to authenticated;

-- Only authenticated players may call match functions.
revoke execute on function public.create_game(text,text,text,integer,integer) from anon;
revoke execute on function public.create_match(text) from anon;
revoke execute on function public.start_match(uuid) from anon;
revoke execute on function public.leave_match(uuid) from anon;
revoke execute on function public.publish_game(uuid) from anon;
revoke execute on function public.submit_match_score(uuid,integer) from anon;
grant execute on function public.create_game(text,text,text,integer,integer) to authenticated;
grant execute on function public.create_match(text) to authenticated;
grant execute on function public.start_match(uuid) to authenticated;
grant execute on function public.leave_match(uuid) to authenticated;
grant execute on function public.publish_game(uuid) to authenticated;
grant execute on function public.submit_match_score(uuid,integer) to authenticated;
