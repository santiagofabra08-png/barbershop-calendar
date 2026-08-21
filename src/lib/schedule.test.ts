import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  bookingWindowEnd,
  buildAgendas,
  buildWeek,
  localToUtc,
  mergeAgendas,
  nowInTimeZone,
  summarizeHours,
} from "./schedule.ts";
import type { Barber, Service, Tenant, WorkingHour } from "./tenant/types.ts";

// Lunes 27 de julio de 2026, 09:00 en Montevideo (12:00 UTC).
const AHORA = new Date("2026-07-27T12:00:00Z");

const tenant: Tenant = {
  id: "t",
  slug: "tropi-barbershop",
  name: "Tropi Barbershop",
  timezone: "America/Montevideo",
  currency: "UYU",
  address: null,
  mapsUrl: null,
  logoLightUrl: null,
  logoDarkUrl: null,
  colors: {
    bg: "#F5F0E8",
    surface: "#FFFFFF",
    ink: "#111111",
    inkMuted: "#6B6B6B",
    accent: "#D0021B",
    accentAlt: "#1D3FA3",
  },
  minLeadMinutes: 60,
  cancelDeadlineMinutes: 60,
  productsEnabled: false,
  bookingWindow: { mode: "weekly", releaseWeekday: 6, releaseTime: "21:00" },
};

const corte: Service = {
  id: "s",
  name: "Corte de pelo",
  description: null,
  durationMinutes: 40,
  priceCents: 30000,
};

const facundo: Barber = { id: "f", displayName: "Facundo", acceptsBookings: true, photoUrl: null };
const jaimito: Barber = { id: "j", displayName: "Jaimito", acceptsBookings: true, photoUrl: null };
const contador: Barber = { id: "c", displayName: "Contador", acceptsBookings: false, photoUrl: null };

// Facundo: martes a sábado, 14 a 21. Jaimito: jueves y viernes, 16 a 21.
const horarios: WorkingHour[] = [
  ...[2, 3, 4, 5, 6].map((weekday) => ({
    barberId: "f",
    weekday,
    startsAt: "14:00",
    endsAt: "21:00",
  })),
  ...[4, 5].map((weekday) => ({
    barberId: "j",
    weekday,
    startsAt: "16:00",
    endsAt: "21:00",
  })),
];

describe("ventana semanal", () => {
  test("el lunes se puede reservar hasta el sábado al cerrar", () => {
    const fin = bookingWindowEnd(tenant, "2026-07-27", "09:00");
    assert.deepEqual(fin, { date: "2026-08-01", time: "21:00" });
  });

  test("el sábado antes de cerrar, la ventana termina ese mismo día", () => {
    const fin = bookingWindowEnd(tenant, "2026-08-01", "18:00");
    assert.deepEqual(fin, { date: "2026-08-01", time: "21:00" });
  });

  test("el sábado después de cerrar ya se abre la semana siguiente", () => {
    const fin = bookingWindowEnd(tenant, "2026-08-01", "21:30");
    assert.deepEqual(fin, { date: "2026-08-08", time: "21:00" });
  });

  test("el domingo, con el local cerrado, ya se reserva para el martes", () => {
    const fin = bookingWindowEnd(tenant, "2026-08-02", "10:00");
    assert.equal(fin.date, "2026-08-08");
  });
});

