import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ShopFooter, ShopHeader } from "@/components/shop-chrome";
import { TenantTheme } from "@/components/tenant-theme";
import { cargarBarberia } from "@/lib/tenant/load";
import { currentTenantSlug } from "@/lib/tenant/resolve";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pedido enviado",
  robots: { index: false, follow: false },
};

/**
 * Después de enviar el pedido.
 *
 * Página propia y no un cartel sobre el catálogo: así recargar no reenvía nada
 * y el botón de atrás no devuelve a un formulario ya mandado.
 *
 * No muestra qué se pidió. Esta URL no tiene nada secreto —la puede abrir
 * cualquiera— y ahí adentro habría un nombre y un teléfono.
 */
export default async function PedidoEnviadoPage() {
  const slug = await currentTenantSlug();
  const data = slug ? await cargarBarberia(slug) : null;
  if (!data) notFound();

  const { tenant, workingHours } = data;

  return (
    <>
      <TenantTheme tenant={tenant} />

      <ShopHeader tenant={tenant} compact />

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pt-10 pb-16 sm:px-8">
        <div className="card px-6 py-10 text-center sm:px-10 sm:py-14">
          <h1 className="font-display text-3xl leading-tight font-bold text-ink">
            Listo, nos llegó
          </h1>
          <p className="mx-auto mt-4 max-w-prose text-[15px] leading-relaxed text-muted">
            Te vamos a escribir al teléfono que dejaste para coordinar cuándo lo
            pasás a buscar y cómo lo pagás. Si es un día de mucho movimiento
            puede demorar un rato.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/"
              className="rounded-lg bg-accent px-6 py-3.5 text-xs font-semibold tracking-[0.08em] text-surface uppercase transition-colors duration-150 ease-out hover:bg-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink active:bg-ink/90"
            >
              Reservar un turno
            </Link>
            <Link
              href="/productos"
              className="rounded-lg border border-ink/20 px-6 py-3.5 text-xs font-semibold tracking-[0.08em] text-ink uppercase transition-colors duration-150 ease-out hover:border-ink hover:bg-ink hover:text-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:opacity-90"
            >
              Volver al catálogo
            </Link>
          </div>
        </div>
      </main>

      <ShopFooter tenant={tenant} workingHours={workingHours} />
    </>
  );
}
