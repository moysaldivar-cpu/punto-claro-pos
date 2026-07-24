-- CORRECCIÓN DEL CIERRE DE CAJA
-- Fecha: 23 de julio de 2026
--
-- Cambios:
-- 1. El efectivo esperado incluye el fondo inicial.
-- 2. Los retiros se descuentan del efectivo generado por ventas.
-- 3. cash_sessions.difference guarda la diferencia de efectivo físico:
--    efectivo declarado - efectivo esperado.

CREATE OR REPLACE FUNCTION public.get_cash_session_totals(p_session_id uuid)
RETURNS TABLE(
  total_cash_mxn numeric,
  total_card_mxn numeric,
  total_usd numeric,
  total_general_mxn numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  return query
  with session_data as (
    select
      coalesce(cs.opening_amount, 0::numeric) as opening_amount
    from cash_sessions cs
    where cs.id = p_session_id
  ),
  sales_net as (
    select
      case
        when coalesce(s.status, 'active') in ('cancelled', 'fully_returned')
          then 0::numeric
        else greatest(
          coalesce(s.total, 0::numeric)
          - coalesce(s.returned_total, 0::numeric),
          0::numeric
        )
      end as net_total_mxn,

      case
        when coalesce(s.status, 'active') in ('cancelled', 'fully_returned')
          then 0::numeric
        when coalesce(s.total, 0::numeric) > 0
          then greatest(
            coalesce(s.total, 0::numeric)
            - coalesce(s.returned_total, 0::numeric),
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
      coalesce(
        sum(payment_cash_mxn * net_ratio),
        0::numeric
      ) as sales_cash_mxn,

      coalesce(
        sum(payment_card_mxn * net_ratio),
        0::numeric
      ) as sales_card_mxn,

      coalesce(
        sum(payment_usd * net_ratio),
        0::numeric
      ) as sales_usd,

      coalesce(
        sum(net_total_mxn),
        0::numeric
      ) as sales_general_mxn

    from sales_net
  ),
  withdrawal_totals as (
    select
      coalesce(sum(cw.amount), 0::numeric) as withdrawn_cash_mxn
    from cash_withdrawals cw
    where cw.cash_session_id = p_session_id
  )
  select
    session_data.opening_amount
    + greatest(
        0::numeric,
        sales_totals.sales_cash_mxn
        - withdrawal_totals.withdrawn_cash_mxn
      ) as total_cash_mxn,

    sales_totals.sales_card_mxn as total_card_mxn,

    sales_totals.sales_usd as total_usd,

    session_data.opening_amount
    + greatest(
        0::numeric,
        sales_totals.sales_general_mxn
        - withdrawal_totals.withdrawn_cash_mxn
      ) as total_general_mxn

  from session_data, sales_totals, withdrawal_totals;
end;
$function$;


CREATE OR REPLACE FUNCTION public.close_cash_session(
  p_session_id uuid,
  p_real_cash numeric,
  p_real_card numeric,
  p_real_usd numeric
)
RETURNS void
LANGUAGE plpgsql
AS $function$
declare
  v_total_cash_mxn numeric;
  v_difference numeric;
begin
  if not exists (
    select 1
    from cash_sessions
    where id = p_session_id
      and status = 'open'
  ) then
    raise exception 'La sesión no está abierta o no existe';
  end if;

  select totals.total_cash_mxn
  into v_total_cash_mxn
  from get_cash_session_totals(p_session_id) totals;

  v_difference := round(
    coalesce(p_real_cash, 0::numeric)
    - coalesce(v_total_cash_mxn, 0::numeric),
    2
  );

  update cash_sessions
  set
    real_cash = p_real_cash,
    real_card = p_real_card,
    real_usd = p_real_usd,
    difference = v_difference,
    closed_at = now(),
    status = 'closed'
  where id = p_session_id;
end;
$function$;
