-- ============================================================================
-- PRODUCTOS: VENDER ALGO QUE NO ES UN CORTE
-- ============================================================================
-- Casi toda barbería vende ceras, polvos, remeras. Hoy esa plata no existe en
-- ningún lado: se cobra en el mostrador y el cierre de caja la ve como efectivo
-- que sobra.
--
-- Cinco piezas:
--   1. Dónde viven las fotos (Storage). De paso queda listo para los logos.
--   2. Los productos, con precio y stock.
--   3. Venderlos dentro del ticket de un turno.
--   4. Venderlos sin turno: el que entra, compra y se va.
--   5. El pedido por la web, que NO es una venta: es alguien levantando la mano.
--
-- Y un cambio que no se ve pero cambia plata: la comisión del barbero pasa a
-- calcularse sobre los servicios, no sobre el total. La mercadería la compró la
-- barbería y el margen es suyo.
-- ============================================================================

begin;

-- ============================================================================
-- 1. DÓNDE VIVEN LAS FOTOS
-- ============================================================================
-- Un solo bucket para todas las barberías. La separación la da la carpeta: el
-- primer tramo de la ruta es el id de la barbería, y las políticas de abajo no
-- dejan escribir fuera de la propia.
--
--   <tenant_id>/productos/<archivo>
--   <tenant_id>/marca/<archivo>
--
-- Público para leer, porque una foto de producto y un logo se muestran en una
-- página que no pide login. Nada privado va acá.
insert into storage.buckets (id, name, public)
values ('tenant-assets', 'tenant-assets', true)
on conflict (id) do nothing;

-- La comparación es texto contra texto a propósito. Castear el nombre de la
-- carpeta a uuid haría fallar la política entera si alguien sube un archivo con
-- una ruta rara, en vez de simplemente negarle el permiso.
create policy "tenant-assets: el dueño sube lo suyo"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'tenant-assets'
    and exists (
      select 1 from public.barbers b
      where b.user_id = auth.uid()
        and b.role = 'owner'
        and b.is_active
        and b.tenant_id::text = (storage.foldername(name))[1]
    )
  );

create policy "tenant-assets: el dueño reemplaza lo suyo"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'tenant-assets'
    and exists (
      select 1 from public.barbers b
      where b.user_id = auth.uid()
        and b.role = 'owner'
        and b.is_active
        and b.tenant_id::text = (storage.foldername(name))[1]
    )
  );

create policy "tenant-assets: el dueño borra lo suyo"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'tenant-assets'
    and exists (
      select 1 from public.barbers b
      where b.user_id = auth.uid()
        and b.role = 'owner'
        and b.is_active
        and b.tenant_id::text = (storage.foldername(name))[1]
    )
  );


-- ============================================================================
-- 2. LOS PRODUCTOS
-- ============================================================================
create table public.products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,

  name text not null check (length(btrim(name)) between 2 and 80),
  description text,
  price_cents int not null check (price_cents >= 0),

  -- Nunca negativo: no se puede vender lo que no hay. Lo impide la base, así
  -- que da igual desde dónde se intente.
  stock int not null default 0 check (stock >= 0),

  -- La ruta dentro del bucket, no la URL completa. La URL se arma al mostrar:
  -- si mañana cambia el dominio de Supabase, no hay que reescribir la tabla.
  image_path text,

  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index products_tenant_idx on public.products (tenant_id, sort_order);

alter table public.products enable row level security;

-- El público ve lo que está a la venta y le queda stock. Un producto agotado
-- igual se muestra —para eso está `stock`— pero eso lo decide la pantalla, no
-- esta política: acá se filtra lo que la barbería sacó del catálogo.
create policy "products: lectura pública del catálogo"
  on public.products for select
  to anon, authenticated
  using (
    is_active
    and exists (
      select 1 from public.tenants t
      where t.id = tenant_id and t.is_active and t.products_enabled
    )
  );

create policy "products: el equipo ve todo"
  on public.products for select
  to authenticated
  using (app.is_member_of(tenant_id));

create policy "products: el dueño los administra"
  on public.products for all
  to authenticated
  using (app.is_owner_of(tenant_id))
  with check (app.is_owner_of(tenant_id));

-- El interruptor. Una barbería que no vende nada no tiene por qué mostrar una
-- sección vacía, y una que todavía está cargando el catálogo tampoco.
alter table public.tenants
  add column products_enabled boolean not null default false;


-- ============================================================================
-- 3. VENDER DENTRO DEL TICKET
-- ============================================================================
-- Un producto es un renglón más, al lado del corte y del descuento. Con dos
-- diferencias: puede llevar cantidad, y descuenta stock.
alter table public.appointment_items
  add column product_id uuid references public.products(id) on delete set null,
  add column quantity int not null default 1 check (quantity > 0);

-- Un renglón sale de un servicio o de un producto, nunca de los dos. Puede no
-- salir de ninguno si el origen se borró: por eso las claves son `set null` y
-- el nombre y el monto viven congelados en la fila.
alter table public.appointment_items
  add constraint item_de_una_sola_cosa check (
    service_id is null or product_id is null
  );

