-- 004: safe matchmaking primitives and profile bootstrap.
alter table public.games add column if not exists price bigint not null default 0 check (price >= 0);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_name text := coalesce(nullif(new.raw_user_meta_data->>'username',''), split_part(new.email,'@',1), 'player');
  clean_name text := regexp_replace(lower(base_name), '[^a-z0-9_]', '', 'g');
begin
  if clean_name = '' then clean_name := 'player'; end if;
  insert into public.profiles(id, username)
  values(new.id, left(clean_name, 20))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.create_match(p_game_slug text)
returns public.matches
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  g public.games%rowtype;
  m public.matches;
  generated_code text;
begin
  if caller is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into g from public.games where slug = p_game_slug and unlocked_by_default = true limit 1;
  if not found then raise exception 'GAME_NOT_FOUND'; end if;

  select * into m
  from public.matches
  where game_id = g.id and status = 'waiting'
    and (select count(*) from public.match_players mp where mp.match_id = matches.id) < g.max_players
  order by created_at asc limit 1
  for update skip locked;

  if m.id is null then
    generated_code := upper(substr(encode(gen_random_bytes(5),'hex'),1,8));
    insert into public.matches(game_id, host_id, code, status)
    values(g.id, caller, generated_code, 'waiting')
    returning * into m;
  end if;

  insert into public.match_players(match_id, user_id)
  values(m.id, caller)
  on conflict do nothing;

  return m;
end;
$$;

revoke all on function public.create_match(text) from public;
grant execute on function public.create_match(text) to authenticated;

create or replace function public.join_match(p_match_id uuid)
returns public.match_players
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  m public.matches%rowtype;
  max_players integer;
  result_row public.match_players;
begin
  if caller is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into m from public.matches where id = p_match_id for update;
  if not found then raise exception 'MATCH_NOT_FOUND'; end if;
  if m.status <> 'waiting' then raise exception 'MATCH_NOT_OPEN'; end if;
  select max_players into max_players from public.games where id = m.game_id;
  if (select count(*) from public.match_players where match_id = m.id) >= max_players then raise exception 'MATCH_FULL'; end if;

  insert into public.match_players(match_id,user_id) values(m.id,caller)
  on conflict do nothing;
  select * into result_row from public.match_players where match_id=m.id and user_id=caller;
  return result_row;
end;
$$;

revoke all on function public.join_match(uuid) from public;
grant execute on function public.join_match(uuid) to authenticated;

create or replace function public.leave_match(p_match_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare caller uuid := auth.uid();
begin
  if caller is null then raise exception 'AUTH_REQUIRED'; end if;
  delete from public.match_players where match_id=p_match_id and user_id=caller;
  return true;
end;
$$;

revoke all on function public.leave_match(uuid) from public;
grant execute on function public.leave_match(uuid) to authenticated;

insert into public.items(slug,name,category,price,unique_item,metadata)
values
('starter-cap','Starter Cap','hats',120,true,'{"rarity":"common"}'),
('neon-visage','Neon Visage','face',250,true,'{"rarity":"rare"}'),
('lime-trail','Lime Trail','effects',400,true,'{"rarity":"epic"}'),
('pixel-hoodie','Pixel Hoodie','clothes',180,true,'{"rarity":"common"}'),
('void-shoes','Void Shoes','shoes',300,true,'{"rarity":"rare"}')
on conflict (slug) do nothing;

insert into public.games(slug,name,description,min_players,max_players,unlocked_by_default,price)
values
('reaction','Reaction Arena','Reacciona antes que los demás.',1,8,true,0),
('quickclick','Quick Click','Pulsa y consigue la mayor puntuación.',1,8,true,0),
('memory','Memory','Encuentra las parejas.',1,8,true,0),
('obstacle','Obstacle Run','Supera el circuito.',1,8,true,0),
('race','Race','Corre hasta la meta.',2,8,true,0),
('survival','Survival','Aguanta hasta el final.',2,8,true,0)
on conflict (slug) do update set price=excluded.price;