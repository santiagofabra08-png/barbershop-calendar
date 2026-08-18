"use client";

import { useEffect, useRef, useState } from "react";

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
  const [recordatorio, setRecordatorio] = useState<string | null>(null);
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

      const d = e.data as { tipo?: unknown; mensaje?: unknown } | null;
      if (!d || d.tipo !== AVISO_RESERVA || typeof d.mensaje !== "string") return;

      setRecordatorio(d.mensaje);
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
        {recordatorio !== null ? <YaEstá mensaje={recordatorio} /> : null}
      </div>
    </div>
  );
}

/**
 * Lo que pasa del otro lado del mostrador, con el turno que acaba de sacar.
 *
 * El mensaje **no está escrito acá**: lo calculó la barbería con la misma
 * función que usa el panel de verdad, y viajó desde adentro del iframe.
 * Escribir un ejemplo a mano se vería igual hoy y empezaría a mentir el día que
 * el mensaje cambie, sin que nadie se entere.
 */
function YaEstá({ mensaje }: { mensaje: string }) {
  return (
    <div className="revelado mt-10 border-t border-[color:var(--vidrio)] pt-8">
      <p className="text-xs font-semibold tracking-[0.18em] text-[color:var(--barbicide)] uppercase">
        Y del otro lado del mostrador
      </p>

      <h3 className="mt-3 font-[family-name:var(--font-cartel)] text-2xl leading-tight tracking-tight sm:text-3xl">
        Ese turno ya está en la agenda del barbero.
      </h3>

      <p className="mt-4 max-w-xl leading-relaxed text-[color:color-mix(in_oklab,var(--esmalte)_72%,transparent)]">
        No tuvo que anotar nada. Y cuando quiera recordártelo, toca un botón y
        WhatsApp se le abre con esto ya escrito:
      </p>

      <div className="burbuja mt-5">
        {mensaje.split("\n").map((linea, i) => (
          <p key={i}>{linea}</p>
        ))}
      </div>

      <p className="mt-5 max-w-xl text-sm text-[color:color-mix(in_oklab,var(--esmalte)_55%,transparent)]">
        Fijate también en tu correo: la confirmación ya te llegó, con la marca
        de la barbería y el link para cancelar. Eso es todo lo que hace falta
        para que un cliente reserve y no falte.
      </p>
    </div>
  );
}
