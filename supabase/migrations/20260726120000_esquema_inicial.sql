-- ============================================================================
-- ESQUEMA INICIAL — plataforma de reservas multi-tenant para barberías
-- ============================================================================
-- Convenciones:
--   · Todo tiempo absoluto se guarda en UTC (timestamptz). La zona horaria de
--     la barbería vive en tenants.timezone y solo se usa para MOSTRAR.
--   · Los horarios semanales se guardan como hora local (time), porque "abro
--     a las 14" no cambia cuando cambia el horario de verano.
--   · Toda tabla con datos de una barbería lleva tenant_id y tiene RLS.
--   · El dinero se guarda en centavos (integer). Nunca float: 0.1 + 0.2 no da
--     0.3 en punto flotante, y con plata eso no se perdona.
-- ============================================================================

-- Todo el archivo corre como una sola operación: si algo falla en el medio,
-- Postgres deshace lo anterior y la base queda como estaba. No hay forma de
-- terminar con un esquema a medio crear.
begin;

create extension if not exists btree_gist;

-- Rango de horas del día. Postgres trae rangos para fecha y timestamp, pero
-- no para `time`. Lo necesitamos para impedir que un barbero cargue dos
-- tramos de horario superpuestos el mismo día.
create type hours_range as range (subtype = time);

-- Esquema aparte para las funciones auxiliares de permisos. Separarlas de
-- `public` evita exponerlas como API por accidente.
create schema if not exists app;


-- ============================================================================
-- 1. TENANTS — una fila por barbería
-- ============================================================================
create table public.tenants (
  id uuid primary key default gen_random_uuid(),

  -- Subdominio: {slug}.tuapp.com. El check obliga a lo que ya sabemos que
  -- tiene que ser un dominio: minúsculas, sin espacios, sin tildes.
  slug text not null unique
    check (slug ~ '^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$' and length(slug) between 2 and 40),
  name text not null,
  custom_domain text unique,

  -- Zona horaria IANA. Default para Uruguay, pero cada barbería puede tener
  -- la suya: el día que se venda en Argentina, se cambia acá y nada más.
  timezone text not null default 'America/Montevideo',
  currency text not null default 'UYU',

  -- ---- Marca -------------------------------------------------------------
  -- Dos versiones del logo porque un logo oscuro desaparece sobre un header
  -- oscuro. Cuál usar lo decide el fondo, no el archivo.
  logo_light_url text,  -- logo para fondos CLAROS (dibujo oscuro)
  logo_dark_url  text,  -- logo para fondos OSCUROS (dibujo claro)

  -- Los colores se nombran por su FUNCIÓN, no por su color. `color_accent`
  -- sirve igual si la barbería es roja o verde; `color_red` sería mentira en
  -- la segunda. Sin default: cada barbería define los suyos, ninguno se
  -- hereda del código.
  color_bg         text not null check (color_bg         ~ '^#[0-9a-fA-F]{6}$'),
  color_surface    text not null check (color_surface    ~ '^#[0-9a-fA-F]{6}$'),
  color_ink        text not null check (color_ink        ~ '^#[0-9a-fA-F]{6}$'),
  color_ink_muted  text not null check (color_ink_muted  ~ '^#[0-9a-fA-F]{6}$'),
  color_accent     text not null check (color_accent     ~ '^#[0-9a-fA-F]{6}$'),
  color_accent_alt text not null check (color_accent_alt ~ '^#[0-9a-fA-F]{6}$'),

  -- ---- Políticas de agenda ----------------------------------------------
  -- Anticipación mínima: no se ofrece un turno que arranque antes de esto.
  min_lead_minutes int not null default 60 check (min_lead_minutes >= 0),
  -- Hasta cuántos minutos antes del turno el cliente puede cancelar solo.
  cancel_deadline_minutes int not null default 60 check (cancel_deadline_minutes >= 0),

  -- Hasta cuándo se puede reservar hacia adelante. Dos modos:
  --   'rolling' — ventana móvil de N días (lo habitual).
  --   'weekly'  — solo la semana en curso; la siguiente se habilita en un
  --               momento fijo de la semana. Es lo que eligió Tropi.
  booking_window_mode text not null default 'rolling'
    check (booking_window_mode in ('rolling', 'weekly')),
  booking_window_days int check (booking_window_days between 1 and 180),
  booking_week_release_dow smallint check (booking_week_release_dow between 0 and 6),
  booking_week_release_time time,

  -- Cada modo exige sus propios datos y prohíbe los del otro.
  constraint booking_window_coherente check (
    (booking_window_mode = 'rolling'
      and booking_window_days is not null
      and booking_week_release_dow is null
      and booking_week_release_time is null)
    or
    (booking_window_mode = 'weekly'
      and booking_week_release_dow is not null
      and booking_week_release_time is not null
      and booking_window_days is null)
  ),

  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on column public.tenants.booking_week_release_dow is
  '0=domingo … 6=sábado. Momento en que se habilita la semana siguiente.';


-- ============================================================================
-- 2. BARBERS — quién trabaja en la barbería, y con qué permisos
-- ============================================================================
-- Una sola tabla para dueños y barberos porque en una barbería chica son la
-- misma persona: Facundo es dueño Y el único que corta. Dos tablas separadas
-- obligarían a duplicarlo.
--   role             = qué puede administrar
--   accepts_bookings = si tiene agenda propia (un dueño que no corta, no)
create table public.barbers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,

  -- Null mientras el dueño lo dio de alta pero todavía no creó su cuenta.
  user_id uuid references auth.users(id) on delete set null,

  role text not null default 'barber' check (role in ('owner', 'barber')),
  display_name text not null,
  phone text,  -- para el botón de WhatsApp. No se expone al público.

  accepts_bookings boolean not null default true,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),

  -- Una persona puede trabajar en dos barberías, pero una sola vez en cada una.
  unique (tenant_id, user_id)
);