-- ---- La comisión deja de salir del total ----------------------------------
-- Hasta acá la comisión se calculaba sobre `charged_total_cents`. Con productos
-- adentro eso le pagaría al barbero un porcentaje de mercadería que compró la
-- barbería. Se parte el total en dos y la comisión sale solo de la primera.
--
-- Los descuentos van SIEMPRE contra los servicios. Es el caso real —"te hago
-- $100 menos el corte"— y evita que un descuento sobre una cera termine
-- bajándole la comisión al barbero.
alter table public.appointments
  add column charged_services_cents int check (charged_services_cents is null or charged_services_cents >= 0),
  add column charged_products_cents int check (charged_products_cents is null or charged_products_cents >= 0);

-- Los tres montos van juntos o no va ninguno, y los dos parciales suman el
-- total. Sin esto, un error de cálculo quedaría guardado sin que nadie lo note.
alter table public.appointments
  add constraint cobro_desglosado_coherente check (
    (charged_at is null
      and charged_services_cents is null
      and charged_products_cents is null)
    or
    (charged_at is not null
      and charged_services_cents is not null
      and charged_products_cents is not null
      and charged_services_cents + charged_products_cents = charged_total_cents)
  );


-- ============================================================================
-- 4. VENTA DE MOSTRADOR
-- ============================================================================
-- El que entra, compra una cera y se va. No hay turno, no hay barbero que
-- atienda, no hay nada que agendar: solo plata que entró y stock que salió.
--
-- Va en su propia tabla y no como un turno raro. Un turno tiene hora, duración,
-- cliente y alguien que atiende; una venta de mostrador no tiene nada de eso, y
-- meterla en `appointments` obligaría a inventarle todo eso en null.
--
-- Solo productos. Un corte sin reserva ya tiene su forma: es un turno cargado a
-- mano desde la agenda.
create table public.counter_sales (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,

  total_cents int not null check (total_cents >= 0),
  payment_method text not null check (payment_method in ('cash', 'card', 'transfer')),

  sold_at timestamptz not null default now(),
  sold_by uuid references public.barbers(id) on delete set null,
  note text
);

create index counter_sales_fecha_idx on public.counter_sales (tenant_id, sold_at);

create table public.counter_sale_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  sale_id uuid not null references public.counter_sales(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,

  name text not null,
  unit_price_cents int not null,
  quantity int not null check (quantity > 0),
  amount_cents int not null,
  sort_order int not null default 0
);

create index counter_sale_items_venta_idx
  on public.counter_sale_items (sale_id, sort_order);

alter table public.counter_sales enable row level security;
alter table public.counter_sale_items enable row level security;

-- El equipo las ve —quien cierra la caja tiene que poder revisarlas—; grabarlas
-- solo pueden las funciones de más abajo.
create policy "counter_sales: el equipo las ve"
  on public.counter_sales for select
  to authenticated
  using (app.is_member_of(tenant_id));

create policy "counter_sale_items: el equipo los ve"
  on public.counter_sale_items for select
  to authenticated
  using (app.is_member_of(tenant_id));


-- ============================================================================
-- 5. EL PEDIDO POR LA WEB
-- ============================================================================
-- Esto NO es una venta. Es alguien diciendo "me interesa esto, contactame".
-- La barbería lo llama, arreglan, y si se concreta se cobra por mostrador como
-- cualquier otra venta. Por eso no descuenta stock ni toca la caja: prometer
-- stock que después no está es peor que no prometer nada.
create table public.product_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,

  client_name text not null,
  client_phone text not null,
  client_email text,
  note text,

  -- 'new'       — nadie lo agarró todavía
  -- 'contacted' — alguien ya se comunicó
  -- 'closed'    — terminado, se haya vendido o no
  status text not null default 'new' check (status in ('new', 'contacted', 'closed')),

  created_at timestamptz not null default now(),
  handled_at timestamptz,
  handled_by uuid references public.barbers(id) on delete set null
);

create index product_orders_pendientes_idx
  on public.product_orders (tenant_id, created_at desc)
  where status = 'new';

create table public.product_order_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  order_id uuid not null references public.product_orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,

  -- Congelados igual que en un ticket: si el precio sube entre el pedido y la
  -- llamada, hay que poder ver qué precio vio el cliente en la página.
  name text not null,
  unit_price_cents int not null,
  quantity int not null check (quantity > 0)
);

create index product_order_items_pedido_idx
  on public.product_order_items (order_id);

alter table public.product_orders enable row level security;
alter table public.product_order_items enable row level security;

-- ⚠️ Ninguna política para `anon`: los pedidos tienen nombre, teléfono y mail.
-- El público los crea por la función de abajo y no los vuelve a ver, igual que
-- con los turnos.
create policy "product_orders: el equipo los ve y los atiende"
  on public.product_orders for select
  to authenticated
  using (app.is_member_of(tenant_id));

create policy "product_orders: el equipo los marca"
  on public.product_orders for update
  to authenticated
  using (app.is_member_of(tenant_id))
  with check (app.is_member_of(tenant_id));

create policy "product_order_items: el equipo los ve"
  on public.product_order_items for select
  to authenticated
  using (app.is_member_of(tenant_id));

commit;
