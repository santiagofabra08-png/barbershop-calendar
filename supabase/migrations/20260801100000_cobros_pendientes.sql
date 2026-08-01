-- ============================================================================
-- LOS QUE QUEDARON SIN COBRAR
-- ============================================================================
-- Un turno que nadie cobró ayer no aparece en la pantalla de hoy, y su plata no
-- entra al balance nunca. Es el mismo agujero silencioso que el "no vino": algo
-- que se olvida una vez y no vuelve a pedir nada.
--
-- Esta función cuenta lo que quedó atrás para poder avisarlo arriba de la
-- pantalla. Va como función y no como consulta directa porque un barbero solo
-- ve sus propios turnos: sin esto contaría los suyos y creería que está al día
-- mientras los de su compañero se pierden.
-- ============================================================================

begin;

create or replace function public.cobros_pendientes(p_tenant_slug text)
returns table (cantidad bigint, desde date)
language sql
stable
security definer
set search_path = ''
as $$
  select
    count(*),
    min((a.starts_at at time zone t.timezone)::date)
  from public.appointments a
  join public.tenants t on t.id = a.tenant_id
  where t.slug = p_tenant_slug
    and app.is_member_of(t.id)
    and a.kind = 'booking'
    and a.status = 'confirmed'
    and a.charged_at is null
    -- Solo lo que ya pasó: un turno de mañana no está "pendiente de cobro",
    -- está esperando que llegue el cliente.
    and (a.starts_at at time zone t.timezone)::date
        < (now() at time zone t.timezone)::date;
$$;

revoke execute on function public.cobros_pendientes(text) from public;
grant execute on function public.cobros_pendientes(text) to authenticated;

commit;
