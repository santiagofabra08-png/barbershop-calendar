-- ============================================================================
-- CIERRE DE CAJA
-- ============================================================================
-- Cobrar un turno anota una intención: "este cliente pagó $450 en efectivo".
-- El cierre es lo que la convierte en plata contada: al final del día alguien
-- abre el cajón, cuenta lo que hay, lo compara con lo que dice el sistema, y
-- deja constancia de la diferencia.
--
-- Sin esto, un cobro cargado mal —o uno que nunca se cargó— no se descubre
-- nunca. Con esto se descubre el mismo día, que es cuando todavía alguien se
-- acuerda de qué pasó.
--
-- Dos reglas que hacen que el número signifique algo:
--
--   · No se cierra con turnos sin resolver. Cada turno del día tiene que estar
--     cobrado o marcado como que no vino. Si se pudiera cerrar dejando cosas
--     colgadas, el total sería una estimación con nombre de certeza.
--   · Un día cerrado no se toca más. Ni cobrar, ni anular. Reabrirlo es una
--     decisión del dueño, no un arreglo al pasar.
-- ============================================================================

begin;

create table public.cash_closures (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,

  -- La fecha local del local, no un instante. "El día" de una barbería es un
  -- día de calendario en su zona horaria.
  business_date date not null,
  unique (tenant_id, business_date),

  -- ---- Lo que dice el sistema, congelado al cerrar -----------------------
  -- Se guarda en vez de recalcularse. Si mañana se reabre el día y se corrige
  -- un cobro, este número tiene que seguir diciendo contra qué se contó.
  expected_cash_cents     int not null check (expected_cash_cents >= 0),
  expected_card_cents     int not null check (expected_card_cents >= 0),
  expected_transfer_cents int not null check (expected_transfer_cents >= 0),

  -- ---- Lo que se contó ---------------------------------------------------
  counted_cash_cents     int not null check (counted_cash_cents >= 0),
  counted_card_cents     int not null check (counted_card_cents >= 0),
  counted_transfer_cents int not null check (counted_transfer_cents >= 0),

  -- Para explicar una diferencia: "faltan 200, se los llevó Nico de adelanto".
  note text,

  closed_at timestamptz not null default now(),
  closed_by uuid references public.barbers(id) on delete set null
);

create index cash_closures_fecha_idx
  on public.cash_closures (tenant_id, business_date desc);

alter table public.cash_closures enable row level security;

-- El equipo ve los cierres del local: quien cuenta la caja tiene que poder ver
-- si el día ya está cerrado. Escribirlos solo pueden las funciones de abajo.
create policy "cash_closures: el equipo los ve"
  on public.cash_closures for select
  to authenticated
  using (app.is_member_of(tenant_id));


-- ============================================================================
-- Helpers
-- ============================================================================

/** La fecha local de un turno, según la zona horaria de su barbería. */
create or replace function app.fecha_local(p_instante timestamptz, p_tenant uuid)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select (p_instante at time zone t.timezone)::date
  from public.tenants t
  where t.id = p_tenant;
$$;

/** ¿Ese día ya está cerrado? */
create or replace function app.caja_cerrada(p_tenant uuid, p_fecha date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.cash_closures c
    where c.tenant_id = p_tenant and c.business_date = p_fecha
  );
$$;


-- ============================================================================
-- Cobrar y anular pasan a respetar el cierre
-- ============================================================================
-- Las dos funciones son las mismas de antes con un chequeo más al principio.
-- El chequeo va en la base y no en la pantalla porque es una garantía, no una
-- comodidad: un día cerrado no cambia ni aunque alguien llame a la función
-- desde otro lado.

create or replace function public.cobrar_turno(
  p_appointment_id uuid,
  p_extras uuid[],
  p_payment_method text
)
returns int
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_ap     public.appointments%rowtype;
  v_s      public.services%rowtype;
  v_extra  uuid;
  v_monto  int;
  v_total  int;
  v_orden  int := 0;
