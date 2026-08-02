-- ============================================================================
-- EL PÚBLICO NO VE EL MAIL NI EL TELÉFONO DEL BARBERO
-- ============================================================================
-- La página pública muestra quién atiende, así que `anon` tiene que poder leer
-- `barbers`. La política que lo permite es del esquema inicial y estaba bien
-- para las columnas de entonces: nombre, si toma reservas, orden.
--
-- Después le agregamos `email` —para darle acceso al panel— y ya estaba
-- `phone`. Row Level Security decide QUÉ FILAS se ven, no qué columnas: desde
-- ese día, cualquiera con la clave pública podía pedirle a PostgREST el mail y
-- el teléfono de todos los barberos de todas las barberías del sistema. La
-- página no los muestra, pero la API no se lo impedía a nadie.
--
-- Se arregla con permisos de columna, que es la herramienta que corresponde:
-- RLS filtra filas, GRANT filtra columnas. Se listan las que la página pública
-- necesita y ninguna más.
--
-- ⚠️ Al agregar una columna que el público tenga que ver, hay que sumarla acá.
-- Si no, la página deja de mostrarla —falla ruidosamente, que es lo correcto—.
-- ============================================================================

begin;

-- Se revoca el permiso de tabla entero y se vuelve a dar columna por columna.
-- Revocar una sola columna sobre un permiso de tabla no hace nada: Postgres
-- avisa que no había nada que revocar y el mail queda a la vista igual.
revoke select on public.barbers from anon;

grant select (
  id,
  tenant_id,
  display_name,
  accepts_bookings,
  is_active,
  sort_order
) on public.barbers to anon;

commit;
