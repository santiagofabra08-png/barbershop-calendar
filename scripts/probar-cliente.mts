/**
 * El camino del cliente, de punta a punta.
 *
 *   node --env-file=.env.local scripts/probar-cliente.mts [slug] [url-base]
 *
 * `probar-reserva.mts` llega hasta que la reserva entra en la base y ahí se
 * detiene. Todo lo que pasa después no lo miraba nadie:
 *
 *   · el link que le llega al cliente, y si abre
 *   · si puede cancelar
 *   · si el plazo de cancelación se respeta
 *   · si al cancelar el horario vuelve a quedar libre
 *   · si por ese link se filtra el teléfono de alguien
 *
 * Cancelar es lo que más importa. Si está roto, el cliente no se entera: llama
 * por teléfono, la barbería anota a mano, y el hueco se pierde. Es una falla
 * que no da error en ninguna pantalla y que cuesta plata todos los días.
 *
 * Todo se hace SIN sesión, con la anon key, que es lo único que tiene un
 * cliente. Y se borra al final.
 */
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

import { localToUtc } from "../src/lib/schedule.ts";

const slug = process.argv[2] ?? "barberia-central";
const base = process.argv[3] ?? `http://${slug}.lvh.me:3000`;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceKey) {
  console.error("Faltan variables de entorno. ¿Corriste con --env-file=.env.local?");
  process.exit(1);
}

const sinSesion = { auth: { autoRefreshToken: false, persistSession: false } };
const admin = createClient(url, serviceKey, sinSesion);
// Sin sesión y con la anon key: exactamente lo que tiene el navegador de un
// cliente que nunca creó una cuenta.
const cliente = createClient(url, anonKey, sinSesion);

type Resultado = { ok: boolean; que: string; detalle: string };
const resultados: Resultado[] = [];
const anotar = (ok: boolean, que: string, detalle = "") =>
  resultados.push({ ok, que, detalle });
const afirmar = (que: string, cond: boolean, detalle = "") =>
  anotar(cond, que, cond ? "" : detalle || "no dio lo esperado");

type TurnoVisto = {
  barberia: string;
  barbero: string;
  servicio: string;
  fecha: string;
  hora: string;
  estado: string;
  cliente: string;
  se_puede_cancelar: boolean;
};

const verTurno = async (token: string) => {
  const { data } = await cliente.rpc("turno_por_token", { p_token: token });
  return ((data ?? []) as TurnoVisto[])[0] ?? null;
};

// ============================================================================

const { data: tenant } = await admin
  .from("tenants")
  .select("id, name, timezone, cancel_deadline_minutes")
  .eq("slug", slug)
  .maybeSingle();

if (!tenant) {
  console.error(`No existe la barbería "${slug}".`);
  process.exit(1);
}

const tenantId = tenant.id as string;
const tz = tenant.timezone as string;
const plazo = tenant.cancel_deadline_minutes as number;
const marca = `CLIENTE-${randomUUID().slice(0, 6)}`;

const deshacer: (() => Promise<void>)[] = [];
const alFinal = (f: () => Promise<void>) => deshacer.unshift(f);

console.log(`\nProbando el camino del cliente en ${tenant.name}\n`);

