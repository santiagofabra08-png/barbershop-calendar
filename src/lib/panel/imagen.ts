/**
 * Subir una imagen sin que nadie tenga que saber de imágenes.
 *
 * Módulo neutral a propósito —sin `"use client"` ni `"use server"`— porque las
 * dos puntas necesitan lo mismo: la pantalla para decir qué se espera y recortar
 * antes de subir, el servidor para revisar lo que llegó. Si esto viviera del
 * lado del cliente, el servidor recibiría un proxy vacío al importarlo.
 *
 * El recorte pasa en el navegador. No es un capricho: una foto de celular pesa
 * 4 MB y mide 4000 px de lado; subirla entera para achicarla después significa
 * que el dueño espera medio minuto mirando una barra, con los datos de su plan.
 * Recortada son 60 KB y sube al instante.
 */

import { publicEnv } from "@/lib/env";

export type EspecDeImagen = {
  /** Lado del cuadrado final en px, o el ancho máximo si no se recorta. */
  lado: number;
  /** Se recorta al cuadrado. Un logo no: se sube tal cual. */
  cuadrada: boolean;
  tiposAceptados: string[];
  pesoMaximoBytes: number;
  /**
   * Lo que se lee ANTES de elegir el archivo, en criollo y en una línea.
   * Un dueño de barbería no sabe qué es "1:1" ni cuánto pesa una foto.
   */
  ayuda: string;
};

const MB = 1024 * 1024;

export const FOTO_PRODUCTO: EspecDeImagen = {
  lado: 800,
  cuadrada: true,
  tiposAceptados: ["image/jpeg", "image/png", "image/webp"],
  pesoMaximoBytes: 2 * MB,
  ayuda:
    "Cuadrada, 800 × 800 px. JPG, PNG o WebP, hasta 2 MB. " +
    "Si la sacás con el celular, poné el producto en el medio: se recorta al cuadrado.",
};

/**
 * La cara del barbero, en el selector de la página pública.
 *
 * 400 y no 800 como el producto: se muestra en un círculo de 40 px. Pedir el
 * doble de resolución de la que se ve es cobrarle datos al dueño por nada.
 *
 * El texto de ayuda dice "de la cara" y no "cuadrada" porque el problema real
 * no es la forma: las fotos que manda una barbería son de producción, con la
 * tijera adelante y la cara chica al fondo. Recortadas a 40 px eso no es una
 * persona, es una mano.
 */
export const FOTO_BARBERO: EspecDeImagen = {
  lado: 400,
  cuadrada: true,
  tiposAceptados: ["image/jpeg", "image/png", "image/webp"],
  pesoMaximoBytes: 2 * MB,
  ayuda:
    "De la cara, mirando a cámara. Cuadrada, 400 × 400 px. JPG, PNG o WebP, " +
    "hasta 2 MB. Se recorta al cuadrado, así que la cara va en el medio.",
};

export const LOGO: EspecDeImagen = {
  lado: 400,
  cuadrada: false,
  // SVG primero: es el único que no se pixela nunca, y un logo se ve grande en
  // el encabezado y chico en el celular.
  tiposAceptados: ["image/svg+xml", "image/png", "image/webp"],
  pesoMaximoBytes: 1 * MB,
  ayuda:
    "Con fondo transparente. SVG es lo mejor porque no se pixela nunca; " +
    "si es PNG, que tenga 400 px de ancho como mínimo. Hasta 1 MB.",
};

/**
 * Lo que sí se rechaza.
 *
 * Formato y peso, nada más. Esos dos rompen la página: un .heic no se muestra
 * en ningún lado y una foto de 12 MB la deja colgada en el celular de quien la
 * mira. La medida nunca se rechaza —se recorta y se avisa—: mandar a alguien a
 * buscar otra foto porque la suya mide 810 en vez de 800 es hacerle perder el
 * tiempo por nada.
 *
 * Corre en las dos puntas. En la pantalla para avisar en el momento, en el
 * servidor porque un formulario se puede armar a mano.
 */
