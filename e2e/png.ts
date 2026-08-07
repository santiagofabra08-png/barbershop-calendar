import { deflateSync } from "node:zlib";

/**
 * Un PNG de verdad, armado a mano.
 *
 * Hace falta para probar el recorte de fotos: `setInputFiles` necesita bytes de
 * una imagen real, y lo que se quiere probar es justamente qué pasa cuando
 * alguien sube una que NO es cuadrada. Escribirlo acá evita sumar una
 * dependencia para generar imágenes y evita guardar un archivo binario en el
 * repositorio, que nadie puede revisar en un diff.
 *
 * Son cuatro bloques: la firma, IHDR con las medidas, IDAT con los píxeles
 * comprimidos y IEND. Cada bloque lleva su CRC.
 */

const TABLA = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = TABLA[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function bloque(tipo: string, datos: Buffer): Buffer {
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length);

  const cuerpo = Buffer.concat([Buffer.from(tipo, "ascii"), datos]);

  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(cuerpo));

  return Buffer.concat([largo, cuerpo, crc]);
}

/**
 * Un rectángulo de color liso.
 *
 * Con una mitad más oscura, para que se note en la vista previa si el recorte
 * salió del lado que tenía que salir.
 */
export function pngRectangulo(ancho: number, alto: number): Buffer {
  const firma = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ancho, 0);
  ihdr.writeUInt32BE(alto, 4);
  ihdr[8] = 8; // bits por canal
  ihdr[9] = 2; // color verdadero, sin transparencia
  // compresión, filtro e entrelazado: los tres en su único valor válido.

  // Cada fila arranca con un byte de filtro. Cero significa "sin filtro", que
  // es lo más simple y acá no cuesta nada.
  const filas: Buffer[] = [];
  for (let y = 0; y < alto; y++) {
    const fila = Buffer.alloc(1 + ancho * 3);
    for (let x = 0; x < ancho; x++) {
      const i = 1 + x * 3;
      const izquierda = x < ancho / 2;
      fila[i] = izquierda ? 200 : 40;
      fila[i + 1] = izquierda ? 60 : 90;
      fila[i + 2] = izquierda ? 60 : 160;
    }
    filas.push(fila);
  }

  return Buffer.concat([
    firma,
    bloque("IHDR", ihdr),
    bloque("IDAT", deflateSync(Buffer.concat(filas))),
    bloque("IEND", Buffer.alloc(0)),
  ]);
}
