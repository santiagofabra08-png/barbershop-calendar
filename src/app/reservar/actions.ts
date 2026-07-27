"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { currentTenantSlug } from "@/lib/tenant/resolve";

export type EstadoReserva = {
  error?: string;
  valores?: { nombre: string; telefono: string; email: string };
};

/**
 * Crea el turno.
 *
 * No inserta nada por su cuenta: llama a `crear_reserva`, que valida todo del
 * lado de Postgres y devuelve el token del cliente. Todo lo que llega del
 * formulario es sospechoso hasta que esa función diga lo contrario — incluida
 * la fecha y la hora, que acá viajan como texto y allá se convierten al
 * instante real.
 */
export async function reservar(
  _estado: EstadoReserva,
  formData: FormData,
): Promise<EstadoReserva> {
  const slug = await currentTenantSlug();
  if (!slug) return { error: "No pudimos identificar la barbería." };

  const leer = (campo: string) => String(formData.get(campo) ?? "").trim();

  const valores = {
    nombre: leer("nombre"),
    telefono: leer("telefono"),
    email: leer("email"),
  };

  const fecha = leer("fecha");
  const hora = leer("hora");
  const serviceId = leer("serviceId");
  const barberId = leer("barberId");

  if (!valores.nombre || !valores.telefono || !valores.email) {
    return { error: "Completá tu nombre, teléfono y mail.", valores };
  }

  const sb = await createClient();
  const { data, error } = await sb.rpc("crear_reserva", {
    p_tenant_slug: slug,
    p_service_id: serviceId,
    p_barber_id: barberId,
    p_fecha: fecha,
    p_hora: hora,
    p_nombre: valores.nombre,
    p_telefono: valores.telefono,
    p_email: valores.email,
  });

  if (error) {
    // Los mensajes de la función ya están escritos para leerse en pantalla.
    return { error: error.message, valores };
  }

  redirect(`/turno/${data as string}`);
}

export async function cancelar(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const sb = await createClient();
  await sb.rpc("cancelar_turno", { p_token: token });
  redirect(`/turno/${token}`);
}
