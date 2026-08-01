"use server";

import { revalidatePath } from "next/cache";

import { sesionDelPanel } from "@/lib/panel/session";
import { createClient } from "@/lib/supabase/server";

export type EstadoCobro = { error?: string; ok?: string };

/**
 * Cobra un turno.
 *
 * La cuenta la hace Postgres, no esta función ni el navegador. Acá solo viajan
 * los ids de lo que se agregó: los precios los busca el servidor, y así nadie
 * puede cobrar $10 un corte de $300 editando el formulario.
 */
export async function cobrarTurno(
  _previo: EstadoCobro,
  formData: FormData,
): Promise<EstadoCobro> {
  const sesion = await sesionDelPanel();
  if (!sesion) return { error: "Se cerró la sesión. Entrá de nuevo." };

  const id = String(formData.get("id") ?? "");
  const medio = String(formData.get("payment_method") ?? "");
  const extras = formData.getAll("extras").map(String).filter(Boolean);

  if (!id) return { error: "Falta el turno." };
  if (!medio) return { error: "Elegí con qué pagó." };

  const sb = await createClient();

  const { error } = await sb.rpc("cobrar_turno", {
    p_appointment_id: id,
    p_extras: extras,
    p_payment_method: medio,
  });

  if (error) return { error: error.message };

  revalidatePath("/panel/cobros");
  revalidatePath("/panel/semana");
  revalidatePath("/panel");
  return { ok: "Cobrado." };
}

/** Deshace un cobro mal hecho. */
export async function anularCobro(formData: FormData) {
  const sesion = await sesionDelPanel();
  if (!sesion) return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const sb = await createClient();
  await sb.rpc("anular_cobro", { p_appointment_id: id });

  revalidatePath("/panel/cobros");
  revalidatePath("/panel/semana");
  revalidatePath("/panel");
}
