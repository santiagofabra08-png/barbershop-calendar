-- ============================================================================
-- PANEL: ENTRAR, COBRAR Y SABER QUIÉN VINO
-- ============================================================================
-- Los permisos del panel ya existen desde el esquema inicial: `barbers.role`
-- separa dueño de barbero, y las políticas de RLS ya dicen que el dueño maneja
-- todo y cada barbero solo lo suyo. Esta migración no toca nada de eso.
--
-- Lo que agrega son las tres cosas que faltaban para que el panel exista:
--
--   1. MAIL — nadie puede entrar todavía, porque no hay forma de conectar una
--      persona con su fila en `barbers`.
--   2. CÓMO COBRA CADA UNO — hoy sabemos cuánto entró, pero no de quién es.
--   3. QUIÉN VINO — hoy un turno solo está confirmado o cancelado, así que el
--      que faltó suma plata que nadie cobró.
-- ============================================================================

begin;

-- ============================================================================
-- 0. LOS TELÉFONOS QUE QUEDARON A MEDIO NORMALIZAR
-- ============================================================================
-- La migración de validación dejó tres restricciones como NOT VALID para no
-- borrar los turnos de prueba que ya existían. NOT VALID no significa "esta
-- fila queda perdonada para siempre": significa "queda perdonada mientras
-- nadie la toque". Más abajo esta misma migración toca todos los turnos para
-- llenarles `source`, y ahí Postgres los revisa enteros.
--
-- Así que hay que terminar el trabajo antes de seguir. La normalización
-- anterior solo agarraba números de 8 o 9 dígitos; esta agarra cualquiera cuyos
-- últimos 8 dígitos sean un teléfono uruguayo posible.
update public.appointments
set client_phone = '+598' || right(regexp_replace(client_phone, '\D', '', 'g'), 8)
where client_phone is not null
  and client_phone !~ '^\+598[249][0-9]{7}$'
  and right(regexp_replace(client_phone, '\D', '', 'g'), 8) ~ '^[249][0-9]{7}$';

-- Con los datos ya limpios se cierra el círculo: las tres restricciones pasan a
-- estar validadas y la base garantiza, de acá en adelante, que TODO turno tiene
-- datos de contacto con forma. Si esto falla, hay una fila que la normalización
-- no supo arreglar —y es mejor enterarse ahora, con todo dentro de una
-- transacción que se deshace sola, que dentro de seis meses.
alter table public.appointments validate constraint client_phone_valido;
alter table public.appointments validate constraint client_email_valido;
alter table public.appointments validate constraint client_name_valido;


-- ============================================================================
-- 1. MAIL DEL BARBERO
-- ============================================================================
-- Guardar el mail acá NO es duplicar el de `auth.users`. Son dos momentos
-- distintos: el dueño da de alta a Nico con su mail un martes, y Nico crea su
-- cuenta el jueves. Entre esos dos días la fila existe y la cuenta no. Este
-- campo es a quién se invitó; `user_id` es quién aceptó.
alter table public.barbers add column email text;

