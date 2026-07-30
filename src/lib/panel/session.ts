import { createClient } from "@/lib/supabase/server";
import { cargarTenant } from "@/lib/tenant/load";
import { currentTenantSlug } from "@/lib/tenant/resolve";
import type { Tenant } from "@/lib/tenant/types";
import type { Pay } from "@/lib/payroll";

/**
 * Quién entró al panel, y a qué barbería.
 *
 * Son dos preguntas separadas y las dos tienen que dar bien. Estar logueado no
 * alcanza: la cuenta de un barbero de otra barbería es una cuenta válida, pero
 * acá no es nadie. Por eso siempre se busca la fila de `barbers` que cruza
 * usuario Y barbería, y si no aparece, no hay sesión de panel.
 */

/** Un barbero visto desde adentro: con su mail y cómo cobra. */
export type BarberoDelPanel = {
  id: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  role: "owner" | "barber";
  acceptsBookings: boolean;
  isActive: boolean;
  sortOrder: number;
  pay: Pay;
};

export type SesionPanel = {
  tenant: Tenant;
  barbero: BarberoDelPanel;
  /** Atajo de lectura. El permiso de verdad lo aplica RLS, no este booleano. */
  esDuenio: boolean;
};

export const CAMPOS_BARBERO =
  "id, display_name, email, phone, role, accepts_bookings, is_active, sort_order, " +
  "payment_model, commission_percent, pay_amount_cents, pay_period";

type FilaBarbero = {
  id: string;
  display_name: string;
  email: string | null;
  phone: string | null;
  role: "owner" | "barber";
  accepts_bookings: boolean;
  is_active: boolean;
  sort_order: number;
  payment_model: "commission" | "salary" | "chair_rent" | "revenue_only";
  commission_percent: number | string | null;
  pay_amount_cents: number | null;
  pay_period: "week" | "month" | null;
};

/**
 * De las cuatro columnas de cobro a un solo valor con forma.
 *
 * En la base el acuerdo son cuatro columnas donde solo algunas aplican según el
 * modelo; acá adentro es un único valor donde lo que no aplica directamente no
 * existe. La base garantiza que la combinación es coherente —lo hace el CHECK
 * `payment_model_coherente`—, así que esta traducción no tiene que desconfiar.
 */
export function aPay(fila: FilaBarbero): Pay {
  switch (fila.payment_model) {
    case "commission":
      return { model: "commission", percent: Number(fila.commission_percent) };
    case "salary":
    case "chair_rent":
      return {
        model: fila.payment_model,
        amountCents: fila.pay_amount_cents ?? 0,
        period: fila.pay_period ?? "month",
      };
    case "revenue_only":
      return { model: "revenue_only" };
  }
}

export function aBarbero(fila: FilaBarbero): BarberoDelPanel {
  return {
    id: fila.id,
    displayName: fila.display_name,
    email: fila.email,
    phone: fila.phone,
    role: fila.role,
    acceptsBookings: fila.accepts_bookings,
    isActive: fila.is_active,
    sortOrder: fila.sort_order,
    pay: aPay(fila),
  };
}

/**
 * La sesión del panel, o null si no hay.
 *
 * Null puede significar tres cosas —no hay barbería en este dominio, no hay
 * nadie logueado, o el que está logueado no trabaja acá— y a propósito no se
 * distinguen hacia afuera: contarle a un desconocido cuál de las tres es le
 * está confirmando algo que no tiene por qué saber.
 */
export async function sesionDelPanel(): Promise<SesionPanel | null> {
  const slug = await currentTenantSlug();
  if (!slug) return null;

  const sb = await createClient();

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;

  const tenant = await cargarTenant(slug);
  if (!tenant) return null;

  const { data } = await sb
    .from("barbers")
    .select(CAMPOS_BARBERO)
    .eq("tenant_id", tenant.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data) return null;

  const barbero = aBarbero(data as unknown as FilaBarbero);
  // Un barbero dado de baja conserva su historial pero no entra más.
  if (!barbero.isActive) return null;

  return { tenant, barbero, esDuenio: barbero.role === "owner" };
}
