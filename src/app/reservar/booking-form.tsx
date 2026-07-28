"use client";

import { useActionState, useState } from "react";

import { reservar, type EstadoReserva } from "@/app/reservar/actions";
import {
  validarEmail,
  validarNombre,
  validarTelefono,
  type Resultado,
} from "@/lib/validation";

type NombreCampo = "nombre" | "telefono" | "email";

const CAMPOS: {
  name: NombreCampo;
  label: string;
  type: string;
  autoComplete: string;
  placeholder: string;
  inputMode?: "tel" | "email";
  ayuda?: string;
  validar: (v: string) => Resultado;
}[] = [
  {
    name: "nombre",
    label: "Nombre",
    type: "text",
    autoComplete: "name",
    placeholder: "Como te dice el barbero",
    validar: validarNombre,
  },
  {
    name: "telefono",
    label: "Teléfono",
    type: "tel",
    autoComplete: "tel",
    placeholder: "099 123 456",
    inputMode: "tel",
    ayuda: "Celular o fijo, con la característica.",
    validar: validarTelefono,
  },
  {
    name: "email",
    label: "Mail",
    type: "email",
    autoComplete: "email",
    placeholder: "vos@ejemplo.com",
    inputMode: "email",
    ayuda: "Ahí te llega la confirmación y el link para cancelar.",
    validar: validarEmail,
  },
];

export function BookingForm({
  fecha,
  hora,
  serviceId,
  barberId,
}: {
  fecha: string;
  hora: string;
  serviceId: string;
  barberId: string;
}) {
  const [estado, accion, pendiente] = useActionState<EstadoReserva, FormData>(
    reservar,
    {},
  );

  // Se valida al salir de cada campo, no mientras se tipea: marcarle un error
  // a alguien que todavía está escribiendo su mail es antipático.
  const [locales, setLocales] = useState<Partial<Record<NombreCampo, string>>>(
    {},
  );

  const errorDe = (campo: NombreCampo) =>
    locales[campo] ?? estado.errores?.[campo];

  return (
    <form action={accion} className="mt-8" noValidate>
      <input type="hidden" name="fecha" value={fecha} />
      <input type="hidden" name="hora" value={hora} />
      <input type="hidden" name="serviceId" value={serviceId} />
      <input type="hidden" name="barberId" value={barberId} />

      <div className="space-y-5">
        {CAMPOS.map((campo) => {
          const error = errorDe(campo.name);
          const idAyuda = `${campo.name}-ayuda`;

          return (
            <div key={campo.name}>
              <label
                htmlFor={campo.name}
                className="block text-xs font-semibold tracking-[0.14em] text-ink uppercase"
              >
                {campo.label}
              </label>

              <input
                id={campo.name}
                name={campo.name}
                type={campo.type}
                inputMode={campo.inputMode}
                autoComplete={campo.autoComplete}
                placeholder={campo.placeholder}
                defaultValue={estado.valores?.[campo.name] ?? ""}
                aria-invalid={error ? true : undefined}
                aria-describedby={error || campo.ayuda ? idAyuda : undefined}
                onBlur={(e) => {
                  const v = e.currentTarget.value;
                  // Un campo vacío que nunca se tocó no se marca todavía.
                  if (v.trim() === "") {
                    setLocales((p) => ({ ...p, [campo.name]: undefined }));
                    return;
                  }
                  const r = campo.validar(v);
                  setLocales((p) => ({
                    ...p,
                    [campo.name]: r.ok ? undefined : r.error,
                  }));
                }}
                onChange={() => {
                  // Al corregir, el error se va enseguida.
                  if (locales[campo.name]) {
                    setLocales((p) => ({ ...p, [campo.name]: undefined }));
                  }
                }}
                className={[
                  "mt-2 w-full rounded-lg border bg-ink/[0.03] px-4 py-3.5 text-[15px] text-ink",
                  "transition-[background-color,border-color] duration-150 ease-out",
                  "placeholder:text-ink/30 focus:bg-surface focus:outline-none",
                  error
                    ? "border-accent"
                    : "border-transparent hover:border-ink/15 focus:border-ink",
                ].join(" ")}
              />

              {error ? (
                <p id={idAyuda} role="alert" className="mt-2 text-sm text-accent">
                  {error}
                </p>
              ) : campo.ayuda ? (
                <p id={idAyuda} className="mt-2 text-sm text-muted">
                  {campo.ayuda}
                </p>
              ) : null}
            </div>
          );
        })}
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
        {pendiente ? "Reservando…" : "Reservar turno"}
      </button>
    </form>
  );
}
