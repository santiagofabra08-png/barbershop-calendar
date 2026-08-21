/**
 * Dar de alta una barbería, completa y andando.
 *
 * Lo usan dos scripts: `crear-barberia.mts`, que pregunta todo y es el alta de
 * verdad, y `sembrar-demo.mts`, que arma las dos de prueba. A propósito
 * comparten este archivo: así el alta que le vas a correr a un cliente que paga
 * es exactamente la que se ejercita cada vez que rehacés las demos.
 *
 * Una barbería no es una fila: es una fila de `tenants`, un dueño con cuenta,
 * al menos un servicio y un horario. Sin las cuatro cosas la página abre pero
 * no se puede reservar, que es peor que no existir.
 *
 * Si algo falla en el medio, se borra lo que llegó a crearse. Media barbería en
 * la base es más difícil de arreglar que ninguna.
 */
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

export type Colores = {
  bg: string;
  surface: string;
  ink: string;
  inkMuted: string;
  accent: string;
  accentAlt: string;
};

export type Ventana =
  | { modo: "rolling"; dias: number }
  | { modo: "weekly"; dow: number; hora: string };

export type Cobro =
  | { modelo: "commission"; porcentaje: number }
  | { modelo: "salary" | "chair_rent"; montoCents: number; periodo: "week" | "month" }
  | { modelo: "revenue_only" };

export type BarberoNuevo = {
  nombre: string;
  rol: "owner" | "barber";
  cobro: Cobro;
  /** 0=domingo … 6=sábado */
  dias: number[];
  tramos: [string, string][];
  atiende?: boolean;
  /** Solo el dueño arranca con cuenta; al resto los invita él desde el panel. */
  email?: string;
  telefono?: string;
};

export type BarberiaNueva = {
  slug: string;
  nombre: string;
  timezone: string;
  moneda: string;
  direccion?: string | null;
  /**
   * Por dónde se le pregunta al local lo que la página no contesta.
   *
   * Van acá y no solo en el panel porque la demo se rehace entera cada vez que
   * se corre `barberia-demo --rehacer`, y lo que no siembra el alta vuelve a
   * quedar en `null`. Así estuvo: el código para mostrarlos ya estaba
   * desplegado y los botones no aparecían en ningún lado, porque nunca hubo
   * dato que mostrar.
   *
   * El teléfono se guarda normalizado (`+598XXXXXXXX`), que es lo que necesita
   * el link de `wa.me`.
   */
  whatsapp?: string | null;
  instagram?: string | null;
  colores: Colores;
  ventana: Ventana;
  minLead: number;
  plazoCancelacion: number;
  vidriera: boolean;
  servicios: { nombre: string; minutos: number; precio: number; desc?: string }[];
  descuentos?: { nombre: string; precio: number }[];
  productos?: { nombre: string; precio: number; stock: number; desc?: string }[];
  barberos: BarberoNuevo[];
};

export type Acceso = { nombre: string; mail: string; clave: string };

