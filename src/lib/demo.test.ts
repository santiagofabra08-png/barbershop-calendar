import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { origenesDeLaPortada, protocoloDe, urlDeLaPortada } from "./demo.ts";

describe("a dónde le habla la demo", () => {
  /*
   * El bug que originó esto: en producción el dominio pelado redirige a `www`,
   * así que la portada se sirve en `https://www.dominio` mientras la variable
   * de entorno dice `dominio`. `postMessage` compara el origen entero, no
   * entregaba, y no avisaba de ninguna forma. Local no lo podía ver: ahí no
   * hay `www`.
   */
  test("incluye la variante con www, que es donde se sirve de verdad", () => {
    assert.deepEqual(origenesDeLaPortada("turnosforbarber.com"), [
      "https://turnosforbarber.com",
      "https://www.turnosforbarber.com",
    ]);
  });

  test("en desarrollo va sin certificado", () => {
    assert.deepEqual(origenesDeLaPortada("lvh.me:3000"), [
      "http://lvh.me:3000",
      "http://www.lvh.me:3000",
    ]);
  });

  // Sin dominio no hay a quién hablarle, y mandar a "*" sería peor.
  test("sin dominio configurado no hay destino", () => {
    assert.deepEqual(origenesDeLaPortada(""), []);
  });

  test("ninguno es el comodín", () => {
    for (const o of origenesDeLaPortada("turnosforbarber.com")) {
      assert.notEqual(o, "*");
    }
  });

  test("el protocolo sale del dominio", () => {
    assert.equal(protocoloDe("turnosforbarber.com"), "https");
    assert.equal(protocoloDe("lvh.me:3000"), "http");
    assert.equal(protocoloDe("localhost:3000"), "http");
  });
});

describe("el link de vuelta a la portada", () => {
  test("va al dominio pelado, que es el que se dice en voz alta", () => {
    assert.equal(
      urlDeLaPortada("turnosforbarber.com"),
      "https://turnosforbarber.com",
    );
  });

  test("en desarrollo va sin certificado", () => {
    assert.equal(urlDeLaPortada("lvh.me:3000"), "http://lvh.me:3000");
  });

  /*
   * Sin dominio no hay portada a dónde ir, y un link vacío en la franja de la
   * demo lleva a la raíz de la propia barbería: al que llegó por el link
   * suelto le prometería explicarle el producto y lo devolvería a la misma
   * página. Prefiere no ofrecerse.
   */
  test("sin dominio configurado no hay link", () => {
    assert.equal(urlDeLaPortada(""), "");
  });
});