create index barbers_tenant_idx on public.barbers (tenant_id) where is_active;


-- ============================================================================
-- 3. SERVICES — qué se puede reservar
-- ============================================================================
create table public.services (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,

  name text not null,
  description text,

  -- La duración define la grilla de horarios que ve el cliente.
  duration_minutes int not null check (duration_minutes between 5 and 480),
  price_cents int not null check (price_cents >= 0),

  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index services_tenant_idx on public.services (tenant_id) where is_active;


-- ============================================================================
-- 4. WORKING_HOURS — el horario habitual de cada barbero
-- ============================================================================
-- Lo que cambia poco: "martes a sábado de 14 a 21". Las excepciones puntuales
-- (un día libre, un almuerzo) NO van acá: van como bloqueos en appointments.
--
-- Varias filas por día permiten cortes: 09:00-13:00 y 15:00-19:00 son dos
-- filas, y el hueco del medio simplemente no existe como horario.
create table public.working_hours (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  barber_id uuid not null references public.barbers(id) on delete cascade,

  weekday smallint not null check (weekday between 0 and 6),  -- 0=domingo
  starts_at time not null,
  ends_at time not null,

  check (ends_at > starts_at),

  -- Impide cargar dos tramos superpuestos el mismo día para el mismo barbero.
  constraint working_hours_sin_superposicion exclude using gist (
    barber_id with =,
    weekday with =,
    hours_range(starts_at, ends_at) with &&
  )
);

create index working_hours_lookup_idx
  on public.working_hours (tenant_id, barber_id, weekday);


-- ============================================================================
-- 5. APPOINTMENTS — reservas y bloqueos, en la misma tabla
-- ============================================================================
-- Viven juntos porque para calcular disponibilidad son lo mismo: un rato en
-- que el barbero no está libre. Separarlos obligaría a consultar dos tablas y
-- unir los resultados en cada cálculo, y a mantener dos veces la misma lógica
-- de superposición.
--
--   kind='booking' — turno de un cliente
--   kind='block'   — día libre, almuerzo, feriado, lo que sea
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,

  -- restrict, no cascade: borrar un barbero no puede borrar su historial.
  -- Un barbero que se va se marca is_active = false.
  barber_id uuid not null references public.barbers(id) on delete restrict,

  kind text not null check (kind in ('booking', 'block')),
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),

  -- En UTC, siempre. Los calcula el servidor: nunca se confía en la hora que
  -- manda el navegador.
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  check (ends_at > starts_at),

  -- ---- Solo para kind='booking' -----------------------------------------
  service_id uuid references public.services(id) on delete restrict,
  client_name text,
  client_phone text,
  client_email text,

  -- Congelados al momento de reservar. Si mañana el corte sale $400, el turno
  -- de ayer sigue diciendo $300, que es lo que se pactó.
  price_cents int,
  duration_minutes int,

  -- El cliente no tiene cuenta: entra a ver o cancelar su turno con este
  -- token, que le llega en el mail de confirmación.
  public_token uuid not null default gen_random_uuid() unique,

  -- ---- Solo para kind='block' -------------------------------------------
  reason text,  -- "vacaciones", "almuerzo", "turno médico"

  created_at timestamptz not null default now(),
  cancelled_at timestamptz,

  -- Una reserva necesita servicio y datos del cliente; un bloqueo, ninguno.
  constraint appointment_campos_coherentes check (
    (kind = 'booking'
      and service_id is not null
      and client_name is not null
      and client_phone is not null
      and client_email is not null
      and price_cents is not null
      and duration_minutes is not null)
    or
    (kind = 'block'
      and service_id is null
      and client_name is null
      and client_phone is null
      and client_email is null)
  ),

  constraint cancelled_at_coherente check (
    (status = 'cancelled' and cancelled_at is not null)
    or
    (status = 'confirmed' and cancelled_at is null)
  ),

  -- ⭐ LA GARANTÍA CENTRAL DEL SISTEMA
  -- Un barbero no puede tener dos cosas activas superpuestas en el tiempo.
  -- Lo hace cumplir Postgres, no la aplicación: si dos clientes tocan
  -- "Reservar" en el mismo horario en el mismo instante, uno de los dos
  -- INSERT falla. Verificar "¿está libre?" y después insertar deja una
  -- ventana entre las dos operaciones donde el otro se cuela.
  constraint appointments_sin_superposicion exclude using gist (
    barber_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status = 'confirmed')
);

