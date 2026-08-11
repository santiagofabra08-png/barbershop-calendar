import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

import { ARCHIVO_ACCESO } from "./barberia";

/**
 * El botón de WhatsApp de la agenda, abierto de verdad.
 *
 * El mensaje se arma en un módulo puro que ya tiene sus propias pruebas, así
 * que lo que falta cubrir no es el texto: es que **llegue al `href`**. Entre la
 * función y el botón hay una condición (`yaEmpezo`), un `tenant` que tiene que
 * traer el nombre, y un turno que tiene que traer el teléfono. Cualquiera de
 * las tres puede fallar sin que se caiga un solo test de unidad.
 *
 * Esta prueba nace de un reporte concreto: "cargo un turno a mano, toco
 * WhatsApp y no aparece nada". Las dos mitades de abajo son las dos lecturas
 * posibles de esa frase, y separarlas es lo único que dice cuál era.
 */

const acceso: { mail: string; clave: string } = JSON.parse(
  readFileSync(ARCHIVO_ACCESO, "utf8"),
);

/**
 * Una hora libre, distinta en cada proyecto.
 *
 * Escritorio y celular corren contra la MISMA barbería, uno detrás del otro.
 * Con la hora fija, el segundo intentaba cargar un turno donde el primero ya
 * había dejado uno, la base lo rechazaba por superposición —que es justo lo
 * que tiene que hacer— y la prueba fallaba por una razón que no tenía nada que
 * ver con lo que mide. Pasaban solas y fallaban juntas, que es la peor forma
 * de fallar.
 *
 * Determinista y no al azar: una prueba que elige horarios sorteando falla una
 * de cada veinte corridas y nadie la puede reproducir.
 */
function horaLibre(proyecto: string, base: number): string {
  const corrimiento = proyecto === "celular" ? 1 : 0;
  return `${String(base + corrimiento).padStart(2, "0")}:00`;
}

/** "YYYY-MM-DD" en la zona de la barbería, corriendo el día que corra. */
function dia(offset: number): string {
  const hoy = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Montevideo" }),
  );
  hoy.setDate(hoy.getDate() + offset);
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
}

async function entrar(page: import("@playwright/test").Page) {
  await page.goto("/entrar");
  await page.getByLabel("Mail").fill(acceso.mail);
  await page.getByLabel("Contraseña").fill(acceso.clave);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/panel/, { timeout: 15_000 });
}

/**
 * Carga un turno a mano en el día que se le diga y devuelve el nombre, que es
 * con lo que se lo encuentra después en la tira.
 */
async function cargarTurno(
  page: import("@playwright/test").Page,
  fecha: string,
  hora: string,
): Promise<string> {
  const nombre = `Cliente ${Date.now().toString().slice(-6)}`;

  await page.goto(`/panel?d=${fecha}`);

  // "Cargar un turno" y "Bloquear un rato" son dos `details` plegados, y los
  // dos tienen campos de hora. Se abre el que corresponde y todo lo demás se
  // busca adentro de él, o el selector encuentra los dos.
  const plegable = page.locator("details", {
    has: page.getByText("Cargar un turno"),
  });
  await plegable.getByText("Cargar un turno").click();

  await plegable.getByLabel("Hora").fill(hora);
  await plegable.getByLabel("Nombre").fill(nombre);
  await plegable.getByLabel("Teléfono").fill("099123456");
  await plegable.getByRole("button", { name: "Cargar turno" }).click();

  await expect(page.getByText(nombre)).toBeVisible({ timeout: 15_000 });
  return nombre;
}

/**
 * El botón de WhatsApp del turno que se llama así.
 *
 * Se busca por posición y no por nombre a propósito: el nombre es justamente
 * lo que esta prueba tiene que verificar. Buscarlo por "Recordar" haría que la
 * prueba pase por definición.
 */
