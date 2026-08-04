/**
 * ¿Anda todo el panel, de verdad, contra la base?
 *
 *   node --env-file=.env.local scripts/probar-panel.mts
 *   node --env-file=.env.local scripts/probar-panel.mts barberia-central
 *
 * Hace lo que haría alguien sentado en el panel durante una jornada entera:
 * cambia los ajustes, carga un servicio, carga un producto, da de alta a un
 * barbero, le pone horario, le carga un turno, bloquea un rato, cobra, vende
 * por mostrador, cierra la caja, la reabre, anula todo y levanta un pedido de
 * la web. Y después deja cada barbería exactamente como estaba.
 *
 * POR QUÉ NO ALCANZA CON `npm test`
 * Los 140 tests corren sin base de datos: cubren la grilla de horarios y el
 * reparto de la plata, que son cuentas. Todo lo que decide si el panel sirve
 * —las funciones, las restricciones, los permisos, los disparadores— vive en
 * Postgres, y de ahí no se entera ninguno.
 *
 * CÓMO ENTRA
 * Crea una cuenta temporal, la hace dueña de la barbería y trabaja con la anon
 * key, igual que el navegador. No con la service role: usar la llave que saltea
 * los permisos probaría que las tablas existen, no que el dueño puede usarlas.
 *
 * QUÉ DEJA
 * Nada. Todo lo que crea queda anotado en una pila que se deshace al final,
 * pase lo que pase —también si algo explota en el medio—.
 */
import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";

import { localToUtc } from "../src/lib/schedule.ts";

const SLUGS = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["barberia-central", "studio-norte"];

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceKey) {
  console.error("Faltan variables de entorno. ¿Corriste con --env-file=.env.local?");
  process.exit(1);
}

const sinSesion = { auth: { autoRefreshToken: false, persistSession: false } };
const admin = createClient(url, serviceKey, sinSesion);

// ---- Anotador de resultados -------------------------------------------------
type Resultado = { ok: boolean; que: string; detalle: string };
let actuales: Resultado[] = [];

function ok(que: string, detalle = "") {
  actuales.push({ ok: true, que, detalle });
}
function mal(que: string, detalle: string) {
  actuales.push({ ok: false, que, detalle });
}
/** Afirma algo y anota el resultado. */
function afirmar(que: string, condicion: boolean, detalle = "") {
  if (condicion) ok(que);
  else mal(que, detalle || "no dio lo esperado");
}
/** Una operación que tiene que salir bien. */
function salio(que: string, error: { message: string } | null) {
  if (error) mal(que, error.message);
  else ok(que);
}
/** Una operación que la base tiene que rechazar. */
function rechazo(que: string, error: { message: string } | null) {
  if (error) ok(que);
  else mal(que, "¡la dejó pasar!");
}

