"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";

import { avisarDelPedido } from "@/lib/email/pedido";
import { cargarVidriera } from "@/lib/panel/productos";
import { createClient } from "@/lib/supabase/server";
import { cargarTenant } from "@/lib/tenant/load";
import { currentTenantSlug } from "@/lib/tenant/resolve";
import { validarEmail, validarNombre, validarTelefono } from "@/lib/validation";

export type EstadoPedido = {
  error?: string;
  errores?: Partial<Record<"nombre" | "telefono" | "email", string>>;
  valores?: { nombre: string; telefono: string; email: string; nota: string };
};

/**
 * Levanta un pedido del catálogo.
 *
 * No es una compra. Nadie paga nada acá y no se descuenta stock: es alguien
 * diciendo "quiero esto, llamame". La barbería lo llama, arreglan, y si se
 * concreta se cobra por mostrador como cualquier otra venta.
 *
 * El mail es opcional a propósito. Con el teléfono alcanza para contestar, y
 * pedir un dato más del que hace falta es perder pedidos.
 */
export async function pedir(
  _previo: EstadoPedido,
  formData: FormData,
): Promise<EstadoPedido> {
  const slug = await currentTenantSlug();
  if (!slug) return { error: "No pudimos identificar la barbería." };

  const leer = (campo: string) => String(formData.get(campo) ?? "").trim();

  const escrito = {
    nombre: leer("nombre"),
    telefono: leer("telefono"),
    email: leer("email"),
    nota: leer("nota"),
  };

  const nombre = validarNombre(escrito.nombre);
  const telefono = validarTelefono(escrito.telefono);
  // Vacío está bien; escrito y mal, no.
  const email = escrito.email === "" ? null : validarEmail(escrito.email);

  const errores: Partial<Record<"nombre" | "telefono" | "email", string>> = {};
  if (!nombre.ok) errores.nombre = nombre.error;
  if (!telefono.ok) errores.telefono = telefono.error;
  if (email && !email.ok) errores.email = email.error;

  if (Object.keys(errores).length > 0) {
    return { errores, valores: escrito };
  }

  let productos: { id: string; qty: number }[] = [];
  try {
    const crudo = JSON.parse(String(formData.get("productos") ?? "[]"));
    if (Array.isArray(crudo)) {
      productos = crudo
        .filter((x) => Boolean(x) && typeof x === "object")
        .map((x) => ({
          id: String(x.id ?? ""),
          qty: Math.max(1, Math.min(99, Math.trunc(Number(x.qty ?? 1)) || 1)),
        }))
        .filter((x) => x.id !== "");
    }
  } catch {
    productos = [];
  }

  if (productos.length === 0) {
    return { error: "Elegí al menos un producto.", valores: escrito };
  }

  const sb = await createClient();

  const { error } = await sb.rpc("crear_pedido", {
    p_tenant_slug: slug,
    p_productos: productos,
    p_nombre: (nombre as { valor: string }).valor,
    p_telefono: (telefono as { valor: string }).valor,
    p_email: email?.ok ? email.valor : null,
    p_nota: escrito.nota,
  });

  if (error) return { error: error.message, valores: escrito };

  // El aviso sale DESPUÉS de contestarle al cliente. El pedido ya está guardado
  // y ya se ve en el panel: que Resend tarde o falle no puede hacer esperar a
  // alguien que solo quiere saber si su pedido llegó.
  after(async () => {
    const tenant = await cargarTenant(slug);
    if (!tenant) return;

    // Los nombres y precios se vuelven a buscar de la base y no se toman del
    // formulario: el mail tiene que decir lo que quedó guardado, no lo que el
    // navegador dijo que quería.
    const catalogo = await cargarVidriera(tenant);
    const items = productos
      .map(({ id, qty }) => {
        const p = catalogo.find((x) => x.id === id);
        return p
          ? { name: p.name, unitPriceCents: p.priceCents, quantity: qty }
          : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (items.length === 0) return;

    const resultado = await avisarDelPedido({
      tenant,
      cliente: (nombre as { valor: string }).valor,
      telefono: (telefono as { valor: string }).valor,
      email: email?.ok ? email.valor : null,
      nota: escrito.nota || null,
      items,
      urlPanel: await urlAbsoluta("/panel/pedidos"),
    });

    if (!resultado.enviado) {
      console.warn(`[mail] no se avisó del pedido: ${resultado.motivo}`);
    }
  });

  redirect("/productos/listo");
}

/** La URL de esta barbería, tal como la está viendo el cliente. */
async function urlAbsoluta(path: string): Promise<string> {
  const h = await headers();
  const host = h.get("host");
  if (!host) return `${process.env.NEXT_PUBLIC_APP_URL ?? ""}${path}`;
  const proto =
    h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}${path}`;
}
