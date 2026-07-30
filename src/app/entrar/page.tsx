import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { LoginForm } from "@/app/entrar/login-form";
import { PoleRule } from "@/components/pole-rule";
import { TenantTheme } from "@/components/tenant-theme";
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
    <>
      <TenantTheme tenant={tenant} />

      <main className="flex min-h-full flex-1 items-center justify-center px-5 py-16">
        <div className="w-full max-w-sm">
          <div className="card px-6 py-8 sm:px-8">
            <PoleRule className="w-16 rounded-full" />

            <h1 className="mt-6 font-display text-3xl leading-tight text-ink">
              {tenant.name}
            </h1>
            <p className="mt-1.5 text-xs font-semibold tracking-[0.18em] text-muted uppercase">
              Panel del equipo
            </p>

            <LoginForm />
          </div>

          <p className="mt-6 text-center text-sm text-muted">
            ¿No tenés acceso? Pedíselo al dueño de la barbería.
          </p>
        </div>
      </main>
    </>
  );
}
