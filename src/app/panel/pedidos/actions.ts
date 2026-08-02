"use server";

import { revalidatePath } from "next/cache";

import { sesionDelPanel } from "@/lib/panel/session";
import { createClient } from "@/lib/supabase/server";

/**
 * Marca en qué anda un pedido.
 *
 * Tres estados y nada más: nuevo, ya lo contacté, terminado. "Terminado" no
 * dice si se vendió o no, y es a propósito: la venta la registra el mostrador,
 * que es donde entra la plata. Si acá también se dijera "vendido", habría dos
 * lugares afirmando lo mismo y tarde o temprano uno de los dos mentiría.
 */
export async function marcarPedido(formData: FormData) {
  const sesion = await sesionDelPanel();
  if (!sesion) return;

  const id = String(formData.get("id") ?? "");
  const estado = String(formData.get("estado") ?? "");
  if (!id || !["new", "contacted", "closed"].includes(estado)) return;

  const sb = await createClient();

  await sb
    .from("product_orders")
    .update({
      status: estado,
      // Quién lo agarró y cuándo. Volver a "nuevo" borra las dos cosas: si
      // quedara el nombre, el pedido diría que alguien lo está atendiendo
      // justo cuando se lo devolvió a la pila.
      handled_at: estado === "new" ? null : new Date().toISOString(),
      handled_by: estado === "new" ? null : sesion.barbero.id,
    })
    .eq("id", id)
    .eq("tenant_id", sesion.tenant.id);

  revalidatePath("/panel/pedidos");
  revalidatePath("/panel");
  revalidatePath("/panel/local");
}
