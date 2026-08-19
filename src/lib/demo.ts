/**
 * Cuál es la barbería que se muestra incrustada en la portada.
 *
 * Vive acá, y no en `scripts/`, porque la necesitan tres lugares que no se
 * hablan entre sí: la portada para armar la dirección del iframe, la tarea
 * diaria que la vacía, y los scripts que la crean y le sacan las fotos. Si el
 * slug estuviera escrito en cada uno, el día que cambie quedan dos apuntando a
 * una barbería que ya no existe —y el síntoma sería una portada con un hueco,
 * o peor, una tarea que borra los turnos de otro local—.
 *
 * Módulo neutral: sin `"use client"` ni nada de servidor, para que lo puedan
 * importar los dos lados y también los scripts.
 */

export const SLUG_DEMO = "demo";

/**
 * Vaciar la demo significa **borrar todos sus turnos**, sin distinguir los que
 * se sembraron para las fotos de los que dejó un visitante curioso.
 *
 * Eso solo es aceptable para esta barbería, y por dos razones: no hay nada
 * valioso adentro, y un turno de un curioso ocupa un horario que el próximo
 * visitante necesita encontrar libre. La demo sin huecos no demuestra nada.
 *
 * Nunca correr un borrado así contra una barbería de verdad. Por eso el filtro
 * por `tenant_id` no es opcional en ninguna de las dos implementaciones —la de
 * la tarea diaria y la del script de capturas—: ese `eq` es lo único que separa
 * "vaciar la demo" de "borrarle la agenda a un cliente que paga".
 */
export const REGLA_DE_LIMPIEZA =
  "Borra todos los turnos de la demo. Siempre filtrando por tenant_id.";

/**
 * El protocolo que le corresponde al dominio raíz.
 *
 * En desarrollo la demo vive en `demo.lvh.me:3000`, que no tiene certificado.
 * Vivía escrito adentro de la portada, y ahora lo necesita también la página
 * del turno para saber a qué origen puede hablarle. Dos copias de esta regla
 * es una copia de más.
 */
export function protocoloDe(dominioRaiz: string): string {
  return dominioRaiz.includes("localhost") || dominioRaiz.includes("lvh.me")
    ? "http"
    : "https";
}

/**
 * Los orígenes donde puede estar viviendo la portada.
 *
 * Son dos y no uno, y eso lo enseñó producción: el dominio pelado redirige a
 * `www`, así que la página de ventas se sirve en `https://www.dominio` mientras
 * la variable de entorno dice `dominio` a secas. Como `postMessage` compara el
 * origen entero, el mensaje salía a un destino que no existía y **el navegador
 * lo descartaba sin decir nada**: ni un error, ni una advertencia, nada.
 *
 * Se mandan los dos. Un `postMessage` a un origen que no coincide no entrega y
 * no hace ruido, así que el que sobra no molesta y el que sirve llega. Es la
 * misma indulgencia que ya tiene `slugFromHost`, que trata `www.dominio` y
 * `dominio` como la misma cosa: la portada.
 *
 * **Nunca `"*"`.** Acá no viaja nada secreto, pero un destino abierto es una
 * costumbre que después se copia a un lugar donde sí importa.
 *
 * Vacío sin dominio configurado, y entonces no se avisa nada.
 */
export function origenesDeLaPortada(dominioRaiz: string): string[] {
  if (dominioRaiz === "") return [];
  const protocolo = protocoloDe(dominioRaiz);
  return [
    `${protocolo}://${dominioRaiz}`,
    `${protocolo}://www.${dominioRaiz}`,
  ];
}

/** El tipo de mensaje que la demo le manda a la portada. */
export const AVISO_RESERVA = "turno-reservado-en-la-demo";

/**
 * La portada del producto, para linkear desde adentro de la demo.
 *
 * Se arma del dominio raíz y no se escribe a mano, por lo mismo que el slug
 * vive acá: en desarrollo la portada está en `http://lvh.me:3000` y en
 * producción en `https://turnosforbarber.com`, y un link fijo manda a la
 * persona a un lugar que no existe en la mitad de los casos.
 *
 * Va al dominio pelado a propósito, aunque en producción redirija a `www`: es
 * la dirección que se dice en voz alta. La redirección la resuelve el
 * navegador sin que nadie la vea. `origenesDeLaPortada` es distinto, y por eso
 * son dos funciones: aquello compara orígenes exactos, donde el `www` decide
 * si el mensaje llega o se descarta en silencio.
 *
 * Vacío sin dominio configurado, y entonces no se ofrece el link.
 */
export function urlDeLaPortada(dominioRaiz: string): string {
  if (dominioRaiz === "") return "";
  return `${protocoloDe(dominioRaiz)}://${dominioRaiz}`;
}
