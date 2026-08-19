/**
 * Las capturas que muestra la portada, sacadas del producto de verdad.
 *
 *   node --env-file=.env.local scripts/capturas.mts "https://{slug}.turnosforbarber.com"
 *   node --env-file=.env.local scripts/capturas.mts "http://{slug}.lvh.me:3000"
 *
 * El `{slug}` se reemplaza por cada barbería. Hay que pasarlo porque
 * `NEXT_PUBLIC_ROOT_DOMAIN` en `.env.local` es el de desarrollo, y estas fotos
 * casi siempre se quieren del sitio de verdad.
 *
 * Se eligió mostrar fotos reales y no recreaciones en HTML por un motivo: una
 * recreación es un dibujo del producto, y el día que cambie el panel la página
 * de ventas empieza a mentir sin que nadie se entere. Una foto también
 * envejece, pero se vuelve a sacar con un comando —éste— y vuelve a ser cierta.
 *
 * Correrlo después de cualquier cambio visible del panel o de la página
 * pública. Las imágenes van a `public/portada/` y se commitean: la portada
 * tiene que poder mostrarlas sin depender de nada externo.
 *
 * Cómo entra al panel sin una contraseña guardada en ningún lado: le pone una
 * nueva al dueño de la demo justo antes de usarla. La llave de servicio ya
 * puede hacer eso, así que guardar además una contraseña no agregaría
 * seguridad, solo un secreto más para perder.
 */
import { mkdir } from "node:fs/promises";
import { chromium, type Locator, type Page } from "@playwright/test";

import { clienteAdmin, contrasenia } from "./lib/alta.mts";
import {
  MAIL_DEMO,
  SLUG_DEMO,
  hoyEn,
  limpiarDemo,
  sembrarJornada,
  sumarDias,
} from "./lib/demo.mts";

const raiz = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "").split(":")[0];
if (!raiz) {
  console.error("Falta NEXT_PUBLIC_ROOT_DOMAIN.");
  process.exit(1);
}

/** Por defecto contra producción: es donde la portada va a mostrar esto. */
const base = process.argv[2] ?? `https://{slug}.${raiz}`;
const en = (slug: string, ruta = "") =>
  base.includes("{slug}")
    ? base.replace("{slug}", slug) + ruta
    : `${base.replace(/\/$/, "")}${ruta}`;

const DESTINO = "public/portada";

// Un teléfono, porque es donde un barbero abre el panel entre corte y corte.
const TELEFONO = { width: 390, height: 800 };

// A escala 3, no 2. La foto se muestra bastante más chica de lo que se sacó, y
// con escala 2 la letra del panel llegaba ilegible: el problema no era la
// pantalla del que mira sino la reducción. Triplicar el pixelado del origen
// cuesta unos kilobytes y se lee.
const ESCALA = 3;

const admin = clienteAdmin();

// ============================================================================

const { data: demo } = await admin
  .from("tenants")
  .select("id, timezone")
  .eq("slug", SLUG_DEMO)
  .maybeSingle();

if (!demo) {
  console.error(
    `\nNo existe la barbería "${SLUG_DEMO}".\n` +
      "  node --env-file=.env.local scripts/barberia-demo.mts\n",
  );
  process.exit(1);
}

const tenantId = demo.id as string;
const tz = demo.timezone as string;

await mkdir(DESTINO, { recursive: true });

const navegador = await chromium.launch();
let sacadas = 0;

/**
 * Un recorte de una parte de la pantalla, no del teléfono entero.
 *
 * La secuencia explicativa muestra tres pasos uno atrás de otro, y ahí una
 * pantalla completa no sirve: a ese tamaño no se lee nada y el paso pierde lo
 * único que tenía que mostrar. Un recorte es lo que hace alguien cuando te
 * acerca el celular y te señala con el dedo.
 *
 * Sale del sitio de verdad igual que las otras: si mañana cambia la pantalla,
 * se corre el comando y vuelve a ser cierto.
 */
async function recorte(pieza: Locator, nombre: string) {
  await pieza.first().scrollIntoViewIfNeeded();
  await pieza.first().screenshot({ path: `${DESTINO}/${nombre}.png` });
  console.log(`  ✓ ${nombre}.png (recorte)`);
  sacadas++;
}

