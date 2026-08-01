"use client";

import { useActionState, useState } from "react";

import { cerrarCaja, type EstadoCierre } from "@/app/panel/cobros/actions";
import { MEDIOS, totalDe, type PorMedio } from "@/lib/panel/cobro";
import { formatPrice } from "@/lib/schedule";

/**
 * El conteo de la caja.
 *
 * Se escribe lo que hay de verdad y la diferencia aparece al lado, en el
 * momento. Es lo único que hace útil a un cierre: si la diferencia se viera
 * recién después de cerrar, ya no habría nada que revisar.
 *
 * Los montos esperados se muestran pero no se envían. Los calcula la base al
 * cerrar, a partir de lo cobrado: si viajaran desde acá, el cierre serían dos
 * números elegidos por la misma persona y no verificaría nada.
 */
export function CierreForm({
  fecha,
  esperado,
  moneda,
  bloqueado,
}: {
  fecha: string;
  esperado: PorMedio;
  moneda: string;
  /** Quedan turnos sin resolver: no se puede cerrar todavía. */
  bloqueado: boolean;
}) {
  const [estado, accion, pendiente] = useActionState<EstadoCierre, FormData>(
    cerrarCaja,
    {},
  );

  const [contado, setContado] = useState<Record<string, string>>({
    cash: "",
    card: "",
    transfer: "",
  });

  const plata = (c: number) => formatPrice(c, moneda);

  const enCentavos = (v: string) => {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : 0;
  };

  const totalContado = MEDIOS.reduce(
    (t, m) => t + enCentavos(contado[m.valor]),
    0,
  );
  const totalEsperado = totalDe(esperado);
  const diferencia = totalContado - totalEsperado;

  // Nada escrito todavía: no se muestra una diferencia de todo el día en rojo
  // antes de que alguien haya empezado a contar.
  const empezoAContar = MEDIOS.some((m) => contado[m.valor].trim() !== "");

  return (
    <form action={accion} className="card mt-4 px-5 py-5">
      <input type="hidden" name="fecha" value={fecha} />

      <ul className="space-y-3">
        {MEDIOS.map((m) => {
          const esp = esperado[m.valor];
          const cont = enCentavos(contado[m.valor]);
          const dif = cont - esp;
          const escrito = contado[m.valor].trim() !== "";

          return (
            <li
              key={m.valor}
              className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 sm:grid-cols-[8rem_1fr_auto_7rem]"
            >
              <label
                htmlFor={`contado-${m.valor}`}
                className="text-sm font-medium text-ink"
              >
                {m.label}
              </label>

              <p className="tabular hidden text-sm text-muted sm:block">
                Sistema: {plata(esp)}
              </p>

              <input
                id={`contado-${m.valor}`}
                name={m.valor}
                type="number"
                inputMode="decimal"
                min={0}
                step="10"
                placeholder="0"
                value={contado[m.valor]}
                onChange={(e) =>
                  setContado((c) => ({ ...c, [m.valor]: e.target.value }))
                }
                className="tabular w-32 rounded-lg border border-transparent bg-ink/[0.03] px-3 py-2.5 text-right text-ink transition-[background-color,border-color] duration-150 ease-out hover:border-ink/15 focus:border-ink focus:bg-surface focus:outline-none"
              />

              <p
                className={[
                  "tabular text-right text-sm",
                  !escrito
                    ? "text-muted/50"
                    : dif === 0
                      ? "text-muted"
                      : "font-semibold text-accent",
                ].join(" ")}
              >
                {!escrito
                  ? plata(esp)
                  : dif === 0
                    ? "Cuadra"
                    : `${dif > 0 ? "+" : "−"}${plata(Math.abs(dif))}`}
              </p>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t border-ink/10 pt-4">
        <p className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">
          Total
        </p>
        <p className="tabular flex items-baseline gap-3">
          <span className="text-sm text-muted">{plata(totalEsperado)}</span>
          <span className="font-display text-2xl leading-none text-ink">
            {plata(totalContado)}
          </span>
        </p>
      </div>

      {empezoAContar && diferencia !== 0 ? (
        <p className="mt-3 rounded-lg border-l-2 border-accent bg-accent/[0.06] px-4 py-3 text-sm text-ink">
          {diferencia > 0 ? "Sobran " : "Faltan "}
          <span className="tabular font-semibold">
            {plata(Math.abs(diferencia))}
          </span>
          . Podés cerrar igual, pero escribí abajo por qué así mañana se
          entiende.
        </p>
      ) : null}

      <div className="mt-4">
        <label
          htmlFor="note"
          className="block text-xs font-semibold tracking-[0.14em] text-ink uppercase"
        >
          Nota
        </label>
        <input
          id="note"
          name="note"
          type="text"
          autoComplete="off"
          placeholder="opcional: por qué no cuadra, qué se sacó de la caja"
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

      <button
        type="submit"
        disabled={pendiente || bloqueado}
        className="mt-5 w-full rounded-lg bg-accent px-6 py-4 text-sm font-semibold tracking-[0.08em] text-surface uppercase transition-colors duration-150 ease-out hover:bg-ink active:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pendiente ? "Cerrando…" : "Cerrar caja del día"}
      </button>

      <p className="mt-3 text-sm text-muted">
        {bloqueado
          ? "Primero resolvé los turnos de arriba: cobralos o marcá que no vinieron."
          : "Después de cerrar no se cobra ni se anula nada más de este día."}
      </p>
    </form>
  );
}
