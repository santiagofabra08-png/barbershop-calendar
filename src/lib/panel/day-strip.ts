/**
 * El día del panel, armado como la página de un libro de turnos.
 *
 * Toma los turnos ya ordenados y devuelve la secuencia que se dibuja: los
 * turnos, los huecos entre uno y otro, y la marca de "ahora". Los huecos son
 * parte de la información y no un espacio en blanco: un rato libre a las cuatro
 * es cuando el barbero come, y verlo escrito vale tanto como ver el turno.
 *
 * Es una función pura sobre "HH:MM" en hora local. No sabe de zonas horarias:
 * la conversión ya pasó antes.
 */

export type Anotacion<T> =
  | { tipo: "turno"; at: string; turno: T }
  | { tipo: "hueco"; at: string; hasta: string; minutos: number }
  | { tipo: "ahora"; at: string };

export type TramoDelDia = {
  /** "HH:MM" en hora local. */
  startLocal: string;
  endLocal: string;
};

/** Minutos desde la medianoche. "14:30" → 870. */
export function enMinutos(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Arma la tira del día.
 *
 * `ahora` es "HH:MM" si el día que se está mirando es hoy, y null si no: la
 * marca de ahora no tiene sentido en la agenda del jueves que viene.
 *
 * `huecoMinimo` evita marcar como hueco los cinco minutos entre dos turnos
 * pegados, que no son un descanso sino la forma en que cae la grilla.
 */
export function armarTira<T extends TramoDelDia>(
  turnos: T[],
  ahora: string | null,
  huecoMinimo = 15,
): Anotacion<T>[] {
  const ordenados = [...turnos].sort(
    (a, b) => enMinutos(a.startLocal) - enMinutos(b.startLocal),
  );

  const tira: Anotacion<T>[] = [];

  for (const [i, turno] of ordenados.entries()) {
    tira.push({ tipo: "turno", at: turno.startLocal, turno });

    const siguiente = ordenados[i + 1];
    if (!siguiente) continue;

    // Con turnos superpuestos —que no deberían existir, pero un bloqueo puede
    // taparse con algo— el hueco da negativo. No se dibuja.
    const libre = enMinutos(siguiente.startLocal) - enMinutos(turno.endLocal);
    if (libre >= huecoMinimo) {
      tira.push({
        tipo: "hueco",
        at: turno.endLocal,
        hasta: siguiente.startLocal,
        minutos: libre,
      });
    }
  }

  if (ahora === null) return tira;

  // La marca de ahora se mete donde le toca por hora. Empatada con un turno va
  // primero, para que el turno de las 15:00 a las 15:00 en punto se lea como
  // "es ahora" y no como "ya pasó".
  const min = enMinutos(ahora);
  const donde = tira.findIndex((a) => enMinutos(a.at) >= min);

  const marca: Anotacion<T> = { tipo: "ahora", at: ahora };
  if (donde === -1) tira.push(marca);
  else tira.splice(donde, 0, marca);

  return tira;
}
