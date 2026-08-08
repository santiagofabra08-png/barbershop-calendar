/**
 * La barbería que vive dentro de la portada.
 *
 * No es una barbería de prueba más. Las de `sembrar-demo` existen para que
 * haya de quién separarse en la prueba de aislamiento y para mirar a mano;
 * esta se muestra **incrustada en la página de ventas**, y la va a tocar un
 * desconocido que llegó de un reel.
 *
 * De ahí salen sus dos particularidades:
 *
 *   · **Abre los siete días, de mañana a noche.** Ninguna barbería de verdad
 *     trabaja así. Pero si alguien abre la portada un lunes y la demo dice
 *     "cerrado", lo que entiende no es que el local descansa: entiende que el
 *     producto no anda. La demo tiene que tener horarios libres cualquier día
 *     y a cualquier hora.
 *   · **Se limpia sola todos los días.** La gente reserva de verdad ahí
 *     adentro. Sin limpieza, en un mes la agenda está llena de turnos de
 *     curiosos y no queda un hueco para mostrar.
 *
 * El alta la hace el mismo `crearBarberia` que usás con un cliente que paga.
 */
import { PALETAS, clienteAdmin, type BarberiaNueva } from "./alta.mts";
import { localToUtc } from "../../src/lib/schedule.ts";
import { SLUG_DEMO } from "../../src/lib/demo.ts";

/** El mismo cliente que arma `alta.mts`, para que el tipo no se bifurque. */
type Admin = ReturnType<typeof clienteAdmin>;

export { SLUG_DEMO };

/** Con qué cuenta entra el script de capturas al panel de la demo. */
export const MAIL_DEMO = "demo@ejemplo.com";

export const BARBERIA_DEMO: BarberiaNueva = {
  slug: SLUG_DEMO,
  nombre: "Barbería Modelo",
  timezone: "America/Montevideo",
  moneda: "UYU",
  direccion: "Av. Siempre Abierta 1100",
  // Papel cálido y rojo de poste. Elegida para que contraste con la porcelana
  // y el azul de la portada: incrustada tiene que leerse como otra cosa, no
  // como una continuación de la página que la contiene.
  colores: PALETAS.clasica.colores,
  // Dos semanas y no tres: la tira de días es lo primero que se ve y con
  // veintiuno queda una pared de casilleros.
  ventana: { modo: "rolling", dias: 14 },
  // Media hora de anticipación y no una: con ventana corta, alguien que entra
  // a las 19:55 igual encuentra algo para tocar hoy.
  minLead: 30,
  plazoCancelacion: 120,
  vidriera: true,

  // ⚠️ Deliberadamente chica.
  //
  // La primera versión tenía cuatro servicios, tres barberos y doce horas de
  // agenda. Todo correcto y todo real, pero incrustada en la portada se veía
  // como una pared: el visitante abre eso y no ve un producto ordenado, ve
  // trabajo. Una demo no tiene que demostrar cuánto entra, tiene que dejar
  // entender de un vistazo qué hace.
  //
  // Una barbería de verdad puede cargar todo lo que quiera. Ésta es la
  // vidriera, y en una vidriera se ponen tres cosas, no el depósito entero.
  servicios: [
    { nombre: "Corte", minutos: 40, precio: 650, desc: "Lavado, corte y peinado." },
    { nombre: "Corte y barba", minutos: 60, precio: 950 },
    { nombre: "Barba", minutos: 25, precio: 400 },
  ],
  productos: [
    { nombre: "Cera mate", precio: 480, stock: 12, desc: "Fijación fuerte, sin brillo." },
    { nombre: "Aceite para barba", precio: 390, stock: 8 },
  ],
  barberos: [
    {
      nombre: "Andrés",
      rol: "owner",
      cobro: { modelo: "revenue_only" },
      email: MAIL_DEMO,
      // Los siete días siguen: si alguien mira la portada un lunes y la demo
      // dice cerrado, entiende que el producto no anda. Pero la jornada se
      // acorta, que es lo que llenaba la grilla de horarios.
      dias: [0, 1, 2, 3, 4, 5, 6],
      tramos: [["10:00", "18:00"]],
    },
    {
      nombre: "Bruno",
      rol: "barber",
      cobro: { modelo: "commission", porcentaje: 50 },
      dias: [0, 1, 2, 3, 4, 5, 6],
      tramos: [["11:00", "19:00"]],
    },
  ],
};

// ============================================================================
// Datos para las capturas
// ============================================================================

const NOMBRES = [
  "Martín Rodríguez",
  "Diego Suárez",
  "Nicolás Pérez",
  "Rodrigo Álvarez",
  "Federico Méndez",
  "Joaquín Silva",
  "Mateo Fernández",
  "Bruno Castro",
  "Agustín Rossi",
  "Emiliano Núñez",
];