// ============================================================================
// Paletas de arranque
// ============================================================================
// No son la marca de nadie: son un punto de partida para que la página se vea
// bien desde el primer minuto. Cada barbería después pone la suya desde
// Ajustes, y ahí dejan de ser esto.
export const PALETAS: Record<string, { nombre: string; colores: Colores }> = {
  clasica: {
    nombre: "Clásica — papel cálido, rojo de poste",
    colores: {
      bg: "#F5F0E8",
      surface: "#FFFFFF",
      ink: "#111111",
      inkMuted: "#6B6B6B",
      /*
       * Rojo de poste, no rojo de alerta.
       *
       * Era `#D0021B`, saturado casi al máximo. Sobre un papel cálido y
       * desaturado como este `bg`, esa distancia de croma vibra: el botón
       * elegido se leía como una advertencia en vez de como el esmalte
       * pintado de un poste. Se le bajó el croma y se profundizó el valor
       * dejando el matiz donde estaba (352.7° → 354.7°), que es lo que
       * conserva la identidad.
       *
       * De paso el texto blanco encima pasó de 5.66 a 6.87 de contraste.
       * Cualquier reemplazo tiene que seguir dando 4.5 como piso: `on-accent`
       * es blanco y acá se apoya el botón de confirmar.
       */
      accent: "#B01D2A",
      accentAlt: "#1D3FA3",
    },
  },
  serena: {
    nombre: "Serena — gris frío, verde profundo",
    colores: {
      bg: "#F2F4F3",
      surface: "#FFFFFF",
      ink: "#1A1F1D",
      inkMuted: "#5F6B66",
      accent: "#0F766E",
      accentAlt: "#B45309",
    },
  },
  nocturna: {
    nombre: "Nocturna — fondo oscuro, ámbar",
    colores: {
      bg: "#14161A",
      surface: "#1E2126",
      ink: "#F2F3F5",
      inkMuted: "#9AA3AD",
      accent: "#E0A32E",
      accentAlt: "#6D8BB5",
    },
  },
  arena: {
    nombre: "Arena — beige, azul petróleo",
    colores: {
      bg: "#F7F4EF",
      surface: "#FFFFFF",
      ink: "#1C1B18",
      inkMuted: "#6E6A62",
      accent: "#1F5F73",
      accentAlt: "#A8552B",
    },
  },
};

// ============================================================================
// Validaciones
// ============================================================================
// Las mismas que impone la base, pero acá se pueden decir en criollo antes de
// que Postgres rechace la fila con un mensaje que nadie entiende.

/** El slug es el subdominio. Devuelve el problema, o null si está bien. */
export function validarSlug(slug: string): string | null {
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slug)) {
    return "Solo minúsculas, números y guiones. No puede empezar ni terminar con guion.";
  }
  if (slug.length < 2 || slug.length > 40) {
    return "Tiene que tener entre 2 y 40 caracteres.";
  }
  // `www` no se puede porque el que resuelve el subdominio lo descarta a
  // propósito: es el dominio raíz, no una barbería.
  if (slug === "www") return "Ese está reservado.";
  return null;
}

/** De "Tropi Barbershop" a "tropi-barbershop". */
export function slugSugerido(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // saca las tildes
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
}

export function validarHora(hora: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(hora);
}

/** Una contraseña que nadie eligió, para no tentarse con "12345678". */
export function contrasenia(): string {
  return randomBytes(9).toString("base64url");
}

// ============================================================================
// El alta
// ============================================================================

/**
 * El cliente con la llave de servicio, que saltea RLS.
 *
 * Lo arma este archivo y no cada script, por dos razones: que la validación de
 * las variables de entorno esté escrita una sola vez, y que el tipo del cliente
 * sea el mismo en todos lados —si cada script lo crea por su cuenta, TypeScript
 * termina con una forma distinta en cada uno—.
 *
 * Solo para `scripts/`. Esta llave nunca puede llegar al navegador.
 */
export function clienteAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.\n" +
        "¿Corriste el comando con --env-file=.env.local?",
    );
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

type Admin = ReturnType<typeof clienteAdmin>;

export async function slugLibre(admin: Admin, slug: string): Promise<boolean> {
  const { data } = await admin
    .from("tenants")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  return !data;
}

/**
 * Todos los archivos que una barbería dejó en Storage.
 *
 * Cada bucket guarda una carpeta por barbería, con el id como nombre, y adentro
 * subcarpetas (`productos`, `logos`). Se listan las dos vueltas y se devuelven
 * las rutas completas, que es lo que `remove` espera.
 */
async function archivosDe(admin: Admin, tenantId: string): Promise<Map<string, string[]>> {
  const porBucket = new Map<string, string[]>();
  const { data: buckets } = await admin.storage.listBuckets();

  for (const bucket of buckets ?? []) {
    const rutas: string[] = [];
    const { data: raiz } = await admin.storage.from(bucket.name).list(tenantId, { limit: 1000 });

    for (const entrada of raiz ?? []) {
      // Sin `id` es una carpeta, no un archivo. Storage no lista en profundidad.
      if (entrada.id) {
        rutas.push(`${tenantId}/${entrada.name}`);
        continue;
      }
      const { data: dentro } = await admin.storage
        .from(bucket.name)
        .list(`${tenantId}/${entrada.name}`, { limit: 1000 });
      for (const archivo of dentro ?? []) {
        if (archivo.id) rutas.push(`${tenantId}/${entrada.name}/${archivo.name}`);
      }
    }

    if (rutas.length > 0) porBucket.set(bucket.name, rutas);
  }

  return porBucket;
}

