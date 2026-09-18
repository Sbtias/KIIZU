-- KIIZU 007: user-created clothing, marketplace, likes and secure purchases.
create table if not exists public.clothing_items (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 60),
  description text not null default '' check (char_length(description) <= 500),
  type text not null check (type in ('camiseta','camisa','pantalon','sudadera','gorra','accesorio')),
  price bigint not null default 0 check (price between 0 and 100000),
  design_data jsonb not null default '{"version":1,"layers":[]}'::jsonb,
  thumbnail text,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_clothing_creator on public.clothing_items(creator_id, updated_at desc);
create index if not exists idx_clothing_market on public.clothing_items(is_published, created_at desc);

create table if not exists public.clothing_likes (
  clothing_id uuid not null references public.clothing_items(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(clothing_id,user_id)
);
create index if not exists idx_clothing_likes_item on public.clothing_likes(clothing_id);

create table if not exists public.clothing_purchases (
  id bigint generated always as identity primary key,
  clothing_id uuid not null references public.clothing_items(id) on delete restrict,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  price bigint not null check(price >= 0),
  created_at timestamptz not null default now(),
  unique(clothing_id,buyer_id)
);
create index if not exists idx_clothing_purchases_buyer on public.clothing_purchases(buyer_id,created_at desc);
create index if not exists idx_clothing_purchases_creator on public.clothing_purchases(creator_id,created_at desc);

alter table public.clothing_items enable row level security;
alter table public.clothing_likes enable row level security;
alter table public.clothing_purchases enable row level security;

drop policy if exists "published clothing read" on public.clothing_items;
create policy "published clothing read" on public.clothing_items for select using (is_published = true or auth.uid() = creator_id);
drop policy if exists "own clothing insert" on public.clothing_items;
create policy "own clothing insert" on public.clothing_items for insert with check (auth.uid() = creator_id);
drop policy if exists "own clothing update" on public.clothing_items;
create policy "own clothing update" on public.clothing_items for update using (auth.uid() = creator_id) with check (auth.uid() = creator_id);
drop policy if exists "own clothing delete" on public.clothing_items;
create policy "own clothing delete" on public.clothing_items for delete using (auth.uid() = creator_id);

drop policy if exists "likes read" on public.clothing_likes;
create policy "likes read" on public.clothing_likes for select using (true);
drop policy if exists "own like insert" on public.clothing_likes;
create policy "own like insert" on public.clothing_likes for insert with check (auth.uid() = user_id);
drop policy if exists "own like delete" on public.clothing_likes;
create policy "own like delete" on public.clothing_likes for delete using (auth.uid() = user_id);

drop policy if exists "own clothing purchases read" on public.clothing_purchases;
create policy "own clothing purchases read" on public.clothing_purchases for select using (auth.uid() = buyer_id or auth.uid() = creator_id);

create or replace function public.toggle_clothing_like(p_clothing_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare caller uuid:=auth.uid(); liked boolean;
begin
 if caller is null then raise exception 'AUTH_REQUIRED'; end if;
 if not exists(select 1 from clothing_items where id=p_clothing_id and is_published=true) then raise exception 'CLOTHING_NOT_FOUND'; end if;
 if exists(select 1 from clothing_likes where clothing_id=p_clothing_id and user_id=caller) then
   delete from clothing_likes where clothing_id=p_clothing_id and user_id=caller; liked:=false;
 else
   insert into clothing_likes(clothing_id,user_id) values(p_clothing_id,caller); liked:=true;
 end if;
 return liked;
end; $$;
revoke all on function public.toggle_clothing_like(uuid) from public;
grant execute on function public.toggle_clothing_like(uuid) to authenticated;

create or replace function public.purchase_clothing(p_clothing_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare buyer uuid:=auth.uid(); item clothing_items%rowtype; buyer_balance bigint;
begin
 if buyer is null then raise exception 'AUTH_REQUIRED'; end if;
 select * into item from clothing_items where id=p_clothing_id and is_published=true for update;
 if not found then raise exception 'CLOTHING_NOT_FOUND'; end if;
 if item.creator_id=buyer then raise exception 'CANNOT_BUY_OWN_ITEM'; end if;
 if exists(select 1 from clothing_purchases where clothing_id=p_clothing_id and buyer_id=buyer) then raise exception 'CLOTHING_ALREADY_OWNED'; end if;
 select coins into buyer_balance from profiles where id=buyer for update;
 if buyer_balance < item.price then raise exception 'INSUFFICIENT_COINS'; end if;
 update profiles set coins=coins-item.price,updated_at=now() where id=buyer;
 update profiles set coins=coins+item.price,updated_at=now() where id=item.creator_id;
 insert into clothing_purchases(clothing_id,buyer_id,creator_id,price) values(item.id,buyer,item.creator_id,item.price);
 insert into inventory(user_id,item_id) select buyer,id from items where false;
 insert into coin_transactions(user_id,amount,reason) values(buyer,-item.price,'clothing_purchase:'||item.id);
 insert into coin_transactions(user_id,amount,reason) values(item.creator_id,item.price,'clothing_sale:'||item.id);
 return jsonb_build_object('clothing_id',item.id,'price',item.price,'balance',buyer_balance-item.price);
end; $$;
revoke all on function public.purchase_clothing(uuid) from public;
grant execute on function public.purchase_clothing(uuid) to authenticated;
