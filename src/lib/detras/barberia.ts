import { SLUG_DEMO } from "@/lib/demo";
import { cargarTenant } from "@/lib/tenant/load";
import { currentTenantSlug } from "@/lib/tenant/resolve";
import type { Tenant } from "@/lib/tenant/types";

/**
 * La barbería del detrás de escena, o null si acá no va.
 *
 * ⚠️ **Solo la barbería de demostración.** El detrás de escena es material de
 * venta nuestro, y `/detras` es una dirección que existe en el dominio de toda
 * barbería que use esto. Sin este `===`, un cliente que paga tiene colgando de
 * su propio dominio una página que le explica el producto a sus clientes, con
 * el nombre de otra barbería adentro.
 *
 * Es la misma condición que ya aplican `FranjaDemo` y `/api/recordatorios`, y
 * por las mismas razones. Vive acá y no repetida en cada página del detrás de
 * escena, porque un lugar donde falte es un agujero.
 */
export async function barberiaDelDetras(): Promise<Tenant | null> {
  const slug = await currentTenantSlug();
  if (slug !== SLUG_DEMO) return null;
  return cargarTenant(SLUG_DEMO);
}
