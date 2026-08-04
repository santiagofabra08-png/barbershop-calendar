/**
 * ¿La barbería es clara u oscura?
 *
 * Los colores llegan como dato, así que el diseño no puede dar por sentado
 * ninguno de los dos. Y hay un gesto que no se traduce solo de un fondo al
 * otro: el resplandor de la pieza elegida.
 *
 * Sobre fondo oscuro, una pieza clara con un halo alrededor parece emitir luz.
 * Sobre fondo claro eso es imposible —no se puede brillar más blanco que el
 * papel— y el equivalente honesto es una sombra honda que la despega de la
 * hoja. Mismo propósito, mecánica opuesta.
 *
 * Puro y sin nada del navegador: se puede probar.
 */

export type Tono = "claro" | "oscuro";

/**
 * Luminancia relativa según WCAG. 0 es negro, 1 es blanco.
 *
 * No es el promedio de los tres canales: el ojo ve el verde mucho más
 * brillante que el azul, y por eso cada uno pesa distinto. Un verde y un azul
 * con el mismo número en hexadecimal no se ven igual de claros.
 */
export function luminancia(hex: string): number {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex.trim());
  // Un color que no se entiende se trata como claro, que es el caso común y
  // el que no deja texto invisible.
  if (!m) return 1;

  const n = Number.parseInt(m[1], 16);
  const canal = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };

  return (
    0.2126 * canal((n >> 16) & 255) +
    0.7152 * canal((n >> 8) & 255) +
    0.0722 * canal(n & 255)
  );
}

/**
 * El punto de corte es 0.179 y no 0.5.
 *
 * Es la luminancia donde el blanco y el negro contrastan exactamente igual
 * contra ese fondo. Por debajo, lo claro se lee mejor; por encima, lo oscuro.
 * Que sea justo la pregunta que estamos haciendo —"¿acá funciona un halo
 * claro?"— no es casualidad: es la misma frontera.
 */
export function tonoDe(hex: string): Tono {
  return luminancia(hex) < 0.179 ? "oscuro" : "claro";
}
