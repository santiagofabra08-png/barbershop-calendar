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
import { chromium, type Page } from "@playwright/test";

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
// A escala 2 para que no se vea borroso en una pantalla buena.
const TELEFONO = { width: 390, height: 800 };

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
    deviceScaleFactor: 2,
    locale: "es-UY",
    timezoneId: tz,
  });
  const page = await ctx.newPage();

  // ---- Lo que ve el cliente -------------------------------------------------
  console.log("\n  La página pública");
  await foto(page, en(SLUG_DEMO, "/"), "publica-demo", "h1");

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
