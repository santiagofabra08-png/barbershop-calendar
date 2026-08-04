/**
 * Crea dos barberías de demostración, completas y usables.
 *
 *   node --env-file=.env.local scripts/sembrar-demo.mts
 *   node --env-file=.env.local scripts/sembrar-demo.mts --rehacer
 *
 * Sirve para dos cosas distintas:
 *
 *   1. Tener páginas de reserva de verdad para mirar y romper, sin tocar las de
 *      un cliente real.
 *   2. Que exista MÁS DE UNA barbería en la base. Toda la separación entre
 *      locales está escrita en las políticas de RLS, pero con una sola barbería
 *      esa separación nunca se ejerce: no hay de quién separarla. Recién con dos
 *      se puede probar —eso lo hace `probar-aislamiento.mts`—.
 *
 * A propósito NO se parecen entre sí ni a Tropi. Una es clara y otra oscura, una
 * cobra en pesos uruguayos y otra en argentinos, una abre por ventana móvil y la
 * otra por semana. Si el sistema solo anda con barberías parecidas a la primera,
 * es ahora cuando se tiene que notar.
 *
 * Usa la service role key: saltea RLS. Por eso vive en `scripts/` y no se
 * despliega.
 */
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

const rehacer = process.argv.includes("--rehacer");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error(
    "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.\n" +
      "¿Corriste el comando con --env-file=.env.local?",
  );
  process.exit(1);
}

const sb = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ============================================================================
// Las dos barberías
// ============================================================================

type Barbero = {
  nombre: string;
  rol: "owner" | "barber";
  cobro:
    | { modelo: "commission"; porcentaje: number }
    | { modelo: "salary" | "chair_rent"; montoCents: number; periodo: "week" | "month" }
    | { modelo: "revenue_only" };
  /** 0=domingo … 6=sábado */
  dias: number[];
  tramos: [string, string][];
  atiende?: boolean;
};

type Demo = {
  slug: string;
  nombre: string;
  timezone: string;
  moneda: string;
  colores: Record<string, string>;
  ventana:
    | { modo: "rolling"; dias: number }
    | { modo: "weekly"; dow: number; hora: string };
  mailDelDuenio: string;
  servicios: { nombre: string; minutos: number; precio: number; desc?: string }[];
  descuentos?: { nombre: string; precio: number }[];
  productos?: { nombre: string; precio: number; stock: number; desc?: string }[];
  vidriera: boolean;
  barberos: Barbero[];
};

const DEMOS: Demo[] = [
  {
    slug: "barberia-central",
    nombre: "Barbería Central",
    timezone: "America/Montevideo",
    moneda: "UYU",
    // Clara y fría, con acento verde. Nada que ver con el rojo de Tropi.
    colores: {
      color_bg: "#F2F4F3",
      color_surface: "#FFFFFF",
      color_ink: "#1A1F1D",
      color_ink_muted: "#5F6B66",
      color_accent: "#0F766E",
      color_accent_alt: "#B45309",
    },
    ventana: { modo: "rolling", dias: 21 },
    mailDelDuenio: "central@ejemplo.com",
    servicios: [
      { nombre: "Corte", minutos: 40, precio: 650, desc: "Lavado, corte y peinado." },
      { nombre: "Corte y barba", minutos: 60, precio: 950 },
      { nombre: "Barba", minutos: 25, precio: 400 },
      { nombre: "Perfilado de cejas", minutos: 15, precio: 250 },
    ],
    descuentos: [{ nombre: "Amigo de la casa", precio: 150 }],
    productos: [
      { nombre: "Cera mate", precio: 480, stock: 12, desc: "Fijación fuerte, sin brillo." },
      { nombre: "Polvo texturizador", precio: 520, stock: 6 },
      { nombre: "Aceite para barba", precio: 390, stock: 9 },
    ],
    vidriera: true,
    barberos: [
      {
        nombre: "Martín",
        rol: "owner",
        cobro: { modelo: "revenue_only" },
        dias: [2, 3, 4, 5, 6],
        // Con corte al mediodía: dos tramos por día prueban que el hueco del
        // medio no se ofrezca como horario.
        tramos: [
          ["09:00", "13:00"],
          ["15:00", "19:00"],
        ],
      },
      {
        nombre: "Diego",
        rol: "barber",
        cobro: { modelo: "commission", porcentaje: 50 },
        dias: [2, 3, 4, 5, 6],
        tramos: [["10:00", "18:00"]],
      },
    ],
  },
  {
    slug: "studio-norte",
    nombre: "Studio Norte",
    // Otro país: otra zona horaria y otra moneda. Es la prueba de que ningún
    // huso ni ningún símbolo quedó escrito fijo en el código.
    timezone: "America/Argentina/Buenos_Aires",
    moneda: "ARS",
    // Oscura. Si la página solo se ve bien sobre fondo claro, se nota acá.
    colores: {
      color_bg: "#14161A",
      color_surface: "#1E2126",
      color_ink: "#F2F3F5",
      color_ink_muted: "#9AA3AD",
      color_accent: "#E0A32E",
      color_accent_alt: "#6D8BB5",
    },
    // Por semana: la que viene se habilita el domingo a las 20.
    ventana: { modo: "weekly", dow: 0, hora: "20:00" },
    mailDelDuenio: "norte@ejemplo.com",
    servicios: [
      { nombre: "Corte clásico", minutos: 45, precio: 9000 },
      { nombre: "Fade", minutos: 50, precio: 11000, desc: "Degradado a máquina." },
      { nombre: "Corte y barba", minutos: 75, precio: 15000 },
    ],
    productos: [{ nombre: "Bálsamo", precio: 7000, stock: 4 }],
    // Vidriera apagada a propósito: así se puede comparar una barbería que
    // vende productos contra una que no, y comprobar que /productos da 404.
    vidriera: false,
    barberos: [
      {
        nombre: "Lucía",
        rol: "owner",
        cobro: { modelo: "revenue_only" },
        // Abre miércoles a domingo y cierra lunes y martes: el revés de las
        // otras dos, para que un feriado semanal distinto no rompa la grilla.
        dias: [3, 4, 5, 6, 0],
        tramos: [["12:00", "20:00"]],
      },
      {
        nombre: "Rodrigo",
        rol: "barber",
        cobro: { modelo: "chair_rent", montoCents: 4000000, periodo: "month" },
        dias: [4, 5, 6],
        tramos: [["14:00", "21:00"]],
      },
    ],
  },
];

