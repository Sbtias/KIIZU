-- KIIZU avatar customization
create table if not exists public.equipped_clothing (
  user_id uuid not null references public.profiles(id) on delete cascade,
  clothing_id uuid not null references public.clothing_items(id) on delete cascade,
  slot text not null check(slot in ('shirt','pants','accessory','hat','face','full')),
  equipped_at timestamptz not null default now(),
  primary key(user_id,slot)
);
alter table public.equipped_clothing enable row level security;
drop policy if exists "equipped clothing own read" on public.equipped_clothing;
create policy "equipped clothing own read" on public.equipped_clothing for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists "equipped clothing own delete" on public.equipped_clothing;
create policy "equipped clothing own delete" on public.equipped_clothing for delete to authenticated using ((select auth.uid())=user_id);

drop function if exists public.equip_clothing(uuid);
create or replace function public.equip_clothing(p_clothing_id uuid)
returns public.equipped_clothing language plpgsql security definer set search_path=public as $$
declare caller uuid:=auth.uid(); item public.clothing_items%rowtype; result public.equipped_clothing;
begin
 if caller is null then raise exception 'AUTH_REQUIRED'; end if;
 select * into item from public.clothing_items where id=p_clothing_id;
 if not found then raise exception 'CLOTHING_NOT_FOUND'; end if;
 if item.creator_id<>caller and not exists(select 1 from public.clothing_purchases where clothing_id=p_clothing_id and buyer_id=caller) then raise exception 'NOT_OWNED'; end if;
 insert into public.equipped_clothing(user_id,clothing_id,slot) values(caller,p_clothing_id,item.type)
 on conflict(user_id,slot) do update set clothing_id=excluded.clothing_id,equipped_at=now() returning * into result;
 return result;
end; $$;
revoke all on function public.equip_clothing(uuid) from public;
grant execute on function public.equip_clothing(uuid) to authenticated;

drop function if exists public.unequip_clothing(text);
create or replace function public.unequip_clothing(p_slot text)
returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 delete from public.equipped_clothing where user_id=auth.uid() and slot=p_slot;
end; $$;
revoke all on function public.unequip_clothing(text) from public;
grant execute on function public.unequip_clothing(text) to authenticated;
