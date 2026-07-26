-- Respaldo de la función antes de corregir la diferencia física de cierre.
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
      coalesce(s.payment_usd, 0::numeric) as payment_usd,
      coalesce(cs.exchange_rate, 0::numeric) as exchange_rate

    from sales s

    left join cash_sessions cs
      on cs.id = s.cash_session_id

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

  cashier_totals as (
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

      coalesce(
        sum(
          (
            payment_cash
            + payment_card
            + (payment_usd * exchange_rate)
          ) * net_ratio
        ),
        0::numeric
      ) as total_received,

      count(*) filter (
        where net_total > 0
      )::integer as transactions

    from sale_net
    group by cashier
  )

  select
    cashier,
    total_sales,
    total_cash,
    total_card,
    total_usd,

    round(
      total_sales - total_received,
      2
    ) as difference,

    transactions

  from cashier_totals

  where total_sales > 0

  order by total_sales desc;
$function$;