import Link from "next/link";
import { redirect } from "next/navigation";

import { cargarEquipo } from "@/lib/panel/data";
import { NOMBRE_MODELO, detalleDelPago } from "@/lib/panel/pay-copy";
import { sesionDelPanel } from "@/lib/panel/session";

export const dynamic = "force-dynamic";

export default async function EquipoPage() {
  const sesion = await sesionDelPanel();
  if (!sesion) redirect("/entrar");
  // Un barbero no tiene por qué saber que esta pantalla existe.
  if (!sesion.esDuenio) redirect("/panel");

  const { tenant } = sesion;
  const equipo = await cargarEquipo(tenant);

  const activos = equipo.filter((b) => b.isActive);
  const dadosDeBaja = equipo.filter((b) => !b.isActive);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">
            Equipo
          </p>
          <h1 className="mt-1 font-display text-3xl leading-tight text-ink">
            Quién trabaja acá
          </h1>
        </div>

        <Link
          href="/panel/equipo/nuevo"
          className="rounded-lg bg-accent px-5 py-3 text-xs font-semibold tracking-[0.08em] text-surface uppercase transition-colors duration-150 ease-out hover:bg-ink active:bg-ink/90"
        >
          Agregar barbero
        </Link>
      </div>

      <ul className="mt-8 space-y-3">
        {activos.map((b) => (
          <li key={b.id}>
            <Ficha barbero={b} currency={tenant.currency} />
          </li>
        ))}
      </ul>

      {dadosDeBaja.length > 0 ? (
        <>
          <h2 className="mt-10 text-xs font-semibold tracking-[0.18em] text-muted uppercase">
            Dados de baja
          </h2>
          <p className="mt-2 text-sm text-muted">
            No aparecen en la página ni pueden entrar al panel. Lo que
            trabajaron sigue contando en el historial.
          </p>
          <ul className="mt-4 space-y-3 opacity-60">
            {dadosDeBaja.map((b) => (
              <li key={b.id}>
                <Ficha barbero={b} currency={tenant.currency} />
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </>
  );
}

function Ficha({
  barbero,
  currency,
}: {
  barbero: Awaited<ReturnType<typeof cargarEquipo>>[number];
  currency: string;
}) {
  const detalle = detalleDelPago(barbero.pay, currency);

  return (
    <Link
      href={`/panel/equipo/${barbero.id}`}
      className="card block px-5 py-4 transition-shadow duration-150 ease-out hover:shadow-lg"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="font-medium text-ink">
          {barbero.displayName}
          {barbero.role === "owner" ? (
            <span className="ml-2 rounded-full bg-ink/[0.06] px-2.5 py-1 text-[0.65rem] font-semibold tracking-[0.1em] text-muted uppercase">
              Dueño
            </span>
          ) : null}
        </p>

        <p className="text-sm text-muted">
          {barbero.email ?? "Sin mail"}
          {" · "}
          <span className={barbero.email ? "" : "text-muted"}>
            {barbero.pay.model === "revenue_only" && barbero.role === "owner"
              ? "Se queda con la caja"
              : NOMBRE_MODELO[barbero.pay.model]}
            {detalle ? ` · ${detalle}` : ""}
          </span>
        </p>
      </div>

      <p className="mt-2 text-xs text-muted">
        {barbero.acceptsBookings
          ? "Recibe turnos por la página"
          : "No recibe turnos por la página"}
      </p>
    </Link>
  );
}
