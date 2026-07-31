"use client";

import { useActionState } from "react";

import { registrarPago, type EstadoPago } from "@/app/panel/semana/actions";

/**
 * Anotar un pago, con todo ya puesto.
 *
 * Llega con el monto, el período y la dirección que el panel calculó, así que
 * en el caso normal —le pagué lo que decía— es abrir y confirmar. Todo se
 * puede cambiar: los adelantos y los redondeos existen.
 */
export function PayForm({
  barberId,
  nombre,
  direction,
  sugerido,
  periodFrom,
  periodTo,
  hoy,
}: {
  barberId: string;
  nombre: string;
  direction: "out" | "in";
  /** En pesos, no en centavos: es lo que se escribe en el campo. */
  sugerido: number;
  periodFrom: string;
  periodTo: string;
  hoy: string;
}) {
  const [estado, accion, pendiente] = useActionState<EstadoPago, FormData>(
    registrarPago,
    {},
  );

  const verbo = direction === "out" ? "Registrar pago" : "Registrar cobro";

  return (
    <details className="group mt-3 border-t border-ink/10 pt-3">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-semibold tracking-[0.06em] text-muted uppercase transition-colors duration-150 ease-out select-none hover:text-ink">
        <span
          aria-hidden="true"
          className="text-sm leading-none transition-transform duration-150 ease-out group-open:rotate-45"
        >
          +
        </span>
        {verbo}
      </summary>

      <form action={accion} className="mt-4">
        <input type="hidden" name="barberId" value={barberId} />
        <input type="hidden" name="direction" value={direction} />
        <input type="hidden" name="periodFrom" value={periodFrom} />
        <input type="hidden" name="periodTo" value={periodTo} />

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label
              htmlFor={`monto-${barberId}`}
              className="block text-xs font-semibold tracking-[0.14em] text-ink uppercase"
            >
              {direction === "out" ? "Le pagué" : "Me pagó"}
            </label>
            <input
              id={`monto-${barberId}`}
              name="amount"
              type="number"
              inputMode="decimal"
              min={0}
              step="10"
              defaultValue={sugerido}
              className="tabular mt-2 w-36 rounded-lg border border-transparent bg-ink/[0.03] px-3 py-2.5 text-ink transition-[background-color,border-color] duration-150 ease-out hover:border-ink/15 focus:border-ink focus:bg-surface focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor={`fecha-${barberId}`}
              className="block text-xs font-semibold tracking-[0.14em] text-ink uppercase"
            >
              Cuándo
            </label>
            <input
              id={`fecha-${barberId}`}
              name="paidOn"
              type="date"
              defaultValue={hoy}
              className="tabular mt-2 rounded-lg border border-transparent bg-ink/[0.03] px-3 py-2.5 text-ink transition-[background-color,border-color] duration-150 ease-out hover:border-ink/15 focus:border-ink focus:bg-surface focus:outline-none"
            />
          </div>

          <div className="min-w-[9rem] flex-1">
            <label
              htmlFor={`nota-${barberId}`}
              className="block text-xs font-semibold tracking-[0.14em] text-ink uppercase"
            >
              Nota
            </label>
            <input
              id={`nota-${barberId}`}
              name="note"
              type="text"
              autoComplete="off"
              placeholder="opcional"
              className="mt-2 w-full rounded-lg border border-transparent bg-ink/[0.03] px-3 py-2.5 text-ink transition-[background-color,border-color] duration-150 ease-out placeholder:text-ink/30 hover:border-ink/15 focus:border-ink focus:bg-surface focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={pendiente}
            className="rounded-lg border border-ink/20 px-5 py-2.5 text-xs font-semibold tracking-[0.08em] text-ink uppercase transition-colors duration-150 ease-out hover:border-ink hover:bg-ink hover:text-surface active:opacity-90 disabled:cursor-wait disabled:opacity-60"
          >
            {pendiente ? "Guardando…" : "Anotar"}
          </button>
        </div>

        <p className="mt-3 text-sm text-muted">
          Queda anotado para {nombre} en este período. No mueve plata: la plata
          se la das vos.
        </p>

        {estado.error ? (
          <p
            role="alert"
            className="mt-3 rounded-lg border-l-2 border-accent bg-accent/[0.06] px-4 py-3 text-sm text-ink"
          >
            {estado.error}
          </p>
        ) : null}

        {estado.ok ? (
          <p role="status" className="mt-3 text-sm text-muted">
            {estado.ok}
          </p>
        ) : null}
      </form>
    </details>
  );
}
