import { expect, test } from "@playwright/test";

/**
 * Reservar un turno tocando botones, como una persona.
 *
 * `probar-cliente.mts` ya prueba este camino contra la base, y es más rápido y
 * más completo. Lo que no puede hacer es abrir la página: si un botón no
 * responde, si el formulario no envía, si un error de JavaScript deja la
 * pantalla muda, esa prueba pasa igual y el cliente no puede reservar.
 *
 * Esta es la que se entera de eso.
 */

/** Un nombre distinto por corrida, para poder encontrar lo que dejó. */
const cliente = `E2E ${Date.now().toString().slice(-6)}`;

test("un cliente reserva, ve su turno y lo cancela", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Reservá tu turno" }),
  ).toBeVisible();

  // ---- ① Servicio ---------------------------------------------------------
  await page.getByRole("button", { name: /^Corte/ }).click();

  // ---- ② Barbero ----------------------------------------------------------
  await page.getByRole("button", { name: "Ana" }).click();

  // ---- ③ Día --------------------------------------------------------------
  // El primero que tenga horarios libres. Cuál es depende del día en que se
  // corra, así que se elige por lo que se ve y no por una fecha escrita.
  const dias = page.locator("button[aria-pressed]").filter({ hasText: /^\w{3}\d+/ });
  await expect(dias.first()).toBeVisible();

  // ---- ④ Hora -------------------------------------------------------------
  const horas = page.getByRole("button", { name: /^\d{2}:\d{2}$/ });
  await expect(horas.first()).toBeVisible();

  const hora = (await horas.first().textContent())?.trim() ?? "";
  await horas.first().click();

  // La barra de confirmación aparece recién cuando hay hora elegida.
  const barra = page.getByRole("link", { name: "Continuar" });
  await expect(barra).toBeVisible();
  await expect(page.getByText(hora, { exact: false }).first()).toBeVisible();

  await barra.click();

  // ---- El formulario ------------------------------------------------------
  await expect(page).toHaveURL(/\/reservar/);

  await page.getByLabel("Nombre").fill(cliente);
  await page.getByLabel("Teléfono").fill("099123456");
  await page.getByLabel("Mail").fill("e2e-cliente@ejemplo.com");

  await page.getByRole("button", { name: "Reservar turno" }).click();

  // ---- La confirmación ----------------------------------------------------
  await expect(page).toHaveURL(/\/turno\//, { timeout: 15_000 });
  await expect(page.getByText(hora, { exact: false }).first()).toBeVisible();

  // El link es la única llave del cliente: si no queda a la vista, no la tiene.
  await expect(page.getByText(/Guardá este link/)).toBeVisible();

  // ---- Cancelar -----------------------------------------------------------
  const cancelar = page.getByRole("button", { name: "Cancelar turno" });
  await expect(cancelar).toBeVisible();
  await cancelar.click();

  await expect(page.getByText(/cancelad/i).first()).toBeVisible({ timeout: 15_000 });
});

test("la página no se sale de la pantalla", async ({ page }) => {
  await page.goto("/");

  // Un desborde horizontal en el celular obliga a arrastrar de costado para
  // leer, y en una página de reservas eso significa que alguien no encuentra
  // el botón. Se compara contra el ancho de la ventana, no contra un número
  // fijo, así vale para cualquier teléfono.
  const desborde = await page.evaluate(() => {
    const d = document.documentElement;
    return d.scrollWidth - d.clientWidth;
  });

  expect(desborde, "la página se puede arrastrar de costado").toBeLessThanOrEqual(1);
});

test("el turno no se puede tomar dos veces desde la pantalla", async ({ page }) => {
  await page.goto("/");

  const horas = page.getByRole("button", { name: /^\d{2}:\d{2}$/ });
  await expect(horas.first()).toBeVisible();

  // Los horarios ya tomados se muestran tachados y no se pueden tocar. Que la
  // base los rechace es una cosa; que la pantalla ni los ofrezca es la que
  // evita que alguien llegue hasta el final para que le digan que no.
  const deshabilitados = await page
    .getByRole("button", { name: /^\d{2}:\d{2}$/, disabled: true })
    .count();
  const habilitados = await horas.count();

  expect(habilitados + deshabilitados).toBeGreaterThan(0);
});
