import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { salir } from "@/app/entrar/actions";
import { PanelNav, type Seccion } from "@/app/panel/nav";
import { PoleRule } from "@/components/pole-rule";
import { TenantTheme } from "@/components/tenant-theme";
import { sesionDelPanel } from "@/lib/panel/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Panel",
  // El panel no es para buscadores. Nada de acá tiene que aparecer en Google.
  robots: { index: false, follow: false },
};

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sesion = await sesionDelPanel();

  // Este es el guardia de verdad, no el middleware. Y por abajo está RLS: aun
  // si esta línea desapareciera, la base no le daría datos a nadie que no
  // trabaje acá.
  if (!sesion) redirect("/entrar");

  const { tenant, barbero, esDuenio } = sesion;

  const secciones: Seccion[] = [
    { href: "/panel", label: "Agenda" },
    { href: "/panel/semana", label: "Semana" },
  ];

  return (
    <>
      <TenantTheme tenant={tenant} />

      <div className="flex min-h-full flex-1 flex-col">
        <header className="sticky top-0 z-10 border-b border-ink/10 bg-bg/95 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center gap-4 px-5 py-3">
            <div className="min-w-0">
              <PoleRule className="w-8 rounded-full" />
              <p className="mt-1.5 truncate text-xs font-semibold tracking-[0.16em] text-ink uppercase">
                {tenant.name}
              </p>
            </div>

            <div className="ml-auto flex items-center gap-3">
              <PanelNav secciones={secciones} variante="linea" />

              <div className="text-right">
                <p className="truncate text-sm font-medium text-ink">
                  {barbero.displayName}
                </p>
                <p className="text-xs text-muted">
                  {esDuenio ? "Dueño" : "Barbero"}
                </p>
              </div>

              <form action={salir}>
                <button
                  type="submit"
                  className="rounded-lg border border-ink/15 px-3 py-1.5 text-xs font-semibold tracking-[0.08em] text-muted uppercase transition-colors duration-150 ease-out hover:border-ink/40 hover:text-ink active:bg-ink/[0.06]"
                >
                  Salir
                </button>
              </form>
            </div>
          </div>
        </header>

        {/* El espacio de abajo deja pasar la barra fija del celular. */}
        <main className="mx-auto w-full max-w-3xl flex-1 px-5 pt-6 pb-28 sm:pb-12">
          {children}
        </main>

        <PanelNav secciones={secciones} variante="barra" />
      </div>
    </>
  );
}
