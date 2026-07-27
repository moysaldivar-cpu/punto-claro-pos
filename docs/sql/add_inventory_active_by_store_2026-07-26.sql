-- Agrega un estado independiente por sucursal al inventario.
-- Permite retirar o reactivar un producto en una sucursal
-- sin borrar existencias, movimientos ni historial.
-- Fecha: 2026-07-26

alter table public.inventory
add column if not exists is_active boolean not null default true;

comment on column public.inventory.is_active is
'Indica si el producto está disponible en esta sucursal. No modifica products.active ni elimina historial.';