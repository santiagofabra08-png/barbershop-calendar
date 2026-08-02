import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { moverProducto, mostrarVidriera } from "@/app/panel/productos/actions";
import { urlDeImagen } from "@/lib/panel/imagen";
import { cargarProductos, type ProductoDelPanel } from "@/lib/panel/productos";
import { sesionDelPanel } from "@/lib/panel/session";
import { formatPrice } from "@/lib/schedule";

export const dynamic = "force-dynamic";

export default async function ProductosPage() {
  const sesion = await sesionDelPanel();
  if (!sesion) redirect("/entrar");
  if (!sesion.esDuenio) redirect("/panel");

  const { tenant } = sesion;
  const productos = await cargarProductos(tenant);

  const enVenta = productos.filter((p) => p.isActive);
  const guardados = productos.filter((p) => !p.isActive);
  const prendida = tenant.productsEnabled;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">
            Productos
          </p>
          <h1 className="mt-1 font-display text-3xl leading-tight text-ink">
            Lo que vendés además del corte
          </h1>
        </div>

        <Link
          href="/panel/productos/nuevo"
          className="rounded-lg bg-accent px-5 py-3 text-xs font-semibold tracking-[0.08em] text-surface uppercase transition-colors duration-150 ease-out hover:bg-ink active:bg-ink/90"
        >
          Agregar producto
        </Link>
      </div>

      {/* El interruptor va arriba de todo: es la única decisión de esta pantalla
          que se ve desde afuera. */}
      <div className="card mt-6 flex flex-wrap items-center justify-between gap-4 px-5 py-5">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-ink">
            {prendida ? "El catálogo está en tu página" : "El catálogo está oculto"}
          </p>
          <p className="mt-1 max-w-prose text-sm text-muted">
            {prendida
              ? enVenta.length === 0
                ? "No hay ningún producto a la venta, así que la sección aparece vacía. Cargá al menos uno."
                : "El cliente lo ve al entrar, elige lo que quiere y te deja el pedido con su teléfono. La venta la arreglás vos."
              : "Cargá los productos con calma. Cuando estén listos, prendelo y aparecen todos juntos."}
          </p>
        </div>

        <form action={mostrarVidriera}>
          <input type="hidden" name="prender" value={prendida ? "0" : "1"} />
          <button
            type="submit"
            className="rounded-lg border border-ink/20 px-5 py-3 text-xs font-semibold tracking-[0.08em] text-ink uppercase transition-colors duration-150 ease-out hover:border-ink hover:bg-ink hover:text-surface active:opacity-90"
          >
            {prendida ? "Ocultar" : "Mostrar en la página"}
          </button>
        </form>
      </div>

      {productos.length === 0 ? (
        <div className="card mt-8 px-5 py-10 text-center">
          <p className="text-sm text-ink">Todavía no cargaste ningún producto.</p>
          <p className="mx-auto mt-2 max-w-prose text-sm text-muted">
            Empezá por lo que más sale: una cera, un polvo, la remera del local.
            Con la foto, el precio y cuántos te quedan alcanza.
          </p>
          <Link
            href="/panel/productos/nuevo"
            className="mt-6 inline-block rounded-lg bg-accent px-6 py-3 text-xs font-semibold tracking-[0.08em] text-surface uppercase transition-colors duration-150 ease-out hover:bg-ink active:bg-ink/90"
          >
            Cargar el primero
          </Link>
        </div>
      ) : null}

      {enVenta.length > 0 ? (
        <ul className="mt-8 space-y-3">
          {enVenta.map((p, i) => (
            <li key={p.id} className="flex items-stretch gap-2">
              <Ficha producto={p} moneda={tenant.currency} />

              <div className="flex shrink-0 flex-col justify-center gap-1">
                <Mover id={p.id} arriba deshabilitado={i === 0} />
                <Mover
                  id={p.id}
                  arriba={false}
                  deshabilitado={i === enVenta.length - 1}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {guardados.length > 0 ? (
        <>
          <h2 className="mt-10 text-xs font-semibold tracking-[0.18em] text-muted uppercase">
            Fuera del catálogo
          </h2>
          <p className="mt-2 max-w-prose text-sm text-muted">
            No se muestran ni se pueden vender. Las ventas viejas los siguen
            nombrando.
          </p>
          <ul className="mt-4 space-y-3 opacity-60">
            {guardados.map((p) => (
              <li key={p.id}>
                <Ficha producto={p} moneda={tenant.currency} />
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </>
  );
}

/**
 * Un producto en la lista.
 *
 * El stock va a la derecha y en grande porque es la única pregunta que alguien
 * le hace a esta pantalla: "¿me queda?". El precio, en cambio, se mira una vez
 * cada varios meses.
 */
function Ficha({
  producto,
  moneda,
}: {
  producto: ProductoDelPanel;
  moneda: string;
}) {
  const foto = urlDeImagen(producto.imagePath);
  const agotado = producto.stock === 0;

  return (
    <Link
      href={`/panel/productos/${producto.id}`}
      className="card flex flex-1 items-center gap-4 px-4 py-4 transition-shadow duration-150 ease-out hover:shadow-lg"
    >
      <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-ink/[0.05]">
        {foto ? (
          <Image src={foto} alt="" fill sizes="56px" className="object-cover" />
        ) : (
          <span className="flex h-full items-center justify-center text-[0.6rem] font-semibold tracking-[0.06em] text-ink/30 uppercase">
            Sin foto
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-ink">{producto.name}</p>
        <p className="tabular mt-0.5 text-sm text-muted">
          {formatPrice(producto.priceCents, moneda)}
        </p>
      </div>

      <p
        className={[
          "tabular shrink-0 text-right text-sm",
          agotado ? "font-semibold text-accent" : "text-muted",
        ].join(" ")}
      >
        {agotado ? "Sin stock" : `Quedan ${producto.stock}`}
      </p>
    </Link>
  );
}

function Mover({
  id,
  arriba,
  deshabilitado,
}: {
  id: string;
  arriba: boolean;
  deshabilitado: boolean;
}) {
  return (
    <form action={moverProducto}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="arriba" value={arriba ? "1" : "0"} />
      <button
        type="submit"
        disabled={deshabilitado}
        aria-label={arriba ? "Subir en el catálogo" : "Bajar en el catálogo"}
        className="flex size-8 items-center justify-center rounded-lg border border-ink/15 text-sm leading-none text-muted transition-colors duration-150 ease-out hover:border-ink/40 hover:text-ink active:bg-ink/[0.06] disabled:border-ink/5 disabled:text-ink/15"
      >
        <span aria-hidden="true">{arriba ? "↑" : "↓"}</span>
      </button>
    </form>
  );
}