function botonDe(page: import("@playwright/test").Page, nombre: string) {
  return page
    .locator("li", { has: page.getByText(nombre, { exact: true }) })
    .locator('a[href*="wa.me"]')
    .last();
}

test.beforeEach(async ({ page }) => {
  await entrar(page);
});

test("un turno que todavía no pasó abre WhatsApp con el recordatorio escrito", async ({
  page,
}, info) => {
  const hora = horaLibre(info.project.name, 15);
  const nombre = await cargarTurno(page, dia(1), hora);

  const boton = botonDe(page, nombre);

  // La etiqueta es la mitad de la función: dice cuál de los dos botones es
  // antes de tocarlo. Sin esto, un chat en blanco no se distingue de un bug.
  await expect(boton).toHaveText("Recordar");

  const href = await boton.getAttribute("href");
  expect(href).toBeTruthy();

  const texto = new URL(href!).searchParams.get("text");
  expect(texto, "el mensaje tiene que viajar en el link").not.toBeNull();

  // El nombre del local sale del tenant, la hora del turno, y "mañana" de
  // comparar con hoy. Que estén los tres es lo que prueba que el cableado
  // completo funciona y no solo la función.
  expect(texto).toContain("Barbería de Prueba");
  expect(texto).toContain(`mañana a las ${hora}`);
  expect(texto).toContain("¿Confirmás que venís?");

  // El teléfono viaja normalizado, que es lo que hace que el link abra el chat
  // con la persona y no un chat vacío.
  expect(href).toContain("wa.me/59899123456");
});

test("el pedido de la vidriera abre WhatsApp con lo que pidió adentro", async ({
  page,
  context,
}) => {
  // La vidriera es pública, así que primero hay que dejar de ser el dueño.
  await context.clearCookies();

  const nombre = `Pedido ${Date.now().toString().slice(-6)}`;

  await page.goto("/productos");
  await page.getByRole("button", { name: "Lo quiero" }).first().click();
  await expect(page.getByText(/1 producto/)).toBeVisible({ timeout: 10_000 });

  await page.getByLabel("Tu nombre").fill(nombre);
  await page.getByLabel("Teléfono").fill("099123456");
  await page.getByRole("button", { name: "Enviar el pedido" }).click();
  await expect(page).toHaveURL(/\/productos\/listo/, { timeout: 20_000 });

  await entrar(page);
  await page.goto("/panel/pedidos");

  const boton = page
    .locator("li", { has: page.getByText(nombre, { exact: true }) })
    .locator('a[href*="wa.me"]')
    .last();

  const href = await boton.getAttribute("href");
  const texto = new URL(href!).searchParams.get("text");

  expect(texto, "el mensaje tiene que viajar en el link").not.toBeNull();
  expect(texto).toContain("Barbería de Prueba");
  expect(texto).toContain("por tu pedido");
  // El producto de la barbería de prueba. Que aparezca es lo que demuestra que
  // los renglones del pedido llegaron hasta el mensaje y no solo el total.
  expect(texto).toContain("Cera de prueba");
  expect(texto).toContain("Serían");
  expect(texto).toContain("¿Cuándo te queda cómodo pasar a buscarlo?");
  expect(href).toContain("wa.me/59899123456");
});

test("un turno que ya empezó abre el chat en blanco, a propósito", async ({
  page,
}, info) => {
  // Es exactamente lo que pasa al cargar a mano al que entró por la puerta:
  // se le pone la hora a la que llegó, que ya pasó. El chat abre vacío porque
  // un recordatorio ahí llega tarde, y eso se parece mucho a que esté roto.
  const nombre = await cargarTurno(page, dia(-1), horaLibre(info.project.name, 10));
  const boton = botonDe(page, nombre);

  // Y acá dice otra cosa, que es lo que avisa que el chat va a abrir vacío.
  await expect(boton).toHaveText("WhatsApp");
  expect(await boton.getAttribute("href")).toBe("https://wa.me/59899123456");
});
