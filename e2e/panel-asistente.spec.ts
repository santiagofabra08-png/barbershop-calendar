import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

import { ARCHIVO_ACCESO } from "./barberia";

/**
 * La lista de primeros pasos y el botón de ayuda.
 *
 * Las dos piezas se apoyan en funciones puras que ya tienen sus pruebas
 * —`src/lib/panel/primeros-pasos.test.ts` y `src/lib/guia.test.ts`—, así que
 * acá no se vuelve a probar la lógica. Lo que solo se puede ver abriendo el
 * panel de verdad es otra cosa: que el bloque aparezca arriba de la agenda,
 * que los links lleven a la pantalla que dicen, que el `?` sepa dónde estás, y
 * que nada de eso se salga de la pantalla de un celular.
 *
 * La barbería descartable de `e2e/barberia.ts` viene con dirección, dos
 * servicios y los dos barberos con horario, y sin logo ni WhatsApp. O sea que
 * la lista tiene que mostrar exactamente dos pasos: eso es lo que la vuelve
 * una afirmación y no una impresión.
 */

const acceso: { mail: string; clave: string } = JSON.parse(
  readFileSync(ARCHIVO_ACCESO, "utf8"),
);

test.beforeEach(async ({ page }) => {
  await page.goto("/entrar");
  await page.getByLabel("Mail").fill(acceso.mail);
  await page.getByLabel("Contraseña").fill(acceso.clave);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/panel/, { timeout: 15_000 });
});

test("la lista de primeros pasos dice justo lo que falta", async ({ page }) => {
  await page.goto("/panel");

  const bloque = page.getByRole("region", { name: /armar tu página/i });
  await expect(bloque).toBeVisible();

  // Dos de cinco: le faltan el logo y el WhatsApp, y nada más.
  await expect(bloque).toContainText("Van 3 de 5");
  await expect(bloque.getByRole("link")).toHaveCount(2);
  await expect(bloque.getByText("El logo del local")).toBeVisible();
  await expect(bloque.getByText("El WhatsApp del local")).toBeVisible();

  // Los pasos que ya están hechos no se dibujan tachados: no se dibujan.
  await expect(bloque.getByText("La dirección")).toHaveCount(0);
  await expect(bloque.getByText("El horario de cada barbero")).toHaveCount(0);
});

test("cada paso lleva a la pantalla donde se arregla", async ({ page }) => {
  await page.goto("/panel");

  await page.getByRole("link", { name: /El logo del local/ }).click();
  await expect(page).toHaveURL(/\/panel\/ajustes/);

  // Y lo que promete el paso tiene que estar ahí: un link que lleva a una
  // pantalla donde no está lo que fuiste a buscar es peor que no tener link.
  await expect(page.getByText(/logo/i).first()).toBeVisible();
});

test("el bloque va arriba de la agenda, no perdido abajo", async ({ page }) => {
  await page.goto("/panel");

  const bloque = page.getByRole("region", { name: /armar tu página/i });
  const titulo = page.getByRole("heading", { level: 1 });

  const caja = await bloque.boundingBox();
  const cajaTitulo = await titulo.boundingBox();
  expect(caja).not.toBeNull();
  expect(cajaTitulo).not.toBeNull();
  expect(caja!.y).toBeLessThan(cajaTitulo!.y);
});

test("nada se sale de la pantalla del celular", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "celular", "Solo en el celular.");

  for (const ruta of ["/panel", "/panel/ayuda", "/panel/ayuda/5"]) {
    await page.goto(ruta);
    const ancho = await page.evaluate(
      () => document.documentElement.scrollWidth,
    );
    const pantalla = page.viewportSize()!.width;
    expect(ancho, `${ruta} se sale a lo ancho`).toBeLessThanOrEqual(pantalla + 1);
  }
});

test("el ? abre la ayuda de la pantalla donde estás", async ({ page }) => {
  await page.goto("/panel/cobros");
  await page.getByRole("link", { name: "Ayuda de esta pantalla" }).click();
  await expect(page).toHaveURL(/\/panel\/ayuda\/5$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Cobros");

  await page.goto("/panel/horarios");
  await page.getByRole("link", { name: "Ayuda de esta pantalla" }).click();
  await expect(page).toHaveURL(/\/panel\/ayuda\/7$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Horarios",
  );
});

test("adentro de la ayuda el ? no se dibuja", async ({ page }) => {
  await page.goto("/panel/ayuda");
  await expect(
    page.getByRole("link", { name: "Ayuda de esta pantalla" }),
  ).toHaveCount(0);
});

test("la guía se lee entera, con sus trece temas y sin Markdown crudo", async ({
  page,
}) => {
  await page.goto("/panel/ayuda");

  // Scope al `ol` de la página: la barra de secciones del celular también es
  // una lista de links y se contaría junto con los temas.
  const temas = page.locator("main ol").getByRole("link");
  await expect(temas).toHaveCount(13);

  await page.goto("/panel/ayuda/4");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Agenda");

  // Si el renderizador no entendiera algo, los asteriscos de la negrita
  // quedarían escritos en la pantalla.
  await expect(page.locator("body")).not.toContainText("**");

  // Y las piezas del Markdown tienen que haberse convertido en piezas de
  // verdad, no en párrafos.
  await expect(page.getByRole("heading", { level: 3 }).first()).toBeVisible();
  await expect(page.getByRole("listitem").first()).toBeVisible();
});

test("se puede pasar de un tema al siguiente sin volver al índice", async ({
  page,
}) => {
  await page.goto("/panel/ayuda/4");
  await page.getByRole("link", { name: /Cobros y cierre de caja ›/ }).click();
  await expect(page).toHaveURL(/\/panel\/ayuda\/5$/);
  await page.getByRole("link", { name: /‹ Agenda/ }).click();
  await expect(page).toHaveURL(/\/panel\/ayuda\/4$/);
});
