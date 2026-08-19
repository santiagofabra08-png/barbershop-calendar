"use client";

import { useEffect, useRef, useState } from "react";

import { OtroLado } from "@/components/otro-lado";
import { AVISO_RESERVA } from "@/lib/demo";

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
  const [recordatorio, setRecordatorio] = useState<{
    cliente: string;
    mensaje: string;
  } | null>(null);
  const despues = useRef<HTMLDivElement>(null);
  const enCelular = modo === "celular";

  /*
   * Cuando el visitante reserva ahí adentro, la demo avisa.
   *
   * Hasta acá la demo mostraba la mitad que el visitante nunca va a usar: la
   * del cliente. Lo que está evaluando es la del barbero. Este es el momento
   * exacto para mostrársela, porque el turno del que hablamos es el que él
   * mismo acaba de sacar.
   *
   * El origen se compara siempre. `window` recibe mensajes de cualquiera, así
   * que sin este chequeo cualquier pestaña podría dibujarle texto propio a la
   * página de ventas.
   */
  useEffect(() => {
    let origenDemo: string;
    try {
      origenDemo = new URL(url).origin;
    } catch {
      return;
    }

    function alRecibir(e: MessageEvent) {
      if (e.origin !== origenDemo) return;

      const d = e.data as
        | { tipo?: unknown; cliente?: unknown; mensaje?: unknown }
        | null;
      if (!d || d.tipo !== AVISO_RESERVA) return;
      if (typeof d.mensaje !== "string" || typeof d.cliente !== "string") return;

      setRecordatorio({ cliente: d.cliente, mensaje: d.mensaje });
    }

    window.addEventListener("message", alRecibir);
    return () => window.removeEventListener("message", alRecibir);
  }, [url]);

  // Si lo revelado quedó abajo de la pantalla, no sirve de nada. Se acompaña
  // con un desplazamiento suave y solo en ese caso: mover la página cuando ya
  // se está viendo es marearlo por nada.
  useEffect(() => {
    if (recordatorio === null) return;
    const caja = despues.current?.getBoundingClientRect();
    if (caja && caja.top > window.innerHeight - 80) {
      despues.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [recordatorio]);

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

      <div ref={despues}>
        {recordatorio !== null ? (
          <YaEstá cliente={recordatorio.cliente} mensaje={recordatorio.mensaje} />
        ) : null}
      </div>
    </div>
  );
}

/**
 * El envoltorio de la portada para el bloque compartido.
 *
 * Acá aparece por JavaScript, cuando la demo avisa que alguien reservó, así
 * que entra con `.revelado`: es un momento y se lee como tal. En la página
 * del turno de la demo el mismo bloque está desde el principio y no se anima,
 * porque ahí no pasó nada, ya estaba.
 */
function YaEstá({ cliente, mensaje }: { cliente: string; mensaje: string }) {
  return (
    <div className="revelado mt-10 border-t border-[color:var(--vidrio)] pt-8">
      <OtroLado cliente={cliente} mensaje={mensaje} />
    </div>
  );
}