-- Agenda de un barbero en un rango de fechas: la consulta más frecuente.
create index appointments_agenda_idx
  on public.appointments (tenant_id, barber_id, starts_at)
  where status = 'confirmed';

-- "Los turnos de mañana" para el panel de recordatorios de WhatsApp.
create index appointments_dia_idx
  on public.appointments (tenant_id, starts_at)
  where status = 'confirmed' and kind = 'booking';


-- ============================================================================
-- 6. FUNCIONES DE PERMISOS
-- ============================================================================
-- Van con SECURITY DEFINER a propósito. Las políticas de RLS sobre `barbers`
-- necesitan consultar `barbers` para saber quién sos — y eso, sin definer,
-- dispara la política otra vez y entra en recursión infinita. Con definer, la
-- función lee la tabla sin pasar por RLS y corta el ciclo.
--
-- `set search_path = ''` obliga a escribir todos los nombres completos
-- (public.barbers). Sin eso, alguien podría crear una tabla `barbers` en otro
-- esquema y hacer que la función lea la suya.

create or replace function app.is_member_of(t uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.barbers b
    where b.tenant_id = t
      and b.user_id = auth.uid()
      and b.is_active
  );
$$;

create or replace function app.is_owner_of(t uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.barbers b
    where b.tenant_id = t
      and b.user_id = auth.uid()
      and b.is_active
      and b.role = 'owner'
  );
$$;

