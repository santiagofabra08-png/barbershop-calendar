"use server";

import { revalidatePath } from "next/cache";

import { sesionDelPanel } from "@/lib/panel/session";
import { createClient } from "@/lib/supabase/server";
import { validarTelefono } from "@/lib/validation";

export type EstadoCuenta = { error?: string; ok?: string };

/**
 * Cambiar la propia contraseña.
 *
 * Hasta acá la única forma de tener contraseña era que el dueño te la pusiera,
 * y nunca dejaba de saberla. Con esto la cuenta pasa a ser de quien la usa: el
 * dueño puede seguir reseteándola si alguien se la olvida, pero deja de ser la
 * que él eligió.
 *
 * No se pide la contraseña actual porque para llegar hasta acá ya hay una
 * sesión abierta y verificada. Lo que la protege es no dejar la sesión abierta
 * en un teléfono ajeno.
 */
export async function cambiarContrasena(
  _previo: EstadoCuenta,
  formData: FormData,
): Promise<EstadoCuenta> {
  const sesion = await sesionDelPanel();
  if (!sesion) return { error: "Se cerró la sesión. Entrá de nuevo." };

  const nueva = String(formData.get("password") ?? "");
  const repetida = String(formData.get("password2") ?? "");

  if (nueva.length < 8) {
    return { error: "La contraseña tiene que tener al menos 8 caracteres." };
  }
  if (nueva !== repetida) {
    return { error: "Las dos contraseñas no coinciden." };
  }

  const sb = await createClient();
  const { error } = await sb.auth.updateUser({ password: nueva });

  if (error) return { error: `No se pudo cambiar: ${error.message}` };

  return { ok: "Listo. La próxima vez entrá con la nueva." };
}

/**
 * Los propios datos.
 *
 * El nombre y el teléfono son de cada uno. El rol, el mail y cómo cobra no
 * están acá, y tampoco alcanzaría con sacarlos de la pantalla: la base tiene un
 * guardia que rechaza esos cambios si no los hace el dueño.
 */
export async function guardarMisDatos(
  _previo: EstadoCuenta,
  formData: FormData,
): Promise<EstadoCuenta> {
  const sesion = await sesionDelPanel();
  if (!sesion) return { error: "Se cerró la sesión. Entrá de nuevo." };

  const nombre = String(formData.get("display_name") ?? "").trim();
  if (nombre.length < 2) return { error: "Escribí tu nombre." };

  const crudo = String(formData.get("phone") ?? "").trim();
  let telefono: string | null = null;
  if (crudo !== "") {
    const r = validarTelefono(crudo);
    if (!r.ok) return { error: r.error };
    telefono = r.valor;
  }

  const sb = await createClient();
  const { error } = await sb
    .from("barbers")
    .update({ display_name: nombre, phone: telefono })
    .eq("id", sesion.barbero.id);

  if (error) return { error: `No se pudo guardar: ${error.message}` };

  // El nombre sale en el panel y en la página pública.
  revalidatePath("/", "layout");
  return { ok: "Guardado." };
}