describe("grilla de un barbero", () => {
  const days = buildWeek({
    tenant,
    service: corte,
    workingHours: horarios.filter((h) => h.barberId === "f"),
    now: AHORA,
  });

  test("solo aparecen los días que trabaja", () => {
    assert.deepEqual(
      days.map((d) => d.date),
      ["2026-07-28", "2026-07-29", "2026-07-30", "2026-07-31", "2026-08-01"],
    );
  });

  test("no aparece el lunes, que está cerrado", () => {
    assert.ok(!days.some((d) => d.weekday === 1));
  });

  test("de 14 a 21 en turnos de 40 entran 10, el último a las 20:00", () => {
    const martes = days[0];
    assert.equal(martes.slots.length, 10);
    assert.equal(martes.slots[0].time, "14:00");
    assert.equal(martes.slots.at(-1)?.time, "20:00");
  });

  test("no se ofrece un turno que termine después del cierre", () => {
    // 20:40 + 40 min = 21:20, y cierra 21:00.
    assert.ok(!days[0].slots.some((s) => s.time === "20:40"));
  });

  test("un turno tomado deja el hueco ocupado", () => {
    const conOcupado = buildWeek({
      tenant,
      service: corte,
      workingHours: horarios.filter((h) => h.barberId === "f"),
      now: AHORA,
      busy: new Set(["2026-07-28 16:00", "2026-07-28 16:05"]),
    });
    const slot = conOcupado[0].slots.find((s) => s.time === "16:00");
    assert.equal(slot?.available, false);
  });

  test("un turno que arranca en el medio también tapa el hueco anterior", () => {
    // Alguien ocupado 16:20–17:00 pisa el turno que empieza 16:00.
    const conOcupado = buildWeek({
      tenant,
      service: corte,
      workingHours: horarios.filter((h) => h.barberId === "f"),
      now: AHORA,
      busy: new Set(["2026-07-28 16:20", "2026-07-28 16:25"]),
    });
    const slot = conOcupado[0].slots.find((s) => s.time === "16:00");
    assert.equal(slot?.available, false);
  });
});

describe("varios barberos", () => {
  const agendas = buildAgendas({
    tenant,
    service: corte,
    barbers: [facundo, jaimito, contador],
    workingHours: horarios,
    now: AHORA,
  });

  test("quien no toma turnos no tiene agenda", () => {
    assert.equal(agendas.length, 2);
    assert.deepEqual(
      agendas.map((a) => a.barber.displayName),
      ["Facundo", "Jaimito"],
    );
  });

  test("cada uno tiene sus propios días, no una copia", () => {
    const deJaimito = agendas.find((a) => a.barber.id === "j")!;
    assert.deepEqual(
      deJaimito.days.map((d) => d.date),
      ["2026-07-30", "2026-07-31"],
    );
    assert.equal(deJaimito.days[0].slots.length, 7); // 16 a 21
    assert.equal(deJaimito.days[0].slots[0].time, "16:00");
  });

  test("al fundirlas aparecen todos los días de todos", () => {
    const juntas = mergeAgendas(agendas);
    assert.deepEqual(
      juntas.map((d) => d.date),
      ["2026-07-28", "2026-07-29", "2026-07-30", "2026-07-31", "2026-08-01"],
    );
  });

  test("si uno está ocupado pero el otro no, el horario sigue libre", () => {
    const conFacundoOcupado = buildAgendas({
      tenant,
      service: corte,
      barbers: [facundo, jaimito],
      workingHours: horarios,
      now: AHORA,
      // Facundo ocupado el jueves a las 16:00; Jaimito trabaja y está libre.
      busy: new Map([["f", new Set(["2026-07-30 16:00", "2026-07-30 16:05"])]]),
    });

    const jueves = conFacundoOcupado
      .find((a) => a.barber.id === "f")!
      .days.find((d) => d.date === "2026-07-30")!;
    assert.equal(
      jueves.slots.find((s) => s.time === "16:00")?.available,
      false,
      "con Facundo tiene que estar ocupado",
    );

    const juntas = mergeAgendas(conFacundoOcupado);
    const juevesJunto = juntas.find((d) => d.date === "2026-07-30")!;
    assert.equal(
      juevesJunto.slots.find((s) => s.time === "16:00")?.available,
      true,
      "para quien no elige barbero tiene que seguir libre",
    );
  });

  test("si los dos están ocupados, el horario no está", () => {
    const juntas = mergeAgendas(
      buildAgendas({
        tenant,
        service: corte,
        barbers: [facundo, jaimito],
        workingHours: horarios,
        now: AHORA,
        busy: new Map([
          ["f", new Set(["2026-07-30 16:00", "2026-07-30 16:05"])],
          ["j", new Set(["2026-07-30 16:00", "2026-07-30 16:05"])],
        ]),
      }),
    );
    const jueves = juntas.find((d) => d.date === "2026-07-30")!;
    assert.equal(jueves.slots.find((s) => s.time === "16:00")?.available, false);
  });

  test("un horario que solo cubre uno igual aparece", () => {
    // Las 14:00 del jueves solo las trabaja Facundo.
    const juntas = mergeAgendas(agendas);
    const jueves = juntas.find((d) => d.date === "2026-07-30")!;
    assert.equal(jueves.slots.find((s) => s.time === "14:00")?.available, true);
  });
});