/** Una captura, con la ventana de un teléfono. */
async function foto(page: Page, url: string, nombre: string, espera?: string) {
  await page.goto(url, { waitUntil: "networkidle", timeout: 45_000 });
  if (espera) {
    await page.waitForSelector(espera, { timeout: 20_000 }).catch(() => {});
  }
  // Que terminen las animaciones de entrada antes de disparar.
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${DESTINO}/${nombre}.png` });
  console.log(`  ✓ ${nombre}.png`);
  sacadas++;
}

try {
  console.log("\n  Sembrando una jornada en la demo…");
  await limpiarDemo(admin, tenantId);
  await sembrarJornada(admin, tenantId, tz);

  const ctx = await navegador.newContext({
    viewport: TELEFONO,
    deviceScaleFactor: ESCALA,
    locale: "es-UY",
    timezoneId: tz,
  });
  const page = await ctx.newPage();

  // ---- Lo que ve el cliente -------------------------------------------------
  console.log("\n  La página pública");
  await foto(page, en(SLUG_DEMO, "/"), "publica-demo", "h1");

  /*
   * Paso 1 de la secuencia: el cliente elige la hora.
   *
   * Se toca un horario antes de disparar para que salga uno elegido, con su
   * resplandor. Una grilla sin nada elegido muestra la pantalla; con algo
   * elegido muestra a alguien usándola, que es lo que el paso cuenta.
   *
   * Y se elige un día de más adelante, no hoy: corriendo el comando de tarde,
   * hoy queda con tres o cuatro horarios sueltos y la foto muestra una barbería
   * sin lugar. Un día entero muestra la grilla como es.
   *
   * Tocar un horario acá no reserva nada: la reserva pasa en /reservar.
   */
  await page.getByRole("button", { name: /^Corte/ }).first().click();
  const barbero = page.getByRole("button", { name: "Andrés" });
  if (await barbero.count()) await barbero.click();

  const dias = page.locator('section[aria-labelledby="paso-3"] button');
  await dias.first().waitFor({ timeout: 20_000 });
  await dias.nth(Math.min(2, (await dias.count()) - 1)).click();
  await page.waitForTimeout(600);

  const libre = page
    .locator('section[aria-labelledby="paso-4"] button:not([disabled])')
    .first();
  await libre.waitFor({ timeout: 20_000 });
  await libre.click();
  await page.waitForTimeout(900);

  await recorte(page.locator('section[aria-labelledby="paso-4"]'), "paso-elegir-hora");

  // La misma pantalla en dos barberías distintas: es lo que prueba que cada
  // local se ve con su marca y no todos iguales con otro nombre.
  await foto(page, en("barberia-central", "/"), "marca-clara", "h1");
  await foto(page, en("studio-norte", "/"), "marca-oscura", "h1");

  // ---- El panel -------------------------------------------------------------
  console.log("\n  El panel");

  const { data: cuenta } = await admin.auth.admin.listUsers();
  const usuario = cuenta?.users.find((u) => u.email === MAIL_DEMO);
  if (!usuario) throw new Error(`no encontré la cuenta ${MAIL_DEMO}`);

  const clave = contrasenia();
  const { error: eClave } = await admin.auth.admin.updateUserById(usuario.id, {
    password: clave,
  });
  if (eClave) throw new Error(`no pude cambiar la clave: ${eClave.message}`);

  await page.goto(en(SLUG_DEMO, "/entrar"), { waitUntil: "networkidle" });
  await page.getByLabel("Mail").fill(MAIL_DEMO);
  await page.getByLabel("Contraseña").fill(clave);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/panel/, { timeout: 30_000 });

  const manana = sumarDias(hoyEn(tz), 1);

  // La agenda de mañana: es la pantalla donde están los botones de WhatsApp
  // para recordarle el turno a cada cliente.
  await foto(page, en(SLUG_DEMO, `/panel?d=${manana}`), "panel-agenda");

  /*
   * Paso 2 de la secuencia: el turno ya está en la agenda, con el botón que
   * abre WhatsApp al lado. Es el renglón el que cuenta el paso, así que se
   * recorta el renglón y no la pantalla entera.
   *
   * Se busca por el botón y no por posición: cuál es el primer turno con
   * Recordar depende de la hora a la que se corra el comando.
   */
  const renglon = page
    .locator("li")
    .filter({ has: page.getByRole("link", { name: "Recordar" }) })
    // Uno que haya entrado por la web, no uno cargado a mano. La jornada
    // sembrada mezcla los dos a propósito, y el paso dice "nadie tuvo que
    // anotar nada": con el cartelito de "Cargado a mano" al lado estaría
    // mostrando exactamente lo contrario.
    .filter({ hasNotText: "Cargado a mano" })
    .first();

  if (await renglon.count()) {
    /*
     * El renglón solo, recortado justo, queda como una tarjeta suelta flotando
     * en el paso. Con el de abajo se lee lo que es: un día armado, uno atrás
     * del otro. Por eso no es una foto del elemento sino una franja de alto
     * fijo que arranca en el turno que tiene el botón.
     */
    await renglon.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);

    const caja = await renglon.boundingBox();
    if (!caja) throw new Error("no pude medir el renglón de la agenda");

    await page.evaluate((y) => window.scrollBy(0, y), caja.y - 120);
    await page.waitForTimeout(400);

    await page.screenshot({
      path: `${DESTINO}/paso-agenda.png`,
      clip: { x: 0, y: 112, width: TELEFONO.width, height: 300 },
    });
    console.log("  ✓ paso-agenda.png (recorte)");
    sacadas++;
  } else {
    console.log("  ! sin ningún turno de la web con Recordar: no salió paso-agenda");
  }

  await foto(page, en(SLUG_DEMO, "/panel/cobros"), "panel-cobros");
  await foto(page, en(SLUG_DEMO, "/panel/semana"), "panel-semana");

  await ctx.close();
} catch (e) {
  console.error(`\n  ✗ ${e instanceof Error ? e.message : String(e)}\n`);
  process.exitCode = 1;
} finally {
  await navegador.close();

  // Sin esto la demo queda con la agenda llena y el próximo visitante no
  // encuentra un horario libre para tocar, que es todo el punto de tenerla.
  const borrados = await limpiarDemo(admin, tenantId);
  console.log(`\n  Demo limpia: ${borrados} turnos borrados.`);
  console.log(`  ${sacadas} capturas en ${DESTINO}/\n`);
}
