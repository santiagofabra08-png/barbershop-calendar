"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";

import { IconoGrupo, IconoReloj, IconoTijera } from "@/components/icons";
import type { Agenda, Day } from "@/lib/schedule";
import { formatDuration, formatPrice, mergeAgendas } from "@/lib/schedule";
import type { Service, Tenant } from "@/lib/tenant/types";

/** Cuando al cliente le da igual con quién cortarse. */
const CUALQUIERA = "cualquiera";

const ABREV = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

/** A partir de acá, el día se marca como que queda poco. */
const POCOS = 2;

const MEMORIA = "barbero-preferido";

/** El único que escribe la preferencia es esta pantalla: no hay a qué suscribirse. */
const sinSuscripcion = () => () => {};

function leerPreferido(slug: string): string | null {
  try {
    return window.localStorage.getItem(`${MEMORIA}:${slug}`);
  } catch {
    return null;
  }
}

/**
 * Elegir turno en tres pasos: barbero → día → hora.
 *
 * Los tres están siempre a la vista, numerados. Un acordeón que abre y cierra
 * escondería lo que ya elegiste justo cuando querés revisarlo, y en un flujo
 * de tres pasos no hay nada que ahorrar.
 *
 * El paso del barbero se muestra incluso con uno solo: saber quién te va a
 * atender es parte de decidir, no un trámite.
 */
