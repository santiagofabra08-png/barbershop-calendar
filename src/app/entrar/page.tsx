import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { LoginForm } from "@/app/entrar/login-form";
import { MarcoDeAcceso } from "@/app/entrar/marco";
import { sesionDelPanel } from "@/lib/panel/session";
import { cargarTenant } from "@/lib/tenant/load";
import { currentTenantSlug } from "@/lib/tenant/resolve";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const slug = await currentTenantSlug();
  const tenant = slug ? await cargarTenant(slug) : null;
  return { title: tenant ? `Panel · ${tenant.name}` : "Panel" };
}

export default async function EntrarPage() {
  const slug = await currentTenantSlug();
  const tenant = slug ? await cargarTenant(slug) : null;
  if (!tenant) notFound();

  // Si ya está adentro, no tiene sentido pedirle que entre otra vez.
  if (await sesionDelPanel()) redirect("/panel");

  return (
    <MarcoDeAcceso
      tenant={tenant}
      titulo={tenant.name}
      bajada="Panel del equipo"
      pie={<>¿No tenés acceso? Pedíselo al dueño de la barbería.</>}
    >
      <LoginForm />
    </MarcoDeAcceso>
  );
}
