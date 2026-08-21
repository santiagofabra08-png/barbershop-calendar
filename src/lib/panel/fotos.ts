import { revisarArchivo, urlDeImagen, type EspecDeImagen } from "@/lib/panel/imagen";
import type { createClient } from "@/lib/supabase/server";

/**
 * Subir y borrar fotos del panel, en un solo lugar.
 *
 * Salió de la pantalla de Productos cuando la de Equipo necesitó lo mismo. Es
 * código de servidor: recibe el cliente de Supabase ya armado en vez de crearlo,
 * así el que llama decide con qué sesión escribe.
 *
 * Lo que hay que entender de acá:
 *
 * - **La foto llega ya recortada por el navegador**, así que lo que sube son
 *   60 KB y no los 4 MB de la original. Igual se revisa formato y peso de este
 *   lado: el formulario avisa, pero un formulario se puede armar a mano.
 * - **La ruta arranca con el id de la barbería.** Ésa es la separación entre
 *   locales en Storage: la política de `storage.objects` compara ese primer
 *   tramo contra la barbería de quien sube. No hay forma de escribir en la
 *   carpeta de otro.
 */

export const BUCKET = "tenant-assets";

/** El cliente de Supabase tal como lo devuelve el servidor, con sus tipos. */
type Cliente = Awaited<ReturnType<typeof createClient>>;

export async function subirFoto(
  sb: Cliente,
  tenantId: string,
  /** La subcarpeta dentro del tenant: `productos`, `equipo`, `marca`. */
  carpeta: string,
  archivo: File,
  espec: EspecDeImagen,
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const problema = revisarArchivo(archivo.type, archivo.size, {
    ...espec,
    // El navegador re-codifica a WebP; el servidor tiene que aceptar eso además
    // de lo que la persona eligió.
    tiposAceptados: [...espec.tiposAceptados, "image/png"],
  });
  if (problema) return { ok: false, error: problema };

  const extension = archivo.type === "image/webp" ? "webp" : "png";
  const path = `${tenantId}/${carpeta}/${crypto.randomUUID()}.${extension}`;

  const { error } = await sb.storage.from(BUCKET).upload(path, archivo, {
    contentType: archivo.type,
    // Cada foto tiene nombre nuevo, así que nunca pisa a otra. Se cachea fuerte
    // porque la URL cambia sola cuando cambia la foto.
    cacheControl: "31536000",
  });

  if (error) return { ok: false, error: `No se pudo subir la foto: ${error.message}` };
  return { ok: true, path };
}

/** Borra una foto que ya no usa nadie. Que falle no es motivo para frenar. */
export async function borrarFoto(sb: Cliente, path: string | null) {
  if (!path) return;
  await sb.storage.from(BUCKET).remove([path]);
}

/** Lo mismo, cuando lo guardado es la URL entera y no la ruta. */
export async function borrarFotoPorUrl(sb: Cliente, url: string | null) {
  await borrarFoto(sb, rutaDeLaUrl(url));
}

/**
 * La ruta dentro del bucket, a partir de la URL pública.
 *
 * Devuelve null si la URL apunta a otro lado: una foto cargada a mano contra
 * otro servidor no es nuestra y no se borra.
 */
export function rutaDeLaUrl(url: string | null): string | null {
  if (!url) return null;
  const marca = `/${BUCKET}/`;
  const corte = url.indexOf(marca);
  return corte === -1 ? null : url.slice(corte + marca.length);
}

/** La URL pública de una ruta recién subida. */
export function urlDeLaRuta(path: string): string {
  return urlDeImagen(path) ?? "";
}

/**
 * El archivo del formulario, o null si no eligieron ninguno.
 *
 * Un input de archivo vacío igual manda un `File` de cero bytes, así que no
 * alcanza con preguntar si vino.
 */
export function fotoDelFormulario(formData: FormData, nombre = "foto"): File | null {
  const archivo = formData.get(nombre);
  return archivo instanceof File && archivo.size > 0 ? archivo : null;
}
