import type { TurnoDelPanel } from "@/lib/panel/data";

/**
 * Un día de trabajo inventado, para mostrar el panel desde afuera.
 *
 * Puro: entra la fecha y salen los turnos. No consulta nada.
 *
 * **Por qué inventado y no el día real de la demo.** La barbería de
 * demostración se vacía todos los días, así que su agenda de verdad está casi
 * siempre en cero: quien entre a ver el panel por dentro se encontraría con
 * "no hay nada anotado para este día", que es exactamente lo contrario de lo
 * que hay que mostrar. Y sembrarla ocuparía los horarios que el visitante
 * necesita encontrar libres del otro lado.
 *
 * **Por qué escrito a mano y no generado.** Un día generado con un bucle sale
 * parejo: todos los turnos de la misma duración, sin huecos raros, sin nadie
 * cargado a mano. Un día de barbería no se parece a eso. Acá hay un almuerzo
 * bloqueado, un cliente que entró por la puerta, huecos de distinto largo y la
 * mitad del día ya cobrada, que es lo que hace que se lea como un día y no
 * como una tabla.
 *
 * Los nombres y los precios son los de la barbería de demostración, para que
 * el que acaba de reservar del otro lado reconozca lo que está mirando.
 */

/** Quién atiende en el día de ejemplo. */
export const BARBEROS_DE_EJEMPLO = [
  { id: "ejemplo-andres", displayName: "Andrés" },
  { id: "ejemplo-bruno", displayName: "Bruno" },
] as const;

/** La hora que marca la línea de "Ahora" en el ejemplo. */
export const AHORA_DE_EJEMPLO = "14:50";

type Renglon = {
  desde: string;
  hasta: string;
  barbero: 0 | 1;
  cliente?: string;
  servicio?: string;
  precio?: number;
  /** Un rato bloqueado, no un turno. */
  motivo?: string;
  /** Cargado a mano por el barbero en vez de reservado desde la página. */
  aMano?: boolean;
  cobrado?: boolean;
};

const DIA: Renglon[] = [
  {
    desde: "10:00",
    hasta: "10:40",
    barbero: 0,
    cliente: "Martín Rodríguez",
    servicio: "Corte",
    precio: 65000,
    cobrado: true,
  },
  {
    desde: "11:00",
    hasta: "11:25",
    barbero: 1,
    cliente: "Diego Suárez",
    servicio: "Barba",
    precio: 40000,
    cobrado: true,
  },
  {
    desde: "11:20",
    hasta: "12:20",
    barbero: 0,
    cliente: "Nicolás Pérez",
    servicio: "Corte y barba",
    precio: 95000,
    cobrado: true,
  },
  // El almuerzo. Es lo que explica por qué a las 13 no se puede reservar, y es
  // la mitad del argumento de la pantalla de horarios.
  { desde: "13:00", hasta: "14:00", barbero: 0, motivo: "Almuerzo" },
  {
    desde: "14:00",
    hasta: "14:40",
    barbero: 0,
    cliente: "Rodrigo Álvarez",
    servicio: "Corte",
    precio: 65000,
    aMano: true,
  },
  {
    desde: "15:30",
    hasta: "16:10",
    barbero: 1,
    cliente: "Mateo Fernández",
    servicio: "Corte",
    precio: 65000,
  },
  {
    desde: "17:00",
    hasta: "18:00",
    barbero: 1,
    cliente: "Agustín Rossi",
    servicio: "Corte y barba",
    precio: 95000,
  },
];

/**
 * El día de ejemplo, con la forma que espera la agenda del panel.
 *
 * La fecha entra como argumento y no se saca de un reloj acá adentro: eso es
 * lo que deja probarlo, y lo que deja dibujar el mismo día en el servidor y en
 * el navegador sin que se corran por un huso horario.
 */
export function jornadaDeEjemplo(fecha: string): TurnoDelPanel[] {
  return DIA.map((r, i) => ({
    id: `ejemplo-${i}`,
    barberId: BARBEROS_DE_EJEMPLO[r.barbero].id,
    kind: r.motivo ? "block" : "booking",
    status: "confirmed",
    startLocal: r.desde,
    endLocal: r.hasta,
    dateLocal: fecha,
    clientName: r.cliente ?? null,
    // Un teléfono de la franja que Uruguay no asigna. El botón de WhatsApp
    // igual no navega afuera del panel, pero un número que existe de verdad
    // no se pone en una pantalla de muestra ni aunque no se use.
    clientPhone: r.cliente ? "+59899000000" : null,
    serviceName: r.servicio ?? null,
    priceCents: r.precio ?? null,
    commissionPercent: null,
    reason: r.motivo ?? null,
    source: r.motivo ? null : r.aMano ? "panel" : "online",
    publicToken: null,
    chargedAt: r.cobrado ? `${fecha}T12:00:00.000Z` : null,
    chargedTotalCents: r.cobrado ? (r.precio ?? null) : null,
  }));
}

/** Los nombres, listos para que la agenda diga de quién es cada turno. */
export function nombresDeEjemplo(): Map<string, string> {
  return new Map(BARBEROS_DE_EJEMPLO.map((b) => [b.id, b.displayName]));
}
