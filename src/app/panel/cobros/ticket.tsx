"use client";

import { useActionState, useState } from "react";

import { cobrarTurno, type EstadoCobro } from "@/app/panel/cobros/actions";
import { MEDIOS, type TurnoParaCobrar } from "@/lib/panel/cobro";
import { formatPrice } from "@/lib/schedule";

export type Agregable = {
  id: string;
  name: string;
  priceCents: number;
  esDescuento: boolean;
};

/**
 * El ticket de un turno.
 *
 * Arranca con un solo renglón —lo que el cliente vino a hacerse, al precio que
 * se le dijo— y se le agrega lo que haya pedido sobre la marcha. El total se
 * ve mientras se arma, porque es el número que hay que decirle en voz alta.
 *
 * La cuenta se vuelve a hacer en el servidor. Esta de acá es para mirar: lo que
 * viaja al cobrar son los ids de lo agregado, nunca los precios.
 */
export function Ticket({
  turno,
  agregables,
  moneda,
}: {
  turno: TurnoParaCobrar;
  agregables: Agregable[];
  moneda: string;
}) {
  const [estado, accion, pendiente] = useActionState<EstadoCobro, FormData>(
    cobrarTurno,
    {},
  );

  // Los ids de lo agregado, en orden y con repetidos: dos veces la misma cosa
  // son dos renglones, que es lo que pasa cuando se cortan dos hermanos.
  const [extras, setExtras] = useState<string[]>([]);
  const [medio, setMedio] = useState<string>("cash");

  const porId = new Map(agregables.map((a) => [a.id, a]));
  const monto = (a: Agregable) =>
    a.esDescuento ? -a.priceCents : a.priceCents;

  const total = extras.reduce((t, id) => {
    const a = porId.get(id);
    return a ? t + monto(a) : t;
  }, turno.priceCents);

  const plata = (c: number) => formatPrice(c, moneda);

  return (
    <form action={accion} className="mt-4 border-t border-ink/10 pt-4">
      <input type="hidden" name="id" value={turno.id} />
      <input type="hidden" name="payment_method" value={medio} />
      {extras.map((id, i) => (
        <input key={`${id}-${i}`} type="hidden" name="extras" value={id} />
      ))}

      {/* ---- Los renglones ---------------------------------------------- */}
      <ul className="space-y-1.5">
        <li className="flex items-baseline justify-between gap-4 text-sm">
          <span className="text-ink">{turno.serviceName ?? "Servicio"}</span>
          <span className="tabular shrink-0 text-ink">
            {plata(turno.priceCents)}
          </span>
        </li>

        {extras.map((id, i) => {
          const a = porId.get(id);
          if (!a) return null;
          return (
            <li
              key={`${id}-${i}`}
              className="flex items-baseline justify-between gap-2 text-sm"
            >
              <span className="text-ink">{a.name}</span>
              <span className="flex shrink-0 items-baseline gap-1">
                <span
                  className={`tabular ${a.esDescuento ? "text-accent" : "text-ink"}`}
                >
                  {a.esDescuento ? "−" : ""}
                  {plata(a.priceCents)}
                </span>
                <button
                  type="button"
                  aria-label={`Quitar ${a.name}`}
                  onClick={() =>
                    setExtras((xs) => xs.filter((_, j) => j !== i))
                  }
                  className="flex size-5 items-center justify-center rounded text-muted transition-colors duration-150 ease-out hover:bg-ink/10 hover:text-ink active:bg-ink/15"
                >
                  <span aria-hidden="true">×</span>
                </button>
              </span>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 flex items-baseline justify-between gap-4 border-t border-ink/10 pt-3">
        <span className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">
          Total
        </span>
        <span className="tabular font-display text-2xl leading-none text-ink">
          {plata(total)}
        </span>
      </p>

      {/* ---- Agregar ---------------------------------------------------- */}
      {agregables.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">
            Agregar
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {agregables.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setExtras((xs) => [...xs, a.id])}
                className={[
                  "rounded-lg border px-3 py-2 text-sm transition-colors duration-150 ease-out",
                  a.esDescuento
                    ? "border-dashed border-accent/50 text-accent hover:bg-accent/[0.08]"
                    : "border-ink/15 text-ink hover:border-ink/40 hover:bg-ink/[0.04]",
                  "active:bg-ink/[0.08]",
                ].join(" ")}
              >
                {a.name}{" "}
                <span className="tabular text-muted">
                  {a.esDescuento ? "−" : ""}
                  {plata(a.priceCents)}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* ---- Con qué pagó ------------------------------------------------ */}
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

      {estado.error ? (
        <p
          role="alert"
          className="mt-4 rounded-lg border-l-2 border-accent bg-accent/[0.06] px-4 py-3 text-sm text-ink"
        >
          {estado.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pendiente || total < 0}
        className="mt-4 w-full rounded-lg bg-accent px-6 py-3.5 text-sm font-semibold tracking-[0.08em] text-surface uppercase transition-colors duration-150 ease-out hover:bg-ink active:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pendiente ? "Cobrando…" : `Cobrar ${plata(total)}`}
      </button>

      {total < 0 ? (
        <p className="mt-2 text-sm text-muted">
          El descuento es más grande que el total.
        </p>
      ) : null}
    </form>
  );
}
