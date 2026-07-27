"use client";

import { useActionState } from "react";

import { reservar, type EstadoReserva } from "@/app/reservar/actions";

const CAMPOS = [
  {
    name: "nombre",
    label: "Nombre",
    type: "text",
    autoComplete: "name",
    placeholder: "Como te dice el barbero",
    inputMode: undefined,
  },
  {
    name: "telefono",
    label: "Teléfono",
    type: "tel",
    autoComplete: "tel",
    placeholder: "099 123 456",
    inputMode: "tel" as const,
  },
  {
    name: "email",
    label: "Mail",
    type: "email",
    autoComplete: "email",
    placeholder: "vos@ejemplo.com",
    inputMode: "email" as const,
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

  return (
    <form action={accion} className="mt-8">
      <input type="hidden" name="fecha" value={fecha} />
      <input type="hidden" name="hora" value={hora} />
      <input type="hidden" name="serviceId" value={serviceId} />
      <input type="hidden" name="barberId" value={barberId} />

      <div className="space-y-5">
        {CAMPOS.map((campo) => (
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
              required
              defaultValue={
                estado.valores?.[campo.name as keyof typeof estado.valores] ?? ""
              }
              className="mt-2 w-full border border-ink/20 bg-surface px-4 py-3 text-[15px] text-ink transition-colors duration-150 ease-out placeholder:text-ink/30 hover:border-ink/40 focus:border-ink focus:outline-none"
            />
          </div>
        ))}
      </div>

      <p className="mt-5 text-sm leading-relaxed text-muted">
        El mail es para mandarte la confirmación y el link para cancelar. El
        teléfono, por si el barbero necesita avisarte algo.
      </p>

      {estado.error ? (
        <p
          role="alert"
          className="mt-5 border-l-2 border-accent bg-surface px-4 py-3 text-sm text-ink"
        >
          {estado.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pendiente}
        className="mt-6 w-full bg-accent px-6 py-4 text-sm font-semibold tracking-[0.08em] text-surface uppercase transition-colors duration-150 ease-out hover:bg-ink active:bg-ink/90 disabled:cursor-wait disabled:opacity-60"
      >
        {pendiente ? "Reservando…" : "Reservar turno"}
      </button>
    </form>
  );
}
