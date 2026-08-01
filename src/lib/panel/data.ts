import { localToUtc } from "@/lib/schedule";
import { createClient } from "@/lib/supabase/server";
import { CAMPOS_BARBERO, aBarbero, type BarberoDelPanel } from "@/lib/panel/session";
import type { Tenant } from "@/lib/tenant/types";

/**
 * Lo que el panel lee de la base.
 *
 * No hace falta filtrar por barbero acá: quién ve qué lo decide Row Level
 * Security. El dueño recibe todo el equipo y el barbero solo lo suyo con la
 * misma consulta —y si un día esta consulta tuviera un error, la base seguiría
 * sin devolverle a nadie lo que no le toca.
 */

export type TurnoDelPanel = {
  id: string;
  barberId: string;
  kind: "booking" | "block";
  status: "confirmed" | "cancelled" | "no_show";

  /** "HH:MM" en hora local de la barbería. */
  startLocal: string;
  endLocal: string;
  /** "YYYY-MM-DD" local, para agrupar por día. */
  dateLocal: string;

  clientName: string | null;
  clientPhone: string | null;
  serviceName: string | null;
  priceCents: number | null;
  commissionPercent: number | null;
  reason: string | null;
  source: "online" | "panel" | null;
  publicToken: string | null;

  /** Null mientras no se cobró. Es lo que decide si entra al balance. */
  chargedAt: string | null;
  /** Lo que se cobró de verdad, que puede no ser el precio reservado. */
  chargedTotalCents: number | null;
};

const CAMPOS_TURNO =
  "id, barber_id, kind, status, starts_at, ends_at, client_name, client_phone, " +
  "price_cents, barber_commission_percent, reason, source, public_token, " +
  "charged_at, charged_total_cents, services(name)";

type FilaTurno = {
  id: string;
  barber_id: string;
  kind: "booking" | "block";
  status: "confirmed" | "cancelled" | "no_show";
  starts_at: string;
  ends_at: string;
  client_name: string | null;
  client_phone: string | null;
  price_cents: number | null;
  barber_commission_percent: number | string | null;
  reason: string | null;
  source: "online" | "panel" | null;
  public_token: string | null;
  charged_at: string | null;
  charged_total_cents: number | null;
  services: { name: string } | { name: string }[] | null;
};

/** Un instante UTC leído en la hora de la barbería. */
function enLocal(iso: string, timeZone: string) {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));

  const get = (t: string) => p.find((x) => x.type === t)?.value ?? "00";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}

function aTurno(fila: FilaTurno, timeZone: string): TurnoDelPanel {
  const inicio = enLocal(fila.starts_at, timeZone);
  const fin = enLocal(fila.ends_at, timeZone);
  // PostgREST devuelve la relación como objeto o como array según cómo infiera
  // la cardinalidad. Se acepta cualquiera de las dos formas.
  const servicio = Array.isArray(fila.services) ? fila.services[0] : fila.services;

  return {
    id: fila.id,
    barberId: fila.barber_id,
    kind: fila.kind,
    status: fila.status,
    startLocal: inicio.time,
    endLocal: fin.time,
    dateLocal: inicio.date,
    clientName: fila.client_name,
    clientPhone: fila.client_phone,
    serviceName: servicio?.name ?? null,
    priceCents: fila.price_cents,
    commissionPercent:
      fila.barber_commission_percent === null
        ? null
        : Number(fila.barber_commission_percent),
    reason: fila.reason,
    source: fila.source,
    publicToken: fila.public_token,
    chargedAt: fila.charged_at,
    chargedTotalCents: fila.charged_total_cents,
  };
}

/**
 * Los turnos de un rango de días locales, con las dos puntas incluidas.
 *
 * El rango se pide en fechas locales y se traduce a instantes UTC acá, que es
 * el único lugar donde las dos formas de contar el tiempo se tocan.
 */
export async function cargarTurnos(
  tenant: Tenant,
  desde: string,
  hasta: string,
): Promise<TurnoDelPanel[]> {
  const sb = await createClient();

  const inicio = localToUtc(desde, "00:00", tenant.timezone);
  // El día "hasta" entra entero: se corta a la medianoche del siguiente.
  const finDelUltimoDia = new Date(`${hasta}T00:00:00Z`);
  finDelUltimoDia.setUTCDate(finDelUltimoDia.getUTCDate() + 1);
  const fin = localToUtc(
    finDelUltimoDia.toISOString().slice(0, 10),
    "00:00",
    tenant.timezone,
  );

  const { data } = await sb
    .from("appointments")
    .select(CAMPOS_TURNO)
    .eq("tenant_id", tenant.id)
    .gte("starts_at", inicio.toISOString())
    .lt("starts_at", fin.toISOString())
    .order("starts_at");

  return (data ?? []).map((f) => aTurno(f as unknown as FilaTurno, tenant.timezone));
}

