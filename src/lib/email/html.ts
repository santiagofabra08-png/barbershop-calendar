/**
 * Lo poco de HTML que comparten los mails.
 *
 * Los clientes de correo son de 2005: nada de flexbox ni de grid, todo con
 * tablas y estilos en línea. Lo único que se comparte de verdad es esto, y
 * está acá para que no haya dos versiones del escape con reglas distintas.
 */

/**
 * El nombre de una clienta puede traer `<`, y una barbería puede llamarse
 * "Pelo & Barba". Sin esto, el mail sale roto o con un pedazo de markup a la
 * vista.
 */
export function escapar(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
