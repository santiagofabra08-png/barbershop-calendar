import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  linkDeWhatsApp,
  mensajeDePedido,
  mensajeDeRecordatorio,
} from "./whatsapp.ts";

const base = {
  barberia: "Tropi Barbershop",
  cliente: "Martín Rodríguez",
  servicio: "Corte clásico",
  fecha: "2026-08-11",
  hora: "15:00",
  hoy: "2026-08-10",
};

describe("el recordatorio", () => {
  test("el turno de mañana dice mañana", () => {
    const m = mensajeDeRecordatorio(base);

    assert.match(m, /tu turno mañana a las 15:00/);
    assert.match(m, /^Hola Martín!/);
    assert.match(m, /de Tropi Barbershop/);
    assert.match(m, /\(Corte clásico\)/);
    assert.match(m, /¿Confirmás que venís\?$/);
  });

  test("el turno de hoy dice hoy", () => {
    const m = mensajeDeRecordatorio({ ...base, fecha: "2026-08-10" });
    assert.match(m, /tu turno hoy a las 15:00/);
  });

  test("más adelante lleva día y mes, para que no haya dos jueves", () => {
    const m = mensajeDeRecordatorio({ ...base, fecha: "2026-08-27" });
    assert.match(m, /tu turno el jueves 27 de agosto a las 15:00/);
  });

  test("cruzar el fin de mes sigue siendo mañana", () => {
    const m = mensajeDeRecordatorio({
      ...base,
      hoy: "2026-08-31",
      fecha: "2026-09-01",
    });
    assert.match(m, /tu turno mañana a las/);
  });

  // El turno cargado a mano no tiene nombre: al que entra por la puerta un
  // martes a las tres no se le pide el mail. El mensaje tiene que seguir
  // saliendo entero.
  test("sin nombre saluda igual", () => {
    const m = mensajeDeRecordatorio({ ...base, cliente: null });
    assert.match(m, /^Hola! Te escribo de Tropi Barbershop/);
  });

  test("sin servicio no queda un paréntesis vacío", () => {
    const m = mensajeDeRecordatorio({ ...base, servicio: null });
    assert.doesNotMatch(m, /\(\)/);
    assert.match(m, /a las 15:00\./);
  });

  test("saluda por el primer nombre, con mayúscula aunque no la haya escrito", () => {
    const m = mensajeDeRecordatorio({ ...base, cliente: "martin rodriguez" });
    assert.match(m, /^Hola Martin!/);
  });

  test("un nombre de una sola palabra no se rompe", () => {
    const m = mensajeDeRecordatorio({ ...base, cliente: "Nico" });
    assert.match(m, /^Hola Nico!/);
  });
});

const pedido = {
  barberia: "Tropi Barbershop",
  cliente: "Martín Rodríguez",
  items: [{ name: "Cera mate", quantity: 2 }],
  totalCents: 129000,
  moneda: "UYU",
};

describe("el mensaje del pedido", () => {
  test("repite lo que pidió y cuánto sería", () => {
    const m = mensajeDePedido(pedido);

    assert.match(m, /^Hola Martín! Te escribo de Tropi Barbershop por tu pedido/);
    assert.match(m, /Cera mate ×2/);
    assert.match(m, /Serían \$ ?1[.,]290/);
    assert.match(m, /¿Cuándo te queda cómodo pasar a buscarlo\?$/);
  });

  test("uno solo no lleva cantidad", () => {
    const m = mensajeDePedido({
      ...pedido,
      items: [{ name: "Peine", quantity: 1 }],
    });

    assert.match(m, /pedido: Peine\./);
    assert.doesNotMatch(m, /×/);
  });

  test("dos van con y, tres con coma y con y", () => {
    const dos = mensajeDePedido({
      ...pedido,
      items: [
        { name: "Cera mate", quantity: 1 },
        { name: "Peine", quantity: 1 },
      ],
    });
    assert.match(dos, /pedido: Cera mate y Peine\./);

    const tres = mensajeDePedido({
      ...pedido,
      items: [
        { name: "Cera mate", quantity: 1 },
        { name: "Peine", quantity: 1 },
        { name: "Toalla", quantity: 1 },
      ],
    });
    assert.match(tres, /pedido: Cera mate, Peine y Toalla\./);
  });

  // Lo que no entra se cuenta en vez de desaparecer: el que lo recibe tiene
  // que poder darse cuenta de que su pedido era más largo.
  test("pasando de tres, el resto se cuenta", () => {
    const cinco = mensajeDePedido({
      ...pedido,
      items: [
        { name: "Cera mate", quantity: 1 },
        { name: "Peine", quantity: 1 },
        { name: "Toalla", quantity: 1 },
        { name: "Shampoo", quantity: 1 },
        { name: "Bálsamo", quantity: 1 },
      ],
    });

    assert.match(cinco, /Cera mate, Peine, Toalla y 2 cosas más\./);
    assert.doesNotMatch(cinco, /Shampoo|Bálsamo/);
  });

  test("cuatro dejan una sola afuera, y se dice en singular", () => {
    const cuatro = mensajeDePedido({
      ...pedido,
      items: [
        { name: "Cera mate", quantity: 1 },
        { name: "Peine", quantity: 1 },
        { name: "Toalla", quantity: 1 },
        { name: "Shampoo", quantity: 1 },
      ],
    });

    assert.match(cuatro, /y 1 cosa más\./);
  });

  test("sin nombre saluda igual", () => {
    const m = mensajeDePedido({ ...pedido, cliente: null });
    assert.match(m, /^Hola! Te escribo de/);
  });

  // No debería pasar, pero un mensaje a medias es peor que uno escueto.
  test("sin productos no queda un dos puntos colgando", () => {
    const m = mensajeDePedido({ ...pedido, items: [] });
    assert.match(m, /por tu pedido\. Serían/);
  });
});

describe("el link", () => {
  test("el teléfono va sin el + ni los espacios", () => {
    assert.equal(
      linkDeWhatsApp("+598 99 123 456"),
      "https://wa.me/59899123456",
    );
  });

  test("sin mensaje abre el chat en blanco", () => {
    assert.doesNotMatch(linkDeWhatsApp("+59899123456"), /text=/);
  });

  // Los acentos, el signo de pregunta que abre y el salto de línea rompen una
  // URL si viajan crudos, y son justo lo que tiene este mensaje.
  test("el mensaje viaja escapado", () => {
    const link = linkDeWhatsApp("+59899123456", mensajeDeRecordatorio(base));
    const texto = new URL(link).searchParams.get("text");

    assert.equal(texto, mensajeDeRecordatorio(base));
    assert.doesNotMatch(link, /[\s¿]/);
  });
});
