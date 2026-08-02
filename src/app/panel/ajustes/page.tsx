import { redirect } from "next/navigation";

import { LogoForm } from "@/app/panel/ajustes/logo-form";
import { SettingsForm } from "@/app/panel/ajustes/settings-form";
import { sesionDelPanel } from "@/lib/panel/session";

export const dynamic = "force-dynamic";

export default async function AjustesPage() {
  const sesion = await sesionDelPanel();
  if (!sesion) redirect("/entrar");
  if (!sesion.esDuenio) redirect("/panel");

  const { tenant } = sesion;

  return (
    <>
      <p className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">
        Ajustes
      </p>
      <h1 className="mt-1 font-display text-3xl leading-tight text-ink">
        Tu barbería
      </h1>
      <p className="mt-3 max-w-prose text-sm text-muted">
        Lo que ve el cliente en la página de reservas, y las reglas con las que
        se dan los turnos.
      </p>

      <SettingsForm tenant={tenant} />

      <h2 className="mt-12 text-xs font-semibold tracking-[0.18em] text-muted uppercase">
        El logo
      </h2>

      <LogoForm
        claroActual={tenant.logoLightUrl}
        oscuroActual={tenant.logoDarkUrl}
        nombre={tenant.name}
      />

      <h2 className="mt-12 text-xs font-semibold tracking-[0.18em] text-muted uppercase">
        Lo que no se cambia desde acá
      </h2>

      <div className="card mt-4 px-5 py-5">
        <p className="text-sm font-medium text-ink">La dirección web</p>
        <p className="tabular mt-1 text-sm text-muted">{tenant.slug}</p>
        <p className="mt-1.5 max-w-prose text-sm text-muted">
          Es el link que tus clientes ya tienen guardado y que circula por
          WhatsApp. Cambiarlo los rompería todos de golpe, sin aviso y sin forma
          de arreglarlo. Si hace falta cambiarlo, se coordina.
        </p>
      </div>
    </>
  );
}
