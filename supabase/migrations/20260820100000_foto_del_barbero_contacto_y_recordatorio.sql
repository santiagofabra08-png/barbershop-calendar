-- Tres cosas que pidió AL Studio, la primera barbería real.
--
-- Van juntas en una migración porque son tres columnas sueltas y ninguna
-- depende de la otra: aplicarlas de a una es tres viajes al SQL Editor sin
-- ganar nada.

begin;

-- ============================================================================
-- 1. LA FOTO DEL BARBERO
-- ============================================================================
-- Al elegir con quién reservar hoy se ve la inicial en un círculo. La gente
-- elige barbero por la cara, así que ahí va la foto.
--
-- Nullable y sin default: la mayoría de las barberías no va a subir ninguna, y
-- la inicial tiene que seguir funcionando. La foto es un lujo, no un requisito.

alter table public.barbers
  add column photo_url text;

-- ⚠️ RLS filtra filas, `grant` filtra columnas. `barbers` es público para
-- `anon` —la página muestra quién atiende— y por eso el mail y el teléfono del
-- barbero están fuera del grant. La foto SÍ entra: es exactamente lo que se
-- muestra. Sin esta línea, la columna existe y el público no la ve.
grant select (photo_url) on public.barbers to anon;

-- ============================================================================
-- 2. EL WHATSAPP Y EL INSTAGRAM DEL LOCAL
-- ============================================================================
-- Para el botón flotante que acompaña toda la página. Hasta ahora el único
-- teléfono de la base era el del barbero, que es para el equipo y no para el
-- público: éste es el del local, y es público a propósito.
--
-- ⚠️ `tenants` tiene lectura pública para `anon` SIN restricción de columnas,
-- así que todo lo que se agregue acá lo lee cualquiera. Estas dos están para
-- eso; una columna sensible en esta tabla necesitaría el mismo tratamiento de
-- columnas que tiene `barbers`.

alter table public.tenants
  -- Normalizado como el resto de los teléfonos del sistema, que es lo que
  -- necesita el link de wa.me: +598XXXXXXXX.
  add column whatsapp_phone text
    check (whatsapp_phone is null or whatsapp_phone ~ '^\+[0-9]{8,15}$'),

  -- La URL entera y no el usuario: un usuario obliga a armar la dirección en
  -- el código, y el día que Instagram cambie de forma hay que tocar el código
  -- de todas las barberías. El check impide que alguien pegue cualquier cosa.
  add column instagram_url text
    check (
      instagram_url is null
      or instagram_url ~ '^https://(www\.)?instagram\.com/[A-Za-z0-9._]+/?$'
    );

-- ============================================================================
-- 3. EL RECORDATORIO POR MAIL
-- ============================================================================
-- Un mail dos horas antes del turno, con el mismo link para cancelar. La marca
-- va en el turno y no en una tabla aparte porque es estado de ese turno.
--
-- Es lo único que impide mandarlo dos veces: la tarea que los manda corre cada
-- pocos minutos, y sin esta columna cada corrida volvería a escribirle a la
-- misma persona.

alter table public.appointments
  add column reminder_sent_at timestamptz;

-- Buscar "los turnos que empiezan pronto y todavía no avisamos" tiene que ser
-- barato: la tarea lo pregunta cada pocos minutos y para siempre. El índice
-- parcial deja afuera los bloqueos, los cancelados y todo lo ya avisado, que
-- con el tiempo es la enorme mayoría de la tabla.
create index appointments_pendientes_de_recordar
  on public.appointments (starts_at)
  where kind = 'booking'
    and status = 'confirmed'
    and reminder_sent_at is null;

commit;
