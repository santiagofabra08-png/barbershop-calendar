-- ============================================================================
-- COBRAR EL TURNO
-- ============================================================================
-- Hasta acá el sistema daba por cobrado todo turno que no estuviera cancelado,
-- y por el precio del servicio que se había reservado. Las dos cosas son
-- falsas seguido: el cliente reserva un corte de $300, se hace también la
-- barba, y paga $450. El panel decía $300 —y la comisión del barbero salía de
-- ese $300, así que se le pagaba de menos.
--
-- A partir de acá el turno reservado es lo que se ESPERABA cobrar, y la verdad
-- sobre la plata es el cobro: una lista de renglones que se suma, con el medio
-- de pago, y una marca de cuándo se cobró. Lo que no está cobrado no entra al
-- balance.
--
-- Tres piezas:
--   1. Los descuentos, que son servicios que restan.
--   2. El cobro en sí: renglones, total y medio de pago.
--   3. Funciones para que cualquiera del equipo pueda cobrar cualquier turno,
--      sin aflojar la regla de que un barbero no ve la agenda de otro.
-- ============================================================================

begin;

-- ============================================================================
-- 1. DESCUENTOS
-- ============================================================================
-- Un descuento es un servicio que resta. Vive en la misma tabla porque en el
-- ticket es lo mismo que los demás —un renglón con un nombre y un monto— y
-- porque así el dueño lo carga desde donde ya carga todo lo que cobra.
--
-- El monto se guarda POSITIVO: el dueño escribe 100 para un descuento de $100,
-- que es lo que espera escribir. El signo se le pone en el renglón del ticket,
-- en un solo lugar.
alter table public.services
  add column kind text not null default 'service'
    check (kind in ('service', 'discount'));

-- Un descuento no dura nada. La duración de un servicio arma la grilla de
-- horarios; la de un descuento no significa nada y tiene que ser cero, no un
-- número inventado que después alguien lea como si valiera.
alter table public.services drop constraint services_duration_minutes_check;
alter table public.services
  add constraint services_duracion_segun_tipo check (
    (kind = 'service' and duration_minutes between 5 and 480)
    or
    (kind = 'discount' and duration_minutes = 0)
  );

-- El público solo ve servicios. Un descuento en la página sería un turno de
-- precio negativo esperando a que alguien lo encuentre.
drop policy "services: lectura pública de los activos" on public.services;
create policy "services: lectura pública de los activos"
  on public.services for select
  to anon, authenticated
  using (
    is_active
    and kind = 'service'
    and exists (select 1 from public.tenants t where t.id = tenant_id and t.is_active)
  );


-- ============================================================================
-- 2. EL COBRO
-- ============================================================================
alter table public.appointments
  -- Cuándo se cobró. Null es "todavía no", que es distinto de cero.
  add column charged_at timestamptz,
  -- El total, congelado. Se podría sumar los renglones cada vez, pero este es
  -- el número que se le dijo al cliente y no puede moverse nunca más.
  add column charged_total_cents int check (charged_total_cents is null or charged_total_cents >= 0),
  add column payment_method text
    check (payment_method is null or payment_method in ('cash', 'card', 'transfer'));

-- Cobrado quiere decir las tres cosas juntas, o ninguna.
alter table public.appointments
  add constraint cobro_coherente check (
    (charged_at is null and charged_total_cents is null and payment_method is null)
    or
    (charged_at is not null and charged_total_cents is not null and payment_method is not null)
  );

-- Un bloqueo no se cobra, un turno cancelado tampoco, y el que no vino menos
-- que nadie: si no vino, no pagó.
alter table public.appointments
  add constraint solo_se_cobra_lo_atendido check (
    charged_at is null
    or (kind = 'booking' and status = 'confirmed')
  );

-- Los renglones del ticket.
--
-- El nombre y el monto se congelan acá, igual que el precio del turno. Si el
-- dueño mañana renombra "Corte" a "Corte clásico" o le cambia el precio, este
-- ticket sigue diciendo lo que se cobró ese día.
create table public.appointment_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,

  -- cascade y no restrict: los renglones no son historia aparte, son parte del
  -- turno. Si el turno se va, se van con él.
  appointment_id uuid not null references public.appointments(id) on delete cascade,

  -- De qué servicio salió. Sirve para saber qué se vende más; el ticket se lee
  -- igual sin esto, porque el nombre y el monto ya están congelados.
  service_id uuid references public.services(id) on delete set null,

  name text not null,
  -- Negativo en los descuentos. El total es la suma, sin casos especiales.
  amount_cents int not null,
  sort_order int not null default 0,

  created_at timestamptz not null default now()
);

