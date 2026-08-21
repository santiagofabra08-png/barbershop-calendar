import { readFile } from "node:fs/promises";
import path from "node:path";

import { partirGuia, type SeccionDeGuia } from "@/lib/guia";

/**
 * De dónde sale el texto de la guía.
 *
 * ⚠️ Solo servidor: lee del disco. La parte que convierte Markdown en HTML
 * está en `@/lib/guia`, que es pura y no toca nada.
 *
 * **Se lee el archivo de `docs/` en vez de copiarlo a `src/`.** Es el mismo
 * archivo que se manda a las barberías y el mismo que se edita cuando algo del
 * panel cambia. Con una copia adentro de `src/`, el día que alguien corrija la
 * guía la ayuda del panel seguiría explicando lo de antes, y nadie se entera
 * hasta que un cliente pregunta.
 *
 * **Si el archivo no está, la ayuda no se rompe: no aparece.** Un despliegue
 * que por lo que sea no incluya `docs/` no puede tumbar el panel entero por
 * una pantalla de ayuda.
 */

const ARCHIVO = "docs/guia-del-panel.md";

/** Se lee una vez por proceso. La guía no cambia sin un despliegue nuevo. */
let cache: SeccionDeGuia[] | null = null;

export async function seccionesDeLaGuia(): Promise<SeccionDeGuia[]> {
  if (cache) return cache;

  try {
    const md = await readFile(path.join(process.cwd(), ARCHIVO), "utf8");
    cache = partirGuia(md);
  } catch {
    cache = [];
  }

  return cache;
}
