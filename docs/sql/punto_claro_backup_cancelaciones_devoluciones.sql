-- ============================================================================
-- Punto Claro / Beer Zone POS
-- Respaldo SQL - Módulo administrativo de Cancelaciones y Devoluciones
-- Fecha de generación: 2026-07-09
--
-- IMPORTANTE:
-- 1) Este archivo es un respaldo técnico/migración del módulo.
-- 2) NO lo ejecutes otra vez en producción sin revisar antes.
-- 3) Está pensado para versionarse en Git y tener documentado lo que se aplicó
--    en Supabase para cancelaciones, devoluciones, reportes netos y cierre neto.
-- 4) Las funciones usan SECURITY DEFINER porque las tablas de auditoría tienen RLS.
-- ============================================================================


-- ============================================================================
-- 1. EXTENSIONES NECESARIAS
-- ============================================================================

create extension if not exists pgcrypto;


-- ============================================================================
-- 2. COLUMNAS NUEVAS EN sales
-- ============================================================================

alter table public.sales
  add column if not exists status text not null default 'active',
  add column if not exists returned_total numeric not null default 0,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid,
  add column if not exists cancellation_reason text,
  add column if not exists last_adjustment_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sales_status_check'
      and conrelid = 'public.sales'::regclass
  ) then
    alter table public.sales
      add constraint sales_status_check
      check (status in ('active', 'cancelled', 'partially_returned', 'fully_returned'));
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sales_returned_total_nonnegative_check'
      and conrelid = 'public.sales'::regclass
  ) then
    alter table public.sales
      add constraint sales_returned_total_nonnegative_check
      check (returned_total >= 0);
  end if;
end;
$$;


-- ============================================================================
-- 3. TABLAS DE AUDITORÍA
-- ============================================================================

create table if not exists public.sale_adjustments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id),
  store_id uuid not null references public.pos_stores(id),
  original_cash_session_id uuid references public.cash_sessions(id),
  adjustment_cash_session_id uuid references public.cash_sessions(id),
  adjustment_type text not null,
  status text not null default 'applied',
  reason text not null,
  original_sale_total numeric not null default 0,
  total_refund_mxn numeric not null default 0,
  refund_cash_mxn numeric not null default 0,
  refund_card_mxn numeric not null default 0,
  refund_usd numeric not null default 0,
  created_by uuid not null,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sale_adjustments_adjustment_type_check'
      and conrelid = 'public.sale_adjustments'::regclass
  ) then
    alter table public.sale_adjustments
      add constraint sale_adjustments_adjustment_type_check
      check (adjustment_type in ('cancel_full', 'return_partial'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'sale_adjustments_status_check'
      and conrelid = 'public.sale_adjustments'::regclass
  ) then
    alter table public.sale_adjustments
      add constraint sale_adjustments_status_check
      check (status in ('applied', 'voided'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'sale_adjustments_reason_required_check'
      and conrelid = 'public.sale_adjustments'::regclass
  ) then
    alter table public.sale_adjustments
      add constraint sale_adjustments_reason_required_check
      check (length(trim(reason)) > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'sale_adjustments_amounts_nonnegative_check'
      and conrelid = 'public.sale_adjustments'::regclass
  ) then
    alter table public.sale_adjustments
      add constraint sale_adjustments_amounts_nonnegative_check
      check (
        original_sale_total >= 0
        and total_refund_mxn >= 0
        and refund_cash_mxn >= 0
        and refund_card_mxn >= 0
        and refund_usd >= 0
      );
  end if;
end;
$$;

create table if not exists public.sale_adjustment_items (
  id uuid primary key default gen_random_uuid(),
  adjustment_id uuid not null references public.sale_adjustments(id) on delete cascade,
  sale_item_id uuid not null references public.sales_items(id),
  product_id uuid not null references public.products(id),
  quantity integer not null,
  unit_price numeric not null default 0,
  subtotal numeric not null default 0,
  cost_at_sale numeric not null default 0,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sale_adjustment_items_quantity_positive_check'
      and conrelid = 'public.sale_adjustment_items'::regclass
  ) then
    alter table public.sale_adjustment_items
      add constraint sale_adjustment_items_quantity_positive_check
      check (quantity > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'sale_adjustment_items_amounts_nonnegative_check'
      and conrelid = 'public.sale_adjustment_items'::regclass
  ) then
    alter table public.sale_adjustment_items
      add constraint sale_adjustment_items_amounts_nonnegative_check
      check (unit_price >= 0 and subtotal >= 0 and cost_at_sale >= 0);
  end if;
end;
$$;

create unique index if not exists sale_adjustments_one_full_cancel_applied_idx
  on public.sale_adjustments (sale_id)
  where adjustment_type = 'cancel_full' and status = 'applied';

create index if not exists sale_adjustments_sale_id_idx
  on public.sale_adjustments (sale_id);

create index if not exists sale_adjustments_store_id_idx
  on public.sale_adjustments (store_id);

create index if not exists sale_adjustment_items_adjustment_id_idx
  on public.sale_adjustment_items (adjustment_id);

create index if not exists sale_adjustment_items_sale_item_id_idx
  on public.sale_adjustment_items (sale_item_id);

alter table public.sale_adjustments enable row level security;
alter table public.sale_adjustment_items enable row level security;


-- ============================================================================
-- 4. HELPERS INTERNOS
-- ============================================================================

create or replace function public.is_pos_admin(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean := false;
begin
  if p_user_id is null then
    return false;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'pos_users'
      and column_name = 'role'
  ) then
    execute
      'select exists(select 1 from public.pos_users where id = $1 and role = ''admin'')'
      into v_is_admin
      using p_user_id;
  elsif exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'pos_users'
      and column_name = 'rol'
  ) then
    execute
      'select exists(select 1 from public.pos_users where id = $1 and rol = ''admin'')'
      into v_is_admin
      using p_user_id;
  else
    v_is_admin := false;
  end if;

  return coalesce(v_is_admin, false);
end;
$$;

grant execute on function public.is_pos_admin(uuid) to anon, authenticated;

create or replace function public.adjust_inventory_in(
  p_store_id uuid,
  p_product_id uuid,
  p_quantity integer,
  p_reason text,
  p_admin_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_name text := 'Administrador';
  v_has_user_name boolean := false;
  v_has_created_by boolean := false;
begin
  if coalesce(p_quantity, 0) <= 0 then
    raise exception 'La cantidad a regresar al inventario debe ser mayor a cero';
  end if;

  select coalesce(name, 'Administrador')
  into v_admin_name
  from public.pos_users
  where id = p_admin_user_id
  limit 1;

  update public.inventory
  set stock = coalesce(stock, 0) + p_quantity
  where store_id = p_store_id
    and product_id = p_product_id;

  if not found then
    begin
      insert into public.inventory (store_id, product_id, stock)
      values (p_store_id, p_product_id, p_quantity);
    exception when unique_violation then
      update public.inventory
      set stock = coalesce(stock, 0) + p_quantity
      where store_id = p_store_id
        and product_id = p_product_id;
    end;
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'inventory_movements'
      and column_name = 'user_name'
  )
  into v_has_user_name;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'inventory_movements'
      and column_name = 'created_by'
  )
  into v_has_created_by;

  if v_has_user_name then
    execute
      'insert into public.inventory_movements
        (store_id, product_id, quantity, type, reason, user_name)
       values ($1, $2, $3, ''in'', $4, $5)'
      using p_store_id, p_product_id, p_quantity, p_reason, v_admin_name;
  elsif v_has_created_by then
    execute
      'insert into public.inventory_movements
        (store_id, product_id, quantity, type, reason, created_by)
       values ($1, $2, $3, ''in'', $4, $5)'
      using p_store_id, p_product_id, p_quantity, p_reason, p_admin_user_id;
  else
    execute
      'insert into public.inventory_movements
        (store_id, product_id, quantity, type, reason)
       values ($1, $2, $3, ''in'', $4)'
      using p_store_id, p_product_id, p_quantity, p_reason;
  end if;
