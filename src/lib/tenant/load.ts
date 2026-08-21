import { createClient } from "@/lib/supabase/server";
import type {
  Barber,
  Service,
  Tenant,
  WorkingHour,
} from "@/lib/tenant/types";

/**
 * Traducción entre la base y la pantalla.
 *
 * Es el único lugar que conoce los nombres de columna de Supabase. Todo lo que
 * sale de acá ya tiene la forma que usan los componentes, así que un cambio de
 * esquema se arregla en este archivo y en ninguno más.
 */

export type BarberiaCompleta = {
  tenant: Tenant;
  barbers: Barber[];
  services: Service[];
  workingHours: WorkingHour[];
};

type FilaTenant = {
  id: string;
  slug: string;
  name: string;
  timezone: string;
  currency: string;
  address: string | null;
  maps_url: string | null;
  whatsapp_phone: string | null;
  instagram_url: string | null;
  reply_to_email: string | null;
  logo_light_url: string | null;
  logo_dark_url: string | null;
  color_bg: string;
  color_surface: string;
  color_ink: string;
  color_ink_muted: string;
  color_accent: string;
  color_accent_alt: string;
  min_lead_minutes: number;
  cancel_deadline_minutes: number;
  booking_window_mode: "rolling" | "weekly";
  booking_window_days: number | null;
  booking_week_release_dow: number | null;
  booking_week_release_time: string | null;
  products_enabled: boolean;
};

const CAMPOS_TENANT =
  "id, slug, name, timezone, currency, address, maps_url, whatsapp_phone, instagram_url, " +
  "reply_to_email, " +
  "logo_light_url, logo_dark_url, " +
  "color_bg, color_surface, color_ink, color_ink_muted, color_accent, color_accent_alt, " +
  "min_lead_minutes, cancel_deadline_minutes, products_enabled, " +
  "booking_window_mode, booking_window_days, booking_week_release_dow, booking_week_release_time";

function aTenant(fila: FilaTenant): Tenant {
  return {
    id: fila.id,
    slug: fila.slug,
    name: fila.name,
    timezone: fila.timezone,
    currency: fila.currency,
    address: fila.address,
    mapsUrl: fila.maps_url,
    whatsappPhone: fila.whatsapp_phone,
    instagramUrl: fila.instagram_url,
    replyToEmail: fila.reply_to_email,
    logoLightUrl: fila.logo_light_url,
    logoDarkUrl: fila.logo_dark_url,
    colors: {
      bg: fila.color_bg,
      surface: fila.color_surface,
      ink: fila.color_ink,
      inkMuted: fila.color_ink_muted,
      accent: fila.color_accent,
      accentAlt: fila.color_accent_alt,
    },
    minLeadMinutes: fila.min_lead_minutes,
    cancelDeadlineMinutes: fila.cancel_deadline_minutes,
    productsEnabled: fila.products_enabled ?? false,
    bookingWindow:
      fila.booking_window_mode === "weekly"
        ? {
            mode: "weekly",
            releaseWeekday: fila.booking_week_release_dow ?? 6,
            // Postgres devuelve "21:00:00"; la pantalla usa "21:00".
            releaseTime: (fila.booking_week_release_time ?? "21:00").slice(0, 5),
          }
        : { mode: "rolling", days: fila.booking_window_days ?? 14 },
  };
}

/**
 * Solo la barbería: marca, zona horaria y políticas de agenda.
 *
 * El panel la necesita sin el resto —tiene su propia idea de qué es un barbero,
 * porque ve el mail y cómo cobra, que el público no ve.
 */
export async function cargarTenant(slug: string): Promise<Tenant | null> {
  const sb = await createClient();

  const { data } = await sb
    .from("tenants")
    .select(CAMPOS_TENANT)
    .eq("slug", slug)
    .maybeSingle();

  return data ? aTenant(data as unknown as FilaTenant) : null;
}

/** Todo lo que la página pública necesita, en una sola ida a la base. */
export async function cargarBarberia(
  slug: string,
): Promise<BarberiaCompleta | null> {
  const sb = await createClient();

  const tenant = await cargarTenant(slug);
  if (!tenant) return null;

  const [{ data: barbers }, { data: services }, { data: hours }] =
    await Promise.all([
      sb
        .from("barbers")
        .select("id, display_name, accepts_bookings, photo_url")
        .eq("tenant_id", tenant.id)
        .order("sort_order"),
      sb
        .from("services")
        .select("id, name, description, duration_minutes, price_cents")
        .eq("tenant_id", tenant.id)
        // Un descuento no se reserva. Para `anon` ya lo filtra RLS, pero esta
        // misma consulta la corre un dueño con sesión mirando su propia página.
        .eq("kind", "service")
        .order("sort_order"),
      sb
        .from("working_hours")
        .select("barber_id, weekday, starts_at, ends_at")
        .eq("tenant_id", tenant.id),
    ]);

  return {
    tenant,
    barbers: (barbers ?? []).map((b) => ({
      id: b.id as string,
      displayName: b.display_name as string,
      acceptsBookings: b.accepts_bookings as boolean,
      photoUrl: (b.photo_url as string | null) ?? null,
    })),
    services: (services ?? []).map((s) => ({
      id: s.id as string,
      name: s.name as string,
      description: (s.description as string | null) ?? null,
      durationMinutes: s.duration_minutes as number,
      priceCents: s.price_cents as number,
    })),
    workingHours: (hours ?? []).map((h) => ({
      barberId: h.barber_id as string,
      weekday: h.weekday as number,
      startsAt: (h.starts_at as string).slice(0, 5),
      endsAt: (h.ends_at as string).slice(0, 5),
    })),
  };
}

/**
 * Los ratos ocupados, como claves "YYYY-MM-DD HH:MM" en hora local.
 *
 * Pasa por una función del servidor que devuelve solo rangos de tiempo: el
 * público nunca ve quién reservó ni su teléfono.
 */
export async function cargarOcupados(
  slug: string,
  timezone: string,
  desde: string,
  hasta: string,
): Promise<Map<string, Set<string>>> {
  const sb = await createClient();

  const { data, error } = await sb.rpc("horarios_ocupados", {
    p_tenant_slug: slug,
    p_desde: desde,
    p_hasta: hasta,
  });

  const porBarbero = new Map<string, Set<string>>();
  if (error || !data) return porBarbero;

  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const filas = data as {
    barber_id: string;
    starts_at: string;
    ends_at: string;
  }[];

  for (const fila of filas) {
    let ocupados = porBarbero.get(fila.barber_id);
    if (!ocupados) {
      ocupados = new Set<string>();
      porBarbero.set(fila.barber_id, ocupados);
    }

    // Un turno puede tapar más de un hueco de la grilla si las duraciones
    // cambiaron, así que se marca de a 5 minutos de punta a punta.
    const inicio = new Date(fila.starts_at).getTime();
    const fin = new Date(fila.ends_at).getTime();

    for (let t = inicio; t < fin; t += 5 * 60_000) {
      const p = fmt.formatToParts(new Date(t));
      const get = (tipo: string) =>
        p.find((x) => x.type === tipo)?.value ?? "00";
      ocupados.add(
        `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`,
      );
    }
  }

  return porBarbero;
}
