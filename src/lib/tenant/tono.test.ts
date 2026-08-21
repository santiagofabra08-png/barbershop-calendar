import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { contraste, legibleSobre, luminancia, tonoDe } from "./tono.ts";

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

describe("el acento cuando hace de tinta", () => {
  const BLANCO = "#FFFFFF";
  const TINTA = "#14171A";

  test("el contraste del blanco contra el negro es el máximo", () => {
    assert.equal(Math.round(contraste("#ffffff", "#000000")), 21);
    assert.equal(contraste("#ffffff", "#ffffff"), 1);
  });

  test("un acento que ya se lee no se toca", () => {
    const negro = "#1B1F24";
    assert.equal(legibleSobre(negro, BLANCO, TINTA), negro);
  });

  test("un celeste pastel se oscurece hasta que se lee", () => {
    const pastel = "#A5D8E6";
    const salida = legibleSobre(pastel, BLANCO, TINTA);

    assert.notEqual(salida, pastel);
    assert.ok(contraste(salida, BLANCO) >= 4.5, "tiene que pasar el mínimo");
  });

  test("oscurecer conserva el matiz: el azul sigue siendo azul", () => {
    const salida = legibleSobre("#A5D8E6", BLANCO, TINTA);
    const n = Number.parseInt(salida.slice(1), 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];

    assert.ok(b > r, "el azul tiene que seguir pesando más que el rojo");
    assert.ok(g > r, "y el verde también, como en el original");
  });

  test("un color imposible cae en la tinta antes que en texto invisible", () => {
    assert.equal(legibleSobre("no es un color", BLANCO, TINTA), TINTA);
  });
});
