/**
 * Qué le falta a una barbería recién dada de alta.
 *
 * Puro: entra el estado del local y sale la lista. No consulta nada.
 *
 * **Para qué existe.** `crear-barberia` pide lo mínimo para que la página abra
 * el mismo día: un servicio, un horario, el mail del dueño. Todo lo demás
 * queda en null. Quien entra al panel por primera vez no ve un producto a
 * medio configurar, ve un producto que no anda, y ahí es donde se abandona.
 *
 * **Nada de esto se guarda.** No hay una columna `onboarding_step` ni una
 * marca de "ya lo vi": cada paso se deduce del dato de verdad, cada vez. Un
 * estado guardado se desincroniza del mundo real el día que alguien borra un
 * servicio o saca un horario, y entonces la lista miente, que es peor que no
 * existir.
 *
 * **Solo entran pasos que se pueden verificar.** Fue tentador poner "elegí tus
 * colores", pero para saber si los cambiaron habría que comparar contra las
 * paletas de arranque, que viven en `scripts/lib/alta.mts` y no se despliegan.
 * Copiarlas acá sería un segundo lugar que un día dice otra cosa. Y una
 * barbería que se queda con la paleta de arranque no está rota: la página se
 * ve bien igual. Un paso que no se puede tildar deja la lista para siempre en
 * pantalla, y una lista que no se termina nunca se convierte en un cartel que
 * nadie lee.
 */

export type IdDePaso =
  | "horarios"
  | "logo"
  | "direccion"
  | "whatsapp"
  | "servicios";

export type PasoInicial = {
  id: IdDePaso;
  titulo: string;
  /** Qué se rompe si falta, en una línea. Es lo que hace que lo hagan. */
  porque: string;
  href: string;
  hecho: boolean;
  /**
   * Lo que se rompe está a la vista del cliente ahora mismo.
   *
   * Solo un paso lo es: un barbero que atiende y no tiene horario no aparece
   * en la página, así que nadie puede reservar con él. Los otros cuatro hacen
   * que la página se vea a medio hacer, que es feo pero no impide reservar.
   */
  bloquea: boolean;
};

export type EstadoDelLocal = {
  tieneLogoClaro: boolean;
  tieneLogoOscuro: boolean;
  tieneDireccion: boolean;
  tieneWhatsApp: boolean;
  /** Servicios reservables y prendidos. Los descuentos no cuentan. */
  serviciosActivos: number;
  /** Nombres de los que atienden y no tienen ni un tramo cargado. */
  barberosSinHorario: string[];
};

/** "Ana", "Ana y Beto", "Ana, Beto y Cata". */
export function enumerar(nombres: string[]): string {
  if (nombres.length === 0) return "";
  if (nombres.length === 1) return nombres[0];
  return `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;
}

/**
 * Los cinco pasos, siempre los cinco, cada uno sabiendo si está hecho.
 *
 * El orden es el de cuánto duele que falte, no el del panel: primero lo que
 * impide reservar, después lo que hace que la página parezca de otro.
 */
export function primerosPasos(e: EstadoDelLocal): PasoInicial[] {
  const sinHorario = e.barberosSinHorario;

  return [
    {
      id: "horarios",
      titulo: "El horario de cada barbero",
      porque:
        sinHorario.length > 0
          ? `${enumerar(sinHorario)} no aparece${sinHorario.length > 1 ? "n" : ""} en la página: sin horario cargado no hay hora que ofrecer.`
          : "Todos los que atienden tienen sus días y sus horas cargados.",
      href: "/panel/horarios",
      hecho: sinHorario.length === 0,
      bloquea: true,
    },
    {
      id: "servicios",
      titulo: "Los servicios que ofrecés",
      porque:
        "El alta carga uno solo para que la página abra el mismo día. El resto los ponés vos.",
      href: "/panel/servicios",
      // Uno solo es la huella del alta, no una decisión: el script pide un
      // servicio como mínimo y nada más.
      hecho: e.serviciosActivos >= 2,
      bloquea: false,
    },
    {
      id: "logo",
      titulo: "El logo del local",
      porque:
        "Sin logo, arriba de la página va tu nombre escrito y nada más.",
      href: "/panel/ajustes",
      hecho: e.tieneLogoClaro && e.tieneLogoOscuro,
      bloquea: false,
    },
    {
      id: "direccion",
      titulo: "La dirección",
      porque:
        "Arma el mapa del pie de página y va en el mail de confirmación: sin eso el cliente sabe cuándo pero no dónde.",
      href: "/panel/ajustes",
      hecho: e.tieneDireccion,
      bloquea: false,
    },
    {
      id: "whatsapp",
      titulo: "El WhatsApp del local",
      porque:
        "Queda fijo abajo a la derecha de la página, para todo lo que la reserva no contesta.",
      href: "/panel/ajustes",
      hecho: e.tieneWhatsApp,
      bloquea: false,
    },
  ];
}

/** Solo lo que falta. Vacío significa que la lista ya no se dibuja. */
export function loQueFalta(e: EstadoDelLocal): PasoInicial[] {
  return primerosPasos(e).filter((p) => !p.hecho);
}

/**
 * El título del bloque, según qué tan mal está la cosa.
 *
 * Con algo que impide reservar el tono cambia: no es una lista de mejoras, es
 * un aviso de que la página no está funcionando entera.
 */
export function tituloDeLaLista(faltan: PasoInicial[]): string {
  if (faltan.some((p) => p.bloquea)) return "Falta algo para poder reservar";
  return "Para terminar de armar tu página";
}
