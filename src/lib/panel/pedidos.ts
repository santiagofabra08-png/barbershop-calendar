import { createClient } from "@/lib/supabase/server";
import type { Tenant } from "@/lib/tenant/types";

/**
 * Los pedidos que llegaron por la web.
 *
 * Un pedido no es una venta: es alguien levantando la mano. Por eso lo único
 * que se guarda es cómo contestarle y qué quería, y el único estado que
 * importa es si ya alguien lo agarró.
 *
 * Los ve todo el equipo —lo permite la política— porque el que atiende el
 * mostrador es quien va a contestar, sea el dueño o no.
 */

export type PedidoDelPanel = {
  id: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string | null;
  note: string | null;
  status: "new" | "contacted" | "closed";
  createdAt: string;
  handledByName: string | null;
  items: { name: string; unitPriceCents: number; quantity: number }[];
  totalCents: number;
};

export async function cargarPedidos(
  tenant: Tenant,
  limite = 40,
): Promise<PedidoDelPanel[]> {
  const sb = await createClient();

  const { data } = await sb
    .from("product_orders")
    .select(
      "id, client_name, client_phone, client_email, note, status, created_at, " +
        "barbers(display_name), " +
        "product_order_items(name, unit_price_cents, quantity)",
    )
    .eq("tenant_id", tenant.id)
    .order("created_at", { ascending: false })
    .limit(limite);

  type Fila = {
    id: string;
    client_name: string;
    client_phone: string;
    client_email: string | null;
    note: string | null;
    status: "new" | "contacted" | "closed";
    created_at: string;
    barbers: { display_name: string } | { display_name: string }[] | null;
    product_order_items:
      | { name: string; unit_price_cents: number; quantity: number }[]
      | null;
  };

  return ((data ?? []) as unknown as Fila[]).map((f) => {
    const quien = Array.isArray(f.barbers) ? f.barbers[0] : f.barbers;
    const items = (f.product_order_items ?? []).map((i) => ({
      name: i.name,
      unitPriceCents: i.unit_price_cents,
      quantity: i.quantity,
    }));

    return {
      id: f.id,
      clientName: f.client_name,
      clientPhone: f.client_phone,
      clientEmail: f.client_email,
      note: f.note,
      status: f.status,
      createdAt: f.created_at,
      handledByName: quien?.display_name ?? null,
      items,
      // El total es de referencia: son los precios que vio el cliente en la
      // página, no lo que se va a cobrar. Lo que se cobre sale del mostrador.
      totalCents: items.reduce(
        (t, i) => t + i.unitPriceCents * i.quantity,
        0,
      ),
    };
  });
}

/** Cuántos pedidos no agarró nadie todavía. Para el aviso de la agenda. */
export async function contarPedidosNuevos(tenant: Tenant): Promise<number> {
  const sb = await createClient();

  const { count } = await sb
    .from("product_orders")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenant.id)
    .eq("status", "new");

  return count ?? 0;
}
