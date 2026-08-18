import { expect, test } from "@playwright/test";

/**
 * El puente entre la demo y la página de ventas.
 *
 * Cuando alguien reserva adentro del iframe de la portada, la página del turno
 * le manda a la portada el recordatorio que le escribiría el barbero, y la
 * portada lo muestra. Es lo que cierra la explicación: el visitante ve la mitad
 * del cliente y la del barbero con el mismo turno, el que él acaba de sacar.
 *
 * Esto **solo existe en el navegador**. Son dos orígenes distintos hablándose
 * por `postMessage`, con una comprobación de origen de cada lado. Ninguna
 * prueba contra la base puede verlo: si el mensaje deja de salir, o sale a un
 * destino equivocado, todo lo demás sigue en verde y la portada se queda muda.
 *
 * Corre contra la barbería descartable y no contra la demo de verdad, para no
 * dejarle turnos de prueba adentro a la que está publicada.
 */

const PUERTO = process.env.E2E_PORT ?? "3000";
const PORTADA = `http://lvh.me:${PUERTO}`;

/** Reserva un turno y devuelve la dirección de la página del turno. */
async function reservar(page: import("@playwright/test").Page): Promise<string> {
  await page.goto("/");
  await page.getByRole("button", { name: /^Corte/ }).click();
  await page.getByRole("button", { name: "Ana" }).click();

  // Esperar la tira de días antes de buscar horas: sin esto la grilla
  // todavía no terminó de dibujarse y el primer horario no existe.
  const dias = page.locator("button[aria-pressed]").filter({ hasText: /^\w{3}\d+/ });
  await expect(dias.first()).toBeVisible();

  // El primero que esté LIBRE. Los ocupados se siguen dibujando, tachados y
  // deshabilitados, así que `first()` a secas agarra el que reservó la prueba
  // anterior y se queda esperando un click que nunca va a poder darse.
  const horas = page
    .locator("button:not([disabled])")
    .filter({ hasText: /^\d{2}:\d{2}$/ });
  await expect(horas.first()).toBeVisible();
  await horas.first().click();

  await page.getByRole("link", { name: "Continuar" }).click();
  await expect(page).toHaveURL(/\/reservar/);

  await page.getByLabel("Nombre").fill(`Vitrina ${Date.now().toString().slice(-5)}`);
  await page.getByLabel("Teléfono").fill("099123456");
  await page.getByLabel("Mail").fill("e2e-vitrina@ejemplo.com");
  await page.getByRole("button", { name: "Reservar turno" }).click();

  await expect(page).toHaveURL(/\/turno\//, { timeout: 15_000 });
  return page.url();
}

test("la página del turno le pasa el recordatorio a la portada", async ({ page }) => {
  const urlTurno = await reservar(page);

  // Desde la portada, que es el único origen al que la demo le habla.
  await page.goto(PORTADA);

  const mensaje = await page.evaluate(async (src) => {
    return await new Promise<string | null>((resolve) => {
      const t = setTimeout(() => resolve(null), 20000);

      window.addEventListener("message", (e) => {
        const d = e.data as { tipo?: string; mensaje?: string } | null;
        if (d && typeof d.mensaje === "string" && d.tipo?.includes("turno")) {
          clearTimeout(t);
          resolve(d.mensaje);
        }
      });

      const marco = document.createElement("iframe");
      marco.src = src;
      document.body.appendChild(marco);
    });
  }, urlTurno);

  assertRecordatorio(mensaje);
});

function assertRecordatorio(mensaje: string | null) {
  expect(mensaje, "la demo tiene que avisarle a la portada").not.toBeNull();
  // El texto sale de la función de verdad, con el nombre del local y la hora
  // del turno: si algún día se reemplazara por un ejemplo escrito a mano, esto
  // seguiría pasando, así que lo que se mira es que traiga los datos reales.
  expect(mensaje).toContain("Barbería de Prueba");
  expect(mensaje).toContain("¿Confirmás que venís?");
}

test("fuera de un iframe no le habla a nadie", async ({ page }) => {
  const urlTurno = await reservar(page);

  // La misma página abierta derecho, sin nadie que la contenga. No tiene por
  // qué mandar nada, y si lo hiciera sería a una ventana que no es la suya.
  const hubo = await page.evaluate(() => {
    return new Promise<boolean>((resolve) => {
      let visto = false;
      window.addEventListener("message", () => { visto = true; });
      setTimeout(() => resolve(visto), 2500);
    });
  });

  expect(hubo, "no debería mandarse ningún mensaje").toBe(false);
  expect(page.url()).toBe(urlTurno);
});

/*
 * El lado receptor —que la portada pinte el mensaje y descarte el que viene de
 * otro origen— no se puede probar acá, y conviene decir por qué en vez de
 * dejar una prueba que pasa sin probar nada.
 *
 * La portada vive en el dominio pelado, y en desarrollo ese host lo ocupa
 * `DEV_TENANT_SLUG`: `lvh.me` muestra una barbería, no la página de ventas.
 * Al vaciar esa variable la portada aparece, pero entonces reservar rompe:
 * después del redirect la aplicación no resuelve la barbería y la página del
 * turno responde "acá no hay nada", aunque el mismo link pedido por HTTP
 * devuelve el turno bien. Es el bug de caché sobre `cargarTenant` que ya está
 * anotado como abierto, y arreglarlo es otra tarea.
 *
 * Mientras tanto el receptor se verifica contra una compilación de producción
 * servida a mano, que es donde sí hidrata. Quedó comprobado que muestra el
 * mensaje y que no se desborda ni en 390px ni en 1280px.
 */
test.fixme("la portada ignora un mensaje que viene de otro origen", async ({ page }) => {
  await page.goto(PORTADA);

  /*
   * Primero: comprobar que la portada está viva.
   *
   * Esta prueba afirma que algo NO aparece, y eso pasa solo si el componente
   * nunca se montó. Ya pasó: corría contra la página de una barbería, donde no
   * existe ninguna vitrina, y estaba en verde sin probar nada. El conmutador es
   * React puro, así que si responde es que la portada hidrató.
   */
  const marco = page.locator("iframe[title*=\"demostración\"]");
  await marco.waitFor({ timeout: 30_000 });
  const anchoAntes = (await marco.boundingBox())!.width;
  await page.getByRole("button", { name: "Computadora" }).click();
  await page.waitForTimeout(600);
  const anchoDespues = (await marco.boundingBox())!.width;
  expect(
    Math.abs(anchoAntes - anchoDespues),
    "la portada tiene que estar hidratada o esta prueba no prueba nada",
  ).toBeGreaterThan(20);

  // Un mensaje bien formado pero mandado por la propia portada, o sea desde un
  // origen que no es el de la demo. Tiene que rebotar: si no, cualquier
  // pestaña podría dibujarle texto propio a la página de ventas.
  await page.evaluate(() => {
    window.postMessage(
      { tipo: "turno-reservado-en-la-demo", mensaje: "TEXTO INTRUSO" },
      window.location.origin,
    );
  });

  await page.waitForTimeout(1000);
  await expect(page.getByText("TEXTO INTRUSO")).toHaveCount(0);
});
