"use client";

import Link from "next/link";
import { useActionState } from "react";

import { pedirRecuperacion, type EstadoRecuperar } from "@/app/entrar/actions";

const campo = [
  "mt-2 w-full rounded-lg border bg-ink/[0.03] px-4 py-3.5 text-ink",
  "transition-[background-color,border-color] duration-150 ease-out",
  "placeholder:text-ink/30 focus:bg-surface focus:outline-none",
  "border-transparent hover:border-ink/15 focus:border-ink",
].join(" ");

export function RecoverForm({ vencido }: { vencido: boolean }) {
  const [estado, accion, pendiente] = useActionState<EstadoRecuperar, FormData>(
    pedirRecuperacion,
    {},
  );

  // Enviado no significa "ese mail existe": significa "ya está, fijate ahí".
  // La pantalla dice exactamente eso, sin prometer que le llegó a alguien.
  if (estado.enviado) {
    return (
      <div className="mt-8">
        <p className="text-sm leading-relaxed text-ink">
          Si ese mail tiene acceso al panel, en un minuto te llega un link para
          elegir una contraseña nueva.
        </p>
        <p className="mt-3 text-sm text-muted">
          Revisá también el correo no deseado. El link sirve una sola vez y
          vence en una hora.
        </p>

        <Link
          href="/entrar"
          className="mt-8 block w-full rounded-lg border border-ink/20 px-6 py-3.5 text-center text-sm font-semibold tracking-[0.08em] text-ink uppercase transition-colors duration-150 ease-out hover:border-ink hover:bg-ink hover:text-surface active:opacity-90"
        >
          Volver
        </Link>
      </div>
    );
  }

  return (
    <form action={accion} className="mt-8">
      {vencido ? (
        <p className="mb-6 rounded-lg border-l-2 border-accent bg-accent/[0.06] px-4 py-3 text-sm text-ink">
          Ese link ya se usó o venció. Pedí uno nuevo.
        </p>
      ) : null}

      <label
        htmlFor="email"
        className="block text-xs font-semibold tracking-[0.14em] text-ink uppercase"
      >
        Tu mail
      </label>
      <input
        id="email"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="username"
        autoFocus
        placeholder="vos@ejemplo.com"
        className={campo}
      />

      <p className="mt-3 text-sm text-muted">
        Te mandamos un link para elegir una contraseña nueva.
      </p>

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
        {pendiente ? "Mandando…" : "Mandarme el link"}
      </button>
    </form>
  );
}
