"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  borrarFoto,
  fotoDelFormulario,
  subirFoto as subirFotoAlBucket,
} from "@/lib/panel/fotos";
import { FOTO_PRODUCTO } from "@/lib/panel/imagen";
import { sesionDelPanel } from "@/lib/panel/session";
import { createClient } from "@/lib/supabase/server";

export type EstadoProducto = { error?: string; ok?: string };

type Campos = {
  name: string;
  description: string | null;
  price_cents: number;
  stock: number;
};

function camposDelProducto(
  formData: FormData,
): { ok: true; valores: Campos } | { ok: false; error: string } {
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) return { ok: false, error: "Escribí el nombre del producto." };
  if (name.length > 80) return { ok: false, error: "Ese nombre es muy largo." };

  const precio = Number(String(formData.get("price") ?? "").replace(",", "."));
  if (!Number.isFinite(precio) || precio < 0) {
    return { ok: false, error: "El precio tiene que ser un número." };
  }

  const stock = Number(formData.get("stock"));
  if (!Number.isInteger(stock) || stock < 0) {
    return { ok: false, error: "El stock tiene que ser un número entero, y no puede ser negativo." };
  }

  return {
    ok: true,
    valores: {
      name,
      description: String(formData.get("description") ?? "").trim() || null,
      price_cents: Math.round(precio * 100),
      stock,
    },
  };
}

/** La foto del formulario, si mandaron una. */

export async function crearProducto(
  _previo: EstadoProducto,
  formData: FormData,
): Promise<EstadoProducto> {
  const sesion = await sesionDelPanel();
  if (!sesion?.esDuenio) return { error: "Solo el dueño toca los productos." };

  const campos = camposDelProducto(formData);
  if (!campos.ok) return { error: campos.error };

  const sb = await createClient();

  let imagePath: string | null = null;
  const foto = fotoDelFormulario(formData);
  if (foto) {
    const subida = await subirFotoAlBucket(sb, sesion.tenant.id, "productos", foto, FOTO_PRODUCTO);
    if (!subida.ok) return { error: subida.error };
    imagePath = subida.path;
  }

  // Al final de la lista: quien carga algo espera encontrarlo abajo.
  const { data: ultimo } = await sb
    .from("products")
    .select("sort_order")
    .eq("tenant_id", sesion.tenant.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await sb.from("products").insert({
    tenant_id: sesion.tenant.id,
    sort_order: ((ultimo as { sort_order: number } | null)?.sort_order ?? 0) + 1,
    image_path: imagePath,
    ...campos.valores,
  });

  if (error) {
    // Si la fila no entró, la foto queda huérfana en el bucket. Se limpia acá.
    await borrarFoto(sb, imagePath);
    return { error: `No se pudo guardar: ${error.message}` };
  }

  revalidar();
  redirect("/panel/productos");
}

export async function guardarProducto(
  _previo: EstadoProducto,
  formData: FormData,
): Promise<EstadoProducto> {
  const sesion = await sesionDelPanel();
  if (!sesion?.esDuenio) return { error: "Solo el dueño toca los productos." };

  const id = String(formData.get("id") ?? "");
  const campos = camposDelProducto(formData);
  if (!campos.ok) return { error: campos.error };

  const sb = await createClient();

  const { data: actual } = await sb
    .from("products")
    .select("image_path")
    .eq("id", id)
    .eq("tenant_id", sesion.tenant.id)
    .maybeSingle();

  const anterior = (actual as { image_path: string | null } | null)?.image_path ?? null;

  let imagePath = anterior;
  const foto = fotoDelFormulario(formData);
  if (foto) {
    const subida = await subirFotoAlBucket(sb, sesion.tenant.id, "productos", foto, FOTO_PRODUCTO);
    if (!subida.ok) return { error: subida.error };
    imagePath = subida.path;
  } else if (formData.get("quitar_foto") === "1") {
    imagePath = null;
  }

  const { error } = await sb
    .from("products")
    .update({ ...campos.valores, image_path: imagePath })
    .eq("id", id)
    .eq("tenant_id", sesion.tenant.id);

  if (error) {
    if (imagePath !== anterior) await borrarFoto(sb, imagePath);
    return { error: `No se pudo guardar: ${error.message}` };
  }

  // La vieja se borra recién cuando la fila ya apunta a la nueva. Al revés, un
  // error dejaría el producto apuntando a una foto que ya no está.
  if (anterior && imagePath !== anterior) await borrarFoto(sb, anterior);

  revalidar();
  revalidatePath(`/panel/productos/${id}`);

  return { ok: "Guardado." };
}

/**
 * Saca un producto de la vidriera, o lo devuelve.
 *
 * No se borra: los tickets y los pedidos viejos lo nombran, y con ellos el
 * historial de lo que se vendió.
 */
export async function cambiarEstadoProducto(formData: FormData) {
  const sesion = await sesionDelPanel();
  if (!sesion?.esDuenio) return;

  const id = String(formData.get("id") ?? "");
  const sb = await createClient();

  await sb
    .from("products")
    .update({ is_active: formData.get("activar") === "1" })
    .eq("id", id)
    .eq("tenant_id", sesion.tenant.id);

  revalidar();
  revalidatePath(`/panel/productos/${id}`);
}

/** Sube o baja un producto: cambia el orden en que los ve el cliente. */
export async function moverProducto(formData: FormData) {
  const sesion = await sesionDelPanel();
  if (!sesion?.esDuenio) return;

  const id = String(formData.get("id") ?? "");
  const haciaArriba = formData.get("arriba") === "1";

  const sb = await createClient();

  const { data } = await sb
    .from("products")
    .select("id, sort_order")
    .eq("tenant_id", sesion.tenant.id)
    .order("sort_order");

  const lista = (data ?? []) as { id: string; sort_order: number }[];
  const i = lista.findIndex((p) => p.id === id);
  const j = haciaArriba ? i - 1 : i + 1;

  if (i === -1 || j < 0 || j >= lista.length) return;

  const a = lista[i].sort_order;
  const b = lista[j].sort_order;
  const [nuevoA, nuevoB] = a === b ? [b + (haciaArriba ? -1 : 1), b] : [b, a];

  await sb.from("products").update({ sort_order: nuevoA }).eq("id", lista[i].id);
  await sb.from("products").update({ sort_order: nuevoB }).eq("id", lista[j].id);

  revalidar();
}

/**
 * Prende o apaga la vidriera en la página pública.
 *
 * Es lo que separa "estoy armando el catálogo" de "esto ya se puede pedir". Sin
 * el interruptor, el primer producto a medio cargar aparecería en la página
 * apenas se guarda.
 */
export async function mostrarVidriera(formData: FormData) {
  const sesion = await sesionDelPanel();
  if (!sesion?.esDuenio) return;

  const sb = await createClient();
  await sb
    .from("tenants")
    .update({ products_enabled: formData.get("prender") === "1" })
    .eq("id", sesion.tenant.id);

  revalidar();
}

/** Los productos se ven en el panel, en la vidriera y al cobrar. */
function revalidar() {
  revalidatePath("/panel/productos");
  revalidatePath("/panel/cobros");
  revalidatePath("/panel/local");
  revalidatePath("/");
  revalidatePath("/productos");
}
