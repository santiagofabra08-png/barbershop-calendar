/**
 * Crea dos barberías de demostración, completas y usables.
 *
 *   node --env-file=.env.local scripts/sembrar-demo.mts
 *   node --env-file=.env.local scripts/sembrar-demo.mts --rehacer
 *   node --env-file=.env.local scripts/sembrar-demo.mts --borrar
 *
 * Sirve para dos cosas distintas:
 *
 *   1. Tener páginas de reserva de verdad para mirar y romper, sin tocar las de
 *      un cliente real.
 *   2. Que exista MÁS DE UNA barbería en la base. Toda la separación entre
 *      locales está escrita en las políticas de RLS, pero con una sola barbería
 *      esa separación nunca se ejerce: no hay de quién separarla. Recién con dos
 *      se puede probar —eso lo hace `probar-aislamiento.mts`—.
 *
 * A propósito NO se parecen entre sí ni a Tropi. Una es clara y otra oscura, una
 * cobra en pesos uruguayos y otra en argentinos, una abre por ventana móvil y la
 * otra por semana. Si el sistema solo anda con barberías parecidas a la primera,
 * es ahora cuando se tiene que notar.
 *
 * El alta la hace `lib/alta.mts`, el mismo código que usa `crear-barberia.mts`
 * con un cliente que paga. Es a propósito: cada vez que rehacés las demos estás
 * probando el alta de verdad, en vez de probar una copia parecida que puede
 * haber quedado atrás.
 *
 * Usa la service role key: saltea RLS. Por eso vive en `scripts/` y no se
 * despliega.
 */