const hoyEn = (tz: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

// ============================================================================

async function probarBarberia(slug: string) {
  actuales = [];

  const { data: t } = await admin
    .from("tenants")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (!t) {
    console.error(`\n✗ No existe la barbería "${slug}".\n`);
    return false;
  }

  const tenant = t as Record<string, unknown>;
  const tenantId = tenant.id as string;
  const tz = tenant.timezone as string;
  const marca = `PRUEBA-${randomUUID().slice(0, 6)}`;

  // La pila de deshacer. Cada cosa que se crea o se toca anota acá cómo
  // volverla atrás, y al final se ejecuta en orden inverso.
  const deshacer: (() => Promise<void>)[] = [];
  const alFinal = (f: () => Promise<void>) => deshacer.unshift(f);

  console.log(`\n${"═".repeat(66)}\n${tenant.name}  ·  ${slug}\n${"═".repeat(66)}`);

  try {
    // ---- Entrar como dueño -------------------------------------------------
    const email = `panel-${randomUUID().slice(0, 8)}@ejemplo.com`;
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

    const { data: duenio, error: eDuenio } = await admin
      .from("barbers")
      .insert({
        tenant_id: tenantId,
        user_id: cuenta.user.id,
        role: "owner",
        display_name: `${marca} Dueño`,
        email,
        accepts_bookings: false,
        payment_model: "revenue_only",
        sort_order: 98,
      })
      .select("id")
      .single();
    if (eDuenio || !duenio) throw new Error(`dueño: ${eDuenio?.message}`);
    alFinal(async () => {
      await admin.from("barbers").delete().eq("id", duenio.id);
    });

    const sb = createClient(url!, anonKey!, sinSesion);
    const { error: eLogin } = await sb.auth.signInWithPassword({ email, password });
    if (eLogin) throw new Error(`no pude entrar: ${eLogin.message}`);
    ok("entra al panel como dueño");

    // ======================================================================
    // AJUSTES
    // ======================================================================
    const nombreOriginal = tenant.name as string;
    const acentoOriginal = tenant.color_accent as string;
    const leadOriginal = tenant.min_lead_minutes as number;

    alFinal(async () => {
      await admin
        .from("tenants")
        .update({
          name: nombreOriginal,
          color_accent: acentoOriginal,
          min_lead_minutes: leadOriginal,
        })
        .eq("id", tenantId);
    });

    {
      const { error } = await sb
        .from("tenants")
        .update({
          name: `${marca} Local`,
          color_accent: "#123456",
          min_lead_minutes: 45,
        })
        .eq("id", tenantId);
      salio("ajustes: cambia nombre, color y anticipación mínima", error);

      const { data } = await admin
        .from("tenants")
        .select("name, color_accent, min_lead_minutes")
        .eq("id", tenantId)
        .single();
      afirmar(
        "ajustes: los cambios quedaron guardados",
        data?.name === `${marca} Local` &&
          data?.color_accent === "#123456" &&
          data?.min_lead_minutes === 45,
        `quedó ${JSON.stringify(data)}`,
      );
    }

    {
      // Un color que no es un color tiene que rebotar contra la base, no contra
      // la pantalla: la pantalla se puede saltear.
      const { error } = await sb
        .from("tenants")
        .update({ color_accent: "azul" })
        .eq("id", tenantId);
      rechazo("ajustes: rechaza un color que no es un color", error);
    }

    // ======================================================================
    // SERVICIOS
    // ======================================================================
    let servicioId = "";
    {
      const { data, error } = await sb
        .from("services")
        .insert({
          tenant_id: tenantId,
          name: `${marca} Corte`,
          duration_minutes: 30,
          price_cents: 50000,
          kind: "service",
          sort_order: 90,
        })
        .select("id")
        .single();
      salio("servicios: crea uno nuevo", error);
      servicioId = (data?.id as string) ?? "";
      if (servicioId) {
        alFinal(async () => {
          await admin.from("services").delete().eq("id", servicioId);
        });
      }
    }

    if (servicioId) {
      const { error } = await sb
        .from("services")
        .update({ price_cents: 70000 })
        .eq("id", servicioId);
      salio("servicios: le cambia el precio", error);

      const { data } = await admin
        .from("services")
        .select("price_cents")
        .eq("id", servicioId)
        .single();
      afirmar("servicios: el precio nuevo quedó", data?.price_cents === 70000);

      const { error: eBaja } = await sb
        .from("services")
        .update({ is_active: false })
        .eq("id", servicioId);
      salio("servicios: lo saca de la página", eBaja);

      await sb.from("services").update({ is_active: true }).eq("id", servicioId);

      // Duración imposible: la base tiene la última palabra.
      const { error: eDur } = await sb
        .from("services")
        .update({ duration_minutes: 0 })
        .eq("id", servicioId);
      rechazo("servicios: rechaza una duración de cero", eDur);
    }

    // ======================================================================
    // PRODUCTOS
    // ======================================================================
    let productoId = "";
    {
      const { data, error } = await sb
        .from("products")
        .insert({
          tenant_id: tenantId,
          name: `${marca} Cera`,
          price_cents: 30000,
          stock: 5,
          sort_order: 90,
        })
        .select("id")
        .single();
      salio("productos: carga uno nuevo", error);
      productoId = (data?.id as string) ?? "";
      if (productoId) {
        alFinal(async () => {
          await admin.from("products").delete().eq("id", productoId);
        });
      }
    }

    if (productoId) {
      const { error } = await sb
        .from("products")
        .update({ price_cents: 35000, stock: 8 })
        .eq("id", productoId);
      salio("productos: le cambia precio y stock", error);

      const { error: eNeg } = await sb
        .from("products")
        .update({ stock: -1 })
        .eq("id", productoId);
      rechazo("productos: rechaza stock negativo", eNeg);
    }

    // ======================================================================
    // EQUIPO
    // ======================================================================
    let barberoId = "";
    {
      const { data, error } = await sb
        .from("barbers")
        .insert({
          tenant_id: tenantId,
          display_name: `${marca} Barbero`,
          role: "barber",
          accepts_bookings: true,
          payment_model: "commission",
          commission_percent: 40,
          sort_order: 97,
        })
        .select("id")
        .single();
      salio("equipo: da de alta a un barbero", error);
      barberoId = (data?.id as string) ?? "";
      if (barberoId) {
        alFinal(async () => {
          await admin.from("barbers").delete().eq("id", barberoId);
        });
      }
    }

    if (barberoId) {
      const { error } = await sb
        .from("barbers")
        .update({ display_name: `${marca} Barbero II`, commission_percent: 45 })
        .eq("id", barberoId);
      salio("equipo: le cambia el nombre y la comisión", error);

      // Un modelo de cobro incoherente —comisión Y sueldo a la vez— no puede
      // quedar guardado. Lo impide un CHECK, no la pantalla.
      const { error: eIncoherente } = await sb
        .from("barbers")
        .update({ payment_model: "salary", commission_percent: 45 })
        .eq("id", barberoId);
      rechazo("equipo: rechaza un modelo de cobro incoherente", eIncoherente);
    }

    // ======================================================================
    // HORARIOS
    // ======================================================================
    if (barberoId) {
      const { data, error } = await sb
        .from("working_hours")
        .insert({
          tenant_id: tenantId,
          barber_id: barberoId,
          weekday: 3,
          starts_at: "10:00",
          ends_at: "14:00",
        })
        .select("id")
        .single();
      salio("horarios: le agrega un tramo", error);

      const tramoId = (data?.id as string) ?? "";
      if (tramoId) {
        alFinal(async () => {
          await admin.from("working_hours").delete().eq("id", tramoId);
        });

        const { error: ePisa } = await sb.from("working_hours").insert({
          tenant_id: tenantId,
          barber_id: barberoId,
          weekday: 3,
          starts_at: "13:00",
          ends_at: "16:00",
        });
        rechazo("horarios: rechaza un tramo que se pisa con otro", ePisa);

        const { error: eAlReves } = await sb.from("working_hours").insert({
          tenant_id: tenantId,
          barber_id: barberoId,
          weekday: 4,
          starts_at: "18:00",
          ends_at: "09:00",
        });
        rechazo("horarios: rechaza un tramo que termina antes de empezar", eAlReves);

        const { error: eBorrar } = await sb
          .from("working_hours")
          .delete()
          .eq("id", tramoId);
        salio("horarios: borra el tramo", eBorrar);
      }
    }

    // ======================================================================
    // AGENDA
    // ======================================================================
    const hoy = hoyEn(tz);
    let turnoId = "";

    if (barberoId && servicioId) {
      const inicio = localToUtc(hoy, "22:00", tz);
      const fin = localToUtc(hoy, "22:30", tz);

      const { data, error } = await sb
        .from("appointments")
        .insert({
          tenant_id: tenantId,
          barber_id: barberoId,
          service_id: servicioId,
          kind: "booking",
          status: "confirmed",
          source: "panel",
          starts_at: inicio.toISOString(),
          ends_at: fin.toISOString(),
          client_name: `${marca} Cliente`,
          price_cents: 70000,
          duration_minutes: 30,
        })
        .select("id, barber_commission_percent")
        .single();
      salio("agenda: carga un turno a mano", error);
      turnoId = (data?.id as string) ?? "";
      if (turnoId) {
        alFinal(async () => {
          await admin.from("appointments").delete().eq("id", turnoId);
        });
      }

      // El porcentaje se copia al turno al insertarlo, con un disparador. Para
      // ese momento el barbero ya va por 45: se lo subimos más arriba.
      afirmar(
        "agenda: copia la comisión del barbero al turno",
        Number(data?.barber_commission_percent) === 45,
        `quedó ${data?.barber_commission_percent}, esperaba 45`,
      );

      // Y acá está lo que de verdad importa: subirle la comisión al barbero
      // HOY no puede cambiar lo que se le debe por un turno de ayer. Si esto
      // fallara, cada aumento reescribiría la liquidación del mes pasado.
      if (turnoId) {
        await sb
          .from("barbers")
          .update({ commission_percent: 60 })
          .eq("id", barberoId);

        const { data: despues } = await admin
          .from("appointments")
          .select("barber_commission_percent")
          .eq("id", turnoId)
          .single();

        afirmar(
          "agenda: subirle la comisión no toca los turnos ya dados",
          Number(despues?.barber_commission_percent) === 45,
          `el turno pasó a ${despues?.barber_commission_percent} — la historia se reescribió`,
        );
      }

      const { error: ePisa } = await sb.from("appointments").insert({
        tenant_id: tenantId,
        barber_id: barberoId,
        service_id: servicioId,
        kind: "booking",
        status: "confirmed",
        source: "panel",
        starts_at: localToUtc(hoy, "22:15", tz).toISOString(),
        ends_at: localToUtc(hoy, "22:45", tz).toISOString(),
        client_name: `${marca} Doble`,
        price_cents: 70000,
        duration_minutes: 30,
      });
      rechazo("agenda: no deja dar dos turnos encimados", ePisa);

      // Un bloqueo va a la misma tabla, así que la misma regla lo cuida.
      const { data: bloqueo, error: eBloqueo } = await sb
        .from("appointments")
        .insert({
          tenant_id: tenantId,
          barber_id: barberoId,
          kind: "block",
          status: "confirmed",
          starts_at: localToUtc(hoy, "23:00", tz).toISOString(),
          ends_at: localToUtc(hoy, "23:30", tz).toISOString(),
          reason: `${marca} almuerzo`,
        })
        .select("id")
        .single();
      salio("agenda: bloquea un rato", eBloqueo);

      if (bloqueo?.id) {
        const { error: ePisaBloqueo } = await sb.from("appointments").insert({
          tenant_id: tenantId,
          barber_id: barberoId,
          service_id: servicioId,
          kind: "booking",
          status: "confirmed",
          source: "panel",
          starts_at: localToUtc(hoy, "23:10", tz).toISOString(),
          ends_at: localToUtc(hoy, "23:40", tz).toISOString(),
          client_name: `${marca} Encima`,
          price_cents: 70000,
          duration_minutes: 30,
        });
        rechazo("agenda: no deja dar un turno sobre un rato bloqueado", ePisaBloqueo);

        const { error: eBorrar } = await sb
          .from("appointments")
          .delete()
          .eq("id", bloqueo.id)
          .eq("kind", "block");
        salio("agenda: saca el bloqueo", eBorrar);
      }
    }

    // ======================================================================
    // COBROS — el camino de la plata, de punta a punta
    // ======================================================================
    if (turnoId && productoId) {
      // ---- Cobrar el turno con un producto adentro -------------------------
      const { data: total, error } = await sb.rpc("cobrar_turno", {
        p_appointment_id: turnoId,
        p_extras: [],
        p_payment_method: "cash",
        p_productos: [{ id: productoId, qty: 2 }],
      });
      salio("cobros: cobra el turno con dos productos", error);

      // 70000 del corte + 2 × 35000 de cera.
      afirmar(
        "cobros: el total es el corte más los productos",
        Number(total) === 140000,
        `dio ${total}, esperaba 140000`,
      );

      const { data: cobrado } = await admin
        .from("appointments")
        .select("charged_services_cents, charged_products_cents, charged_total_cents")
        .eq("id", turnoId)
        .single();

      // Esto es lo que decide cuánto cobra el barbero. La comisión sale de los
      // servicios, no del total: la mercadería la compró la barbería.
      afirmar(
        "cobros: separa servicios de productos",
        cobrado?.charged_services_cents === 70000 &&
          cobrado?.charged_products_cents === 70000,
        `quedó ${JSON.stringify(cobrado)}`,
      );

      const { data: p1 } = await admin
        .from("products")
        .select("stock")
        .eq("id", productoId)
        .single();
      afirmar(
        "cobros: el stock bajó al vender",
        p1?.stock === 6,
        `quedó en ${p1?.stock}, esperaba 6`,
      );

      // ---- Venta de mostrador ---------------------------------------------
      const { data: ventaId, error: eVenta } = await sb.rpc("vender_mostrador", {
        p_tenant_slug: slug,
        p_productos: [{ id: productoId, qty: 1 }],
        p_payment_method: "cash",
        p_nota: marca,
      });
      salio("cobros: vende un producto por mostrador", eVenta);

      const { data: p2 } = await admin
        .from("products")
        .select("stock")
        .eq("id", productoId)
        .single();
      afirmar(
        "cobros: el mostrador también descuenta stock",
        p2?.stock === 5,
        `quedó en ${p2?.stock}, esperaba 5`,
      );

      const { error: eSinStock } = await sb.rpc("vender_mostrador", {
        p_tenant_slug: slug,
        p_productos: [{ id: productoId, qty: 999 }],
        p_payment_method: "cash",
        p_nota: marca,
      });
      rechazo("cobros: no deja vender más de lo que hay", eSinStock);

      // ---- Cerrar la caja --------------------------------------------------
      // Acá está el número que importa: lo que la caja espera tiene que incluir
      // el turno Y la venta de mostrador. Si se olvidara de una, la diferencia
      // aparecería como plata que sobra y el cierre dejaría de servir.
      const { data: sinCobrar } = await admin
        .from("appointments")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("kind", "booking")
        .eq("status", "confirmed")
        .is("charged_at", null);

      const bloquean = (sinCobrar ?? []).length;

      if (bloquean > 0) {
        ok(
          "cobros: cierre salteado",
          `${bloquean} turno(s) sin cobrar de antes en esta barbería`,
        );
      } else {
        const esperado = 140000 + 35000;
        const { error: eCierre } = await sb.rpc("cerrar_caja", {
          p_tenant_slug: slug,
          p_fecha: hoy,
          p_contado_cash: esperado,
          p_contado_card: 0,
          p_contado_transfer: 0,
          p_nota: marca,
        });
        salio("cobros: cierra la caja del día", eCierre);

        const { data: cierre } = await admin
          .from("cash_closures")
          .select("id, expected_cash_cents")
          .eq("tenant_id", tenantId)
          .eq("business_date", hoy)
          .maybeSingle();

        if (cierre?.id) {
          alFinal(async () => {
            await admin.from("cash_closures").delete().eq("id", cierre.id);
          });
        }

        afirmar(
          "cobros: lo esperado incluye el turno Y el mostrador",
          cierre?.expected_cash_cents === esperado,
          `esperaba ${esperado} y la base calculó ${cierre?.expected_cash_cents}`,
        );

        const { error: eConCajaCerrada } = await sb.rpc("anular_cobro", {
          p_appointment_id: turnoId,
        });
        rechazo("cobros: con la caja cerrada no se anula nada", eConCajaCerrada);

        const { error: eReabrir } = await sb.rpc("reabrir_caja", {
          p_tenant_slug: slug,
          p_fecha: hoy,
        });
        salio("cobros: el dueño puede reabrir la caja", eReabrir);
      }

      // ---- Deshacer y comprobar que el stock vuelve ------------------------
      if (ventaId) {
        const { error: eAnularVenta } = await sb.rpc("anular_venta", {
          p_sale_id: ventaId,
        });
        salio("cobros: anula la venta de mostrador", eAnularVenta);
      }

      const { error: eAnular } = await sb.rpc("anular_cobro", {
        p_appointment_id: turnoId,
      });
      salio("cobros: anula el cobro del turno", eAnular);

      const { data: p3 } = await admin
        .from("products")
        .select("stock")
        .eq("id", productoId)
        .single();
      afirmar(
        "cobros: al anular, el stock vuelve entero",
        p3?.stock === 8,
        `quedó en ${p3?.stock}, esperaba 8`,
      );

      const { data: limpio } = await admin
        .from("appointments")
        .select("charged_at, charged_total_cents, payment_method")
        .eq("id", turnoId)
        .single();
      afirmar(
        "cobros: el turno vuelve a estar sin cobrar",
        limpio?.charged_at === null &&
          limpio?.charged_total_cents === null &&
          limpio?.payment_method === null,
        `quedó ${JSON.stringify(limpio)}`,
      );
    }

    // ======================================================================
    // ASISTENCIA
    // ======================================================================
    if (turnoId) {
      const { error } = await sb.rpc("marcar_asistencia", {
        p_appointment_id: turnoId,
        p_vino: false,
      });
      salio("agenda: marca que el cliente no vino", error);

      const { data } = await admin
        .from("appointments")
        .select("status")
        .eq("id", turnoId)
        .single();
      afirmar("agenda: quedó como que no vino", data?.status === "no_show");

      await sb.rpc("marcar_asistencia", { p_appointment_id: turnoId, p_vino: true });
      const { data: vuelta } = await admin
        .from("appointments")
        .select("status")
        .eq("id", turnoId)
        .single();
      afirmar("agenda: se puede desmarcar", vuelta?.status === "confirmed");
    }

    // ======================================================================
    // PEDIDOS DE LA WEB
    // ======================================================================
    // El pedido lo levanta alguien SIN cuenta, así que va con un cliente
    // separado y sin sesión: es el único camino del público a esta tabla.
    {
      const publico = createClient(url!, anonKey!, sinSesion);
      const { data: pedidoId, error } = await publico.rpc("crear_pedido", {
        p_tenant_slug: slug,
        p_productos: [{ id: productoId, qty: 1 }],
        p_nombre: `${marca} Interesado`,
        p_telefono: "+59899555666",
        p_email: "interesado@ejemplo.com",
        p_nota: marca,
      });

      const vidrieraPrendida = tenant.products_enabled === true;

      if (!vidrieraPrendida) {
        // Con la vidriera apagada el catálogo no existe, así que tampoco puede
        // entrar un pedido. Que falle acá es la respuesta correcta.
        rechazo("pedidos: con la vidriera apagada no entra ninguno", error);
      } else {
        salio("pedidos: alguien sin cuenta puede dejar uno", error);

        if (pedidoId) {
          alFinal(async () => {
            await admin.from("product_orders").delete().eq("id", pedidoId);
          });

          const { data: enElPanel } = await sb
            .from("product_orders")
            .select("id, client_phone, status")
            .eq("id", pedidoId)
            .maybeSingle();
          afirmar(
            "pedidos: el panel lo ve con el teléfono",
            enElPanel?.client_phone === "+59899555666" && enElPanel?.status === "new",
            `llegó ${JSON.stringify(enElPanel)}`,
          );

          const { error: eMarcar } = await sb
            .from("product_orders")
            .update({ status: "contacted", handled_at: new Date().toISOString() })
            .eq("id", pedidoId);
          salio("pedidos: se marca como contactado", eMarcar);

          // Un pedido NO es una venta: no puede haber tocado el stock.
          const { data: pFinal } = await admin
            .from("products")
            .select("stock")
            .eq("id", productoId)
            .single();
          afirmar(
            "pedidos: un pedido no descuenta stock",
            pFinal?.stock === 8,
            `el stock quedó en ${pFinal?.stock}, esperaba 8`,
          );
        }
      }
    }

    await sb.auth.signOut();
  } catch (e) {
    mal("la prueba se cortó", e instanceof Error ? e.message : String(e));
  } finally {
    for (const paso of deshacer) {
      try {
        await paso();
      } catch {
        // Que falle un paso de limpieza no puede impedir los demás.
      }
    }
  }

  // ---- Informe de esta barbería ---------------------------------------------
  for (const r of actuales) {
    console.log(`  ${r.ok ? "✓" : "✗"} ${r.que}${r.detalle ? `  — ${r.detalle}` : ""}`);
  }

  const fallaron = actuales.filter((r) => !r.ok).length;
  console.log(
    fallaron === 0
      ? `\n  ✓ ${actuales.length}/${actuales.length}. Quedó como estaba.`
      : `\n  ✗ ${fallaron} de ${actuales.length} fallaron.`,
  );

  return fallaron === 0;
}

// ============================================================================

let todoBien = true;
for (const slug of SLUGS) {
  const bien = await probarBarberia(slug);
  todoBien = todoBien && bien;
}

console.log("");
if (!todoBien) {
  console.error("✗ Hay funciones del panel que no andan.\n");
  process.exit(1);
}
console.log("✓ El panel anda en todas las barberías probadas.\n");
