/**
 * Quién firma el mail.
 *
 * Un mail tiene dos cosas distintas en el remitente: la **dirección**, que
 * tiene que pertenecer al dominio verificado en Resend, y el **nombre**, que
 * es lo único que la mayoría de la gente ve en la bandeja de entrada.
 *
 * `RESEND_FROM` traía las dos pegadas, así que el nombre de una barbería
 * quedaba escrito en la configuración del servidor. Resultado: Barbería
 * Central mandaba sus confirmaciones firmadas "Tropi Barbershop". Es
 * exactamente lo que prohíbe la regla de no hardcodear un tenant, solo que
 * escondido en una variable de entorno en vez de en el código.
 *
 * Acá se separan: la dirección sigue saliendo del entorno, porque es la que
 * está verificada y no puede inventarse; el nombre sale del tenant.
 *
 * Puro, para poder probarlo sin mandar un mail.
 */

/** De `Nombre <mail@dominio>` saca `mail@dominio`. Sin nombre, lo devuelve tal cual. */
export function direccionDe(from: string): string {
  const entreAngulos = from.match(/<([^>]+)>/);
  return (entreAngulos ? entreAngulos[1] : from).trim();
}

/**
 * El remitente completo, con el nombre de la barbería adelante.
 *
 * El nombre lo escribe el dueño desde Ajustes, así que entra a una cabecera de
 * mail texto que no controlamos. Los saltos de línea se sacan **sin
 * excepción**: una cabecera se termina con un salto de línea, y un nombre que
 * traiga uno puede agregar cabeceras propias —un `Bcc:` a donde quiera, por
 * ejemplo—. Las comillas y la barra invertida se sacan porque romperían el
 * entrecomillado y dejarían la dirección mal armada.
 */
export function remitenteDe(nombre: string, from: string): string {
  const direccion = direccionDe(from);

  const limpio = nombre
    .replace(/[\r\n]+/g, " ")
    .replace(/["\\]/g, "")
    .trim();

  // Sin nombre usable, la dirección sola es un remitente válido. Mejor eso que
  // un par de comillas vacías, que algunos clientes muestran literalmente.
  if (limpio === "") return direccion;

  return `"${limpio}" <${direccion}>`;
}
