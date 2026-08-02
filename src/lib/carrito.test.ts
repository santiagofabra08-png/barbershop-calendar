import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  carritoAJson,
  lineasDelCarrito,
  totalDelCarrito,
  type ProductoParaVender,
} from "./carrito.ts";

const cera: ProductoParaVender = {
  id: "cera",
  name: "Cera mate",
  priceCents: 40000,
  stock: 3,
};
const polvo: ProductoParaVender = {
  id: "polvo",
  name: "Polvo texturizador",
  priceCents: 55000,
  stock: 1,
};
const remera: ProductoParaVender = {
  id: "remera",
  name: "Remera del local",
  priceCents: 90000,
  stock: 0,
};

const catalogo = [cera, polvo, remera];

describe("las líneas del carrito", () => {
  test("solo salen los que tienen cantidad", () => {
    const lineas = lineasDelCarrito(catalogo, { cera: 2, polvo: 0 });

    assert.equal(lineas.length, 1);
    assert.equal(lineas[0].producto.id, "cera");
    assert.equal(lineas[0].cantidad, 2);
  });

  test("un carrito vacío no da líneas", () => {
    assert.deepEqual(lineasDelCarrito(catalogo, {}), []);
  });

  // Bajar a cero es cómo se saca algo del carrito. Si igual apareciera, el
  // ticket mostraría un renglón de $0 y la base recibiría una cantidad inválida.
  test("bajar a cero saca la línea", () => {
    assert.deepEqual(lineasDelCarrito(catalogo, { cera: 0 }), []);
  });

  // El id sobrante puede venir de un producto que el dueño sacó del catálogo
  // mientras alguien tenía la página abierta.
  test("un id que ya no está en el catálogo se ignora", () => {
    const lineas = lineasDelCarrito(catalogo, { fantasma: 5, cera: 1 });

    assert.equal(lineas.length, 1);
    assert.equal(lineas[0].producto.id, "cera");
  });

  test("salen en el orden del catálogo, no en el que se tocaron", () => {
    const lineas = lineasDelCarrito(catalogo, { remera: 1, cera: 1 });

    assert.deepEqual(
      lineas.map((l) => l.producto.id),
      ["cera", "remera"],
    );
  });
});

describe("el total del carrito", () => {
  test("multiplica precio por cantidad y suma", () => {
    // 2 × 400 + 1 × 550 = 1350
    assert.equal(totalDelCarrito(catalogo, { cera: 2, polvo: 1 }), 135000);
  });

  test("un carrito vacío da cero", () => {
    assert.equal(totalDelCarrito(catalogo, {}), 0);
  });
});

describe("lo que viaja a la base", () => {
  test("van ids y cantidades, nunca precios", () => {
    const json = carritoAJson(catalogo, { cera: 2, polvo: 1 });

    assert.deepEqual(JSON.parse(json), [
      { id: "cera", qty: 2 },
      { id: "polvo", qty: 1 },
    ]);
    // Si el precio viajara, editar el formulario compraría más barato.
    assert.ok(!json.includes("40000"));
    assert.ok(!json.includes("priceCents"));
  });

  test("un carrito vacío viaja como lista vacía, no como nada", () => {
    assert.equal(carritoAJson(catalogo, {}), "[]");
  });
});
