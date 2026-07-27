import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  formatTelefono,
  validarCliente,
  validarEmail,
  validarNombre,
  validarTelefono,
} from "./validation.ts";

describe("nombre", () => {
  const validos: [string, string][] = [
    ["Facundo", "Facundo"],
    ["Juan Pérez", "Juan Pérez"],
    ["  Ana  María  ", "Ana María"], // espacios de más se limpian
    ["Ñandú", "Ñandú"],
    ["Jo", "Jo"],
    ["D'Angelo", "D'Angelo"],
    ["Luis 2", "Luis 2"],
  ];
  for (const [entrada, esperado] of validos) {
    test(`acepta ${JSON.stringify(entrada)}`, () => {
      const r = validarNombre(entrada);
      assert.equal(r.ok, true);
      assert.equal(r.ok && r.valor, esperado);
    });
  }

  const invalidos = [
    ["", "vacío"],
    ["   ", "solo espacios"],
    ["a", "una sola letra"],
    ["123456", "solo números"],
    ["...", "solo símbolos"],
    ["@@@", "solo arrobas"],
    ["1", "un dígito"],
    ["x".repeat(61), "demasiado largo"],
  ] as const;
  for (const [entrada, caso] of invalidos) {
    test(`rechaza ${caso}`, () => {
      const r = validarNombre(entrada);
      assert.equal(r.ok, false, `debería rechazar ${JSON.stringify(entrada)}`);
      assert.ok(!r.ok && r.error.length > 0, "tiene que explicar el problema");
    });
  }
});

describe("teléfono", () => {
  // Todas estas son la misma persona escribiendo distinto.
  const mismos = [
    "099123456",
    "099 123 456",
    "099-123-456",
    "+598 99 123 456",
    "59899123456",
    "0059899123456",
    "(099) 123456",
    "99123456",
  ];
  for (const entrada of mismos) {
    test(`normaliza ${JSON.stringify(entrada)} a +59899123456`, () => {
      const r = validarTelefono(entrada);
      assert.equal(r.ok, true, `debería aceptar ${entrada}`);
      assert.equal(r.ok && r.valor, "+59899123456");
    });
  }

  test("acepta fijo de Montevideo", () => {
    const r = validarTelefono("2400 1234");
    assert.equal(r.ok && r.valor, "+59824001234");
  });

  test("acepta fijo del interior", () => {
    const r = validarTelefono("4322 1234");
    assert.equal(r.ok && r.valor, "+59843221234");
  });

  const invalidos = [
    ["", "vacío"],
    ["   ", "solo espacios"],
    ["099", "muy corto"],
    ["09912", "corto"],
    ["0991234567890", "muy largo"],
    ["9912345", "un dígito de menos"],
    ["991234567", "un dígito de más"],
    ["abcdefghi", "letras"],
    ["099abc456", "letras en el medio"],
    ["099-123-45a", "una letra al final"],
    ["11123456", "prefijo inexistente en Uruguay"],
    ["71234567", "prefijo inexistente"],
    ["00000000", "todos ceros"],
    ["+1 555 123 4567", "número de otro país"],
  ] as const;
  for (const [entrada, caso] of invalidos) {
    test(`rechaza ${caso}: ${JSON.stringify(entrada)}`, () => {
      const r = validarTelefono(entrada);
      assert.equal(r.ok, false, `debería rechazar ${JSON.stringify(entrada)}`);
      assert.ok(!r.ok && r.error.length > 0);
    });
  }

  test("se muestra como se lee acá", () => {
    assert.equal(formatTelefono("+59899123456"), "099 123 456");
    assert.equal(formatTelefono("+59824001234"), "2400 1234");
  });
});

describe("mail", () => {
  const validos: [string, string][] = [
    ["santiago@gmail.com", "santiago@gmail.com"],
    ["  Santiago@Gmail.COM  ", "santiago@gmail.com"], // se normaliza
    ["a.b+etiqueta@sub.dominio.com.uy", "a.b+etiqueta@sub.dominio.com.uy"],
    ["nombre_apellido@empresa.uy", "nombre_apellido@empresa.uy"],
    ["x@y.io", "x@y.io"],
  ];
  for (const [entrada, esperado] of validos) {
    test(`acepta ${JSON.stringify(entrada)}`, () => {
      const r = validarEmail(entrada);
      assert.equal(r.ok, true, `debería aceptar ${entrada}`);
      assert.equal(r.ok && r.valor, esperado);
    });
  }

  const invalidos = [
    ["", "vacío"],
    ["   ", "solo espacios"],
    ["sinarroba.com", "sin @"],
    ["dos@@arrobas.com", "dos @"],
    ["@gmail.com", "sin nada antes del @"],
    ["santiago@", "sin dominio"],
    ["santiago@gmail", "dominio sin punto"],
    ["santiago@gmail.c", "terminación de una letra"],
    ["santiago@gmail.123", "terminación numérica"],
    ["santi ago@gmail.com", "espacio en el medio"],
    ["santiago@gmail..com", "puntos seguidos"],
    [".santiago@gmail.com", "punto al principio"],
    ["santiago.@gmail.com", "punto antes del @"],
    ["santiago@.gmail.com", "punto después del @"],
    ["santiago@gmail.com.", "punto al final"],
    ["santiago@-gmail.com", "guion al principio del dominio"],
    ["no-es-un-mail", "texto suelto"],
  ] as const;
  for (const [entrada, caso] of invalidos) {
    test(`rechaza ${caso}: ${JSON.stringify(entrada)}`, () => {
      const r = validarEmail(entrada);
      assert.equal(r.ok, false, `debería rechazar ${JSON.stringify(entrada)}`);
      assert.ok(!r.ok && r.error.length > 0);
    });
  }
});

describe("los tres juntos", () => {
  test("acepta y normaliza un cliente real", () => {
    const r = validarCliente({
      nombre: "  Juan  Pérez ",
      telefono: "099 123 456",
      email: "  Juan@Gmail.com ",
    });
    assert.equal(r.ok, true);
    assert.deepEqual(r.ok && r.valores, {
      nombre: "Juan Pérez",
      telefono: "+59899123456",
      email: "juan@gmail.com",
    });
  });

  test("devuelve los tres errores juntos, no de a uno", () => {
    const r = validarCliente({ nombre: "", telefono: "abc", email: "nada" });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.ok(r.errores.nombre, "falta el error de nombre");
    assert.ok(r.errores.telefono, "falta el error de teléfono");
    assert.ok(r.errores.email, "falta el error de mail");
  });

  test("señala solo el campo que está mal", () => {
    const r = validarCliente({
      nombre: "Facundo",
      telefono: "099123456",
      email: "roto@",
    });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.errores.nombre, undefined);
    assert.equal(r.errores.telefono, undefined);
    assert.ok(r.errores.email);
  });
});
