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
