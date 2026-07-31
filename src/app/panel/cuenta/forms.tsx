"use client";

import { useActionState } from "react";

import {
  cambiarContrasena,
  guardarMisDatos,
  type EstadoCuenta,
} from "@/app/panel/cuenta/actions";

const etiqueta =
  "block text-xs font-semibold tracking-[0.14em] text-ink uppercase";

const campo =
  "mt-2 w-full rounded-lg border border-transparent bg-ink/[0.03] px-4 py-3 text-ink transition-[background-color,border-color] duration-150 ease-out placeholder:text-ink/30 hover:border-ink/15 focus:border-ink focus:bg-surface focus:outline-none";

const boton =
  "mt-6 w-full rounded-lg border border-ink/20 px-6 py-3.5 text-xs font-semibold tracking-[0.08em] text-ink uppercase transition-colors duration-150 ease-out hover:border-ink hover:bg-ink hover:text-surface active:opacity-90 disabled:cursor-wait disabled:opacity-60 sm:w-auto";

function Aviso({ estado }: { estado: EstadoCuenta }) {
  if (estado.error) {
    return (
      <p
        role="alert"
        className="mt-4 rounded-lg border-l-2 border-accent bg-accent/[0.06] px-4 py-3 text-sm text-ink"
      >
        {estado.error}
      </p>
    );
  }
  if (estado.ok) {
    return (
      <p role="status" className="mt-4 text-sm text-muted">
        {estado.ok}
      </p>
    );
  }
  return null;
}

export function MisDatosForm({
  displayName,
  phone,
}: {
  displayName: string;
  phone: string | null;
}) {
  const [estado, accion, pendiente] = useActionState<EstadoCuenta, FormData>(
    guardarMisDatos,
    {},
  );

  return (
    <form action={accion} className="card mt-4 px-5 py-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="display_name" className={etiqueta}>
            Nombre
          </label>
          <input
            id="display_name"
            name="display_name"
            type="text"
            autoComplete="name"
            defaultValue={displayName}
            className={campo}
          />
          <p className="mt-2 text-sm text-muted">
            Es el que ven los clientes al elegir barbero.
          </p>
        </div>

        <div>
          <label htmlFor="phone" className={etiqueta}>
            Teléfono
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            defaultValue={phone ?? ""}
            placeholder="099 123 456"
            className={campo}
          />
          <p className="mt-2 text-sm text-muted">
            Para el equipo. No se muestra en la página.
          </p>
        </div>
      </div>

      <Aviso estado={estado} />

      <button type="submit" disabled={pendiente} className={boton}>
        {pendiente ? "Guardando…" : "Guardar"}
      </button>
    </form>
  );
}

export function ContrasenaForm() {
  const [estado, accion, pendiente] = useActionState<EstadoCuenta, FormData>(
    cambiarContrasena,
    {},
  );

  return (
    <form action={accion} className="card mt-4 px-5 py-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="password" className={etiqueta}>
            Contraseña nueva
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="mínimo 8 caracteres"
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
            className={campo}
          />
        </div>
      </div>

      <Aviso estado={estado} />

      <button type="submit" disabled={pendiente} className={boton}>
        {pendiente ? "Guardando…" : "Cambiar contraseña"}
      </button>
    </form>
  );
}
