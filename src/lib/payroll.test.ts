import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  monthRange,
  summarizePayroll,
  weekRange,
  type Cut,
  type Pay,
} from "./payroll.ts";

/** Un corte hecho, de $500 (50000 centavos) salvo que se diga otra cosa. */
function corte(barberId: string, extra: Partial<Cut> = {}): Cut {
  return {
    barberId,
    status: "confirmed",
    priceCents: 50000,
    commissionPercent: null,
    ...extra,
  };
}

const soloUno = (pay: Pay) => [{ id: "b1", pay }];

describe("comisión", () => {
  const pay: Pay = { model: "commission", percent: 50 };

  test("reparte según el porcentaje congelado en cada turno", () => {
    const r = summarizePayroll(
      soloUno(pay),
      [
        corte("b1", { commissionPercent: 50 }),
        corte("b1", { commissionPercent: 50 }),
      ],
      "week",
    );

    assert.equal(r.producedCents, 100000);
    assert.equal(r.toBarbersCents, 50000);
    assert.equal(r.shopCents, 50000);
  });

  test("usa el porcentaje del turno, no el que el barbero tiene hoy", () => {
    // El barbero está hoy al 50%, pero este corte se hizo cuando estaba al 30%.
    // La liquicación vieja no se puede mover sola.
    const r = summarizePayroll(
      soloUno(pay),
      [corte("b1", { commissionPercent: 30 })],
      "week",
    );

    assert.equal(r.toBarbersCents, 15000);
    assert.equal(r.shopCents, 35000);
  });

  test("null en el turno es 'no le correspondía comisión', no 0%", () => {
    const r = summarizePayroll(soloUno(pay), [corte("b1")], "week");
    assert.equal(r.toBarbersCents, 0);
    assert.equal(r.shopCents, 50000);
  });

  test("redondea por corte, no sobre el total", () => {
    // Tres cortes de 100 al 33,33%. Por corte: round(33,33) = 33, y tres dan 99.
    // Sobre el total sería round(99,99) = 100. Es un centavo, pero elegimos el
    // 99: es lo que suma la lista que el barbero ve en pantalla, y una lista
    // que no cierra con su propio total parece un error aunque no lo sea.
    const cortes = Array.from({ length: 3 }, () =>
      corte("b1", { priceCents: 100, commissionPercent: 33.33 }),
    );
    const r = summarizePayroll(
      soloUno({ model: "commission", percent: 33.33 }),
      cortes,
      "week",
    );

    assert.equal(r.toBarbersCents, 99);
    assert.equal(r.producedCents, 300);
    assert.equal(r.shopCents, r.producedCents - r.toBarbersCents);

    // El detalle por barbero tiene que cerrar con el total del equipo.
    const sumaDelDetalle = r.barbers.reduce(
      (t, b) => t + (b.barberCents ?? 0),
      0,
    );
    assert.equal(sumaDelDetalle, r.toBarbersCents);
  });
});

describe("sueldo fijo", () => {
  test("cobra lo mismo corte más, corte menos", () => {
    const pay: Pay = { model: "salary", amountCents: 80000, period: "week" };

    const flojo = summarizePayroll(soloUno(pay), [corte("b1")], "week");
    const cargado = summarizePayroll(
      soloUno(pay),
      [corte("b1"), corte("b1"), corte("b1"), corte("b1")],
      "week",
    );

    assert.equal(flojo.toBarbersCents, 80000);
    assert.equal(cargado.toBarbersCents, 80000);
    // Y el local se queda con la diferencia, que en la semana floja es negativa.
    assert.equal(flojo.shopCents, 50000 - 80000);
    assert.equal(cargado.shopCents, 200000 - 80000);
  });

  test("un sueldo mensual no se prorratea a una semana", () => {
    // El mes no tiene cuatro semanas exactas: dividir sería inventar un número.
    const r = summarizePayroll(
      soloUno({ model: "salary", amountCents: 3000000, period: "month" }),
      [corte("b1")],
      "week",
    );

    assert.equal(r.barbers[0].barberCents, null);
    assert.equal(r.barbers[0].note, "fuera-del-periodo");
    assert.equal(r.complete, false, "la pantalla tiene que poder avisarlo");
  });

  test("mirando el mes, el sueldo mensual sí aparece", () => {
    const r = summarizePayroll(
      soloUno({ model: "salary", amountCents: 3000000, period: "month" }),
      [corte("b1")],
      "month",
    );

    assert.equal(r.toBarbersCents, 3000000);
    assert.equal(r.complete, true);
  });
});

