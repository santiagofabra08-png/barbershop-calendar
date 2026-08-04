import type { ReactNode } from "react";

import { PoleRule } from "@/components/pole-rule";
import { TenantTheme } from "@/components/tenant-theme";
import type { Tenant } from "@/lib/tenant/types";

/**
 * La tarjeta de las tres pantallas de acceso: entrar, recuperar y elegir clave
 * nueva.
 *
 * Son el mismo momento partido en tres pasos, así que se ven igual. Quien pide
 * un link y vuelve desde el mail tiene que reconocer dónde está sin leer nada.
 */
export function MarcoDeAcceso({
  tenant,
  titulo,
  bajada,
  children,
  pie,
}: {
  tenant: Tenant;
  /** El nombre de la barbería, o de qué se trata este paso. */
  titulo: string;
  bajada: string;
  children: ReactNode;
  pie?: ReactNode;
}) {
  return (
    <>
      <TenantTheme tenant={tenant} />

      <main className="flex min-h-full flex-1 items-center justify-center px-5 py-16">
        <div className="w-full max-w-sm">
          <div className="card px-6 py-8 sm:px-8">
            <PoleRule className="w-16 rounded-full" />

            <h1 className="mt-6 font-display text-3xl leading-tight text-ink">
              {titulo}
            </h1>
            <p className="mt-1.5 text-xs font-semibold tracking-[0.18em] text-muted uppercase">
              {bajada}
            </p>

            {children}
          </div>

          {pie ? (
            <div className="mt-6 text-center text-sm text-muted">{pie}</div>
          ) : null}
        </div>
      </main>
    </>
  );
}
