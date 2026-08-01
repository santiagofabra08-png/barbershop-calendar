import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  cambiarEstadoServicio,
  guardarServicio,
} from "@/app/panel/servicios/actions";
import { ServiceForm } from "@/app/panel/servicios/service-form";
import { cargarServiciosDelPanel } from "@/lib/panel/data";
import { sesionDelPanel } from "@/lib/panel/session";

export const dynamic = "force-dynamic";

export default async function FichaServicioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const sesion = await sesionDelPanel();
  if (!sesion) redirect("/entrar");
  if (!sesion.esDuenio) redirect("/panel");

  const { id } = await params;
  const servicios = await cargarServiciosDelPanel(sesion.tenant);
  const servicio = servicios.find((s) => s.id === id);
  if (!servicio) notFound();

  // Solo los reservables cuentan: sacar el último descuento no deja la página
  // sin nada que reservar.
  const reservables = servicios.filter(
    (s) => s.isActive && s.kind === "service",
  );
  const esElUltimo =
    servicio.isActive && servicio.kind === "service" && reservables.length === 1;

  return (
    <>
      <Link
        href="/panel/servicios"
        className="text-sm text-muted transition-colors duration-150 ease-out hover:text-ink"
      >
        ‹ Servicios
      </Link>

      <h1 className="mt-3 font-display text-3xl leading-tight text-ink">
        {servicio.name}
      </h1>
      {!servicio.isActive ? (
        <p className="mt-2 text-sm text-muted">
          Está fuera de la página: nadie puede reservarlo.
        </p>
      ) : null}

      <ServiceForm
        accion={guardarServicio}
        textoBoton="Guardar cambios"
        moneda={sesion.tenant.currency}
        inicial={{
          id: servicio.id,
          name: servicio.name,
          description: servicio.description,
          durationMinutes: servicio.durationMinutes,
          priceCents: servicio.priceCents,
          kind: servicio.kind,
        }}
      />

      <h2 className="mt-10 text-xs font-semibold tracking-[0.18em] text-muted uppercase">
        {servicio.isActive ? "Sacar de la página" : "Volver a la página"}
      </h2>

      <div className="card mt-4 flex flex-wrap items-center justify-between gap-4 px-5 py-5">
        <p className="max-w-prose text-sm text-muted">
          {esElUltimo
            ? "Es el único servicio que queda. Si lo sacás, nadie va a poder reservar. Agregá otro primero."
            : servicio.isActive
              ? "Deja de ofrecerse. Los turnos que ya estaban dados quedan como están, y el historial de lo que se cobró también."
              : "Vuelve a ofrecerse en la página, con el precio y la duración de acá arriba."}
        </p>

        <form action={cambiarEstadoServicio}>
          <input type="hidden" name="id" value={servicio.id} />
          <input
            type="hidden"
            name="activar"
            value={servicio.isActive ? "0" : "1"}
          />
          <button
            type="submit"
            disabled={esElUltimo}
            className="rounded-lg border border-ink/20 px-5 py-3 text-xs font-semibold tracking-[0.08em] text-ink uppercase transition-colors duration-150 ease-out hover:border-ink hover:bg-ink hover:text-surface active:opacity-90 disabled:border-ink/10 disabled:text-ink/25 disabled:hover:bg-transparent disabled:hover:text-ink/25"
          >
            {servicio.isActive ? "Sacar" : "Volver a ofrecer"}
          </button>
        </form>
      </div>
    </>
  );
}
