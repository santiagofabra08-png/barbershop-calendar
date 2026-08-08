-- ============================================================================
-- SOLICITUDES DE ALTA
-- ============================================================================
-- Quién pidió probar el producto desde la portada.
--
-- Hasta ahora el único camino era WhatsApp: el botón abría un chat y listo. Eso
-- pierde a todo el que no quiere escribirle por WhatsApp a un desconocido, que
-- en tráfico frío desde Instagram es bastante gente. Con el formulario, dejan
-- los datos y Santiago los contacta.
--
-- Esta tabla NO tiene tenant_id, y es la primera del esquema que no lo tiene.
-- No es un olvido: una solicitud existe justamente porque todavía no hay
-- barbería. Es del negocio de vender el producto, no de operar un local.
--
-- Por eso tampoco hay políticas de RLS que dejen ver o escribir a nadie. Se
-- prende RLS y no se otorga nada: sin políticas, ni `anon` ni `authenticated`
-- pueden leer ni escribir una fila. La única puerta es la Server Action de la
-- portada, que corre en el servidor con la llave de servicio.
--
-- Es más cerrado que una función `security definer` —que sí deja escribir a
-- cualquiera con la clave pública— y acá se puede, porque el formulario no se
-- envía desde el navegador sino contra el servidor.
--
-- Lo que hay adentro son datos personales de alguien que todavía no es cliente:
-- nombre, teléfono y mail. Menos manos lo toquen, mejor.
-- ============================================================================

begin;

create table public.signup_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  -- Cómo se llama la barbería. Es lo primero que se le pregunta porque es lo
  -- que la persona vino a resolver, y lo que va a ser su subdominio.
  shop_name text not null,
  contact_name text not null,
  -- Normalizado como +598XXXXXXXX, igual que el resto del sistema: es lo que
  -- necesita el link de WhatsApp para escribirle.
  phone text not null,
  email text not null,
  -- Opcional. Alguien que cuenta su caso en dos líneas vale más que uno que
  -- solo deja el nombre, y conviene tener dónde leerlo.
  message text,

  -- En qué está. Nadie se borra: una solicitud descartada también es
  -- información —cuántos se cayeron y por qué—.
  status text not null default 'new',
  -- Lo que anota Santiago después de hablar con la persona.
  notes text,

  -- Cuando se concreta, qué barbería salió de acá. Queda en null si no se
  -- concretó, y se pone en null solo si esa barbería se borra: perder la
  -- solicitud por borrar el local sería perder el historial de la venta.
  tenant_id uuid references public.tenants(id) on delete set null,

  -- Las mismas reglas que valida el formulario y revalida el servidor. Esta es
  -- la tercera capa: la que no se puede saltear ni con la llave de servicio.
  constraint signup_requests_shop_name_no_vacio
    check (length(btrim(shop_name)) between 2 and 80),
  constraint signup_requests_contact_name_no_vacio
    check (length(btrim(contact_name)) between 2 and 60),
  constraint signup_requests_phone_e164
    check (phone ~ '^\+[0-9]{8,15}$'),
  constraint signup_requests_email_con_arroba
    check (position('@' in email) > 1 and length(email) <= 254),
  constraint signup_requests_message_corto
    check (message is null or length(message) <= 1000),
  constraint signup_requests_status_valido
    check (status in ('new', 'contacted', 'created', 'discarded'))
);

-- Se miran las nuevas primero, que es lo único que se hace con esta tabla.
create index signup_requests_pendientes_idx
  on public.signup_requests (created_at desc)
  where status = 'new';

-- RLS prendido y sin una sola política: nadie pasa. La llave de servicio saltea
-- RLS por definición, así que la Server Action sigue funcionando.
--
-- Es a propósito que quede así de cerrado. Si algún día hay una pantalla para
-- mirar las solicitudes, va a necesitar su propia política —y en ese momento
-- hay que pensar quién es "yo" en un sistema donde todas las cuentas son de
-- barberos de algún local—.
alter table public.signup_requests enable row level security;

commit;