end;
$$;

grant execute on function public.adjust_inventory_in(uuid, uuid, integer, text, uuid)
to anon, authenticated;


-- ============================================================================
-- 5. RPC: DETALLE DE VENTA PARA CANCELACIONES / DEVOLUCIONES
-- ============================================================================

create or replace function public.get_sale_adjustment_detail(p_sale_id uuid)
returns table (
  sale_id uuid,
  folio text,
  sale_created_at timestamptz,
  store_id uuid,
  store_name text,
  sale_status text,
  sale_total numeric,
  returned_total numeric,
  net_total numeric,
  payment_method text,
  payment_cash numeric,
  payment_card numeric,
  payment_usd numeric,
  cashier text,
  cash_session_id uuid,
  sale_item_id uuid,
  product_id uuid,
  product_name text,
  sku text,
  quantity_sold integer,
  quantity_returned integer,
  quantity_available integer,
  unit_price numeric,
  item_subtotal numeric,
  effective_unit_price numeric
)
language sql
security definer
set search_path = public
as $$
  with returned_items as (
    select
      sai.sale_item_id,
      sum(sai.quantity)::integer as quantity_returned
    from public.sale_adjustment_items sai
    join public.sale_adjustments sa on sa.id = sai.adjustment_id
    where sa.status = 'applied'
    group by sai.sale_item_id
  )
  select
    s.id as sale_id,
    s.folio::text as folio,
    s.created_at as sale_created_at,
    s.store_id,
    coalesce(ps.name, 'Sucursal')::text as store_name,
    coalesce(s.status, 'active')::text as sale_status,
    coalesce(s.total, 0::numeric) as sale_total,
    coalesce(s.returned_total, 0::numeric) as returned_total,
    case
      when coalesce(s.status, 'active') in ('cancelled', 'fully_returned') then 0::numeric
      else greatest(coalesce(s.total, 0::numeric) - coalesce(s.returned_total, 0::numeric), 0::numeric)
    end as net_total,
    coalesce(s.payment_method, 'cash')::text as payment_method,
    coalesce(s.payment_cash, 0::numeric) as payment_cash,
    coalesce(s.payment_card, 0::numeric) as payment_card,
    coalesce(s.payment_usd, 0::numeric) as payment_usd,
    coalesce(s.user_name, 'Cajero')::text as cashier,
    s.cash_session_id,
    si.id as sale_item_id,
    si.product_id,
    trim(coalesce(p.name, 'Producto'))::text as product_name,
    p.sku::text as sku,
    coalesce(si.quantity, 0)::integer as quantity_sold,
    coalesce(ri.quantity_returned, 0)::integer as quantity_returned,
    greatest(coalesce(si.quantity, 0) - coalesce(ri.quantity_returned, 0), 0)::integer as quantity_available,
    coalesce(si.unit_price, 0::numeric) as unit_price,
    coalesce(si.subtotal, coalesce(si.unit_price, 0::numeric) * coalesce(si.quantity, 0)::numeric, 0::numeric) as item_subtotal,
    case
      when coalesce(si.quantity, 0) > 0 then
        coalesce(si.subtotal, coalesce(si.unit_price, 0::numeric) * coalesce(si.quantity, 0)::numeric, 0::numeric)
        / si.quantity::numeric
      else coalesce(si.unit_price, 0::numeric)
    end as effective_unit_price
  from public.sales s
  join public.sales_items si on si.sale_id = s.id
  join public.products p on p.id = si.product_id
  left join public.pos_stores ps on ps.id = s.store_id
  left join returned_items ri on ri.sale_item_id = si.id
  where s.id = p_sale_id
  order by si.created_at nulls last, si.id;
