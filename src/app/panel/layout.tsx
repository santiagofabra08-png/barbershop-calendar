import type { Metadata } from "next";
import Link from "next/link";
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

  // Lo que se usa todos los días. Cobros va segundo porque es lo que más veces
  // se toca en una jornada: una vez por cliente.
  const trabajo: Seccion[] = [
    { href: "/panel", label: "Agenda" },
    { href: "/panel/cobros", label: "Cobros" },
    { href: "/panel/semana", label: "Semana" },
    { href: "/panel/horarios", label: "Horarios" },
  ];

  // Lo que se configura una vez y casi no se toca. Solo el dueño: para un
  // barbero estas secciones no están escondidas, no existen. Van plegadas
  // detrás de una sola entrada —en el celular no entran siete nombres en una
  // barra, y en la computadora tampoco entran al lado del resto del encabezado.
  const secciones: Seccion[] = esDuenio
    ? [
        ...trabajo,
        {
          href: "/panel/local",
          label: "Local",
          matches: [
            "/panel/servicios",
            "/panel/productos",
            "/panel/pedidos",
            "/panel/equipo",
            "/panel/ajustes",
          ],
        },
      ]
    : trabajo;

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
              <PanelNav
                secciones={secciones}
                variante="linea"
              />

              {/* El nombre propio es la puerta a la cuenta propia. Va acá y no
                  en la navegación: la navegación es del trabajo, esto es de
                  quien lo hace. */}
              <Link
                href="/panel/cuenta"
                className="rounded-lg px-2 py-1 text-right transition-colors duration-150 ease-out hover:bg-ink/[0.05]"
              >
                <span className="block truncate text-sm font-medium text-ink">
                  {barbero.displayName}
                </span>
                <span className="block text-xs text-muted">
                  {esDuenio ? "Dueño" : "Barbero"}
                </span>
              </Link>

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
