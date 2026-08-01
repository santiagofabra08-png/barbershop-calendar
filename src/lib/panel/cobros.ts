import type { MedioDePago, TurnoParaCobrar } from "@/lib/panel/cobro";
import { createClient } from "@/lib/supabase/server";

/**
 * Los cobros del día.
 *
 * Todo pasa por funciones del servidor y no por consultas directas. La regla
 * general del panel es que un barbero solo ve sus propios turnos —y sigue
 * siendo así en Agenda y en Semana—, pero cobrar lo hace el que está parado al
 * lado de la caja, sea quien sea. Estas funciones son la excepción, y por eso
 * cada una verifica que quien llama trabaje en el local.
 */

type FilaTurno = {
  id: string;
  barber_id: string;
  barber_name: string;
  hora: string;
  status: "confirmed" | "no_show";
  client_name: string | null;
  service_name: string | null;
  price_cents: number;
  charged_at: string | null;
  charged_total_cents: number | null;
  payment_method: MedioDePago | null;
  items: { name: string; amount_cents: number }[] | null;
};

export async function cargarTurnosParaCobrar(
  slug: string,
  fecha: string,
): Promise<TurnoParaCobrar[]> {
  const sb = await createClient();

  const { data } = await sb.rpc("turnos_para_cobrar", {
    p_tenant_slug: slug,
    p_fecha: fecha,
  });

  return ((data ?? []) as FilaTurno[]).map((f) => ({
    id: f.id,
    barberId: f.barber_id,
    barberName: f.barber_name,
    hora: f.hora,
    status: f.status,
    clientName: f.client_name,
    serviceName: f.service_name,
    priceCents: f.price_cents,
    chargedAt: f.charged_at,
    chargedTotalCents: f.charged_total_cents,
    paymentMethod: f.payment_method,
    items: (f.items ?? []).map((i) => ({
      name: i.name,
      amountCents: i.amount_cents,
    })),
  }));
}

/** Cuántos turnos ya pasados quedaron sin cobrar, y desde cuándo. */
export async function cargarPendientes(
  slug: string,
): Promise<{ cantidad: number; desde: string | null }> {
  const sb = await createClient();

  const { data } = await sb.rpc("cobros_pendientes", {
    p_tenant_slug: slug,
  });

  const fila = (data as { cantidad: number; desde: string | null }[] | null)?.[0];
  return {
    cantidad: Number(fila?.cantidad ?? 0),
    desde: fila?.desde ?? null,
  };
}