// ============================================================================

/** Una contraseña que nadie eligió, para no tentarse con "12345678". */
function contrasenia(): string {
  return randomBytes(9).toString("base64url");
}

async function borrarBarberia(slug: string) {
  const { data: tenant } = await sb
    .from("tenants")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (!tenant) return;

  // Las cuentas de auth no cuelgan del tenant, así que el cascade no las
  // alcanza. Hay que ir a buscarlas antes de que desaparezca la fila que las
  // nombra.
  const { data: barberos } = await sb
    .from("barbers")
    .select("user_id")
    .eq("tenant_id", tenant.id);

  for (const b of barberos ?? []) {
    if (b.user_id) await sb.auth.admin.deleteUser(b.user_id as string);
  }

  // Todo lo demás cuelga de tenant_id con `on delete cascade`.
  await sb.from("tenants").delete().eq("id", tenant.id);
}

async function sembrar(demo: Demo) {
  const { data: existe } = await sb
    .from("tenants")
    .select("id")
    .eq("slug", demo.slug)
    .maybeSingle();

  if (existe) {
    if (!rehacer) {
      console.log(`  · ${demo.slug} ya existe. Usá --rehacer para rehacerla.`);
      return null;
    }
    await borrarBarberia(demo.slug);
  }

  // ---- La barbería ---------------------------------------------------------
  const { data: tenant, error: eTenant } = await sb
    .from("tenants")
    .insert({
      slug: demo.slug,
      name: demo.nombre,
      timezone: demo.timezone,
      currency: demo.moneda,
      ...demo.colores,
      min_lead_minutes: 60,
      cancel_deadline_minutes: 120,
      products_enabled: demo.vidriera,
      booking_window_mode: demo.ventana.modo,
      booking_window_days: demo.ventana.modo === "rolling" ? demo.ventana.dias : null,
      booking_week_release_dow: demo.ventana.modo === "weekly" ? demo.ventana.dow : null,
      booking_week_release_time: demo.ventana.modo === "weekly" ? demo.ventana.hora : null,
    })
    .select("id")
    .single();

  if (eTenant || !tenant) {
    throw new Error(`No se pudo crear ${demo.slug}: ${eTenant?.message}`);
  }

  const tenantId = tenant.id as string;

  // ---- Servicios y descuentos ---------------------------------------------
  const servicios = [
    ...demo.servicios.map((s, i) => ({
      tenant_id: tenantId,
      name: s.nombre,
      description: s.desc ?? null,
      duration_minutes: s.minutos,
      price_cents: s.precio * 100,
      kind: "service",
      sort_order: i,
    })),
    ...(demo.descuentos ?? []).map((d, i) => ({
      tenant_id: tenantId,
      name: d.nombre,
      description: null,
      // Un descuento no se reserva, así que no dura nada. La base lo exige.
      duration_minutes: 0,
      price_cents: d.precio * 100,
      kind: "discount",
      sort_order: demo.servicios.length + i,
    })),
  ];

  const { error: eServicios } = await sb.from("services").insert(servicios);
  if (eServicios) throw new Error(`servicios de ${demo.slug}: ${eServicios.message}`);

  // ---- Productos -----------------------------------------------------------
  if (demo.productos?.length) {
    const { error } = await sb.from("products").insert(
      demo.productos.map((p, i) => ({
        tenant_id: tenantId,
        name: p.nombre,
        description: p.desc ?? null,
        price_cents: p.precio * 100,
        stock: p.stock,
        sort_order: i,
      })),
    );
    if (error) throw new Error(`productos de ${demo.slug}: ${error.message}`);
  }

  // ---- Barberos, con su acceso y su horario -------------------------------
  const accesos: { nombre: string; mail: string; clave: string }[] = [];

  for (const [i, b] of demo.barberos.entries()) {
    const cobro =
      b.cobro.modelo === "commission"
        ? {
            payment_model: "commission",
            commission_percent: b.cobro.porcentaje,
            pay_amount_cents: null,
            pay_period: null,
          }
        : b.cobro.modelo === "revenue_only"
          ? {
              payment_model: "revenue_only",
              commission_percent: null,
              pay_amount_cents: null,
              pay_period: null,
            }
          : {
              payment_model: b.cobro.modelo,
              commission_percent: null,
              pay_amount_cents: b.cobro.montoCents,
              pay_period: b.cobro.periodo,
            };

    // Solo el dueño arranca con acceso. Los demás los invita él desde el panel,
    // que es como va a pasar en una barbería de verdad.
    let userId: string | null = null;
    if (b.rol === "owner") {
      const clave = contrasenia();
      const { data: cuenta, error } = await sb.auth.admin.createUser({
        email: demo.mailDelDuenio,
        password: clave,
        email_confirm: true,
      });
      if (error || !cuenta?.user) {
        throw new Error(`cuenta de ${demo.slug}: ${error?.message}`);
      }
      userId = cuenta.user.id;
      accesos.push({ nombre: b.nombre, mail: demo.mailDelDuenio, clave });
    }

    const { data: barbero, error: eBarbero } = await sb
      .from("barbers")
      .insert({
        tenant_id: tenantId,
        user_id: userId,
        role: b.rol,
        display_name: b.nombre,
        email: userId ? demo.mailDelDuenio : null,
        accepts_bookings: b.atiende ?? true,
        sort_order: i,
        ...cobro,
      })
      .select("id")
      .single();

    if (eBarbero || !barbero) {
      throw new Error(`barbero ${b.nombre}: ${eBarbero?.message}`);
    }

    const tramos = b.dias.flatMap((dia) =>
      b.tramos.map(([desde, hasta]) => ({
        tenant_id: tenantId,
        barber_id: barbero.id as string,
        weekday: dia,
        starts_at: desde,
        ends_at: hasta,
      })),
    );

    const { error: eHorarios } = await sb.from("working_hours").insert(tramos);
    if (eHorarios) throw new Error(`horarios de ${b.nombre}: ${eHorarios.message}`);
  }

  return { tenantId, accesos };
}

