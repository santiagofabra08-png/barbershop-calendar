"use client";

import { useActionState } from "react";

import { entrar, type EstadoLogin } from "@/app/entrar/actions";

const campo = [
  "mt-2 w-full rounded-lg border bg-ink/[0.03] px-4 py-3.5 text-ink",
  "transition-[background-color,border-color] duration-150 ease-out",
  "placeholder:text-ink/30 focus:bg-surface focus:outline-none",
  "border-transparent hover:border-ink/15 focus:border-ink",
].join(" ");

const etiqueta =
  "block text-xs font-semibold tracking-[0.14em] text-ink uppercase";

export function LoginForm() {
  const [estado, accion, pendiente] = useActionState<EstadoLogin, FormData>(
    entrar,
    {},
  );

  return (
    <form action={accion} className="mt-8">
      <div className="space-y-5">
        <div>
          <label htmlFor="email" className={etiqueta}>
            Mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="username"
            autoFocus
            defaultValue={estado.email ?? ""}
            placeholder="vos@ejemplo.com"
            className={campo}
          />
        </div>

        <div>
          <label htmlFor="password" className={etiqueta}>
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
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
        {pendiente ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