$$;

grant execute on function public.get_sale_adjustment_detail(uuid) to anon, authenticated;


-- ============================================================================
-- 6. RPC: CANCELACIÓN COMPLETA
-- ============================================================================

create or replace function public.cancel_sale_full(
  p_sale_id uuid,
  p_admin_user_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale public.sales%rowtype;
  v_adjustment_id uuid;
  v_reason text := trim(coalesce(p_reason, ''));
  v_item record;
begin
  if not public.is_pos_admin(p_admin_user_id) then
    raise exception 'Solo un usuario administrador puede cancelar tickets';
  end if;

  if v_reason = '' then
    raise exception 'El motivo de cancelación es obligatorio';
  end if;

  select *
  into v_sale
  from public.sales
  where id = p_sale_id
  for update;

  if not found then
    raise exception 'Venta no encontrada';
  end if;

  if coalesce(v_sale.status, 'active') = 'cancelled' then
    raise exception 'Este ticket ya está cancelado';
  end if;

  if coalesce(v_sale.status, 'active') = 'fully_returned' then
    raise exception 'Este ticket ya está totalmente devuelto';
  end if;

  if coalesce(v_sale.status, 'active') = 'partially_returned'
     or coalesce(v_sale.returned_total, 0) > 0 then
    raise exception 'No se puede cancelar completo un ticket con devolución parcial previa';
  end if;

  if exists (
    select 1
    from public.sale_adjustments
    where sale_id = p_sale_id
      and adjustment_type = 'cancel_full'
      and status = 'applied'
  ) then
    raise exception 'Ya existe una cancelación aplicada para este ticket';
  end if;

  insert into public.sale_adjustments (
    sale_id,
    store_id,
    original_cash_session_id,
    adjustment_cash_session_id,
    adjustment_type,
    status,
    reason,
    original_sale_total,
    total_refund_mxn,
    refund_cash_mxn,
    refund_card_mxn,
    refund_usd,
    created_by
  )
  values (
    v_sale.id,
    v_sale.store_id,
    v_sale.cash_session_id,
    v_sale.cash_session_id,
    'cancel_full',
    'applied',
    v_reason,
    coalesce(v_sale.total, 0::numeric),
    coalesce(v_sale.total, 0::numeric),
    coalesce(v_sale.payment_cash, 0::numeric),
    coalesce(v_sale.payment_card, 0::numeric),
    coalesce(v_sale.payment_usd, 0::numeric),
    p_admin_user_id
  )
  returning id into v_adjustment_id;

  for v_item in
    select
      si.id as sale_item_id,
      si.product_id,
      coalesce(si.quantity, 0)::integer as quantity,
      case
        when coalesce(si.quantity, 0) > 0 then
          coalesce(si.subtotal, coalesce(si.unit_price, 0::numeric) * coalesce(si.quantity, 0)::numeric, 0::numeric)
          / si.quantity::numeric
        else coalesce(si.unit_price, 0::numeric)
      end as effective_unit_price,
      coalesce(si.subtotal, coalesce(si.unit_price, 0::numeric) * coalesce(si.quantity, 0)::numeric, 0::numeric) as item_subtotal,
      coalesce(si.cost_at_sale, p.cost, 0::numeric) as cost_at_sale,
      trim(coalesce(p.name, 'Producto')) as product_name
    from public.sales_items si
    join public.products p on p.id = si.product_id
    where si.sale_id = v_sale.id
  loop
    if v_item.quantity > 0 then
      insert into public.sale_adjustment_items (
        adjustment_id,
        sale_item_id,
        product_id,
        quantity,
        unit_price,
        subtotal,
        cost_at_sale
      )
      values (
        v_adjustment_id,
        v_item.sale_item_id,
        v_item.product_id,
        v_item.quantity,
        v_item.effective_unit_price,
        v_item.item_subtotal,
        v_item.cost_at_sale
      );

      perform public.adjust_inventory_in(
        v_sale.store_id,
        v_item.product_id,
        v_item.quantity,
        'Cancelación de ticket ' || coalesce(v_sale.folio, v_sale.id::text) || ': ' || v_reason,
        p_admin_user_id
      );
    end if;
  end loop;

  update public.sales
  set
    status = 'cancelled',
    returned_total = coalesce(total, 0::numeric),
    cancelled_at = now(),
    cancelled_by = p_admin_user_id,
    cancellation_reason = v_reason,
    last_adjustment_at = now()
  where id = v_sale.id;
end;
$$;

grant execute on function public.cancel_sale_full(uuid, uuid, text) to anon, authenticated;


-- ============================================================================
-- 7. RPC: DEVOLUCIÓN PARCIAL POR PRODUCTO
-- ============================================================================

create or replace function public.return_sale_items(
  p_sale_id uuid,
  p_admin_user_id uuid,
  p_reason text,
  p_items jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale public.sales%rowtype;
  v_adjustment_id uuid;
  v_reason text := trim(coalesce(p_reason, ''));
  v_total_refund numeric := 0;
  v_new_returned_total numeric := 0;
  v_status text := 'partially_returned';
  v_item record;
begin
  if not public.is_pos_admin(p_admin_user_id) then
    raise exception 'Solo un usuario administrador puede registrar devoluciones';
  end if;

  if v_reason = '' then
    raise exception 'El motivo de devolución es obligatorio';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Debes seleccionar al menos un producto para devolver';
  end if;

  select *
  into v_sale
  from public.sales
  where id = p_sale_id
  for update;

  if not found then
    raise exception 'Venta no encontrada';
  end if;

  if coalesce(v_sale.status, 'active') in ('cancelled', 'fully_returned') then
    raise exception 'No se pueden registrar devoluciones sobre un ticket cancelado o totalmente devuelto';
  end if;

  create temporary table if not exists tmp_return_sale_items (
    sale_item_id uuid,
    product_id uuid,
    quantity integer,
    unit_price numeric,
    subtotal numeric,
    cost_at_sale numeric
  ) on commit drop;

  truncate table tmp_return_sale_items;

  for v_item in
    with raw_items as (
      select
        (elem->>'sale_item_id')::uuid as sale_item_id,
        sum((elem->>'quantity')::integer) as quantity
      from jsonb_array_elements(p_items) elem
      group by (elem->>'sale_item_id')::uuid
    ),
    returned_items as (
      select
        sai.sale_item_id,
        sum(sai.quantity)::integer as quantity_returned
      from public.sale_adjustment_items sai
      join public.sale_adjustments sa on sa.id = sai.adjustment_id
      where sa.status = 'applied'
      group by sai.sale_item_id
    )
    select
      si.id as sale_item_id,
      si.product_id,
      ri.quantity::integer as requested_quantity,
      coalesce(si.quantity, 0)::integer as sold_quantity,
      coalesce(ret.quantity_returned, 0)::integer as already_returned,
      greatest(coalesce(si.quantity, 0) - coalesce(ret.quantity_returned, 0), 0)::integer as available_quantity,
      case
        when coalesce(si.quantity, 0) > 0 then
          coalesce(si.subtotal, coalesce(si.unit_price, 0::numeric) * coalesce(si.quantity, 0)::numeric, 0::numeric)
          / si.quantity::numeric
        else coalesce(si.unit_price, 0::numeric)
      end as effective_unit_price,
      coalesce(si.cost_at_sale, p.cost, 0::numeric) as cost_at_sale
    from raw_items ri
    join public.sales_items si on si.id = ri.sale_item_id
    join public.products p on p.id = si.product_id
    left join returned_items ret on ret.sale_item_id = si.id
    where si.sale_id = p_sale_id
  loop
    if v_item.requested_quantity <= 0 then
      raise exception 'La cantidad a devolver debe ser mayor a cero';
    end if;

    if v_item.requested_quantity > v_item.available_quantity then
      raise exception 'No se puede devolver más de lo disponible para un producto del ticket';
    end if;

    insert into tmp_return_sale_items (
      sale_item_id,
      product_id,
      quantity,
      unit_price,
      subtotal,
      cost_at_sale
    )
    values (
      v_item.sale_item_id,
      v_item.product_id,
      v_item.requested_quantity,
      v_item.effective_unit_price,
      round(v_item.effective_unit_price * v_item.requested_quantity::numeric, 2),
      v_item.cost_at_sale
    );

    v_total_refund := v_total_refund + round(v_item.effective_unit_price * v_item.requested_quantity::numeric, 2);
  end loop;

  if not exists (select 1 from tmp_return_sale_items) then
    raise exception 'No se encontraron productos válidos para devolver';
  end if;

  insert into public.sale_adjustments (
    sale_id,
    store_id,
    original_cash_session_id,
    adjustment_cash_session_id,
    adjustment_type,
    status,
    reason,
    original_sale_total,
    total_refund_mxn,
    refund_cash_mxn,
    refund_card_mxn,
    refund_usd,
    created_by
  )
  values (
    v_sale.id,
    v_sale.store_id,
    v_sale.cash_session_id,
    v_sale.cash_session_id,
    'return_partial',
    'applied',
    v_reason,
    coalesce(v_sale.total, 0::numeric),
    coalesce(v_total_refund, 0::numeric),
    0::numeric,
    0::numeric,
    0::numeric,
    p_admin_user_id
  )
  returning id into v_adjustment_id;

  insert into public.sale_adjustment_items (
    adjustment_id,
    sale_item_id,
    product_id,
    quantity,
    unit_price,
    subtotal,
    cost_at_sale
  )
  select
    v_adjustment_id,
    sale_item_id,
    product_id,
    quantity,
    unit_price,
    subtotal,
    cost_at_sale
  from tmp_return_sale_items;

  for v_item in
    select *
    from tmp_return_sale_items
  loop
    perform public.adjust_inventory_in(
      v_sale.store_id,
      v_item.product_id,
      v_item.quantity,
      'Devolución parcial de ticket ' || coalesce(v_sale.folio, v_sale.id::text) || ': ' || v_reason,
      p_admin_user_id
    );
  end loop;

  v_new_returned_total :=
    least(coalesce(v_sale.total, 0::numeric), coalesce(v_sale.returned_total, 0::numeric) + coalesce(v_total_refund, 0::numeric));

  if v_new_returned_total >= coalesce(v_sale.total, 0::numeric) then
    v_status := 'fully_returned';
  else
    v_status := 'partially_returned';
  end if;

  update public.sales
  set
    returned_total = v_new_returned_total,
    status = v_status,
    last_adjustment_at = now()
  where id = v_sale.id;
end;
$$;

grant execute on function public.return_sale_items(uuid, uuid, text, jsonb) to anon, authenticated;


-- ============================================================================
-- 8. VISTAS DE REPORTES NETOS
-- ============================================================================

create or replace view public.report_sales_by_product as
with returned_items as (
  select
    sai.sale_item_id,
    sum(sai.quantity)::numeric as quantity_returned
  from public.sale_adjustment_items sai
  join public.sale_adjustments sa on sa.id = sai.adjustment_id
  where sa.status = 'applied'
  group by sai.sale_item_id
),
line_items as (
  select
    p.id as product_id,
    trim(coalesce(p.name, 'Producto')) as product_name,
    case
      when coalesce(s.status, 'active') in ('cancelled', 'fully_returned') then 0::numeric
      else greatest(coalesce(si.quantity, 0)::numeric - coalesce(ri.quantity_returned, 0), 0)
    end as net_quantity,
    case
      when coalesce(si.quantity, 0) > 0 then
        coalesce(si.subtotal, 0::numeric) / si.quantity::numeric
      else coalesce(si.unit_price, 0::numeric)
    end as effective_unit_price,
    coalesce(si.cost_at_sale, p.cost, 0::numeric) as effective_cost
  from public.sales_items si
  join public.sales s on s.id = si.sale_id
  join public.products p on p.id = si.product_id
  left join returned_items ri on ri.sale_item_id = si.id
)
select
  product_id,
  product_name,
  sum(net_quantity) as quantity_sold,
  sum(net_quantity * effective_unit_price) as total_sales,
  sum(net_quantity * effective_cost) as total_cost,
  sum((effective_unit_price - effective_cost) * net_quantity) as profit
from line_items
group by product_id, product_name
having sum(net_quantity) > 0
order by sum(net_quantity * effective_unit_price) desc;

create or replace view public.report_sales_by_store as
with sale_net as (
  select
    s.store_id,
    case
      when coalesce(s.status, 'active') in ('cancelled', 'fully_returned') then 0::numeric
      else greatest(coalesce(s.total, 0::numeric) - coalesce(s.returned_total, 0::numeric), 0::numeric)
    end as net_total,
    case
      when coalesce(s.status, 'active') in ('cancelled', 'fully_returned') then 0::numeric
      when coalesce(s.total, 0::numeric) > 0 then
        greatest(coalesce(s.total, 0::numeric) - coalesce(s.returned_total, 0::numeric), 0::numeric)
        / coalesce(s.total, 0::numeric)
      else 0::numeric
    end as net_ratio,
    coalesce(s.payment_cash, 0::numeric) as payment_cash,
    coalesce(s.payment_card, 0::numeric) as payment_card,
    coalesce(s.payment_usd, 0::numeric) as payment_usd
  from public.sales s
)
select
  ps.id as store_id,
  trim(coalesce(ps.name, 'Sucursal')) as store_name,
  coalesce(sum(sn.net_total), 0::numeric) as total_sales,
  coalesce(sum(sn.payment_cash * sn.net_ratio), 0::numeric) as total_cash,
  coalesce(sum(sn.payment_card * sn.net_ratio), 0::numeric) as total_card,
  coalesce(sum(sn.payment_usd * sn.net_ratio), 0::numeric) as total_usd
from sale_net sn
join public.pos_stores ps on ps.id = sn.store_id
group by ps.id, ps.name
having coalesce(sum(sn.net_total), 0::numeric) > 0
order by coalesce(sum(sn.net_total), 0::numeric) desc;

create or replace view public.report_sales_by_cashier as
with sale_net as (
  select
    coalesce(nullif(trim(s.user_name), ''), 'Sin nombre') as cashier,
    case
      when coalesce(s.status, 'active') in ('cancelled', 'fully_returned') then 0::numeric
      else greatest(coalesce(s.total, 0::numeric) - coalesce(s.returned_total, 0::numeric), 0::numeric)
    end as net_total,
    case
      when coalesce(s.status, 'active') in ('cancelled', 'fully_returned') then 0::numeric
      when coalesce(s.total, 0::numeric) > 0 then
        greatest(coalesce(s.total, 0::numeric) - coalesce(s.returned_total, 0::numeric), 0::numeric)
        / coalesce(s.total, 0::numeric)
      else 0::numeric
    end as net_ratio,
    coalesce(s.payment_cash, 0::numeric) as payment_cash,
    coalesce(s.payment_card, 0::numeric) as payment_card,
    coalesce(s.payment_usd, 0::numeric) as payment_usd
  from public.sales s
)
select
  cashier,
  coalesce(sum(net_total), 0::numeric) as total_sales,
  coalesce(sum(payment_cash * net_ratio), 0::numeric) as total_cash,
  coalesce(sum(payment_card * net_ratio), 0::numeric) as total_card,
  coalesce(sum(payment_usd * net_ratio), 0::numeric) as total_usd,
  count(*) filter (where net_total > 0)::integer as transactions
from sale_net
group by cashier
having coalesce(sum(net_total), 0::numeric) > 0
order by coalesce(sum(net_total), 0::numeric) desc;

create or replace view public.report_sales_by_day_store as
with sale_net as (
  select
    date_trunc('day', s.created_at)::date as sale_date,
    s.store_id,
    case
      when coalesce(s.status, 'active') in ('cancelled', 'fully_returned') then 0::numeric
      else greatest(coalesce(s.total, 0::numeric) - coalesce(s.returned_total, 0::numeric), 0::numeric)
    end as net_total,
    case
      when coalesce(s.status, 'active') in ('cancelled', 'fully_returned') then 0::numeric
      when coalesce(s.total, 0::numeric) > 0 then
        greatest(coalesce(s.total, 0::numeric) - coalesce(s.returned_total, 0::numeric), 0::numeric)
        / coalesce(s.total, 0::numeric)
      else 0::numeric
    end as net_ratio,
    coalesce(s.payment_cash, 0::numeric) as payment_cash,
    coalesce(s.payment_card, 0::numeric) as payment_card,
    coalesce(s.payment_usd, 0::numeric) as payment_usd
  from public.sales s
)
select
  sale_date,
  ps.id as store_id,
  trim(coalesce(ps.name, 'Sucursal')) as store_name,
  coalesce(sum(sn.net_total), 0::numeric) as total_sales,
  coalesce(sum(sn.payment_cash * sn.net_ratio), 0::numeric) as total_cash,
  coalesce(sum(sn.payment_card * sn.net_ratio), 0::numeric) as total_card,
  coalesce(sum(sn.payment_usd * sn.net_ratio), 0::numeric) as total_usd,
  count(*) filter (where sn.net_total > 0)::integer as transactions
from sale_net sn
join public.pos_stores ps on ps.id = sn.store_id
group by sale_date, ps.id, ps.name
having coalesce(sum(sn.net_total), 0::numeric) > 0
order by sale_date desc, coalesce(sum(sn.net_total), 0::numeric) desc;


-- ============================================================================
-- 9. RPCs DE REPORTES FILTRADOS PARA Reports.tsx
-- ============================================================================

drop function if exists public.get_report_sales_by_product_filtered(timestamptz, timestamptz, uuid, text);
drop function if exists public.get_report_sales_by_store_filtered(timestamptz, timestamptz, uuid, text);
drop function if exists public.get_report_sales_by_cashier_filtered(timestamptz, timestamptz, uuid, text);

create or replace function public.get_report_sales_by_product_filtered(
  p_from timestamptz,
  p_to timestamptz,
  p_store_id uuid default null,
  p_cashier text default null
)
returns table (
  product_id uuid,
  product_name text,
  quantity_sold numeric,
  total_sales numeric,
  total_cost numeric,
  profit numeric
)
language sql
security definer
set search_path = public
as $$
  with returned_items as (
    select
      sai.sale_item_id,
      sum(sai.quantity)::numeric as quantity_returned
    from sale_adjustment_items sai
    join sale_adjustments sa on sa.id = sai.adjustment_id
    where sa.status = 'applied'
    group by sai.sale_item_id
  ),
  line_items as (
    select
      p.id as product_id,
      trim(coalesce(p.name, 'Producto')) as product_name,
      case
        when coalesce(s.status, 'active') in ('cancelled', 'fully_returned') then 0::numeric
        else greatest(coalesce(si.quantity, 0)::numeric - coalesce(ri.quantity_returned, 0), 0)
      end as net_quantity,
      case
        when coalesce(si.quantity, 0) > 0 then coalesce(si.subtotal, 0::numeric) / si.quantity::numeric
        else coalesce(si.unit_price, 0::numeric)
      end as effective_unit_price,
      coalesce(si.cost_at_sale, p.cost, 0::numeric) as effective_cost
    from sales_items si
    join sales s on s.id = si.sale_id
    join products p on p.id = si.product_id
    left join returned_items ri on ri.sale_item_id = si.id
    where s.created_at >= p_from
      and s.created_at <= p_to
      and (p_store_id is null or s.store_id = p_store_id)
      and (
        p_cashier is null
        or trim(coalesce(s.user_name, '')) = trim(p_cashier)
      )
  )
  select
    product_id,
    product_name,
    sum(net_quantity) as quantity_sold,
    sum(net_quantity * effective_unit_price) as total_sales,
    sum(net_quantity * effective_cost) as total_cost,
    sum((effective_unit_price - effective_cost) * net_quantity) as profit
  from line_items
  group by product_id, product_name
  having sum(net_quantity) > 0
  order by sum(net_quantity * effective_unit_price) desc;
$$;

create or replace function public.get_report_sales_by_store_filtered(
  p_from timestamptz,
  p_to timestamptz,
  p_store_id uuid default null,
  p_cashier text default null
)
returns table (
  store_id uuid,
  store_name text,
  total_sales numeric,
  total_cash numeric,
  total_card numeric,
  total_usd numeric
)
language sql
security definer
set search_path = public
as $$
  with sale_net as (
    select
      s.id,
      s.store_id,
      case
        when coalesce(s.status, 'active') in ('cancelled', 'fully_returned') then 0::numeric
        else greatest(coalesce(s.total, 0::numeric) - coalesce(s.returned_total, 0::numeric), 0::numeric)
      end as net_total,
      case
        when coalesce(s.status, 'active') in ('cancelled', 'fully_returned') then 0::numeric
        when coalesce(s.total, 0::numeric) > 0 then
          greatest(coalesce(s.total, 0::numeric) - coalesce(s.returned_total, 0::numeric), 0::numeric)
          / coalesce(s.total, 0::numeric)
        else 0::numeric
      end as net_ratio,
      coalesce(s.payment_cash, 0::numeric) as payment_cash,
      coalesce(s.payment_card, 0::numeric) as payment_card,
      coalesce(s.payment_usd, 0::numeric) as payment_usd
    from sales s
    where s.created_at >= p_from
      and s.created_at <= p_to
      and (p_store_id is null or s.store_id = p_store_id)
      and (
        p_cashier is null
        or trim(coalesce(s.user_name, '')) = trim(p_cashier)
      )
  )
  select
    ps.id as store_id,
    trim(coalesce(ps.name, 'Sucursal')) as store_name,
    coalesce(sum(sn.net_total), 0::numeric) as total_sales,
    coalesce(sum(sn.payment_cash * sn.net_ratio), 0::numeric) as total_cash,
    coalesce(sum(sn.payment_card * sn.net_ratio), 0::numeric) as total_card,
    coalesce(sum(sn.payment_usd * sn.net_ratio), 0::numeric) as total_usd
  from sale_net sn
  join pos_stores ps on ps.id = sn.store_id
  group by ps.id, ps.name
  having coalesce(sum(sn.net_total), 0::numeric) > 0
  order by coalesce(sum(sn.net_total), 0::numeric) desc;
$$;

create or replace function public.get_report_sales_by_cashier_filtered(
  p_from timestamptz,
  p_to timestamptz,
  p_store_id uuid default null,
  p_cashier text default null
)
returns table (
  cashier text,
  total_sales numeric,
  total_cash numeric,
  total_card numeric,
  total_usd numeric,
  transactions integer
)
language sql
security definer
set search_path = public
as $$
  with sale_net as (
    select
      coalesce(nullif(trim(s.user_name), ''), 'Sin nombre') as cashier,
      case
        when coalesce(s.status, 'active') in ('cancelled', 'fully_returned') then 0::numeric
        else greatest(coalesce(s.total, 0::numeric) - coalesce(s.returned_total, 0::numeric), 0::numeric)
      end as net_total,
      case
        when coalesce(s.status, 'active') in ('cancelled', 'fully_returned') then 0::numeric
        when coalesce(s.total, 0::numeric) > 0 then
          greatest(coalesce(s.total, 0::numeric) - coalesce(s.returned_total, 0::numeric), 0::numeric)
          / coalesce(s.total, 0::numeric)
        else 0::numeric
      end as net_ratio,
      coalesce(s.payment_cash, 0::numeric) as payment_cash,
      coalesce(s.payment_card, 0::numeric) as payment_card,
      coalesce(s.payment_usd, 0::numeric) as payment_usd
    from sales s
    where s.created_at >= p_from
      and s.created_at <= p_to
      and (p_store_id is null or s.store_id = p_store_id)
      and (
        p_cashier is null
        or trim(coalesce(s.user_name, '')) = trim(p_cashier)
      )
  )
  select
    cashier,
    coalesce(sum(net_total), 0::numeric) as total_sales,
    coalesce(sum(payment_cash * net_ratio), 0::numeric) as total_cash,
    coalesce(sum(payment_card * net_ratio), 0::numeric) as total_card,
    coalesce(sum(payment_usd * net_ratio), 0::numeric) as total_usd,
    count(*) filter (where net_total > 0)::integer as transactions
  from sale_net
  group by cashier
  having coalesce(sum(net_total), 0::numeric) > 0
  order by coalesce(sum(net_total), 0::numeric) desc;
$$;

grant execute on function public.get_report_sales_by_product_filtered(timestamptz, timestamptz, uuid, text) to anon, authenticated;
grant execute on function public.get_report_sales_by_store_filtered(timestamptz, timestamptz, uuid, text) to anon, authenticated;
grant execute on function public.get_report_sales_by_cashier_filtered(timestamptz, timestamptz, uuid, text) to anon, authenticated;


-- ============================================================================
-- 10. CIERRE DE CAJA NETO
-- ============================================================================

create or replace function public.get_cash_session_totals(p_session_id uuid)
returns table(
  total_cash_mxn numeric,
  total_card_mxn numeric,
  total_usd numeric,
  total_general_mxn numeric
)
language plpgsql
security definer
set search_path = public
as $function$
begin
  return query
  with sales_net as (
    select
      s.id,
      s.cash_session_id,

      case
        when coalesce(s.status, 'active') in ('cancelled', 'fully_returned') then 0::numeric
        else greatest(
          coalesce(s.total, 0::numeric) - coalesce(s.returned_total, 0::numeric),
          0::numeric
        )
      end as net_total_mxn,

      case
        when coalesce(s.status, 'active') in ('cancelled', 'fully_returned') then 0::numeric
        when coalesce(s.total, 0::numeric) > 0 then
          greatest(
            coalesce(s.total, 0::numeric) - coalesce(s.returned_total, 0::numeric),
            0::numeric
          ) / coalesce(s.total, 0::numeric)
        else 0::numeric
      end as net_ratio,

      coalesce(s.payment_cash, 0::numeric) as payment_cash_mxn,
      coalesce(s.payment_card, 0::numeric) as payment_card_mxn,
      coalesce(s.payment_usd, 0::numeric) as payment_usd
    from sales s
    where s.cash_session_id = p_session_id
  ),
  sales_totals as (
    select
      coalesce(sum(payment_cash_mxn * net_ratio), 0::numeric) as sales_cash_mxn,
      coalesce(sum(payment_card_mxn * net_ratio), 0::numeric) as sales_card_mxn,
      coalesce(sum(payment_usd * net_ratio), 0::numeric) as sales_usd,
      coalesce(sum(net_total_mxn), 0::numeric) as sales_general_mxn
    from sales_net
  ),
  withdrawal_totals as (
    select
      coalesce(sum(amount), 0::numeric) as withdrawn_cash_mxn
    from cash_withdrawals
    where cash_session_id = p_session_id
  )
  select
    greatest(
      0::numeric,
      sales_totals.sales_cash_mxn - withdrawal_totals.withdrawn_cash_mxn
    ) as total_cash_mxn,

    sales_totals.sales_card_mxn as total_card_mxn,

    sales_totals.sales_usd as total_usd,

    greatest(
      0::numeric,
      sales_totals.sales_general_mxn - withdrawal_totals.withdrawn_cash_mxn
    ) as total_general_mxn
  from sales_totals, withdrawal_totals;
end;
$function$;

grant execute on function public.get_cash_session_totals(uuid) to anon, authenticated;


-- ============================================================================
-- 11. CONSULTAS DE VALIDACIÓN RÁPIDA
-- ============================================================================

-- Validar funciones principales:
-- select
--   proname as function_name
-- from pg_proc
-- where pronamespace = 'public'::regnamespace
--   and proname in (
--     'get_sale_adjustment_detail',
--     'cancel_sale_full',
--     'return_sale_items',
--     'get_report_sales_by_product_filtered',
--     'get_report_sales_by_store_filtered',
--     'get_report_sales_by_cashier_filtered',
--     'get_cash_session_totals'
--   )
-- order by proname;

-- Validar ventas netas de tickets de prueba:
-- select
--   folio,
--   status,
--   total as total_original,
--   returned_total as total_devuelto,
--   case
--     when status in ('cancelled', 'fully_returned') then 0
--     else greatest(coalesce(total, 0) - coalesce(returned_total, 0), 0)
--   end as total_neto
-- from sales
-- where folio in ('202D-000091', '202D-000083')
-- order by folio;

-- Validar reporte por producto:
-- select
--   product_name,
--   quantity_sold,
--   total_sales,
--   total_cost,
--   profit
-- from public.get_report_sales_by_product_filtered(
--   '2026-01-01 00:00:00-05'::timestamptz,
--   '2026-12-31 23:59:59-05'::timestamptz,
--   null::uuid,
--   null::text
-- )
-- where product_name in ('XX Laton', 'Axion 280')
-- order by product_name;


-- ============================================================================
-- FIN DEL RESPALDO
-- ============================================================================
