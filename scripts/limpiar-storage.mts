/**
 * Archivos de Storage que quedaron sin barbería.
 *
 *   node --env-file=.env.local scripts/limpiar-storage.mts           # solo mira
 *   node --env-file=.env.local scripts/limpiar-storage.mts --borrar  # borra
 *
 * `borrarBarberia` ahora se lleva los archivos, así que esto no debería volver
 * a hacer falta. Existe para lo que se acumuló antes de que los borrara: cada
 * corrida de las pruebas de navegador subía una foto de producto, la barbería
 * se borraba al terminar, y la foto quedaba en un bucket público para siempre.
 *
 * Mira, cuenta y recién borra si se lo pedís. Un script que borra apenas se
 * ejecuta es un script que un día se ejecuta sin querer.
 *
 * Solo toca carpetas cuyo nombre es el id de una barbería que YA NO EXISTE. Esa
 * comparación es lo único que separa "limpiar basura" de "borrarle las fotos a
 * un cliente".
 */
import { clienteAdmin } from "./lib/alta.mts";

const borrar = process.argv.includes("--borrar");
const admin = clienteAdmin();

const { data: tenants } = await admin.from("tenants").select("id");
const vivas = new Set(((tenants ?? []) as { id: string }[]).map((t) => t.id));
console.log(`Barberías que existen: ${vivas.size}`);

const { data: buckets } = await admin.storage.listBuckets();
let total = 0;

for (const bucket of buckets ?? []) {
  const { data: carpetas } = await admin.storage.from(bucket.name).list("", { limit: 1000 });
  const huerfanas = (carpetas ?? []).filter((c) => !c.id && !vivas.has(c.name));

  for (const carpeta of huerfanas) {
    const rutas: string[] = [];
    const { data: raiz } = await admin.storage.from(bucket.name).list(carpeta.name, { limit: 1000 });

    for (const entrada of raiz ?? []) {
      if (entrada.id) {
        rutas.push(`${carpeta.name}/${entrada.name}`);
        continue;
      }
      const { data: dentro } = await admin.storage
        .from(bucket.name)
        .list(`${carpeta.name}/${entrada.name}`, { limit: 1000 });
      for (const a of dentro ?? []) {
        if (a.id) rutas.push(`${carpeta.name}/${entrada.name}/${a.name}`);
      }
    }

    if (rutas.length === 0) continue;
    total += rutas.length;
    console.log(`\n${bucket.name}/${carpeta.name}  (${rutas.length})`);
    for (const r of rutas) console.log(`  ${r}`);

    if (borrar) {
      const { error } = await admin.storage.from(bucket.name).remove(rutas);
      console.log(error ? `  ✗ ${error.message}` : "  ✓ borrados");
    }
  }
}

console.log("");
if (total === 0) console.log("No hay nada suelto.");
else if (borrar) console.log(`Listo: ${total} archivos borrados.`);
else console.log(`${total} archivos sin barbería. Para borrarlos: --borrar`);
