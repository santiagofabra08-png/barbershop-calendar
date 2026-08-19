"use client";

import { useSyncExternalStore } from "react";

import { OtroLado } from "@/components/otro-lado";

/**
 * La franja explicativa al pie de la barbería demo.
 *
 * ⚠️ **Solo la barbería demo.** La página del turno es la misma para todas: sin
 * esa condición, un cliente de un local que paga vería material de ventas en su
 * confirmación. Quien decide es la página, mirando el slug.
 *
 * Por qué existe: el link de la demo se comparte suelto, en frío, y quien lo
 * abre así ve la mitad del cliente y nada más. Justo la mitad que no está
 * evaluando. Acá abajo del turno aparece la otra, con el turno que él mismo
 * acaba de sacar.
 *
 * **Adentro de la portada no se dibuja.** Ahí la demo va incrustada y la
 * portada ya muestra este mismo bloque afuera del teléfono, donde se lee: si
 * además apareciera adentro, sería la misma cosa dos veces, y la de adentro
 * quedaría escondida al fondo de un marco de 23rem.
 *
 * La señal es la misma que usa `AvisoVitrina`, invertida: aquel habla si está
 * dentro de un iframe, este dibuja si no lo está. Una sola regla, los dos
 * lados. No se puede decidir en el servidor porque el turno se llega navegando
 * y el `?vitrina=1` del iframe queda en la página anterior.
 */
export function FranjaDemo({
  mensaje,
  barberia,
  urlPortada,
}: {
  /** El recordatorio ya escrito, tal como se lo mandaría el barbero. */
  mensaje: string;
  /** El nombre de la barbería demo. Nunca escrito a mano: llega como dato. */
  barberia: string;
  /** La portada del producto. Vacío: no se ofrece el link. */
  urlPortada: string;
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

  if (!suelta) return null;

  return (
    <section className="franja-producto paleta-producto px-5 py-14 sm:px-8 sm:py-20">
      <div className="mx-auto w-full max-w-lg">
        <OtroLado mensaje={mensaje} />

        <div className="mt-9 border-t border-[color:var(--vidrio)] pt-7">
          <p className="text-sm leading-relaxed text-[color:color-mix(in_oklab,var(--esmalte)_65%,transparent)]">
            <strong className="font-semibold text-[color:var(--esmalte)]">
              {barberia}
            </strong>{" "}
            no existe: es la barbería de demostración de Turnos for Barber, el
            sistema de reservas con el que acabás de sacar este turno.
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
  );
}
