import Link from "next/link";
import { redirect } from "next/navigation";

import { moverServicio } from "@/app/panel/servicios/actions";
import { cargarServiciosDelPanel } from "@/lib/panel/data";
import { sesionDelPanel } from "@/lib/panel/session";
import { formatDuration, formatPrice } from "@/lib/schedule";

export const dynamic = "force-dynamic";

export default async function ServiciosPage() {
  const sesion = await sesionDelPanel();
  if (!sesion) redirect("/entrar");
  if (!sesion.esDuenio) redirect("/panel");

  const { tenant } = sesion;
  const servicios = await cargarServiciosDelPanel(tenant);

  const enLaPagina = servicios.filter((s) => s.isActive);
  const guardados = servicios.filter((s) => !s.isActive);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">
            Servicios
          </p>
          <h1 className="mt-1 font-display text-3xl leading-tight text-ink">
            Qué se puede reservar
          </h1>
        </div>

        <Link
          href="/panel/servicios/nuevo"
          className="rounded-lg bg-accent px-5 py-3 text-xs font-semibold tracking-[0.08em] text-surface uppercase transition-colors duration-150 ease-out hover:bg-ink active:bg-ink/90"
        >
          Agregar servicio
        </Link>
      </div>

      <p className="mt-4 max-w-prose text-sm text-muted">
        El cliente elige uno al reservar, en el orden en que están acá. Cambiar
        un precio no toca los turnos que ya estaban dados: cada uno guarda lo
        que se pactó.
      </p>

      {enLaPagina.length === 0 ? (
        <p className="card mt-8 px-5 py-8 text-center text-sm text-muted">
          No hay ningún servicio en la página. Sin al menos uno, nadie puede
          reservar.
        </p>
      ) : (
        <ul className="mt-8 space-y-3">
          {enLaPagina.map((s, i) => (
            <li key={s.id} className="flex items-stretch gap-2">
              <Ficha servicio={s} moneda={tenant.currency} />

              <div className="flex shrink-0 flex-col justify-center gap-1">
                <Mover id={s.id} arriba deshabilitado={i === 0} />
                <Mover
                  id={s.id}
                  arriba={false}
                  deshabilitado={i === enLaPagina.length - 1}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {guardados.length > 0 ? (
        <>
          <h2 className="mt-10 text-xs font-semibold tracking-[0.18em] text-muted uppercase">
            Fuera de la página
          </h2>
          <p className="mt-2 text-sm text-muted">
            No se pueden reservar. Los turnos viejos que los usaron siguen
            estando.
          </p>
          <ul className="mt-4 space-y-3 opacity-60">
            {guardados.map((s) => (
              <li key={s.id}>
                <Ficha servicio={s} moneda={tenant.currency} />
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </>
  );
}

function Ficha({
  servicio,
  moneda,
}: {
  servicio: Awaited<ReturnType<typeof cargarServiciosDelPanel>>[number];
  moneda: string;
}) {
  return (
    <Link
      href={`/panel/servicios/${servicio.id}`}
      className="card block flex-1 px-5 py-4 transition-shadow duration-150 ease-out hover:shadow-lg"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="font-medium text-ink">{servicio.name}</p>
        <p className="tabular text-sm text-muted">
          <span className="font-semibold text-ink">
            {formatPrice(servicio.priceCents, moneda)}
          </span>
          {" · "}
          {formatDuration(servicio.durationMinutes)}
        </p>
      </div>
      {servicio.description ? (
        <p className="mt-1 text-sm text-muted">{servicio.description}</p>
      ) : null}
    </Link>
  );
}

function Mover({
  id,
  arriba,
  deshabilitado,
}: {
  id: string;
  arriba: boolean;
  deshabilitado: boolean;
}) {
  return (
    <form action={moverServicio}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="arriba" value={arriba ? "1" : "0"} />
      <button
        type="submit"
        disabled={deshabilitado}
        aria-label={arriba ? "Subir en la lista" : "Bajar en la lista"}
        className="flex size-8 items-center justify-center rounded-lg border border-ink/15 text-sm leading-none text-muted transition-colors duration-150 ease-out hover:border-ink/40 hover:text-ink active:bg-ink/[0.06] disabled:border-ink/5 disabled:text-ink/15"
      >
        <span aria-hidden="true">{arriba ? "↑" : "↓"}</span>
      </button>
    </form>
  );
}
