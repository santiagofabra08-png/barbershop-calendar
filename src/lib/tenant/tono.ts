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

/**
 * Contraste entre dos colores, según WCAG. Va de 1 (iguales) a 21.
 *
 * 4.5 es el mínimo para texto normal. Por debajo de eso no es que se lea
 * "peor": hay gente que directamente no lo lee.
 */
export function contraste(a: string, b: string): number {
  const la = luminancia(a);
  const lb = luminancia(b);
  const claro = Math.max(la, lb);
  const oscuro = Math.min(la, lb);
  return (claro + 0.05) / (oscuro + 0.05);
}

function aCanales(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  const n = Number.parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function aHex([r, g, b]: [number, number, number]): string {
  const dos = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0");
  return `#${dos(r)}${dos(g)}${dos(b)}`;
}

/**
 * El acento, oscurecido lo justo para que se lea como texto.
 *
 * **El acento tiene dos trabajos y un color pastel solo sirve para uno.** Como
 * relleno de lo elegido, un celeste suave es perfecto. Como tinta sobre una
 * tarjeta blanca, no se lee: es el mismo color haciendo dos cosas distintas.
 *
 * Devuelve el color tal cual si ya contrasta. Si no, lo va mezclando con la
 * tinta de la barbería hasta que pase el mínimo, así conserva el matiz: un
 * celeste se vuelve un azul profundo, no un gris.
 *
 * Si aun mezclado del todo no llega, devuelve la tinta: es preferible perder
 * el color a perder el texto.
 */
export function legibleSobre(color: string, fondo: string, tinta: string): string {
  if (contraste(color, fondo) >= 4.5) return color;

  const c = aCanales(color);
  const t = aCanales(tinta);
  if (!c || !t) return tinta;

  for (let paso = 1; paso <= 10; paso++) {
    const p = paso / 10;
    const mezcla = aHex([
      c[0] + (t[0] - c[0]) * p,
      c[1] + (t[1] - c[1]) * p,
      c[2] + (t[2] - c[2]) * p,
    ]);
    if (contraste(mezcla, fondo) >= 4.5) return mezcla;
  }

  return tinta;
}
