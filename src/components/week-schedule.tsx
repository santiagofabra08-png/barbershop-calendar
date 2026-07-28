"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { Agenda, Day } from "@/lib/schedule";
import { formatDuration, formatPrice, mergeAgendas } from "@/lib/schedule";
import type { Service, Tenant } from "@/lib/tenant/types";

/** Cuando al cliente le da igual con quién cortarse. */
const CUALQUIERA = "cualquiera";

const ABREV = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

/**
 * Elegir turno en tres pasos, de lo general a lo particular:
 * barbero → día → hora.
 *
 * Antes estaban los cinco días con sus cincuenta horarios a la vez. Entraba
 * todo, pero obligaba a leer la semana entera para encontrar una hora. Acá se
 * ve un día por vez, que es como la gente decide: primero "el jueves", después
 * "a las seis".
 *
 * El paso del barbero desaparece solo cuando hay uno: no se le pregunta a
 * nadie algo que no tiene alternativa.
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

  const [barberoId, setBarberoId] = useState<string>(
    variosBarberos ? CUALQUIERA : (agendas[0]?.barber.id ?? CUALQUIERA),
  );
  const [fecha, setFecha] = useState<string | null>(null);
  const [hora, setHora] = useState<string | null>(null);

  // Los días que corresponden al barbero elegido. Con "cualquiera" se funden
  // todas las agendas: un horario está libre si alguno lo tiene libre.
  const days: Day[] = useMemo(() => {
    if (barberoId === CUALQUIERA) return mergeAgendas(agendas);
    return agendas.find((a) => a.barber.id === barberoId)?.days ?? [];
  }, [agendas, barberoId]);

  // Si el día elegido dejó de existir al cambiar de barbero, se cae al primero
  // que tenga lugar en vez de mostrar una pantalla vacía.
  const diaActivo =
    days.find((d) => d.date === fecha) ??
    days.find((d) => d.slots.some((s) => s.available)) ??
    days[0];

  const slotElegido =
    diaActivo && hora
      ? diaActivo.slots.find((s) => s.time === hora && s.available)
      : undefined;

  const elegirBarbero = (id: string) => {
    setBarberoId(id);
    setHora(null);
  };

  if (agendas.length === 0 || days.length === 0) {
    return (
      <p className="border border-ink/12 bg-surface px-5 py-8 text-center text-sm text-muted">
        No quedan horarios esta semana.
        {tenant.bookingWindow.mode === "weekly"
          ? " Los de la semana que viene se abren el sábado a las 21:00."
          : ""}
      </p>
    );
  }

  return (
    <>
      {variosBarberos ? (
        <section className="mb-10" aria-labelledby="con-quien">
          <h2
            id="con-quien"
            className="text-xs font-semibold tracking-[0.14em] text-ink uppercase"
          >
            ¿Con quién?
          </h2>

          <ul className="mt-4 flex flex-wrap gap-2">
            {agendas.map(({ barber }) => (
              <li key={barber.id}>
                <Opcion
                  activo={barberoId === barber.id}
                  onClick={() => elegirBarbero(barber.id)}
                >
                  {barber.displayName}
                </Opcion>
              </li>
            ))}
            <li>
              <Opcion
                activo={barberoId === CUALQUIERA}
                onClick={() => elegirBarbero(CUALQUIERA)}
              >
                El primero que haya
              </Opcion>
            </li>
          </ul>
        </section>
      ) : null}

      {/* ---- Los días ---- */}
      <section aria-labelledby="que-dia">
        <h2
          id="que-dia"
          className="text-xs font-semibold tracking-[0.14em] text-ink uppercase"
        >
          ¿Qué día?
        </h2>

        <ul className="mt-4 grid grid-cols-5 gap-2">
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
                    "flex w-full flex-col items-center gap-0.5 border px-1 py-3",
                    "transition-colors duration-150 ease-out",
                    "disabled:cursor-not-allowed disabled:border-ink/8 disabled:bg-transparent disabled:text-ink/25",
                    activo
                      ? "border-ink bg-ink text-bg"
                      : "border-ink/15 bg-surface text-ink hover:border-ink/50 active:bg-ink/5",
                  ].join(" ")}
                >
                  <span className="text-[10px] font-semibold tracking-[0.12em] uppercase opacity-70">
                    {ABREV[day.weekday]}
                  </span>
                  <span className="tabular font-display text-xl leading-none font-bold">
                    {day.dayNumber}
                  </span>
                  <span className="tabular text-[10px] opacity-60">
                    {libres === 0 ? "—" : libres}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ---- Las horas del día elegido ---- */}
      {diaActivo ? (
        <section className="mt-10" aria-labelledby="que-hora">
          <h2 id="que-hora" className="flex items-baseline gap-2">
            <span className="text-xs font-semibold tracking-[0.14em] text-ink uppercase">
              ¿A qué hora?
            </span>
            <span className="text-xs text-muted">
              {diaActivo.dayName} {diaActivo.dayNumber} de {diaActivo.monthName}
              {diaActivo.isToday ? " · hoy" : ""}
            </span>
          </h2>

          <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
            {diaActivo.slots.map((slot) => {
              const activo = slotElegido?.time === slot.time;
              return (
                <li key={slot.time}>
                  <button
                    type="button"
                    disabled={!slot.available}
                    aria-pressed={activo}
                    onClick={() => setHora(slot.time)}
                    className={[
                      "tabular w-full border px-2 py-3 text-sm font-semibold",
                      "transition-colors duration-150 ease-out",
                      "disabled:cursor-not-allowed disabled:border-ink/8 disabled:bg-transparent disabled:text-ink/25 disabled:line-through",
                      activo
                        ? "border-accent bg-accent text-surface"
                        : "border-ink/15 bg-surface text-ink hover:border-accent hover:text-accent active:bg-ink/5",
                    ].join(" ")}
                  >
                    {slot.time}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {/* ---- La barra de confirmación ---- */}
      {diaActivo && slotElegido ? (
        <div className="slide-up sticky bottom-0 z-10 -mx-5 mt-10 border-t border-ink/12 bg-surface px-5 py-4 sm:mx-0 sm:border sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium tracking-[0.14em] text-muted uppercase">
                Tu turno
              </p>
              <p className="mt-1 font-display text-lg font-bold">
                {diaActivo.dayName} {diaActivo.dayNumber} ·{" "}
                <span className="tabular">{slotElegido.time}</span>
              </p>
              <p className="mt-0.5 text-sm text-muted">
                {service.name} · {formatDuration(service.durationMinutes)} ·{" "}
                {formatPrice(service.priceCents, tenant.currency)}
              </p>
            </div>

            <Link
              href={`/reservar?fecha=${diaActivo.date}&hora=${slotElegido.time}&barbero=${barberoId}`}
              className="w-full bg-accent px-6 py-3 text-center text-sm font-semibold tracking-[0.08em] text-surface uppercase transition-colors duration-150 ease-out hover:bg-ink active:bg-ink/90 sm:w-auto"
            >
              Continuar
            </Link>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Opcion({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      className={[
        "border px-4 py-2.5 text-sm font-medium",
        "transition-colors duration-150 ease-out",
        activo
          ? "border-ink bg-ink text-bg"
          : "border-ink/15 bg-surface text-ink hover:border-ink/50 active:bg-ink/5",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
