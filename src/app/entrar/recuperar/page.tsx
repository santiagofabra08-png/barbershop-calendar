import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MarcoDeAcceso } from "@/app/entrar/marco";
import { RecoverForm } from "@/app/entrar/recuperar/recover-form";
import { cargarTenant } from "@/lib/tenant/load";
import { currentTenantSlug } from "@/lib/tenant/resolve";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Recuperar contraseña",
  robots: { index: false, follow: false },
};

export default async function RecuperarPage({
  searchParams,
}: {
  searchParams: Promise<{ vencido?: string }>;
}) {
  const slug = await currentTenantSlug();
  const tenant = slug ? await cargarTenant(slug) : null;
  if (!tenant) notFound();

  const { vencido } = await searchParams;

  return (
    <MarcoDeAcceso
      tenant={tenant}
      titulo="Recuperar contraseña"
      bajada={tenant.name}
      pie={
        <Link
          href="/entrar"
          className="rounded transition-colors duration-150 ease-out hover:text-ink"
        >
          Volver a entrar
        </Link>
      }
    >
      <RecoverForm vencido={vencido === "1"} />
    </MarcoDeAcceso>
  );
}