/**
 * Borra una barbería y todo lo suyo.
 *
 * Las cuentas de `auth` no cuelgan del tenant, así que el borrado en cascada no
 * las alcanza: hay que ir a buscarlas antes de que desaparezca la fila que las
 * nombra.
 *
 * Y los archivos de Storage tampoco. Durante meses no los borró nadie: cada
 * corrida de las pruebas de navegador subía la foto de un producto, la barbería
 * se borraba al terminar y la foto quedaba en un bucket PÚBLICO para siempre.
 * Se habían juntado 24 archivos de 15 barberías que ya no existían. Con una
 * barbería de prueba es basura; con un cliente que se da de baja, son las fotos
 * de su local siguiendo accesibles con el link.
 */
export async function borrarBarberia(admin: Admin, slug: string): Promise<void> {
  const { data: tenant } = await admin
    .from("tenants")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (!tenant) return;

  const { data: barberos } = await admin
    .from("barbers")
    .select("user_id")
    .eq("tenant_id", tenant.id);

  for (const b of barberos ?? []) {
    if (b.user_id) await admin.auth.admin.deleteUser(b.user_id as string);
  }

  // Antes de borrar la fila: después no queda de dónde sacar el id.
  const archivos = await archivosDe(admin, tenant.id as string);
  for (const [bucket, rutas] of archivos) {
    await admin.storage.from(bucket).remove(rutas);
  }

  await admin.from("tenants").delete().eq("id", tenant.id);
}

