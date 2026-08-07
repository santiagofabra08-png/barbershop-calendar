import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

import { ARCHIVO_ACCESO } from "./barberia";
import { pngRectangulo } from "./png";
import { clienteAdmin } from "../scripts/lib/alta.mts";

/**
 * Subir la foto de un producto.
 *
 * Es lo que más falta hacía. El recorte al cuadrado pasa ENTERO en el
 * navegador —`createImageBitmap`, un canvas y `toBlob`— así que ninguna prueba
 * contra la base lo puede ver. Si un día un navegador deja de aceptar WebP, o
 * el canvas devuelve null, o el archivo preparado no llega al formulario, todo
 * lo demás sigue en verde y las fotos dejan de subirse.
 *
 * Empieza sesión de verdad, con el dueño de la barbería descartable.
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

test("carga un producto con una foto rectangular y la recorta", async ({ page }) => {
  await page.goto("/panel/productos/nuevo");

  // Lo que se espera de la imagen tiene que estar a la vista ANTES de elegir el
  // archivo. Enterarse después de que no servía es hacer el trabajo dos veces.
  await expect(page.getByText(/800 × 800/)).toBeVisible();
  await expect(page.getByText(/hasta 2 MB/)).toBeVisible();

  // Bien rectangular a propósito: el doble de ancha que de alta.
  await page.setInputFiles("#foto-elegir", {
    name: "producto.png",
    mimeType: "image/png",
    buffer: pngRectangulo(1200, 600),
  });

  // El aviso del recorte es la mitad de la promesa: nunca se rechaza por la
  // medida, se recorta Y se avisa.
  await expect(page.getByText(/La recortamos al cuadrado/)).toBeVisible({
    timeout: 15_000,
  });

  // Y la vista previa tiene que mostrar algo: si el canvas hubiera fallado,
  // el aviso podría aparecer igual y la imagen no.
  const preview = page.locator('label[for="foto-elegir"] img');
  await expect(preview).toBeVisible();

  const nombre = `Cera E2E ${Date.now().toString().slice(-6)}`;
  await page.getByLabel("Nombre").fill(nombre);
  await page.getByLabel("Precio").fill("750");
  await page.getByLabel("Cuántos hay").fill("4");

  await page.getByRole("button", { name: "Agregar producto" }).click();

  // Se comprueba contra la base y no contra la pantalla porque adónde termina
  // parado el navegador después de guardar es otro asunto —ver el bug de más
  // abajo—. Lo que esta prueba tiene que contestar es si la foto que preparó el
  // navegador llegó entera hasta el otro lado.
  const admin = clienteAdmin();

  await expect
    .poll(
      async () => {
        const { data } = await admin
          .from("products")
          .select("name, price_cents, stock, image_path")
          .eq("name", nombre)
          .maybeSingle();
        return data;
      },
      { timeout: 20_000, message: "el producto no llegó a la base" },
    )
    .toMatchObject({ price_cents: 75000, stock: 4 });

  const { data: guardado } = await admin
    .from("products")
    .select("image_path")
    .eq("name", nombre)
    .single();

  // Sin esto la prueba pasaría igual con la foto perdida: el producto se
  // guarda lo mismo y la vidriera muestra un cuadrado vacío.
  expect(guardado?.image_path, "la foto no se guardó").toMatch(
    /\/productos\/.+\.(webp|png)$/,
  );
});

/**
 * ⚠️ BUG CONOCIDO, sin resolver.
 *
 * Después de guardar, el navegador tendría que quedar en la lista de productos.
 * En cambio pasa por `/panel/productos`, rebota a `/entrar` y termina en
 * `/panel`. La persona guarda un producto y aparece en la agenda.
 *
 * Lo que ya se sabe, para no volver a empezar de cero:
 *   · Pasa igual con productos, con servicios y sin subir ninguna foto, así
 *     que no es de la subida ni del recorte.
 *   · Pasa también con la aplicación compilada, no solo en desarrollo.
 *   · La cookie de sesión es la MISMA antes y después: no se pierde.
 *   · En ese render, `sesionDelPanel()` encuentra usuario y barbería, pero la
 *     consulta de la fila del barbero devuelve cero filas SIN error. Como
 *     `/panel/…` redirige a `/entrar` cuando no hay sesión, ahí nace el rebote.
 *   · Con el subdominio fijo, el id de barbería que veía la aplicación era el
 *     de la corrida ANTERIOR —o sea, hay una capa de caché sobre esa búsqueda—.
 *     Un slug distinto por corrida mejoró las cosas pero no lo eliminó.
 *
 * Por dónde seguir: mirar qué pasa con la caché de `cargarTenant` durante una
 * acción de servidor, y si el proxy que refresca la sesión interfiere con la
 * respuesta de la acción.
 */
test.fixme("después de guardar queda en la lista de productos", async ({ page }) => {
  await page.goto("/panel/productos/nuevo");
  await page.getByLabel("Nombre").fill(`Cera ${Date.now().toString().slice(-6)}`);
  await page.getByLabel("Precio").fill("750");
  await page.getByLabel("Cuántos hay").fill("4");
  await page.getByRole("button", { name: "Agregar producto" }).click();

  await page.waitForTimeout(3000);
  expect(page.url()).toMatch(/\/panel\/productos$/);
});

test("no acepta un archivo que no es una imagen", async ({ page }) => {
  await page.goto("/panel/productos/nuevo");

  await page.setInputFiles("#foto-elegir", {
    name: "listado.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("esto no es una foto"),
  });

  // Rechazar por formato sí: un archivo que el navegador no sabe mostrar deja
  // la vidriera con un cuadrado roto.
  await expect(page.getByText(/no es una imagen de las que sirven/)).toBeVisible({
    timeout: 15_000,
  });
});

test("el catálogo deja armar un pedido", async ({ page, context }) => {
  // La vidriera es pública: se mira sin sesión, como un cliente.
  await context.clearCookies();
  await page.goto("/productos");

  await expect(
    page.getByRole("heading", { name: "Catálogo de productos" }),
  ).toBeVisible();

  // Sumar al carrito y que la barra de abajo lo cuente.
  await page.getByRole("button", { name: "Lo quiero" }).first().click();

  await expect(page.getByText(/1 producto/)).toBeVisible({ timeout: 10_000 });

  await page.getByLabel("Tu nombre").fill("Cliente E2E");
  await page.getByLabel("Teléfono").fill("099123456");

  await page.getByRole("button", { name: "Enviar el pedido" }).click();

  await expect(page).toHaveURL(/\/productos\/listo/, { timeout: 20_000 });
});
