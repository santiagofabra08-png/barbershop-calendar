/**
 * Recuento de trabajo y reparto de la plata.
 *
 * Toma los turnos de un período y dice, por barbero: cuántos cortes hizo,
 * cuánto entró por ellos, y cuánto de eso le toca a él y cuánto al local.
 *
 * Funciones puras: no leen la base ni el reloj. Los turnos entran ya cargados y
 * el período entra como argumento, para poder probar el cálculo contra números
 * escritos a mano.
 *
 * Todo el dinero se maneja en CENTAVOS y en enteros. Nunca en punto flotante:
 * 0.1 + 0.2 no da 0.3, y con plata eso no se perdona.
 */

/** Cómo cobra un barbero. Es el mismo acuerdo que impone el CHECK de la base. */
export type Pay =
  /** Se lleva un % de lo que corta. */
  | { model: "commission"; percent: number }
  /** El local le paga un fijo, corte más, corte menos. */
  | { model: "salary"; amountCents: number; period: PayPeriod }
  /** Le paga un fijo al local y se queda con lo que corta. */
  | { model: "chair_rent"; amountCents: number; period: PayPeriod }
  /** No se reparte nada acá: la caja es del local. El caso del dueño. */
  | { model: "revenue_only" };

export type PayPeriod = "week" | "month";
export type PaymentModel = Pay["model"];

/**
 * Un turno que ya pasó, visto desde el recuento.
 *
 * `commissionPercent` es el porcentaje CONGELADO al momento de reservar, no el
 * que tiene el barbero hoy. Por eso viaja con el turno y no se busca acá: si
 * en agosto pasó de 50% a 55%, la liquidación de julio no se mueve.
 */
export type Cut = {
  barberId: string;
  /** 'no_show' es trabajo que no se cobró: cuenta como ausencia, no como plata. */
  status: "confirmed" | "no_show";
  priceCents: number;
  commissionPercent: number | null;
};

export type BarberSummary = {
  barberId: string;
  pay: Pay;

  /** Cortes efectivamente hechos. */
  cuts: number;
  /** Turnos que estaban dados y no se presentaron. */
  noShows: number;

  /** Lo que entró a la caja por sus cortes. */
  producedCents: number;
  /** Lo que se dejó de cobrar por las ausencias. */
  lostCents: number;

  /**
   * Lo que le corresponde al barbero en este período.
   * Null = no se puede decir; ver `note`.
   */
  barberCents: number | null;
  /** Lo que le queda al local de lo que produjo este barbero. */
  shopCents: number | null;

  /**
   * La plata que tiene que cambiar de manos entre la barbería y esta persona.
   *
   * No es lo mismo que `barberCents`. El que alquila la silla se lleva lo que
   * cortó —esa plata nunca pasa por la caja de la barbería—, y lo único que
   * cambia de manos es la cuota, que va para el otro lado. Por eso lleva
   * dirección: 'out' es la barbería pagando, 'in' es la barbería cobrando.
   *
   * Null cuando no hay nada que saldar, que es el caso del dueño.
   */
  settlement: { direction: "out" | "in"; cents: number } | null;

  /** Por qué un número quedó en null, si quedó. */
  note: "fuera-del-periodo" | null;
};

export type PayrollSummary = {
  barbers: BarberSummary[];

  cuts: number;
  noShows: number;
  producedCents: number;
  lostCents: number;
  toBarbersCents: number;
  shopCents: number;

  /** Lo que la barbería tiene que pagar en este período. */
  dueOutCents: number;
  /** Lo que la barbería tiene que cobrar: las cuotas de las sillas. */
  dueInCents: number;

  /**
   * false cuando algún barbero tiene un fijo que no cae en este período —un
   * sueldo mensual mirando una semana—. Los totales quedan sin esa parte, y la
   * pantalla tiene que decirlo en vez de mostrar un neto que no cierra.
   */
  complete: boolean;
};

/**
 * Cuánto le toca al barbero por un corte, con el porcentaje que tenía ese día.
 *
 * Se redondea POR CORTE y no sobre el total. Es lo que hace cualquiera con una
 * calculadora al lado de la silla, y así el detalle suma exactamente el total
 * en pantalla: si redondeáramos al final, la lista y el total no coincidirían
 * por unos pesos y parecería un error.
 */
function commissionOf(cut: Cut): number {
  // Null es "a este corte no le correspondía comisión", distinto de 0%.
  if (cut.commissionPercent === null) return 0;
  return Math.round((cut.priceCents * cut.commissionPercent) / 100);
}

/**
 * El reparto de un barbero.
 *
 * `period` es el período que se está mirando. Importa solo para sueldo y
 * alquiler: un sueldo mensual no se puede repartir en una semana sin inventar
 * un número —el mes no tiene cuatro semanas exactas—, así que en ese caso se
 * devuelve null y la pantalla avisa, en vez de mostrar una división inventada.
 */
