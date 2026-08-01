/**
 * Prueba de humo: ¿se puede reservar de verdad?
 *
 *   node --env-file=.env.local scripts/probar-reserva.mts <slug>
 *
 * Reserva un turno real llamando a `crear_reserva` igual que lo hace la página,
 * revisa que la fila haya quedado bien, y lo borra. No deja nada.
 *
 * Existe por un motivo concreto: dos veces un cambio en la base rompió el
 * camino de reserva sin que nadie se enterara hasta que un cliente se lo
 * encontró en pantalla. Los tests de `npm test` cubren el cálculo de horarios,
 * que es código puro; esto cubre lo otro —la función, las restricciones, los
 * permisos— que solo se puede probar contra la base de verdad.
 *
 * Correlo después de cada migración que toque `appointments` o `crear_reserva`.
 */
import { createClient } from "@supabase/supabase-js";

const slug = process.argv[2] ?? process.env.DEV_TENANT_SLUG;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!slug || !url || !anonKey || !serviceKey) {
  console.error(
    "Falta el slug o alguna variable de entorno.\n" +
      "  node --env-file=.env.local scripts/probar-reserva.mts <slug>",
  );
  process.exit(1);
}

const sinSesion = { auth: { autoRefreshToken: false, persistSession: false } };

// La reserva se hace con la anon key, que es la que usa el navegador: así se
// prueba también que el permiso de ejecutar la función siga estando.
const publico = createClient(url, anonKey, sinSesion);
const admin = createClient(url, serviceKey, sinSesion);

const { data: tenant } = await admin
  .from("tenants")
  .select("id, name, timezone")
  .eq("slug", slug)
  .maybeSingle();

if (!tenant) {
  console.error(`No existe ninguna barbería con el slug "${slug}".`);
  process.exit(1);
}

const { data: servicios } = await admin
  .from("services")
  .select("id, name, duration_minutes, price_cents")
  .eq("tenant_id", tenant.id)
  .eq("is_active", true)
  .order("sort_order");

if (!servicios?.length) {
  console.error("Esa barbería no tiene ningún servicio activo.");
  process.exit(1);
}

const { data: tramos } = await admin
  .from("working_hours")
  .select("weekday, starts_at, ends_at")
  .eq("tenant_id", tenant.id);

if (!tramos?.length) {
  console.error("Esa barbería no tiene horarios cargados.");
  process.exit(1);
}

const servicio = servicios[0];
const dura = servicio.duration_minutes as number;

// Hoy, en la hora de la barbería. Los horarios de la grilla son locales.
const hoy = new Intl.DateTimeFormat("en-CA", {
  timeZone: tenant.timezone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

const enMinutos = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const aHora = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

const sumarDias = (fecha: string, dias: number) => {
  const [y, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10);
};

/**
 * Todos los horarios posibles de los próximos días, en orden.
 *
 * No filtra los ocupados ni los que caen fuera de la ventana: se prueban de a
 * uno y el primero que la base acepte es el bueno. Es más lento y no se puede
 * equivocar, que es lo que se quiere de una prueba.
 */
function* candidatos() {
  for (let i = 0; i < 8; i++) {
    const fecha = sumarDias(hoy, i);
    const [y, m, d] = fecha.split("-").map(Number);
    const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();

    for (const tramo of tramos!) {
      if (tramo.weekday !== weekday) continue;
      const abre = enMinutos((tramo.starts_at as string).slice(0, 5));
      const cierra = enMinutos((tramo.ends_at as string).slice(0, 5));
      for (let t = abre; t + dura <= cierra; t += dura) {
        yield { fecha, hora: aHora(t) };
      }
    }
  }
}

// Datos de prueba reconocibles, para que si alguna vez queda una fila colgada
// se entienda de dónde salió.
const CLIENTE = {
  nombre: "Prueba Automatica",
  telefono: "+59899000000",
  email: "prueba@ejemplo.com",
};

let token: string | null = null;
let elegido: { fecha: string; hora: string } | null = null;
let ultimoError = "no se probó ningún horario";

for (const c of candidatos()) {
  const { data, error } = await publico.rpc("crear_reserva", {
    p_tenant_slug: slug,
    p_service_id: servicio.id,
    p_fecha: c.fecha,
    p_hora: c.hora,
    p_nombre: CLIENTE.nombre,
    p_telefono: CLIENTE.telefono,
    p_email: CLIENTE.email,
  });

  if (!error && data) {
    token = data as string;
    elegido = c;
    break;
  }

  ultimoError = error?.message ?? "sin token";

  // Estos tres son "ese horario no sirve", no "está roto": se sigue probando.
  const esperable =
    ultimoError.includes("ya está muy cerca") ||
    ultimoError.includes("Todavía no se puede reservar") ||
    ultimoError.includes("No queda nadie libre") ||
    ultimoError.includes("no está disponible") ||
    ultimoError.includes("acaba de tomar");

  if (!esperable) break;
}

if (!token || !elegido) {
  console.error(`\n✗ No se pudo reservar.\n  ${ultimoError}\n`);
  process.exit(1);
}

// ---- Revisar cómo quedó la fila --------------------------------------------
const { data: fila } = await admin
  .from("appointments")
  .select("id, kind, status, source, price_cents, duration_minutes, barber_id, barber_commission_percent")
  .eq("public_token", token)
  .maybeSingle();

const problemas: string[] = [];

if (!fila) {
  problemas.push("la reserva devolvió token pero no hay fila");
} else {
  if (fila.source !== "online") {
    problemas.push(`source quedó en ${JSON.stringify(fila.source)}, tiene que ser "online"`);
  }
  if (fila.price_cents !== servicio.price_cents) {
    problemas.push("el precio no se congeló con el del servicio");
  }
  if (fila.duration_minutes !== dura) {
    problemas.push("la duración no se congeló con la del servicio");
  }
  if (fila.status !== "confirmed" || fila.kind !== "booking") {
    problemas.push("el turno no quedó como reserva confirmada");
  }
}

// ---- Limpiar, pase lo que pase ---------------------------------------------
await admin.from("appointments").delete().eq("public_token", token);

if (problemas.length > 0) {
  console.error("\n✗ Reservó, pero la fila quedó mal:");
  for (const p of problemas) console.error(`  · ${p}`);
  console.error("");
  process.exit(1);
}

console.log(
  `\n✓ Se puede reservar en ${tenant.name}.\n` +
    `  ${servicio.name} · ${elegido.fecha} ${elegido.hora}\n` +
    `  Turno de prueba borrado.\n`,
);
