-- ============================================================================
-- EL TICKET MUESTRA CANTIDADES
-- ============================================================================
-- `turnos_para_cobrar` arma cada renglón con nombre y monto. Alcanzaba mientras
-- todo renglón era uno solo: un corte, una barba, un descuento.
--
-- Con productos adentro deja de alcanzar. "Cera $400" cuando en realidad se
-- llevó dos y pagó $800 no es un detalle de presentación: es un ticket que no
-- coincide con lo que se cobró, y quien revise el día no va a poder explicar la
-- diferencia.
--
-- La firma no cambia —`items` sigue siendo jsonb—, así que la pantalla vieja
-- seguiría funcionando aunque no lea el campo nuevo.
-- ============================================================================

begin;

create or replace function public.turnos_para_cobrar(
  p_tenant_slug text,
  p_fecha date
)
returns table (
  id uuid,
  barber_id uuid,
  barber_name text,
  hora text,
  status text,
  client_name text,
  service_name text,
  price_cents int,
  charged_at timestamptz,
  charged_total_cents int,
  payment_method text,
  items jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    a.id,
    a.barber_id,
    b.display_name,
    to_char(a.starts_at at time zone t.timezone, 'HH24:MI'),
    a.status,
    a.client_name,
    s.name,
    a.price_cents,
    a.charged_at,
    a.charged_total_cents,
    a.payment_method,
    coalesce(
      (
        select jsonb_agg(
                 jsonb_build_object(
                   'name', i.name,
                   'amount_cents', i.amount_cents,
                   'quantity', i.quantity
                 )
                 order by i.sort_order
               )
        from public.appointment_items i
        where i.appointment_id = a.id
      ),
      '[]'::jsonb
    )
  from public.appointments a
  join public.tenants t on t.id = a.tenant_id
  join public.barbers b on b.id = a.barber_id
  left join public.services s on s.id = a.service_id
  where t.slug = p_tenant_slug
    and app.is_member_of(t.id)
    and a.kind = 'booking'
    and a.status <> 'cancelled'
    and (a.starts_at at time zone t.timezone)::date = p_fecha
  order by a.starts_at, b.sort_order;
$$;

commit;
