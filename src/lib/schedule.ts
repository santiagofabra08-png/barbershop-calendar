/**
 * Cálculo de la grilla de horarios.
 *
 * Todo acá trabaja en HORA LOCAL de la barbería, como strings "YYYY-MM-DD" y
 * "HH:MM". Es a propósito: "abro a las 14" es un hecho local que no cambia con
 * el horario de verano, y es lo que el cliente ve en pantalla.
 *
 * La conversión a UTC ocurre en un solo lugar —al crear la reserva, del lado
 * del servidor— y no acá.
 *
 * Estas funciones son puras: mismas entradas, mismas salidas. No leen el reloj
 * ni la base. El `now` entra como argumento para poder probarlas.
 */
import type { Barber, Service, Tenant, WorkingHour } from "@/lib/tenant/types";

const DIAS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "setiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

export type Slot = {
  /** "HH:MM" en hora local de la barbería. */
  time: string;
  available: boolean;
};

export type Day = {
  date: string; // "YYYY-MM-DD"
  weekday: number; // 0 = domingo
  dayName: string; // "Martes"
  dayNumber: number; // 29
  monthName: string; // "julio"
  isToday: boolean;
  slots: Slot[];
};

// ---------------------------------------------------------------------------
// Helpers de fecha. Sin librerías: solo Intl y aritmética sobre UTC.
// ---------------------------------------------------------------------------

/** Qué día y hora es en la zona horaria de la barbería. */
export function nowInTimeZone(timeZone: string, at: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);

  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "00";

  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}

/**
 * De hora local de la barbería al instante real.
 *
 * Es el camino inverso a `nowInTimeZone`. Se necesita para el archivo de
 * calendario, que exige el instante en UTC.
 *
 * Cómo funciona: se interpreta la fecha como si fuera UTC, se mide cuánto se
 * desvía eso de la zona pedida y se corrige. Se repite una vez porque cerca
 * de un cambio de horario de verano el desvío del primer intento puede ser el
 * del otro lado del salto.
 */
