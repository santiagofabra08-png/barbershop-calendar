"use client";

import { useState } from "react";

/**
 * La barbería de demostración, incrustada y funcionando.
 *
 * El conmutador celular/computadora no es un adorno: la mayoría de los dueños
 * de barbería asume que "una página de reservas" es una app de teléfono y nada
 * más. Que puedan pasar de un aparato al otro y ver la misma barbería
 * acomodarse sola contesta esa duda sin escribirla, y de paso muestra la única
 * función que no se puede fotografiar —que es la misma página en cualquier
 * pantalla—.
 *
 * El iframe no se vuelve a montar al cambiar de modo: cambia el tamaño del
 * marco y nada más. Si se recargara, la persona perdería el servicio y el
 * horario que había elegido, justo cuando estaba entendiendo cómo funciona.
 */

type Modo = "celular" | "computadora";

const MODOS: { id: Modo; texto: string }[] = [
  { id: "celular", texto: "Celular" },
  { id: "computadora", texto: "Computadora" },
];

export function Demo({ url, dominio }: { url: string; dominio: string }) {
  const [modo, setModo] = useState<Modo>("celular");
  const enCelular = modo === "celular";

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm text-[color:color-mix(in_oklab,var(--esmalte)_55%,transparent)]">
          Verla en
        </span>

        {MODOS.map((m) => {
          const activo = m.id === modo;
          return (
            <button
              key={m.id}
              type="button"
              aria-pressed={activo}
              onClick={() => setModo(m.id)}
              className={
                "rounded-lg px-4 py-2 text-sm font-semibold " +
                (activo
                  ? "bg-[color:var(--barbicide)] text-[color:var(--tiza)]"
                  : "bg-[color:var(--porcelana)] text-[color:color-mix(in_oklab,var(--esmalte)_65%,transparent)] hover:text-[color:var(--esmalte)]")
              }
            >
              {m.texto}
            </button>
          );
        })}
      </div>

      <div
        className={
          "mt-6 transition-[max-width] duration-300 ease-out " +
          (enCelular ? "mx-auto max-w-[23rem]" : "max-w-none")
        }
      >
        {/*
          En computadora se dibuja una barra de direcciones. No es decoración:
          ahí se lee el subdominio de la barbería, que es justo lo que la
          sección de más abajo afirma con palabras. Verlo escrito en una barra
          de navegador lo explica mejor que una frase.
        */}
        {!enCelular ? (
          <div className="barra-navegador">
            <span className="punto" aria-hidden />
            <span className="punto" aria-hidden />
            <span className="punto" aria-hidden />
            <span className="direccion">demo.{dominio}</span>
          </div>
        ) : null}

        <div className={enCelular ? "marco-demo" : "marco-escritorio"}>
          <iframe
            // `vitrina=1` solo esconde la barra de scroll del navegador, que
            // cruzando el costado del teléfono dibujado arruina la ilusión.
            // Nada más cambia: tiene que ser la página de verdad.
            src={`${url}?vitrina=1`}
            title="Barbería de demostración: página de reservas"
            loading="lazy"
          />
        </div>
      </div>
    </div>
  );
}
