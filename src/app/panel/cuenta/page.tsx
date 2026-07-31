import { redirect } from "next/navigation";

import { ContrasenaForm, MisDatosForm } from "@/app/panel/cuenta/forms";
import { NOMBRE_MODELO, detalleDelPago } from "@/lib/panel/pay-copy";
import { sesionDelPanel } from "@/lib/panel/session";

export const dynamic = "force-dynamic";

export default async function CuentaPage() {
  const sesion = await sesionDelPanel();
  if (!sesion) redirect("/entrar");

  const { tenant, barbero, esDuenio } = sesion;
  const detalle = detalleDelPago(barbero.pay, tenant.currency);

  return (
    <>
      <p className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">
        Mi cuenta
      </p>
      <h1 className="mt-1 font-display text-3xl leading-tight text-ink">
        {barbero.displayName}
      </h1>
      <p className="mt-3 text-sm text-muted">
        {esDuenio ? "Dueño" : "Barbero"} en {tenant.name}
        {barbero.email ? ` · ${barbero.email}` : ""}
      </p>

      <h2 className="mt-8 text-xs font-semibold tracking-[0.18em] text-muted uppercase">
        Mis datos
      </h2>
      <MisDatosForm
        displayName={barbero.displayName}
        phone={barbero.phone}
      />

      <h2 className="mt-10 text-xs font-semibold tracking-[0.18em] text-muted uppercase">
        Contraseña
      </h2>
      <ContrasenaForm />

      <h2 className="mt-10 text-xs font-semibold tracking-[0.18em] text-muted uppercase">
        Cómo cobrás
      </h2>
      <div className="card mt-4 px-5 py-5">
        <p className="text-sm text-ink">
          {NOMBRE_MODELO[barbero.pay.model]}
          {detalle ? ` · ${detalle}` : ""}
        </p>
        <p className="mt-2 max-w-prose text-sm text-muted">
          {esDuenio
            ? "Lo cambiás desde Equipo, en tu propia ficha."
            : "Esto lo define el dueño. Si algo no coincide con lo que arreglaron, hablalo con él."}
        </p>
      </div>
    </>
  );
}