export function localToUtc(date: string, time: string, timeZone: string): Date {
  const comoSiFueraUtc = Date.parse(`${date}T${time}:00Z`);

  const desvio = (instante: number): number => {
    const p = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(instante));
    const g = (t: string) => Number(p.find((x) => x.type === t)?.value ?? 0);
    const comoLocal = Date.UTC(
      g("year"),
      g("month") - 1,
      g("day"),
      g("hour"),
      g("minute"),
      g("second"),
    );
    return comoLocal - instante;
  };

  let utc = comoSiFueraUtc - desvio(comoSiFueraUtc);
  utc = comoSiFueraUtc - desvio(utc);
  return new Date(utc);
}

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function toTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Días transcurridos desde 1970. Sirve para comparar y sumar fechas. */
function dayOrdinal(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

function dateFromOrdinal(ordinal: number): string {
  const d = new Date(ordinal * 86_400_000);
  return [
    d.getUTCFullYear(),
    String(d.getUTCMonth() + 1).padStart(2, "0"),
    String(d.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Un instante local como número, para comparar fechas y horas de una. */
function localStamp(date: string, time: string): number {
  return dayOrdinal(date) * 1440 + toMinutes(time);
}

// ---------------------------------------------------------------------------
// Ventana de reserva
// ---------------------------------------------------------------------------

/**
 * Hasta cuándo se puede reservar.
 *
 * En modo `weekly` la ventana termina en el próximo momento de apertura: para
 * Tropi, el sábado a las 21:00. Ahí se habilita la semana siguiente. Por eso
 * el domingo —con el local cerrado— ya se puede sacar turno para el martes.
 */
export function bookingWindowEnd(
  tenant: Tenant,
  today: string,
  nowTime: string,
): { date: string; time: string } {
  if (tenant.bookingWindow.mode === "rolling") {
    return {
      date: dateFromOrdinal(dayOrdinal(today) + tenant.bookingWindow.days),
      time: "23:59",
    };
  }

  const { releaseWeekday, releaseTime } = tenant.bookingWindow;
  for (let i = 0; i <= 7; i++) {
    const date = dateFromOrdinal(dayOrdinal(today) + i);
    const yaPasoHoy = i === 0 && toMinutes(releaseTime) <= toMinutes(nowTime);
    if (weekdayOf(date) === releaseWeekday && !yaPasoHoy) {
      return { date, time: releaseTime };
    }
  }

  // Inalcanzable: en 8 días siempre cae el día de apertura.
  return { date: dateFromOrdinal(dayOrdinal(today) + 7), time: releaseTime };
}

// ---------------------------------------------------------------------------
// La grilla
// ---------------------------------------------------------------------------

export type BuildWeekInput = {
  tenant: Tenant;
  service: Service;
  workingHours: WorkingHour[];
  /** Instante actual. Entra como argumento para que la función sea pura. */
  now?: Date;
  /**
   * Horarios ya ocupados, como "YYYY-MM-DD HH:MM" en hora local.
   * Vacío hasta que la base esté conectada.
   */
  busy?: ReadonlySet<string>;
};

/**
 * Los días reservables con sus horarios.
 *
 * Un horario entra si: cae dentro de un tramo de trabajo del barbero, el
 * servicio termina antes del cierre, respeta la anticipación mínima y cae
 * dentro de la ventana de reserva.
 */
export function buildWeek({
  tenant,
  service,
  workingHours,
  now = new Date(),
  busy = new Set<string>(),
}: BuildWeekInput): Day[] {
  const { date: today, time: nowTime } = nowInTimeZone(tenant.timezone, now);

  const earliest = localStamp(today, nowTime) + tenant.minLeadMinutes;
  const windowEnd = bookingWindowEnd(tenant, today, nowTime);
  const latest = localStamp(windowEnd.date, windowEnd.time);

  const days: Day[] = [];

  for (let d = dayOrdinal(today); d <= dayOrdinal(windowEnd.date); d++) {
    const date = dateFromOrdinal(d);
    const weekday = weekdayOf(date);
    const tramos = workingHours.filter((h) => h.weekday === weekday);
    if (tramos.length === 0) continue;

    const slots: Slot[] = [];

    for (const tramo of tramos) {
      const abre = toMinutes(tramo.startsAt);
      const cierra = toMinutes(tramo.endsAt);

      // El turno tiene que TERMINAR antes del cierre, no empezar antes.
      // Con 14:00–21:00 y cortes de 40 min, el último arranca 20:00 y quedan
      // 20 minutos sin usar al final del día.
      for (let m = abre; m + service.durationMinutes <= cierra; m += service.durationMinutes) {
        const stamp = d * 1440 + m;
        if (stamp < earliest) continue;
        if (stamp >= latest) continue;

        // Se revisa el turno entero, no solo su inicio: una reserva que
        // arranca a las 14:20 pisa el hueco de las 14:00 aunque el hueco
        // empiece libre.
        let libre = true;
        for (let t = m; t < m + service.durationMinutes && libre; t += 5) {
          if (busy.has(`${date} ${toTime(t)}`)) libre = false;
        }

        slots.push({ time: toTime(m), available: libre });
      }
    }

    slots.sort((a, b) => a.time.localeCompare(b.time));
    if (slots.length === 0) continue;

    const [, month, dayNumber] = date.split("-").map(Number);
    days.push({
      date,
      weekday,
      dayName: DIAS[weekday],
      dayNumber,
      monthName: MESES[month - 1],
      isToday: date === today,
      slots,
    });
  }

  return days;
}

// ---------------------------------------------------------------------------
// Formato
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Varios barberos
// ---------------------------------------------------------------------------

/** La semana de un barbero. */
export type Agenda = {
  barber: Barber;
  days: Day[];
};

/**
 * Una agenda por barbero.
 *
 * Cada uno tiene sus propios horarios de trabajo y sus propios turnos tomados,
 * así que las grillas no tienen por qué coincidir: uno puede abrir los martes
 * y otro no.
 */
export function buildAgendas({
  tenant,
  service,
  barbers,
  workingHours,
  now = new Date(),
  busy = new Map<string, ReadonlySet<string>>(),
}: {
  tenant: Tenant;
  service: Service;
  barbers: Barber[];
  workingHours: WorkingHour[];
  now?: Date;
  /** Ocupados por barbero: barberId → claves "YYYY-MM-DD HH:MM". */
  busy?: ReadonlyMap<string, ReadonlySet<string>>;
}): Agenda[] {
  return barbers
    .filter((b) => b.acceptsBookings)
    .map((barber) => ({
      barber,
      days: buildWeek({
        tenant,
        service,
        workingHours: workingHours.filter((h) => h.barberId === barber.id),
        now,
        busy: busy.get(barber.id) ?? new Set<string>(),
      }),
    }));
}

/**
 * Todas las agendas fundidas en una: el cliente que no tiene preferencia.
 *
 * Un horario aparece libre si CUALQUIER barbero lo tiene libre. A qué barbero
 * termina yendo lo decide el servidor al confirmar, no el navegador: si dos
 * personas eligen el mismo horario a la vez, quien reparte tiene que ser uno
 * solo.
 */
export function mergeAgendas(agendas: Agenda[]): Day[] {
  const porFecha = new Map<string, Day>();

  for (const { days } of agendas) {
    for (const day of days) {
      const existente = porFecha.get(day.date);
      if (!existente) {
        porFecha.set(day.date, { ...day, slots: day.slots.map((s) => ({ ...s })) });
        continue;
      }

      const porHora = new Map(existente.slots.map((s) => [s.time, s]));
      for (const slot of day.slots) {
        const previo = porHora.get(slot.time);
        if (!previo) porHora.set(slot.time, { ...slot });
        else if (slot.available) previo.available = true;
      }
      existente.slots = [...porHora.values()].sort((a, b) =>
        a.time.localeCompare(b.time),
      );
    }
  }

  return [...porFecha.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * El horario de atención en lenguaje humano.
 *
 * Junta los días que abren igual y comprime los tramos seguidos, para que
 * cinco filas de base se lean como "Martes a sábado · 14:00 a 21:00" en vez de
 * cinco líneas iguales. Se calcula del horario real: si mañana Facundo suma el
 * lunes, el texto cambia solo.
 */
export function summarizeHours(
  workingHours: WorkingHour[],
): { dias: string; horas: string }[] {
  // La semana se lee de lunes a domingo, aunque adentro 0 sea domingo.
  const orden = [1, 2, 3, 4, 5, 6, 0];

  const porDia = new Map<number, string>();
  for (const weekday of orden) {
    // Esto es el horario del LOCAL, no el turno de cada barbero. Si uno entra
    // a las 14 y otro a las 16, la barbería abre a las 14: los tramos se
    // funden en vez de listarse uno atrás de otro.
    const tramos = workingHours
      .filter((h) => h.weekday === weekday)
      .map((h) => ({ desde: toMinutes(h.startsAt), hasta: toMinutes(h.endsAt) }))
      .sort((a, b) => a.desde - b.desde);

    const fundidos: { desde: number; hasta: number }[] = [];
    for (const tramo of tramos) {
      const ultimo = fundidos[fundidos.length - 1];
      if (ultimo && tramo.desde <= ultimo.hasta) {
        ultimo.hasta = Math.max(ultimo.hasta, tramo.hasta);
      } else {
        fundidos.push({ ...tramo });
      }
    }

    if (fundidos.length > 0) {
      porDia.set(
        weekday,
        fundidos.map((t) => `${toTime(t.desde)} a ${toTime(t.hasta)}`).join(" y "),
      );
    }
  }

  const filas: { dias: string; horas: string }[] = [];
  let corrida: number[] = [];

  const cerrar = () => {
    if (corrida.length === 0) return;
    const horas = porDia.get(corrida[0])!;
    const dias =
      corrida.length === 1
        ? DIAS[corrida[0]]
        : `${DIAS[corrida[0]]} a ${DIAS[corrida[corrida.length - 1]].toLowerCase()}`;
    filas.push({ dias, horas });
    corrida = [];
  };

  for (const weekday of orden) {
    const horas = porDia.get(weekday);
    if (!horas) {
      cerrar();
      continue;
    }
    if (corrida.length > 0 && porDia.get(corrida[0]) !== horas) cerrar();
    corrida.push(weekday);
  }
  cerrar();

  return filas;
}

export function formatPrice(cents: number, currency: string): string {
  const amount = cents / 100;
  const shown = Number.isInteger(amount)
    ? amount.toLocaleString("es-UY")
    : amount.toLocaleString("es-UY", { minimumFractionDigits: 2 });
  return currency === "UYU" ? `$${shown}` : `${shown} ${currency}`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** 0 → "domingo", 6 → "sábado". En minúscula: va en el medio de una frase. */
export function weekdayName(weekday: number): string {
  return (DIAS[weekday] ?? DIAS[0]).toLowerCase();
}

/** "2026-07-30" → "Jueves 30 de julio". */
export function formatDateLong(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  return `${DIAS[weekdayOf(date)]} ${d} de ${MESES[m - 1]}`;
}

/** "2026-07-27" y "2026-08-02" → "27 de julio al 2 de agosto". */
export function formatDateRange(from: string, to: string): string {
  const [, mDesde, dDesde] = from.split("-").map(Number);
  const [, mHasta, dHasta] = to.split("-").map(Number);

  // Dentro del mismo mes no hace falta repetirlo: "27 al 31 de julio".
  if (mDesde === mHasta) {
    return `${dDesde} al ${dHasta} de ${MESES[mHasta - 1]}`;
  }
  return `${dDesde} de ${MESES[mDesde - 1]} al ${dHasta} de ${MESES[mHasta - 1]}`;
}

/** Suma días a una fecha local sin pasar por la zona horaria. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
