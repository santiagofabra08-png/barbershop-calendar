"use server";

import { revalidatePath } from "next/cache";

import { sesionDelPanel } from "@/lib/panel/session";
import { createClient } from "@/lib/supabase/server";

export type EstadoPago = { error?: string; ok?: string };

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Anota un pago a un barbero, o un cobro de alquiler de silla.
 *
 * No mueve plata: la plata se la dan en la mano. Esto es el papelito donde
 * queda escrito qué se pagó, por qué período y cuándo, para que el balance
 * refleje lo que salió y no solo lo que se generó.
 *
 * El monto no se valida contra lo que el panel calculó, y es a propósito: los
 * adelantos, los redondeos y los arreglos entre dos personas existen. El panel
 * muestra la diferencia en vez de negarse a guardarla.
 */
export async function registrarPago(
  _previo: EstadoPago,
  formData: FormData,
): Promise<EstadoPago> {
  const sesion = await sesionDelPanel();
  if (!sesion?.esDuenio) return { error: "Solo el dueño registra pagos." };

  const barberId = String(formData.get("barberId") ?? "");
  const direction = String(formData.get("direction") ?? "");
  const periodFrom = String(formData.get("periodFrom") ?? "");
  const periodTo = String(formData.get("periodTo") ?? "");
  const paidOn = String(formData.get("paidOn") ?? "");
  const note = String(formData.get("note") ?? "").trim() || null;

  if (direction !== "out" && direction !== "in") {
    return { error: "No se sabe para qué lado va ese movimiento." };
  }
  if (!FECHA.test(periodFrom) || !FECHA.test(periodTo) || !FECHA.test(paidOn)) {
    return { error: "Revisá las fechas." };
  }
  if (periodTo < periodFrom) {
    return { error: "El período termina antes de empezar." };
  }

  const monto = Number(String(formData.get("amount") ?? "").replace(",", "."));
  if (!Number.isFinite(monto) || monto <= 0) {
    return { error: "El monto tiene que ser mayor que cero." };
  }

  const sb = await createClient();

  const { error } = await sb.from("barber_payouts").insert({
    tenant_id: sesion.tenant.id,
    barber_id: barberId,
    direction,
    amount_cents: Math.round(monto * 100),
    period_from: periodFrom,
    period_to: periodTo,
    paid_on: paidOn,
    note,
    created_by: sesion.barbero.id,
  });

  if (error) return { error: `No se pudo guardar: ${error.message}` };

  revalidatePath("/panel/semana");
  return { ok: "Pago registrado." };
}

/**
 * Borra un pago mal cargado.
 *
 * Acá sí se borra, al revés que con los turnos y los barberos. Un pago mal
 * anotado no es historia: es un error de tipeo, y dejarlo tachado en pantalla
 * ensuciaría el balance de todos los meses siguientes.
 */
export async function borrarPago(formData: FormData) {
  const sesion = await sesionDelPanel();
  if (!sesion?.esDuenio) return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const sb = await createClient();
  await sb
    .from("barber_payouts")
    .delete()
    .eq("id", id)
    .eq("tenant_id", sesion.tenant.id);

  revalidatePath("/panel/semana");
}
