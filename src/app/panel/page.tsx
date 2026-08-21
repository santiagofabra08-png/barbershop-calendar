import Link from "next/link";
import { redirect } from "next/navigation";

import { Ledger } from "@/app/panel/ledger";
import { QuickAdd } from "@/app/panel/quick-add";
import { cargarEquipo, cargarServicios, cargarTurnos } from "@/lib/panel/data";
import { contarPedidosNuevos } from "@/lib/panel/pedidos";
import { sesionDelPanel } from "@/lib/panel/session";
import {
  addDays,
  formatDateLong,
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

  const { tenant, barbero, esDuenio } = sesion;
  const hoy = nowInTimeZone(tenant.timezone);

  const { d } = await searchParams;
  const fecha = d && FECHA.test(d) ? d : hoy.date;

  const [turnos, equipo, servicios, pedidosNuevos] = await Promise.all([
    cargarTurnos(tenant, fecha, fecha),
    cargarEquipo(tenant),
    cargarServicios(tenant),
    contarPedidosNuevos(tenant),
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
  // La plata del día vive en Cobros, no acá. Sumar los precios reservados daría
  // un número que parece caja y no lo es: nadie sabe todavía qué se agregó ni
  // qué se cobró.
  const cobrados = cortes.filter((t) => t.chargedAt !== null).length;

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
          {cortes.length === 1 ? "turno" : "turnos"} ·{" "}
          {cobrados === cortes.length ? (
            "todo cobrado"
          ) : (
            <Link
              href={`/panel/cobros?d=${fecha}`}
              className="text-accent-text underline decoration-1 underline-offset-4 transition-colors duration-150 ease-out hover:text-ink"
            >
              {cortes.length - cobrados} sin cobrar
            </Link>
          )}
        </p>
      ) : null}

      {/* Un pedido no tiene hora ni entra en la agenda, así que nadie lo va a
          encontrar solo. Se avisa acá, que es la pantalla que se mira siempre,
          y en ningún otro lado: un aviso repetido en cinco pantallas deja de
          leerse a la semana. */}
      {pedidosNuevos > 0 ? (
        <Link
          href="/panel/pedidos"
          className="mt-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg border-l-2 border-accent bg-accent/[0.06] px-4 py-3 transition-colors duration-150 ease-out hover:bg-accent/[0.1]"
        >
          <span className="text-sm text-ink">
            <span className="font-semibold">{pedidosNuevos}</span>{" "}
            {pedidosNuevos === 1
              ? "pedido de productos sin contestar"
              : "pedidos de productos sin contestar"}
          </span>
          <span className="text-xs font-semibold tracking-[0.08em] text-accent-text uppercase">
            Ver ›
          </span>
        </Link>
      ) : null}

      <Ledger
        turnos={delDia}
        tenant={tenant}
        ahora={fecha === hoy.date ? hoy.time : null}
        hoy={hoy.date}
        diaPasado={fecha < hoy.date}
        nombrePorBarbero={nombrePorBarbero}
      />

      {servicios.length > 0 ? (
        <QuickAdd
          fecha={fecha}
          servicios={servicios}
          moneda={tenant.currency}
          // El dueño puede cargar en la agenda de cualquiera; un barbero, solo
          // en la suya, así que ni siquiera ve el selector.
          barberos={
            esDuenio
              ? equipo
                  .filter((b) => b.isActive && b.acceptsBookings)
                  .map((b) => ({ id: b.id, displayName: b.displayName }))
              : [{ id: barbero.id, displayName: barbero.displayName }]
          }
        />
      ) : null}
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
