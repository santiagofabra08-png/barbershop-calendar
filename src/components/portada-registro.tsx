"use client";

import { useActionState } from "react";

import { pedirLaPrueba, type EstadoSolicitud } from "@/app/portada-actions";

/**
 * Dejar los datos para arrancar la prueba.
 *
 * Reemplaza al botón que abría WhatsApp directo. No porque WhatsApp esté mal
 * —sigue estando, más abajo— sino porque escribirle por WhatsApp a un
 * desconocido es un paso que mucha gente no da, y en tráfico frío desde
 * Instagram eso es la mayoría.
 *
 * Cuatro campos y nada más. Cada campo de más es gente que abandona a la mitad,
 * y todo lo demás —servicios, horarios, precios— se pregunta después, cuando ya
 * hay una conversación empezada.
 */

const campo = [
  "mt-2 w-full rounded-lg border px-4 py-3.5",
  "bg-[color:var(--tiza)] text-[color:var(--esmalte)]",
  "border-[color:var(--vidrio)]",
  "transition-[border-color,box-shadow] duration-150",
  "placeholder:text-[color:color-mix(in_oklab,var(--esmalte)_35%,transparent)]",
  "hover:border-[color:color-mix(in_oklab,var(--esmalte)_35%,transparent)]",
  "focus:border-[color:var(--barbicide)] focus:outline-none",
].join(" ");

const etiqueta =
  "block text-xs font-semibold uppercase tracking-[0.14em] text-[color:color-mix(in_oklab,var(--esmalte)_65%,transparent)]";

function Error({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-2 text-sm text-[color:var(--barbicide)]">{children}</p>
  );
}

export function Registro({ dias }: { dias: number }) {
  const [estado, accion, pendiente] = useActionState<EstadoSolicitud, FormData>(
    pedirLaPrueba,
    { ok: false },
  );

  // Lo que se promete acá tiene que ser lo que pasa después. No dice "tu
  // barbería está lista": dice que alguien va a escribir, que es lo que va a
  // ocurrir de verdad.
  if (estado.ok) {
    return (
      <div className="cuaderno p-6 text-center sm:p-8">
        <p className="font-[family-name:var(--font-cartel)] text-2xl tracking-tight">
          Listo.
        </p>
        <p className="mt-3 leading-relaxed text-[color:color-mix(in_oklab,var(--esmalte)_72%,transparent)]">
          Te escribo hoy mismo por WhatsApp. Dejamos tu barbería andando en un
          rato y te paso la dirección para que la compartas.
        </p>
      </div>
    );
  }

  return (
    <form action={accion} className="cuaderno p-6 sm:p-8" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="barberia" className={etiqueta}>
            Tu barbería
          </label>
          <input
            id="barberia"
            name="barberia"
            autoComplete="organization"
            placeholder="Barbería Modelo"
            className={campo}
          />
          {estado.errores?.barberia ? (
            <Error>{estado.errores.barberia}</Error>
          ) : null}
        </div>

        <div>
          <label htmlFor="nombre" className={etiqueta}>
            Tu nombre
          </label>
          <input
            id="nombre"
            name="nombre"
            autoComplete="name"
            placeholder="Andrés"
            className={campo}
          />
          {estado.errores?.nombre ? <Error>{estado.errores.nombre}</Error> : null}
        </div>

        <div>
          <label htmlFor="telefono" className={etiqueta}>
            Teléfono
          </label>
          <input
            id="telefono"
            name="telefono"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="099 123 456"
            className={campo}
          />
          {estado.errores?.telefono ? (
            <Error>{estado.errores.telefono}</Error>
          ) : null}
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="email" className={etiqueta}>
            Mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="vos@gmail.com"
            className={campo}
          />
          {estado.errores?.email ? <Error>{estado.errores.email}</Error> : null}
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="mensaje" className={etiqueta}>
            Algo que quieras contar{" "}
            <span className="font-normal normal-case tracking-normal">
              (opcional)
            </span>
          </label>
          <textarea
            id="mensaje"
            name="mensaje"
            rows={3}
            placeholder="Somos tres barberos y abrimos de martes a sábado."
            className={campo + " resize-y"}
          />
        </div>
      </div>

      {estado.falla ? (
        <p
          role="alert"
          className="mt-6 rounded-lg border-l-2 border-[color:var(--barbicide)] bg-[color:color-mix(in_oklab,var(--barbicide)_7%,transparent)] px-4 py-3 text-sm"
        >
          {estado.falla}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pendiente}
        className="mt-7 w-full rounded-lg bg-[color:var(--barbicide)] px-6 py-4 text-base font-semibold text-[color:var(--tiza)] transition-[background-color,transform] duration-150 hover:-translate-y-px hover:bg-[color:var(--esmalte)] active:translate-y-0 active:bg-[color:var(--esmalte)] disabled:cursor-wait disabled:opacity-60"
      >
        {pendiente ? "Mandando…" : `Empezar los ${dias} días gratis`}
      </button>

      <p className="mt-4 text-center text-sm text-[color:color-mix(in_oklab,var(--esmalte)_60%,transparent)]">
        Sin tarjeta. Te escribo yo y la dejamos andando el mismo día.
      </p>
    </form>
  );
}
