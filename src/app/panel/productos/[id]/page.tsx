import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  cambiarEstadoProducto,
  guardarProducto,
} from "@/app/panel/productos/actions";
import { ProductForm } from "@/app/panel/productos/product-form";
import { cargarProductos } from "@/lib/panel/productos";
import { sesionDelPanel } from "@/lib/panel/session";

export const dynamic = "force-dynamic";

export default async function FichaProductoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const sesion = await sesionDelPanel();
  if (!sesion) redirect("/entrar");
  if (!sesion.esDuenio) redirect("/panel");

  const { id } = await params;
  const producto = (await cargarProductos(sesion.tenant)).find((p) => p.id === id);
  if (!producto) notFound();

  return (
    <>
      <Link
        href="/panel/productos"
        className="text-sm text-muted transition-colors duration-150 ease-out hover:text-ink"
      >
        ‹ Productos
      </Link>

      <h1 className="mt-3 font-display text-3xl leading-tight text-ink">
        {producto.name}
      </h1>
      {!producto.isActive ? (
        <p className="mt-2 text-sm text-muted">
          Está fuera del catálogo: no se muestra ni se puede vender.
        </p>
      ) : null}

      <ProductForm
        accion={guardarProducto}
        textoBoton="Guardar cambios"
        moneda={sesion.tenant.currency}
        inicial={{
          id: producto.id,
          name: producto.name,
          description: producto.description,
          priceCents: producto.priceCents,
          stock: producto.stock,
          imagePath: producto.imagePath,
        }}
      />

      <h2 className="mt-10 text-xs font-semibold tracking-[0.18em] text-muted uppercase">
        {producto.isActive ? "Sacar del catálogo" : "Volver al catálogo"}
      </h2>

      <div className="card mt-4 flex flex-wrap items-center justify-between gap-4 px-5 py-5">
        <p className="max-w-prose text-sm text-muted">
          {producto.isActive
            ? "Deja de mostrarse y no se puede vender más. Lo que ya se vendió sigue en el historial, con el precio de ese día."
            : "Vuelve a mostrarse en la página, con el precio y el stock de acá arriba."}
        </p>

        <form action={cambiarEstadoProducto}>
          <input type="hidden" name="id" value={producto.id} />
          <input
            type="hidden"
            name="activar"
            value={producto.isActive ? "0" : "1"}
          />
          <button
            type="submit"
            className="rounded-lg border border-ink/20 px-5 py-3 text-xs font-semibold tracking-[0.08em] text-ink uppercase transition-colors duration-150 ease-out hover:border-ink hover:bg-ink hover:text-surface active:opacity-90"
          >
            {producto.isActive ? "Sacar" : "Volver a vender"}
          </button>
        </form>
      </div>
    </>
  );
}
