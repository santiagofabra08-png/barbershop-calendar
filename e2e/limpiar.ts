import { rmSync } from "node:fs";

import { ARCHIVO_ACCESO, SLUG } from "./barberia";
import { borrarBarberia, clienteAdmin } from "../scripts/lib/alta.mts";

/** Borra la barbería descartable y el archivo con su contraseña. */
export default async function limpiar() {
  const admin = clienteAdmin();
  await borrarBarberia(admin, SLUG);
  rmSync(ARCHIVO_ACCESO, { force: true });
  console.log("\n  Barbería de prueba borrada.\n");
}
