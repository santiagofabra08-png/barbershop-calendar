/**
 * El plazo de cancelación, dicho como lo diría una persona.
 *
 * Cada barbería elige el suyo (`tenants.cancel_deadline_minutes`), pero durante
 * meses cuatro textos dijeron "hasta una hora antes" escrito a mano: el pie de
 * la página pública, el mail de confirmación en sus dos versiones, y la
 * descripción del archivo de calendario.
 *
 * Con la barbería que lo tenía en 60 eso era verdad por casualidad. La primera
 * que puso 30 empezó a prometerle a sus clientes el doble de tiempo del que
 * tenían: alguien intenta cancelar 45 minutos antes convencido de que puede, la
 * base lo rechaza, y el que queda mal es el local.
 *
 * Sin directiva de cliente ni de servidor a propósito: lo usan los dos lados.
 */

const HORAS = [
  "cero",
  "una",
  "dos",
  "tres",
  "cuatro",
  "cinco",
  "seis",
  "siete",
  "ocho",
  "nueve",
  "diez",
  "once",
  "doce",
];

/**
 * Devuelve la frase entera, sin el objeto: "hasta media hora antes".
 *
 * Se devuelve armada y no en pedazos porque el castellano no deja componerla:
 * "una hora" y "30 minutos" no llevan el mismo artículo, y un llamador que
 * concatene se equivoca tarde o temprano.
 */
export function plazoEnPalabras(minutos: number): string {
  // Cero es una política real: cancelar hasta que arranque. No es "sin plazo".
  if (!Number.isFinite(minutos) || minutos <= 0) return "hasta que empiece";

  if (minutos === 30) return "hasta media hora antes";
  if (minutos < 60) return `hasta ${minutos} minutos antes`;
  if (minutos === 90) return "hasta una hora y media antes";

  if (minutos % 60 === 0) {
    const horas = minutos / 60;
    if (horas === 1) return "hasta una hora antes";
    if (horas === 24) return "hasta un día antes";
    if (horas === 48) return "hasta dos días antes";
    if (horas < HORAS.length) return `hasta ${HORAS[horas]} horas antes`;
    return `hasta ${horas} horas antes`;
  }

  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return `hasta ${horas} h ${resto} min antes`;
}
