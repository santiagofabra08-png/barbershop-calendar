"use server";

import { revalidatePath } from "next/cache";

import { sesionDelPanel } from "@/lib/panel/session";
import { createClient } from "@/lib/supabase/server";

export type EstadoAjustes = { error?: string; ok?: string };

const HEX = /^#[0-9a-fA-F]{6}$/;
const HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;

const COLORES = [
  "color_bg",
  "color_surface",
  "color_ink",
  "color_ink_muted",
  "color_accent",
  "color_accent_alt",
] as const;

/**
 * Guarda los datos de la barbería.
 *
 * Lo que NO se puede tocar desde acá —el slug, el dominio propio y si la
 * barbería está activa— no hace falta filtrarlo: la base tiene un guardia que
 * los rechaza venga de donde venga. Si alguna vez alguien agrega un campo al
 * formulario por error, ese guardia lo frena.
 */
export async function guardarAjustes(
  _previo: EstadoAjustes,
  formData: FormData,
): Promise<EstadoAjustes> {
  const sesion = await sesionDelPanel();
  if (!sesion?.esDuenio) {
    return { error: "Solo el dueño puede cambiar los datos de la barbería." };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) return { error: "Escribí el nombre de la barbería." };

  // ---- Marca ---------------------------------------------------------------
  const colores: Record<string, string> = {};
  for (const campo of COLORES) {
    const valor = String(formData.get(campo) ?? "").trim();
    if (!HEX.test(valor)) {
      return { error: "Todos los colores tienen que estar completos." };
    }
    colores[campo] = valor.toLowerCase();
  }

  // ---- Políticas de agenda -------------------------------------------------
  const minLead = Number(formData.get("min_lead_minutes"));
  const cancelDeadline = Number(formData.get("cancel_deadline_minutes"));

  if (!Number.isInteger(minLead) || minLead < 0 || minLead > 10080) {
    return { error: "La anticipación mínima va de 0 minutos a una semana." };
  }
  if (
    !Number.isInteger(cancelDeadline) ||
    cancelDeadline < 0 ||
    cancelDeadline > 10080
  ) {
    return { error: "El plazo para cancelar va de 0 minutos a una semana." };
  }

  // ---- Ventana de reserva --------------------------------------------------
  // Cada modo pide sus propios datos y anula los del otro. Se mandan siempre
  // los cuatro campos: dejar puestos los del modo anterior haría que la base
  // rechace la fila entera, y con razón.
  const modo = String(formData.get("booking_window_mode") ?? "");
  let ventana: Record<string, string | number | null>;

  if (modo === "rolling") {
    const dias = Number(formData.get("booking_window_days"));
    if (!Number.isInteger(dias) || dias < 1 || dias > 180) {
      return { error: "Los días para adelante van de 1 a 180." };
    }
    ventana = {
      booking_window_mode: "rolling",
      booking_window_days: dias,
      booking_week_release_dow: null,
      booking_week_release_time: null,
    };
  } else if (modo === "weekly") {
    const dow = Number(formData.get("booking_week_release_dow"));
    const hora = String(formData.get("booking_week_release_time") ?? "");
    if (!Number.isInteger(dow) || dow < 0 || dow > 6) {
      return { error: "Elegí qué día se abre la semana siguiente." };
    }
    if (!HORA.test(hora)) {
      return { error: "Poné a qué hora se abre la semana siguiente." };
    }
    ventana = {
      booking_window_mode: "weekly",
      booking_window_days: null,
      booking_week_release_dow: dow,
      booking_week_release_time: hora,
    };
  } else {
    return { error: "Elegí hasta cuándo se puede reservar." };
  }

  const sb = await createClient();

  const { error } = await sb
    .from("tenants")
    .update({
      name,
      address: String(formData.get("address") ?? "").trim() || null,
      maps_url: String(formData.get("maps_url") ?? "").trim() || null,
      timezone: String(formData.get("timezone") ?? "").trim(),
      currency: String(formData.get("currency") ?? "").trim().toUpperCase(),
      ...colores,
      min_lead_minutes: minLead,
      cancel_deadline_minutes: cancelDeadline,
      ...ventana,
    })
    .eq("id", sesion.tenant.id);

  if (error) return { error: `No se pudo guardar: ${error.message}` };

  // La portada y el panel muestran estos datos, así que los dos se rehacen.
  revalidatePath("/", "layout");

  return { ok: "Guardado. Mirá la página para ver cómo quedó." };
}