/** La fecha de hoy en la zona de la barbería, como `YYYY-MM-DD`. */
export function hoyEn(tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function sumarDias(fecha: string, dias: number): string {
  const [y, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10);
}

/**
 * Llena la demo con una jornada creíble, para que las capturas muestren algo.
 *
 * Una captura de una agenda vacía no vende nada: parece que el producto no se
 * usa. Pero estos turnos ocupan horarios de verdad, así que se siembran justo
 * antes de sacar las fotos y se borran justo después —la demo viva tiene que
 * quedar con la agenda despejada para que el visitante encuentre huecos—.
 */
export async function sembrarJornada(
  admin: Admin,
  tenantId: string,
  tz: string,
): Promise<void> {
  const { data: servicios } = await admin
    .from("services")
    .select("id, price_cents, duration_minutes")
    .eq("tenant_id", tenantId)
    .eq("kind", "service")
    .eq("is_active", true);

  const { data: barberos } = await admin
    .from("barbers")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("sort_order");

  if (!servicios?.length || !barberos?.length) {
    throw new Error("la demo no tiene servicios o barberos");
  }

  const hoy = hoyEn(tz);
  const filas: Record<string, unknown>[] = [];
  const MEDIOS = ["cash", "card", "transfer"] as const;

  const aHora = (m: number) =>
    `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

  let n = 0;

  // De una semana atrás hasta mañana.
  //
  // El pasado ya cobrado es lo que le da contenido a Cobros y a Semana: sin
  // historial, esas dos pantallas se ven vacías y no se entiende para qué
  // sirven. Y mañana hace falta porque la agenda del día siguiente es donde
  // están los botones de WhatsApp para recordarle el turno a cada cliente —si
  // no se siembra, esa captura sale con el cartel de "no hay nada anotado"—.
  for (let d = 7; d >= -1; d--) {
    const fecha = sumarDias(hoy, -d);

    for (const [bi, b] of barberos.entries()) {
      // Tres turnos por barbero por día, salteados para que no parezca un
      // horario generado por una máquina.
      for (let k = 0; k < 3; k++) {
        const inicio = 9 * 60 + bi * 40 + k * 150 + (d % 2) * 20;
        const s = servicios[(n + bi) % servicios.length];
        const dur = s.duration_minutes as number;
        const precio = s.price_cents as number;
        const pasado = d > 0;

        filas.push({
          tenant_id: tenantId,
          barber_id: b.id,
          service_id: s.id,
          kind: "booking",
          status: "confirmed",
          // Casi todos reservados por el cliente desde la página, alguno
          // cargado a mano por el barbero. El reparto importa: la agenda es la
          // captura que ilustra "el cliente reserva solo", y si todos dijeran
          // "cargado a mano" estaría mostrando lo contrario de lo que dice el
          // texto al lado. Depende de `bi` y `k` y no de `n`, porque `n` avanza
          // de a tres entre los turnos que caen a la misma hora y los dejaba a
          // todos del mismo lado.
          source: (bi + k) % 4 === 0 ? "panel" : "online",
          starts_at: localToUtc(fecha, aHora(inicio), tz).toISOString(),
          ends_at: localToUtc(fecha, aHora(inicio + dur), tz).toISOString(),
          client_name: NOMBRES[n % NOMBRES.length],
          client_phone: "+59899000000",
          client_email: "demo@ejemplo.com",
          price_cents: precio,
          duration_minutes: dur,
          // Lo de días anteriores está cobrado; lo de hoy no, para que la
          // pantalla de Cobros tenga algo pendiente que mostrar.
          ...(pasado
            ? {
                charged_at: localToUtc(fecha, aHora(inicio + dur), tz).toISOString(),
                charged_total_cents: precio,
                charged_services_cents: precio,
                charged_products_cents: 0,
                payment_method: MEDIOS[n % 3],
              }
            : {}),
        });
        n++;
      }
    }
  }

  for (let i = 0; i < filas.length; i += 400) {
    const { error } = await admin.from("appointments").insert(filas.slice(i, i + 400));
    if (error) throw new Error(`al sembrar la demo: ${error.message}`);
  }
}

/**
 * Deja la demo con la agenda despejada.
 *
 * Borra **todos** sus turnos, sin distinguir los sembrados de los que dejó un
 * visitante. Eso es a propósito y solo es aceptable acá: en la demo no hay nada
 * valioso, y un turno de un curioso ocupa un horario que el próximo visitante
 * necesita encontrar libre. Nunca correr esto contra una barbería de verdad.
 *
 * La usan el script de capturas y la tarea diaria, para que "limpiar la demo"
 * quiera decir exactamente lo mismo en los dos lados.
 */
export async function limpiarDemo(admin: Admin, tenantId: string): Promise<number> {
  const { data, error } = await admin
    .from("appointments")
    .delete()
    .eq("tenant_id", tenantId)
    .select("id");

  if (error) throw new Error(`al limpiar la demo: ${error.message}`);
  return data?.length ?? 0;
}
