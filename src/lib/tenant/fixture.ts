/**
 * ⚠️ TEMPORAL — datos de prueba para poder diseñar antes de que Supabase esté
 * configurado.
 *
 * Esto NO es configuración de la aplicación. Ningún componente importa este
 * archivo: la página lo recibe como argumento, igual que va a recibir los
 * datos reales. Cuando la base esté lista se reemplaza por una consulta y se
 * borra este archivo — la interfaz no se entera.
 *
 * Los valores son los mismos que carga `supabase/seed_tropi.sql`.
 */
import type { Barber, Service, Tenant, WorkingHour } from "@/lib/tenant/types";

export const tenantDemo: Tenant = {
  id: "00000000-0000-0000-0000-000000000001",
  slug: "tropi-barbershop",
  name: "Tropi Barbershop",
  timezone: "America/Montevideo",
  currency: "UYU",

  logoLightUrl: null,
  logoDarkUrl: null,

  colors: {
    bg: "#F5F0E8",
    surface: "#FFFFFF",
    ink: "#111111",
    inkMuted: "#6B6B6B",
    accent: "#D0021B",
    accentAlt: "#1D3FA3",
  },

  minLeadMinutes: 60,
  cancelDeadlineMinutes: 60,
  bookingWindow: { mode: "weekly", releaseWeekday: 6, releaseTime: "21:00" },
};

export const barberoDemo: Barber = {
  id: "00000000-0000-0000-0000-000000000002",
  displayName: "Facundo",
  acceptsBookings: true,
};

export const servicioDemo: Service = {
  id: "00000000-0000-0000-0000-000000000003",
  name: "Corte de pelo",
  description: null,
  durationMinutes: 40,
  priceCents: 30000,
};

/** Martes a sábado, 14:00 a 21:00. */
export const horariosDemo: WorkingHour[] = [2, 3, 4, 5, 6].map((weekday) => ({
  barberId: barberoDemo.id,
  weekday,
  startsAt: "14:00",
  endsAt: "21:00",
}));

/** También temporal: en producción sale de Supabase Storage. */
export const fotoEstacionDemo = "/dev/tropi-estacion.jpg";