begin
  select * into v_ap from public.appointments where id = p_appointment_id;
  if not found then
    raise exception 'Ese turno no existe';
  end if;

  if not app.is_member_of(v_ap.tenant_id) then
    raise exception 'No trabajás en esa barbería';
  end if;

  if app.caja_cerrada(v_ap.tenant_id, app.fecha_local(v_ap.starts_at, v_ap.tenant_id)) then
    raise exception 'La caja de ese día ya está cerrada';
  end if;

  if v_ap.kind <> 'booking' then
    raise exception 'Un rato bloqueado no se cobra';
  end if;
  if v_ap.status <> 'confirmed' then
    raise exception 'Ese turno no está confirmado';
  end if;
  if v_ap.charged_at is not null then
    raise exception 'Ese turno ya está cobrado';
  end if;
  if p_payment_method not in ('cash', 'card', 'transfer') then
    raise exception 'Falta con qué pagó';
  end if;

  insert into public.appointment_items
    (tenant_id, appointment_id, service_id, name, amount_cents, sort_order)
  select v_ap.tenant_id, v_ap.id, s.id, s.name, v_ap.price_cents, 0
  from public.services s
  where s.id = v_ap.service_id;

  v_total := v_ap.price_cents;

  foreach v_extra in array coalesce(p_extras, '{}'::uuid[]) loop
    select * into v_s
    from public.services
    where id = v_extra and tenant_id = v_ap.tenant_id and is_active;

    if not found then
      raise exception 'Uno de los agregados ya no está disponible';
    end if;

    v_orden := v_orden + 1;
    v_monto := case when v_s.kind = 'discount'
                    then -v_s.price_cents
                    else v_s.price_cents end;

    insert into public.appointment_items
      (tenant_id, appointment_id, service_id, name, amount_cents, sort_order)
    values (v_ap.tenant_id, v_ap.id, v_s.id, v_s.name, v_monto, v_orden);

    v_total := v_total + v_monto;
  end loop;

  if v_total < 0 then
    raise exception 'El descuento es más grande que el total';
  end if;

  update public.appointments
  set charged_at = now(),
      charged_total_cents = v_total,
      payment_method = p_payment_method
  where id = v_ap.id;

  return v_total;
end;
$$;

