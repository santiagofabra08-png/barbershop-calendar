/**
 * ¿Un barbero ve solo lo suyo?
 *
 *   node --env-file=.env.local scripts/probar-roles.mts [slug]
 *
 * `probar-aislamiento.mts` prueba que una barbería no ve a otra. Esto prueba lo
 * de adentro: que dentro del MISMO local, un barbero no ve los turnos de sus
 * compañeros, no ve lo que les pagaron, y no puede ascenderse a dueño.
 *
 * Es el mismo agujero que el otro, un piso más abajo. Si falla, un empleado ve
 * los teléfonos de los clientes de sus compañeros, cuánto factura cada uno y
 * los pagos del local. Y como toda la regla vive en las políticas de RLS,
 * podría estar mal escrita sin que nada se vea raro en pantalla: la pantalla
 * muestra lo que la base le da.
 *
 * La mitad de la prueba es al revés, y es igual de importante: el barbero SÍ
 * tiene que poder trabajar. Una barbería donde el empleado no puede cargar un
 * turno ni cobrarle a un cliente no sirve para nada. Achicar permisos hasta que
 * nadie pueda hacer nada es tan malo como dejarlos abiertos, y solo se nota si
 * se prueban las dos mitades.
 *
 * Crea todo lo que necesita, lo prueba y lo borra.
 */
import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";

import { localToUtc } from "../src/lib/schedule.ts";

const slug = process.argv[2] ?? "barberia-central";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceKey) {
  console.error("Faltan variables de entorno. ¿Corriste con --env-file=.env.local?");
  process.exit(1);
}

const sinSesion = { auth: { autoRefreshToken: false, persistSession: false } };
const admin = createClient(url, serviceKey, sinSesion);

type Resultado = { ok: boolean; que: string; detalle: string };
const resultados: Resultado[] = [];

const anotar = (ok: boolean, que: string, detalle = "") =>
  resultados.push({ ok, que, detalle });

/** Algo que el barbero NO tiene que poder ver. */
function noVe(que: string, filas: unknown[] | null, error: { message: string } | null) {
  if (error) return anotar(true, que, "rechazado por la base");
  const n = filas?.length ?? 0;
  anotar(n === 0, que, n === 0 ? "" : `¡vio ${n} fila(s) ajena(s)!`);
}

/** Algo que la base tiene que rechazarle. */
function noPuede(que: string, error: { message: string } | null) {
  anotar(Boolean(error), que, error ? "" : "¡lo dejó!");
}

/** Algo que el barbero SÍ tiene que poder hacer. */
function siPuede(que: string, error: { message: string } | null) {
  anotar(!error, que, error?.message ?? "");
}

function afirmar(que: string, condicion: boolean, detalle = "") {
  anotar(condicion, que, condicion ? "" : detalle || "no dio lo esperado");
}

// ============================================================================

const { data: tenant } = await admin
  .from("tenants")
  .select("id, name, timezone")
  .eq("slug", slug)
  .maybeSingle();

if (!tenant) {
  console.error(`No existe la barbería "${slug}".`);
  process.exit(1);
}

const tenantId = tenant.id as string;
const tz = tenant.timezone as string;
const marca = `ROLES-${randomUUID().slice(0, 6)}`;

const deshacer: (() => Promise<void>)[] = [];
const alFinal = (f: () => Promise<void>) => deshacer.unshift(f);

console.log(`\nProbando roles dentro de ${tenant.name}\n`);

