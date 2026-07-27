/**
 * La forma de una barbería tal como la usa la interfaz.
 *
 * Se escribe a mano por ahora. Cuando el esquema esté aplicado en Supabase,
 * estos tipos se derivan de `Database` en `@/lib/supabase/types` y este
 * archivo queda solo como capa de traducción entre la base y la pantalla.
 */

export type Tenant = {
  id: string;
  slug: string;
  name: string;
  timezone: string;
  currency: string;

  address: string | null;
  mapsUrl: string | null;

  logoLightUrl: string | null;
  logoDarkUrl: string | null;

  /** Se aplican como variables CSS. Nunca se escriben fijos en un componente. */
  colors: {
    bg: string;
    surface: string;
    ink: string;
    inkMuted: string;
    accent: string;
    accentAlt: string;
  };

  minLeadMinutes: number;
  cancelDeadlineMinutes: number;

  /** 'rolling' = ventana móvil de N días. 'weekly' = solo la semana en curso. */
  bookingWindow:
    | { mode: "rolling"; days: number }
    | { mode: "weekly"; releaseWeekday: number; releaseTime: string };
};

export type Service = {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  priceCents: number;
};

export type Barber = {
  id: string;
  displayName: string;
  acceptsBookings: boolean;
};

/** Un tramo de horario habitual. `weekday`: 0 = domingo … 6 = sábado. */
export type WorkingHour = {
  barberId: string;
  weekday: number;
  startsAt: string; // "HH:MM" en hora local de la barbería
  endsAt: string;
};
