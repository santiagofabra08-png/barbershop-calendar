/**
 * El formulario de la portada, de punta a punta y contra producción.
 *
 *   node --env-file=.env.local scripts/probar-solicitud.mjs
 *   node --env-file=.env.local scripts/probar-solicitud.mjs https://otro.sitio
 *
 * Es la única prueba que ejercita el camino completo de una venta: llena el
 * formulario en el sitio de verdad, comprueba que la fila llegó a la base con
 * el teléfono normalizado, y verifica que la validación rechaza lo que tiene
 * que rechazar.
 *
 * **Manda un mail de aviso de verdad**, porque ése es justamente el eslabón que
 * puede fallar en silencio: la solicitud se guarda igual aunque el correo no
 * salga, así que sin mirar la bandeja no hay forma de saberlo. El asunto va a
 * decir "Quieren probarlo: PRUEBA …".
 *
 * La solicitud de prueba se borra al terminar, incluso si algo falla.
 *
 * Correrlo después de cada despliegue que toque la portada o el correo.
 */
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const SITIO = process.argv[2] ?? "https://turnosforbarber.com/";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const marca = `PRUEBA ${Date.now().toString().slice(-6)}`;
let ok = 0;
let mal = 0;
const chequeo = (t, c) => {
  console.log(`  ${c ? "✓" : "✗"} ${t}`);
  if (c) ok++;
  else mal++;
};

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });

try {
  await p.goto(SITIO, { waitUntil: "networkidle" });

  // ---- El precio -----------------------------------------------------------
  const bloque = await p.locator("#precio").innerText();
  console.log("\n  El precio dice:");
  console.log(
    bloque
      .split("\n")
      .slice(0, 5)
      .map((l) => "    " + l)
      .join("\n"),
  );
  chequeo("muestra el precio en dólares", /US\$|U\$S|\$\s?14/.test(bloque));
  chequeo("muestra también pesos", /por mes/.test(bloque) && /unos/.test(bloque));

  // ---- El formulario -------------------------------------------------------
  console.log("\n  El formulario");
  await p.locator("#empezar").scrollIntoViewIfNeeded();
  // Acotado a la sección: "Teléfono" y "Mail" son etiquetas que aparecen más
  // de una vez en la página, y sin acotar Playwright no sabe cuál es cuál.
  const form = p.locator("#empezar");
  await form.getByLabel("Tu barbería").fill(marca);
  await form.getByLabel("Tu nombre").fill("Prueba Automática");
  await form.getByLabel("Teléfono").fill("099 123 456");
  await form.getByLabel("Mail").fill("prueba@ejemplo.com");
  await form
    .getByLabel(/Algo que quieras contar/)
    .fill("Esto lo mandó una prueba automática. Se borra solo.");

  await form.getByRole("button", { name: /Empezar los/ }).click();

  await p.waitForSelector("text=Listo.", { timeout: 25_000 }).catch(() => {});
  const texto = await p.locator("#empezar").innerText();
  chequeo("la pantalla confirma que se envió", texto.includes("Listo"));

  // ---- ¿Llegó a la base? ---------------------------------------------------
  const { data: fila } = await admin
    .from("signup_requests")
    .select("shop_name, contact_name, phone, email, message, status")
    .eq("shop_name", marca)
    .maybeSingle();

  chequeo("la solicitud quedó guardada", !!fila);
  chequeo("el teléfono se guardó normalizado", fila?.phone === "+59899123456");
  chequeo("arranca en 'new'", fila?.status === "new");
  chequeo("guardó el mensaje opcional", !!fila?.message);

  if (fila) console.log(`\n    ${JSON.stringify(fila, null, 2).split("\n").join("\n    ")}`);

  // ---- Validación: no deja mandar cualquier cosa ---------------------------
  console.log("\n  La validación");
  await p.reload({ waitUntil: "networkidle" });
  await p.locator("#empezar").scrollIntoViewIfNeeded();
  await form.getByLabel("Tu barbería").fill("X");
  await form.getByLabel("Tu nombre").fill("A");
  await form.getByLabel("Teléfono").fill("123");
  await form.getByLabel("Mail").fill("no-es-un-mail");
  await form.getByRole("button", { name: /Empezar los/ }).click();
  await p.waitForTimeout(3000);

  const conErrores = await p.locator("#empezar").innerText();
  chequeo("rechaza el nombre de barbería corto", /nombre de tu barbería/i.test(conErrores));
  chequeo("rechaza el teléfono corto", /Faltan números|celular/i.test(conErrores));
  chequeo("rechaza el mail sin arroba", /@/.test(conErrores));
  chequeo("no dice que salió bien", !conErrores.includes("Listo."));
} catch (e) {
  console.error(`\n  ✗ ${e.message.split("\n")[0]}`);
  mal++;
} finally {
  await b.close();
  const { data: borradas } = await admin
    .from("signup_requests")
    .delete()
    .eq("shop_name", marca)
    .select("id");
  console.log(`\n  Limpieza: ${borradas?.length ?? 0} solicitud de prueba borrada.`);
  console.log(`\n  ${ok} bien, ${mal} mal\n`);
}