try {
  // ---- Un servicio con el que armar turnos ---------------------------------
  const { data: servicios } = await admin
    .from("services")
    .select("id, price_cents, duration_minutes")
    .eq("tenant_id", tenantId)
    .eq("kind", "service")
    .eq("is_active", true)
    .limit(1);

  const servicio = servicios?.[0];
  if (!servicio) throw new Error("la barbería no tiene ningún servicio activo");

  // ---- Dos barberos: el que entra y un compañero ---------------------------
  const email = `barbero-${randomUUID().slice(0, 8)}@ejemplo.com`;
  const password = randomBytes(12).toString("base64url");

  const { data: cuenta, error: eCuenta } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (eCuenta || !cuenta?.user) throw new Error(`cuenta: ${eCuenta?.message}`);
  alFinal(async () => {
    await admin.auth.admin.deleteUser(cuenta.user.id);
  });

  const { data: yo, error: eYo } = await admin
    .from("barbers")
    .insert({
      tenant_id: tenantId,
      user_id: cuenta.user.id,
      role: "barber",
      display_name: `${marca} Yo`,
      email,
      accepts_bookings: true,
      payment_model: "commission",
      commission_percent: 50,
      sort_order: 95,
    })
    .select("id")
    .single();
  if (eYo || !yo) throw new Error(`barbero: ${eYo?.message}`);
  alFinal(async () => {
    await admin.from("barbers").delete().eq("id", yo.id);
  });

  const { data: otro, error: eOtro } = await admin
    .from("barbers")
    .insert({
      tenant_id: tenantId,
      role: "barber",
      display_name: `${marca} Compañero`,
      accepts_bookings: true,
      payment_model: "commission",
      commission_percent: 50,
      sort_order: 96,
    })
    .select("id")
    .single();
  if (eOtro || !otro) throw new Error(`compañero: ${eOtro?.message}`);
  alFinal(async () => {
    await admin.from("barbers").delete().eq("id", otro.id);
  });

  // ---- El cebo: un turno y un pago del compañero ---------------------------
  const hoy = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const { data: turnoAjeno, error: eTurno } = await admin
    .from("appointments")
    .insert({
      tenant_id: tenantId,
      barber_id: otro.id,
      service_id: servicio.id,
      kind: "booking",
      status: "confirmed",
      source: "online",
      starts_at: localToUtc(hoy, "21:00", tz).toISOString(),
      ends_at: localToUtc(hoy, "21:30", tz).toISOString(),
      client_name: `${marca} Cliente ajeno`,
      client_phone: "+59899777888",
      client_email: "ajeno@ejemplo.com",
      price_cents: servicio.price_cents,
      duration_minutes: servicio.duration_minutes,
    })
    .select("id")
    .single();
  if (eTurno || !turnoAjeno) throw new Error(`turno ajeno: ${eTurno?.message}`);
  alFinal(async () => {
    await admin.from("appointments").delete().eq("id", turnoAjeno.id);
  });

  const { data: pagoAjeno } = await admin
    .from("barber_payouts")
    .insert({
      tenant_id: tenantId,
      barber_id: otro.id,
      direction: "out",
      amount_cents: 777000,
      period_from: "2026-01-01",
      period_to: "2026-01-07",
      paid_on: "2026-01-08",
      note: marca,
    })
    .select("id")
    .single();
  if (pagoAjeno?.id) {
    alFinal(async () => {
      await admin.from("barber_payouts").delete().eq("id", pagoAjeno.id);
    });
  }

  // Un pago propio, para comprobar que sí ve el suyo.
  const { data: pagoPropio } = await admin
    .from("barber_payouts")
    .insert({
      tenant_id: tenantId,
      barber_id: yo.id,
      direction: "out",
      amount_cents: 111000,
      period_from: "2026-01-01",
      period_to: "2026-01-07",
      paid_on: "2026-01-08",
      note: marca,
    })
    .select("id")
    .single();
  if (pagoPropio?.id) {
    alFinal(async () => {
      await admin.from("barber_payouts").delete().eq("id", pagoPropio.id);
    });
  }

  // Un cierre viejo, para probar que reabrir es cosa del dueño.
  const { data: cierreViejo } = await admin
    .from("cash_closures")
    .insert({
      tenant_id: tenantId,
      business_date: "2020-01-02",
      expected_cash_cents: 0,
      expected_card_cents: 0,
      expected_transfer_cents: 0,
      counted_cash_cents: 0,
      counted_card_cents: 0,
      counted_transfer_cents: 0,
      note: marca,
    })
    .select("id")
    .single();
  if (cierreViejo?.id) {
    alFinal(async () => {
      await admin.from("cash_closures").delete().eq("id", cierreViejo.id);
    });
  }

  // ---- Entrar como barbero -------------------------------------------------
  const sb = createClient(url, anonKey, sinSesion);
  const { error: eLogin } = await sb.auth.signInWithPassword({ email, password });
  if (eLogin) throw new Error(`no pude entrar: ${eLogin.message}`);
  anotar(true, "entra al panel como barbero");

  // ========================================================================
  // LO QUE NO PUEDE
  // ========================================================================
  {
    const { data, error } = await sb
      .from("appointments")
      .select("id, client_name, client_phone")
      .eq("barber_id", otro.id);
    noVe("no ve los turnos de un compañero", data, error);
  }

  {
    const { data, error } = await sb
      .from("barber_payouts")
      .select("id, amount_cents")
      .eq("barber_id", otro.id);
    noVe("no ve lo que le pagaron a un compañero", data, error);
  }

  {
    await sb
      .from("appointments")
      .update({ client_name: `${marca} pisado` })
      .eq("id", turnoAjeno.id);
    const { data } = await admin
      .from("appointments")
      .select("client_name")
      .eq("id", turnoAjeno.id)
      .single();
    afirmar(
      "no puede editar el turno de un compañero",
      data?.client_name === `${marca} Cliente ajeno`,
      "¡le cambió el cliente!",
    );
  }

  {
    await sb.from("appointments").delete().eq("id", turnoAjeno.id);
    const { data } = await admin
      .from("appointments")
      .select("id")
      .eq("id", turnoAjeno.id)
      .maybeSingle();
    afirmar("no puede borrar el turno de un compañero", Boolean(data), "¡lo borró!");
  }

  {
    const { error } = await sb.from("appointments").insert({
      tenant_id: tenantId,
      barber_id: otro.id,
      service_id: servicio.id,
      kind: "booking",
      status: "confirmed",
      source: "panel",
      starts_at: localToUtc(hoy, "19:00", tz).toISOString(),
      ends_at: localToUtc(hoy, "19:30", tz).toISOString(),
      client_name: `${marca} Colado`,
      price_cents: servicio.price_cents,
      duration_minutes: servicio.duration_minutes,
    });
    noPuede("no puede meterle un turno en la agenda a un compañero", error);
  }

  {
    const { error } = await sb.from("working_hours").insert({
      tenant_id: tenantId,
      barber_id: otro.id,
      weekday: 1,
      starts_at: "08:00",
      ends_at: "09:00",
    });
    noPuede("no puede cambiarle el horario a un compañero", error);
  }

  // Estas cuatro son la tentación obvia: ascenderse, subirse la comisión,
  // cambiarse el sueldo. Lo frena un disparador en la base, no la pantalla.
  {
    const { error } = await sb
      .from("barbers")
      .update({ role: "owner" })
      .eq("id", yo.id);
    noPuede("no puede ascenderse a dueño", error);
  }

  {
    const { error } = await sb
      .from("barbers")
      .update({ commission_percent: 95 })
      .eq("id", yo.id);
    noPuede("no puede subirse la comisión", error);
  }

  {
    const { error } = await sb
      .from("tenants")
      .update({ name: `${marca} pisado` })
      .eq("id", tenantId);
    const { data } = await admin
      .from("tenants")
      .select("name")
      .eq("id", tenantId)
      .single();
    afirmar(
      "no puede cambiar los ajustes del local",
      Boolean(error) || data?.name === tenant.name,
      "¡le cambió el nombre a la barbería!",
    );
  }

  {
    const { error } = await sb.from("barbers").insert({
      tenant_id: tenantId,
      display_name: `${marca} Colado`,
      role: "barber",
      payment_model: "revenue_only",
    });
    noPuede("no puede dar de alta a otro barbero", error);
  }

  {
    const { error } = await sb.from("services").insert({
      tenant_id: tenantId,
      name: `${marca} Servicio colado`,
      duration_minutes: 30,
      price_cents: 1,
      kind: "service",
    });
    noPuede("no puede inventar servicios", error);
  }

  {
    const { error } = await sb.from("products").insert({
      tenant_id: tenantId,
      name: `${marca} Producto colado`,
      price_cents: 1,
      stock: 1,
    });
    noPuede("no puede cargar productos", error);
  }

  if (cierreViejo?.id) {
    const { error } = await sb.rpc("reabrir_caja", {
      p_tenant_slug: slug,
      p_fecha: "2020-01-02",
    });
    noPuede("no puede reabrir una caja cerrada", error);
  }

  // ========================================================================
  // LO QUE SÍ PUEDE — un barbero que no puede trabajar no sirve
  // ========================================================================
  {
    const { data, error } = await sb
      .from("barber_payouts")
      .select("id, amount_cents")
      .eq("barber_id", yo.id);
    afirmar(
      "ve lo que le pagaron a él",
      !error && (data?.length ?? 0) === 1 && data![0].amount_cents === 111000,
      error?.message ?? `vio ${data?.length ?? 0} pagos`,
    );
  }

  {
    const { data, error } = await sb
      .from("barbers")
      .select("id, display_name")
      .eq("tenant_id", tenantId);
    afirmar(
      "ve con quiénes trabaja",
      !error && (data?.length ?? 0) > 1,
      "un barbero tiene que poder ver el equipo",
    );
  }

  {
    const { error } = await sb
      .from("barbers")
      .update({ display_name: `${marca} Yo mismo` })
      .eq("id", yo.id);
    siPuede("puede cambiarse su propio nombre", error);
  }

  let turnoPropio = "";
  {
    const { data, error } = await sb
      .from("appointments")
      .insert({
        tenant_id: tenantId,
        barber_id: yo.id,
        service_id: servicio.id,
        kind: "booking",
        status: "confirmed",
        source: "panel",
        starts_at: localToUtc(hoy, "20:00", tz).toISOString(),
        ends_at: localToUtc(hoy, "20:30", tz).toISOString(),
        client_name: `${marca} Cliente propio`,
        price_cents: servicio.price_cents,
        duration_minutes: servicio.duration_minutes,
      })
      .select("id")
      .single();
    siPuede("puede cargar un turno en su propia agenda", error);
    turnoPropio = (data?.id as string) ?? "";
    if (turnoPropio) {
      alFinal(async () => {
        await admin.from("appointments").delete().eq("id", turnoPropio);
      });
    }
  }

  {
    const { data, error } = await sb
      .from("appointments")
      .select("id")
      .eq("barber_id", yo.id);
    afirmar(
      "ve su propia agenda",
      !error && (data?.length ?? 0) > 0,
      "no está viendo ni lo suyo",
    );
  }

  {
    const { data, error } = await sb
      .from("working_hours")
      .insert({
        tenant_id: tenantId,
        barber_id: yo.id,
        weekday: 1,
        starts_at: "08:00",
        ends_at: "09:00",
      })
      .select("id")
      .single();
    siPuede("puede cargar su propio horario", error);
    if (data?.id) {
      alFinal(async () => {
        await admin.from("working_hours").delete().eq("id", data.id);
      });
    }
  }

  // ---- La excepción de Cobros ---------------------------------------------
  // Un barbero SÍ puede cobrarle a un cliente de un compañero. Es a propósito:
  // cobra el que está parado al lado de la caja, y el compañero puede haberse
  // ido. Pasa por funciones que verifican membresía, no por aflojar la política
  // de la tabla —eso le dejaría ver de más en la agenda—.
  {
    const { data, error } = await sb.rpc("turnos_para_cobrar", {
      p_tenant_slug: slug,
      p_fecha: hoy,
    });
    const ve = ((data ?? []) as { id: string }[]).some((t) => t.id === turnoAjeno.id);
    afirmar(
      "en Cobros sí ve el turno del compañero",
      !error && ve,
      error?.message ?? "no lo vio, y al lado de la caja tiene que poder cobrarlo",
    );
  }

  {
    const { error } = await sb.rpc("cobrar_turno", {
      p_appointment_id: turnoAjeno.id,
      p_extras: [],
      p_payment_method: "cash",
      p_productos: [],
    });
    siPuede("puede cobrarle a un cliente de un compañero", error);

    if (!error) {
      const { error: eAnular } = await sb.rpc("anular_cobro", {
        p_appointment_id: turnoAjeno.id,
      });
      siPuede("puede anular ese cobro", eAnular);
    }
  }

  // Y sin embargo, en la agenda sigue sin verlo. Las dos cosas a la vez son la
  // regla completa: una sola de las dos sería un error.
  {
    const { data } = await sb
      .from("appointments")
      .select("id")
      .eq("id", turnoAjeno.id);
    afirmar(
      "pero en la agenda sigue sin verlo",
      (data?.length ?? 0) === 0,
      "¡cobrar le abrió la agenda del compañero!",
    );
  }

  await sb.auth.signOut();
} catch (e) {
  anotar(false, "la prueba se cortó", e instanceof Error ? e.message : String(e));
} finally {
  for (const paso of deshacer) {
    try {
      await paso();
    } catch {
      // Que falle un paso de limpieza no puede frenar los demás.
    }
  }
}

for (const r of resultados) {
  console.log(`  ${r.ok ? "✓" : "✗"} ${r.que}${r.detalle ? `  — ${r.detalle}` : ""}`);
}

const fallaron = resultados.filter((r) => !r.ok).length;
console.log("");

if (fallaron > 0) {
  console.error(`✗ ${fallaron} de ${resultados.length} fallaron.\n`);
  process.exit(1);
}

console.log(
  `✓ Las ${resultados.length} pasaron.\n` +
    "  Un barbero ve lo suyo, puede trabajar, y no puede más que eso.\n",
);
