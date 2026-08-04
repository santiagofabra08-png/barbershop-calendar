"use client";

import { useActionState } from "react";

import { guardarNuevaClave, type EstadoNuevaClave } from "@/app/entrar/actions";

const campo = [
  "mt-2 w-full rounded-lg border bg-ink/[0.03] px-4 py-3.5 text-ink",
  "transition-[background-color,border-color] duration-150 ease-out",
  "placeholder:text-ink/30 focus:bg-surface focus:outline-none",
  "border-transparent hover:border-ink/15 focus:border-ink",
].join(" ");

const etiqueta =
  "block text-xs font-semibold tracking-[0.14em] text-ink uppercase";

export function ClaveForm() {
  const [estado, accion, pendiente] = useActionState<EstadoNuevaClave, FormData>(
    guardarNuevaClave,
    {},
  );

  return (
    <form action={accion} className="mt-8">
      <div className="space-y-5">
        <div>
          <label htmlFor="password" className={etiqueta}>
            Contraseña nueva
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            autoFocus
            placeholder="al menos 8 caracteres"
            className={campo}
          />
        </div>

        <div>
          <label htmlFor="password2" className={etiqueta}>
            Repetila
          </label>
          <input
            id="password2"
            name="password2"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            className={campo}
          />
        </div>
      </div>

      {estado.error ? (
        <p
          role="alert"
          className="mt-6 rounded-lg border-l-2 border-accent bg-accent/[0.06] px-4 py-3 text-sm text-ink"
        >
          {estado.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pendiente}
        className="mt-6 w-full rounded-lg bg-accent px-6 py-4 text-sm font-semibold tracking-[0.08em] text-surface uppercase transition-colors duration-150 ease-out hover:bg-ink active:bg-ink/90 disabled:cursor-wait disabled:opacity-60"
      >
        {pendiente ? "Guardando…" : "Guardar y entrar"}
      </button>
    </form>
  );
}
