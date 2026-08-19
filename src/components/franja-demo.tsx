"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { OtroLado } from "@/components/otro-lado";
import { SecuenciaDemo } from "@/components/secuencia-demo";

/**
 * La franja explicativa al pie de la barbería demo, y la barra que lleva hasta
 * ella.
 *
 * ⚠️ **Solo la barbería demo.** La página del turno y la de reservas son las
 * mismas para todas: sin esa condición, un cliente de un local que paga vería
 * material de ventas en su confirmación. Quien decide es la página, mirando el
 * slug.
 *
 * Por qué existe: el link de la demo se comparte suelto, en frío, y quien lo
 * abre así ve la mitad del cliente y nada más. Justo la mitad que no está
 * evaluando. Acá abajo aparece la otra, en tres pasos.
 *
 * Está en las dos pantallas de la demo y no solo después de reservar, porque
 * quien abre ese link puede no reservar nunca: mirar los horarios y cerrar es
 * lo más probable. En la página de reservas el turno del ejemplo sale de un
 * horario libre de verdad; en la del turno, del turno que la persona sacó.
 *
 * **Adentro de la portada no se dibuja.** Ahí la demo va incrustada y la
 * portada ya muestra el bloque afuera del teléfono, donde se lee: si además
 * apareciera adentro, sería la misma cosa dos veces, y la de adentro quedaría
 * escondida al fondo de un marco de 23rem.
 *
 * La señal es la misma que usa `AvisoVitrina`, invertida: aquel habla si está
 * dentro de un iframe, este dibuja si no lo está. Una sola regla, los dos
 * lados. No se puede decidir en el servidor porque al turno se llega navegando
 * y el `?vitrina=1` del iframe queda en la página anterior.
 */
export function FranjaDemo({
  cliente,
  mensaje,
  barberia,
  urlPortada,
  propio = false,
}: {
  /** Cómo lo tiene guardado el barbero: el nombre del contacto en el chat. */
  cliente: string;
  /** El recordatorio ya escrito, tal como se lo mandaría el barbero. */
  mensaje: string;
  /** El nombre de la barbería demo. Nunca escrito a mano: llega como dato. */
  barberia: string;
  /** La portada del producto. Vacío: no se ofrece el link. */
  urlPortada: string;
  /** Si el turno es el que esta persona acaba de sacar, o uno de ejemplo. */
  propio?: boolean;
}) {
  /*
   * Estar o no adentro de un iframe no es estado de React: es un dato del
   * navegador que no cambia nunca durante la vida de la página. Por eso se lee
   * con `useSyncExternalStore` y no con un efecto que escribe estado.
   *
   * El tercer argumento es lo que vale en el servidor: `false`, o sea nada
   * dibujado. Así el HTML y el primer render del cliente dicen lo mismo y la
   * franja aparece recién cuando React ya sabe dónde está parado.
   */
  const suelta = useSyncExternalStore(
    () => () => {},
    () => window.parent === window,
    () => false,
  );

  const franja = useRef<HTMLElement>(null);
  const [llego, setLlego] = useState(false);

  /*
   * Si nadie avisa que hay algo abajo, nadie baja.
   *
   * Y acá "abajo" es lejos: medido en un teléfono de 390×844, la franja empieza
   * a 1133px, o sea 289px pasado el corte de pantalla y detrás del pie entero
   * del local, con dirección y horarios. En uno de 360×740 son 450px. La
   * persona ve "turno confirmado", agenda el recordatorio y cierra. Es lo
   * correcto de su parte: ya hizo lo que vino a hacer.
   *
   * Por eso la barra, que no depende del alto de la pantalla ni del largo del
   * pie: está siempre a la vista hasta que la franja aparece, y entonces se va
   * sola porque ya no tiene nada que anunciar.
   */
  useEffect(() => {
    const el = franja.current;
    if (!el) return;

    const ojo = new IntersectionObserver(
      ([e]) => setLlego(e.isIntersecting),
      // Un cachito visible ya cuenta: para cuando se ve el título, la barra
      // sobra y taparía justo lo que vino a mostrar.
      { rootMargin: "0px 0px -25% 0px" },
    );

    ojo.observe(el);
    return () => ojo.disconnect();
  }, [suelta]);

  const bajar = useCallback(() => {
    // Quien pidió menos movimiento llega igual, de un salto: el recorrido es
    // largo y verlo pasar es justo lo que le hace mal.
    const quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    franja.current?.scrollIntoView({
      behavior: quieto ? "auto" : "smooth",
      block: "start",
    });
  }, []);

  if (!suelta) return null;

  return (
    <>
      <section
        ref={franja}
        className="franja-producto paleta-producto px-5 py-11 sm:px-8 sm:py-20"
      >
        <div className="mx-auto w-full max-w-lg">
          <OtroLado
            titulo={
              propio
                ? "Ese turno ya está en la agenda del barbero."
                : "Así llega un turno al barbero."
            }
          >
            <p className="mt-4 max-w-xl leading-relaxed text-[color:color-mix(in_oklab,var(--esmalte)_72%,transparent)]">
              {propio
                ? "Nadie tuvo que anotar nada. Del cliente al mensaje, esto es todo lo que pasó:"
                : "Nadie anota nada. Del cliente al mensaje, esto es todo lo que pasa:"}
            </p>

            <div className="mt-6">
              <SecuenciaDemo cliente={cliente} mensaje={mensaje} />
            </div>

            {propio ? (
              <p className="mt-6 text-sm text-[color:color-mix(in_oklab,var(--esmalte)_55%,transparent)]">
                La confirmación también te llegó por mail.
              </p>
            ) : null}
          </OtroLado>

          <div className="mt-9 border-t border-[color:var(--vidrio)] pt-7">
            <p className="text-sm leading-relaxed text-[color:color-mix(in_oklab,var(--esmalte)_65%,transparent)]">
              <strong className="font-semibold text-[color:var(--esmalte)]">
                {barberia}
              </strong>{" "}
              no existe: es la demo de Turnos for Barber.
            </p>

            {urlPortada !== "" ? (
              <a
                href={urlPortada}
                className="mt-5 inline-flex items-center justify-center rounded-lg bg-[color:var(--barbicide)] px-6 py-3.5 text-sm font-semibold text-[color:var(--tiza)] hover:bg-[color:var(--esmalte)] active:bg-[color:var(--esmalte)]"
              >
                Ver cómo funciona
              </a>
            ) : null}
          </div>
        </div>
      </section>

      <div
        className={`paleta-producto pico-envoltorio${llego ? " se-fue" : ""}`}
        aria-hidden={llego}
      >
        <button
          type="button"
          onClick={bajar}
          tabIndex={llego ? -1 : undefined}
          className="pico-producto"
        >
          Mirá qué pasa del otro lado
          <svg viewBox="0 0 16 16" fill="none" aria-hidden className="size-4">
            <path
              d="M4 6.5 8 10.5 12 6.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </>
  );
}
