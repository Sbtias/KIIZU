create table if not exists public.clothing_comments (
  id uuid primary key default gen_random_uuid(),
  clothing_id uuid not null references public.clothing_items(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists clothing_comments_clothing_id_created_at_idx
  on public.clothing_comments (clothing_id, created_at desc);

alter table public.clothing_comments enable row level security;

drop policy if exists "clothing_comments_select_published" on public.clothing_comments;
create policy "clothing_comments_select_published"
  on public.clothing_comments for select to authenticated
  using (exists (
    select 1 from public.clothing_items ci
    where ci.id = clothing_comments.clothing_id and ci.is_published = true
  ));

drop policy if exists "clothing_comments_insert_own" on public.clothing_comments;
create policy "clothing_comments_insert_own"
  on public.clothing_comments for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.clothing_items ci
      where ci.id = clothing_comments.clothing_id and ci.is_published = true
    )
  );

drop policy if exists "clothing_comments_delete_own" on public.clothing_comments;
create policy "clothing_comments_delete_own"
  on public.clothing_comments for delete to authenticated
  using (user_id = (select auth.uid()));

grant select, insert, delete on public.clothing_comments to authenticated;
