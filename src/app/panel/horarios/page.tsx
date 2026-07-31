import Link from "next/link";
import { redirect } from "next/navigation";

import { borrarTramo } from "@/app/panel/horarios/actions";
import { AddForm, DIAS_ORDENADOS } from "@/app/panel/horarios/add-form";
import { cargarEquipo, cargarHorarios } from "@/lib/panel/data";
import { sesionDelPanel } from "@/lib/panel/session";

export const dynamic = "force-dynamic";

export default async function HorariosPage({
  searchParams,
}: {
  searchParams: Promise<{ b?: string }>;
}) {
  const sesion = await sesionDelPanel();
  if (!sesion) redirect("/entrar");

  const { tenant, barbero, esDuenio } = sesion;
  const equipo = await cargarEquipo(tenant);
  const activos = equipo.filter((b) => b.isActive);

  // El dueño puede mirar y editar el horario de cualquiera. Un barbero, solo
  // el suyo, aunque escriba el id de otro en la dirección.
  const { b } = await searchParams;
  const elegido =
    (esDuenio && b && activos.find((x) => x.id === b)?.id) || barbero.id;

  const tramos = await cargarHorarios(tenant, elegido);
  const persona = activos.find((x) => x.id === elegido);

  return (
    <>
      <p className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">
        {elegido === barbero.id ? "Mis horarios" : "Horarios"}
      </p>
      <h1 className="mt-1 font-display text-3xl leading-tight text-ink">
        {elegido === barbero.id
          ? "Cuándo cortás"
          : `Cuándo corta ${persona?.displayName ?? ""}`}
      </h1>
      <p className="mt-3 max-w-prose text-sm text-muted">
        Es el horario de todas las semanas. Un día libre suelto o un turno
        médico no van acá: eso se bloquea desde la agenda del día.
      </p>

      {esDuenio && activos.length > 1 ? (
        <nav className="mt-6 flex flex-wrap gap-2">
          {activos.map((p) => (
            <Link
              key={p.id}
              href={`/panel/horarios?b=${p.id}`}
              aria-current={p.id === elegido ? "page" : undefined}
              className={[
                "rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors duration-150 ease-out",
                p.id === elegido
                  ? "border-transparent bg-accent text-surface"
                  : "border-ink/15 text-muted hover:border-ink/40 hover:text-ink active:bg-ink/[0.06]",
              ].join(" ")}
            >
              {p.displayName}
            </Link>
          ))}
        </nav>
      ) : null}

      <ul className="mt-8 divide-y divide-ink/10 border-y border-ink/10">
        {DIAS_ORDENADOS.map((dia) => {
          const delDia = tramos.filter((t) => t.weekday === dia.weekday);

          return (
            <li
              key={dia.weekday}
              className="grid grid-cols-[5.5rem_1fr] items-start gap-3 py-3.5"
            >
              <p
                className={[
                  "text-sm",
                  delDia.length > 0 ? "font-medium text-ink" : "text-muted",
                ].join(" ")}
              >
                {dia.largo}
              </p>

              {delDia.length === 0 ? (
                <p className="text-sm text-muted">Cerrado</p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {delDia.map((t) => (
                    <li key={t.id}>
                      <form action={borrarTramo} className="contents">
                        <input type="hidden" name="id" value={t.id} />
                        <span className="inline-flex items-center gap-1 rounded-lg bg-ink/[0.05] py-1 pr-1 pl-3 text-sm">
                          <span className="tabular text-ink">
                            {t.startsAt} a {t.endsAt}
                          </span>
                          <button
                            type="submit"
                            aria-label={`Quitar ${dia.largo} de ${t.startsAt} a ${t.endsAt}`}
                            className="flex size-6 items-center justify-center rounded-md text-muted transition-colors duration-150 ease-out hover:bg-ink/10 hover:text-ink active:bg-ink/15"
                          >
                            <span aria-hidden="true">×</span>
                          </button>
                        </span>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      <h2 className="mt-10 text-xs font-semibold tracking-[0.18em] text-muted uppercase">
        Agregar un horario
      </h2>
      <AddForm barberId={elegido} />
    </>
  );
}