function split(
  pay: Pay,
  producedCents: number,
  commissionCents: number,
  period: PayPeriod,
): Pick<BarberSummary, "barberCents" | "shopCents" | "settlement" | "note"> {
  const fueraDelPeriodo = {
    barberCents: null,
    shopCents: null,
    settlement: null,
    note: "fuera-del-periodo" as const,
  };

  switch (pay.model) {
    case "commission":
      return {
        barberCents: commissionCents,
        shopCents: producedCents - commissionCents,
        settlement: { direction: "out", cents: commissionCents },
        note: null,
      };

    case "salary":
      if (pay.period !== period) return fueraDelPeriodo;
      return {
        barberCents: pay.amountCents,
        shopCents: producedCents - pay.amountCents,
        settlement: { direction: "out", cents: pay.amountCents },
        note: null,
      };

    case "chair_rent":
      if (pay.period !== period) return fueraDelPeriodo;
      // Al revés que el sueldo: el barbero se queda con lo que cortó menos la
      // cuota, y lo del local es la cuota y nada más. Y lo que cambia de manos
      // también va al revés: acá la barbería cobra, no paga.
      return {
        barberCents: producedCents - pay.amountCents,
        shopCents: pay.amountCents,
        settlement: { direction: "in", cents: pay.amountCents },
        note: null,
      };

    case "revenue_only":
      // No hay reparto: no es que le toque cero, es que no aplica.
      return {
        barberCents: null,
        shopCents: producedCents,
        settlement: null,
        note: null,
      };
  }
}

/**
 * El recuento del período para todo el equipo.
 *
 * Los barberos entran completos, incluso los que no cortaron: un barbero en
 * cero es información —y si está a sueldo, igual hay que pagarle.
 */
export function summarizePayroll(
  barbers: { id: string; pay: Pay }[],
  cuts: Cut[],
  period: PayPeriod,
): PayrollSummary {
  const resumen = barbers.map((b): BarberSummary => {
    const suyos = cuts.filter((c) => c.barberId === b.id);
    const hechos = suyos.filter((c) => c.status === "confirmed");
    const faltas = suyos.filter((c) => c.status === "no_show");

    const producedCents = hechos.reduce((t, c) => t + c.priceCents, 0);
    const commissionCents = hechos.reduce((t, c) => t + commissionOf(c), 0);

    return {
      barberId: b.id,
      pay: b.pay,
      cuts: hechos.length,
      noShows: faltas.length,
      producedCents,
      lostCents: faltas.reduce((t, c) => t + c.priceCents, 0),
      ...split(b.pay, producedCents, commissionCents, period),
    };
  });

  const suma = (f: (b: BarberSummary) => number) =>
    resumen.reduce((t, b) => t + f(b), 0);

  return {
    barbers: resumen,
    cuts: suma((b) => b.cuts),
    noShows: suma((b) => b.noShows),
    producedCents: suma((b) => b.producedCents),
    lostCents: suma((b) => b.lostCents),
    toBarbersCents: suma((b) => b.barberCents ?? 0),
    shopCents: suma((b) => b.shopCents ?? 0),
    dueOutCents: suma((b) =>
      b.settlement?.direction === "out" ? b.settlement.cents : 0,
    ),
    dueInCents: suma((b) =>
      b.settlement?.direction === "in" ? b.settlement.cents : 0,
    ),
    complete: resumen.every((b) => b.note === null),
  };
}

// ---------------------------------------------------------------------------
// El período
// ---------------------------------------------------------------------------

/** Un rango de fechas locales, con las dos puntas incluidas. */
export type DateRange = { from: string; to: string };

/**
 * La semana de lunes a domingo que contiene esa fecha.
 *
 * De lunes a domingo porque es como se piensa "la semana" cuando se habla de
 * plata. No tiene nada que ver con el sábado en que se habilitan los turnos de
 * la semana siguiente: eso es cuándo se puede reservar, no cuánto se trabajó.
 *
 * `offset` corre la semana: -1 es la anterior, +1 la que viene.
 */
export function weekRange(date: string, offset = 0): DateRange {
  const lunes = addDays(date, -mondayIndex(date) + offset * 7);
  return { from: lunes, to: addDays(lunes, 6) };
}

/** El mes que contiene esa fecha. `offset` corre el mes. */
export function monthRange(date: string, offset = 0): DateRange {
  const [y, m] = date.split("-").map(Number);
  const primero = new Date(Date.UTC(y, m - 1 + offset, 1));
  const ultimo = new Date(Date.UTC(y, m + offset, 0));
  return { from: isoDate(primero), to: isoDate(ultimo) };
}

/** 0 si es lunes, 6 si es domingo. */
function mondayIndex(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

/**
 * Suma días a una fecha local.
 *
 * Se arma en UTC a propósito. Suena contradictorio para una fecha local, pero
 * es justamente lo que evita el error: en UTC no hay cambio de horario de
 * verano, así que sumar un día siempre suma 24 horas y nunca cae dos veces en
 * la misma fecha ni saltea una.
 */
function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return isoDate(new Date(Date.UTC(y, m - 1, d + days)));
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
