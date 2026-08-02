"use client";

import { useActionState, useEffect, useState } from "react";

import { guardarLogos, type EstadoAjustes } from "@/app/panel/ajustes/actions";
import { LOGO, accept, revisarArchivo } from "@/lib/panel/imagen";

/**
 * Los dos logos.
 *
 * A diferencia de una foto de producto, acá no se toca el archivo: un SVG es un
 * dibujo, no una foto, y pasarlo por un canvas lo convertiría en píxeles —justo
 * lo que lo hace bueno—. Un PNG con transparencia tampoco sobreviviría el
 * recorte. Se sube tal cual y se valida formato y peso, nada más.
 *
 * Cada uno se ve sobre el fondo que le toca. Es la única forma de saber si
 * sirve: un logo negro se ve perfecto en esta pantalla y desaparece en la
 * franja del encabezado.
 */
export function LogoForm({
  claroActual,
  oscuroActual,
  nombre,
}: {
  claroActual: string | null;
  oscuroActual: string | null;
  nombre: string;
}) {
  const [estado, enviar, pendiente] = useActionState<EstadoAjustes, FormData>(
    guardarLogos,
    {},
  );

  return (
    <form action={enviar} className="mt-4">
      <div className="card space-y-6 px-5 py-5">
        <p className="max-w-prose text-sm text-muted">{LOGO.ayuda}</p>

        <div className="grid gap-6 sm:grid-cols-2">
          <Uno
            cual="oscuro"
            titulo="Para el encabezado"
            explicacion="Va sobre la franja negra de arriba. Tiene que ser claro."
            actual={oscuroActual}
            fondo="oscuro"
            nombre={nombre}
          />
          <Uno
            cual="claro"
            titulo="Para fondo claro"
            explicacion="Se usa en mails y donde el fondo es claro. Tiene que ser oscuro."
            actual={claroActual}
            fondo="claro"
            nombre={nombre}
          />
        </div>
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

      <button
        type="submit"
        disabled={pendiente}
        className="mt-4 w-full rounded-lg bg-accent px-6 py-4 text-sm font-semibold tracking-[0.08em] text-surface uppercase transition-colors duration-150 ease-out hover:bg-ink active:bg-ink/90 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
      >
        {pendiente ? "Guardando…" : "Guardar el logo"}
      </button>
    </form>
  );
}

function Uno({
  cual,
  titulo,
  explicacion,
  actual,
  fondo,
  nombre,
}: {
  cual: "claro" | "oscuro";
  titulo: string;
  explicacion: string;
  actual: string | null;
  fondo: "claro" | "oscuro";
  nombre: string;
}) {
  const [elegido, setElegido] = useState<string | null>(null);
  const [quitado, setQuitado] = useState(false);
  const [problema, setProblema] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (elegido) URL.revokeObjectURL(elegido);
    };
  }, [elegido]);

  function elegir(archivo: File | undefined) {
    if (!archivo) return;
    const malo = revisarArchivo(archivo.type, archivo.size, LOGO);
    setProblema(malo);
    if (malo) return;

    setElegido((previo) => {
      if (previo) URL.revokeObjectURL(previo);
      return URL.createObjectURL(archivo);
    });
    setQuitado(false);
  }

  const mostrando = elegido ?? (quitado ? null : actual);

  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.14em] text-ink uppercase">
        {titulo}
      </p>
      <p className="mt-1 text-sm text-muted">{explicacion}</p>

      {quitado ? <input type="hidden" name={`quitar_${cual}`} value="1" /> : null}

      <div
        className={[
          "mt-3 flex h-28 items-center justify-center rounded-xl px-4",
          fondo === "oscuro" ? "bg-ink" : "border border-ink/10 bg-surface",
        ].join(" ")}
      >
        {mostrando ? (
          // Un <img> y no next/image: acá entra un SVG recién elegido con una
          // URL de memoria, que el optimizador no puede tocar.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mostrando}
            alt={`Logo de ${nombre}`}
            className="max-h-20 w-auto max-w-full"
          />
        ) : (
          <span
            className={[
              "text-xs font-medium",
              fondo === "oscuro" ? "text-bg/40" : "text-ink/30",
            ].join(" ")}
          >
            Sin logo
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input
          id={`logo-${cual}`}
          type="file"
          name={`logo_${cual}`}
          accept={accept(LOGO)}
          onChange={(e) => elegir(e.target.files?.[0])}
          className="peer sr-only"
        />
        <label
          htmlFor={`logo-${cual}`}
          className="cursor-pointer rounded-lg border border-ink/20 px-4 py-2 text-xs font-semibold tracking-[0.06em] text-ink uppercase transition-colors duration-150 ease-out hover:border-ink hover:bg-ink hover:text-surface active:opacity-90 peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface"
        >
          {mostrando ? "Cambiar" : "Elegir archivo"}
        </label>

        {mostrando ? (
          <button
            type="button"
            onClick={() => {
              if (elegido) URL.revokeObjectURL(elegido);
              setElegido(null);
              setQuitado(true);
              setProblema(null);
            }}
            className="rounded-lg px-2 py-1 text-sm font-medium text-muted transition-colors duration-150 ease-out hover:bg-ink/[0.05] hover:text-ink active:bg-ink/[0.09]"
          >
            Quitar
          </button>
        ) : null}
      </div>

      {problema ? (
        <p role="alert" className="mt-2 text-sm font-medium text-accent">
          {problema}
        </p>
      ) : null}
    </div>
  );
}