describe("alquiler de silla", () => {
  test("el barbero se queda con lo suyo menos la cuota, y el local cobra la cuota", () => {
    const r = summarizePayroll(
      soloUno({ model: "chair_rent", amountCents: 30000, period: "week" }),
      [corte("b1"), corte("b1")],
      "week",
    );

    assert.equal(r.producedCents, 100000);
    assert.equal(r.toBarbersCents, 70000);
    assert.equal(r.shopCents, 30000);
  });
});

describe("solo recaudación", () => {
  test("no hay reparto: la caja es del local", () => {
    const r = summarizePayroll(
      soloUno({ model: "revenue_only" }),
      [corte("b1")],
      "week",
    );

    assert.equal(
      r.barbers[0].barberCents,
      null,
      "null es 'no aplica', distinto de cero",
    );
    assert.equal(r.shopCents, 50000);
    assert.equal(r.complete, true);
  });
});

describe("el que no vino", () => {
  const pay: Pay = { model: "commission", percent: 50 };

  test("no suma plata, y se cuenta aparte", () => {
    const r = summarizePayroll(
      soloUno(pay),
      [
        corte("b1", { commissionPercent: 50 }),
        corte("b1", { status: "no_show", commissionPercent: 50 }),
      ],
      "week",
    );

    assert.equal(r.cuts, 1);
    assert.equal(r.noShows, 1);
    assert.equal(r.producedCents, 50000, "la ausencia no infla la recaudación");
    assert.equal(r.lostCents, 50000, "pero se ve cuánto se dejó de cobrar");
    assert.equal(r.toBarbersCents, 25000);
  });
});

describe("el equipo", () => {
  test("cada uno con su arreglo, en la misma semana", () => {
    const equipo: { id: string; pay: Pay }[] = [
      { id: "facundo", pay: { model: "revenue_only" } },
      { id: "nico", pay: { model: "commission", percent: 50 } },
      {
        id: "sabados",
        pay: { model: "chair_rent", amountCents: 20000, period: "week" },
      },
    ];
    const cortes = [
      corte("facundo"),
      corte("nico", { commissionPercent: 50 }),
      corte("sabados"),
    ];

    const r = summarizePayroll(equipo, cortes, "week");

    assert.equal(r.producedCents, 150000);
    assert.equal(r.toBarbersCents, 25000 + 30000);
    assert.equal(r.shopCents, 50000 + 25000 + 20000);
    assert.equal(r.complete, true);
  });

  test("el barbero que no cortó aparece igual, en cero", () => {
    const r = summarizePayroll(
      [
        { id: "b1", pay: { model: "revenue_only" } },
        { id: "b2", pay: { model: "salary", amountCents: 9000, period: "week" } },
      ],
      [corte("b1")],
      "week",
    );

    assert.equal(r.barbers.length, 2);
    assert.equal(r.barbers[1].cuts, 0);
    // Aunque no haya cortado, el sueldo se paga igual.
    assert.equal(r.barbers[1].barberCents, 9000);
  });

  test("los cortes de otro barbero no se cuelan", () => {
    const r = summarizePayroll(
      [{ id: "b1", pay: { model: "revenue_only" } }],
      [corte("b1"), corte("b2")],
      "week",
    );

    assert.equal(r.cuts, 1);
    assert.equal(r.producedCents, 50000);
  });
});

describe("el período", () => {
  test("la semana va de lunes a domingo", () => {
    // 2026-07-30 es jueves.
    assert.deepEqual(weekRange("2026-07-30"), {
      from: "2026-07-27",
      to: "2026-08-02",
    });
  });

  test("un lunes es el principio de su propia semana", () => {
    assert.deepEqual(weekRange("2026-07-27"), {
      from: "2026-07-27",
      to: "2026-08-02",
    });
  });

  test("un domingo cierra la semana que empezó el lunes anterior", () => {
    assert.deepEqual(weekRange("2026-08-02"), {
      from: "2026-07-27",
      to: "2026-08-02",
    });
  });

  test("la semana anterior y la siguiente", () => {
    assert.equal(weekRange("2026-07-30", -1).from, "2026-07-20");
    assert.equal(weekRange("2026-07-30", 1).from, "2026-08-03");
  });

  test("cruza el fin de año sin romperse", () => {
    assert.deepEqual(weekRange("2027-01-01"), {
      from: "2026-12-28",
      to: "2027-01-03",
    });
  });

  test("el mes va del primero al último día", () => {
    assert.deepEqual(monthRange("2026-07-30"), {
      from: "2026-07-01",
      to: "2026-07-31",
    });
  });

  test("febrero de un año bisiesto tiene 29", () => {
    assert.equal(monthRange("2028-02-10").to, "2028-02-29");
  });

  test("el mes anterior a enero es diciembre del año pasado", () => {
    assert.deepEqual(monthRange("2026-01-15", -1), {
      from: "2025-12-01",
      to: "2025-12-31",
    });
  });
});
