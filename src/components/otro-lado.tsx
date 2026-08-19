import "../app/producto.css";

/**
 * Lo que pasa del otro lado del mostrador, con el turno que la persona acaba
 * de sacar.
 *
 * Se muestra en dos lugares, y por eso vive acá y no adentro de ninguno de los
 * dos:
 *
 *   · En la **portada**, debajo de la demo incrustada, cuando el visitante
 *     reserva ahí adentro y la demo avisa.
 *   · En la **página del turno de la barbería demo**, para el que llegó por el
 *     link de la demo suelto y nunca vio la portada. Ese link se comparte en
 *     frío, y hasta ahora esa persona veía solo la mitad del cliente.
 *
 * El mensaje **no está escrito acá**: lo calculó la barbería con la misma
 * función que usa el panel de verdad. Un ejemplo escrito a mano se vería igual
 * hoy y empezaría a mentir el día que el mensaje cambie, sin que nadie se
 * entere.
 *
 * **Corto a propósito.** La primera versión explicaba lo mismo en tres párrafos
 * y no la leía nadie: el que llega acá ya reservó, no vino a leer. La burbuja
 * es la prueba y se entiende sola; el texto solo tiene que llevar hasta ella.
 *
 * Módulo neutral: sin `"use client"` ni nada de servidor, porque lo importan
 * los dos lados.
 */
export function OtroLado({ mensaje }: { mensaje: string }) {
  return (
    <>
      <p className="text-xs font-semibold tracking-[0.18em] text-[color:var(--barbicide)] uppercase">
        Y del otro lado del mostrador
      </p>

      <h3 className="titulo-producto mt-3 text-2xl leading-tight sm:text-3xl">
        Ese turno ya está en la agenda del barbero.
      </h3>

      <p className="mt-4 max-w-xl leading-relaxed text-[color:color-mix(in_oklab,var(--esmalte)_72%,transparent)]">
        Nadie tuvo que anotar nada. Para recordártelo, toca un botón y WhatsApp
        se le abre así:
      </p>

      <div className="burbuja mt-5">
        {mensaje.split("\n").map((linea, i) => (
          <p key={i}>{linea}</p>
        ))}
      </div>

      <p className="mt-5 text-sm text-[color:color-mix(in_oklab,var(--esmalte)_55%,transparent)]">
        La confirmación también te llegó por mail.
      </p>
    </>
  );
}
