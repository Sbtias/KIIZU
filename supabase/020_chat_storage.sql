-- KIIZU 020: 10 KB quota per private chat and message deletion.
create or replace function public.send_friend_message(p_recipient_id uuid, p_body text)
returns public.messages
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  result public.messages;
  chat_key text;
  used_bytes bigint;
  new_bytes bigint;
begin
  if caller is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_recipient_id is null or p_recipient_id = caller then raise exception 'INVALID_RECIPIENT'; end if;
  if char_length(trim(p_body)) < 1 or char_length(p_body) > 500 then raise exception 'INVALID_MESSAGE'; end if;

  if not exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = caller and f.addressee_id = p_recipient_id)
        or (f.addressee_id = caller and f.requester_id = p_recipient_id))
  ) then raise exception 'NOT_FRIENDS'; end if;

  chat_key := least(caller, p_recipient_id)::text || ':' || greatest(caller, p_recipient_id)::text;
  perform pg_advisory_xact_lock(hashtextextended(chat_key, 0));

  used_bytes := coalesce((
    select sum(octet_length(m.body))
    from public.messages m
    where m.channel = 'friend'
      and ((m.sender_id = caller and m.recipient_id = p_recipient_id)
        or (m.sender_id = p_recipient_id and m.recipient_id = caller))
  ), 0);
  new_bytes := octet_length(trim(p_body));

  if used_bytes + new_bytes > 10240 then
    raise exception 'CHAT_STORAGE_FULL';
  end if;

  insert into public.messages(sender_id, recipient_id, channel, body)
  values(caller, p_recipient_id, 'friend', trim(p_body))
  returning * into result;

  return result;
end;
$$;

revoke all on function public.send_friend_message(uuid, text) from public;
grant execute on function public.send_friend_message(uuid, text) to authenticated;

drop policy if exists "friend messages delete" on public.messages;
create policy "friend messages delete" on public.messages
for delete to authenticated
using (
  channel = 'friend'
  and (auth.uid() = sender_id or auth.uid() = recipient_id)
);

create index if not exists idx_messages_friend_pair_created
on public.messages (channel, sender_id, recipient_id, created_at desc);