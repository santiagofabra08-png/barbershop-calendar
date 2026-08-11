/**
 * El mensaje de WhatsApp, ya escrito.
 *
 * El recordatorio es el único trabajo del panel que termina en otra
 * aplicación, y el punto entero es que el dueño no escriba nada: toca, lee que
 * esté bien, y manda. Un `wa.me` pelado abre el chat en blanco, que es pedirle
 * que redacte lo mismo veinte veces por día parado al lado de la silla.
 *
 * Lo que **no** hace, a propósito: mandarlo solo. El envío automático por vías
 * no oficiales es la forma más rápida de que le baneen el número al local, y
 * el número del local es su agenda entera. El último toque lo da una persona.
 *
 * Puro: `hoy` entra como argumento y no se lee el reloj, igual que en
 * `schedule.ts`. Sin eso no habría forma de probar que el turno de mañana dice
 * "mañana" sin esperar a mañana.
 */

import { addDays, formatDateLong } from "./schedule.ts";
import { paraWhatsApp } from "./validation.ts";

export type DatosDelRecordatorio = {
  /** Cómo se llama el local, que es quien escribe. */
  barberia: string;
  /** Como lo dejó el cliente al reservar. Null si el turno se cargó a mano. */
  cliente: string | null;
  servicio: string | null;
  /** "YYYY-MM-DD" en hora local de la barbería. */
  fecha: string;
  /** "HH:MM" en hora local. */
  hora: string;
  /** "YYYY-MM-DD" local. Sin esto no se puede decir "mañana". */
  hoy: string;
};

/**
 * El recordatorio que se abre escrito en WhatsApp.
 *
 * Termina en una pregunta porque un recordatorio que no pide respuesta no
 * sirve para lo único que tiene que servir: enterarte de que no viene mientras
 * todavía podés darle esa hora a otro.
 */
export function mensajeDeRecordatorio(d: DatosDelRecordatorio): string {
  const saludo = d.cliente ? `Hola ${primerNombre(d.cliente)}!` : "Hola!";
  const que = d.servicio ? ` (${d.servicio})` : "";

  return (
    `${saludo} Te escribo de ${d.barberia} para recordarte tu turno ` +
    `${comoSeDiceElDia(d.fecha, d.hoy)} a las ${d.hora}${que}.\n` +
    `¿Confirmás que venís?`
  );
}

/**
 * El link que abre el chat. Sin mensaje abre en blanco, que es lo correcto
 * cuando no hay nada que sugerir: para un turno que ya pasó, un recordatorio
 * llega tarde y queda ridículo.
 */
export function linkDeWhatsApp(telefono: string, mensaje?: string): string {
  const chat = `https://wa.me/${paraWhatsApp(telefono)}`;
  return mensaje ? `${chat}?text=${encodeURIComponent(mensaje)}` : chat;
}

/**
 * "hoy", "mañana", o "el jueves 14 de agosto".
 *
 * Los dos primeros son los que se usan de verdad, porque un recordatorio se
 * manda la víspera. El tercero lleva el mes aunque quede largo: un "el jueves
 * 14" a tres semanas no dice qué jueves, y el que lo lee no tiene el
 * calendario abierto adelante.
 */
function comoSeDiceElDia(fecha: string, hoy: string): string {
  if (fecha === hoy) return "hoy";
  if (fecha === addDays(hoy, 1)) return "mañana";

  const largo = formatDateLong(fecha);
  return `el ${largo[0].toLowerCase()}${largo.slice(1)}`;
}

/**
 * "Martín Rodríguez" → "Martín". Así se saluda a alguien por WhatsApp.
 *
 * La mayúscula se fuerza porque el nombre lo escribió el cliente en el
 * teléfono, donde muy seguido sale todo en minúscula. "Hola martin!" se lee
 * como un mensaje automático, que es justo lo que este mensaje no quiere
 * parecer.
 */
function primerNombre(nombre: string): string {
  const primero = nombre.trim().split(/\s+/)[0] ?? "";
  if (primero === "") return nombre.trim();
  return `${primero[0].toUpperCase()}${primero.slice(1)}`;
}
