/**
 * ¿Sigue andando rápido con un año de trabajo encima?
 *
 *   node --env-file=.env.local scripts/probar-carga.mts [slug] [semanas]
 *
 * Las barberías de prueba tienen tres turnos. Una de verdad, a los seis meses,
 * tiene miles: una consulta sin índice o una cuenta que recorre todo no se nota
 * hoy y se nota cuando ya hay un cliente esperando.
 *
 * Llena la barbería con turnos reales repartidos en el pasado, mide lo que
 * espera una persona de carne y hueso, y borra todo. Lo que mide:
 *
 *   · La página de reservas, por HTTP. Es la única espera que sufre un cliente,
 *     y la más cara: arma la grilla de todos los barberos para todos los días
 *     de la ventana.
 *   · Las consultas del panel, que es lo que espera el barbero.
 *
 * No pretende ser una prueba de carga de las serias —no hay concurrencia ni
 * percentiles—. Contesta una sola pregunta: ¿hay algo que crezca con la
 * cantidad de turnos y se vaya de las manos?
 */
import { randomUUID } from "node:crypto";

import { clienteAdmin } from "./lib/alta.mts";
import { localToUtc } from "../src/lib/schedule.ts";

const slug = process.argv[2] ?? "barberia-central";
const semanas = Number(process.argv[3] ?? 52);

const base = `http://${slug}.lvh.me:3000`;

const admin = clienteAdmin();
const marca = `CARGA-${randomUUID().slice(0, 6)}`;

/** El tiempo de una operación, en milisegundos. */
async function medir<T>(f: () => PromiseLike<T>): Promise<[T, number]> {
  const t = performance.now();
  const r = await f();
  return [r, Math.round(performance.now() - t)];
}

/**
 * Varias corridas, y se informa la mediana: una sola medición miente.
 *
 * Acepta cualquier cosa que se pueda esperar, no solo una promesa: las
 * consultas de Supabase devuelven un armador de consultas que se ejecuta al
 * hacerle `await`, y no una promesa hecha y derecha.
 */
async function medirVarias(f: () => PromiseLike<unknown>, veces = 5): Promise<number> {
  const tiempos: number[] = [];
  for (let i = 0; i < veces; i++) {
    const [, ms] = await medir(f);
    tiempos.push(ms);
  }
  tiempos.sort((a, b) => a - b);
  return tiempos[Math.floor(tiempos.length / 2)];
}

const fmt = (ms: number) => `${String(ms).padStart(5)} ms`;

