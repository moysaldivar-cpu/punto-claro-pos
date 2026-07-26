-- Corrige el reporte por cajero para mostrar la diferencia física real
-- registrada al cerrar caja.
-- Fecha: 2026-07-26

CREATE OR REPLACE FUNCTION public.get_report_sales_by_cashier_filtered(
  p_from timestamp with time zone,
  p_to timestamp with time zone,
  p_store_id uuid DEFAULT NULL::uuid,
  p_cashier text DEFAULT NULL::text
)
RETURNS TABLE(
  cashier text,
  total_sales numeric,
  total_cash numeric,
  total_card numeric,
  total_usd numeric,
  difference numeric,
  transactions integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$

  with sale_net as (
    select
      coalesce(
        nullif(trim(s.user_name), ''),
        'Sin nombre'
      ) as cashier,

      case
        when coalesce(s.status, 'active') in (
          'cancelled',
          'fully_returned'
        )
          then 0::numeric

        else greatest(
          coalesce(s.total, 0::numeric)
          - coalesce(s.returned_total, 0::numeric),
          0::numeric
        )
      end as net_total,

      case
        when coalesce(s.status, 'active') in (
          'cancelled',
          'fully_returned'
        )
          then 0::numeric

        when coalesce(s.total, 0::numeric) > 0
          then greatest(
            coalesce(s.total, 0::numeric)
            - coalesce(s.returned_total, 0::numeric),
            0::numeric
          ) / coalesce(s.total, 0::numeric)

        else 0::numeric
      end as net_ratio,

      coalesce(s.payment_cash, 0::numeric) as payment_cash,
      coalesce(s.payment_card, 0::numeric) as payment_card,
      coalesce(s.payment_usd, 0::numeric) as payment_usd

    from sales s

    where s.created_at >= p_from
      and s.created_at <= p_to

      and (
        p_store_id is null
        or s.store_id = p_store_id
      )

      and (
        p_cashier is null
        or trim(coalesce(s.user_name, '')) = trim(p_cashier)
      )
  ),

  cashier_sales as (
    select
      cashier,

      coalesce(
        sum(net_total),
        0::numeric
      ) as total_sales,

      coalesce(
        sum(payment_cash * net_ratio),
        0::numeric
      ) as total_cash,

      coalesce(
        sum(payment_card * net_ratio),
        0::numeric
      ) as total_card,

      coalesce(
        sum(payment_usd * net_ratio),
        0::numeric
      ) as total_usd,

      count(*) filter (
        where net_total > 0
      )::integer as transactions

    from sale_net

    group by cashier
  ),

  cashier_closings as (
    select
      coalesce(
        nullif(trim(pu.nombre), ''),
        'Sin nombre'
      ) as cashier,

      coalesce(
        sum(cs.difference),
        0::numeric
      ) as physical_difference

    from cash_sessions cs

    left join pos_users pu
      on pu.id = cs.opened_by

    where cs.status = 'closed'
      and cs.closed_at is not null
      and cs.closed_at >= p_from
      and cs.closed_at <= p_to

      and (
        p_store_id is null
        or cs.store_id = p_store_id
      )

      and (
        p_cashier is null
        or trim(coalesce(pu.nombre, '')) = trim(p_cashier)
      )

    group by
      coalesce(
        nullif(trim(pu.nombre), ''),
        'Sin nombre'
      )
  ),

  combined as (
    select
      coalesce(s.cashier, c.cashier) as cashier,

      coalesce(
        s.total_sales,
        0::numeric
      ) as total_sales,

      coalesce(
        s.total_cash,
        0::numeric
      ) as total_cash,

      coalesce(
        s.total_card,
        0::numeric
      ) as total_card,

      coalesce(
        s.total_usd,
        0::numeric
      ) as total_usd,

      coalesce(
        c.physical_difference,
        0::numeric
      ) as physical_difference,

      coalesce(
        s.transactions,
        0
      )::integer as transactions

    from cashier_sales s

    full join cashier_closings c
      on lower(trim(c.cashier)) = lower(trim(s.cashier))
  )

  select
    cashier,
    total_sales,
    total_cash,
    total_card,
    total_usd,

    /*
      cash_sessions.difference:
      positivo = sobrante
      negativo = faltante

      El frontend actual interpreta:
      positivo = faltante
      negativo = sobrante

      Por eso se invierte el signo al devolver el resultado.
    */
    round(
      physical_difference * -1,
      2
    ) as difference,

    transactions

  from combined

  where total_sales > 0
     or physical_difference <> 0

  order by total_sales desc, cashier asc;

$function$;