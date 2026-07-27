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
import type { Service, Tenant, WorkingHour } from "@/lib/tenant/types";

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

        const time = toTime(m);
        slots.push({ time, available: !busy.has(`${date} ${time}`) });
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
