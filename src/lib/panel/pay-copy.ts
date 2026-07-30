import { formatPrice } from "@/lib/schedule";
import type { Pay, PaymentModel, PayPeriod } from "@/lib/payroll";

/**
 * Cómo se le cuenta a una persona el acuerdo que tiene.
 *
 * Vive en un solo lugar porque las mismas palabras aparecen en tres pantallas:
 * al elegir el modelo, en la ficha del barbero y en el recuento de la semana.
 * Si el dueño lee "alquiler de silla" en un lado y "cuota fija" en otro, va a
 * creer que son dos cosas distintas.
 */

const PERIODO: Record<PayPeriod, string> = {
  week: "por semana",
  month: "por mes",
};

/** El nombre corto, para un chip o un título. */
export const NOMBRE_MODELO: Record<PaymentModel, string> = {
  commission: "A comisión",
  salary: "Sueldo fijo",
  chair_rent: "Alquiler de silla",
  revenue_only: "Solo recaudación",
};

/**
 * La reseña de cada modelo, para el momento de elegir.
 *
 * En segunda persona y sin vocabulario contable: quien lo lee es un barbero
 * decidiendo cómo le paga a un compañero, no un contador.
 */
export const RESENIA_MODELO: Record<PaymentModel, string> = {
  commission:
    "Se lleva un porcentaje de cada corte que hace. Si corta más, cobra más. " +
    "Es lo más común con un barbero empleado.",
  salary:
    "Cobra siempre lo mismo, corte más o corte menos. El recuento sirve para " +
    "ver cómo viene trabajando, no para calcular cuánto pagarle.",
  chair_rent:
    "Te paga un fijo por usar la silla y se queda con todo lo que corta. " +
    "Acá el que cobra es la barbería, no él.",
  revenue_only:
    "No se reparte nada desde el panel: la caja de sus cortes es de la " +
    "barbería. Es lo que corresponde para el dueño, o si el arreglo se " +
    "maneja por afuera.",
};

/** El acuerdo concreto de una persona: "50% de cada corte". */
export function detalleDelPago(pay: Pay, currency: string): string | null {
  switch (pay.model) {
    case "commission":
      return `${formatPercent(pay.percent)}% de cada corte`;
    case "salary":
      return `${formatPrice(pay.amountCents, currency)} ${PERIODO[pay.period]}`;
    case "chair_rent":
      return `Paga ${formatPrice(pay.amountCents, currency)} ${PERIODO[pay.period]}`;
    case "revenue_only":
      return null;
  }
}

/** Cómo se titula, en el recuento, el número que le toca a la persona. */
export function tituloDeLoQueLeToca(pay: Pay): string {
  switch (pay.model) {
    case "commission":
      return "Su comisión";
    case "salary":
      return "Su sueldo";
    case "chair_rent":
      return "Le queda a él";
    case "revenue_only":
      return "Queda en la caja";
  }
}

/** 50 → "50", 33.5 → "33,5". Sin decimales de adorno. */
function formatPercent(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toLocaleString("es-UY");
}