/** Un veredicto en criollo, para no quedarse mirando un número solo. */
function veredicto(ms: number, bueno: number, aceptable: number): string {
  if (ms <= bueno) return "bien";
  if (ms <= aceptable) return "aceptable";
  return "LENTO";
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

console.log(`\nProbando ${tenant.name} con ${semanas} semanas de trabajo\n`);

try {
  // ---- Medir en vacío, para tener contra qué comparar -----------------------
  const antesPublica = await medirVarias(() => fetch(base).then((r) => r.text()));

  const { count: turnosAntes } = await admin
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);

  console.log(`  Antes: ${turnosAntes ?? 0} turnos · página ${fmt(antesPublica)}\n`);

  // ---- Llenar --------------------------------------------------------------
  const { data: servicios } = await admin
    .from("services")
    .select("id, price_cents, duration_minutes")
    .eq("tenant_id", tenantId)
    .eq("kind", "service")
    .eq("is_active", true);

  const { data: barberos } = await admin
    .from("barbers")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("is_active", true);

  const { data: tramos } = await admin
    .from("working_hours")
    .select("barber_id, weekday, starts_at, ends_at");

  if (!servicios?.length || !barberos?.length || !tramos?.length) {
    throw new Error("la barbería no tiene servicios, barberos u horarios");
  }

  const enMin = (h: string) => {
    const [a, b] = h.split(":").map(Number);
    return a * 60 + b;
  };
  const aHora = (m: number) =>
    `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

  const hoy = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const restarDias = (f: string, d: number) => {
    const [y, m, dd] = f.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, dd - d)).toISOString().slice(0, 10);
  };

  const MEDIOS = ["cash", "card", "transfer"] as const;
  const filas: Record<string, unknown>[] = [];

  // Todo en el PASADO y ya cobrado. Un turno viejo sin cobrar trabaría el
  // cierre de caja de ese día, y estaríamos midiendo con la base en un estado
  // que en una barbería real no existe.
  for (let d = 1; d <= semanas * 7; d++) {
    const fecha = restarDias(hoy, d);
    const [y, m, dd] = fecha.split("-").map(Number);
    const weekday = new Date(Date.UTC(y, m - 1, dd)).getUTCDay();

    for (const b of barberos) {
      const suyos = tramos.filter(
        (t) => t.barber_id === b.id && t.weekday === weekday,
      );

      for (const t of suyos) {
        const abre = enMin((t.starts_at as string).slice(0, 5));
        const cierra = enMin((t.ends_at as string).slice(0, 5));

        for (let x = abre; x + 40 <= cierra; x += 40) {
          // Uno de cada cuatro huecos queda libre: una barbería no llena todos
          // los turnos de todos los días, y una base llena al 100% no se parece
          // a ninguna real.
          if ((d + x) % 4 === 0) continue;

          const s = servicios[(d + x) % servicios.length];
          const precio = s.price_cents as number;

          filas.push({
            tenant_id: tenantId,
            barber_id: b.id,
            service_id: s.id,
            kind: "booking",
            status: "confirmed",
            source: (d + x) % 3 === 0 ? "panel" : "online",
            starts_at: localToUtc(fecha, aHora(x), tz).toISOString(),
            ends_at: localToUtc(fecha, aHora(x + 40), tz).toISOString(),
            client_name: `${marca} ${d}-${x}`,
            client_phone: "+59899000000",
            client_email: "carga@ejemplo.com",
            price_cents: precio,
            duration_minutes: 40,
            charged_at: localToUtc(fecha, aHora(x + 40), tz).toISOString(),
            charged_total_cents: precio,
            charged_services_cents: precio,
            charged_products_cents: 0,
            payment_method: MEDIOS[(d + x) % 3],
          });
        }
      }
    }
  }

  console.log(`  Insertando ${filas.length} turnos…`);

  for (let i = 0; i < filas.length; i += 500) {
    const { error } = await admin.from("appointments").insert(filas.slice(i, i + 500));
    if (error) throw new Error(`al insertar: ${error.message}`);
  }

  const { count: turnosDespues } = await admin
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);

  console.log(`  Listo: ${turnosDespues ?? 0} turnos en la base\n`);

  // ---- Medir con la base llena ---------------------------------------------
  console.log("  ── Lo que espera un cliente ──────────────────────────");

  const publica = await medirVarias(() => fetch(base).then((r) => r.text()));
  console.log(
    `  Página de reservas       ${fmt(publica)}   ${veredicto(publica, 800, 2000)}` +
      `   (antes ${antesPublica} ms)`,
  );

  // ---- Lo que espera el barbero -------------------------------------------
  console.log("\n  ── Lo que espera el barbero ──────────────────────────");

  const ayer = restarDias(hoy, 1);

  const cobros = await medirVarias(() =>
    admin.rpc("turnos_para_cobrar", { p_tenant_slug: slug, p_fecha: ayer }),
  );
  console.log(`  Cobros de un día         ${fmt(cobros)}   ${veredicto(cobros, 300, 800)}`);

  const pendientes = await medirVarias(() =>
    admin.rpc("cobros_pendientes", { p_tenant_slug: slug }),
  );
  console.log(
    `  Buscar turnos sin cobrar ${fmt(pendientes)}   ${veredicto(pendientes, 300, 800)}`,
  );

  const desde = restarDias(hoy, 7);
  const semana = await medirVarias(() =>
    admin
      .from("appointments")
      .select("id, barber_id, starts_at, price_cents, charged_at, charged_services_cents")
      .eq("tenant_id", tenantId)
      .gte("starts_at", localToUtc(desde, "00:00", tz).toISOString())
      .lt("starts_at", localToUtc(hoy, "00:00", tz).toISOString()),
  );
  console.log(`  Recuento de una semana   ${fmt(semana)}   ${veredicto(semana, 300, 800)}`);

  const desdeMes = restarDias(hoy, 30);
  const mes = await medirVarias(() =>
    admin
      .from("appointments")
      .select("id, barber_id, starts_at, price_cents, charged_at, charged_services_cents")
      .eq("tenant_id", tenantId)
      .gte("starts_at", localToUtc(desdeMes, "00:00", tz).toISOString())
      .lt("starts_at", localToUtc(hoy, "00:00", tz).toISOString()),
  );
  console.log(`  Recuento de un mes       ${fmt(mes)}   ${veredicto(mes, 500, 1200)}`);

  // La página pública mira hacia adelante, donde no hay nada. Ese es el punto:
  // que lo viejo no le pese. Si la reserva se pusiera lenta con un año de
  // historia, sería que está mirando turnos que no le importan.
  console.log(
    `\n  La página de reservas pasó de ${antesPublica} ms a ${publica} ms ` +
      `con ${filas.length} turnos más.\n` +
      "  Solo mira hacia adelante, así que el historial no debería pesarle.\n",
  );
} catch (e) {
  console.error(`\n✗ ${e instanceof Error ? e.message : String(e)}\n`);
  process.exitCode = 1;
} finally {
  console.log("  Borrando los turnos de prueba…");
  const { error } = await admin
    .from("appointments")
    .delete()
    .eq("tenant_id", tenantId)
    .like("client_name", `${marca}%`);

  if (error) {
    console.error(
      `\n  ⚠ No se pudieron borrar: ${error.message}\n` +
        `  Quedaron con el nombre "${marca} …" y hay que sacarlos a mano.\n`,
    );
  } else {
    const { count } = await admin
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId);
    console.log(`  Listo. Quedan ${count ?? 0} turnos.\n`);
  }
}
