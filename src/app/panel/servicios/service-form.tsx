"use client";

import { useActionState } from "react";

import type { EstadoServicio } from "@/app/panel/servicios/actions";

const etiqueta =
  "block text-xs font-semibold tracking-[0.14em] text-ink uppercase";

const campo =
  "mt-2 w-full rounded-lg border border-transparent bg-ink/[0.03] px-4 py-3 text-ink transition-[background-color,border-color] duration-150 ease-out placeholder:text-ink/30 hover:border-ink/15 focus:border-ink focus:bg-surface focus:outline-none";

export type ServicioInicial = {
  id?: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  priceCents: number;
};

/** Los de siempre en una barbería, para no arrancar de una hoja en blanco. */
const SUGERENCIAS = [
  "Corte",
  "Corte y barba",
  "Barba",
  "Perfilado de cejas",
  "Lavado",
  "Color",
  "Mechas",
  "Corte de niño",
];

export function ServiceForm({
  accion,
  inicial,
  textoBoton,
  moneda,
}: {
  accion: (previo: EstadoServicio, formData: FormData) => Promise<EstadoServicio>;
  inicial: ServicioInicial;
  textoBoton: string;
  moneda: string;
}) {
  const [estado, enviar, pendiente] = useActionState<EstadoServicio, FormData>(
    accion,
    {},
  );

  return (
    <form action={enviar} className="mt-6">
      {inicial.id ? <input type="hidden" name="id" value={inicial.id} /> : null}

      <div className="card space-y-5 px-5 py-5">
        <div>
          <label htmlFor="name" className={etiqueta}>
            Nombre
          </label>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="off"
            list="sugerencias-servicio"
            defaultValue={inicial.name}
            placeholder="Corte y barba"
            className={campo}
          />
          {/* Sugerencias, no una lista cerrada: el dueño escribe lo que quiera
              y estas están para no empezar de cero. */}
          <datalist id="sugerencias-servicio">
            {SUGERENCIAS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="price" className={etiqueta}>
              Precio
            </label>
            <div className="mt-2 flex items-center gap-2">
              <input
                id="price"
                name="price"
                type="number"
                inputMode="decimal"
                min={0}
                step="10"
                defaultValue={inicial.priceCents / 100}
                className="tabular w-36 rounded-lg border border-transparent bg-ink/[0.03] px-4 py-3 text-ink transition-[background-color,border-color] duration-150 ease-out hover:border-ink/15 focus:border-ink focus:bg-surface focus:outline-none"
              />
              <span className="text-sm text-muted">{moneda}</span>
            </div>
          </div>

          <div>
            <label htmlFor="duration_minutes" className={etiqueta}>
              Cuánto lleva
            </label>
            <div className="mt-2 flex items-center gap-2">
              <input
                id="duration_minutes"
                name="duration_minutes"
                type="number"
                inputMode="numeric"
                min={5}
                max={480}
                step={5}
                defaultValue={inicial.durationMinutes}
                className="tabular w-28 rounded-lg border border-transparent bg-ink/[0.03] px-4 py-3 text-ink transition-[background-color,border-color] duration-150 ease-out hover:border-ink/15 focus:border-ink focus:bg-surface focus:outline-none"
              />
              <span className="text-sm text-muted">minutos</span>
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="description" className={etiqueta}>
            Descripción
          </label>
          <input
            id="description"
            name="description"
            type="text"
            autoComplete="off"
            defaultValue={inicial.description ?? ""}
            placeholder="opcional, se ve en la página"
            className={campo}
          />
        </div>
      </div>

      <p className="mt-4 max-w-prose text-sm text-muted">
        La duración define los horarios que se ofrecen. Un servicio de 40
        minutos en una agenda de 14 a 21 da turnos a las 14:00, 14:40, 15:20, y
        así.
      </p>

      {estado.error ? (
        <p
          role="alert"
          className="mt-6 rounded-lg border-l-2 border-accent bg-accent/[0.06] px-4 py-3 text-sm text-ink"
        >
          {estado.error}
        </p>
      ) : null}

      {estado.ok ? (
        <p role="status" className="mt-6 text-sm text-muted">
          {estado.ok}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pendiente}
        className="mt-6 w-full rounded-lg bg-accent px-6 py-4 text-sm font-semibold tracking-[0.08em] text-surface uppercase transition-colors duration-150 ease-out hover:bg-ink active:bg-ink/90 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
      >
        {pendiente ? "Guardando…" : textoBoton}
      </button>
    </form>
  );
}
