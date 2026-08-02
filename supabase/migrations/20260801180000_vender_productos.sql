-- ============================================================================
-- VENDER PRODUCTOS
-- ============================================================================
-- Las tablas ya están. Acá va el comportamiento: descontar stock sin que dos
-- ventas simultáneas vendan la misma última cera, partir el total entre
-- servicios y productos para que la comisión salga de donde tiene que salir, y
-- sumar el mostrador al cierre de caja.
-- ============================================================================

begin;

-- ============================================================================
-- Descontar stock
-- ============================================================================
-- El descuento va en un solo UPDATE con la condición adentro. Leer el stock,
-- decidir, y después restar deja una ventana entre la lectura y la resta: si
-- dos personas cobran la última cera en el mismo instante, las dos leen 1 y las
-- dos restan. Con la condición adentro, la segunda no toca ninguna fila y se
-- entera por el contador.
create or replace function app.sacar_stock(
  p_producto uuid,
  p_tenant uuid,
  p_cantidad int
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_tocadas int;
  v_nombre  text;
begin
  update public.products
  set stock = stock - p_cantidad
  where id = p_producto
    and tenant_id = p_tenant
    and stock >= p_cantidad;

  get diagnostics v_tocadas = row_count;

  if v_tocadas = 0 then
    select name into v_nombre from public.products where id = p_producto;
    raise exception 'No queda stock suficiente de %', coalesce(v_nombre, 'ese producto');
  end if;
end;
$$;

/** Devuelve stock. Se usa al anular un cobro o una venta. */
create or replace function app.devolver_stock(
  p_producto uuid,
  p_tenant uuid,
  p_cantidad int
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  update public.products
  set stock = stock + p_cantidad
  where id = p_producto and tenant_id = p_tenant;
end;
$$;


-- ============================================================================
-- Cobrar un turno, ahora con productos
-- ============================================================================
-- Cambia la firma, así que la versión anterior se borra en vez de convivir.
--
--   p_extras    — servicios y descuentos, por id, repetibles
--   p_productos — [{"id": "...", "qty": 2}, ...]
drop function if exists public.cobrar_turno(uuid, uuid[], text);

create or replace function public.cobrar_turno(
  p_appointment_id uuid,
  p_extras uuid[],
  p_payment_method text,
  p_productos jsonb default '[]'::jsonb
)
returns int
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_ap        public.appointments%rowtype;
  v_s         public.services%rowtype;
  v_p         public.products%rowtype;
  v_extra     uuid;
  v_item      jsonb;
  v_qty       int;
  v_monto     int;
  v_servicios int;
  v_productos int := 0;
  v_orden     int := 0;
begin
  select * into v_ap from public.appointments where id = p_appointment_id;
  if not found then
    raise exception 'Ese turno no existe';
  end if;

  if not app.is_member_of(v_ap.tenant_id) then
    raise exception 'No trabajás en esa barbería';
  end if;

  if app.caja_cerrada(v_ap.tenant_id, app.fecha_local(v_ap.starts_at, v_ap.tenant_id)) then
    raise exception 'La caja de ese día ya está cerrada';
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

  -- ---- Renglón 1: lo que vino a hacerse, al precio que se le dijo ---------
  insert into public.appointment_items
    (tenant_id, appointment_id, service_id, name, amount_cents, quantity, sort_order)
  select v_ap.tenant_id, v_ap.id, s.id, s.name, v_ap.price_cents, 1, 0
  from public.services s
  where s.id = v_ap.service_id;

  v_servicios := v_ap.price_cents;

  -- ---- Servicios agregados y descuentos -----------------------------------
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
      (tenant_id, appointment_id, service_id, name, amount_cents, quantity, sort_order)
    values (v_ap.tenant_id, v_ap.id, v_s.id, v_s.name, v_monto, 1, v_orden);

    -- Los descuentos restan de los servicios, no de los productos: es el caso
    -- real —"te hago menos el corte"— y evita que un descuento le baje la
    -- comisión al barbero por algo que no cortó.
    v_servicios := v_servicios + v_monto;
  end loop;

  -- ---- Productos -----------------------------------------------------------
  for v_item in select * from jsonb_array_elements(coalesce(p_productos, '[]'::jsonb)) loop
    select * into v_p
    from public.products
    where id = (v_item ->> 'id')::uuid
      and tenant_id = v_ap.tenant_id
      and is_active;

    if not found then
      raise exception 'Uno de los productos ya no está a la venta';
    end if;

    v_qty := greatest(1, coalesce((v_item ->> 'qty')::int, 1));
    perform app.sacar_stock(v_p.id, v_ap.tenant_id, v_qty);

    v_orden := v_orden + 1;
    v_monto := v_p.price_cents * v_qty;

    insert into public.appointment_items
      (tenant_id, appointment_id, product_id, name, amount_cents, quantity, sort_order)
    values (v_ap.tenant_id, v_ap.id, v_p.id, v_p.name, v_monto, v_qty, v_orden);

    v_productos := v_productos + v_monto;
  end loop;

  if v_servicios < 0 then
    raise exception 'El descuento es más grande que lo que se hizo';
  end if;

  update public.appointments
  set charged_at = now(),
      charged_total_cents = v_servicios + v_productos,
      charged_services_cents = v_servicios,
      charged_products_cents = v_productos,
      payment_method = p_payment_method
  where id = v_ap.id;

  return v_servicios + v_productos;
end;
$$;

-- Anular devuelve el stock antes de borrar los renglones. Si no, la cera vuelve
-- al mostrador pero el sistema sigue creyendo que se vendió.
create or replace function public.anular_cobro(p_appointment_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_ap public.appointments%rowtype;
  v_it public.appointment_items%rowtype;
begin
  select * into v_ap from public.appointments where id = p_appointment_id;
  if not found then
    raise exception 'Ese turno no existe';
  end if;

  if not app.is_member_of(v_ap.tenant_id) then
    raise exception 'No trabajás en esa barbería';
  end if;

  if app.caja_cerrada(v_ap.tenant_id, app.fecha_local(v_ap.starts_at, v_ap.tenant_id)) then
    raise exception 'La caja de ese día ya está cerrada';
  end if;

  for v_it in
    select * from public.appointment_items
    where appointment_id = v_ap.id and product_id is not null
  loop
    perform app.devolver_stock(v_it.product_id, v_ap.tenant_id, v_it.quantity);
  end loop;

  delete from public.appointment_items where appointment_id = v_ap.id;

  update public.appointments
  set charged_at = null,
      charged_total_cents = null,
      charged_services_cents = null,
      charged_products_cents = null,
      payment_method = null
  where id = v_ap.id;
end;
$$;


-- ============================================================================
-- Venta de mostrador
-- ============================================================================
/**
 * Vende productos sin turno de por medio.
 *
 * Los precios los pone la base. Del navegador solo viajan qué producto y
 * cuántos: si viajara el precio, cualquiera podría comprarse una cera a $1.
 */
create or replace function public.vender_mostrador(
  p_tenant_slug text,
  p_productos jsonb,
  p_payment_method text,
  p_nota text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_tenant public.tenants%rowtype;
  v_p      public.products%rowtype;
  v_item   jsonb;
  v_qty    int;
  v_venta  uuid;
  v_total  int := 0;
  v_orden  int := 0;
  v_hoy    date;
begin
  select * into v_tenant from public.tenants where slug = p_tenant_slug;
  if not found then
    raise exception 'Esa barbería no existe';
  end if;

  if not app.is_member_of(v_tenant.id) then
    raise exception 'No trabajás en esa barbería';
  end if;

  if p_payment_method not in ('cash', 'card', 'transfer') then
    raise exception 'Falta con qué pagó';
  end if;

  -- La venta es de ahora, así que cae en el día de hoy. Si la caja de hoy ya
  -- está cerrada, cobrar algo más la descuadraría.
  v_hoy := (now() at time zone v_tenant.timezone)::date;
  if app.caja_cerrada(v_tenant.id, v_hoy) then
    raise exception 'La caja de hoy ya está cerrada';
  end if;

  if jsonb_array_length(coalesce(p_productos, '[]'::jsonb)) = 0 then
    raise exception 'No hay nada para vender';
  end if;

  insert into public.counter_sales
    (tenant_id, total_cents, payment_method, sold_by, note)
  values
    (v_tenant.id, 0, p_payment_method, app.my_barber_id(v_tenant.id),
     nullif(btrim(p_nota), ''))
  returning id into v_venta;

  for v_item in select * from jsonb_array_elements(p_productos) loop
    select * into v_p
    from public.products
    where id = (v_item ->> 'id')::uuid
      and tenant_id = v_tenant.id
      and is_active;

    if not found then
      raise exception 'Uno de los productos ya no está a la venta';
    end if;

    v_qty := greatest(1, coalesce((v_item ->> 'qty')::int, 1));
    perform app.sacar_stock(v_p.id, v_tenant.id, v_qty);

    v_orden := v_orden + 1;

    insert into public.counter_sale_items
      (tenant_id, sale_id, product_id, name, unit_price_cents, quantity, amount_cents, sort_order)
    values
      (v_tenant.id, v_venta, v_p.id, v_p.name, v_p.price_cents, v_qty,
       v_p.price_cents * v_qty, v_orden);

    v_total := v_total + v_p.price_cents * v_qty;
  end loop;

  update public.counter_sales set total_cents = v_total where id = v_venta;

  return v_venta;
end;
$$;

/** Deshace una venta de mostrador y devuelve el stock. */
create or replace function public.anular_venta(p_sale_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_venta public.counter_sales%rowtype;
  v_it    public.counter_sale_items%rowtype;
  v_fecha date;
begin
  select * into v_venta from public.counter_sales where id = p_sale_id;
  if not found then
    raise exception 'Esa venta no existe';
  end if;

  if not app.is_member_of(v_venta.tenant_id) then
    raise exception 'No trabajás en esa barbería';
  end if;

  v_fecha := app.fecha_local(v_venta.sold_at, v_venta.tenant_id);
  if app.caja_cerrada(v_venta.tenant_id, v_fecha) then
    raise exception 'La caja de ese día ya está cerrada';
  end if;

  for v_it in
    select * from public.counter_sale_items
    where sale_id = v_venta.id and product_id is not null
  loop
    perform app.devolver_stock(v_it.product_id, v_venta.tenant_id, v_it.quantity);
  end loop;

  delete from public.counter_sales where id = v_venta.id;
end;
$$;


-- ============================================================================
-- El cierre suma también el mostrador
-- ============================================================================
-- Sin esto, cada cera vendida aparecería como plata que sobra en el conteo, que
-- es exactamente el problema que el cierre venía a resolver.
create or replace function public.cerrar_caja(
  p_tenant_slug text,
  p_fecha date,
  p_contado_cash int,
  p_contado_card int,
  p_contado_transfer int,
  p_nota text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_tenant     public.tenants%rowtype;
  v_pendientes int;
  v_cash       int;
  v_card       int;
  v_transfer   int;
begin
  select * into v_tenant from public.tenants where slug = p_tenant_slug;
  if not found then
    raise exception 'Esa barbería no existe';
  end if;

  if not app.is_member_of(v_tenant.id) then
    raise exception 'No trabajás en esa barbería';
  end if;

  if app.caja_cerrada(v_tenant.id, p_fecha) then
    raise exception 'La caja de ese día ya está cerrada';
  end if;

  if p_contado_cash < 0 or p_contado_card < 0 or p_contado_transfer < 0 then
    raise exception 'Los montos contados no pueden ser negativos';
  end if;

  select count(*) into v_pendientes
  from public.appointments a
  where a.tenant_id = v_tenant.id
    and a.kind = 'booking'
    and a.status = 'confirmed'
    and a.charged_at is null
    and (a.starts_at at time zone v_tenant.timezone)::date = p_fecha;

  if v_pendientes > 0 then
    raise exception 'Quedan % turnos sin cobrar. Cobralos o marcá que no vinieron.', v_pendientes;
  end if;

  select
    coalesce(sum(x.total) filter (where x.medio = 'cash'), 0),
    coalesce(sum(x.total) filter (where x.medio = 'card'), 0),
    coalesce(sum(x.total) filter (where x.medio = 'transfer'), 0)
  into v_cash, v_card, v_transfer
  from (
    select a.payment_method as medio, a.charged_total_cents as total
    from public.appointments a
    where a.tenant_id = v_tenant.id
      and a.charged_at is not null
      and (a.starts_at at time zone v_tenant.timezone)::date = p_fecha

    union all

    select s.payment_method, s.total_cents
    from public.counter_sales s
    where s.tenant_id = v_tenant.id
      and (s.sold_at at time zone v_tenant.timezone)::date = p_fecha
  ) x;

  insert into public.cash_closures (
    tenant_id, business_date,
    expected_cash_cents, expected_card_cents, expected_transfer_cents,
    counted_cash_cents, counted_card_cents, counted_transfer_cents,
    note, closed_by
  ) values (
    v_tenant.id, p_fecha,
    v_cash, v_card, v_transfer,
    p_contado_cash, p_contado_card, p_contado_transfer,
    nullif(btrim(p_nota), ''), app.my_barber_id(v_tenant.id)
  );
end;
$$;


-- ============================================================================
-- El pedido de la web
-- ============================================================================
/**
 * Levanta un pedido desde el catálogo público.
 *
 * NO es una venta: no descuenta stock, no toca la caja, no promete nada. Es un
 * cliente diciendo "quiero esto, llamame". Por eso el único requisito es que se
 * pueda contestar: nombre y teléfono.
 *
 * Los precios se congelan tal como los vio el cliente en la página, para que
 * cuando lo llamen sepan de qué precio estaba hablando.
 */
create or replace function public.crear_pedido(
  p_tenant_slug text,
  p_productos jsonb,
  p_nombre text,
  p_telefono text,
  p_email text default null,
  p_nota text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_tenant public.tenants%rowtype;
  v_p      public.products%rowtype;
  v_item   jsonb;
  v_qty    int;
  v_pedido uuid;
  v_cuantos int := 0;
begin
  select * into v_tenant
  from public.tenants
  where slug = p_tenant_slug and is_active and products_enabled;

  if not found then
    raise exception 'Esta barbería no está vendiendo productos';
  end if;

  p_nombre   := nullif(btrim(p_nombre), '');
  p_telefono := nullif(btrim(p_telefono), '');
  p_email    := nullif(btrim(lower(p_email)), '');

  if p_nombre is null or p_telefono is null then
    raise exception 'Faltan tu nombre y tu teléfono';
  end if;

  if p_telefono !~ '^\+598[249][0-9]{7}$' then
    raise exception 'Ese teléfono no parece válido';
  end if;

  if p_email is not null
     and p_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$' then
    raise exception 'Ese mail no parece válido';
  end if;

  insert into public.product_orders
    (tenant_id, client_name, client_phone, client_email, note)
  values
    (v_tenant.id, p_nombre, p_telefono, p_email, nullif(btrim(p_nota), ''))
  returning id into v_pedido;

  for v_item in select * from jsonb_array_elements(coalesce(p_productos, '[]'::jsonb)) loop
    select * into v_p
    from public.products
    where id = (v_item ->> 'id')::uuid
      and tenant_id = v_tenant.id
      and is_active;

    -- Un producto que dejó de estar se saltea en vez de tirar todo el pedido:
    -- el cliente ya escribió sus datos y lo demás sigue sirviendo.
    if found then
      v_qty := greatest(1, least(99, coalesce((v_item ->> 'qty')::int, 1)));

      insert into public.product_order_items
        (tenant_id, order_id, product_id, name, unit_price_cents, quantity)
      values
        (v_tenant.id, v_pedido, v_p.id, v_p.name, v_p.price_cents, v_qty);

      v_cuantos := v_cuantos + 1;
    end if;
  end loop;

  if v_cuantos = 0 then
    raise exception 'No quedó ningún producto disponible de los que elegiste';
  end if;

  return v_pedido;
end;
$$;

revoke execute on function public.cobrar_turno(uuid, uuid[], text, jsonb) from public;
revoke execute on function public.vender_mostrador(text, jsonb, text, text) from public;
revoke execute on function public.anular_venta(uuid) from public;
revoke execute on function public.crear_pedido(text, jsonb, text, text, text, text) from public;

grant execute on function public.cobrar_turno(uuid, uuid[], text, jsonb) to authenticated;
grant execute on function public.vender_mostrador(text, jsonb, text, text) to authenticated;
grant execute on function public.anular_venta(uuid) to authenticated;
-- El pedido lo levanta alguien sin cuenta: es la única de estas que ve `anon`.
grant execute on function public.crear_pedido(text, jsonb, text, text, text, text) to anon, authenticated;

commit;
