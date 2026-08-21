import { test } from "node:test";
import assert from "node:assert/strict";

import { armarTira } from "../panel/day-strip.ts";
import {
  AHORA_DE_EJEMPLO,
  BARBEROS_DE_EJEMPLO,
  jornadaDeEjemplo,
  nombresDeEjemplo,
} from "./jornada.ts";

const FECHA = "2026-08-21";
const DIA = jornadaDeEjemplo(FECHA);

test("el día de ejemplo tiene turnos y un rato bloqueado", () => {
  assert.ok(DIA.length >= 5, "un día con menos de cinco renglones no se lee");
  assert.equal(DIA.filter((t) => t.kind === "block").length, 1);
  assert.ok(DIA.some((t) => t.reason === "Almuerzo"));
});

test("todos los turnos son del día que se pide", () => {
  for (const t of DIA) assert.equal(t.dateLocal, FECHA);
});

test("los dos barberos aparecen, así la agenda dice de quién es cada turno", () => {
  const barberos = new Set(DIA.map((t) => t.barberId));
  for (const b of BARBEROS_DE_EJEMPLO) {
    assert.ok(barberos.has(b.id), `${b.displayName} no tiene ningún turno`);
  }

  const nombres = nombresDeEjemplo();
  for (const t of DIA) {
    assert.ok(nombres.has(t.barberId), `${t.barberId} no tiene nombre`);
  }
});

test("la mañana está cobrada y la tarde no", () => {
  // Es lo que hace que Cobros tenga algo pendiente que mostrar, y lo que
  // separa "lo que se trabajó" de "lo que entró".
  const cobrados = DIA.filter((t) => t.chargedAt !== null);
  const pendientes = DIA.filter(
    (t) => t.kind === "booking" && t.chargedAt === null,
  );
  assert.ok(cobrados.length > 0);
  assert.ok(pendientes.length > 0);
});

test("hay uno cargado a mano y varios reservados desde la página", () => {
  // El reparto importa: la agenda ilustra "el cliente reserva solo", y si
  // todos dijeran "cargado a mano" mostraría lo contrario de lo que dice.
  const turnos = DIA.filter((t) => t.kind === "booking");
  assert.equal(turnos.filter((t) => t.source === "panel").length, 1);
  assert.ok(turnos.filter((t) => t.source === "online").length >= 4);
});

test("un rato bloqueado no tiene cliente, ni precio, ni de dónde vino", () => {
  const bloqueo = DIA.find((t) => t.kind === "block")!;
  assert.equal(bloqueo.clientName, null);
  assert.equal(bloqueo.clientPhone, null);
  assert.equal(bloqueo.priceCents, null);
  assert.equal(bloqueo.source, null);
});

test("los turnos no se pisan entre sí dentro de un mismo barbero", () => {
  const enMinutos = (h: string) =>
    Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));

  for (const b of BARBEROS_DE_EJEMPLO) {
    const suyos = DIA.filter((t) => t.barberId === b.id).sort(
      (a, c) => enMinutos(a.startLocal) - enMinutos(c.startLocal),
    );
    for (let i = 1; i < suyos.length; i++) {
      assert.ok(
        enMinutos(suyos[i].startLocal) >= enMinutos(suyos[i - 1].endLocal),
        `${b.displayName} tiene dos cosas encimadas a las ${suyos[i].startLocal}`,
      );
    }
  }
});

test("la agenda del panel lo dibuja con huecos y con la línea de Ahora", () => {
  // La prueba de verdad: el día de ejemplo tiene que pasar por la misma
  // función que arma la agenda de una barbería real y salir con las tres
  // piezas. Sin huecos sería una tabla; sin la línea de Ahora, un listado.
  const tira = armarTira(DIA, AHORA_DE_EJEMPLO);

  assert.ok(tira.some((a) => a.tipo === "hueco"), "no quedó ni un hueco");
  assert.equal(tira.filter((a) => a.tipo === "ahora").length, 1);
  assert.ok(tira.filter((a) => a.tipo === "turno").length >= 5);
});

test("la línea de Ahora cae en el medio del día, no en una punta", () => {
  const tira = armarTira(DIA, AHORA_DE_EJEMPLO);
  const i = tira.findIndex((a) => a.tipo === "ahora");

  assert.ok(i > 1, "Ahora quedó al principio y no se ve el pasado");
  assert.ok(i < tira.length - 2, "Ahora quedó al final y no se ve lo que viene");
});
