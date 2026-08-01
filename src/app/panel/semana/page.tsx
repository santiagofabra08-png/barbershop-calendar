import Link from "next/link";
import { redirect } from "next/navigation";

import { borrarPago } from "@/app/panel/semana/actions";
import { PayForm } from "@/app/panel/semana/pay-form";
import { cargarEquipo, cargarPagos, cargarTurnos } from "@/lib/panel/data";
import {
  NOMBRE_MODELO,
  detalleDelPago,
  tituloDeLoQueLeToca,
} from "@/lib/panel/pay-copy";
import { sesionDelPanel } from "@/lib/panel/session";
import {
  monthRange,
  summarizePayroll,
  weekRange,
  type Cut,
  type PayPeriod,
} from "@/lib/payroll";
import { formatDateRange, formatPrice, nowInTimeZone } from "@/lib/schedule";

export const dynamic = "force-dynamic";

export default async function SemanaPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string; o?: string }>;
}) {
  const sesion = await sesionDelPanel();
  if (!sesion) redirect("/entrar");

  const { tenant, barbero, esDuenio } = sesion;
  const hoy = nowInTimeZone(tenant.timezone);

  const { p, o } = await searchParams;
  const periodo: PayPeriod = p === "mes" ? "month" : "week";
  // Cuántos períodos hacia atrás. Se acota para que nadie llegue por la URL a
  // consultar el año 1400 y se traiga una consulta enorme.
  const corrimiento = Math.min(0, Math.max(-52, Number(o) || 0));

  const rango =
    periodo === "month"
      ? monthRange(hoy.date, corrimiento)
      : weekRange(hoy.date, corrimiento);

  const [turnos, equipo, pagos] = await Promise.all([
    cargarTurnos(tenant, rango.from, rango.to),
    cargarEquipo(tenant),
    cargarPagos(tenant, rango.from, rango.to),
  ]);

  // El barbero empleado se ve solo a sí mismo. No es solo la pantalla: RLS ya
  // le negó los turnos de los demás, así que sin este filtro vería a sus
  // compañeros en cero, que es peor que no verlos.
  const visibles = esDuenio ? equipo.filter((b) => b.isActive) : [barbero];

  // Solo entra lo cobrado. Un turno atendido y sin cobrar no es plata: es un
  // pendiente, y se avisa aparte para que no se pierda callado.
  const cortes: Cut[] = turnos
    .filter(
      (t) =>
        t.kind === "booking" &&
        (t.chargedAt !== null || t.status === "no_show"),
    )
    .map((t) => ({
      barberId: t.barberId,
      status: t.status === "no_show" ? "no_show" : "confirmed",
      // Lo cobrado de verdad, que puede incluir lo que se agregó sobre la
      // marcha. En el que no vino no hay cobro: lo perdido es lo que valía.
      priceCents: t.chargedTotalCents ?? t.priceCents ?? 0,
      commissionPercent: t.commissionPercent,
    }));

  const sinCobrar = turnos.filter(
    (t) =>
      t.kind === "booking" && t.status === "confirmed" && t.chargedAt === null,
  );

  const resumen = summarizePayroll(
    visibles.map((b) => ({ id: b.id, pay: b.pay })),
    cortes,
    periodo,
  );

  // Lo efectivamente pagado, por persona. Es la suma de las filas: un período
  // puede tener varios pagos, que es como se anota un adelanto.
  const pagadoPor = new Map<string, number>();
  for (const pago of pagos) {
    pagadoPor.set(
      pago.barberId,
      (pagadoPor.get(pago.barberId) ?? 0) + pago.amountCents,
    );
  }
  const pagadoTotal = pagos
    .filter((x) => x.direction === "out")
    .reduce((t, x) => t + x.amountCents, 0);
  const cobradoTotal = pagos
    .filter((x) => x.direction === "in")
    .reduce((t, x) => t + x.amountCents, 0);

  const faltaPagar = resumen.dueOutCents - pagadoTotal;
  const faltaCobrar = resumen.dueInCents - cobradoTotal;

  const plata = (cents: number) => formatPrice(cents, tenant.currency);
  const otroPeriodo = periodo === "week" ? "mes" : "semana";
  const link = (cambios: { p?: string; o?: number }) => {
    const qp = new URLSearchParams();
    const modo = cambios.p ?? (periodo === "month" ? "mes" : "semana");
    if (modo === "mes") qp.set("p", "mes");
    const off = cambios.o ?? corrimiento;
    if (off !== 0) qp.set("o", String(off));
    const q = qp.toString();
    return q ? `/panel/semana?${q}` : "/panel/semana";
  };

  const nombreDe = (id: string) =>
    equipo.find((b) => b.id === id)?.displayName ?? "—";

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">
            {corrimiento === 0
              ? periodo === "week"
                ? "Esta semana"
                : "Este mes"
              : "Recuento"}
          </p>
          <h1 className="mt-1 font-display text-3xl leading-tight text-ink">
            {formatDateRange(rango.from, rango.to)}
          </h1>
        </div>

        <div className="flex items-center gap-1.5">
          <Link
            href={link({ o: corrimiento - 1 })}
            aria-label={`${periodo === "week" ? "Semana" : "Mes"} anterior`}
            className="flex size-9 items-center justify-center rounded-lg border border-ink/15 text-lg leading-none text-muted transition-colors duration-150 ease-out hover:border-ink/40 hover:text-ink active:bg-ink/[0.06]"
          >
            <span aria-hidden="true">‹</span>
          </Link>
          <Link
            href={link({ o: corrimiento + 1 })}
            aria-disabled={corrimiento === 0}
            aria-label={`${periodo === "week" ? "Semana" : "Mes"} siguiente`}
            className={[
              "flex size-9 items-center justify-center rounded-lg border text-lg leading-none transition-colors duration-150 ease-out",
              corrimiento === 0
                ? "pointer-events-none border-ink/10 text-ink/20"
                : "border-ink/15 text-muted hover:border-ink/40 hover:text-ink active:bg-ink/[0.06]",
            ].join(" ")}
          >
            <span aria-hidden="true">›</span>
          </Link>
          <Link
            href={link({ p: otroPeriodo, o: 0 })}
            className="rounded-lg border border-ink/15 px-3 py-2 text-xs font-semibold tracking-[0.08em] text-muted uppercase transition-colors duration-150 ease-out hover:border-ink/40 hover:text-ink active:bg-ink/[0.06]"
          >
            Ver el {otroPeriodo}
          </Link>
        </div>
      </div>

      {/* ---- El número grande ------------------------------------------- */}
      <section className="card mt-6 px-5 py-6 sm:px-7">
        <p className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">
          {esDuenio ? "Cobrado" : "Cobraste"}
        </p>
        <p className="tabular mt-1 font-display text-4xl leading-none text-ink sm:text-5xl">
          {plata(resumen.producedCents)}
        </p>

        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-ink/10 pt-5 sm:grid-cols-4">
          <Dato titulo="Cortes" valor={String(resumen.cuts)} />
          <Dato
            titulo="No vinieron"
            valor={String(resumen.noShows)}
            pie={resumen.lostCents > 0 ? plata(resumen.lostCents) : undefined}
          />
          {esDuenio ? (
            <>
              <Dato titulo="A pagar al equipo" valor={plata(resumen.dueOutCents)} />
              <Dato
                titulo="Pagado"
                valor={plata(pagadoTotal)}
                pie={faltaPagar > 0 ? `Falta ${plata(faltaPagar)}` : undefined}
              />
            </>
          ) : (
            <>
              <Dato
                titulo={tituloDeLoQueLeToca(barbero.pay)}
                valor={
                  resumen.barbers[0]?.settlement === null ||
                  resumen.barbers[0]?.settlement === undefined
                    ? "—"
                    : plata(resumen.barbers[0].settlement.cents)
                }
              />
              <Dato
                titulo={
                  resumen.barbers[0]?.settlement?.direction === "in"
                    ? "Pagaste"
                    : "Te pagaron"
                }
                valor={plata(pagadoPor.get(barbero.id) ?? 0)}
              />
            </>
          )}
        </dl>

        {esDuenio ? (
          <div className="mt-5 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 rounded-lg bg-ink/[0.04] px-4 py-3.5">
            <p className="text-sm text-muted">
              Queda al local
              {resumen.dueInCents > 0 ? ", contando los alquileres de silla" : ""}
            </p>
            <p className="tabular text-lg font-semibold text-ink">
              {plata(resumen.shopCents)}
            </p>
          </div>
        ) : null}

        {/* Un turno atendido y sin cobrar es plata que existe y no está en
            ningún número de esta pantalla. Se dice, con el camino para
            arreglarlo. */}
        {sinCobrar.length > 0 ? (
          <Link
            href={`/panel/cobros?d=${sinCobrar[0].dateLocal}`}
            className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg border-l-2 border-accent bg-accent/[0.06] px-4 py-3 transition-colors duration-150 ease-out hover:bg-accent/[0.1]"
          >
            <span className="text-sm text-ink">
              <span className="font-semibold">{sinCobrar.length}</span>{" "}
              {sinCobrar.length === 1 ? "turno atendido" : "turnos atendidos"}{" "}
              sin cobrar. Esa plata no está contada acá.
            </span>
            <span className="text-xs font-semibold tracking-[0.08em] text-accent uppercase">
              Ir a cobrar ›
            </span>
          </Link>
        ) : null}

        {!resumen.complete ? (
          <p className="mt-4 rounded-lg border-l-2 border-accent bg-accent/[0.06] px-4 py-3 text-sm text-ink">
            Hay alguien con un fijo {periodo === "week" ? "mensual" : "semanal"}
            , que no entra en {periodo === "week" ? "una semana" : "un mes"} sin
            partirlo al medio. Mirá el {otroPeriodo} para verlo completo.
          </p>
        ) : null}

        {esDuenio ? (
          <p className="mt-4 text-sm text-muted">
            Este balance es de cortes y pagos a barberos. El alquiler del local,
            la luz y los productos no entran acá.
          </p>
        ) : null}
      </section>

      {/* ---- El detalle por barbero -------------------------------------- */}
      {esDuenio ? (
        <>
          <h2 className="mt-10 text-xs font-semibold tracking-[0.18em] text-muted uppercase">
            Por barbero
          </h2>

          <ul className="mt-4 space-y-3">
            {resumen.barbers.map((b) => {
              const persona = visibles.find((v) => v.id === b.barberId);
              if (!persona) return null;

              const detalle = detalleDelPago(persona.pay, tenant.currency);
              const pagado = pagadoPor.get(b.barberId) ?? 0;
              const saldo = (b.settlement?.cents ?? 0) - pagado;

              return (
                <li key={b.barberId} className="card px-5 py-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <p className="font-medium text-ink">{persona.displayName}</p>
                    <p className="tabular text-sm text-muted">
                      <span className="font-semibold text-ink">{b.cuts}</span>{" "}
                      {b.cuts === 1 ? "corte" : "cortes"} ·{" "}
                      <span className="font-semibold text-ink">
                        {plata(b.producedCents)}
                      </span>
                    </p>
                  </div>

                  <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-ink/10 pt-3">
                    <p className="text-sm text-muted">
                      <span className="text-ink">
                        {NOMBRE_MODELO[persona.pay.model]}
                      </span>
                      {detalle ? ` · ${detalle}` : ""}
                    </p>
                    <p className="tabular text-sm">
                      <span className="text-muted">
                        {tituloDeLoQueLeToca(persona.pay)}:{" "}
                      </span>
                      <span className="font-semibold text-ink">
                        {b.barberCents === null ? "—" : plata(b.barberCents)}
                      </span>
                    </p>
                  </div>

                  {b.noShows > 0 ? (
                    <p className="mt-2 text-xs text-muted">
                      {b.noShows} {b.noShows === 1 ? "faltó" : "faltaron"} ·{" "}
                      {plata(b.lostCents)} sin cobrar
                    </p>
                  ) : null}

                  {b.settlement ? (
                    <>
                      <p className="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
                        <span className="text-muted">
                          {b.settlement.direction === "out"
                            ? "Hay que pagarle"
                            : "Tiene que pagar la silla"}{" "}
                          <span className="tabular text-ink">
                            {plata(b.settlement.cents)}
                          </span>
                          {pagado > 0 ? (
                            <>
                              {" · "}
                              <span className="tabular">
                                {plata(pagado)} anotado
                              </span>
                            </>
                          ) : null}
                        </span>
                        <span
                          className={[
                            "tabular font-semibold",
                            saldo > 0 ? "text-accent" : "text-muted",
                          ].join(" ")}
                        >
                          {saldo > 0
                            ? `Falta ${plata(saldo)}`
                            : saldo < 0
                              ? `${plata(-saldo)} de más`
                              : "Al día"}
                        </span>
                      </p>

                      <PayForm
                        barberId={b.barberId}
                        nombre={persona.displayName}
                        direction={b.settlement.direction}
                        sugerido={Math.max(0, saldo) / 100}
                        periodFrom={rango.from}
                        periodTo={rango.to}
                        hoy={hoy.date}
                      />
                    </>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      ) : null}

      {/* ---- Lo anotado --------------------------------------------------- */}
      {pagos.length > 0 ? (
        <>
          <h2 className="mt-10 text-xs font-semibold tracking-[0.18em] text-muted uppercase">
            {esDuenio ? "Movimientos anotados" : "Lo que te pagaron"}
          </h2>

          <ul className="mt-4 divide-y divide-ink/10 border-y border-ink/10">
            {pagos.map((pago) => (
              <li
                key={pago.id}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm text-ink">
                    {esDuenio ? `${nombreDe(pago.barberId)} · ` : ""}
                    <span className="tabular text-muted">{pago.paidOn}</span>
                  </p>
                  {pago.note ? (
                    <p className="text-xs text-muted">{pago.note}</p>
                  ) : null}
                </div>

                <div className="flex items-center gap-3">
                  <p className="tabular text-sm font-semibold text-ink">
                    {pago.direction === "out" ? "−" : "+"}
                    {plata(pago.amountCents)}
                  </p>

                  {esDuenio ? (
                    <form action={borrarPago}>
                      <input type="hidden" name="id" value={pago.id} />
                      <button
                        type="submit"
                        aria-label="Borrar este movimiento"
                        className="flex size-6 items-center justify-center rounded-md text-muted transition-colors duration-150 ease-out hover:bg-ink/10 hover:text-ink active:bg-ink/15"
                      >
                        <span aria-hidden="true">×</span>
                      </button>
                    </form>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>

          {esDuenio && faltaCobrar > 0 ? (
            <p className="mt-4 text-sm text-muted">
              Falta cobrar {plata(faltaCobrar)} de alquiler de silla.
            </p>
          ) : null}
        </>
      ) : null}
    </>
  );
}

function Dato({
  titulo,
  valor,
  pie,
}: {
  titulo: string;
  valor: string;
  pie?: string;
}) {
  return (
    <div>
      <dt className="text-xs text-muted">{titulo}</dt>
      <dd className="tabular mt-0.5 text-lg font-semibold text-ink">{valor}</dd>
      {pie ? <p className="tabular text-xs text-muted">{pie}</p> : null}
    </div>
  );
}
