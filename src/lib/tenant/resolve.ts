import { headers } from "next/headers";

/**
 * De qué barbería es la página que se está pidiendo.
 *
 * Cada barbería vive en su subdominio: `tropi-barbershop.tuapp.com`. El slug
 * sale del host, nunca de una constante.
 */
export function slugFromHost(
  host: string | null,
  rootDomain: string,
): string | null {
  if (!host) return null;

  const hostname = host.split(":")[0].toLowerCase();
  const root = rootDomain.split(":")[0].toLowerCase();

  if (hostname === root || hostname === `www.${root}`) return null;
  if (!hostname.endsWith(`.${root}`)) return null;

  const sub = hostname.slice(0, -(root.length + 1));
  // Un subdominio anidado (a.b.tuapp.com) no es un slug válido.
  if (sub === "" || sub === "www" || sub.includes(".")) return null;

  return sub;
}

/**
 * El slug de la petición actual.
 *
 * En desarrollo `localhost` no tiene subdominio, así que se acepta
 * `DEV_TENANT_SLUG` como salida de emergencia. Solo fuera de producción: en
 * producción, sin subdominio no hay barbería.
 */
export async function currentTenantSlug(): Promise<string | null> {
  const host = (await headers()).get("host");
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "";

  const fromHost = slugFromHost(host, root);
  if (fromHost) return fromHost;

  if (process.env.NODE_ENV !== "production") {
    return process.env.DEV_TENANT_SLUG ?? null;
  }

  return null;
}
