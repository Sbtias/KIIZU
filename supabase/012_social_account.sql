-- KIIZU social and account safety
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare caller uuid := auth.uid();
begin
  if caller is null then raise exception 'AUTH_REQUIRED'; end if;
  delete from auth.users where id = caller;
end;
$$;
revoke all on function public.delete_my_account() from public;
revoke execute on function public.delete_my_account() from anon;
grant execute on function public.delete_my_account() to authenticated;

drop policy if exists "own messages send" on public.messages;
create policy "own messages send" on public.messages
for insert to authenticated
with check (
  auth.uid() = sender_id
  and (
    recipient_id is null
    or exists (
      select 1 from public.friendships f
      where f.status='accepted'
        and ((f.requester_id=auth.uid() and f.addressee_id=recipient_id)
          or (f.addressee_id=auth.uid() and f.requester_id=recipient_id))
    )
  )
);

create or replace function public.send_friend_message(p_recipient_id uuid,p_body text)
returns public.messages
language plpgsql
security definer
set search_path = public
as $$
declare caller uuid := auth.uid();
declare result public.messages;
begin
  if caller is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_recipient_id is null or p_recipient_id = caller then raise exception 'INVALID_RECIPIENT'; end if;
  if char_length(trim(p_body)) < 1 or char_length(p_body) > 500 then raise exception 'INVALID_MESSAGE'; end if;
  if not exists (
    select 1 from public.friendships f
    where f.status='accepted'
      and ((f.requester_id=caller and f.addressee_id=p_recipient_id)
        or (f.addressee_id=caller and f.requester_id=p_recipient_id))
  ) then raise exception 'NOT_FRIENDS'; end if;
  insert into public.messages(sender_id,recipient_id,channel,body)
  values(caller,p_recipient_id,'friend',trim(p_body))
  returning * into result;
  return result;
end;
$$;
revoke all on function public.send_friend_message(uuid,text) from public;
revoke execute on function public.send_friend_message(uuid,text) from anon;
grant execute on function public.send_friend_message(uuid,text) to authenticated;