import {
  PALETAS,
  borrarBarberia,
  clienteAdmin,
  crearBarberia,
  slugLibre,
  type BarberiaNueva,
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

// ============================================================================
// Las dos barberías
// ============================================================================

const DEMOS: BarberiaNueva[] = [
  {
    slug: "barberia-central",
    nombre: "Barbería Central",
    timezone: "America/Montevideo",
    moneda: "UYU",
    direccion: null,
    // Clara y fría, con acento verde. Nada que ver con el rojo de Tropi.
    colores: PALETAS.serena.colores,
    ventana: { modo: "rolling", dias: 21 },
    minLead: 60,
    plazoCancelacion: 120,
    vidriera: true,
    servicios: [
      { nombre: "Corte", minutos: 40, precio: 650, desc: "Lavado, corte y peinado." },
      { nombre: "Corte y barba", minutos: 60, precio: 950 },
      { nombre: "Barba", minutos: 25, precio: 400 },
      { nombre: "Perfilado de cejas", minutos: 15, precio: 250 },
    ],
    descuentos: [{ nombre: "Amigo de la casa", precio: 150 }],
    productos: [
      { nombre: "Cera mate", precio: 480, stock: 12, desc: "Fijación fuerte, sin brillo." },
      { nombre: "Polvo texturizador", precio: 520, stock: 6 },
      { nombre: "Aceite para barba", precio: 390, stock: 9 },
    ],
    barberos: [
      {
        nombre: "Martín",
        rol: "owner",
        cobro: { modelo: "revenue_only" },
        email: "central@ejemplo.com",
        dias: [2, 3, 4, 5, 6],
        // Con corte al mediodía: dos tramos por día prueban que el hueco del
        // medio no se ofrezca como horario.
        tramos: [
          ["09:00", "13:00"],
          ["15:00", "19:00"],
        ],
      },
      {
        nombre: "Diego",
        rol: "barber",
        cobro: { modelo: "commission", porcentaje: 50 },
        dias: [2, 3, 4, 5, 6],
        tramos: [["10:00", "18:00"]],
      },
    ],
  },
  {
    slug: "studio-norte",
    nombre: "Studio Norte",
    // Otro país: otra zona horaria y otra moneda. Es la prueba de que ningún
    // huso ni ningún símbolo quedó escrito fijo en el código.
    timezone: "America/Argentina/Buenos_Aires",
    moneda: "ARS",
    direccion: null,
    // Oscura. Si la página solo se ve bien sobre fondo claro, se nota acá.
    colores: PALETAS.nocturna.colores,
    // Por semana: la que viene se habilita el domingo a las 20.
    ventana: { modo: "weekly", dow: 0, hora: "20:00" },
    minLead: 60,
    plazoCancelacion: 120,
    // Vidriera apagada a propósito: así se puede comparar una barbería que
    // vende productos contra una que no, y comprobar que /productos da 404.
    vidriera: false,
    servicios: [
      { nombre: "Corte clásico", minutos: 45, precio: 9000 },
      { nombre: "Fade", minutos: 50, precio: 11000, desc: "Degradado a máquina." },
      { nombre: "Corte y barba", minutos: 75, precio: 15000 },
    ],
    productos: [{ nombre: "Bálsamo", precio: 7000, stock: 4 }],
    barberos: [
      {
        nombre: "Lucía",
        rol: "owner",
        cobro: { modelo: "revenue_only" },
        email: "norte@ejemplo.com",
        // Abre miércoles a domingo y cierra lunes y martes: el revés de las
        // otras dos, para que un feriado semanal distinto no rompa la grilla.
        dias: [3, 4, 5, 6, 0],
        tramos: [["12:00", "20:00"]],
      },
      {
        nombre: "Rodrigo",
        rol: "barber",
        cobro: { modelo: "chair_rent", montoCents: 4000000, periodo: "month" },
        dias: [4, 5, 6],
        tramos: [["14:00", "21:00"]],
      },
    ],
  },
];

// ============================================================================

// ---- Borrar y salir ---------------------------------------------------------
// Es lo último que se corre antes de salir a producción de verdad: las de demo
// no son clientes y no tienen por qué existir en la base que atiende a gente
// que paga.
//
// ⚠️ Ojo con una consecuencia: `probar-aislamiento.mts` necesita DOS barberías
// para tener de quién separarse. Borrando las demos, esa prueba —la que decide
// si esto se puede vender— se queda sin con qué correr hasta que haya un
// segundo cliente real.
if (borrar) {
  console.log("\nBorrando las barberías de demostración…\n");

  for (const demo of DEMOS) {
    if (await slugLibre(admin, demo.slug)) {
      console.log(`  · ${demo.slug} no existe.`);
      continue;
    }
    await borrarBarberia(admin, demo.slug);
    console.log(`  ✓ ${demo.nombre} borrada, con su cuenta.`);
  }

  console.log(
    "\n  Recordá que probar-aislamiento necesita dos barberías.\n" +
      "  Con una sola en la base, esa prueba no tiene contra qué correr.\n",
  );
  process.exit(0);
}

console.log(rehacer ? "\nRehaciendo las barberías de demo…\n" : "\nSembrando…\n");

const creadas: { demo: BarberiaNueva; accesos: { nombre: string; mail: string; clave: string }[] }[] =
  [];

for (const demo of DEMOS) {
  if (!(await slugLibre(admin, demo.slug))) {
    if (!rehacer) {
      console.log(`  · ${demo.slug} ya existe. Usá --rehacer para rehacerla.`);
      continue;
    }
    await borrarBarberia(admin, demo.slug);
  }

  const { accesos } = await crearBarberia(admin, demo);
  console.log(`  ✓ ${demo.nombre} (${demo.slug})`);
  creadas.push({ demo, accesos });
}

if (creadas.length === 0) {
  console.log("\nNo se creó nada nuevo.\n");
  process.exit(0);
}

const raiz = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "tuapp.com";

console.log("\n" + "─".repeat(70));
console.log("ACCESOS — anotalos ahora, la contraseña no se vuelve a mostrar");
console.log("─".repeat(70));

for (const { demo, accesos } of creadas) {
  console.log(`\n${demo.nombre}`);
  console.log(`  Página:  http://${demo.slug}.${raiz}`);
  for (const a of accesos) {
    console.log(`  Dueño:   ${a.nombre} — ${a.mail} / ${a.clave}`);
  }
}

console.log("");
