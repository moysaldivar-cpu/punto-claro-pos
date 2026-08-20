-- Punto Claro POS
-- Seguridad / autenticacion - Fase 1
-- Fecha: 2026-08-20
--
-- Cambio aditivo solamente.
-- NO activa RLS.
-- NO revoca permisos.
-- NO modifica usuarios existentes.
-- NO cambia el login actual.
--
-- Prepara public.pos_users para vincular los usuarios del POS
-- con identidades reales de Supabase Auth.
--
-- auth_user_id NO es UNIQUE intencionalmente:
-- el login PROVISIONAL representa cuatro registros/sucursales
-- que compartirán una sola identidad autenticada.

alter table public.pos_users
add column if not exists auth_user_id uuid null;

comment on column public.pos_users.auth_user_id is
'Identidad correspondiente en auth.users. Puede repetirse para cuentas que representan varias sucursales, como PROVISIONAL.';

create index if not exists idx_pos_users_auth_user_id
on public.pos_users(auth_user_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'pos_users_auth_user_id_fkey'
      and conrelid = 'public.pos_users'::regclass
  ) then
    alter table public.pos_users
    add constraint pos_users_auth_user_id_fkey
    foreign key (auth_user_id)
    references auth.users(id)
    on delete restrict;
  end if;
end
$$;
