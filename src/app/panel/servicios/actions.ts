"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { sesionDelPanel } from "@/lib/panel/session";
import { createClient } from "@/lib/supabase/server";

export type EstadoServicio = { error?: string; ok?: string };

/**
 * Los datos de un servicio, leídos del formulario.
 *
 * El formulario habla en pesos y minutos, que es como los piensa el dueño. La
 * base guarda centavos, que es como no se pierde un peso al redondear.
 */
function camposDelServicio(
  formData: FormData,
):
  | { ok: true; valores: Record<string, string | number | null> }
  | { ok: false; error: string } {
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) return { ok: false, error: "Escribí el nombre del servicio." };
  if (name.length > 60) return { ok: false, error: "Ese nombre es muy largo." };

  const precio = Number(String(formData.get("price") ?? "").replace(",", "."));
  if (!Number.isFinite(precio) || precio < 0) {
    return { ok: false, error: "El precio tiene que ser un número." };
  }

  const kind = String(formData.get("kind") ?? "service");
  if (kind !== "service" && kind !== "discount") {
    return { ok: false, error: "Elegí si es un servicio o un descuento." };
  }

  const description = String(formData.get("description") ?? "").trim() || null;

  // Un descuento no dura nada: no se reserva, se le suma a un ticket. La base
  // exige que sea exactamente cero para que nadie lea esa duración como si
  // significara algo.
  if (kind === "discount") {
    return {
      ok: true,
      valores: {
        name,
        description,
        kind,
        duration_minutes: 0,
        price_cents: Math.round(precio * 100),
      },
    };
  }

  const duracion = Number(formData.get("duration_minutes"));
  if (!Number.isInteger(duracion) || duracion < 5 || duracion > 480) {
    return { ok: false, error: "La duración va de 5 minutos a 8 horas." };
  }
  // La grilla de horarios se arma de a 5 minutos: una duración de 37 dejaría
  // turnos que empiezan en horas imposibles de leer.
  if (duracion % 5 !== 0) {
    return { ok: false, error: "La duración tiene que ser múltiplo de 5 minutos." };
  }

  return {
    ok: true,
    valores: {
      name,
      description,
      kind,
      duration_minutes: duracion,
      price_cents: Math.round(precio * 100),
    },
  };
}

export async function crearServicio(
  _previo: EstadoServicio,
  formData: FormData,
): Promise<EstadoServicio> {
  const sesion = await sesionDelPanel();
  if (!sesion?.esDuenio) return { error: "Solo el dueño toca los servicios." };

  const campos = camposDelServicio(formData);
  if (!campos.ok) return { error: campos.error };

  const sb = await createClient();

  // Al final de la lista: quien agrega algo espera encontrarlo abajo, no
  // colado entre los que ya estaban.
  const { data: ultimo } = await sb
    .from("services")
    .select("sort_order")
    .eq("tenant_id", sesion.tenant.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await sb.from("services").insert({
    tenant_id: sesion.tenant.id,
    sort_order: ((ultimo as { sort_order: number } | null)?.sort_order ?? 0) + 1,
    ...campos.valores,
  });

  if (error) return { error: `No se pudo guardar: ${error.message}` };

  revalidatePath("/panel/servicios");
  revalidatePath("/");
  redirect("/panel/servicios");
}

export async function guardarServicio(
  _previo: EstadoServicio,
  formData: FormData,
): Promise<EstadoServicio> {
  const sesion = await sesionDelPanel();
  if (!sesion?.esDuenio) return { error: "Solo el dueño toca los servicios." };

  const id = String(formData.get("id") ?? "");
  const campos = camposDelServicio(formData);
  if (!campos.ok) return { error: campos.error };

  const sb = await createClient();

  const { error } = await sb
    .from("services")
    .update(campos.valores)
    .eq("id", id)
    .eq("tenant_id", sesion.tenant.id);

  if (error) return { error: `No se pudo guardar: ${error.message}` };

  revalidatePath("/panel/servicios");
  revalidatePath(`/panel/servicios/${id}`);
  revalidatePath("/");

  return {
    ok: "Guardado. Los turnos que ya estaban dados conservan su precio.",
  };
}

/**
 * Saca un servicio de la página, o lo devuelve.
 *
 * No se borra nunca, por la misma razón que un barbero: los turnos viejos
 * apuntan a él, y con ellos apunta el historial de lo que se cobró. La base ni
 * siquiera lo permite —la clave foránea está en `restrict`— y hace bien.
 */
export async function cambiarEstadoServicio(formData: FormData) {
  const sesion = await sesionDelPanel();
  if (!sesion?.esDuenio) return;

  const id = String(formData.get("id") ?? "");
  const activar = formData.get("activar") === "1";

  const sb = await createClient();
  await sb
    .from("services")
    .update({ is_active: activar })
    .eq("id", id)
    .eq("tenant_id", sesion.tenant.id);

  revalidatePath("/panel/servicios");
  revalidatePath(`/panel/servicios/${id}`);
  revalidatePath("/");
}

/**
 * Sube o baja un servicio en la lista.
 *
 * Cambia el orden en que los ve el cliente. Se intercambia el `sort_order` con
 * el vecino en vez de renumerar todo: dos filas tocadas en lugar de todas.
 */
export async function moverServicio(formData: FormData) {
  const sesion = await sesionDelPanel();
  if (!sesion?.esDuenio) return;

  const id = String(formData.get("id") ?? "");
  const haciaArriba = formData.get("arriba") === "1";

  const sb = await createClient();

  const { data } = await sb
    .from("services")
    .select("id, sort_order")
    .eq("tenant_id", sesion.tenant.id)
    .order("sort_order");

  const lista = (data ?? []) as { id: string; sort_order: number }[];
  const i = lista.findIndex((s) => s.id === id);
  const j = haciaArriba ? i - 1 : i + 1;

  if (i === -1 || j < 0 || j >= lista.length) return;

  // Si dos comparten el mismo sort_order —posible si se cargaron por SQL a
  // mano— intercambiarlos no movería nada. En ese caso se separan.
  const a = lista[i].sort_order;
  const b = lista[j].sort_order;
  const [nuevoA, nuevoB] = a === b ? [b + (haciaArriba ? -1 : 1), b] : [b, a];

  await sb.from("services").update({ sort_order: nuevoA }).eq("id", lista[i].id);
  await sb.from("services").update({ sort_order: nuevoB }).eq("id", lista[j].id);

  revalidatePath("/panel/servicios");
  revalidatePath("/");
}
