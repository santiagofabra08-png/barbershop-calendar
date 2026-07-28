-- ============================================================================
-- RESERVAR SIN ELEGIR BARBERO
-- ============================================================================
-- Cuando la barbería tiene varios barberos, el cliente puede decir "el primero
-- que haya". Quién le toca lo decide el servidor, nunca el navegador: si dos
-- personas eligen el mismo horario en el mismo instante, quien reparte tiene
-- que ser uno solo.
--
-- Criterio de reparto: entre los que están libres a esa hora, el que menos
-- turnos tiene ese día. Empate, el orden que definió el dueño. Así el trabajo
-- se empareja solo en vez de caerle siempre al primero de la lista.
--
-- `p_barber_id` pasa a ser opcional. La firma cambia, así que se borra la
-- versión vieja para no dejar dos funciones conviviendo.
-- ============================================================================

begin;

drop function if exists public.crear_reserva(text, uuid, uuid, date, time, text, text, text);

create or replace function public.crear_reserva(
  p_tenant_slug text,
  p_service_id uuid,
  p_fecha date,
  p_hora time,
  p_nombre text,
  p_telefono text,
  p_email text,
  p_barber_id uuid default null   -- null = el primero que haya
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

  -- ---- Datos del cliente --------------------------------------------------
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

  -- ---- El horario, en hora local de la barbería ---------------------------
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

  -- ---- Quién atiende ------------------------------------------------------
  -- Un barbero sirve si trabaja a esa hora (dentro de un tramo, terminando
  -- antes del cierre y sobre la grilla del servicio) y no tiene nada que se
  -- pise con el turno.
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
    -- el que menos trabajo tiene ese día primero
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

  -- ---- Alta ---------------------------------------------------------------
  begin
    insert into public.appointments (
      tenant_id, barber_id, kind, status,
      starts_at, ends_at,
      service_id, client_name, client_phone, client_email,
      price_cents, duration_minutes
    ) values (
      v_tenant.id, v_barbero, 'booking', 'confirmed',
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
