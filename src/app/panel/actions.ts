"use server";

import { revalidatePath } from "next/cache";

import { sesionDelPanel } from "@/lib/panel/session";
import { localToUtc } from "@/lib/schedule";
import { createClient } from "@/lib/supabase/server";
import { validarTelefono } from "@/lib/validation";

export type EstadoTurno = { error?: string; ok?: string };

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;
const SUPERPOSICION = "23P01";

/**
 * Marca si el cliente vino o no.
 *
 * Un turno que ya pasó se da por cumplido salvo que alguien diga lo contrario:
 * el barbero solo tiene que tocar el botón en el caso raro. Al revés —tener que
 * confirmar uno por uno los que sí vinieron— nadie lo haría, y a la semana el
 * recuento estaría en cero.
 */
export async function marcarAsistencia(formData: FormData) {
  const sesion = await sesionDelPanel();
  if (!sesion) return;

  const id = String(formData.get("id") ?? "");
  const vino = formData.get("vino") === "1";
  if (!id) return;

  const sb = await createClient();
  // Sin filtro por barbero: quién puede tocar qué turno lo decide RLS.
  await sb
    .from("appointments")
    .update({ status: vino ? "confirmed" : "no_show" })
    .eq("id", id)
    .eq("kind", "booking");

  revalidatePath("/panel");
  revalidatePath("/panel/semana");
}

/**
 * Carga un turno que no pasó por la página.
 *
 * El que entra por la puerta un martes a las tres no tiene mail ni ganas de
 * dar el teléfono, así que acá lo único que se pide es la hora y el servicio.
 * El nombre ayuda a reconocerlo en la agenda, pero tampoco es obligatorio.
 *
 * El precio y la duración se congelan igual que en una reserva de la web: si
 * mañana sube el corte, este turno conserva lo que se cobró hoy.
 */
export async function cargarTurnoAMano(
  _previo: EstadoTurno,
  formData: FormData,
): Promise<EstadoTurno> {
  const sesion = await sesionDelPanel();
  if (!sesion) return { error: "Se cerró la sesión. Entrá de nuevo." };

  const { tenant, barbero, esDuenio } = sesion;

  const fecha = String(formData.get("fecha") ?? "");
  const hora = String(formData.get("hora") ?? "");
  const serviceId = String(formData.get("serviceId") ?? "");
  const barberId = String(formData.get("barberId") ?? barbero.id);

  if (!FECHA.test(fecha) || !HORA.test(hora)) {
    return { error: "Revisá el día y la hora." };
  }
  if (!serviceId) return { error: "Elegí qué se hizo." };
  if (barberId !== barbero.id && !esDuenio) {
    return { error: "Solo podés cargar turnos en tu propia agenda." };
  }

  const sb = await createClient();

  const { data: servicio } = await sb
    .from("services")
    .select("duration_minutes, price_cents")
    .eq("id", serviceId)
    .eq("tenant_id", tenant.id)
    .maybeSingle();

  if (!servicio) return { error: "Ese servicio ya no está disponible." };

  const { duration_minutes, price_cents } = servicio as {
    duration_minutes: number;
    price_cents: number;
  };

  const inicio = localToUtc(fecha, hora, tenant.timezone);
  const fin = new Date(inicio.getTime() + duration_minutes * 60_000);

  // El nombre y el teléfono son opcionales. Si hay teléfono, se guarda
  // normalizado igual que el de la web: es lo que necesita el link de WhatsApp.
  const nombre = String(formData.get("nombre") ?? "").trim() || null;
  const telefonoCrudo = String(formData.get("telefono") ?? "").trim();

  let telefono: string | null = null;
  if (telefonoCrudo !== "") {
    const r = validarTelefono(telefonoCrudo);
    if (!r.ok) return { error: r.error };
    telefono = r.valor;
  }

  const { error } = await sb.from("appointments").insert({
    tenant_id: tenant.id,
    barber_id: barberId,
    kind: "booking",
    status: "confirmed",
    source: "panel",
    starts_at: inicio.toISOString(),
    ends_at: fin.toISOString(),
    service_id: serviceId,
    client_name: nombre,
    client_phone: telefono,
    price_cents,
    duration_minutes,
  });

  if (error) {
    if (error.code === SUPERPOSICION) {
      return { error: "A esa hora ya hay algo en esa agenda." };
    }
    return { error: `No se pudo guardar: ${error.message}` };
  }

  revalidatePath("/panel");
  revalidatePath("/panel/semana");
  return { ok: "Turno cargado." };
}

/**
 * Tapa un rato de la agenda: un día libre, un turno médico, un almuerzo suelto.
 *
 * Va a la misma tabla que los turnos porque para la disponibilidad son lo
 * mismo —un rato en que el barbero no está—, y así la restricción que impide
 * superposiciones los cuida a los dos con la misma regla.
 */
export async function bloquearRato(
  _previo: EstadoTurno,
  formData: FormData,
): Promise<EstadoTurno> {
  const sesion = await sesionDelPanel();
  if (!sesion) return { error: "Se cerró la sesión. Entrá de nuevo." };

  const { tenant, barbero, esDuenio } = sesion;

  const fecha = String(formData.get("fecha") ?? "");
  const desde = String(formData.get("desde") ?? "");
  const hasta = String(formData.get("hasta") ?? "");
  const barberId = String(formData.get("barberId") ?? barbero.id);
  const motivo = String(formData.get("motivo") ?? "").trim() || null;

  if (!FECHA.test(fecha) || !HORA.test(desde) || !HORA.test(hasta)) {
    return { error: "Revisá el día y las horas." };
  }
  if (hasta <= desde) {
    return { error: "La hora de fin tiene que ser posterior a la de inicio." };
  }
  if (barberId !== barbero.id && !esDuenio) {
    return { error: "Solo podés bloquear tu propia agenda." };
  }

  const sb = await createClient();

  const { error } = await sb.from("appointments").insert({
    tenant_id: tenant.id,
    barber_id: barberId,
    kind: "block",
    status: "confirmed",
    starts_at: localToUtc(fecha, desde, tenant.timezone).toISOString(),
    ends_at: localToUtc(fecha, hasta, tenant.timezone).toISOString(),
    reason: motivo,
  });

  if (error) {
    if (error.code === SUPERPOSICION) {
      return { error: "Ese rato se pisa con un turno que ya está dado." };
    }
    return { error: `No se pudo guardar: ${error.message}` };
  }

  revalidatePath("/panel");
  return { ok: "Rato bloqueado." };
}

/** Saca un bloqueo. Un turno de un cliente no se borra: se cancela. */
export async function borrarBloqueo(formData: FormData) {
  const sesion = await sesionDelPanel();
  if (!sesion) return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const sb = await createClient();
  await sb.from("appointments").delete().eq("id", id).eq("kind", "block");

  revalidatePath("/panel");
}
