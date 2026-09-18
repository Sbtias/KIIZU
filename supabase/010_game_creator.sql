-- KIIZU 010: creator engine 2D seguro y basado en datos.
alter table public.games add column if not exists creator_id uuid references public.profiles(id) on delete set null;
alter table public.games add column if not exists is_published boolean not null default false;
alter table public.games add column if not exists game_config jsonb not null default '{"engine":"kiizu-2d","version":1}'::jsonb;
create index if not exists idx_games_published on public.games(is_published,created_at desc);
alter table public.games enable row level security;

drop policy if exists "published games read" on public.games;
create policy "published games read" on public.games
for select using (unlocked_by_default=true or is_published=true or auth.uid()=creator_id);

drop policy if exists "own games update" on public.games;
create policy "own games update" on public.games
for update using(auth.uid()=creator_id) with check(auth.uid()=creator_id);

create or replace function public.create_game(p_name text,p_description text,p_mechanic text,p_min integer,p_max integer)
returns public.games
language plpgsql
security definer
set search_path=public
as $$
declare caller uuid:=auth.uid(); result_row public.games;
begin
 if caller is null then raise exception 'AUTH_REQUIRED'; end if;
 if char_length(trim(p_name))<2 or char_length(trim(p_name))>60 then raise exception 'INVALID_NAME'; end if;
 if p_mechanic <> 'world2d' then raise exception 'INVALID_ENGINE'; end if;
 if p_min<1 or p_max<p_min or p_max>8 then raise exception 'INVALID_PLAYER_LIMITS'; end if;
 insert into public.games(slug,name,description,min_players,max_players,unlocked_by_default,is_published,creator_id,game_config)
 values('user-'||replace(gen_random_uuid()::text,'-',''),trim(p_name),left(coalesce(p_description,''),500),p_min,p_max,false,false,caller,'{"engine":"kiizu-2d","version":1}'::jsonb)
 returning * into result_row;
 return result_row;
end;
$$;
revoke all on function public.create_game(text,text,text,integer,integer) from public;
revoke execute on function public.create_game(text,text,text,integer,integer) from anon;
grant execute on function public.create_game(text,text,text,integer,integer) to authenticated;

create or replace function public.publish_game(p_game_id uuid)
returns public.games
language plpgsql
security definer
set search_path=public
as $$
declare result_row public.games;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 update public.games set is_published=true
 where id=p_game_id and creator_id=auth.uid()
 returning * into result_row;
 if not found then raise exception 'GAME_NOT_FOUND'; end if;
 return result_row;
end;
$$;
revoke all on function public.publish_game(uuid) from public;
revoke execute on function public.publish_game(uuid) from anon;
grant execute on function public.publish_game(uuid) to authenticated;
