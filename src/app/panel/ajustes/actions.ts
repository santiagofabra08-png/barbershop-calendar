"use server";

import { revalidatePath } from "next/cache";

import { LOGO, revisarArchivo, urlDeImagen } from "@/lib/panel/imagen";
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

// ---------------------------------------------------------------------------
// El logo
// ---------------------------------------------------------------------------

const BUCKET = "tenant-assets";

/**
 * Son dos y no uno.
 *
 * El encabezado de la página es una franja negra y el resto es claro. Un logo
 * negro desaparece arriba; uno blanco desaparece abajo. Pedir uno solo es
 * garantizar que en alguna de las dos mitades no se vea nada.
 */
const CAMPOS_LOGO = {
  claro: "logo_light_url",
  oscuro: "logo_dark_url",
} as const;

/** De la URL guardada a la ruta dentro del bucket, para poder borrarla. */
function rutaDeLaUrl(url: string | null): string | null {
  if (!url) return null;
  const marca = `/${BUCKET}/`;
  const i = url.indexOf(marca);
  // Un logo cargado a mano puede apuntar a cualquier lado. Ese no se borra: no
  // es nuestro.
  return i === -1 ? null : url.slice(i + marca.length);
}

/**
 * Guarda los dos logos.
 *
 * Va aparte de `guardarAjustes` porque son archivos: mandar dos imágenes cada
 * vez que alguien corrige la dirección sería subir un megabyte para cambiar una
 * coma.
 */
export async function guardarLogos(
  _previo: EstadoAjustes,
  formData: FormData,
): Promise<EstadoAjustes> {
  const sesion = await sesionDelPanel();
  if (!sesion?.esDuenio) {
    return { error: "Solo el dueño puede cambiar el logo." };
  }

  const sb = await createClient();
  const cambios: Record<string, string | null> = {};
  const aBorrar: string[] = [];

  for (const [cual, columna] of Object.entries(CAMPOS_LOGO)) {
    const archivo = formData.get(`logo_${cual}`);
    const quitar = formData.get(`quitar_${cual}`) === "1";
    const actual =
      cual === "claro" ? sesion.tenant.logoLightUrl : sesion.tenant.logoDarkUrl;

    if (archivo instanceof File && archivo.size > 0) {
      const problema = revisarArchivo(archivo.type, archivo.size, LOGO);
      if (problema) return { error: `${problema} (logo para fondo ${cual})` };

      const extension =
        { "image/svg+xml": "svg", "image/png": "png", "image/webp": "webp" }[
          archivo.type
        ] ?? "png";
      const path = `${sesion.tenant.id}/marca/${cual}-${crypto.randomUUID()}.${extension}`;

      const { error } = await sb.storage.from(BUCKET).upload(path, archivo, {
        contentType: archivo.type,
        cacheControl: "31536000",
      });
      if (error) return { error: `No se pudo subir el logo: ${error.message}` };

      cambios[columna] = urlDeImagen(path);
      const vieja = rutaDeLaUrl(actual);
      if (vieja) aBorrar.push(vieja);
    } else if (quitar) {
      cambios[columna] = null;
      const vieja = rutaDeLaUrl(actual);
      if (vieja) aBorrar.push(vieja);
    }
  }

  if (Object.keys(cambios).length === 0) {
    return { error: "No elegiste ningún archivo." };
  }

  const { error } = await sb
    .from("tenants")
    .update(cambios)
    .eq("id", sesion.tenant.id);

  if (error) return { error: `No se pudo guardar: ${error.message}` };

  // Recién ahora, con la fila apuntando a la nueva. Al revés, un error dejaría
  // la página buscando un logo que ya no está.
  if (aBorrar.length > 0) await sb.storage.from(BUCKET).remove(aBorrar);

  revalidatePath("/", "layout");

  return { ok: "Guardado. Mirá la página para ver cómo quedó." };
}