/**
 * Los servicios reservables, con su precio de hoy.
 *
 * Sin los descuentos: un descuento no es un turno que alguien pueda pedir, es
 * un renglón que se le suma a un ticket.
 */
export async function cargarServicios(tenant: Tenant) {
  const sb = await createClient();

  const { data } = await sb
    .from("services")
    .select("id, name, duration_minutes, price_cents")
    .eq("tenant_id", tenant.id)
    .eq("is_active", true)
    .eq("kind", "service")
    .order("sort_order");

  return (data ?? []).map((s) => ({
    id: s.id as string,
    name: s.name as string,
    durationMinutes: s.duration_minutes as number,
    priceCents: s.price_cents as number,
  }));
}

export type PagoDelPanel = {
  id: string;
  barberId: string;
  /** 'out' la barbería paga · 'in' la barbería cobra. */
  direction: "out" | "in";
  amountCents: number;
  periodFrom: string;
  periodTo: string;
  paidOn: string;
  note: string | null;
};

/**
 * Los pagos cuyo período cae ENTERO dentro del rango que se está mirando.
 *
 * Contenido y no superpuesto, a propósito: así los períodos se anidan sin
 * contarse dos veces. Mirando el mes se ven los cuatro pagos semanales de
 * adentro; mirando una semana se ve solo el suyo, y un pago mensual no aparece
 * a medias en ninguna de las cuatro.
 */
export async function cargarPagos(
  tenant: Tenant,
  desde: string,
  hasta: string,
): Promise<PagoDelPanel[]> {
  const sb = await createClient();

  const { data } = await sb
    .from("barber_payouts")
    .select("id, barber_id, direction, amount_cents, period_from, period_to, paid_on, note")
    .eq("tenant_id", tenant.id)
    .gte("period_from", desde)
    .lte("period_to", hasta)
    .order("paid_on", { ascending: false });

  return (data ?? []).map((p) => ({
    id: p.id as string,
    barberId: p.barber_id as string,
    direction: p.direction as "out" | "in",
    amountCents: p.amount_cents as number,
    periodFrom: p.period_from as string,
    periodTo: p.period_to as string,
    paidOn: p.paid_on as string,
    note: (p.note as string | null) ?? null,
  }));
}

export type ServicioDelPanel = {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  priceCents: number;
  /** 'discount' resta en el ticket y no se puede reservar. */
  kind: "service" | "discount";
  isActive: boolean;
  sortOrder: number;
};

/** Todos los servicios, también los que están fuera de la página. */
export async function cargarServiciosDelPanel(
  tenant: Tenant,
): Promise<ServicioDelPanel[]> {
  const sb = await createClient();

  const { data } = await sb
    .from("services")
    .select(
      "id, name, description, duration_minutes, price_cents, kind, is_active, sort_order",
    )
    .eq("tenant_id", tenant.id)
    .order("sort_order");

  return (data ?? []).map((s) => ({
    id: s.id as string,
    name: s.name as string,
    description: (s.description as string | null) ?? null,
    durationMinutes: s.duration_minutes as number,
    priceCents: s.price_cents as number,
    kind: (s.kind as "service" | "discount") ?? "service",
    isActive: s.is_active as boolean,
    sortOrder: s.sort_order as number,
  }));
}

export type TramoDeHorario = {
  id: string;
  weekday: number;
  startsAt: string; // "HH:MM"
  endsAt: string;
};

/** El horario habitual de un barbero, tramo por tramo. */
export async function cargarHorarios(
  tenant: Tenant,
  barberId: string,
): Promise<TramoDeHorario[]> {
  const sb = await createClient();

  const { data } = await sb
    .from("working_hours")
    .select("id, weekday, starts_at, ends_at")
    .eq("tenant_id", tenant.id)
    .eq("barber_id", barberId)
    .order("weekday")
    .order("starts_at");

  return (data ?? []).map((f) => ({
    id: f.id as string,
    weekday: f.weekday as number,
    // Postgres devuelve "14:00:00"; la pantalla usa "14:00".
    startsAt: (f.starts_at as string).slice(0, 5),
    endsAt: (f.ends_at as string).slice(0, 5),
  }));
}

/**
 * El equipo.
 *
 * Un barbero ve a todos —para saber con quién trabaja—, pero solo el dueño ve
 * sus turnos y su plata. Eso no lo decide esta función: lo decide RLS sobre
 * `appointments`, que es donde está el dato sensible.
 */
export async function cargarEquipo(tenant: Tenant): Promise<BarberoDelPanel[]> {
  const sb = await createClient();

  const { data } = await sb
    .from("barbers")
    .select(CAMPOS_BARBERO)
    .eq("tenant_id", tenant.id)
    .order("sort_order");

  return (data ?? []).map((f) => aBarbero(f as never));
}
