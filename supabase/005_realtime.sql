-- Realtime publication for live social and match state.
do $$
begin
  begin alter publication supabase_realtime add table public.matches; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.match_players; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.messages; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.profiles; exception when duplicate_object then null; end;
end $$;

alter table public.matches replica identity full;
alter table public.match_players replica identity full;
alter table public.messages replica identity full;
