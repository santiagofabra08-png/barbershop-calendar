import Link from "next/link";
import { redirect } from "next/navigation";

import { anularCobro } from "@/app/panel/cobros/actions";
import { Ticket, type Agregable } from "@/app/panel/cobros/ticket";
import { NOMBRE_MEDIO, type TurnoParaCobrar } from "@/lib/panel/cobro";
import { cargarPendientes, cargarTurnosParaCobrar } from "@/lib/panel/cobros";
import { cargarServiciosDelPanel } from "@/lib/panel/data";
import { sesionDelPanel } from "@/lib/panel/session";
import {
  addDays,
  formatDateLong,
  formatPrice,
  nowInTimeZone,
} from "@/lib/schedule";

export const dynamic = "force-dynamic";

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export default async function CobrosPage({
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

  const [turnos, servicios, pendientes] = await Promise.all([
    cargarTurnosParaCobrar(tenant.slug, fecha),
    cargarServiciosDelPanel(tenant),
    cargarPendientes(tenant.slug),
  ]);

  // Lo que se puede sumar a un ticket: los servicios activos y los descuentos.
  const agregables: Agregable[] = servicios
    .filter((s) => s.isActive)
    .map((s) => ({
      id: s.id,
      name: s.name,
      priceCents: s.priceCents,
      esDescuento: s.kind === "discount",
    }));

  const sinCobrar = turnos.filter(
    (t) => t.chargedAt === null && t.status === "confirmed",
  );
  const cobrados = turnos.filter((t) => t.chargedAt !== null);
  const faltaron = turnos.filter((t) => t.status === "no_show");

  const totalDelDia = cobrados.reduce(
    (t, c) => t + (c.chargedTotalCents ?? 0),
    0,
  );
  const plata = (c: number) => formatPrice(c, tenant.currency);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">
            {fecha === hoy.date ? "Cobros de hoy" : "Cobros"}
          </p>
          <h1 className="mt-1 font-display text-3xl leading-tight text-ink">
            {formatDateLong(fecha)}
          </h1>
        </div>

        <nav className="flex items-center gap-1.5">
          <Paso href={`/panel/cobros?d=${addDays(fecha, -1)}`} label="Día anterior">
            ‹
          </Paso>
          <Link
            href="/panel/cobros"
            className="rounded-lg border border-ink/15 px-3 py-2 text-xs font-semibold tracking-[0.08em] text-muted uppercase transition-colors duration-150 ease-out hover:border-ink/40 hover:text-ink active:bg-ink/[0.06]"
          >
            Hoy
          </Link>
          <Paso href={`/panel/cobros?d=${addDays(fecha, 1)}`} label="Día siguiente">
            ›
          </Paso>
        </nav>
      </div>

      {/* Lo que quedó atrás. Se ve arriba de todo porque es lo único que nadie
          va a buscar por su cuenta. */}
      {pendientes.cantidad > 0 && pendientes.desde ? (
        <Link
          href={`/panel/cobros?d=${pendientes.desde}`}
          className="mt-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg border-l-2 border-accent bg-accent/[0.06] px-4 py-3 transition-colors duration-150 ease-out hover:bg-accent/[0.1]"
        >
          <span className="text-sm text-ink">
            <span className="font-semibold">{pendientes.cantidad}</span>{" "}
            {pendientes.cantidad === 1 ? "turno" : "turnos"} de días anteriores
            sin cobrar
          </span>
          <span className="text-xs font-semibold tracking-[0.08em] text-accent uppercase">
            Ir al {formatDateLong(pendientes.desde).toLowerCase()} ›
          </span>
        </Link>
      ) : null}

      <p className="mt-5 text-sm text-muted">
        <span className="tabular font-semibold text-ink">
          {plata(totalDelDia)}
        </span>{" "}
        cobrado ·{" "}
        <span className="font-semibold text-ink">{sinCobrar.length}</span>{" "}
        sin cobrar
      </p>

      {/* ---- Sin cobrar --------------------------------------------------- */}
      {sinCobrar.length > 0 ? (
        <ul className="mt-6 space-y-3">
          {sinCobrar.map((t) => (
            <li key={t.id} className="card px-5 py-4">
              <Cabecera turno={t} moneda={tenant.currency} />
              <Ticket
                turno={t}
                agregables={agregables}
                moneda={tenant.currency}
              />
            </li>
          ))}
        </ul>
      ) : turnos.length === 0 ? (
        <p className="card mt-6 px-5 py-8 text-center text-sm text-muted">
          No hubo turnos este día.
        </p>
      ) : (
        <p className="card mt-6 px-5 py-8 text-center text-sm text-muted">
          Está todo cobrado.
        </p>
      )}

      {/* ---- Ya cobrados -------------------------------------------------- */}
      {cobrados.length > 0 ? (
        <>
          <h2 className="mt-10 text-xs font-semibold tracking-[0.18em] text-muted uppercase">
            Cobrados
          </h2>

          <ul className="mt-4 space-y-3">
            {cobrados.map((t) => (
              <li key={t.id} className="card px-5 py-4">
                <Cabecera turno={t} moneda={tenant.currency} />

                <ul className="mt-3 space-y-1 border-t border-ink/10 pt-3">
                  {t.items.map((i, n) => (
                    <li
                      key={`${t.id}-${n}`}
                      className="flex items-baseline justify-between gap-4 text-sm"
                    >
                      <span className="text-muted">{i.name}</span>
                      <span className="tabular shrink-0 text-muted">
                        {i.amountCents < 0 ? "−" : ""}
                        {plata(Math.abs(i.amountCents))}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 border-t border-ink/10 pt-3">
                  <p className="text-sm text-muted">
                    {t.paymentMethod ? NOMBRE_MEDIO[t.paymentMethod] : ""}
                  </p>
                  <div className="flex items-center gap-3">
                    <p className="tabular font-semibold text-ink">
                      {plata(t.chargedTotalCents ?? 0)}
                    </p>
                    <form action={anularCobro}>
                      <input type="hidden" name="id" value={t.id} />
                      <button
                        type="submit"
                        className="rounded-lg border border-ink/15 px-3 py-1.5 text-xs font-semibold tracking-[0.06em] text-muted uppercase transition-colors duration-150 ease-out hover:border-ink/40 hover:text-ink active:bg-ink/[0.06]"
                      >
                        Anular
                      </button>
                    </form>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {/* ---- No vinieron -------------------------------------------------- */}
      {faltaron.length > 0 ? (
        <>
          <h2 className="mt-10 text-xs font-semibold tracking-[0.18em] text-muted uppercase">
            No vinieron
          </h2>
          <p className="mt-2 text-sm text-muted">
            No se cobran. Están acá para que se vea que el hueco no fue un
            olvido.
          </p>
          <ul className="mt-4 divide-y divide-ink/10 border-y border-ink/10">
            {faltaron.map((t) => (
              <li key={t.id} className="py-3">
                <Cabecera turno={t} moneda={tenant.currency} />
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </>
  );
}

function Cabecera({
  turno,
  moneda,
}: {
  turno: TurnoParaCobrar;
  moneda: string;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <p className="font-medium text-ink">
        <span className="tabular text-muted">{turno.hora}</span>{" "}
        {turno.clientName ?? "Sin nombre"}
      </p>
      <p className="text-sm text-muted">
        {turno.serviceName ?? "—"} · {turno.barberName}
        {turno.chargedAt === null && turno.status === "confirmed"
          ? ` · ${formatPrice(turno.priceCents, moneda)}`
          : ""}
      </p>
    </div>
  );
}

function Paso({
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
