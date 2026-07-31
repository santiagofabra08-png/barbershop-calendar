-- ============================================================================
-- PAGOS A BARBEROS
-- ============================================================================
-- El panel ya sabe cuánto entró por los cortes y cuánto le corresponde a cada
-- barbero. Lo que no sabe es si esa plata efectivamente salió, así que el
-- número que muestra es lo que se generó, no lo que quedó.
--
-- Esto lo arregla con una sola tabla: cada fila es un hecho —"el 2 de agosto
-- le di $6.000 a Nico por la semana del 27 al 2"—. No ejecuta ningún pago ni
-- se conecta con nada: el pago pasa entre dos personas, acá solo se anota.
--
-- Alcance, por decisión: SOLO pagos a barberos. El alquiler del local, la luz
-- y los productos no entran. Por eso la tabla se llama `barber_payouts` y no
-- `movimientos`: un nombre general prometería algo que no hace.
-- ============================================================================

begin;

create table public.barber_payouts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,

  -- restrict, igual que en los turnos: un barbero que se fue no se lleva el
  -- historial de lo que se le pagó.
  barber_id uuid not null references public.barbers(id) on delete restrict,

  -- ---- Para qué lado va la plata -----------------------------------------
  -- 'out' — la barbería le paga: comisión, sueldo.
  -- 'in'  — el barbero le paga a la barbería: alquiler de silla.
  --
  -- Se guarda en cada fila en vez de deducirse del modelo de cobro, porque el
  -- modelo cambia. Si Nico pasa de comisión a alquilar la silla, los pagos del
  -- año pasado tienen que seguir contando para el lado que fueron.
  direction text not null check (direction in ('out', 'in')),

  -- Siempre positivo: el signo lo lleva `direction`. Un monto negativo con
  -- dirección 'out' sería un ingreso escrito al revés, y nadie lo leería bien.
  amount_cents int not null check (amount_cents > 0),

  -- ---- Qué período salda --------------------------------------------------
  -- En fechas locales, con las dos puntas incluidas. Es lo que hace que el
  -- panel pueda contestar "¿le pagué la semana del 20?", que es la pregunta
  -- que un dueño se hace de verdad. Un saldo acumulado sin períodos no la
  -- contesta: si pagó de menos tres semanas seguidas, no se sabe cuál quedó
  -- coja.
  period_from date not null,
  period_to date not null,
  check (period_to >= period_from),

  -- Cuándo se le dio la plata, que no es lo mismo que qué período cubre: una
  -- semana se suele pagar unos días después.
  paid_on date not null,

  note text,

  -- Quién lo registró. Hoy solo puede ser el dueño, pero queda anotado igual:
  -- con dos dueños, "¿quién cargó esto?" es una pregunta que aparece sola.
  created_by uuid references public.barbers(id) on delete set null,
  created_at timestamptz not null default now()
);

-- A propósito NO hay una restricción que impida dos pagos del mismo período.
-- Los adelantos existen: "te doy la mitad el miércoles y el resto el sábado"
-- son dos filas de la misma semana, y prohibirlo obligaría a mentir en una de
-- las dos fechas. Lo que se pagó de un período es la SUMA de sus filas.

-- Lo pagado de un período, que es la consulta del recuento.
create index barber_payouts_periodo_idx
  on public.barber_payouts (tenant_id, period_from, period_to);

-- El historial de una persona.
create index barber_payouts_barbero_idx
  on public.barber_payouts (tenant_id, barber_id, paid_on desc);


-- ============================================================================
-- Quién ve y quién anota
-- ============================================================================
alter table public.barber_payouts enable row level security;

-- El público no tiene ninguna política, así que no ve nada. Como en
-- `appointments`: sin política, RLS niega todo.

create policy "barber_payouts: el dueño anota y ve todo"
  on public.barber_payouts for all
  to authenticated
  using (app.is_owner_of(tenant_id))
  with check (app.is_owner_of(tenant_id));

-- El barbero ve lo suyo y nada más, y solo lee. Que pueda ver lo que cobró
-- evita la conversación de "¿me pagaste la semana pasada?"; que pueda
-- escribirlo lo convertiría en juez y parte.
create policy "barber_payouts: cada barbero ve lo que le pagaron"
  on public.barber_payouts for select
  to authenticated
  using (barber_id = app.my_barber_id(tenant_id));

commit;
