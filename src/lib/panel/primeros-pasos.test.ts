import { test } from "node:test";
import assert from "node:assert/strict";

import {
  enumerar,
  loQueFalta,
  primerosPasos,
  tituloDeLaLista,
  type EstadoDelLocal,
} from "./primeros-pasos.ts";

/** Una barbería recién salida de `crear-barberia`: lo mínimo y nada más. */
const RECIEN_CREADA: EstadoDelLocal = {
  tieneLogoClaro: false,
  tieneLogoOscuro: false,
  tieneDireccion: false,
  tieneWhatsApp: false,
  serviciosActivos: 1,
  barberosSinHorario: [],
};

/** Una barbería con todo cargado. */
const COMPLETA: EstadoDelLocal = {
  tieneLogoClaro: true,
  tieneLogoOscuro: true,
  tieneDireccion: true,
  tieneWhatsApp: true,
  serviciosActivos: 4,
  barberosSinHorario: [],
};

test("recién creada le falta todo menos el horario del dueño", () => {
  const faltan = loQueFalta(RECIEN_CREADA).map((p) => p.id);
  assert.deepEqual(faltan, ["servicios", "logo", "direccion", "whatsapp"]);
});

test("con todo cargado la lista queda vacía y el bloque no se dibuja", () => {
  assert.deepEqual(loQueFalta(COMPLETA), []);
});

test("un logo solo no alcanza: son dos archivos", () => {
  const faltan = loQueFalta({ ...COMPLETA, tieneLogoOscuro: false }).map(
    (p) => p.id,
  );
  assert.deepEqual(faltan, ["logo"]);
});

test("un barbero sin horario es lo único que impide reservar", () => {
  const estado = { ...COMPLETA, barberosSinHorario: ["Lucas"] };
  const faltan = loQueFalta(estado);

  assert.deepEqual(
    faltan.map((p) => p.id),
    ["horarios"],
  );
  assert.equal(faltan[0].bloquea, true);
});

test("el que no tiene horario aparece con su nombre", () => {
  const uno = loQueFalta({ ...COMPLETA, barberosSinHorario: ["Lucas"] });
  assert.match(uno[0].porque, /^Lucas no aparece en la página/);

  const dos = loQueFalta({
    ...COMPLETA,
    barberosSinHorario: ["Lucas", "Agustín"],
  });
  assert.match(dos[0].porque, /^Lucas y Agustín no aparecen en la página/);
});

test("el título avisa distinto cuando hay algo que impide reservar", () => {
  assert.equal(
    tituloDeLaLista(loQueFalta({ ...COMPLETA, barberosSinHorario: ["Lucas"] })),
    "Falta algo para poder reservar",
  );
  assert.equal(
    tituloDeLaLista(loQueFalta(RECIEN_CREADA)),
    "Para terminar de armar tu página",
  );
});

test("lo que impide reservar va primero", () => {
  const faltan = loQueFalta({
    ...RECIEN_CREADA,
    barberosSinHorario: ["Lucas"],
  });
  assert.equal(faltan[0].id, "horarios");
});

test("un servicio solo es la huella del alta; dos ya es una decisión", () => {
  const conUno = primerosPasos({ ...COMPLETA, serviciosActivos: 1 });
  assert.equal(conUno.find((p) => p.id === "servicios")?.hecho, false);

  const conDos = primerosPasos({ ...COMPLETA, serviciosActivos: 2 });
  assert.equal(conDos.find((p) => p.id === "servicios")?.hecho, true);
});

test("los cinco pasos existen siempre, hechos o no", () => {
  assert.equal(primerosPasos(RECIEN_CREADA).length, 5);
  assert.equal(primerosPasos(COMPLETA).length, 5);
});

test("todos los pasos llevan a una pantalla del panel", () => {
  for (const paso of primerosPasos(RECIEN_CREADA)) {
    assert.match(paso.href, /^\/panel\//, `${paso.id} no lleva a ningún lado`);
  }
});

test("enumerar arma la lista como la diría una persona", () => {
  assert.equal(enumerar([]), "");
  assert.equal(enumerar(["Ana"]), "Ana");
  assert.equal(enumerar(["Ana", "Beto"]), "Ana y Beto");
  assert.equal(enumerar(["Ana", "Beto", "Cata"]), "Ana, Beto y Cata");
});
