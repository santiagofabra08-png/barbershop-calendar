/**
 * La forma de un cobro.
 *
 * Sin nada del servidor adentro, para que lo puedan usar las dos mitades. Lo
 * que lee la base vive en `cobros.ts`; si estos tipos estuvieran ahí, importar
 * una constante desde un componente de cliente arrastraría medio servidor al
 * navegador —y en el mejor de los casos falla el build, en el peor no falla.
 */

export type MedioDePago = "cash" | "card" | "transfer";

export const MEDIOS: { valor: MedioDePago; label: string }[] = [
  { valor: "cash", label: "Efectivo" },
  { valor: "card", label: "Tarjeta" },
  { valor: "transfer", label: "Transferencia" },
];

export const NOMBRE_MEDIO: Record<MedioDePago, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  transfer: "Transferencia",
};

export type RenglonDeTicket = {
  name: string;
  amountCents: number;
};

export type TurnoParaCobrar = {
  id: string;
  barberId: string;
  barberName: string;
  /** "HH:MM" en hora local de la barbería. */
  hora: string;
  status: "confirmed" | "no_show";
  clientName: string | null;
  serviceName: string | null;
  /** Lo que se esperaba cobrar: el precio congelado al reservar. */
  priceCents: number;
  chargedAt: string | null;
  chargedTotalCents: number | null;
  paymentMethod: MedioDePago | null;
  items: RenglonDeTicket[];
};
