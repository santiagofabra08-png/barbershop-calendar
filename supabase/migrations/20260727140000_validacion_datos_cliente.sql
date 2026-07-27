-- ============================================================================
-- VALIDACIÓN DE LOS DATOS DEL CLIENTE
-- ============================================================================
-- La aplicación ya valida antes de llegar acá, con mensajes claros. Esto es la
-- red de abajo: da igual qué código inserte —el formulario, un script, el
-- panel, algo que escribamos dentro de un año—, un turno no entra con un
-- teléfono inventado.
--
-- Si alguna de estas restricciones salta en producción, significa que hay un
-- camino que se saltea la validación de la app. Es una señal, no un estorbo.
-- ============================================================================

begin;

-- ---- Primero, normalizar lo que ya está guardado ---------------------------
-- Los turnos anteriores a esta migración tienen el teléfono como lo escribió
-- cada uno. Los que se puedan interpretar como uruguayos pasan al formato
-- internacional; los que no, quedan como están y los deja pasar el NOT VALID
-- de más abajo.
update public.appointments
set client_phone = '+598' || right(regexp_replace(client_phone, '\D', '', 'g'), 8)
where client_phone is not null
  and client_phone !~ '^\+598[249][0-9]{7}$'
  and length(regexp_replace(client_phone, '\D', '', 'g')) in (8, 9)
  and right(regexp_replace(client_phone, '\D', '', 'g'), 8) ~ '^[249][0-9]{7}$';

-- ---- Las restricciones -----------------------------------------------------
-- Van como NOT VALID a propósito. Eso NO las debilita para lo que viene: toda
-- fila nueva y toda fila que se modifique se revisa igual. Lo único que evita
-- es que Postgres recorra el historial viejo y se niegue a aplicar la
-- migración por un turno de prueba de hace meses.
--
-- Cuando los datos viejos estén limpios, se cierra el círculo con:
--   alter table public.appointments validate constraint client_phone_valido;

alter table public.appointments

  -- El teléfono se guarda normalizado en formato internacional. La app lo
  -- convierte: "099 123 456", "+598 99 123 456" y "59899123456" terminan
  -- todos como +59899123456.
  --   9 = celular · 2 = fijo de Montevideo · 4 = fijo del interior
  add constraint client_phone_valido check (
    client_phone is null
    or client_phone ~ '^\+598[249][0-9]{7}$'
  ) not valid,

  -- Algo antes del @, un dominio con punto, y una terminación de letras.
  add constraint client_email_valido check (
    client_email is null
    or client_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$'
  ) not valid,

  -- Un nombre tiene al menos dos letras. "123" y "..." no son un nombre.
  add constraint client_name_valido check (
    client_name is null
    or (
      length(btrim(client_name)) between 2 and 60
      and btrim(client_name) ~ '[[:alpha:]].*[[:alpha:]]'
    )
  ) not valid;

commit;
