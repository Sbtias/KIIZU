-- KIIZU 012: reports for user-created clothing and games.
alter table public.reports add column if not exists clothing_id uuid references public.clothing_items(id) on delete set null;
alter table public.reports add column if not exists game_id uuid references public.games(id) on delete set null;
alter table public.reports add constraint reports_target_check check (
  message_id is not null or reported_user_id is not null or clothing_id is not null or game_id is not null
);
create index if not exists idx_reports_clothing on public.reports(clothing_id);
create index if not exists idx_reports_game on public.reports(game_id);

create or replace function public.report_content(p_reason text,p_clothing_id uuid default null,p_game_id uuid default null,p_reported_user_id uuid default null)
returns bigint language plpgsql security definer set search_path=public as $$
declare caller uuid:=auth.uid(); rid bigint;
begin
 if caller is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_reason not in ('Contenido inapropiado','Spam','Copia','Otro') then raise exception 'INVALID_REASON'; end if;
 if p_clothing_id is null and p_game_id is null and p_reported_user_id is null then raise exception 'NO_TARGET'; end if;
 insert into reports(reporter_id,reported_user_id,reason,clothing_id,game_id)
 values(caller,p_reported_user_id,left(p_reason,100),p_clothing_id,p_game_id) returning id into rid;
 return rid;
end; $$;
revoke all on function public.report_content(text,uuid,uuid,uuid) from public;
grant execute on function public.report_content(text,uuid,uuid,uuid) to authenticated;
