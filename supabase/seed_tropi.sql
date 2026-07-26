-- ============================================================================
-- DATOS DE TROPI BARBERSHOP
-- ============================================================================
-- Correr DESPUÉS de la migración del esquema.
--
-- Esto son DATOS, no código: nada de lo de acá está escrito en la aplicación.
-- La barbería número 2 se carga con otro insert igual a este, con sus propios
-- colores y horarios, y la app no se entera.
--
-- Los colores salen de brand/tropi-barbershop/brand-guide.md.
-- ============================================================================

begin;

with t as (
  insert into public.tenants (
    slug, name, timezone, currency,
    color_bg, color_surface, color_ink, color_ink_muted,
    color_accent, color_accent_alt,
    min_lead_minutes, cancel_deadline_minutes,
    booking_window_mode, booking_week_release_dow, booking_week_release_time
  ) values (
    'tropi-barbershop',
    'Tropi Barbershop',
    'America/Montevideo',
    'UYU',

    '#F5F0E8',  -- fondo de página (crema)
    '#FFFFFF',  -- tarjetas
    '#111111',  -- texto principal
    '#6B6B6B',  -- texto secundario
    '#D0021B',  -- acento primario: el botón de reservar
    '#1D3FA3',  -- acento secundario: links y detalles

    60,   -- no se reserva un turno que empiece en menos de 1 hora
    60,   -- se puede cancelar hasta 1 hora antes

    'weekly',      -- solo la semana en curso
    6,             -- la semana siguiente se abre el sábado…
    time '21:00'   -- …al cerrar
  )
  returning id
),

-- Facundo es dueño y el único que corta: un solo registro con role='owner'
-- y accepts_bookings=true. user_id queda null hasta que cree su cuenta;
-- ahí se enlaza con su usuario de Supabase Auth.
b as (
  insert into public.barbers (tenant_id, role, display_name, accepts_bookings)
  select t.id, 'owner', 'Facundo', true from t
  returning id, tenant_id
),

s as (
  insert into public.services (tenant_id, name, duration_minutes, price_cents)
  -- 30000 centavos = $300. Se guarda en centavos, nunca con decimales.
  select t.id, 'Corte de pelo', 40, 30000 from t
  returning id
)

-- Martes a sábado, 14:00 a 21:00. weekday: 0=domingo … 6=sábado.
-- Las horas van en hora local de la barbería, no en UTC: "abro a las 14"
-- sigue siendo a las 14 aunque cambie el horario de verano.
insert into public.working_hours (tenant_id, barber_id, weekday, starts_at, ends_at)
select b.tenant_id, b.id, d, time '14:00', time '21:00'
from b cross join generate_series(2, 6) as d;

commit;


-- ============================================================================
-- Verificación: debería devolver 1 barbería, 1 barbero, 1 servicio, 5 días.
-- ============================================================================
-- select
--   (select count(*) from public.tenants       where slug = 'tropi-barbershop') as barberias,
--   (select count(*) from public.barbers       b join public.tenants t on t.id = b.tenant_id where t.slug = 'tropi-barbershop') as barberos,
--   (select count(*) from public.services      s join public.tenants t on t.id = s.tenant_id where t.slug = 'tropi-barbershop') as servicios,
--   (select count(*) from public.working_hours w join public.tenants t on t.id = w.tenant_id where t.slug = 'tropi-barbershop') as dias;
