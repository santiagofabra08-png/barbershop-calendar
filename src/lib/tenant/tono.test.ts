import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { luminancia, tonoDe } from "./tono.ts";

describe("tono de la barbería", () => {
  test("los extremos", () => {
    assert.equal(luminancia("#000000"), 0);
    assert.equal(luminancia("#ffffff"), 1);
  });

  test("el verde se ve más claro que el azul con el mismo número", () => {
    // Mismo valor en hexadecimal, muy distinto brillo para el ojo. Si esto
    // fallara sería porque los canales se están promediando.
    assert.ok(luminancia("#00ff00") > luminancia("#0000ff"));
  });

  test("reconoce los fondos de las barberías que existen", () => {
    assert.equal(tonoDe("#F5F0E8"), "claro"); // Tropi
    assert.equal(tonoDe("#F2F4F3"), "claro"); // Barbería Central
    assert.equal(tonoDe("#14161A"), "oscuro"); // Studio Norte
  });

  test("un gris medio cae del lado claro", () => {
    // El corte está en 0.179, no en la mitad: un gris 50% ya admite texto
    // oscuro mejor que claro, así que el halo claro no le sirve.
    assert.equal(tonoDe("#808080"), "claro");
  });

  test("un color roto no rompe la página", () => {
    // Ante la duda, claro: es el caso común y el que nunca deja algo
    // invisible.
    assert.equal(tonoDe("azul"), "claro");
    assert.equal(tonoDe(""), "claro");
    assert.equal(tonoDe("#fff"), "claro");
  });

  test("no le molestan los espacios ni las mayúsculas", () => {
    assert.equal(tonoDe("  #14161A  "), "oscuro");
    assert.equal(tonoDe("#14161a"), "oscuro");
  });
});
