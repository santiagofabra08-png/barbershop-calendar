/**
 * La barbería que se muestra incrustada en la portada.
 *
 *   node --env-file=.env.local scripts/barberia-demo.mts
 *   node --env-file=.env.local scripts/barberia-demo.mts --rehacer
 *   node --env-file=.env.local scripts/barberia-demo.mts --borrar
 *
 * Va aparte de `sembrar-demo` porque cumple otra función. Aquellas dos existen
 * para probar —que haya de quién separarse, que una clara y una oscura se vean
 * bien— y se pueden borrar antes de salir a producción. Esta es parte de la
 * página de ventas: si no existe, la portada muestra un hueco.
 */
import { BARBERIA_DEMO, SLUG_DEMO } from "./lib/demo.mts";
import {
  borrarBarberia,
  clienteAdmin,
  crearBarberia,
  slugLibre,
} from "./lib/alta.mts";

const rehacer = process.argv.includes("--rehacer");
const borrar = process.argv.includes("--borrar");

let admin;
try {
  admin = clienteAdmin();
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
}

const raiz = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "tuapp.com").split(":")[0];

if (borrar) {
  if (await slugLibre(admin, SLUG_DEMO)) {
    console.log(`\n  · "${SLUG_DEMO}" no existe.\n`);
    process.exit(0);
  }
  await borrarBarberia(admin, SLUG_DEMO);
  console.log(
    `\n  ✓ ${BARBERIA_DEMO.nombre} borrada.\n\n` +
      "  ⚠ La portada la muestra incrustada: hasta que no la vuelvas a crear,\n" +
      "    esa sección va a mostrar un hueco.\n",
  );
  process.exit(0);
}

if (!(await slugLibre(admin, SLUG_DEMO))) {
  if (!rehacer) {
    console.log(
      `\n  · "${SLUG_DEMO}" ya existe. Usá --rehacer para volver a crearla.\n`,
    );
    process.exit(0);
  }
  await borrarBarberia(admin, SLUG_DEMO);
}

const { accesos } = await crearBarberia(admin, BARBERIA_DEMO);

console.log(`\n  ✓ ${BARBERIA_DEMO.nombre}\n`);
console.log(`    Página:  https://${SLUG_DEMO}.${raiz}`);
console.log(`    Panel:   https://${SLUG_DEMO}.${raiz}/entrar\n`);

console.log("  " + "─".repeat(66));
console.log("  ACCESO — anotalo ahora, la contraseña no se vuelve a mostrar");
console.log("  " + "─".repeat(66));
for (const a of accesos) {
  console.log(`    ${a.nombre}: ${a.mail} / ${a.clave}`);
}

console.log(
  "\n  Abre los siete días de mañana a noche, a propósito: si alguien mira la\n" +
    "  portada un lunes y la demo dice cerrado, no entiende que el local\n" +
    "  descansa, entiende que el producto no anda.\n\n" +
    "  Las capturas del panel se regeneran con:\n" +
    "    node --env-file=.env.local scripts/capturas.mts\n",
);
