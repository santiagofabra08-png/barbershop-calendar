import Link from "next/link";
import { redirect } from "next/navigation";

import { crearProducto } from "@/app/panel/productos/actions";
import { ProductForm } from "@/app/panel/productos/product-form";
import { sesionDelPanel } from "@/lib/panel/session";

export const dynamic = "force-dynamic";

export default async function NuevoProductoPage() {
  const sesion = await sesionDelPanel();
  if (!sesion) redirect("/entrar");
  if (!sesion.esDuenio) redirect("/panel");

  return (
    <>
      <Link
        href="/panel/productos"
        className="text-sm text-muted transition-colors duration-150 ease-out hover:text-ink"
      >
        ‹ Productos
      </Link>

      <h1 className="mt-3 font-display text-3xl leading-tight text-ink">
        Agregar producto
      </h1>
      <p className="mt-3 max-w-prose text-sm text-muted">
        {sesion.tenant.productsEnabled
          ? "Apenas lo guardes aparece en tu página."
          : "Se guarda en el catálogo. Todavía no lo ve nadie: la vidriera está oculta."}
      </p>

      <ProductForm
        accion={crearProducto}
        textoBoton="Agregar producto"
        moneda={sesion.tenant.currency}
        inicial={{
          name: "",
          description: null,
          priceCents: 0,
          stock: 0,
          imagePath: null,
        }}
      />
    </>
  );
}
