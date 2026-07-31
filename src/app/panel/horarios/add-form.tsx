"use client";

import { useActionState } from "react";

import {
  agregarTramo,
  type EstadoHorarios,
} from "@/app/panel/horarios/actions";
import { DIAS_ORDENADOS } from "@/lib/panel/dias";

export function AddForm({ barberId }: { barberId: string }) {
  const [estado, accion, pendiente] = useActionState<EstadoHorarios, FormData>(
    agregarTramo,
    {},
  );

  return (
    <form action={accion} className="card mt-4 px-5 py-5">
      <input type="hidden" name="barberId" value={barberId} />

      <fieldset>
        <legend className="text-xs font-semibold tracking-[0.14em] text-ink uppercase">
          Días
        </legend>

        <div className="mt-3 flex flex-wrap gap-2">
          {DIAS_ORDENADOS.map((d) => (
            /* La casilla real queda invisible pero enfocable: el teclado y el
               lector de pantalla la ven, y el estilo lo lleva la etiqueta. */
            <label
              key={d.weekday}
              className="cursor-pointer rounded-lg border border-ink/15 px-3.5 py-2 text-sm font-medium text-muted transition-colors duration-150 ease-out select-none hover:border-ink/40 hover:text-ink has-checked:border-transparent has-checked:bg-accent has-checked:text-surface has-focus-visible:outline has-focus-visible:outline-2 has-focus-visible:outline-ink has-focus-visible:outline-offset-2"
            >
              <input
                type="checkbox"
                name="dias"
                value={d.weekday}
                className="sr-only"
              />
              <span aria-hidden="true">{d.corto}</span>
              <span className="sr-only">{d.largo}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-5 flex flex-wrap items-end gap-4">
        <div>
          <label
            htmlFor="desde"
            className="block text-xs font-semibold tracking-[0.14em] text-ink uppercase"
          >
            Abre
          </label>
          <input
            id="desde"
            name="desde"
            type="time"
            step={300}
            defaultValue="14:00"
            className="tabular mt-2 rounded-lg border border-transparent bg-ink/[0.03] px-3 py-2.5 text-ink transition-[background-color,border-color] duration-150 ease-out hover:border-ink/15 focus:border-ink focus:bg-surface focus:outline-none"
          />
        </div>

        <div>
          <label
            htmlFor="hasta"
            className="block text-xs font-semibold tracking-[0.14em] text-ink uppercase"
          >
            Cierra
          </label>
          <input
            id="hasta"
            name="hasta"
            type="time"
            step={300}
            defaultValue="21:00"
            className="tabular mt-2 rounded-lg border border-transparent bg-ink/[0.03] px-3 py-2.5 text-ink transition-[background-color,border-color] duration-150 ease-out hover:border-ink/15 focus:border-ink focus:bg-surface focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={pendiente}
          className="ml-auto rounded-lg bg-accent px-5 py-3 text-xs font-semibold tracking-[0.08em] text-surface uppercase transition-colors duration-150 ease-out hover:bg-ink active:bg-ink/90 disabled:cursor-wait disabled:opacity-60"
        >
          {pendiente ? "Guardando…" : "Agregar"}
        </button>
      </div>

      {estado.error ? (
        <p
          role="alert"
          className="mt-4 rounded-lg border-l-2 border-accent bg-accent/[0.06] px-4 py-3 text-sm text-ink"
        >
          {estado.error}
        </p>
      ) : null}

      {estado.ok ? (
        <p role="status" className="mt-4 text-sm text-muted">
          {estado.ok}
        </p>
      ) : null}

      <p className="mt-4 text-sm text-muted">
        Para un corte al mediodía, cargá dos tramos el mismo día: uno hasta la
        hora del corte y otro desde que volvés.
      </p>
    </form>
  );
}
