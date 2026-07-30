import Link from "next/link";
import { redirect } from "next/navigation";

import { Ledger } from "@/app/panel/ledger";
import { cargarEquipo, cargarTurnos } from "@/lib/panel/data";
import { sesionDelPanel } from "@/lib/panel/session";
import {
  addDays,
  formatDateLong,
  formatPrice,
  nowInTimeZone,
} from "@/lib/schedule";

export const dynamic = "force-dynamic";

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>;
}) {
  const sesion = await sesionDelPanel();
  if (!sesion) redirect("/entrar");

  const { tenant } = sesion;
  const hoy = nowInTimeZone(tenant.timezone);

  const { d } = await searchParams;
  const fecha = d && FECHA.test(d) ? d : hoy.date;

  const [turnos, equipo] = await Promise.all([
    cargarTurnos(tenant, fecha, fecha),
    cargarEquipo(tenant),
  ]);

  // Los cancelados no se dibujan: liberaron el horario, así que el hueco que
  // dejaron es la información, no ellos.
  const delDia = turnos.filter((t) => t.status !== "cancelled");

  // El nombre del barbero solo aparece cuando hay más de uno en el día. Para un
  // barbero mirando su propia agenda, repetir su nombre en cada línea es ruido.
  const barberosDelDia = new Set(delDia.map((t) => t.barberId));
  const nombrePorBarbero =
    barberosDelDia.size > 1
      ? new Map(equipo.map((b) => [b.id, b.displayName]))
      : null;

  const cortes = delDia.filter(
    (t) => t.kind === "booking" && t.status === "confirmed",
  );
  const recaudado = cortes.reduce((t, c) => t + (c.priceCents ?? 0), 0);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">
            {fecha === hoy.date ? "Hoy" : "Agenda"}
          </p>
          <h1 className="mt-1 font-display text-3xl leading-tight text-ink">
            {formatDateLong(fecha)}
          </h1>
        </div>

        <nav className="flex items-center gap-1.5">
          <PasoDeDia href={`/panel?d=${addDays(fecha, -1)}`} label="Día anterior">
            ‹
          </PasoDeDia>
          <Link
            href="/panel"
            className="rounded-lg border border-ink/15 px-3 py-2 text-xs font-semibold tracking-[0.08em] text-muted uppercase transition-colors duration-150 ease-out hover:border-ink/40 hover:text-ink active:bg-ink/[0.06]"
          >
            Hoy
          </Link>
          <PasoDeDia href={`/panel?d=${addDays(fecha, 1)}`} label="Día siguiente">
            ›
          </PasoDeDia>
        </nav>
      </div>

      {cortes.length > 0 ? (
        <p className="mt-4 text-sm text-muted">
          <span className="font-semibold text-ink">{cortes.length}</span>{" "}
          {cortes.length === 1 ? "corte" : "cortes"} ·{" "}
          <span className="tabular font-semibold text-ink">
            {formatPrice(recaudado, tenant.currency)}
          </span>
        </p>
      ) : null}

      <Ledger
        turnos={delDia}
        tenant={tenant}
        ahora={fecha === hoy.date ? hoy.time : null}
        nombrePorBarbero={nombrePorBarbero}
      />
    </>
  );
}

function PasoDeDia({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="flex size-9 items-center justify-center rounded-lg border border-ink/15 text-lg leading-none text-muted transition-colors duration-150 ease-out hover:border-ink/40 hover:text-ink active:bg-ink/[0.06]"
    >
      <span aria-hidden="true">{children}</span>
    </Link>
  );
}
