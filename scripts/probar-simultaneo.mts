/**
 * Diez personas tocando "Reservar" en el mismo instante.
 *
 *   node --env-file=.env.local scripts/probar-simultaneo.mts [slug] [cuántas]
 *
 * Es la falla que un producto de reservas no puede tener: dos clientes con el
 * mismo turno. Y es la que menos se ve probando a mano, porque una persona sola
 * nunca llega a hacer dos cosas a la vez.
 *
 * El riesgo no es teórico. La forma natural de escribir esto —"fijate si está
 * libre, y si está libre, guardalo"— deja una rendija entre las dos preguntas.
 * Si dos pedidos entran en esa rendija, los dos leen "libre" y los dos guardan.
 * Acá lo impide una restricción de exclusión de Postgres, que lo resuelve en el
 * momento de escribir y no antes.
 *
 * Se prueban las dos situaciones, que dan resultados distintos a propósito:
 *
 *   1. Todos piden EL MISMO barbero. Tiene que ganar exactamente uno.
 *   2. Nadie elige barbero ("el primero que haya"). Pueden ganar varios —hay
 *      varias sillas— pero nunca dos en la misma silla. Repartir mal acá es más
 *      sutil que chocar: no da error, solo deja a dos clientes esperando al
 *      mismo tipo.
 *
 * Y se mira el mensaje que recibe el que pierde. Un turno perdido con "Alguien
 * acaba de tomar ese horario" es una molestia; el mismo turno perdido con un
 * error de base de datos en pantalla es una barbería que pierde un cliente.
 */
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const slug = process.argv[2] ?? "barberia-central";
const cuantas = Number(process.argv[3] ?? 10);

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
const afirmar = (que: string, cond: boolean, detalle = "") =>
  resultados.push({ ok: cond, que, detalle: cond ? "" : detalle });

/** Mensajes que un cliente puede leer sin asustarse. */
const ENTENDIBLES = [
  "Alguien acaba de tomar ese horario",
  "No queda nadie libre",
  "no está disponible",
];

const esEntendible = (m: string) => ENTENDIBLES.some((e) => m.includes(e));

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
const marca = `SIMULTANEO-${randomUUID().slice(0, 6)}`;

const creados: string[] = [];

console.log(
  `\n${cuantas} reservas simultáneas en ${tenant.name}\n`,
);

