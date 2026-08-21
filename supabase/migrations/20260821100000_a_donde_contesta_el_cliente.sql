-- A dónde llega la respuesta de un cliente.
--
-- `turnos@turnosforbarber.com` es un remitente, no una casilla: nadie la lee.
-- Cuando una clienta contesta la confirmación diciendo "no voy a poder ir", ese
-- mensaje termina en el reenvío de Porkbun, o sea en la casilla de Santiago, y
-- la barbería se entera cuando el turno no aparece.
--
-- Con esto el mail sigue saliendo desde `turnos@` —que es lo que hace que
-- llegue, porque ese dominio está verificado en Resend— pero al tocar
-- "Responder" el correo se escribe al local.

begin;

alter table public.tenants
  add column reply_to_email text
    check (
      reply_to_email is null
      or reply_to_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    );

-- ⚠️ `tenants` tiene lectura pública sin restricción de columnas, así que esto
-- lo lee cualquiera. Acá está bien y no es un descuido: una dirección de
-- respuesta viaja en el encabezado de cada mail que sale, así que ya es
-- pública por definición. Guardarla no expone nada que el mail no exponga.
--
-- La distinción importa para la próxima columna: si alguna vez hace falta
-- guardar algo del local que NO tenga que ver el público, esta tabla no es el
-- lugar sin recortar los permisos por columna como se hizo en `barbers`.

-- Arranca con el mail del dueño, que es lo que hay. Si la barbería tiene una
-- casilla aparte, se cambia desde Ajustes.
update public.tenants t
set reply_to_email = (
  select b.email
  from public.barbers b
  where b.tenant_id = t.id
    and b.role = 'owner'
    and b.email is not null
  order by b.created_at
  limit 1
)
where reply_to_email is null;

commit;
