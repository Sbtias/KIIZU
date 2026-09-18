-- KIIZU presence and public counters
alter table public.profiles add column if not exists last_seen timestamptz;
create index if not exists idx_profiles_last_seen on public.profiles(last_seen);
create index if not exists idx_profiles_status_last_seen on public.profiles(status,last_seen);

drop function if exists public.heartbeat_presence();
create or replace function public.heartbeat_presence()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  update public.profiles set status='online', last_seen=now(), updated_at=now() where id=auth.uid();
end; $$;
revoke all on function public.heartbeat_presence() from public;
grant execute on function public.heartbeat_presence() to authenticated;

drop function if exists public.set_presence(text);
create or replace function public.set_presence(p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_status not in ('online','offline') then raise exception 'INVALID_STATUS'; end if;
  update public.profiles
  set status=p_status, last_seen=case when p_status='online' then now() else last_seen end, updated_at=now()
  where id=auth.uid();
end; $$;
revoke all on function public.set_presence(text) from public;
grant execute on function public.set_presence(text) to authenticated;
