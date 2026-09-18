-- KIIZU 019: public profiles and achievements
alter table public.profiles add column if not exists creator_points bigint not null default 0 check (creator_points >= 0);

drop policy if exists "public user achievements read" on public.user_achievements;
create policy "public user achievements read" on public.user_achievements for select using (true);
