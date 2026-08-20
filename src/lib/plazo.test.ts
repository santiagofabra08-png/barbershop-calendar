import { test } from "node:test";
import assert from "node:assert/strict";

import { plazoEnPalabras } from "./plazo.ts";

test("media hora se dice media hora, no 30 minutos", () => {
  assert.equal(plazoEnPalabras(30), "hasta media hora antes");
});

test("menos de una hora va en minutos", () => {
  assert.equal(plazoEnPalabras(5), "hasta 5 minutos antes");
  assert.equal(plazoEnPalabras(15), "hasta 15 minutos antes");
  assert.equal(plazoEnPalabras(45), "hasta 45 minutos antes");
});

test("las horas redondas se dicen con palabras", () => {
  assert.equal(plazoEnPalabras(60), "hasta una hora antes");
  assert.equal(plazoEnPalabras(120), "hasta dos horas antes");
  assert.equal(plazoEnPalabras(180), "hasta tres horas antes");
});

test("una hora y media tiene su forma", () => {
  assert.equal(plazoEnPalabras(90), "hasta una hora y media antes");
});

test("los días se dicen en días", () => {
  assert.equal(plazoEnPalabras(1440), "hasta un día antes");
  assert.equal(plazoEnPalabras(2880), "hasta dos días antes");
});

test("cero es una política, no la ausencia de una", () => {
  assert.equal(plazoEnPalabras(0), "hasta que empiece");
});

test("un valor imposible no rompe la página", () => {
  assert.equal(plazoEnPalabras(-10), "hasta que empiece");
  assert.equal(plazoEnPalabras(Number.NaN), "hasta que empiece");
});

test("un plazo raro se dice igual, sin inventar", () => {
  assert.equal(plazoEnPalabras(100), "hasta 1 h 40 min antes");
  assert.equal(plazoEnPalabras(780), "hasta 13 horas antes");
});
