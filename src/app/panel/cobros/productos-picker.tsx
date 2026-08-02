"use client";

import {
  lineasDelCarrito,
  type Carrito,
  type ProductoParaVender,
} from "@/lib/carrito";
import { formatPrice } from "@/lib/schedule";

/**
 * Elegir productos, con cantidades.
 *
 * Lo usan el ticket de un turno y la venta de mostrador. Es la misma acción en
 * los dos lados —"agarrá esto del estante"— y tiene que sentirse igual: si el
 * botón del mostrador se comportara distinto al del ticket, alguien se iba a
 * equivocar justo cuando hay un cliente esperando.
 *
 * El stock frena acá y también en la base. Acá para que el botón se apague
 * antes de que alguien lo toque; en la base porque dos personas pueden estar
 * cobrando la última cera al mismo tiempo, y solo Postgres puede resolver eso.
 */
export function ProductosPicker({
  productos,
  carrito,
  setCarrito,
  moneda,
}: {
  productos: ProductoParaVender[];
  carrito: Carrito;
  setCarrito: (c: Carrito) => void;
  moneda: string;
}) {
  const plata = (c: number) => formatPrice(c, moneda);
  const lineas = lineasDelCarrito(productos, carrito);

  const cambiar = (id: string, delta: number) => {
    const producto = productos.find((p) => p.id === id);
    if (!producto) return;
    const ahora = carrito[id] ?? 0;
    const nuevo = Math.max(0, Math.min(producto.stock, ahora + delta));
    setCarrito({ ...carrito, [id]: nuevo });
  };

  return (
    <div>
      {lineas.length > 0 ? (
        <ul className="mb-3 space-y-1.5">
          {lineas.map(({ producto, cantidad }) => (
            <li
              key={producto.id}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="min-w-0 truncate text-ink">
                {producto.name}
                <span className="tabular text-muted"> ×{cantidad}</span>
              </span>

              <span className="flex shrink-0 items-center gap-2">
                <span className="tabular text-ink">
                  {plata(producto.priceCents * cantidad)}
                </span>
                <Paso
                  label={`Sacar un ${producto.name}`}
                  onClick={() => cambiar(producto.id, -1)}
                >
                  −
                </Paso>
                <Paso
                  label={`Agregar otro ${producto.name}`}
                  onClick={() => cambiar(producto.id, +1)}
                  deshabilitado={cantidad >= producto.stock}
                >
                  +
                </Paso>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {productos.map((p) => {
          const enCarrito = carrito[p.id] ?? 0;
          const sinStock = p.stock === 0;
          const alTope = enCarrito >= p.stock;

          return (
            <button
              key={p.id}
              type="button"
              disabled={sinStock || alTope}
              onClick={() => cambiar(p.id, +1)}
              className="rounded-lg border border-ink/15 px-3 py-2 text-sm text-ink transition-colors duration-150 ease-out hover:border-ink/40 hover:bg-ink/[0.04] active:bg-ink/[0.08] disabled:border-ink/[0.07] disabled:text-ink/25 disabled:hover:bg-transparent"
            >
              {p.name}{" "}
              <span className="tabular text-muted">
                {sinStock ? "sin stock" : plata(p.priceCents)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Paso({
  label,
  onClick,
  deshabilitado,
  children,
}: {
  label: string;
  onClick: () => void;
  deshabilitado?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={deshabilitado}
      className="flex size-6 items-center justify-center rounded border border-ink/15 text-sm leading-none text-muted transition-colors duration-150 ease-out hover:border-ink/40 hover:text-ink active:bg-ink/[0.08] disabled:border-ink/5 disabled:text-ink/20"
    >
      <span aria-hidden="true">{children}</span>
    </button>
  );
}