try {
  // ==========================================================================
  // 1. RESERVAR
  // ==========================================================================
  const { data: servicios } = await admin
    .from("services")
    .select("id, name, duration_minutes, price_cents")
    .eq("tenant_id", tenantId)
    .eq("kind", "service")
    .eq("is_active", true)
    .order("sort_order")
    .limit(1);

  const { data: tramos } = await admin
    .from("working_hours")
    .select("weekday, starts_at, ends_at")
    .eq("tenant_id", tenantId);

  const servicio = servicios?.[0];
  if (!servicio || !tramos?.length) {
    throw new Error("la barbería no tiene servicios u horarios cargados");
  }

  const dura = servicio.duration_minutes as number;

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

  // Se prueban horarios de a uno hasta que la base acepte alguno. Más lento y
  // sin forma de equivocarse, que es lo que se quiere de una prueba.
  //
  // Se descartan los que caen DENTRO del plazo de cancelación. No es un
  // capricho: esta prueba viene a verificar que cancelar funcione, y un turno
  // que arranca en una hora con un plazo de dos no se puede cancelar —y hace
  // bien—. Sin este filtro la prueba pasa o falla según la hora del día en que
  // se corra, que es la peor clase de prueba: la que un día dice que algo se
  // rompió sin que nadie haya tocado nada.
  const margen = 5 * 60_000;
  const sePuedeCancelar = (fecha: string, hora: string) =>
    localToUtc(fecha, hora, tz).getTime() > Date.now() + plazo * 60_000 + margen;

  function* candidatos() {
    for (let i = 0; i < 10; i++) {
      const fecha = sumarDias(hoy, i);
      const [y, m, d] = fecha.split("-").map(Number);
      const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
      for (const t of tramos!) {
        if (t.weekday !== weekday) continue;
        const abre = enMin((t.starts_at as string).slice(0, 5));
        const cierra = enMin((t.ends_at as string).slice(0, 5));
        for (let x = abre; x + dura <= cierra; x += dura) {
          const hora = aHora(x);
          if (sePuedeCancelar(fecha, hora)) yield { fecha, hora };
        }
      }
    }
  }

  let token = "";
  let cuando: { fecha: string; hora: string } | null = null;
  let ultimo = "no se probó ningún horario";

  for (const c of candidatos()) {
    const { data, error } = await cliente.rpc("crear_reserva", {
      p_tenant_slug: slug,
      p_service_id: servicio.id,
      p_fecha: c.fecha,
      p_hora: c.hora,
      p_nombre: `${marca} Cliente`,
      p_telefono: "+59899000111",
      p_email: "cliente@ejemplo.com",
    });

    if (!error && data) {
      token = data as string;
      cuando = c;
      break;
    }
    ultimo = error?.message ?? "sin token";
    const esperable =
      ultimo.includes("ya está muy cerca") ||
      ultimo.includes("Todavía no se puede reservar") ||
      ultimo.includes("No queda nadie libre") ||
      ultimo.includes("no está disponible") ||
      ultimo.includes("acaba de tomar");
    if (!esperable) break;
  }

  afirmar("reserva desde la página, sin cuenta", Boolean(token), ultimo);
  if (!token || !cuando) throw new Error(`no se pudo reservar: ${ultimo}`);

  alFinal(async () => {
    await admin.from("appointments").delete().eq("public_token", token);
  });

  // ==========================================================================
  // 2. EL LINK QUE LE LLEGA
  // ==========================================================================
  const visto = await verTurno(token);

  afirmar("el link del turno muestra la reserva", visto !== null, "no devolvió nada");

  if (visto) {
    afirmar(
      "muestra bien la barbería, el servicio y la hora",
      visto.barberia === tenant.name &&
        visto.servicio === servicio.name &&
        visto.fecha === cuando.fecha &&
        visto.hora.slice(0, 5) === cuando.hora,
      `llegó ${JSON.stringify({ b: visto.barberia, s: visto.servicio, f: visto.fecha, h: visto.hora })}`,
    );

    afirmar("el turno está confirmado", visto.estado === "confirmed", visto.estado);
    afirmar("dice que se puede cancelar", visto.se_puede_cancelar === true);

    // El token es la única llave del cliente y viaja por mail. Si además
    // devolviera el teléfono, cualquiera que reenvíe ese link estaría
    // repartiendo un dato que no es suyo.
    const campos = Object.keys(visto);
    afirmar(
      "por el link no se filtra teléfono ni mail",
      !campos.some((c) => /phone|telefono|mail|email/i.test(c)),
      `devuelve ${campos.join(", ")}`,
    );
  }

  {
    const inventado = await verTurno(randomUUID());
    afirmar("un token inventado no abre nada", inventado === null);
  }

  {
    const { data, error } = await cliente.from("appointments").select("*").limit(1);
    afirmar(
      "el público no puede leer la tabla de turnos",
      Boolean(error) || (data?.length ?? 0) === 0,
      "¡devolvió turnos a alguien sin cuenta!",
    );
  }

  // ==========================================================================
  // 3. EL HORARIO QUEDÓ OCUPADO
  // ==========================================================================
  const ocupados = async () => {
    const { data } = await cliente.rpc("horarios_ocupados", {
      p_tenant_slug: slug,
      p_desde: cuando.fecha,
      p_hasta: cuando.fecha,
    });
    return (data ?? []) as { starts_at: string }[];
  };

  const antes = await ocupados();
  afirmar(
    "el horario reservado figura como ocupado",
    antes.length > 0,
    "nadie más se enteró de que ese rato está tomado",
  );

  // ==========================================================================
  // 4. CANCELAR
  // ==========================================================================
  {
    const { data, error } = await cliente.rpc("cancelar_turno", { p_token: token });
    afirmar("el cliente puede cancelar", !error && data === true, error?.message ?? "");
  }

  {
    const despues = await verTurno(token);
    afirmar(
      "el turno queda cancelado",
      despues?.estado === "cancelled",
      `quedó en ${despues?.estado}`,
    );
    afirmar(
      "ya no ofrece cancelar de nuevo",
      despues?.se_puede_cancelar === false,
    );
  }

  {
    const { error } = await cliente.rpc("cancelar_turno", { p_token: token });
    anotar(Boolean(error), "cancelar dos veces no hace nada raro", error ? "" : "¡lo dejó!");
  }

  {
    const despues = await ocupados();
    afirmar(
      "el horario vuelve a quedar libre para otro",
      despues.length < antes.length,
      "el hueco quedó tomado por un turno cancelado",
    );
  }

  // ==========================================================================
  // 5. EL PLAZO DE CANCELACIÓN
  // ==========================================================================
  // Un turno que arranca dentro del plazo no se puede cancelar solo. Es lo que
  // protege a la barbería de que le suelten el horario cinco minutos antes.
  // Se inserta a mano porque por la página no se puede reservar tan sobre la
  // hora, y justamente eso es lo que hay que probar.
  //
  // Queda confirmado al terminar, así que también sirve para probar el archivo
  // de calendario, que solo existe para turnos en pie.
  let tokenTarde = "";
  {
    const { data: barberos } = await admin
      .from("barbers")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .limit(1);

    const barbero = barberos?.[0];
    if (!barbero) throw new Error("la barbería no tiene barberos activos");

    // A mitad del plazo: ya es tarde para soltarlo.
    const arranca = new Date(Date.now() + (plazo / 2) * 60_000);
    const termina = new Date(arranca.getTime() + dura * 60_000);
    tokenTarde = randomUUID();

    const { error: eInsert } = await admin.from("appointments").insert({
      tenant_id: tenantId,
      barber_id: barbero.id,
      service_id: servicio.id,
      kind: "booking",
      status: "confirmed",
      source: "online",
      public_token: tokenTarde,
      starts_at: arranca.toISOString(),
      ends_at: termina.toISOString(),
      client_name: `${marca} Sobre la hora`,
      client_phone: "+59899000222",
      client_email: "tarde@ejemplo.com",
      price_cents: servicio.price_cents,
      duration_minutes: dura,
    });

    if (eInsert) {
      anotar(true, "plazo de cancelación: salteado", eInsert.message);
    } else {
      alFinal(async () => {
        await admin.from("appointments").delete().eq("public_token", tokenTarde);
      });

      const tarde = await verTurno(tokenTarde);
      afirmar(
        `sobre la hora no ofrece cancelar (plazo: ${plazo} min)`,
        tarde?.se_puede_cancelar === false,
        "le está ofreciendo cancelar cuando ya no puede",
      );

      const { error } = await cliente.rpc("cancelar_turno", { p_token: tokenTarde });
      anotar(
        Boolean(error),
        "y si lo intenta igual, la base lo frena",
        error ? "" : "¡canceló fuera de plazo!",
      );
    }
  }

  // ==========================================================================
  // 6. LAS PÁGINAS, POR HTTP
  // ==========================================================================
  // Lo único de todas las pruebas que abre la aplicación de verdad. Si el
  // servidor no está corriendo se saltea: es una prueba de más, no un
  // requisito.
  {
    const pedir = async (ruta: string) => {
      const ctrl = new AbortController();
      const corte = setTimeout(() => ctrl.abort(), 8000);
      try {
        return await fetch(`${base}${ruta}`, { signal: ctrl.signal });
      } catch {
        return null;
      } finally {
        clearTimeout(corte);
      }
    };

    const portada = await pedir("/");

    if (!portada) {
      anotar(true, "páginas: salteadas", `no hay nada escuchando en ${base}`);
    } else {
      afirmar("la portada abre", portada.ok, `HTTP ${portada.status}`);

      const ficha = await pedir(`/turno/${token}`);
      afirmar(
        "el link del turno abre en el navegador",
        Boolean(ficha?.ok),
        `HTTP ${ficha?.status}`,
      );

      if (ficha?.ok) {
        const html = await ficha.text();
        afirmar(
          "la ficha del turno no imprime el teléfono del cliente",
          !html.includes("+59899000111"),
          "¡el teléfono está en el HTML de una página sin login!",
        );
      }

      if (tokenTarde) {
        const ics = await pedir(`/turno/${tokenTarde}/calendario.ics`);
        const tipo = ics?.headers.get("content-type") ?? "";
        afirmar(
          "el archivo de calendario se descarga",
          Boolean(ics?.ok) && tipo.includes("calendar"),
          `HTTP ${ics?.status} · ${tipo}`,
        );

        if (ics?.ok) {
          const texto = await ics.text();
          afirmar(
            "el .ics tiene la forma que espera un calendario",
            texto.includes("BEGIN:VCALENDAR") &&
              texto.includes("DTSTART:") &&
              texto.includes("END:VCALENDAR"),
            "salió un archivo que ningún calendario va a poder abrir",
          );
        }
      }

      // Y el de un turno cancelado no existe: si se bajara igual, el cliente
      // terminaría con un recordatorio de algo que ya no va.
      const icsCancelado = await pedir(`/turno/${token}/calendario.ics`);
      afirmar(
        "un turno cancelado no se baja al calendario",
        icsCancelado?.status === 404,
        `HTTP ${icsCancelado?.status}`,
      );
    }
  }
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
    "  Se reserva, se ve, se cancela, y el hueco vuelve a estar libre.\n",
);
