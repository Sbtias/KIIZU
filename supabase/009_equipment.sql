-- KIIZU 009: secure clothing equipment.
create table if not exists public.equipped_clothing (
  user_id uuid not null references public.profiles(id) on delete cascade,
  clothing_id uuid not null references public.clothing_items(id) on delete cascade,
  slot text not null check(slot in ('camiseta','camisa','pantalon','sudadera','gorra','accesorio')),
  equipped_at timestamptz not null default now(),
  primary key(user_id,slot)
);
alter table public.equipped_clothing enable row level security;
drop policy if exists "own equipped clothing read" on public.equipped_clothing;
create policy "own equipped clothing read" on public.equipped_clothing for select using(auth.uid()=user_id);

create or replace function public.equip_clothing(p_clothing_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare caller uuid:=auth.uid(); item clothing_items%rowtype;
begin
 if caller is null then raise exception 'AUTH_REQUIRED'; end if;
 select * into item from clothing_items where id=p_clothing_id and is_published=true;
 if not found then raise exception 'CLOTHING_NOT_FOUND'; end if;
 if not exists(select 1 from clothing_inventory where user_id=caller and clothing_id=item.id) then raise exception 'CLOTHING_NOT_OWNED'; end if;
 insert into equipped_clothing(user_id,clothing_id,slot) values(caller,item.id,item.type)
 on conflict(user_id,slot) do update set clothing_id=excluded.clothing_id,equipped_at=now();
 return jsonb_build_object('clothing_id',item.id,'slot',item.type);
end; $$;
revoke all on function public.equip_clothing(uuid) from public;
grant execute on function public.equip_clothing(uuid) to authenticated;

create or replace function public.unequip_clothing(p_slot text)
returns boolean language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 delete from equipped_clothing where user_id=auth.uid() and slot=p_slot;
 return true;
end; $$;
revoke all on function public.unequip_clothing(text) from public;
grant execute on function public.unequip_clothing(text) to authenticated;
