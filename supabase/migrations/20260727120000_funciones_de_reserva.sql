-- ============================================================================
-- FUNCIONES DE RESERVA
-- ============================================================================
-- El público no toca `appointments` ni para leer: esa tabla tiene nombres,
-- teléfonos y mails. Todo lo que necesita la página de reservas pasa por estas
-- funciones, que devuelven solo lo imprescindible y validan del lado del
-- servidor.
--
-- Van con SECURITY DEFINER (saltean RLS) precisamente porque son la frontera
-- controlada: adentro se decide qué sale y qué entra.
-- ============================================================================

begin;

-- ============================================================================
-- 1. horarios_ocupados — qué ratos NO están libres
-- ============================================================================
-- Devuelve rangos de tiempo y nada más. Ni nombres, ni teléfonos, ni si es una
-- reserva o un día libre: desde afuera, "ocupado" es "ocupado".
create or replace function public.horarios_ocupados(
  p_tenant_slug text,
  p_desde date,
  p_hasta date
)
returns table (barber_id uuid, starts_at timestamptz, ends_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select a.barber_id, a.starts_at, a.ends_at
  from public.appointments a
  join public.tenants t on t.id = a.tenant_id
  where t.slug = p_tenant_slug
    and t.is_active
    and a.status = 'confirmed'
    and a.starts_at < ((p_hasta + 1)::timestamp at time zone t.timezone)
    and a.ends_at   > (p_desde::timestamp at time zone t.timezone);
$$;


-- ============================================================================
-- 2. crear_reserva — el único camino para que entre un turno
-- ============================================================================
-- Recibe la fecha y la hora en hora LOCAL de la barbería, como las eligió el
-- cliente en pantalla, y calcula acá el instante real en UTC. El navegador
-- nunca manda un timestamp: manda "el jueves a las 16:00" y el servidor decide
-- qué significa eso.
--
-- Valida, en orden: que la barbería, el servicio y el barbero existan y estén
-- activos; que la hora caiga en un tramo de trabajo y termine antes del
-- cierre; que esté sobre la grilla del servicio (nadie reserva a las 14:07);
-- que respete la anticipación mínima; y que caiga dentro de la ventana de
-- reserva. La superposición la corta el índice de exclusión de la tabla.
create or replace function public.crear_reserva(
  p_tenant_slug text,
  p_service_id uuid,
  p_barber_id uuid,
  p_fecha date,
  p_hora time,
  p_nombre text,
  p_telefono text,
  p_email text
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
  v_token        uuid;
begin
  -- ---- Datos base ---------------------------------------------------------
  select * into v_tenant
  from public.tenants
  where slug = p_tenant_slug and is_active;

  if not found then
    raise exception 'La barbería no existe o no está disponible';
  end if;

  select duration_minutes, price_cents into v_duracion, v_precio
  from public.services
  where id = p_service_id and tenant_id = v_tenant.id and is_active;

  if not found then
    raise exception 'Ese servicio no está disponible';
  end if;

  if not exists (
    select 1 from public.barbers
    where id = p_barber_id
      and tenant_id = v_tenant.id
      and is_active
      and accepts_bookings
  ) then
    raise exception 'Ese barbero no está tomando turnos';
  end if;

  -- ---- Datos del cliente --------------------------------------------------
  p_nombre   := nullif(btrim(p_nombre), '');
  p_telefono := nullif(btrim(p_telefono), '');
  p_email    := nullif(btrim(lower(p_email)), '');

  if p_nombre is null or p_telefono is null or p_email is null then
    raise exception 'Faltan datos de contacto';
  end if;

  if p_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Ese mail no parece válido';
  end if;

  -- ---- El horario, en hora local de la barbería ---------------------------
  v_ahora_local := now() at time zone v_tenant.timezone;
  v_hoy := v_ahora_local::date;

  v_inicio := (p_fecha + p_hora) at time zone v_tenant.timezone;
  v_fin := v_inicio + make_interval(mins => v_duracion);

  -- Tiene que caer dentro de un tramo de trabajo, terminar antes del cierre y
  -- estar sobre la grilla: los turnos arrancan cada `duracion` minutos desde
  -- la hora de apertura.
  if not exists (
    select 1 from public.working_hours w
    where w.barber_id = p_barber_id
      and w.weekday = extract(dow from p_fecha)::int
      and p_hora >= w.starts_at
      and (p_hora + make_interval(mins => v_duracion)) <= w.ends_at
      and (extract(epoch from (p_hora - w.starts_at)) / 60)::int % v_duracion = 0
  ) then
    raise exception 'Ese horario no está dentro del horario de atención';
  end if;

  -- Anticipación mínima.
  if v_inicio < now() + make_interval(mins => v_tenant.min_lead_minutes) then
    raise exception 'Ese horario ya está muy cerca. Elegí uno más tarde.';
  end if;

  -- Ventana de reserva.
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

  -- ---- Alta ---------------------------------------------------------------
  -- El precio y la duración se congelan: si mañana cambian, este turno
  -- conserva lo que se pactó hoy.
  begin
    insert into public.appointments (
      tenant_id, barber_id, kind, status,
      starts_at, ends_at,
      service_id, client_name, client_phone, client_email,
      price_cents, duration_minutes
    ) values (
      v_tenant.id, p_barber_id, 'booking', 'confirmed',
      v_inicio, v_fin,
      p_service_id, p_nombre, p_telefono, p_email,
      v_precio, v_duracion
    )
    returning public_token into v_token;
  exception
    when exclusion_violation then
      -- Dos personas tocaron el mismo horario en el mismo instante.
      raise exception 'Alguien acaba de tomar ese horario. Elegí otro.';
  end;

  return v_token;
end;
$$;


-- ============================================================================
-- 3. turno_por_token — la vista del cliente, sin cuenta
-- ============================================================================
-- El token viaja en el link del mail de confirmación. Es la única llave que
-- tiene el cliente, y solo abre su propio turno.
create or replace function public.turno_por_token(p_token uuid)
returns table (
  barberia text,
  barbero text,
  servicio text,
  fecha date,
  hora time,
  duracion_minutos int,
  precio_centavos int,
  moneda text,
  estado text,
  cliente text,
  se_puede_cancelar boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    t.name,
    b.display_name,
    s.name,
    (a.starts_at at time zone t.timezone)::date,
    (a.starts_at at time zone t.timezone)::time,
    a.duration_minutes,
    a.price_cents,
    t.currency,
    a.status,
    a.client_name,
    a.status = 'confirmed'
      and a.starts_at > now() + make_interval(mins => t.cancel_deadline_minutes)
  from public.appointments a
  join public.tenants t on t.id = a.tenant_id
  join public.barbers b on b.id = a.barber_id
  left join public.services s on s.id = a.service_id
  where a.public_token = p_token
    and a.kind = 'booking';
$$;


-- ============================================================================
-- 4. cancelar_turno
-- ============================================================================
create or replace function public.cancelar_turno(p_token uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select a.id into v_id
  from public.appointments a
  join public.tenants t on t.id = a.tenant_id
  where a.public_token = p_token
    and a.kind = 'booking'
    and a.status = 'confirmed'
    and a.starts_at > now() + make_interval(mins => t.cancel_deadline_minutes);

  if not found then
    raise exception 'Este turno ya no se puede cancelar desde acá. Escribile a la barbería.';
  end if;

  update public.appointments
  set status = 'cancelled', cancelled_at = now()
  where id = v_id;

  return true;
end;
$$;


-- ============================================================================
-- 5. Permisos
-- ============================================================================
-- Por defecto una función es ejecutable por todos. Se revoca y se concede a
-- mano para que quede escrito quién puede llamar qué.
revoke execute on function public.horarios_ocupados(text, date, date) from public;
revoke execute on function public.crear_reserva(text, uuid, uuid, date, time, text, text, text) from public;
revoke execute on function public.turno_por_token(uuid) from public;
revoke execute on function public.cancelar_turno(uuid) from public;

grant execute on function public.horarios_ocupados(text, date, date) to anon, authenticated;
grant execute on function public.crear_reserva(text, uuid, uuid, date, time, text, text, text) to anon, authenticated;
grant execute on function public.turno_por_token(uuid) to anon, authenticated;
grant execute on function public.cancelar_turno(uuid) to anon, authenticated;

commit;
