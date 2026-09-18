-- KIIZU 013: real friends, no fake social graph.
drop policy if exists "friendships read own" on public.friendships;
create policy "friendships read own" on public.friendships for select using(auth.uid()=requester_id or auth.uid()=addressee_id);

create or replace function public.send_friend_request(p_username text)
returns public.friendships language plpgsql security definer set search_path=public as $$
declare caller uuid:=auth.uid(); target uuid; r public.friendships;
begin
 if caller is null then raise exception 'AUTH_REQUIRED'; end if;
 select id into target from profiles where lower(username)=lower(trim(p_username)) limit 1;
 if target is null then raise exception 'USER_NOT_FOUND'; end if;
 if target=caller then raise exception 'CANNOT_ADD_SELF'; end if;
 insert into friendships(requester_id,addressee_id,status) values(caller,target,'pending')
 on conflict(requester_id,addressee_id) do update set status='pending',created_at=now()
 returning * into r;
 return r;
end; $$;
revoke all on function public.send_friend_request(text) from public;
grant execute on function public.send_friend_request(text) to authenticated;

create or replace function public.respond_friend_request(p_requester_id uuid,p_accept boolean)
returns boolean language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 update friendships set status=case when p_accept then 'accepted' else 'rejected' end
 where requester_id=p_requester_id and addressee_id=auth.uid() and status='pending';
 if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
 return p_accept;
end; $$;
revoke all on function public.respond_friend_request(uuid,boolean) from public;
grant execute on function public.respond_friend_request(uuid,boolean) to authenticated;

create or replace function public.remove_friend(p_user_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 delete from friendships where status in ('accepted','pending') and ((requester_id=auth.uid() and addressee_id=p_user_id) or (requester_id=p_user_id and addressee_id=auth.uid()));
 return true;
end; $$;
revoke all on function public.remove_friend(uuid) from public;
grant execute on function public.remove_friend(uuid) to authenticated;