create index appointment_items_turno_idx
  on public.appointment_items (appointment_id, sort_order);

alter table public.appointment_items enable row level security;

-- El equipo ve los renglones del local. Escribirlos solo pueden las funciones
-- de más abajo: sin política de insert, update ni delete, RLS niega todo.
create policy "appointment_items: el equipo los ve"
  on public.appointment_items for select
  to authenticated
  using (app.is_member_of(tenant_id));

-- Lo cobrado del día, que es la consulta de la pantalla de cobros.
create index appointments_cobro_idx
  on public.appointments (tenant_id, starts_at)
  where kind = 'booking' and status = 'confirmed';


-- ============================================================================
-- 3. QUIÉN COBRA
-- ============================================================================
-- Cualquiera del equipo puede cobrar cualquier turno del local. En una
-- barbería hay una computadora sola y cobra el que está parado al lado cuando
-- el cliente saca la plata; hacerlo esperar al dueño significa que no se cobra
-- en el momento y a la noche nadie se acuerda.
--
-- Eso NO se hace aflojando las políticas de `appointments`: si un barbero
-- pudiera leer la tabla entera, también vería la agenda y la plata de sus
-- compañeros en las otras pantallas. Se hace con estas funciones, que son las
-- únicas puertas y verifican de a una que quien llama trabaje en el local.

/**
 * Los turnos de un día, para cobrarlos.
 *
 * Devuelve el nombre del cliente pero NO su teléfono ni su mail: para cobrar
 * no hacen falta, y esta función la puede llamar cualquiera del equipo.
 */
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
                 jsonb_build_object('name', i.name, 'amount_cents', i.amount_cents)
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

/**
 * Cobra un turno.
 *
 * El primer renglón es siempre el servicio reservado, al precio que tenía
 * cuando se reservó. Los agregados van al precio de hoy, que es lo correcto:
 * el cliente pactó el corte, no la barba que pidió sobre la marcha.
 *
 * `p_extras` puede repetir un id —dos veces la misma cosa es dos renglones— y
 * puede venir vacío.
 */
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

  -- Renglón 1: lo que vino a hacerse, al precio que se le dijo.
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

/**
 * Deshace un cobro mal hecho.
 *
 * Borra los renglones y devuelve el turno a "sin cobrar". No deja rastro a
 * propósito: un cobro equivocado no es historia, es un error de dedo, y
 * dejarlo tachado ensuciaría el balance para siempre.
 */
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

  delete from public.appointment_items where appointment_id = v_ap.id;

  update public.appointments
  set charged_at = null,
      charged_total_cents = null,
      payment_method = null
  where id = v_ap.id;
end;
$$;

revoke execute on function public.turnos_para_cobrar(text, date) from public;
revoke execute on function public.cobrar_turno(uuid, uuid[], text) from public;
revoke execute on function public.anular_cobro(uuid) from public;

-- Solo con sesión. `anon` no cobra nada.
grant execute on function public.turnos_para_cobrar(text, date) to authenticated;
grant execute on function public.cobrar_turno(uuid, uuid[], text) to authenticated;
grant execute on function public.anular_cobro(uuid) to authenticated;


