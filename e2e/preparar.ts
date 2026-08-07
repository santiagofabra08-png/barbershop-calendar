import { writeFileSync } from "node:fs";

import { ARCHIVO_ACCESO, BARBERIA, SLUG } from "./barberia";
import { borrarBarberia, clienteAdmin, crearBarberia } from "../scripts/lib/alta.mts";

/**
 * Crea la barbería descartable antes de que corra la primera prueba.
 *
 * Si quedó una de una corrida anterior que se cortó por la mitad, se borra y se
 * hace de nuevo: arrancar sobre restos es la forma más común de perseguir un
 * fantasma durante una hora.
 */
export default async function preparar() {
  const admin = clienteAdmin();

  await borrarBarberia(admin, SLUG);
  const { accesos } = await crearBarberia(admin, BARBERIA);

  writeFileSync(ARCHIVO_ACCESO, JSON.stringify(accesos[0]), "utf8");

  console.log(`\n  Barbería de prueba lista: http://${SLUG}.lvh.me:3000\n`);
}