-- El id de barbero del usuario logueado dentro de una barbería. Sirve para
-- "solo su propia agenda".
create or replace function app.my_barber_id(t uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select b.id from public.barbers b
  where b.tenant_id = t
    and b.user_id = auth.uid()
    and b.is_active
  limit 1;
$$;

grant usage on schema app to anon, authenticated;

-- RLS decide qué FILAS podés tocar, pero no qué COLUMNAS. Sin esto, la
-- política que deja a cada barbero editar su ficha lo dejaría también
-- cambiarse el rol a 'owner' y quedarse con la barbería.
create or replace function app.guard_barber_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if app.is_owner_of(new.tenant_id) then
    return new;  -- el dueño sí puede cambiar todo esto
  end if;

  if new.role is distinct from old.role
     or new.tenant_id is distinct from old.tenant_id
     or new.user_id is distinct from old.user_id
     or new.accepts_bookings is distinct from old.accepts_bookings
     or new.is_active is distinct from old.is_active then
    raise exception
      'Solo el dueño puede cambiar el rol, el estado o la asignación de un barbero';
  end if;

  return new;
end;
$$;

create trigger barbers_guard_update
  before update on public.barbers
  for each row execute function app.guard_barber_update();

-- El slug es la URL de la barbería, y esa URL ya circula por WhatsApp en
-- cuanto el primer cliente reserva. Cambiarlo rompe todos esos links a la vez,
-- sin aviso y sin forma de arreglarlo desde afuera. Se define una vez al dar
-- de alta la barbería y queda fijo.
--
-- custom_domain e is_active tampoco los toca el dueño: el dominio necesita
-- configuración de DNS de nuestro lado, y is_active es estado comercial, no
-- una preferencia de la barbería.
--
-- Los tres se cambian con service role, del lado del servidor, si hace falta.
create or replace function app.guard_tenant_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.slug is distinct from old.slug then
    raise exception
      'El slug no se puede cambiar: rompería los links que ya circulan';
  end if;

  if new.custom_domain is distinct from old.custom_domain then
    raise exception 'El dominio propio se configura del lado del servidor';
  end if;

  if new.is_active is distinct from old.is_active then
    raise exception 'El estado de la barbería no se cambia desde el panel';
  end if;

  return new;
end;
$$;

create trigger tenants_guard_update
  before update on public.tenants
  for each row execute function app.guard_tenant_update();


-- ============================================================================
-- 7. ROW LEVEL SECURITY
-- ============================================================================
alter table public.tenants       enable row level security;
alter table public.barbers       enable row level security;
alter table public.services      enable row level security;
alter table public.working_hours enable row level security;
alter table public.appointments  enable row level security;

-- ---- TENANTS ---------------------------------------------------------------
-- La página pública necesita leer marca y horarios sin login.
create policy "tenants: lectura pública de barberías activas"
  on public.tenants for select
  to anon, authenticated
  using (is_active);

create policy "tenants: el dueño edita su barbería"
  on public.tenants for update
  to authenticated
  using (app.is_owner_of(id))
  with check (app.is_owner_of(id));

-- Sin política de INSERT ni DELETE: dar de alta o borrar una barbería es
-- trabajo del alta comercial, con service role, del lado del servidor.

-- ---- BARBERS ---------------------------------------------------------------
create policy "barbers: lectura pública de quienes atienden"
  on public.barbers for select
  to anon
  using (
    is_active
    and accepts_bookings
    and exists (select 1 from public.tenants t where t.id = tenant_id and t.is_active)
  );

create policy "barbers: el equipo se ve entre sí"
  on public.barbers for select
  to authenticated
  using (app.is_member_of(tenant_id));

create policy "barbers: el dueño gestiona el equipo"
  on public.barbers for all
  to authenticated
  using (app.is_owner_of(tenant_id))
  with check (app.is_owner_of(tenant_id));

create policy "barbers: cada uno edita su propia ficha"
  on public.barbers for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- RLS filtra filas, no columnas. El teléfono del barbero es para el equipo,
-- no para el público, así que se recorta con permisos de columna.
revoke select on public.barbers from anon;
grant select (id, tenant_id, display_name, accepts_bookings, is_active, sort_order)
  on public.barbers to anon;

-- ---- SERVICES --------------------------------------------------------------
create policy "services: lectura pública de los activos"
  on public.services for select
  to anon, authenticated
  using (
    is_active
    and exists (select 1 from public.tenants t where t.id = tenant_id and t.is_active)
  );

create policy "services: el equipo ve todos, también los inactivos"
  on public.services for select
  to authenticated
  using (app.is_member_of(tenant_id));

create policy "services: solo el dueño toca precios y servicios"
  on public.services for all
  to authenticated
  using (app.is_owner_of(tenant_id))
  with check (app.is_owner_of(tenant_id));

-- ---- WORKING_HOURS ---------------------------------------------------------
-- Los horarios de atención son información pública: van en la página.
create policy "working_hours: lectura pública"
  on public.working_hours for select
  to anon, authenticated
  using (exists (select 1 from public.tenants t where t.id = tenant_id and t.is_active));

-- Acá vive la flexibilidad que se pidió: el dueño maneja los horarios de
-- todos, y cada barbero los suyos, sin depender de nadie.
create policy "working_hours: el dueño gestiona los de todo el equipo"
  on public.working_hours for all
  to authenticated
  using (app.is_owner_of(tenant_id))
  with check (app.is_owner_of(tenant_id));

create policy "working_hours: cada barbero gestiona el suyo"
  on public.working_hours for all
  to authenticated
  using (barber_id = app.my_barber_id(tenant_id))
  with check (barber_id = app.my_barber_id(tenant_id));

-- ---- APPOINTMENTS ----------------------------------------------------------
-- ⚠️ NINGUNA política para `anon`. Sin política, RLS niega todo.
-- Esta tabla tiene nombres, teléfonos y mails de clientes: el público no la
-- toca ni para leer. Los horarios libres se calculan del lado del servidor y
-- se devuelven ya masticados, sin datos de nadie.

create policy "appointments: el dueño ve toda la agenda"
  on public.appointments for all
  to authenticated
  using (app.is_owner_of(tenant_id))
  with check (app.is_owner_of(tenant_id));

create policy "appointments: el barbero ve y maneja solo la suya"
  on public.appointments for all
  to authenticated
  using (barber_id = app.my_barber_id(tenant_id))
  with check (barber_id = app.my_barber_id(tenant_id));


-- ============================================================================
-- Si llegaste hasta acá sin errores, se aplica todo junto.
-- ============================================================================
commit;
