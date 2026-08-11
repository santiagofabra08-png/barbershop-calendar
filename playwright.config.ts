import { defineConfig, devices } from "@playwright/test";

/**
 * Un subdominio distinto por corrida.
 *
 * Empezó siendo `e2e-prueba` fijo y costó una tarde entender por qué las
 * pruebas del panel rebotaban al login: la barbería se borra y se crea de nuevo
 * en cada corrida, así que el slug era el mismo pero el id cambiaba, y la
 * aplicación seguía usando el id viejo que tenía cacheado. Con un slug nuevo
 * cada vez, no hay nada viejo que reusar.
 *
 * Para una barbería de verdad eso no pasa nunca —el id no cambia—, pero una
 * prueba que crea y destruye la misma barbería veinte veces por día sí lo
 * pisa.
 */
const SLUG = process.env.E2E_SLUG ?? `e2e-${Date.now().toString(36)}`;
process.env.E2E_SLUG = SLUG;

/**
 * El puerto, por si el 3000 está ocupado.
 *
 * No es hipotético: acá el 3000 lo tenía otro proyecto y la corrida moría con
 * "Timed out waiting for webServer", que no dice nada de lo que realmente
 * pasaba. `E2E_PORT=3010 npm run test:e2e` y listo.
 *
 * El puerto no afecta a qué barbería se resuelve: el host se compara sin él.
 */
const PUERTO = process.env.E2E_PORT ?? "3000";

/**
 * Las pruebas que abren un navegador de verdad.
 *
 * Todo lo demás que probamos habla con la base y nunca toca un botón. Acá se
 * cubre lo que solo existe en el navegador: el recorte de las fotos, que pasa
 * entero con canvas; el carrito; y que los formularios efectivamente envíen.
 *
 * Corren contra una barbería descartable que se crea antes y se borra después
 * —`e2e/preparar.ts` y `e2e/limpiar.ts`—, así ninguna prueba ensucia una que
 * estés mirando.
 */
export default defineConfig({
  testDir: "./e2e",
  // Sin paralelo: todas comparten la misma barbería y la misma agenda. Dos
  // pruebas reservando a la vez se pisarían el horario.
  workers: 1,
  fullyParallel: false,
  // Reintentar escondería una prueba que falla una de cada tres veces, que es
  // justo la que hay que arreglar.
  retries: 0,
  reporter: [["list"]],

  globalSetup: "./e2e/preparar.ts",
  globalTeardown: "./e2e/limpiar.ts",

  use: {
    baseURL: `http://${SLUG}.lvh.me:${PUERTO}`,
    // Traza solo cuando algo falla: es lo que deja ver qué pasó sin tener que
    // reproducirlo a mano.
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "es-UY",
    timezoneId: "America/Montevideo",
  },

  projects: [
    {
      name: "escritorio",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // Casi todo el mundo reserva desde el teléfono. Si algo se rompe, se
      // rompe acá primero.
      name: "celular",
      use: { ...devices["Pixel 7"] },
    },
  ],

  webServer: {
    command: `npm run dev -- --port ${PUERTO}`,
    // Un archivo estático y no la portada: en `localhost` no hay subdominio, y
    // en producción sin subdominio no hay barbería, así que `/` responde 404 y
    // Playwright creería que el servidor no está listo. El ícono responde
    // siempre, corra en desarrollo o compilado.
    url: `http://localhost:${PUERTO}/icon.svg`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
