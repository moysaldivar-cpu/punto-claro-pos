BEGIN;

CREATE OR REPLACE FUNCTION public.resolve_pos_auth_email(p_nombre text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT lower(u.email)
  FROM public.pos_users pu
  JOIN auth.users u
    ON u.id = pu.auth_user_id
  WHERE lower(trim(pu.nombre)) = lower(trim(p_nombre))
    AND pu.activo = true
    AND u.email IS NOT NULL
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.resolve_pos_auth_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_pos_auth_email(text) TO anon, authenticated;


CREATE OR REPLACE FUNCTION public.get_current_pos_users()
RETURNS TABLE(
  id uuid,
  nombre text,
  rol text,
  store_id uuid,
  store_name text,
  is_active boolean,
  auto_print_ticket boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    pu.id,
    pu.nombre,
    pu.rol::text,
    pu.store_id,
    ps.name::text AS store_name,
    coalesce(ps.is_active, true) AS is_active,
    coalesce(ps.auto_print_ticket, false) AS auto_print_ticket
  FROM public.pos_users pu
  LEFT JOIN public.pos_stores ps
    ON ps.id = pu.store_id
  WHERE pu.auth_user_id = auth.uid()
    AND pu.activo = true
  ORDER BY ps.name NULLS LAST, pu.nombre;
$$;

REVOKE ALL ON FUNCTION public.get_current_pos_users() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_current_pos_users() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_current_pos_users() TO authenticated;


CREATE OR REPLACE FUNCTION public.get_current_pos_user_stores()
RETURNS TABLE(
  store_id uuid,
  store_name text,
  is_active boolean,
  auto_print_ticket boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT DISTINCT
    ps.id AS store_id,
    ps.name::text AS store_name,
    coalesce(ps.is_active, true) AS is_active,
    coalesce(ps.auto_print_ticket, false) AS auto_print_ticket
  FROM public.pos_users pu
  JOIN public.pos_user_stores pus
    ON pus.user_id = pu.id
  JOIN public.pos_stores ps
    ON ps.id = pus.store_id
  WHERE pu.auth_user_id = auth.uid()
    AND pu.activo = true
    AND pu.rol = 'gerente'
  ORDER BY store_name;
$$;

REVOKE ALL ON FUNCTION public.get_current_pos_user_stores() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_current_pos_user_stores() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_current_pos_user_stores() TO authenticated;

COMMIT;
