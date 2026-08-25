BEGIN;

CREATE TEMP TABLE auth_link_map (
  nombre text PRIMARY KEY,
  email text NOT NULL UNIQUE
) ON COMMIT DROP;

INSERT INTO auth_link_map (nombre, email) VALUES
  ('Administrador', 'administrador@punto-claro-pos.example.com'),
  ('CARMEN A',      'carmen.a@punto-claro-pos.example.com'),
  ('CARMEN M',      'carmen.m@punto-claro-pos.example.com'),
  ('GUADALUPE',     'guadalupe@punto-claro-pos.example.com'),
  ('JOSELIM',       'joselim@punto-claro-pos.example.com'),
  ('KAREN',         'karen@punto-claro-pos.example.com'),
  ('LUPITA',        'lupita@punto-claro-pos.example.com'),
  ('PAULINA',       'paulina@punto-claro-pos.example.com'),
  ('PROVISIONAL',   'provisional@punto-claro-pos.example.com'),
  ('PROVISIONAL2',  'provisional2@punto-claro-pos.example.com'),
  ('SUBGERENCIA',   'subgerencia@punto-claro-pos.example.com');

DO $$
BEGIN
  IF (
    SELECT count(*)
    FROM auth_link_map m
    JOIN auth.users u ON lower(u.email) = lower(m.email)
  ) <> 11 THEN
    RAISE EXCEPTION 'Expected 11 matching auth.users accounts';
  END IF;

  IF (
    SELECT count(*)
    FROM public.pos_users pu
    JOIN auth_link_map m ON m.nombre = pu.nombre
  ) <> 14 THEN
    RAISE EXCEPTION 'Expected 14 matching pos_users rows';
  END IF;

  IF (
    SELECT count(*)
    FROM public.pos_users
    WHERE auth_user_id IS NOT NULL
  ) <> 0 THEN
    RAISE EXCEPTION 'Expected all pos_users.auth_user_id values to be NULL before linking';
  END IF;
END
$$;

UPDATE public.pos_users pu
SET auth_user_id = u.id
FROM auth_link_map m
JOIN auth.users u ON lower(u.email) = lower(m.email)
WHERE pu.nombre = m.nombre;

DO $$
BEGIN
  IF (
    SELECT count(*)
    FROM public.pos_users
    WHERE auth_user_id IS NOT NULL
  ) <> 14 THEN
    RAISE EXCEPTION 'Expected 14 linked pos_users rows after update';
  END IF;

  IF (
    SELECT count(*)
    FROM public.pos_users pu
    JOIN auth_link_map m ON m.nombre = pu.nombre
    JOIN auth.users u ON lower(u.email) = lower(m.email)
    WHERE pu.auth_user_id = u.id
  ) <> 14 THEN
    RAISE EXCEPTION 'One or more auth_user_id mappings are incorrect';
  END IF;
END
$$;

COMMIT;
