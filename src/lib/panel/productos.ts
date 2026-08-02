import { createClient } from "@/lib/supabase/server";
import type { Tenant } from "@/lib/tenant/types";

/**
 * Los productos que vende la barbería.
 *
 * Dos lecturas distintas de la misma tabla. La del panel trae todo, también lo
 * que está guardado; la de la vidriera trae solo lo que está a la venta, y de
 * eso se encarga RLS —la política pública ya filtra `is_active` y la barbería
 * que no tiene la vidriera prendida—. Acá se pide igual, porque la misma
 * consulta la corre el dueño con sesión mirando su propia página, y para él la
 * política del equipo le mostraría todo.
 */

export type ProductoDelPanel = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  stock: number;
  /** Ruta dentro del bucket. Se convierte a URL con `urlDeImagen`. */
  imagePath: string | null;
  isActive: boolean;
  sortOrder: number;
};

const CAMPOS =
  "id, name, description, price_cents, stock, image_path, is_active, sort_order";

type FilaProducto = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  stock: number;
  image_path: string | null;
  is_active: boolean;
  sort_order: number;
};

function aProducto(fila: FilaProducto): ProductoDelPanel {
  return {
    id: fila.id,
    name: fila.name,
    description: fila.description,
    priceCents: fila.price_cents,
    stock: fila.stock,
    imagePath: fila.image_path,
    isActive: fila.is_active,
    sortOrder: fila.sort_order,
  };
}

/** Todos, también los que están fuera de la vidriera. */
export async function cargarProductos(
  tenant: Tenant,
): Promise<ProductoDelPanel[]> {
  const sb = await createClient();

  const { data } = await sb
    .from("products")
    .select(CAMPOS)
    .eq("tenant_id", tenant.id)
    .order("sort_order");

  return (data ?? []).map((f) => aProducto(f as unknown as FilaProducto));
}

/**
 * Los que se muestran en la página.
 *
 * Los agotados entran igual: un estante vacío se ve, y saber que existe una
 * cera que hoy no está es distinto de creer que no la venden. La pantalla los
 * marca; el carrito no los deja agregar.
 */
export async function cargarVidriera(
  tenant: Tenant,
): Promise<ProductoDelPanel[]> {
  const sb = await createClient();

  const { data } = await sb
    .from("products")
    .select(CAMPOS)
    .eq("tenant_id", tenant.id)
    .eq("is_active", true)
    .order("sort_order");

  return (data ?? []).map((f) => aProducto(f as unknown as FilaProducto));
}
