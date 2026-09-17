-- KIIZU platform layer: avatars, worlds, social, progression and secure economy.
create extension if not exists pgcrypto;

create table if not exists public.avatars (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  body_type text not null default 'standard',
  skin_color text not null default '#C98B68',
  hair_item uuid references public.items(id) on delete set null,
  face_item uuid references public.items(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.worlds (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text not null default '',
  category text not null default 'social',
  thumbnail_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id bigint generated always as identity primary key,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  channel text not null default 'global',
  recipient_id uuid references public.profiles(id) on delete cascade,
  match_id uuid references public.matches(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text not null default '',
  icon text not null default '🏆',
  xp_reward integer not null default 0 check (xp_reward >= 0)
);

create table if not exists public.user_achievements (
  user_id uuid not null references public.profiles(id) on delete cascade,
  achievement_id uuid not null references public.achievements(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

create table if not exists public.xp_transactions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount integer not null check (amount > 0),
  reason text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.reports (
  id bigint generated always as identity primary key,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_user_id uuid references public.profiles(id) on delete set null,
  message_id bigint references public.messages(id) on delete set null,
  reason text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists xp integer not null default 0 check (xp >= 0);
alter table public.profiles add column if not exists level integer not null default 1 check (level >= 1);
alter table public.profiles add column if not exists status text not null default 'offline';

create index if not exists idx_messages_channel_created on public.messages(channel, created_at desc);
create index if not exists idx_messages_recipient_created on public.messages(recipient_id, created_at desc);
create index if not exists idx_xp_user_created on public.xp_transactions(user_id, created_at desc);
create index if not exists idx_reports_created on public.reports(created_at desc);

alter table public.avatars enable row level security;
alter table public.messages enable row level security;
alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;
alter table public.xp_transactions enable row level security;
alter table public.reports enable row level security;
alter table public.worlds enable row level security;

drop policy if exists "public worlds read" on public.worlds;
create policy "public worlds read" on public.worlds for select using (active = true);

drop policy if exists "public achievements read" on public.achievements;
create policy "public achievements read" on public.achievements for select using (true);

drop policy if exists "public profiles read" on public.profiles;
create policy "public profiles read" on public.profiles for select using (true);

drop policy if exists "own avatar read" on public.avatars;
create policy "own avatar read" on public.avatars for select using (auth.uid() = user_id);

drop policy if exists "public avatar read" on public.avatars;
create policy "public avatar read" on public.avatars for select using (true);

drop policy if exists "own avatar write" on public.avatars;
create policy "own avatar write" on public.avatars for insert with check (auth.uid() = user_id);

drop policy if exists "own avatar update" on public.avatars;
create policy "own avatar update" on public.avatars for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own achievements read" on public.user_achievements;
create policy "own achievements read" on public.user_achievements for select using (auth.uid() = user_id);

drop policy if exists "own xp read" on public.xp_transactions;
create policy "own xp read" on public.xp_transactions for select using (auth.uid() = user_id);

drop policy if exists "own messages read" on public.messages;
create policy "own messages read" on public.messages for select using (
  auth.uid() = sender_id or auth.uid() = recipient_id or channel = 'global'
);

drop policy if exists "own messages send" on public.messages;
create policy "own messages send" on public.messages for insert with check (auth.uid() = sender_id);

drop policy if exists "own reports create" on public.reports;
create policy "own reports create" on public.reports for insert with check (auth.uid() = reporter_id);

-- Atomic purchase. Client never supplies the price or changes coins directly.
create or replace function public.purchase_item(p_item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  buyer uuid := auth.uid();
  item_row public.items%rowtype;
  balance bigint;
begin
  if buyer is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into item_row from public.items where id = p_item_id for share;
  if not found then raise exception 'ITEM_NOT_FOUND'; end if;

  if exists (select 1 from public.inventory where user_id = buyer and item_id = p_item_id) then
    raise exception 'ITEM_ALREADY_OWNED';
  end if;

  select coins into balance from public.profiles where id = buyer for update;
  if balance < item_row.price then raise exception 'INSUFFICIENT_COINS'; end if;

  update public.profiles
    set coins = coins - item_row.price, updated_at = now()
    where id = buyer;

  insert into public.inventory(user_id, item_id) values (buyer, p_item_id);
  insert into public.coin_transactions(user_id, amount, reason)
    values (buyer, -item_row.price, 'purchase:' || item_row.slug);

  return jsonb_build_object('item_id', p_item_id, 'price', item_row.price, 'balance', balance - item_row.price);
end;
$$;

revoke all on function public.purchase_item(uuid) from public;
grant execute on function public.purchase_item(uuid) to authenticated;

-- Unlocking games is also atomic and cannot be spoofed from the browser.
create or replace function public.unlock_game(p_game_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  buyer uuid := auth.uid();
  game_row public.games%rowtype;
  balance bigint;
begin
  if buyer is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into game_row from public.games where id = p_game_id for share;
  if not found then raise exception 'GAME_NOT_FOUND'; end if;

  if exists (select 1 from public.game_unlocks where user_id = buyer and game_id = p_game_id) then
    raise exception 'GAME_ALREADY_UNLOCKED';
  end if;

  -- Current schema has no game price yet. This RPC intentionally handles free/default unlocks.
  insert into public.game_unlocks(user_id, game_id) values (buyer, p_game_id);
  return jsonb_build_object('game_id', p_game_id, 'unlocked', true);
end;
$$;

revoke all on function public.unlock_game(uuid) from public;
grant execute on function public.unlock_game(uuid) to authenticated;

-- XP is granted by trusted database logic, not by a client-supplied balance update.
create or replace function public.add_xp(p_user_id uuid, p_amount integer, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  new_xp integer;
  new_level integer;
begin
  if caller is null or caller <> p_user_id then raise exception 'FORBIDDEN'; end if;
  if p_amount <= 0 or p_amount > 1000 then raise exception 'INVALID_XP'; end if;

  insert into public.xp_transactions(user_id, amount, reason)
    values (p_user_id, p_amount, left(p_reason, 120));

  update public.profiles
    set xp = xp + p_amount,
        level = greatest(1, floor(sqrt((xp + p_amount) / 100.0))::integer + 1),
        updated_at = now()
    where id = p_user_id
    returning xp, level into new_xp, new_level;

  return jsonb_build_object('xp', new_xp, 'level', new_level);
end;
$$;

revoke all on function public.add_xp(uuid, integer, text) from public;
grant execute on function public.add_xp(uuid, integer, text) to authenticated;
