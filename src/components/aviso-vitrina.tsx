"use client";

import { useEffect } from "react";

import { AVISO_RESERVA } from "@/lib/demo";

/**
 * Le avisa a la portada que alguien acaba de reservar acá adentro.
 *
 * La demo está incrustada en la página de ventas, y hasta ahora la historia
 * terminaba en "turno confirmado". Eso deja al visitante viendo la mitad que
 * él nunca va a usar: la del cliente. Lo que está evaluando es la otra.
 *
 * Con esto, la portada puede mostrar en ese mismo momento lo que su barbero
 * haría con ese turno. La cadena entera —reservó solo, le aparece al barbero,
 * el barbero le recuerda— se entiende sin leer una palabra de explicación.
 *
 * Tres cuidados:
 *
 *   · **Solo dentro de un iframe.** Fuera, no hay a quién avisarle.
 *   · **Destino explícito, nunca `"*"`.** Solo la portada recibe el mensaje,
 *     aunque otro sitio incruste la demo.
 *   · **No cambia nada de lo que se ve.** La demo tiene que seguir siendo la
 *     página de verdad y no una versión preparada para la vidriera; si esto
 *     dibujara algo, ya sería otra página.
 */
export function AvisoVitrina({
  mensaje,
  destinos,
}: {
  /** El recordatorio ya escrito, tal como se lo mandaría el barbero. */
  mensaje: string;
  /** Orígenes donde puede estar la portada. Vacío: no se avisa. */
  destinos: string[];
}) {
  // Se manda a los dos posibles —con y sin `www`— porque el que no coincide no
  // entrega y no hace ruido. Ver `origenesDeLaPortada`.
  const aDonde = destinos.join(" ");

  useEffect(() => {
    if (aDonde === "") return;
    if (window.parent === window) return;

    for (const destino of aDonde.split(" ")) {
      window.parent.postMessage({ tipo: AVISO_RESERVA, mensaje }, destino);
    }
  }, [mensaje, aDonde]);

  return null;
}