-- ============================================================================
-- 4. QUE NO SE PUEDA RESERVAR UN DESCUENTO
-- ============================================================================
-- `crear_reserva` elegía el servicio solo por id y por estar activo. Con los
-- descuentos en la misma tabla eso alcanzaría para que alguien reserve un
-- turno de precio negativo escribiendo un id a mano. Se agrega el filtro por
-- tipo, que es la única línea que cambia.
create or replace function public.crear_reserva(
  p_tenant_slug text,
  p_service_id uuid,
  p_fecha date,
  p_hora time,
  p_nombre text,
  p_telefono text,
  p_email text,
  p_barber_id uuid default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_tenant       public.tenants%rowtype;
  v_duracion     int;
  v_precio       int;
  v_ahora_local  timestamp;
  v_hoy          date;
  v_inicio       timestamptz;
  v_fin          timestamptz;
  v_release      timestamp;
  v_d            date;
  v_barbero      uuid;
  v_token        uuid;
begin
  select * into v_tenant
  from public.tenants
  where slug = p_tenant_slug and is_active;

  if not found then
    raise exception 'La barbería no existe o no está disponible';
  end if;

  select duration_minutes, price_cents into v_duracion, v_precio
  from public.services
  where id = p_service_id
    and tenant_id = v_tenant.id
    and is_active
    and kind = 'service';

  if not found then
    raise exception 'Ese servicio no está disponible';
  end if;

  p_nombre   := nullif(btrim(p_nombre), '');
  p_telefono := nullif(btrim(p_telefono), '');
  p_email    := nullif(btrim(lower(p_email)), '');

  if p_nombre is null or p_telefono is null or p_email is null then
    raise exception 'Faltan datos de contacto';
  end if;

  if p_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$' then
    raise exception 'Ese mail no parece válido';
  end if;

  if p_telefono !~ '^\+598[249][0-9]{7}$' then
    raise exception 'Ese teléfono no parece válido';
  end if;

  v_ahora_local := now() at time zone v_tenant.timezone;
  v_hoy := v_ahora_local::date;

  v_inicio := (p_fecha + p_hora) at time zone v_tenant.timezone;
  v_fin := v_inicio + make_interval(mins => v_duracion);

  if v_inicio < now() + make_interval(mins => v_tenant.min_lead_minutes) then
    raise exception 'Ese horario ya está muy cerca. Elegí uno más tarde.';
  end if;

  if v_tenant.booking_window_mode = 'weekly' then
    for i in 0..7 loop
      v_d := v_hoy + i;
      if extract(dow from v_d)::int = v_tenant.booking_week_release_dow
         and (i > 0 or v_tenant.booking_week_release_time > v_ahora_local::time)
      then
        v_release := v_d + v_tenant.booking_week_release_time;
        exit;
      end if;
    end loop;

    if (p_fecha + p_hora) >= v_release then
      raise exception 'Todavía no se puede reservar para esa fecha';
    end if;
  else
    if p_fecha > v_hoy + v_tenant.booking_window_days then
      raise exception 'Todavía no se puede reservar para esa fecha';
    end if;
  end if;

  select b.id into v_barbero
  from public.barbers b
  where b.tenant_id = v_tenant.id
    and b.is_active
    and b.accepts_bookings
    and (p_barber_id is null or b.id = p_barber_id)
    and exists (
      select 1 from public.working_hours w
      where w.barber_id = b.id
        and w.weekday = extract(dow from p_fecha)::int
        and p_hora >= w.starts_at
        and (p_hora + make_interval(mins => v_duracion)) <= w.ends_at
        and (extract(epoch from (p_hora - w.starts_at)) / 60)::int % v_duracion = 0
    )
    and not exists (
      select 1 from public.appointments a
      where a.barber_id = b.id
        and a.status = 'confirmed'
        and tstzrange(a.starts_at, a.ends_at) && tstzrange(v_inicio, v_fin)
    )
  order by
    (
      select count(*) from public.appointments a
      where a.barber_id = b.id
        and a.status = 'confirmed'
        and (a.starts_at at time zone v_tenant.timezone)::date = p_fecha
    ),
    b.sort_order,
    b.id
  limit 1;

  if v_barbero is null then
    if p_barber_id is null then
      raise exception 'No queda nadie libre a esa hora. Elegí otro horario.';
    else
      raise exception 'Ese horario no está disponible con ese barbero';
    end if;
  end if;

  begin
    insert into public.appointments (
      tenant_id, barber_id, kind, status, source,
      starts_at, ends_at,
      service_id, client_name, client_phone, client_email,
      price_cents, duration_minutes
    ) values (
      v_tenant.id, v_barbero, 'booking', 'confirmed', 'online',
      v_inicio, v_fin,
      p_service_id, p_nombre, p_telefono, p_email,
      v_precio, v_duracion
    )
    returning public_token into v_token;
  exception
    when exclusion_violation then
      raise exception 'Alguien acaba de tomar ese horario. Elegí otro.';
  end;

  return v_token;
end;
$$;

revoke execute on function public.crear_reserva(text, uuid, date, time, text, text, text, uuid) from public;
grant execute on function public.crear_reserva(text, uuid, date, time, text, text, text, uuid) to anon, authenticated;

commit;
