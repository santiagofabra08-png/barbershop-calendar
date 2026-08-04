import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { MarcoDeAcceso } from "@/app/entrar/marco";
import { ClaveForm } from "@/app/entrar/nueva-clave/clave-form";
import { createClient } from "@/lib/supabase/server";
import { cargarTenant } from "@/lib/tenant/load";
import { currentTenantSlug } from "@/lib/tenant/resolve";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Elegir contraseña",
  robots: { index: false, follow: false },
};

export default async function NuevaClavePage() {
  const slug = await currentTenantSlug();
  const tenant = slug ? await cargarTenant(slug) : null;
  if (!tenant) notFound();

  // Sin sesión no hay a quién cambiarle la contraseña. Se llega acá solamente
  // desde el link del mail, que la deja abierta al pasar por `/entrar/confirmar`.
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) redirect("/entrar/recuperar?vencido=1");

  return (
    <MarcoDeAcceso
      tenant={tenant}
      titulo="Elegí tu contraseña"
      bajada={tenant.name}
      pie={<>Después de guardarla entrás directo al panel.</>}
    >
      <p className="mt-6 text-sm text-muted">
        Vas a entrar como <span className="text-ink">{user.email}</span>.
      </p>

      <ClaveForm />
    </MarcoDeAcceso>
  );
}
