-- KIIZU 021: eliminacion segura de juegos y ropa propios.
create or replace function public.delete_own_game(p_game_id uuid, p_confirmation text)
returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_confirmation <> 'ELIMINAR' then raise exception 'CONFIRMATION_REQUIRED'; end if;
 delete from public.games where id=p_game_id and creator_id=auth.uid();
 if not found then raise exception 'GAME_NOT_FOUND'; end if;
end; $$;
revoke all on function public.delete_own_game(uuid,text) from public;
grant execute on function public.delete_own_game(uuid,text) to authenticated;

create or replace function public.delete_own_clothing(p_clothing_id uuid, p_confirmation text)
returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_confirmation <> 'ELIMINAR' then raise exception 'CONFIRMATION_REQUIRED'; end if;
 delete from public.clothing_items where id=p_clothing_id and creator_id=auth.uid();
 if not found then raise exception 'CLOTHING_NOT_FOUND'; end if;
end; $$;
revoke all on function public.delete_own_clothing(uuid,text) from public;
grant execute on function public.delete_own_clothing(uuid,text) to authenticated;