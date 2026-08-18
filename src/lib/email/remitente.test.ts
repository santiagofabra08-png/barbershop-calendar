import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { direccionDe, remitenteDe } from "./remitente.ts";

const CONFIGURADO = "Tropi Barbershop <turnos@turnosforbarber.com>";

describe("el remitente", () => {
  // El bug que originó esto: Barbería Central mandaba sus confirmaciones
  // firmadas "Tropi Barbershop", que es el nombre que había quedado en la
  // variable de entorno.
  test("firma con el nombre de la barbería, no con el del entorno", () => {
    assert.equal(
      remitenteDe("Barbería Central", CONFIGURADO),
      '"Barbería Central" <turnos@turnosforbarber.com>',
    );
  });

  test("la dirección sale del entorno aunque venga sin nombre", () => {
    assert.equal(
      remitenteDe("Barbería Central", "turnos@turnosforbarber.com"),
      '"Barbería Central" <turnos@turnosforbarber.com>',
    );
  });

  test("dos barberías firman distinto con la misma configuración", () => {
    const a = remitenteDe("Tropi Barbershop", CONFIGURADO);
    const b = remitenteDe("Barbería Central", CONFIGURADO);

    assert.notEqual(a, b);
    assert.ok(a.includes("turnos@turnosforbarber.com"));
    assert.ok(b.includes("turnos@turnosforbarber.com"));
  });

  // El nombre lo escribe el dueño desde Ajustes. Una cabecera de mail termina
  // con un salto de línea, así que un nombre con uno adentro podría agregar
  // cabeceras propias.
  test("un salto de línea no puede meter otra cabecera", () => {
    const armado = remitenteDe(
      "Malicia\r\nBcc: alguien@otrolado.com",
      CONFIGURADO,
    );

    assert.doesNotMatch(armado, /[\r\n]/);
    assert.doesNotMatch(armado, /Bcc:.*\n/);
    assert.equal(
      armado,
      '"Malicia Bcc: alguien@otrolado.com" <turnos@turnosforbarber.com>',
    );
  });

  test("las comillas no rompen el entrecomillado", () => {
    assert.equal(
      remitenteDe('Barbería "La Esquina"', CONFIGURADO),
      '"Barbería La Esquina" <turnos@turnosforbarber.com>',
    );
  });

  test("sin nombre usable queda la dirección sola", () => {
    assert.equal(remitenteDe("   ", CONFIGURADO), "turnos@turnosforbarber.com");
    assert.equal(remitenteDe('""', CONFIGURADO), "turnos@turnosforbarber.com");
  });

  test("los acentos y la ñ sobreviven", () => {
    assert.ok(remitenteDe("Peluquería Ñandú", CONFIGURADO).includes("Ñandú"));
  });
});

describe("la dirección", () => {
  test("la saca de entre los ángulos", () => {
    assert.equal(direccionDe(CONFIGURADO), "turnos@turnosforbarber.com");
  });

  test("una dirección pelada se devuelve igual", () => {
    assert.equal(direccionDe(" turnos@x.com "), "turnos@x.com");
  });
});
