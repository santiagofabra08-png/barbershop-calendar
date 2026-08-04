"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { cargarTenant } from "@/lib/tenant/load";
import { currentTenantSlug } from "@/lib/tenant/resolve";

export type EstadoLogin = { error?: string; email?: string };

export async function entrar(
  _previo: EstadoLogin,
  formData: FormData,
): Promise<EstadoLogin> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Completá el mail y la contraseña.", email };
  }

  const sb = await createClient();

  const { data, error } = await sb.auth.signInWithPassword({ email, password });

  // El mismo mensaje para "ese mail no existe" y "esa contraseña está mal": la
  // diferencia le sirve solo a quien está probando mails ajenos.
  if (error || !data.user) {
    return { error: "Mail o contraseña incorrectos.", email };
  }

  // Entrar no alcanza: hay que trabajar en ESTA barbería. La cuenta de un
  // barbero de otro local es una cuenta válida que acá no es nadie.
  const slug = await currentTenantSlug();
  const tenant = slug ? await cargarTenant(slug) : null;

  if (!tenant) {
    await sb.auth.signOut();
    return { error: "No se pudo identificar la barbería.", email };
  }

  const { data: fila } = await sb
    .from("barbers")
    .select("id")
    .eq("tenant_id", tenant.id)
    .eq("user_id", data.user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!fila) {
    await sb.auth.signOut();
    return {
      error: `Esa cuenta no trabaja en ${tenant.name}.`,
      email,
    };
  }

  // Fuera del try: redirect funciona lanzando, y atraparlo lo rompería.
  redirect("/panel");
}

export async function salir() {
  const sb = await createClient();
  await sb.auth.signOut();
  redirect("/entrar");
}

export type EstadoRecuperar = { error?: string; enviado?: boolean };

/**
 * Pide el link para elegir una contraseña nueva.
 *
 * El mail lo manda Supabase, no Resend: es parte de la autenticación y no de la
 * barbería, así que sale con el remitente del proyecto y no con el del local.
 * De paso, funciona aunque el dominio de la barbería todavía no esté verificado.
 *
 * **Siempre contesta lo mismo**, exista o no ese mail. Decir "ese mail no está
 * registrado" le confirma a cualquiera qué cuentas existen, que es justo lo que
 * necesita alguien probando mails ajenos. Es la misma decisión que ya está
 * tomada en `entrar`, donde tampoco se distingue mail inexistente de contraseña
 * equivocada.
 */
export async function pedirRecuperacion(
  _previo: EstadoRecuperar,
  formData: FormData,
): Promise<EstadoRecuperar> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(email)) {
    return { error: "Escribí un mail válido." };
  }

  // El link tiene que volver a ESTA barbería. Cada una vive en su subdominio,
  // así que la dirección sale del pedido y no de una constante: mandarlo
  // siempre al mismo dominio dejaría al dueño de un local eligiendo contraseña
  // en la página de otro.
  const h = await headers();
  const host = h.get("host");
  const protocolo = h.get("x-forwarded-proto") ?? (host?.includes("localhost") || host?.includes("lvh.me") ? "http" : "https");

  const sb = await createClient();
  await sb.auth.resetPasswordForEmail(email, {
    redirectTo: `${protocolo}://${host}/entrar/confirmar`,
  });

  // Sin mirar el error a propósito: ver arriba.
  return { enviado: true };
}

export type EstadoNuevaClave = { error?: string };

/**
 * Guarda la contraseña nueva.
 *
 * Para llegar acá hay que venir del link del mail, que dejó una sesión abierta.
 * Sin esa sesión no hay a quién cambiarle nada, y esta función no tiene forma de
 * inventarla.
 */
export async function guardarNuevaClave(
  _previo: EstadoNuevaClave,
  formData: FormData,
): Promise<EstadoNuevaClave> {
  const nueva = String(formData.get("password") ?? "");
  const repetida = String(formData.get("password2") ?? "");

  if (nueva.length < 8) {
    return { error: "La contraseña tiene que tener al menos 8 caracteres." };
  }
  if (nueva !== repetida) {
    return { error: "Las dos contraseñas no coinciden." };
  }

  const sb = await createClient();

  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) {
    return {
      error: "El link venció o ya se usó. Pedí uno nuevo desde “Olvidé mi contraseña”.",
    };
  }

  const { error } = await sb.auth.updateUser({ password: nueva });
  if (error) return { error: `No se pudo cambiar: ${error.message}` };

  redirect("/panel");
}