export async function crearBarberia(
  admin: Admin,
  datos: BarberiaNueva,
): Promise<{ tenantId: string; accesos: Acceso[] }> {
  const problema = validarSlug(datos.slug);
  if (problema) throw new Error(`El slug "${datos.slug}": ${problema}`);

  if (!(await slugLibre(admin, datos.slug))) {
    throw new Error(`Ya hay una barbería con el slug "${datos.slug}".`);
  }
  if (datos.servicios.length === 0) {
    throw new Error("Sin al menos un servicio nadie puede reservar.");
  }
  if (!datos.barberos.some((b) => b.rol === "owner")) {
    throw new Error("Falta el dueño: alguien tiene que poder entrar al panel.");
  }

  // Todo lo que se cree queda anotado acá. Si algo falla, se deshace.
  const usuarios: string[] = [];
  let tenantId = "";

  try {
    // ---- La barbería -------------------------------------------------------
    const { data: tenant, error } = await admin
      .from("tenants")
      .insert({
        slug: datos.slug,
        name: datos.nombre,
        timezone: datos.timezone,
        currency: datos.moneda,
        address: datos.direccion ?? null,
        whatsapp_phone: datos.whatsapp ?? null,
        instagram_url: datos.instagram ?? null,
        color_bg: datos.colores.bg,
        color_surface: datos.colores.surface,
        color_ink: datos.colores.ink,
        color_ink_muted: datos.colores.inkMuted,
        color_accent: datos.colores.accent,
        color_accent_alt: datos.colores.accentAlt,
        min_lead_minutes: datos.minLead,
        cancel_deadline_minutes: datos.plazoCancelacion,
        products_enabled: datos.vidriera,
        booking_window_mode: datos.ventana.modo,
        booking_window_days:
          datos.ventana.modo === "rolling" ? datos.ventana.dias : null,
        booking_week_release_dow:
          datos.ventana.modo === "weekly" ? datos.ventana.dow : null,
        booking_week_release_time:
          datos.ventana.modo === "weekly" ? datos.ventana.hora : null,
      })
      .select("id")
      .single();

    if (error || !tenant) throw new Error(`No se pudo crear: ${error?.message}`);
    tenantId = tenant.id as string;

    // ---- Servicios y descuentos -------------------------------------------
    const servicios = [
      ...datos.servicios.map((s, i) => ({
        tenant_id: tenantId,
        name: s.nombre,
        description: s.desc ?? null,
        duration_minutes: s.minutos,
        price_cents: Math.round(s.precio * 100),
        kind: "service",
        sort_order: i,
      })),
      ...(datos.descuentos ?? []).map((d, i) => ({
        tenant_id: tenantId,
        name: d.nombre,
        description: null,
        // Un descuento no se reserva, así que no dura nada. La base lo exige.
        duration_minutes: 0,
        price_cents: Math.round(d.precio * 100),
        kind: "discount",
        sort_order: datos.servicios.length + i,
      })),
    ];

    const { error: eServicios } = await admin.from("services").insert(servicios);
    if (eServicios) throw new Error(`servicios: ${eServicios.message}`);

    // ---- Productos ---------------------------------------------------------
    if (datos.productos?.length) {
      const { error: eProd } = await admin.from("products").insert(
        datos.productos.map((p, i) => ({
          tenant_id: tenantId,
          name: p.nombre,
          description: p.desc ?? null,
          price_cents: Math.round(p.precio * 100),
          stock: p.stock,
          sort_order: i,
        })),
      );
      if (eProd) throw new Error(`productos: ${eProd.message}`);
    }

    // ---- El equipo, con su acceso y su horario -----------------------------
    const accesos: Acceso[] = [];

    for (const [i, b] of datos.barberos.entries()) {
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

      // Solo el dueño arranca con acceso. A los demás los invita él desde el
      // panel, que es como va a pasar en una barbería de verdad.
      let userId: string | null = null;
      if (b.rol === "owner" && b.email) {
        const clave = contrasenia();
        const { data: cuenta, error: eCuenta } = await admin.auth.admin.createUser({
          email: b.email,
          password: clave,
          // El mail lo pone quien da de alta, en persona. No hay a quién
          // mandarle una verificación de algo que ya sabemos que es suyo.
          email_confirm: true,
        });
        if (eCuenta || !cuenta?.user) {
          throw new Error(`la cuenta de ${b.nombre}: ${eCuenta?.message}`);
        }
        userId = cuenta.user.id;
        usuarios.push(userId);
        accesos.push({ nombre: b.nombre, mail: b.email, clave });
      }

      const { data: barbero, error: eBarbero } = await admin
        .from("barbers")
        .insert({
          tenant_id: tenantId,
          user_id: userId,
          role: b.rol,
          display_name: b.nombre,
          email: userId ? b.email : null,
          phone: b.telefono ?? null,
          accepts_bookings: b.atiende ?? true,
          sort_order: i,
          ...cobro,
        })
        .select("id")
        .single();

      if (eBarbero || !barbero) {
        throw new Error(`el barbero ${b.nombre}: ${eBarbero?.message}`);
      }

      if (b.dias.length > 0 && b.tramos.length > 0) {
        const tramos = b.dias.flatMap((dia) =>
          b.tramos.map(([desde, hasta]) => ({
            tenant_id: tenantId,
            barber_id: barbero.id as string,
            weekday: dia,
            starts_at: desde,
            ends_at: hasta,
          })),
        );

        const { error: eHorarios } = await admin
          .from("working_hours")
          .insert(tramos);
        if (eHorarios) throw new Error(`el horario de ${b.nombre}: ${eHorarios.message}`);
      }
    }

    return { tenantId, accesos };
  } catch (e) {
    // Deshacer. Borrar el tenant se lleva servicios, productos, barberos y
    // horarios por cascada; las cuentas de auth hay que borrarlas aparte.
    if (tenantId) await admin.from("tenants").delete().eq("id", tenantId);
    for (const id of usuarios) await admin.auth.admin.deleteUser(id);
    throw e;
  }
}