describe("hora local a UTC", () => {
  test("Montevideo está tres horas atrás de UTC", () => {
    const utc = localToUtc("2026-08-01", "16:00", "America/Montevideo");
    assert.equal(utc.toISOString(), "2026-08-01T19:00:00.000Z");
  });

  test("es exactamente el camino inverso de nowInTimeZone", () => {
    for (const fecha of ["2026-01-15", "2026-07-01", "2026-12-31"]) {
      for (const hora of ["00:00", "14:00", "20:40", "23:59"]) {
        const utc = localToUtc(fecha, hora, "America/Montevideo");
        const vuelta = nowInTimeZone("America/Montevideo", utc);
        assert.deepEqual(
          vuelta,
          { date: fecha, time: hora },
          `no cerró el ida y vuelta con ${fecha} ${hora}`,
        );
      }
    }
  });

  test("funciona en una zona que sí cambia con el horario de verano", () => {
    // Buenos Aires no cambia, pero Madrid sí: enero y julio dan desvíos
    // distintos y las dos conversiones tienen que cerrar igual.
    for (const [fecha, esperado] of [
      ["2026-01-15", "2026-01-15T11:00:00.000Z"],
      ["2026-07-15", "2026-07-15T10:00:00.000Z"],
    ] as const) {
      const utc = localToUtc(fecha, "12:00", "Europe/Madrid");
      assert.equal(utc.toISOString(), esperado);
    }
  });
});

describe("resumen del horario", () => {
  test("junta los días seguidos que abren igual", () => {
    const filas = summarizeHours(horarios.filter((h) => h.barberId === "f"));
    assert.deepEqual(filas, [
      { dias: "Martes a sábado", horas: "14:00 a 21:00" },
    ]);
  });

  test("es el horario del local, no el turno de cada barbero", () => {
    // Facundo 14–21 y Jaimito 16–21 el jueves: la barbería abre 14–21, no
    // "14 a 21 y 16 a 21".
    const filas = summarizeHours(horarios);
    const jueves = filas.find((f) => f.dias.includes("jueves") || f.dias.includes("Jueves"));
    assert.ok(
      filas.every((f) => !f.horas.includes(" y ")),
      `no debería listar tramos sueltos: ${JSON.stringify(filas)}`,
    );
    assert.ok(jueves === undefined || jueves.horas === "14:00 a 21:00");
  });

  test("dos tramos que no se tocan sí quedan separados", () => {
    const filas = summarizeHours([
      { barberId: "x", weekday: 1, startsAt: "09:00", endsAt: "13:00" },
      { barberId: "y", weekday: 1, startsAt: "15:00", endsAt: "19:00" },
    ]);
    assert.deepEqual(filas, [
      { dias: "Lunes", horas: "09:00 a 13:00 y 15:00 a 19:00" },
    ]);
  });

  test("separa los tramos distintos", () => {
    const filas = summarizeHours([
      { barberId: "x", weekday: 1, startsAt: "09:00", endsAt: "13:00" },
      { barberId: "x", weekday: 2, startsAt: "09:00", endsAt: "13:00" },
      { barberId: "x", weekday: 6, startsAt: "10:00", endsAt: "14:00" },
    ]);
    assert.equal(filas.length, 2);
    assert.equal(filas[0].dias, "Lunes a martes");
    assert.equal(filas[1].dias, "Sábado");
  });
});
