"use client";

import { useActionState } from "react";

import { darAcceso, type EstadoEquipo } from "@/app/panel/equipo/actions";

export function AccessForm({
  id,
  nombre,
  email,
  yaEntra,
}: {
  id: string;
  nombre: string;
  email: string | null;
  yaEntra: boolean;
}) {
  const [estado, accion, pendiente] = useActionState<EstadoEquipo, FormData>(
    darAcceso,
    {},
  );

  return (
    <div className="card mt-4 px-5 py-5">
      <p className="text-sm text-muted">
        {!email ? (
          <>
            {nombre} todavía no tiene mail cargado. El mail es con lo que entra,
            así que cargalo arriba y guardá antes de darle acceso.
          </>
        ) : yaEntra ? (
          <>
            {nombre} entra al panel con{" "}
            <span className="text-ink">{email}</span>. Acá le podés poner una
            contraseña nueva si se la olvidó.
          </>
        ) : (
          <>
            {nombre} todavía no puede entrar. Poné una contraseña y pasásela en
            persona; después la puede cambiar él.
          </>
        )}
      </p>

      {email ? (
        <form action={accion} className="mt-4 flex flex-wrap items-end gap-3">
          <input type="hidden" name="id" value={id} />

          <div className="min-w-[12rem] flex-1">
            <label
              htmlFor="password"
              className="block text-xs font-semibold tracking-[0.14em] text-ink uppercase"
            >
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="text"
              autoComplete="off"
              placeholder="mínimo 8 caracteres"
              className="mt-2 w-full rounded-lg border border-transparent bg-ink/[0.03] px-4 py-3 text-ink transition-[background-color,border-color] duration-150 ease-out placeholder:text-ink/30 hover:border-ink/15 focus:border-ink focus:bg-surface focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={pendiente}
            className="rounded-lg border border-ink/20 px-5 py-3 text-xs font-semibold tracking-[0.08em] text-ink uppercase transition-colors duration-150 ease-out hover:border-ink hover:bg-ink hover:text-surface active:opacity-90 disabled:cursor-wait disabled:opacity-60"
          >
            {pendiente ? "Guardando…" : yaEntra ? "Cambiar" : "Dar acceso"}
          </button>
        </form>
      ) : null}

      {/* La contraseña se escribe a la vista a propósito: la está eligiendo el
          dueño para pasársela a otra persona, así que taparla con puntitos solo
          serviría para que la copie mal. */}

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
    </div>
  );
}
