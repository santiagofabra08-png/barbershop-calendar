import "../app/producto.css";

/**
 * El marco de lo que decimos nosotros del otro lado del mostrador.
 *
 * Se usa en dos lugares, y por eso vive acá y no adentro de ninguno de los dos:
 *
 *   · En la **portada**, debajo de la demo incrustada, cuando el visitante
 *     reserva ahí adentro y la demo avisa. Ahí adentro va el chat solo: la
 *     página de ventas ya explica el resto por su cuenta, arriba y abajo.
 *   · En la **barbería demo**, para el que llegó por el link suelto y nunca vio
 *     la portada. Ese link se comparte en frío, y esa persona no tiene ninguna
 *     otra explicación a mano: ahí adentro va la secuencia entera.
 *
 * Lo que comparten es esto —el rótulo y el título— más `ChatDeWhatsApp`, que es
 * la pieza que no puede diferir de un lado al otro. El cuerpo lo pone cada
 * lugar, porque no tienen el mismo trabajo que hacer.
 *
 * Módulo neutral: sin `"use client"` ni nada de servidor, porque lo importan
 * los dos lados.
 */
export function OtroLado({
  titulo,
  children,
}: {
  /** Una sola frase. Cambia si el turno es de la persona o es un ejemplo. */
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <p className="text-xs font-semibold tracking-[0.18em] text-[color:var(--barbicide)] uppercase">
        Y del otro lado del mostrador
      </p>

      <h3 className="titulo-producto mt-3 text-2xl leading-tight sm:text-3xl">
        {titulo}
      </h3>

      {children}
    </>
  );
}