export function revisarArchivo(
  tipo: string,
  bytes: number,
  espec: EspecDeImagen,
): string | null {
  if (!espec.tiposAceptados.includes(tipo)) {
    return `Ese archivo no es una imagen de las que sirven. Tiene que ser ${nombresDeFormato(espec)}.`;
  }
  if (bytes > espec.pesoMaximoBytes) {
    const limite = Math.round(espec.pesoMaximoBytes / MB);
    return `Esa imagen pesa demasiado. El máximo es ${limite} MB.`;
  }
  return null;
}

/** "JPG, PNG o WebP", para escribirlo en un mensaje. */
export function nombresDeFormato(espec: EspecDeImagen): string {
  const nombres = espec.tiposAceptados.map(
    (t) =>
      ({
        "image/jpeg": "JPG",
        "image/png": "PNG",
        "image/webp": "WebP",
        "image/svg+xml": "SVG",
      })[t] ?? t,
  );
  if (nombres.length === 1) return nombres[0];
  return `${nombres.slice(0, -1).join(", ")} o ${nombres[nombres.length - 1]}`;
}

/** Para el atributo `accept` del input. */
export function accept(espec: EspecDeImagen): string {
  return espec.tiposAceptados.join(",");
}

export type ImagenLista = {
  archivo: File;
  /** La original no era cuadrada y se le sacaron los bordes. Hay que avisarlo. */
  recortada: boolean;
  /** Para mostrarla antes de guardar. Revocar con `URL.revokeObjectURL`. */
  vistaPrevia: string;
};

/**
 * Deja una foto cuadrada, chica y lista para subir.
 *
 * Recorta desde el centro, que es donde la gente pone lo que está fotografiando.
 * No agranda: si alguien sube una foto de 300 px se queda en 300 px, borrosa
 * pero honesta. Estirarla a 800 no le agrega detalle, solo peso.
 *
 * Solo en el navegador: usa canvas.
 */
export async function prepararFoto(
  original: File,
  espec: EspecDeImagen = FOTO_PRODUCTO,
): Promise<ImagenLista> {
  const problema = revisarArchivo(original.type, original.size, espec);
  if (problema) throw new Error(problema);

  const bitmap = await createImageBitmap(original);
  try {
    const lado = Math.min(bitmap.width, bitmap.height);
    const recortada = bitmap.width !== bitmap.height;
    const destino = Math.min(espec.lado, lado);

    const canvas = document.createElement("canvas");
    canvas.width = destino;
    canvas.height = destino;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Este navegador no puede preparar la imagen.");

    // Fondo blanco antes de dibujar. Un PNG con transparencia guardado como
    // foto termina con el fondo negro si no se rellena, y una cera sobre negro
    // no se ve.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, destino, destino);
    ctx.drawImage(
      bitmap,
      (bitmap.width - lado) / 2,
      (bitmap.height - lado) / 2,
      lado,
      lado,
      0,
      0,
      destino,
      destino,
    );

    const blob = await new Promise<Blob | null>((resolver) =>
      canvas.toBlob(resolver, "image/webp", 0.85),
    );
    if (!blob) throw new Error("No se pudo preparar la imagen. Probá con otra.");

    const extension = blob.type === "image/webp" ? "webp" : "png";

    return {
      archivo: new File([blob], `foto.${extension}`, { type: blob.type }),
      recortada,
      vistaPrevia: URL.createObjectURL(blob),
    };
  } finally {
    bitmap.close();
  }
}

/**
 * De la ruta guardada a la URL que se muestra.
 *
 * En la base va la ruta dentro del bucket y no la URL entera: si mañana cambia
 * el dominio de Supabase —o la barbería se muda de proyecto— se cambia esta
 * función y no una columna de cada tabla.
 */
export function urlDeImagen(path: string | null): string | null {
  if (!path) return null;
  return `${publicEnv.supabaseUrl}/storage/v1/object/public/tenant-assets/${path}`;
}
