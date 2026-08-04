/**
 * ¿Una barbería puede ver o tocar los datos de otra?
 *
 *   node --env-file=.env.local scripts/probar-aislamiento.mts <slugA> <slugB>
 *   node --env-file=.env.local scripts/probar-aislamiento.mts
 *       (por defecto: barberia-central contra studio-norte)
 *
 * Esta es la prueba que decide si el producto se puede vender. Todo lo demás
 * —que la agenda calcule bien, que la caja cierre— es un error molesto si
 * falla. Que el dueño de una barbería vea los teléfonos de los clientes de otra
 * no es un error molesto: es el fin del producto.
 *
 * Y es la clase de cosa que no se nota probando a mano, porque con una sola
 * barbería en la base no hay de quién separarse. Las políticas de RLS pueden
 * estar mal escritas durante meses sin que nada se vea raro.
 *
 * CÓMO FUNCIONA
 *   1. Con la service role key —que saltea RLS— planta datos reconocibles en B:
 *      un turno con teléfono, un pago, un pedido, una venta, un producto
 *      guardado.
 *   2. Crea una cuenta temporal y la hace DUEÑA de A. Dueña: el permiso más
 *      alto que existe. Si ni el dueño puede, nadie puede.
 *   3. Entra con esa cuenta usando la anon key, igual que el navegador, e
 *      intenta leer, llamar y escribir todo lo de B.
 *   4. Borra lo que plantó y la cuenta temporal, pase lo que pase.
 *
 * Lo que NO es una filtración, y por eso no se cuenta como tal: el nombre de
 * una barbería, sus colores, sus servicios activos, sus horarios y quiénes
 * atienden son públicos a propósito —cualquiera que abra la página de reservas
 * los ve, sin cuenta—. Lo que nunca puede salir es el dato de una persona y el
 * dinero.
 */
import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";

const [slugA = "barberia-central", slugB = "studio-norte"] = process.argv.slice(2);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceKey) {
  console.error(
    "Faltan variables de entorno.\n" +
      "  node --env-file=.env.local scripts/probar-aislamiento.mts <slugA> <slugB>",
  );
  process.exit(1);
}

const sinSesion = { auth: { autoRefreshToken: false, persistSession: false } };
const admin = createClient(url, serviceKey, sinSesion);

if (slugA === slugB) {
  console.error("Los dos slugs son el mismo. La prueba necesita dos barberías.");
  process.exit(1);
}

// ---- Resultados -------------------------------------------------------------
type Resultado = { ok: boolean; que: string; detalle: string };
const resultados: Resultado[] = [];

function revisar(que: string, ok: boolean, detalle = "") {
  resultados.push({ ok, que, detalle });
}

/** Cuántas filas de B devolvió una consulta que no tendría que devolver ninguna. */
function filtro(que: string, filas: unknown[] | null, error: { message: string } | null) {
  // Un error de permisos también es un "no lo ve". Lo que importa es que el
  // dato no llegue, no de qué manera se lo impidió.
  if (error) return revisar(que, true, "rechazado por la base");
  const n = filas?.length ?? 0;
  revisar(que, n === 0, n === 0 ? "" : `¡devolvió ${n} fila(s) de ${slugB}!`);
}

/** Una llamada que tiene que ser rechazada. */
function rechaza(que: string, error: { message: string } | null, datos?: unknown) {
  if (error) return revisar(que, true, "rechazado");
  const vacio = Array.isArray(datos) && datos.length === 0;
  revisar(que, vacio, vacio ? "no devolvió nada" : "¡la dejó pasar!");
}

// ---- Buscar las dos barberías ----------------------------------------------
const { data: tenantes } = await admin
  .from("tenants")
  .select("id, name, slug, timezone")
  .in("slug", [slugA, slugB]);

const A = (tenantes ?? []).find((t) => t.slug === slugA);
const B = (tenantes ?? []).find((t) => t.slug === slugB);

if (!A || !B) {
  console.error(
    `No encontré ${!A ? slugA : slugB}.\n` +
      "Corré primero:  node --env-file=.env.local scripts/sembrar-demo.mts",
  );
  process.exit(1);
}

console.log(`\nProbando aislamiento: ${A.name} → ${B.name}\n`);

// ============================================================================
// 1. Plantar el cebo en B
// ============================================================================
const marca = `AISLAMIENTO-${randomUUID().slice(0, 8)}`;
const creado = {
  userId: null as string | null,
  barberoEnA: null as string | null,
  turnoEnB: null as string | null,
  productoEnB: null as string | null,
  pagoEnB: null as string | null,
  pedidoEnB: null as string | null,
  ventaEnB: null as string | null,
};