export function WeekSchedule({
  agendas,
  service,
  tenant,
}: {
  agendas: Agenda[];
  service: Service;
  tenant: Tenant;
}) {
  const variosBarberos = agendas.length > 1;

  const [elegidoAMano, setElegidoAMano] = useState<string | null>(null);
  const [fecha, setFecha] = useState<string | null>(null);
  const [hora, setHora] = useState<string | null>(null);

  // Quien ya se cortó con alguien suele querer volver con el mismo.
  //
  // El servidor no puede saber qué eligió este visitante la vez pasada, así
  // que devuelve null y el navegador completa después. `useSyncExternalStore`
  // existe justo para esto: mantiene el HTML del servidor y el del navegador
  // iguales en el primer render, sin efectos que encadenen renders.
  const preferido = useSyncExternalStore(
    sinSuscripcion,
    () => leerPreferido(tenant.slug),
    () => null,
  );

  const barberoId =
    elegidoAMano ??
    (preferido && agendas.some((a) => a.barber.id === preferido)
      ? preferido
      : agendas.length === 1
        ? agendas[0].barber.id
        : CUALQUIERA);

  const elegirBarbero = (id: string) => {
    setElegidoAMano(id);
    setHora(null);
    try {
      if (id === CUALQUIERA) {
        window.localStorage.removeItem(`${MEMORIA}:${tenant.slug}`);
      } else {
        window.localStorage.setItem(`${MEMORIA}:${tenant.slug}`, id);
      }
    } catch {
      // Navegador con el almacenamiento bloqueado: se elige a mano y listo.
    }
  };

  const days: Day[] = useMemo(() => {
    if (barberoId === CUALQUIERA) return mergeAgendas(agendas);
    return agendas.find((a) => a.barber.id === barberoId)?.days ?? [];
  }, [agendas, barberoId]);

  // Si el día elegido dejó de existir al cambiar de barbero, se cae al primero
  // con lugar en vez de mostrar una pantalla vacía.
  const diaActivo =
    days.find((d) => d.date === fecha) ??
    days.find((d) => d.slots.some((s) => s.available)) ??
    days[0];

  const slotElegido =
    diaActivo && hora
      ? diaActivo.slots.find((s) => s.time === hora && s.available)
      : undefined;

  const nombreElegido =
    barberoId === CUALQUIERA
      ? null
      : agendas.find((a) => a.barber.id === barberoId)?.barber.displayName;

  if (agendas.length === 0) {
    return (
      <div className="card px-6 py-12 text-center">
        <p className="text-sm text-muted">
          La agenda todavía no está abierta. Volvé en un rato.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="card overflow-hidden">
        {/* ---- ① Barbero ---- */}
        <Paso numero={1} titulo="Barbero">
          <ul className="flex flex-wrap gap-2.5">
            {agendas.map(({ barber }) => (
              <li key={barber.id}>
                <TarjetaBarbero
                  nombre={barber.displayName}
                  activo={barberoId === barber.id}
                  onClick={() => elegirBarbero(barber.id)}
                />
              </li>
            ))}
            {variosBarberos ? (
              <li>
                <TarjetaBarbero
                  nombre="El primero que haya"
                  sinInicial
                  activo={barberoId === CUALQUIERA}
                  onClick={() => elegirBarbero(CUALQUIERA)}
                />
              </li>
            ) : null}
          </ul>
        </Paso>

        {/* ---- ② Día ---- */}
        <Paso numero={2} titulo="Día">
          {days.length === 0 ? (
            <p className="text-sm text-muted">
              {nombreElegido} no tiene horarios esta semana.
            </p>
          ) : (
            <ul className="grid max-w-sm grid-cols-5 gap-1.5">
              {days.map((day) => {
                const libres = day.slots.filter((s) => s.available).length;
                const activo = diaActivo?.date === day.date;

                return (
                  <li key={day.date}>
                    <button
                      type="button"
                      disabled={libres === 0}
                      aria-pressed={activo}
                      onClick={() => {
                        setFecha(day.date);
                        setHora(null);
                      }}
                      className={[
                        "flex w-full flex-col items-center rounded-lg px-1 py-2",
                        "transition-[background-color,color,box-shadow] duration-150 ease-out",
                        "disabled:cursor-not-allowed disabled:bg-transparent disabled:text-ink/20 disabled:shadow-none",
                        activo
                          ? "bg-ink text-bg shadow-[0_5px_14px_-8px] shadow-ink/60"
                          : "bg-ink/[0.04] text-ink hover:bg-ink/[0.09] active:bg-ink/[0.14]",
                      ].join(" ")}
                    >
                      <span className="text-[9px] font-semibold tracking-[0.08em] uppercase opacity-60">
                        {ABREV[day.weekday]}
                      </span>
                      <span className="tabular font-display text-lg leading-tight font-bold">
                        {day.dayNumber}
                      </span>
                      <span
                        key={libres}
                        className="count-in tabular flex items-center gap-1 text-[9px] leading-none opacity-55"
                      >
                        {/* Quedan pocos: se marca, pero solo cuando es cierto. */}
                        {libres > 0 && libres <= POCOS ? (
                          <span
                            className={`size-1 rounded-full ${activo ? "bg-bg" : "bg-accent"}`}
                            aria-hidden="true"
                          />
                        ) : null}
                        {libres === 0 ? "—" : libres}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Paso>

        {/* ---- ③ Hora ---- */}
        <Paso
          numero={3}
          titulo="Hora"
          nota={
            diaActivo
              ? `${diaActivo.dayName} ${diaActivo.dayNumber} de ${diaActivo.monthName}${
                  diaActivo.isToday ? " · hoy" : ""
                }`
              : undefined
          }
          ultimo
        >
          {diaActivo ? (
            <ul
              key={`${barberoId}-${diaActivo.date}`}
              className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5"
            >
              {diaActivo.slots.map((slot, i) => {
                const activo = slotElegido?.time === slot.time;
                return (
                  <li
                    key={slot.time}
                    className="slot-in"
                    style={{ "--i": i } as React.CSSProperties}
                  >
                    <button
                      type="button"
                      disabled={!slot.available}
                      aria-pressed={activo}
                      onClick={() => setHora(slot.time)}
                      className={[
                        "tabular w-full rounded-lg px-2 py-3.5 text-[15px] font-semibold",
                        "transition-[background-color,color,box-shadow] duration-150 ease-out",
                        "disabled:cursor-not-allowed disabled:bg-transparent disabled:text-ink/20 disabled:line-through disabled:shadow-none",
                        activo
                          ? "bg-accent text-surface shadow-[0_6px_16px_-8px] shadow-accent/70"
                          : "bg-ink/[0.04] text-ink hover:bg-ink/[0.09] active:bg-ink/[0.14]",
                      ].join(" ")}
                    >
                      {slot.time}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted">
              Elegí un día para ver los horarios.
            </p>
          )}
        </Paso>
      </div>

      {/* ---- La barra de confirmación ---- */}
      {diaActivo && slotElegido ? (
        <div className="slide-up sticky bottom-0 z-10 -mx-5 mt-6 border-t border-ink/10 bg-surface px-5 py-4 sm:mx-0 sm:rounded-xl sm:border sm:px-6 sm:shadow-[0_-4px_24px_-12px] sm:shadow-ink/25">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-display text-xl leading-tight font-bold">
                {diaActivo.dayName} {diaActivo.dayNumber} ·{" "}
                <span className="tabular">{slotElegido.time}</span>
              </p>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                {nombreElegido ? (
                  <span className="inline-flex items-center gap-1.5">
                    <IconoTijera className="size-3.5 opacity-70" />
                    {nombreElegido}
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1.5">
                  <IconoReloj className="size-3.5 opacity-70" />
                  {formatDuration(service.durationMinutes)}
                </span>
                <span className="tabular">
                  {formatPrice(service.priceCents, tenant.currency)}
                </span>
              </p>
            </div>

            <Link
              href={`/reservar?fecha=${diaActivo.date}&hora=${slotElegido.time}&barbero=${barberoId}`}
              className="w-full rounded-lg bg-accent px-7 py-3.5 text-center text-sm font-semibold tracking-[0.08em] text-surface uppercase transition-colors duration-150 ease-out hover:bg-ink active:bg-ink/90 sm:w-auto"
            >
              Continuar
            </Link>
          </div>
        </div>
      ) : null}
    </>
  );
}

/** Un paso del flujo, con su número. */
function Paso({
  numero,
  titulo,
  nota,
  ultimo = false,
  children,
}: {
  numero: number;
  titulo: string;
  nota?: string;
  ultimo?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`px-5 py-6 sm:px-7 ${ultimo ? "" : "border-b border-ink/[0.07]"}`}
      aria-labelledby={`paso-${numero}`}
    >
      <div className="mb-4 flex items-center gap-3">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ink text-[11px] font-semibold text-bg">
          {numero}
        </span>
        <h2
          id={`paso-${numero}`}
          className="text-[11px] font-semibold tracking-[0.16em] text-ink uppercase"
        >
          {titulo}
        </h2>
        {nota ? <span className="text-xs text-muted">{nota}</span> : null}
      </div>
      {children}
    </section>
  );
}

function TarjetaBarbero({
  nombre,
  activo,
  sinInicial = false,
  onClick,
}: {
  nombre: string;
  activo: boolean;
  sinInicial?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      className={[
        "flex items-center gap-2.5 rounded-xl py-2.5 pr-4 pl-2.5 text-sm font-medium",
        "transition-[background-color,color,box-shadow] duration-150 ease-out",
        activo
          ? "bg-ink text-bg shadow-[0_6px_16px_-8px] shadow-ink/60"
          : "bg-ink/[0.04] text-ink hover:bg-ink/[0.09] active:bg-ink/[0.14]",
      ].join(" ")}
    >
      <span
        className={[
          "flex size-8 shrink-0 items-center justify-center rounded-lg font-display text-sm font-bold",
          activo ? "bg-bg/15 text-bg" : "bg-ink/[0.07] text-ink",
        ].join(" ")}
      >
        {sinInicial ? (
          <IconoGrupo className="size-4 opacity-80" />
        ) : (
          nombre.charAt(0).toUpperCase()
        )}
      </span>
      {nombre}
    </button>
  );
}