alter table public.barbers
  add constraint barbers_email_valido check (
    email is null
    or (email = lower(email)
        and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$')
  );

-- Dos barberos de la misma barbería no pueden compartir mail: sería una sola
-- cuenta con dos agendas y no habría forma de saber cuál abrir. En barberías
-- distintas sí, que es la misma persona trabajando en dos lados.
create unique index barbers_email_unico on public.barbers (tenant_id, email)
  where email is not null;


-- ============================================================================
-- 2. CÓMO COBRA CADA UNO
-- ============================================================================
-- Cuatro arreglos, que son los que realmente se usan en una barbería:
--
--   commission   — se lleva un % de lo que corta. Lo más común con empleados.
--   salary       — cobra un fijo por semana o por mes, corte más, corte menos.
--   chair_rent   — le paga un fijo AL LOCAL y se queda con todo lo que corta.
--   revenue_only — no se reparte nada acá. Es el caso del dueño que se queda
--                  con la caja, y el de quien prefiere arreglarlo por afuera.
--
-- Va por barbero, no por barbería, porque en un local conviven arreglos
-- distintos: el dueño se queda con todo, uno va a comisión y el de los sábados
-- alquila la silla. Poniéndolo en la barbería esos tres no entrarían.

alter table public.barbers
  add column payment_model text not null default 'revenue_only'
    check (payment_model in ('commission', 'salary', 'chair_rent', 'revenue_only')),

  -- Solo para 'commission'. Con decimales porque 33.33% existe.
  add column commission_percent numeric(5,2)
    check (commission_percent is null or commission_percent between 0 and 100),

  -- Solo para 'salary' y 'chair_rent'. El modelo define la dirección: en
  -- 'salary' el local le paga, en 'chair_rent' él le paga al local. Es el mismo
  -- número con el signo cambiado, así que una sola columna alcanza.
  add column pay_amount_cents int
    check (pay_amount_cents is null or pay_amount_cents >= 0),
  add column pay_period text
    check (pay_period is null or pay_period in ('week', 'month'));

-- Cada modelo exige sus propios datos y prohíbe los del otro. Sin esto se puede
-- guardar un barbero "a sueldo" con un 50% de comisión colgado, y a la hora de
-- liquidar no hay forma de saber cuál de los dos era el verdadero.
alter table public.barbers
  add constraint payment_model_coherente check (
    (payment_model = 'commission'
      and commission_percent is not null
      and pay_amount_cents is null and pay_period is null)
    or
    (payment_model in ('salary', 'chair_rent')
      and pay_amount_cents is not null and pay_period is not null
      and commission_percent is null)
    or
    (payment_model = 'revenue_only'
      and commission_percent is null
      and pay_amount_cents is null and pay_period is null)
  );

-- El arreglo habitual de la barbería. No se usa para calcular nada: solo
-- pre-completa el formulario cuando se da de alta a alguien nuevo, para que en
-- el caso normal —todos cobran igual— se configure una vez y listo.
alter table public.tenants
  add column default_payment_model text not null default 'revenue_only'
    check (default_payment_model in ('commission', 'salary', 'chair_rent', 'revenue_only'));


-- ---- La comisión se congela en cada turno ----------------------------------
-- Misma razón por la que ya se congelan el precio y la duración: si en agosto
-- Nico pasa de 50% a 55%, la liquidación de julio no puede cambiar sola. Lo que
-- se pagó, se pagó.
alter table public.appointments
  add column barber_commission_percent numeric(5,2)
    check (barber_commission_percent is null
           or barber_commission_percent between 0 and 100);

-- Lo llena un trigger y no la aplicación, a propósito. Hoy los turnos entran
-- por `crear_reserva`, pero mañana entran también por el panel, y en algún
-- momento por algo que todavía no existe. Puesto acá abajo, ninguno de esos
-- caminos puede olvidarse: no hay forma de insertar un turno sin que se congele.
create or replace function app.freeze_commission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kind = 'booking' and new.barber_commission_percent is null then
    select b.commission_percent into new.barber_commission_percent
    from public.barbers b
    where b.id = new.barber_id;
  end if;
  return new;
end;
$$;

-- Si el barbero no está a comisión, queda en null. Null acá significa "a este
-- turno no le corresponde comisión", que es distinto de 0%.
create trigger appointments_freeze_commission
  before insert on public.appointments
  for each row execute function app.freeze_commission();


-- ============================================================================
-- 3. QUIÉN VINO Y QUIÉN CAYÓ SIN AVISAR
-- ============================================================================

-- ---- De dónde salió el turno -----------------------------------------------
-- 'online' — lo reservó el cliente desde la página.
-- 'panel'  — lo cargó el barbero, casi siempre alguien que cayó sin reservar.
--
-- No es solo estadística: define qué datos son obligatorios. Al que reserva por
-- la web se le piden nombre, teléfono y mail. Al que entra por la puerta un
-- martes a las tres no se le va a pedir el mail para anotarle el corte.
alter table public.appointments
  add column source text
    check (source is null or source in ('online', 'panel'));

update public.appointments set source = 'online' where kind = 'booking';

-- ---- El que no vino --------------------------------------------------------
-- 'no_show' es un turno que existió y no se cobró. No es lo mismo que
-- cancelado: el cancelado avisó y liberó el horario; el no_show ocupó la silla
-- de alguien más. Al dueño le importa la diferencia, y bastante.
--
-- El check de la columna `status` es de los que nombra Postgres solo cuando se
-- declara pegado a la columna: <tabla>_<columna>_check.
alter table public.appointments drop constraint appointments_status_check;
alter table public.appointments
  add constraint appointments_status_check
    check (status in ('confirmed', 'cancelled', 'no_show'));

-- La versión anterior decía "cancelado ⇔ tiene fecha de cancelación" enumerando
-- los dos estados posibles. Con un tercer estado eso ya no cierra, así que pasa
-- a decir lo mismo sin enumerar nada.
alter table public.appointments drop constraint cancelled_at_coherente;
alter table public.appointments
  add constraint cancelled_at_coherente
    check ((status = 'cancelled') = (cancelled_at is not null));

-- La coherencia de campos se reescribe entera para contemplar el turno cargado
-- a mano, que puede no tener datos de contacto.
alter table public.appointments drop constraint appointment_campos_coherentes;
alter table public.appointments
  add constraint appointment_campos_coherentes check (
    (kind = 'booking'
      and source is not null
      and service_id is not null
      and price_cents is not null
      and duration_minutes is not null
      -- Por la web siempre hay con quién contactarse. Cargado a mano, el
      -- nombre es lo único que se pide, y ni eso es obligatorio.
      and (source = 'panel'
           or (client_name is not null
               and client_phone is not null
               and client_email is not null)))
    or
    (kind = 'block'
      and source is null
      and service_id is null
      and client_name is null
      and client_phone is null
      and client_email is null
      -- Un bloqueo es un rato tapado en la agenda. No hay nadie que pueda
      -- faltar, así que no puede quedar como 'no_show'.
      and status <> 'no_show')
  );

-- La consulta del recuento semanal: los turnos de la barbería en un rango de
-- fechas, cobrados y no cobrados, sin los cancelados —que no son trabajo.
create index appointments_liquidacion_idx
  on public.appointments (tenant_id, starts_at)
  where kind = 'booking' and status <> 'cancelled';


-- ============================================================================
-- 4. QUE NADIE SE AUTOAJUSTE EL SUELDO
-- ============================================================================
-- Sin esto, la política "cada uno edita su propia ficha" deja a Nico ponerse
-- 100% de comisión. Es la misma clase de agujero que ya tapamos con el rol:
-- RLS decide qué FILAS podés tocar, pero no qué COLUMNAS, y la fila es suya.
--
-- Se agrega además una salida al principio: cuando no hay usuario logueado, la
-- operación viene del servidor con service role —invitar a un barbero, o esta
-- misma migración— y ahí el guardia no aplica. Por `anon` no se cuela: `anon`
-- no tiene ninguna política de UPDATE sobre `barbers`, así que nunca llega
-- hasta acá.
create or replace function app.guard_barber_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new;  -- servidor con service role
  end if;

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

  if new.payment_model is distinct from old.payment_model
     or new.commission_percent is distinct from old.commission_percent
     or new.pay_amount_cents is distinct from old.pay_amount_cents
     or new.pay_period is distinct from old.pay_period then
    raise exception 'Solo el dueño puede cambiar cómo cobra un barbero';
  end if;

  -- El mail es con qué se invita a entrar. Cambiárselo a uno mismo es abrirle
  -- la puerta a otro.
  if new.email is distinct from old.email then
    raise exception 'Solo el dueño puede cambiar el mail de un barbero';
  end if;

  return new;
end;
$$;

-- Las columnas nuevas de `barbers` NO hace falta esconderlas del público a
-- mano: `anon` tiene permiso de lectura sobre una lista cerrada de columnas
-- (id, tenant_id, display_name, accepts_bookings, is_active, sort_order), y lo
-- que no está en esa lista no se ve. El mail y el sueldo quedan afuera solos.

commit;