// ============================================================================

console.log(rehacer ? "\nRehaciendo las barberías de demo…\n" : "\nSembrando…\n");

const creadas: { demo: Demo; accesos: { nombre: string; mail: string; clave: string }[] }[] = [];

for (const demo of DEMOS) {
  const r = await sembrar(demo);
  if (r) {
    console.log(`  ✓ ${demo.nombre} (${demo.slug})`);
    creadas.push({ demo, accesos: r.accesos });
  }
}

if (creadas.length === 0) {
  console.log("\nNo se creó nada nuevo.\n");
  process.exit(0);
}

const raiz = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "tuapp.com";

console.log("\n" + "─".repeat(70));
console.log("ACCESOS — anotalos ahora, la contraseña no se vuelve a mostrar");
console.log("─".repeat(70));

for (const { demo, accesos } of creadas) {
  console.log(`\n${demo.nombre}`);
  console.log(`  Página:  https://${demo.slug}.${raiz}`);
  console.log(`  En dev:  poné DEV_TENANT_SLUG=${demo.slug} en .env.local`);
  for (const a of accesos) {
    console.log(`  Dueño:   ${a.nombre} — ${a.mail} / ${a.clave}`);
  }
}

console.log(
  "\n" +
    "En desarrollo no hay subdominios, así que para ver una u otra hay que\n" +
    "cambiar DEV_TENANT_SLUG en .env.local y reiniciar el servidor.\n",
);
