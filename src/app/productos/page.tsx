import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Catalogo, type ProductoEnVidriera } from "@/app/productos/catalogo";
import { ShopFooter, ShopHeader } from "@/components/shop-chrome";
import { TenantTheme } from "@/components/tenant-theme";
import { urlDeImagen } from "@/lib/panel/imagen";
import { cargarVidriera } from "@/lib/panel/productos";
import { cargarBarberia } from "@/lib/tenant/load";
import { currentTenantSlug } from "@/lib/tenant/resolve";

// El stock cambia con cada venta del mostrador. Cachear esta página mostraría
// como disponible algo que se vendió hace diez minutos.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const slug = await currentTenantSlug();
  const data = slug ? await cargarBarberia(slug) : null;
  if (!data?.tenant.productsEnabled) return { title: "Productos" };

  return {
    title: `Productos · ${data.tenant.name}`,
    description: `Lo que vendemos en ${data.tenant.name}, además del corte.`,
  };
}

export default async function PaginaDeProductos() {
  const slug = await currentTenantSlug();
  if (!slug) notFound();

  const data = await cargarBarberia(slug);
  if (!data) notFound();

  const { tenant, workingHours } = data;

  // La barbería que apagó la vidriera no tiene catálogo. No es un permiso: es
  // que esta página no existe para ella.
  if (!tenant.productsEnabled) notFound();

  const productos: ProductoEnVidriera[] = (await cargarVidriera(tenant)).map(
    (p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      priceCents: p.priceCents,
      stock: p.stock,
      imageUrl: urlDeImagen(p.imagePath),
    }),
  );

  return (
    <>
      <TenantTheme tenant={tenant} />

      <ShopHeader tenant={tenant} compact />

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pt-8 pb-16 sm:px-8">
        <h1 className="font-display text-2xl leading-tight font-bold text-ink sm:text-3xl">
          Catálogo de productos
        </h1>

        {/* El aviso va acá arriba y no en letra chica al final. Alguien que
            elige cosas creyendo que las está comprando se va a sentir engañado
            al llegar al botón, y con razón. */}
        <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-muted">
          Elegí lo que quieras y dejanos tu teléfono. Te escribimos para
          coordinar cómo lo pasás a buscar y cómo lo pagás.
        </p>

        {productos.length === 0 ? (
          <p className="card mt-8 px-5 py-10 text-center text-sm text-muted">
            Todavía no hay nada cargado. Pasá por el local y preguntanos.
          </p>
        ) : (
          <div className="mt-8">
            <Catalogo productos={productos} moneda={tenant.currency} />
          </div>
        )}

        <p className="mt-12 text-sm text-muted">
          ¿Buscabas un turno?{" "}
          <Link
            href="/"
            className="font-medium text-ink underline decoration-ink/25 underline-offset-4 transition-colors duration-150 ease-out hover:decoration-ink"
          >
            Reservá acá
          </Link>
          .
        </p>
      </main>

      <ShopFooter tenant={tenant} workingHours={workingHours} />
    </>
  );
}
