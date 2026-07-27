"use client";

import Link from "next/link";
import { useState } from "react";

import type { Day } from "@/lib/schedule";
import { formatDuration, formatPrice } from "@/lib/schedule";
import type { Service, Tenant } from "@/lib/tenant/types";

type Seleccion = { date: string; time: string; dayLabel: string };

/**
 * La semana entera en pantalla, sin calendario.
 *
 * Tropi solo abre cinco días y solo se reserva la semana en curso: el universo
 * completo de opciones entra de una. Un selector de fecha acá sería un paso de
 * más para elegir entre cosas que ya están todas a la vista.
 */
export function WeekSchedule({
  days,
  service,
  tenant,
  barberName,
}: {
  days: Day[];
  service: Service;
  tenant: Tenant;
  barberName: string;
}) {
  const [elegido, setElegido] = useState<Seleccion | null>(null);

  if (days.length === 0) {
    return (
      <p className="border border-ink/12 bg-surface px-5 py-8 text-center text-sm text-muted">
        No quedan horarios esta semana. Los de la semana que viene se abren el
        sábado a las 21:00.
      </p>
    );
  }

  return (
    <>
      <div className="space-y-10">
        {days.map((day) => (
          <section key={day.date} aria-labelledby={`dia-${day.date}`}>
            <h3
              id={`dia-${day.date}`}
              className="flex items-baseline gap-2 border-b border-ink/12 pb-2"
            >
              <span className="font-display text-2xl font-bold">
                {day.dayName}
              </span>
              <span className="tabular font-display text-2xl font-normal text-muted">
                {day.dayNumber}
              </span>
              <span className="text-xs font-medium tracking-[0.14em] text-muted uppercase">
                {day.monthName}
                {day.isToday ? " · hoy" : ""}
              </span>
            </h3>

            <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
              {day.slots.map((slot) => {
                const activo =
                  elegido?.date === day.date && elegido?.time === slot.time;

                return (
                  <li key={slot.time}>
                    <button
                      type="button"
                      disabled={!slot.available}
                      aria-pressed={activo}
                      onClick={() =>
                        setElegido({
                          date: day.date,
                          time: slot.time,
                          dayLabel: `${day.dayName} ${day.dayNumber}`,
                        })
                      }
                      className={[
                        "tabular w-full border px-2 py-3 text-sm font-semibold",
                        "transition-colors duration-150 ease-out",
                        "disabled:cursor-not-allowed disabled:border-ink/8 disabled:bg-transparent disabled:text-ink/25",
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
        ))}
      </div>

      {/* Barra de confirmación: aparece recién cuando hay algo que confirmar. */}
      {elegido ? (
        <div className="slide-up sticky bottom-0 z-10 -mx-5 mt-10 border-t border-ink/12 bg-surface px-5 py-4 sm:mx-0 sm:border sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium tracking-[0.14em] text-muted uppercase">
                Tu turno
              </p>
              <p className="mt-1 font-display text-lg font-bold">
                {elegido.dayLabel} · <span className="tabular">{elegido.time}</span>
              </p>
              <p className="mt-0.5 text-sm text-muted">
                {service.name} con {barberName} ·{" "}
                {formatDuration(service.durationMinutes)} ·{" "}
                {formatPrice(service.priceCents, tenant.currency)}
              </p>
            </div>

            <Link
              href={`/reservar?fecha=${elegido.date}&hora=${elegido.time}`}
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
