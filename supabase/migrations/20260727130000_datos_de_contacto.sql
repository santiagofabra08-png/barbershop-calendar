-- ============================================================================
-- DATOS DE CONTACTO DE LA BARBERÍA
-- ============================================================================
-- Faltaban al armar la página pública: un cliente que va por primera vez
-- necesita saber a dónde ir. Son datos del tenant como cualquier otro.
-- ============================================================================

begin;

alter table public.tenants
  add column address text,
  add column maps_url text;

comment on column public.tenants.maps_url is
  'Link a Google Maps o similar. Opcional: si está, la dirección se vuelve clickeable.';

update public.tenants
set address = 'Veracierto 3359, Montevideo'
where slug = 'tropi-barbershop';

commit;
