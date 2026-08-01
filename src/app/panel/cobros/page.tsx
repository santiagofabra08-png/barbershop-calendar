import Link from "next/link";
import { redirect } from "next/navigation";

import {
  anularCobro,
  marcarAsistenciaEnCobros,
  reabrirCaja,
} from "@/app/panel/cobros/actions";
import { CierreForm } from "@/app/panel/cobros/cierre-form";
import { Ticket, type Agregable } from "@/app/panel/cobros/ticket";
import {
  MEDIOS,
  NOMBRE_MEDIO,
  totalDe,
  type CierreDeCaja,
  type PorMedio,
  type TurnoParaCobrar,
} from "@/lib/panel/cobro";
import {
  cargarCierre,
  cargarPendientes,
  cargarTurnosParaCobrar,
} from "@/lib/panel/cobros";
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

  const { tenant, esDuenio } = sesion;
  const hoy = nowInTimeZone(tenant.timezone);

  const { d } = await searchParams;
  const fecha = d && FECHA.test(d) ? d : hoy.date;

  const [turnos, servicios, pendientes, cierre] = await Promise.all([
    cargarTurnosParaCobrar(tenant.slug, fecha),
    cargarServiciosDelPanel(tenant),
    cargarPendientes(tenant.slug),
    cargarCierre(tenant, fecha),
  ]);

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

  // Lo que dice el sistema, por medio de pago. Es lo mismo que va a calcular la
  // base al cerrar; acá se muestra para poder contar contra algo.
  const esperado: PorMedio = { cash: 0, card: 0, transfer: 0 };
  for (const t of cobrados) {
    if (t.paymentMethod) {
      esperado[t.paymentMethod] += t.chargedTotalCents ?? 0;
    }
  }

  const plata = (c: number) => formatPrice(c, tenant.currency);
  const cerrada = cierre !== null;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">
            {cerrada ? "Caja cerrada" : fecha === hoy.date ? "Caja de hoy" : "Caja"}
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

      {/* Días viejos sin cerrar. Es lo único que nadie va a buscar por su
          cuenta, así que va arriba de todo. */}
      {pendientes.cantidad > 0 && pendientes.desde && pendientes.desde !== fecha ? (
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

      {/* ---- Caja cerrada ------------------------------------------------- */}
      {cierre ? (
        <ResumenDelCierre
          cierre={cierre}
          moneda={tenant.currency}
          esDuenio={esDuenio}
          fecha={fecha}
        />
      ) : null}

      {/* ---- Sin resolver -------------------------------------------------- */}
      {!cerrada && sinCobrar.length > 0 ? (
        <>
          <h2 className="mt-8 text-xs font-semibold tracking-[0.18em] text-muted uppercase">
            Sin cobrar · {sinCobrar.length}
          </h2>
          <ul className="mt-4 space-y-3">
            {sinCobrar.map((t) => (
              <li key={t.id} className="card px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <Cabecera turno={t} moneda={tenant.currency} />
                  <form action={marcarAsistenciaEnCobros}>
                    <input type="hidden" name="id" value={t.id} />
                    <input type="hidden" name="vino" value="0" />
                    <button
                      type="submit"
                      className="rounded-lg border border-ink/15 px-3 py-1.5 text-xs font-semibold tracking-[0.06em] text-muted uppercase transition-colors duration-150 ease-out hover:border-ink/40 hover:text-ink active:bg-ink/[0.06]"
                    >
                      No vino
                    </button>
                  </form>
                </div>
                <Ticket
                  turno={t}
                  agregables={agregables}
                  moneda={tenant.currency}
                />
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {/* ---- Cobrados ------------------------------------------------------ */}
      {cobrados.length > 0 ? (
        <>
          <h2 className="mt-8 text-xs font-semibold tracking-[0.18em] text-muted uppercase">
            Cobrados · {cobrados.length}
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
                    {!cerrada ? (
                      <form action={anularCobro}>
                        <input type="hidden" name="id" value={t.id} />
                        <button
                          type="submit"
                          className="rounded-lg border border-ink/15 px-3 py-1.5 text-xs font-semibold tracking-[0.06em] text-muted uppercase transition-colors duration-150 ease-out hover:border-ink/40 hover:text-ink active:bg-ink/[0.06]"
                        >
                          Anular
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {/* ---- No vinieron --------------------------------------------------- */}
      {faltaron.length > 0 ? (
        <>
          <h2 className="mt-8 text-xs font-semibold tracking-[0.18em] text-muted uppercase">
            No vinieron · {faltaron.length}
          </h2>
          <ul className="mt-4 divide-y divide-ink/10 border-y border-ink/10">
            {faltaron.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <Cabecera turno={t} moneda={tenant.currency} />
                {!cerrada ? (
                  <form action={marcarAsistenciaEnCobros}>
                    <input type="hidden" name="id" value={t.id} />
                    <input type="hidden" name="vino" value="1" />
                    <button
                      type="submit"
                      className="rounded-lg border border-ink/15 px-3 py-1.5 text-xs font-semibold tracking-[0.06em] text-muted uppercase transition-colors duration-150 ease-out hover:border-ink/40 hover:text-ink active:bg-ink/[0.06]"
                    >
                      Sí vino
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {turnos.length === 0 && !cerrada ? (
        <p className="card mt-8 px-5 py-8 text-center text-sm text-muted">
          No hubo turnos este día.
        </p>
      ) : null}

      {/* ---- El cierre ----------------------------------------------------- */}
      {!cerrada ? (
        <>
          <h2 className="mt-10 text-xs font-semibold tracking-[0.18em] text-muted uppercase">
            Cierre de caja
          </h2>
          <p className="mt-2 max-w-prose text-sm text-muted">
            Contá lo que hay de verdad y escribilo acá. Al lado vas a ver si
            coincide con lo que registró la página.
          </p>

          <CierreForm
            fecha={fecha}
            esperado={esperado}
            moneda={tenant.currency}
            bloqueado={sinCobrar.length > 0}
          />
        </>
      ) : null}
    </>
  );
}

function ResumenDelCierre({
  cierre,
  moneda,
  esDuenio,
  fecha,
}: {
  cierre: CierreDeCaja;
  moneda: string;
  esDuenio: boolean;
  fecha: string;
}) {
  const plata = (c: number) => formatPrice(c, moneda);
  const totalEsperado = totalDe(cierre.expected);
  const totalContado = totalDe(cierre.counted);
  const diferencia = totalContado - totalEsperado;

  return (
    <section className="card mt-6 px-5 py-6 sm:px-7">
      <p className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">
        Contado
      </p>
      <p className="tabular mt-1 font-display text-4xl leading-none text-ink sm:text-5xl">
        {plata(totalContado)}
      </p>

      <ul className="mt-6 space-y-2 border-t border-ink/10 pt-5">
        {MEDIOS.map((m) => {
          const dif = cierre.counted[m.valor] - cierre.expected[m.valor];
          return (
            <li
              key={m.valor}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm"
            >
              <span className="text-ink">{m.label}</span>
              <span className="tabular flex items-baseline gap-4">
                <span className="text-muted">
                  {plata(cierre.expected[m.valor])}
                </span>
                <span className="font-semibold text-ink">
                  {plata(cierre.counted[m.valor])}
                </span>
                <span
                  className={
                    dif === 0
                      ? "w-20 text-right text-muted"
                      : "w-20 text-right font-semibold text-accent"
                  }
                >
                  {dif === 0
                    ? "—"
                    : `${dif > 0 ? "+" : "−"}${plata(Math.abs(dif))}`}
                </span>
              </span>
            </li>
          );
        })}
      </ul>

      {diferencia !== 0 ? (
        <p className="mt-4 rounded-lg border-l-2 border-accent bg-accent/[0.06] px-4 py-3 text-sm text-ink">
          {diferencia > 0 ? "Sobraron " : "Faltaron "}
          <span className="tabular font-semibold">
            {plata(Math.abs(diferencia))}
          </span>{" "}
          contra lo que registró la página.
        </p>
      ) : null}

      {cierre.note ? (
        <p className="mt-4 text-sm text-muted">{cierre.note}</p>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-ink/10 pt-4">
        <p className="text-sm text-muted">
          Cerró {cierre.closedByName ?? "alguien del equipo"} ·{" "}
          <span className="tabular">{cierre.closedAt.slice(11, 16)}</span>
        </p>

        {esDuenio ? (
          <form action={reabrirCaja}>
            <input type="hidden" name="fecha" value={fecha} />
            <button
              type="submit"
              className="rounded-lg border border-ink/15 px-3 py-1.5 text-xs font-semibold tracking-[0.06em] text-muted uppercase transition-colors duration-150 ease-out hover:border-ink/40 hover:text-ink active:bg-ink/[0.06]"
            >
              Reabrir
            </button>
          </form>
        ) : null}
      </div>
    </section>
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
    <div className="min-w-0">
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