try {
  const { data: servicios } = await admin
    .from("services")
    .select("id, duration_minutes")
    .eq("tenant_id", tenantId)
    .eq("kind", "service")
    .eq("is_active", true)
    .order("sort_order")
    .limit(1);

  const { data: barberos } = await admin
    .from("barbers")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .eq("accepts_bookings", true);

  const { data: tramos } = await admin
    .from("working_hours")
    .select("barber_id, weekday, starts_at, ends_at")
    .eq("tenant_id", tenantId);

  const servicio = servicios?.[0];
  if (!servicio || !barberos?.length || !tramos?.length) {
    throw new Error("la barbería no tiene servicio, barberos u horarios");
  }

  const dura = servicio.duration_minutes as number;

  // ---- Encontrar un horario libre de verdad --------------------------------
  // Se busca uno que sirva para TODOS los barberos que atienden, así la segunda
  // parte de la prueba tiene varias sillas donde repartir.
  const hoy = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const sumarDias = (f: string, d: number) => {
    const [y, m, dd] = f.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, dd + d)).toISOString().slice(0, 10);
  };
  const enMin = (h: string) => {
    const [a, b] = h.split(":").map(Number);
    return a * 60 + b;
  };
  const aHora = (m: number) =>
    `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

  /**
   * Cuántos barberos pueden atender ese horario exacto.
   *
   * Repite la cuenta que hace `crear_reserva`: el tramo tiene que cubrir el
   * turno entero Y la hora tiene que caer sobre la grilla de ESE barbero, que
   * arranca cuando arranca su tramo. Dos barberos que abren a horas distintas
   * pueden no compartir ni un solo horario aunque trabajen a la vez —Martín
   * desde las 9 y Diego desde las 10, con cortes de 40 minutos, nunca
   * coinciden—.
   *
   * Sin este número, la prueba no sabe qué esperar y termina dando por buena
   * cualquier cosa.
   */
  const sillasEn = (fecha: string, hora: string) => {
    const [y, m, d] = fecha.split("-").map(Number);
    const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    const h = enMin(hora);

    const sirven = new Set<string>();
    for (const t of tramos!) {
      if (t.weekday !== weekday) continue;
      const abre = enMin((t.starts_at as string).slice(0, 5));
      const cierra = enMin((t.ends_at as string).slice(0, 5));
      if (h < abre || h + dura > cierra) continue;
      if ((h - abre) % dura !== 0) continue;
      sirven.add(t.barber_id as string);
    }

    // Solo cuentan los que están activos y toman reservas.
    return [...sirven].filter((id) => barberos!.some((b) => b.id === id)).length;
  };

  /** Un horario que le sirva a la mayor cantidad de barberos posible. */
  function* candidatos() {
    for (let i = 1; i < 10; i++) {
      const fecha = sumarDias(hoy, i);
      const [y, m, d] = fecha.split("-").map(Number);
      const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();

      const delDia = tramos!.filter((t) => t.weekday === weekday);
      if (delDia.length === 0) continue;

      const horas = new Set<string>();
      for (const t of delDia) {
        const abre = enMin((t.starts_at as string).slice(0, 5));
        const cierra = enMin((t.ends_at as string).slice(0, 5));
        for (let x = abre; x + dura <= cierra; x += dura) horas.add(aHora(x));
      }

      // Los que más sillas juntan primero.
      const ordenadas = [...horas].sort((a, b) => {
        const libres = (h: string) =>
          delDia.filter(
            (t) =>
              enMin(h) >= enMin((t.starts_at as string).slice(0, 5)) &&
              enMin(h) + dura <= enMin((t.ends_at as string).slice(0, 5)),
          ).length;
        return libres(b) - libres(a);
      });

      for (const hora of ordenadas) yield { fecha, hora };
    }
  }

  /** Dispara N reservas de golpe y devuelve qué pasó con cada una. */
  const enTropel = async (
    fecha: string,
    hora: string,
    barberId: string | null,
  ) => {
    // Un cliente por pedido, como en la vida real: diez navegadores distintos.
    const pedidos = Array.from({ length: cuantas }, (_, i) => {
      const sb = createClient(url!, anonKey!, sinSesion);
      return sb.rpc("crear_reserva", {
        p_tenant_slug: slug,
        p_service_id: servicio.id,
        p_fecha: fecha,
        p_hora: hora,
        p_nombre: `${marca} ${i}`,
        p_telefono: "+59899000333",
        p_email: "simultaneo@ejemplo.com",
        ...(barberId ? { p_barber_id: barberId } : {}),
      });
    });

    // Sin await entre medio: salen todas juntas.
    const rtas = await Promise.all(pedidos);

    const ganaron = rtas.filter((r) => !r.error && r.data).map((r) => r.data as string);
    const perdieron = rtas.filter((r) => r.error).map((r) => r.error!.message);

    creados.push(...ganaron);
    return { ganaron, perdieron };
  };

  // Cada situación va en SU PROPIO horario. Reutilizar el mismo dejaría la
  // segunda parte peleando por un turno que la primera ya se llevó, y pasaría
  // sin haber probado nada.
  const libres = [...candidatos()];

  // ---- 1. Todos piden el mismo barbero -------------------------------------
  const paraUno = libres.find((c) => sillasEn(c.fecha, c.hora) >= 1);

  if (!paraUno) {
    afirmar("encontrar un horario libre", false, "no hay ninguno en diez días");
  } else {
    const barbero = barberos[0].id as string;
    const uno = await enTropel(paraUno.fecha, paraUno.hora, barbero);

    // Puede dar cero si ese horario no cae en la grilla de ESE barbero: se
    // busca uno que sí, y si no hay, se dice en vez de dar todo por bueno.
    const sirve = uno.ganaron.length > 0;

    afirmar(
      `pidiendo el mismo barbero, gana exactamente uno de ${cuantas}`,
      uno.ganaron.length === 1,
      sirve
        ? `¡entraron ${uno.ganaron.length}! Otros tantos clientes con el mismo turno.`
        : "ese barbero no atiende a esa hora — la prueba no llegó a correr",
    );

    const raros = uno.perdieron.filter((m) => !esEntendible(m));
    afirmar(
      "los que pierden reciben un mensaje que se entiende",
      raros.length === 0,
      `mensajes crudos: ${[...new Set(raros)].slice(0, 2).join(" · ")}`,
    );

    console.log(
      `  Barbero fijo · ${paraUno.fecha} ${paraUno.hora}: ` +
        `${uno.ganaron.length} entró, ${uno.perdieron.length} rebotaron`,
    );
  }

  // ---- 2. Sin elegir barbero ------------------------------------------------
  const paraVarios =
    libres.find(
      (c) => c !== paraUno && sillasEn(c.fecha, c.hora) >= 2,
    ) ?? libres.find((c) => c !== paraUno);

  if (!paraVarios) {
    afirmar("encontrar un segundo horario libre", false, "no quedó ninguno");
  } else {
    const sillas = sillasEn(paraVarios.fecha, paraVarios.hora);
    const dos = await enTropel(paraVarios.fecha, paraVarios.hora, null);

    // El número esperado no es "uno": es cuántas sillas hay. Una barbería con
    // tres barberos libres tiene que poder tomar tres reservas al mismo minuto
    // —negarlas sería perder plata— pero ni una más.
    const esperados = Math.min(sillas, cuantas);
    afirmar(
      `sin elegir barbero, entran ${esperados} (una por silla libre)`,
      dos.ganaron.length === esperados,
      `entraron ${dos.ganaron.length} para ${sillas} silla(s)`,
    );

    const { data: filas } = await admin
      .from("appointments")
      .select("barber_id")
      .in("public_token", dos.ganaron.length ? dos.ganaron : ["-"]);

    const usados = (filas ?? []).map((f) => f.barber_id as string);
    afirmar(
      "y cada una cae en un barbero distinto",
      new Set(usados).size === usados.length,
      "¡dos clientes quedaron con el mismo barbero a la misma hora!",
    );

    const rarosDos = dos.perdieron.filter((m) => !esEntendible(m));
    afirmar(
      "y ahí también el mensaje se entiende",
      rarosDos.length === 0,
      `mensajes crudos: ${[...new Set(rarosDos)].slice(0, 2).join(" · ")}`,
    );

    console.log(
      `  Sin elegir   · ${paraVarios.fecha} ${paraVarios.hora}: ` +
        `${dos.ganaron.length} entraron, ${dos.perdieron.length} rebotaron ` +
        `(${sillas} silla(s) libre(s))\n`,
    );
  }
} catch (e) {
  afirmar("la prueba se cortó", false, e instanceof Error ? e.message : String(e));
} finally {
  // Todo lo que llegó a entrar se borra, incluso si algo explotó.
  if (creados.length > 0) {
    await admin.from("appointments").delete().in("public_token", creados);
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
    "  Nadie se queda con el turno de otro, y el que pierde entiende por qué.\n",
);
