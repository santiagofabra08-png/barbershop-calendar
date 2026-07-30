import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { armarTira, enMinutos } from "./day-strip.ts";

const turno = (startLocal: string, endLocal: string) => ({
  startLocal,
  endLocal,
});

describe("la tira del día", () => {
  test("los turnos salen en orden aunque entren desordenados", () => {
    const tira = armarTira(
      [turno("16:00", "16:40"), turno("14:00", "14:40")],
      null,
    );

    assert.deepEqual(
      tira.filter((a) => a.tipo === "turno").map((a) => a.at),
      ["14:00", "16:00"],
    );
  });

  test("el rato libre entre dos turnos se escribe", () => {
    const tira = armarTira(
      [turno("14:00", "14:40"), turno("16:00", "16:40")],
      null,
    );

    const hueco = tira.find((a) => a.tipo === "hueco");
    assert.ok(hueco, "un hueco de 80 minutos tiene que verse");
    assert.equal(hueco.tipo === "hueco" && hueco.minutos, 80);
    assert.equal(hueco.tipo === "hueco" && hueco.hasta, "16:00");
  });

  test("dos turnos pegados no dejan hueco", () => {
    const tira = armarTira(
      [turno("14:00", "14:40"), turno("14:40", "15:20")],
      null,
    );

    assert.equal(tira.filter((a) => a.tipo === "hueco").length, 0);
  });

  test("un respiro de cinco minutos no es un descanso", () => {
    const tira = armarTira(
      [turno("14:00", "14:40"), turno("14:45", "15:25")],
      null,
    );

    assert.equal(tira.filter((a) => a.tipo === "hueco").length, 0);
  });

  test("turnos superpuestos no inventan un hueco negativo", () => {
    const tira = armarTira(
      [turno("14:00", "15:00"), turno("14:30", "15:10")],
      null,
    );

    assert.equal(tira.filter((a) => a.tipo === "hueco").length, 0);
  });

  test("sin turnos y sin ahora, la tira está vacía", () => {
    assert.deepEqual(armarTira([], null), []);
  });
});

describe("la marca de ahora", () => {
  test("no aparece si el día que se mira no es hoy", () => {
    const tira = armarTira([turno("14:00", "14:40")], null);
    assert.equal(tira.filter((a) => a.tipo === "ahora").length, 0);
  });

  test("cae entre el turno que pasó y el que viene", () => {
    const tira = armarTira(
      [turno("14:00", "14:40"), turno("16:00", "16:40")],
      "15:30",
    );

    const orden = tira.map((a) => a.tipo);
    assert.deepEqual(orden, ["turno", "hueco", "ahora", "turno"]);
  });

  test("antes del primer turno va arriba de todo", () => {
    const tira = armarTira([turno("14:00", "14:40")], "09:00");
    assert.equal(tira[0].tipo, "ahora");
  });

  test("después del último turno cierra el día", () => {
    const tira = armarTira([turno("14:00", "14:40")], "21:00");
    assert.equal(tira[tira.length - 1].tipo, "ahora");
  });

  test("a la hora exacta de un turno, ese turno todavía no pasó", () => {
    const tira = armarTira([turno("15:00", "15:40")], "15:00");
    assert.deepEqual(
      tira.map((a) => a.tipo),
      ["ahora", "turno"],
    );
  });

  test("en un día sin turnos, la marca aparece igual", () => {
    const tira = armarTira([], "15:00");
    assert.deepEqual(
      tira.map((a) => a.tipo),
      ["ahora"],
    );
  });
});

describe("minutos desde la medianoche", () => {
  const casos: [string, number][] = [
    ["00:00", 0],
    ["09:05", 545],
    ["14:30", 870],
    ["23:59", 1439],
  ];
  for (const [hhmm, esperado] of casos) {
    test(`${hhmm} son ${esperado}`, () => {
      assert.equal(enMinutos(hhmm), esperado);
    });
  }
});