async function limpiar() {
  if (creado.turnoEnB) await admin.from("appointments").delete().eq("id", creado.turnoEnB);
  if (creado.productoEnB) await admin.from("products").delete().eq("id", creado.productoEnB);
  if (creado.pagoEnB) await admin.from("barber_payouts").delete().eq("id", creado.pagoEnB);
  if (creado.pedidoEnB) await admin.from("product_orders").delete().eq("id", creado.pedidoEnB);
  if (creado.ventaEnB) await admin.from("counter_sales").delete().eq("id", creado.ventaEnB);
  if (creado.barberoEnA) await admin.from("barbers").delete().eq("id", creado.barberoEnA);
  if (creado.userId) await admin.auth.admin.deleteUser(creado.userId);
}

try {
  // Un barbero y un servicio de B, para poder armarle un turno.
  const { data: barberosB } = await admin
    .from("barbers")
    .select("id")
    .eq("tenant_id", B.id)
    .limit(1);
  const { data: serviciosB } = await admin
    .from("services")
    .select("id, price_cents, duration_minutes")
    .eq("tenant_id", B.id)
    .eq("kind", "service")
    .limit(1);

  const barberoB = barberosB?.[0];
  const servicioB = serviciosB?.[0];

  if (barberoB && servicioB) {
    // Bien lejos en el futuro, para no chocar con nada real ni con la
    // restricción de superposición.
    const inicio = new Date(Date.now() + 400 * 24 * 3600 * 1000);
    const fin = new Date(inicio.getTime() + (servicioB.duration_minutes as number) * 60000);

    const { data: turno, error } = await admin
      .from("appointments")
      .insert({
        tenant_id: B.id,
        barber_id: barberoB.id,
        service_id: servicioB.id,
        kind: "booking",
        status: "confirmed",
        source: "online",
        starts_at: inicio.toISOString(),
        ends_at: fin.toISOString(),
        client_name: `${marca} Cliente`,
        client_phone: "+59899111222",
        client_email: "cebo@ejemplo.com",
        price_cents: servicioB.price_cents,
        duration_minutes: servicioB.duration_minutes,
      })
      .select("id")
      .single();

    if (error) throw new Error(`no pude plantar el turno en ${slugB}: ${error.message}`);
    creado.turnoEnB = turno.id as string;

    const { data: pago } = await admin
      .from("barber_payouts")
      .insert({
        tenant_id: B.id,
        barber_id: barberoB.id,
        direction: "out",
        amount_cents: 123456,
        period_from: "2026-01-01",
        period_to: "2026-01-07",
        paid_on: "2026-01-08",
        note: marca,
      })
      .select("id")
      .single();
    creado.pagoEnB = (pago?.id as string) ?? null;

    const { data: venta } = await admin
      .from("counter_sales")
      .insert({
        tenant_id: B.id,
        total_cents: 54321,
        payment_method: "cash",
        sold_by: barberoB.id,
        note: marca,
      })
      .select("id")
      .single();
    creado.ventaEnB = (venta?.id as string) ?? null;
  }

  // Un producto GUARDADO (fuera del catálogo): los activos de una barbería con
  // la vidriera prendida son públicos a propósito, este no.
  const { data: producto } = await admin
    .from("products")
    .insert({
      tenant_id: B.id,
      name: `${marca} guardado`,
      price_cents: 99900,
      stock: 3,
      is_active: false,
    })
    .select("id")
    .single();
  creado.productoEnB = (producto?.id as string) ?? null;

  const { data: pedido } = await admin
    .from("product_orders")
    .insert({
      tenant_id: B.id,
      client_name: `${marca} Pedido`,
      client_phone: "+59899333444",
      client_email: "pedido@ejemplo.com",
      note: marca,
    })
    .select("id")
    .single();
  creado.pedidoEnB = (pedido?.id as string) ?? null;

  // ==========================================================================
  // 2. Una cuenta que es DUEÑA de A y nada más
  // ==========================================================================
  const email = `aislamiento-${randomUUID().slice(0, 8)}@ejemplo.com`;
  const password = randomBytes(12).toString("base64url");

  const { data: cuenta, error: eCuenta } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (eCuenta || !cuenta?.user) throw new Error(`cuenta temporal: ${eCuenta?.message}`);
  creado.userId = cuenta.user.id;

  const { data: barberoA, error: eBarbero } = await admin
    .from("barbers")
    .insert({
      tenant_id: A.id,
      user_id: cuenta.user.id,
      role: "owner",
      display_name: `${marca} Dueño`,
      email,
      accepts_bookings: false,
      payment_model: "revenue_only",
      sort_order: 99,
    })
    .select("id")
    .single();
  if (eBarbero || !barberoA) throw new Error(`barbero temporal: ${eBarbero?.message}`);
  creado.barberoEnA = barberoA.id as string;

  // ==========================================================================
  // 3. Entrar como esa cuenta, igual que el navegador
  // ==========================================================================
  const comoDuenioDeA = createClient(url, anonKey, sinSesion);
  const { error: eLogin } = await comoDuenioDeA.auth.signInWithPassword({
    email,
    password,
  });
  if (eLogin) throw new Error(`no pude entrar con la cuenta temporal: ${eLogin.message}`);

  // ---- Control: tiene que ver lo SUYO --------------------------------------
  // Sin esto, una sesión rota haría pasar toda la prueba: no ver nada de B es
  // fácil si tampoco se ve nada de A.
  {
    const { data } = await comoDuenioDeA.from("services").select("id").eq("tenant_id", A.id);
    revisar(
      `control: ve los servicios de ${slugA}`,
      (data?.length ?? 0) > 0,
      (data?.length ?? 0) > 0 ? "" : "la sesión no está viendo NADA — prueba inválida",
    );
  }

  // ==========================================================================
  // 4. Leer lo de B
  // ==========================================================================
  const noVe = async (tabla: string, que: string) => {
    const { data, error } = await comoDuenioDeA.from(tabla).select("*").eq("tenant_id", B.id);
    filtro(que, data, error);
  };

  await noVe("appointments", "no ve los turnos (nombre, teléfono y mail del cliente)");
  await noVe("barber_payouts", "no ve los pagos a los barberos");
  await noVe("product_orders", "no ve los pedidos de la web");
  await noVe("product_order_items", "no ve qué pidió cada uno");
  await noVe("counter_sales", "no ve las ventas de mostrador");
  await noVe("counter_sale_items", "no ve los renglones de esas ventas");
  await noVe("cash_closures", "no ve los cierres de caja");
  await noVe("appointment_items", "no ve los tickets");

  {
    const { data, error } = await comoDuenioDeA
      .from("products")
      .select("id")
      .eq("tenant_id", B.id)
      .eq("is_active", false);
    filtro("no ve los productos guardados", data, error);
  }

  {
    const { data, error } = await comoDuenioDeA
      .from("services")
      .select("id")
      .eq("tenant_id", B.id)
      .eq("is_active", false);
    filtro("no ve los servicios dados de baja", data, error);
  }

  // El mail y el teléfono del barbero están fuera del GRANT, no del RLS: la
  // fila se ve —la página de reservas muestra quién atiende— pero esas dos
  // columnas no. Son dos mecanismos distintos y este es el único chequeo que
  // toca el segundo.
  {
    const { data, error } = await comoDuenioDeA
      .from("barbers")
      .select("email, phone")
      .eq("tenant_id", B.id);
    const filtrado = (data ?? []).some((b) => b.email !== null || b.phone !== null);
    revisar(
      "no ve el mail ni el teléfono de los barberos ajenos",
      Boolean(error) || !filtrado,
      filtrado ? "¡devolvió el contacto de un barbero de la otra barbería!" : "",
    );
  }

  // ==========================================================================
  // 5. Llamar a las funciones de B
  // ==========================================================================
  const hoy = new Date().toISOString().slice(0, 10);

  {
    const { data, error } = await comoDuenioDeA.rpc("turnos_para_cobrar", {
      p_tenant_slug: slugB,
      p_fecha: hoy,
    });
    rechaza("no puede abrir la caja de la otra barbería", error, data);
  }

  {
    const { data, error } = await comoDuenioDeA.rpc("cobros_pendientes", {
      p_tenant_slug: slugB,
    });
    // Esta devuelve una fila de totales aunque no haya nada: lo que no puede
    // hacer es contar turnos ajenos.
    const fila = (data as { cantidad: number }[] | null)?.[0];
    const cuantos = Number(fila?.cantidad ?? 0);
    revisar(
      "no cuenta los cobros pendientes de la otra",
      Boolean(error) || cuantos === 0,
      cuantos > 0 ? `¡contó ${cuantos}!` : "",
    );
  }

  {
    const { error } = await comoDuenioDeA.rpc("cerrar_caja", {
      p_tenant_slug: slugB,
      p_fecha: hoy,
      p_contado_cash: 0,
      p_contado_card: 0,
      p_contado_transfer: 0,
      p_nota: marca,
    });
    rechaza("no puede cerrarle la caja a la otra barbería", error);
  }

  {
    const { error } = await comoDuenioDeA.rpc("vender_mostrador", {
      p_tenant_slug: slugB,
      p_productos: [{ id: creado.productoEnB, qty: 1 }],
      p_payment_method: "cash",
      p_nota: marca,
    });
    rechaza("no puede vender por el mostrador de la otra", error);
  }

  if (creado.turnoEnB) {
    {
      const { error } = await comoDuenioDeA.rpc("cobrar_turno", {
        p_appointment_id: creado.turnoEnB,
        p_extras: [],
        p_payment_method: "cash",
        p_productos: [],
      });
      rechaza("no puede cobrar un turno ajeno", error);
    }
    {
      const { error } = await comoDuenioDeA.rpc("anular_cobro", {
        p_appointment_id: creado.turnoEnB,
      });
      rechaza("no puede anular un cobro ajeno", error);
    }
    {
      const { error } = await comoDuenioDeA.rpc("marcar_asistencia", {
        p_appointment_id: creado.turnoEnB,
        p_vino: false,
      });
      rechaza("no puede marcar asistencia en un turno ajeno", error);
    }
  }

  // ==========================================================================
  // 6. Escribir en B
  // ==========================================================================
  {
    const { error } = await comoDuenioDeA.from("products").insert({
      tenant_id: B.id,
      name: `${marca} intruso`,
      price_cents: 100,
      stock: 1,
    });
    revisar("no puede cargarle productos a la otra", Boolean(error), error ? "" : "¡lo insertó!");
  }

  {
    const { error } = await comoDuenioDeA.from("barbers").insert({
      tenant_id: B.id,
      role: "owner",
      display_name: `${marca} intruso`,
      payment_model: "revenue_only",
    });
    revisar(
      "no puede meterse como dueño de la otra",
      Boolean(error),
      error ? "" : "¡se dio de alta solo!",
    );
  }

  {
    await comoDuenioDeA.from("tenants").update({ name: `${marca} pisado` }).eq("id", B.id);
    const { data } = await admin.from("tenants").select("name").eq("id", B.id).single();
    revisar(
      "no puede renombrarle la barbería a la otra",
      data?.name === B.name,
      data?.name === B.name ? "" : `¡le cambió el nombre a "${data?.name}"!`,
    );
  }

  if (creado.turnoEnB) {
    await comoDuenioDeA.from("appointments").delete().eq("id", creado.turnoEnB);
    const { data } = await admin
      .from("appointments")
      .select("id, client_name")
      .eq("id", creado.turnoEnB)
      .maybeSingle();
    revisar("no puede borrarle un turno a la otra", Boolean(data), data ? "" : "¡lo borró!");

    await comoDuenioDeA
      .from("appointments")
      .update({ client_name: `${marca} pisado` })
      .eq("id", creado.turnoEnB);
    const { data: despues } = await admin
      .from("appointments")
      .select("client_name")
      .eq("id", creado.turnoEnB)
      .maybeSingle();
    revisar(
      "no puede editarle un turno a la otra",
      despues?.client_name === `${marca} Cliente`,
      despues?.client_name === `${marca} Cliente` ? "" : "¡le cambió el cliente!",
    );
  }

  // Storage: las fotos de las dos barberías viven en el mismo bucket, separadas
  // solo por la carpeta. Si esa política estuviera mal, una barbería podría
  // pisarle el logo a la otra.
  {
    const ruta = `${B.id}/productos/${marca}.txt`;
    const { error } = await comoDuenioDeA.storage
      .from("tenant-assets")
      .upload(ruta, new Blob(["intruso"], { type: "text/plain" }));
    if (!error) await admin.storage.from("tenant-assets").remove([ruta]);
    revisar(
      "no puede subir archivos a la carpeta de la otra",
      Boolean(error),
      error ? "" : "¡subió un archivo a su bucket!",
    );
  }

  await comoDuenioDeA.auth.signOut();
} finally {
  await limpiar();
}

// ============================================================================
// El veredicto
// ============================================================================
const fallaron = resultados.filter((r) => !r.ok);

for (const r of resultados) {
  const marca_ = r.ok ? "✓" : "✗";
  console.log(`  ${marca_} ${r.que}${r.detalle ? `  — ${r.detalle}` : ""}`);
}

console.log("");

if (fallaron.length > 0) {
  console.error(
    `✗ ${fallaron.length} de ${resultados.length} fallaron. ` +
      "NO se puede vender esto hasta arreglarlo.\n",
  );
  process.exit(1);
}

console.log(
  `✓ Las ${resultados.length} pruebas pasaron.\n` +
    `  ${A.name} no puede ver ni tocar nada de ${B.name}.\n` +
    "  Se limpió todo lo que se creó para probar.\n",
);
