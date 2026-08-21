import { expect, test } from "@playwright/test";

/**
 * El detrás de escena: el panel de verdad, sin cuenta y sin nada que escriba.
 *
 * Dos cosas que solo se pueden comprobar abriendo el navegador:
 *
 * ⚠️ **Que no exista en ninguna barbería que no sea la demo.** Es lo primero
 * que se prueba y lo más importante que hay acá. `/detras` es una dirección
 * que existe en el dominio de toda barbería que use esto, y adentro hay
 * material de venta nuestro con el nombre de otra barbería. La prueba corre
 * contra la barbería descartable, que es exactamente el caso de un cliente que
 * paga.
 *
 * **Que no haya un solo formulario.** El argumento entero de esta página es
 * que no puede escribir porque no hay con qué. Eso no lo garantiza ninguna
 * revisión: lo garantiza contarlos.
 */

const PUERTO = process.env.E2E_PORT ?? "3000";
const DEMO = `http://demo.lvh.me:${PUERTO}`;

test("en una barbería que no es la demo, el detrás de escena no existe", async ({
  page,
}) => {
  const r = await page.goto("/detras");
  expect(r?.status()).toBe(404);

  const guia = await page.goto("/detras/guia");
  expect(guia?.status()).toBe(404);

  const tema = await page.goto("/detras/guia/5");
  expect(tema?.status()).toBe(404);
});

test("no hay ni un formulario ni un botón que mande algo", async ({ page }) => {
  await page.goto(`${DEMO}/detras`);

  // Ni un `<form>`: si algún día alguien reusa un componente del panel que
  // trae su Server Action adentro, esto lo agarra el mismo día.
  await expect(page.locator("form")).toHaveCount(0);

  // Y los botones que se ven ("No vino", el × del bloqueo, "Recordar") están
  // ahí para que se entienda qué hace el panel, no para tocarlos.
  //
  // Scope a `main`: en desarrollo, Next inyecta su propio botón de herramientas
  // al final del `body`, y no es nuestro ni está en producción.
  const botones = page.locator("main button");
  const cuantos = await botones.count();
  expect(cuantos).toBeGreaterThan(0);
  for (let i = 0; i < cuantos; i++) {
    await expect(botones.nth(i)).toBeDisabled();
  }
});

test("la agenda es la de verdad: turnos, huecos y la línea de Ahora", async ({
  page,
}) => {
  await page.goto(`${DEMO}/detras`);

  await expect(page.getByText("Martín Rodríguez")).toBeVisible();
  await expect(page.getByText("Almuerzo")).toBeVisible();
  await expect(page.getByText(/min libres/).first()).toBeVisible();
  await expect(page.getByText("Ahora")).toBeVisible();

  // El botón dice cuál de los dos es, y esa regla se ve entera en esta
  // pantalla: los de la mañana ya pasaron, el de las cinco todavía no.
  await expect(page.getByRole("button", { name: "WhatsApp" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Recordar" }).first()).toBeVisible();
});

test("el mensaje del chat es el del turno que se ve arriba", async ({ page }) => {
  await page.goto(`${DEMO}/detras`);

  // No es un texto de ejemplo escrito a mano: sale de `mensajeDeRecordatorio`
  // con los datos del último turno del día.
  await expect(page.getByText(/Hola Agustín!/)).toBeVisible();
  await expect(page.getByText(/a las 17:00/)).toBeVisible();
  await expect(page.getByText(/¿Confirmás que venís\?/)).toBeVisible();
});

test("la guía se puede leer entera sin cuenta", async ({ page }) => {
  await page.goto(`${DEMO}/detras`);
  await page.getByRole("link", { name: /Leer la guía/ }).click();
  await expect(page).toHaveURL(/\/detras\/guia$/);

  const temas = page.locator("main ol").getByRole("link");
  await expect(temas).toHaveCount(13);

  await temas.nth(6).click();
  await expect(page).toHaveURL(/\/detras\/guia\/7$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Horarios");
  await expect(page.locator("body")).not.toContainText("**");
});

test("nada se sale de la pantalla del celular", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "celular", "Solo en el celular.");

  for (const ruta of ["/detras", "/detras/guia", "/detras/guia/9"]) {
    await page.goto(`${DEMO}${ruta}`);
    const ancho = await page.evaluate(
      () => document.documentElement.scrollWidth,
    );
    const pantalla = page.viewportSize()!.width;
    expect(ancho, `${ruta} se sale a lo ancho`).toBeLessThanOrEqual(pantalla + 1);
  }
});