create or replace function public.anular_cobro(p_appointment_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_ap public.appointments%rowtype;
begin
  select * into v_ap from public.appointments where id = p_appointment_id;
  if not found then
    raise exception 'Ese turno no existe';
  end if;

  if not app.is_member_of(v_ap.tenant_id) then
    raise exception 'No trabajás en esa barbería';
  end if;

  if app.caja_cerrada(v_ap.tenant_id, app.fecha_local(v_ap.starts_at, v_ap.tenant_id)) then
    raise exception 'La caja de ese día ya está cerrada';
  end if;

  delete from public.appointment_items where appointment_id = v_ap.id;

  update public.appointments
  set charged_at = null,
      charged_total_cents = null,
      payment_method = null
  where id = v_ap.id;
end;
$$;


-- ============================================================================
-- Marcar quién vino, desde la pantalla de cobros
-- ============================================================================
-- Ya se podía desde la agenda, pero ahí cada barbero toca solo sus turnos. En
-- el cierre hace falta poder resolver cualquier turno del día: si Nico se fue y
-- su cliente de las 19 no apareció, el que está cerrando tiene que poder
-- marcarlo para que la caja cierre.
create or replace function public.marcar_asistencia(
  p_appointment_id uuid,
  p_vino boolean
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_ap public.appointments%rowtype;
begin
  select * into v_ap from public.appointments where id = p_appointment_id;
  if not found then
    raise exception 'Ese turno no existe';
  end if;

  if not app.is_member_of(v_ap.tenant_id) then
    raise exception 'No trabajás en esa barbería';
  end if;

  if app.caja_cerrada(v_ap.tenant_id, app.fecha_local(v_ap.starts_at, v_ap.tenant_id)) then
    raise exception 'La caja de ese día ya está cerrada';
  end if;

  if v_ap.kind <> 'booking' then
    raise exception 'Un rato bloqueado no tiene quien venga';
  end if;

  -- Un turno cobrado no puede pasar a "no vino": si pagó, vino. Primero se
  -- anula el cobro.
  if v_ap.charged_at is not null and not p_vino then
    raise exception 'Ese turno está cobrado. Anulá el cobro primero.';
  end if;

  update public.appointments
  set status = case when p_vino then 'confirmed' else 'no_show' end
  where id = v_ap.id;
end;
$$;


-- ============================================================================
-- Cerrar y reabrir
-- ============================================================================

/**
 * Cierra la caja de un día.
 *
 * Los totales esperados los calcula la base a partir de lo cobrado; los
 * contados llegan de quien contó. Nunca al revés: si el navegador mandara los
 * dos, el cierre no verificaría nada.
 */
create or replace function public.cerrar_caja(
  p_tenant_slug text,
  p_fecha date,
  p_contado_cash int,
  p_contado_card int,
  p_contado_transfer int,
  p_nota text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_tenant     public.tenants%rowtype;
  v_barbero    uuid;
  v_pendientes int;
  v_cash       int;
  v_card       int;
  v_transfer   int;
begin
  select * into v_tenant from public.tenants where slug = p_tenant_slug;
  if not found then
    raise exception 'Esa barbería no existe';
  end if;

  if not app.is_member_of(v_tenant.id) then
    raise exception 'No trabajás en esa barbería';
  end if;

  if app.caja_cerrada(v_tenant.id, p_fecha) then
    raise exception 'La caja de ese día ya está cerrada';
  end if;

  if p_contado_cash < 0 or p_contado_card < 0 or p_contado_transfer < 0 then
    raise exception 'Los montos contados no pueden ser negativos';
  end if;

  -- Nada colgado. Un turno atendido sin cobrar y sin marcar es plata que
  -- existe o no existe, y hasta que alguien lo diga el total no vale nada.
  select count(*) into v_pendientes
  from public.appointments a
  where a.tenant_id = v_tenant.id
    and a.kind = 'booking'
    and a.status = 'confirmed'
    and a.charged_at is null
    and (a.starts_at at time zone v_tenant.timezone)::date = p_fecha;

  if v_pendientes > 0 then
    raise exception 'Quedan % turnos sin cobrar. Cobralos o marcá que no vinieron.', v_pendientes;
  end if;

  select
    coalesce(sum(a.charged_total_cents) filter (where a.payment_method = 'cash'), 0),
    coalesce(sum(a.charged_total_cents) filter (where a.payment_method = 'card'), 0),
    coalesce(sum(a.charged_total_cents) filter (where a.payment_method = 'transfer'), 0)
  into v_cash, v_card, v_transfer
  from public.appointments a
  where a.tenant_id = v_tenant.id
    and a.charged_at is not null
    and (a.starts_at at time zone v_tenant.timezone)::date = p_fecha;

  v_barbero := app.my_barber_id(v_tenant.id);

  insert into public.cash_closures (
    tenant_id, business_date,
    expected_cash_cents, expected_card_cents, expected_transfer_cents,
    counted_cash_cents, counted_card_cents, counted_transfer_cents,
    note, closed_by
  ) values (
    v_tenant.id, p_fecha,
    v_cash, v_card, v_transfer,
    p_contado_cash, p_contado_card, p_contado_transfer,
    nullif(btrim(p_nota), ''), v_barbero
  );
end;
$$;

/**
 * Reabre un día cerrado.
 *
 * Solo el dueño. Reabrir una caja cerrada es deshacer un conteo que alguien ya
 * dio por bueno: no es un arreglo al pasar, es una decisión de quien responde
 * por la plata.
 */
create or replace function public.reabrir_caja(
  p_tenant_slug text,
  p_fecha date
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_tenant public.tenants%rowtype;
begin
  select * into v_tenant from public.tenants where slug = p_tenant_slug;
  if not found then
    raise exception 'Esa barbería no existe';
  end if;

  if not app.is_owner_of(v_tenant.id) then
    raise exception 'Solo el dueño puede reabrir una caja cerrada';
  end if;

  delete from public.cash_closures
  where tenant_id = v_tenant.id and business_date = p_fecha;
end;
$$;

revoke execute on function public.marcar_asistencia(uuid, boolean) from public;
revoke execute on function public.cerrar_caja(text, date, int, int, int, text) from public;
revoke execute on function public.reabrir_caja(text, date) from public;

grant execute on function public.marcar_asistencia(uuid, boolean) to authenticated;
grant execute on function public.cerrar_caja(text, date, int, int, int, text) to authenticated;
grant execute on function public.reabrir_caja(text, date) to authenticated;

commit;
