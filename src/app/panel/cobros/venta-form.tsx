"use client";

import { useActionState, useState } from "react";

import { venderMostrador, type EstadoCobro } from "@/app/panel/cobros/actions";
import { ProductosPicker } from "@/app/panel/cobros/productos-picker";
import { MEDIOS } from "@/lib/panel/cobro";
import {
  carritoAJson,
  totalDelCarrito,
  type Carrito,
  type ProductoParaVender,
} from "@/lib/carrito";
import { formatPrice } from "@/lib/schedule";

/**
 * Vender sin turno.
 *
 * Alguien entra, se lleva una cera y se va. Antes esa plata caía en la caja sin
 * que el sistema supiera de dónde venía, y al cerrar aparecía como efectivo que
 * sobraba —justo el ruido que el cierre venía a sacar—.
 *
 * Arranca plegado. En un día normal se usa dos veces; tenerlo siempre abierto
 * empujaría hacia abajo lo que sí se mira todo el tiempo.
 */
export function VentaForm({
  productos,
  moneda,
}: {
  productos: ProductoParaVender[];
  moneda: string;
}) {
  const [estado, accion, pendiente] = useActionState<EstadoCobro, FormData>(
    venderMostrador,
    {},
  );

  const [abierto, setAbierto] = useState(false);
  const [carrito, setCarrito] = useState<Carrito>({});
  const [medio, setMedio] = useState<string>("cash");

  const total = totalDelCarrito(productos, carrito);
  const plata = (c: number) => formatPrice(c, moneda);

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="mt-4 w-full rounded-lg border border-dashed border-ink/25 px-5 py-4 text-sm font-semibold tracking-[0.06em] text-muted uppercase transition-colors duration-150 ease-out hover:border-ink/50 hover:text-ink active:bg-ink/[0.04]"
      >
        Vender un producto
      </button>
    );
  }

  return (
    <form action={accion} className="card mt-4 px-5 py-5">
      <input type="hidden" name="payment_method" value={medio} />
      <input
        type="hidden"
        name="productos"
        value={carritoAJson(productos, carrito)}
      />

      <ProductosPicker
        productos={productos}
        carrito={carrito}
        setCarrito={setCarrito}
        moneda={moneda}
      />

      <p className="mt-4 flex items-baseline justify-between gap-4 border-t border-ink/10 pt-4">
        <span className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">
          Total
        </span>
        <span className="tabular font-display text-2xl leading-none text-ink">
          {plata(total)}
        </span>
      </p>

      <div className="mt-4">
        <p className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">
          Pagó con
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {MEDIOS.map((m) => (
            <button
              key={m.valor}
              type="button"
              aria-pressed={medio === m.valor}
              onClick={() => setMedio(m.valor)}
              className={[
                "rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-150 ease-out",
                medio === m.valor
                  ? "bg-ink text-bg"
                  : "bg-ink/[0.05] text-ink hover:bg-ink/[0.09] active:bg-ink/[0.14]",
              ].join(" ")}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <label
          htmlFor="nota-venta"
          className="block text-xs font-semibold tracking-[0.14em] text-ink uppercase"
        >
          Nota
        </label>
        <input
          id="nota-venta"
          name="note"
          type="text"
          autoComplete="off"
          placeholder="opcional: quién se lo llevó"
          className="mt-2 w-full rounded-lg border border-transparent bg-ink/[0.03] px-4 py-3 text-ink transition-[background-color,border-color] duration-150 ease-out placeholder:text-ink/30 hover:border-ink/15 focus:border-ink focus:bg-surface focus:outline-none"
        />
      </div>

      {estado.error ? (
        <p
          role="alert"
          className="mt-4 rounded-lg border-l-2 border-accent bg-accent/[0.06] px-4 py-3 text-sm text-ink"
        >
          {estado.error}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={pendiente || total === 0}
          className="flex-1 rounded-lg bg-accent px-6 py-3.5 text-sm font-semibold tracking-[0.08em] text-surface uppercase transition-colors duration-150 ease-out hover:bg-ink active:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pendiente ? "Cobrando…" : `Cobrar ${plata(total)}`}
        </button>

        <button
          type="button"
          onClick={() => {
            setAbierto(false);
            setCarrito({});
          }}
          className="rounded-lg border border-ink/15 px-5 py-3.5 text-sm font-semibold tracking-[0.06em] text-muted uppercase transition-colors duration-150 ease-out hover:border-ink/40 hover:text-ink active:bg-ink/[0.06]"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
