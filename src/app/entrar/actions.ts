"use server";

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
