import Link from "next/link";
import { redirect } from "next/navigation";

import { crearServicio } from "@/app/panel/servicios/actions";
import { ServiceForm } from "@/app/panel/servicios/service-form";
import { sesionDelPanel } from "@/lib/panel/session";

export const dynamic = "force-dynamic";

export default async function NuevoServicioPage() {
  const sesion = await sesionDelPanel();
  if (!sesion) redirect("/entrar");
  if (!sesion.esDuenio) redirect("/panel");

  return (
    <>
      <Link
        href="/panel/servicios"
        className="text-sm text-muted transition-colors duration-150 ease-out hover:text-ink"
      >
        ‹ Servicios
      </Link>

      <h1 className="mt-3 font-display text-3xl leading-tight text-ink">
        Agregar servicio
      </h1>
      <p className="mt-3 max-w-prose text-sm text-muted">
        Apenas lo guardes aparece en la página y se puede reservar.
      </p>

      <ServiceForm
        accion={crearServicio}
        textoBoton="Agregar servicio"
        moneda={sesion.tenant.currency}
        inicial={{
          name: "",
          description: null,
          durationMinutes: 40,
          priceCents: 0,
          kind: "service",
        }}
      />
    </>
  );
}
