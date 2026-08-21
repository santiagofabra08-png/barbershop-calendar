"use client";

import Image from "next/image";
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

/**
 * Una sola instancia para el caso sin agendas.
 *
 * Escrito como `?? []` sería un array nuevo en cada render, y el `useMemo` que
 * depende de él se recalcularía siempre aunque no haya cambiado nada.
 */
const SIN_AGENDAS: Agenda[] = [];

function leerPreferido(slug: string): string | null {
  try {
    return window.localStorage.getItem(`${MEMORIA}:${slug}`);
  } catch {
    return null;
  }
}

/** Un servicio con la grilla de horarios que le corresponde. */
export type OpcionDeServicio = { service: Service; agendas: Agenda[] };

/**
 * Elegir turno paso a paso: servicio → barbero → día → hora.
 *
 * Están todos a la vista, numerados. Un acordeón que abre y cierra escondería
 * lo que ya elegiste justo cuando querés revisarlo, y en un flujo tan corto no
 * hay nada que ahorrar.
 *
 * El paso del servicio aparece solo si hay más de uno: una barbería que hace
 * una sola cosa no tiene por qué preguntar cuál. El del barbero se muestra
 * siempre, incluso con uno solo, porque saber quién te va a atender es parte de
 * decidir y no un trámite.
 */
export function WeekSchedule({
  opciones,
  tenant,
  servicioInicial,
}: {
  opciones: OpcionDeServicio[];
  tenant: Tenant;
  /** Con cuál llegar elegido. Sirve para volver desde el formulario. */
  servicioInicial?: string;
}) {
  const variosServicios = opciones.length > 1;

  const [servicioId, setServicioId] = useState(
    opciones.find((o) => o.service.id === servicioInicial)?.service.id ??
      opciones[0]?.service.id ??
      "",
  );
  const [elegidoAMano, setElegidoAMano] = useState<string | null>(null);
  const [fecha, setFecha] = useState<string | null>(null);
  const [hora, setHora] = useState<string | null>(null);

  const opcion = opciones.find((o) => o.service.id === servicioId) ?? opciones[0];
  const service = opcion?.service;
  const agendas = opcion?.agendas ?? SIN_AGENDAS;
  const variosBarberos = agendas.length > 1;

  // Con los pasos numerados, sacar uno tiene que correr los demás: nadie
  // entiende una lista que va 2, 3, 4.
  const paso = (n: number) => (variosServicios ? n : n - 1);

  const elegirServicio = (id: string) => {
    setServicioId(id);
    // La hora deja de valer: cada servicio tiene su propia grilla, y las 14:20
    // de la barba no existen en la del corte.
    setHora(null);
  };

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

  if (!service || agendas.length === 0) {
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
        {/* ---- ① Servicio ---- */}
        {variosServicios ? (
          <Paso numero={1} titulo="Servicio">
            <ul className="space-y-1.5">
              {opciones.map(({ service: s }) => {
                const activo = s.id === service.id;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      aria-pressed={activo}
                      onClick={() => elegirServicio(s.id)}
                      className={[
                        "flex w-full flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 rounded-xl px-4 py-3 text-left",
                        "transition-[background-color,color,box-shadow] duration-150 ease-out",
                        activo
                          ? "bg-ink text-bg glow"
                          : "bg-ink/[0.04] text-ink hover:bg-ink/[0.09] active:bg-ink/[0.14]",
                      ].join(" ")}
                    >
                      <span className="text-sm font-medium">{s.name}</span>
                      <span
                        className={`tabular text-sm ${activo ? "opacity-75" : "text-muted"}`}
                      >
                        {formatPrice(s.priceCents, tenant.currency)}
                        <span className="opacity-60">
                          {" · "}
                          {formatDuration(s.durationMinutes)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Paso>
        ) : null}

        {/* ---- ② Barbero ---- */}
        <Paso numero={paso(2)} titulo="Barbero">
          <ul className="flex flex-wrap justify-center gap-2.5">
            {agendas.map(({ barber }) => (
              <li key={barber.id}>
                <TarjetaBarbero
                  nombre={barber.displayName}
                  foto={barber.photoUrl}
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

        {/* ---- ③ Día ---- */}
        <Paso numero={paso(3)} titulo="Día">
          {days.length === 0 ? (
            <p className="text-sm text-muted">
              {nombreElegido} no tiene horarios esta semana.
            </p>
          ) : (
            /* Flex y no grid: una barbería que abre cinco días deja la última
               fila con uno o dos días sueltos, y en una grilla esos quedan
               pegados a la izquierda con un hueco al lado. Acá cada fila se
               centra sola, la última incluida.

               El ancho crece con la pantalla en vez de quedar clavado en el
               tamaño del celular, pero cada día se mantiene chico: es un
               atajo para elegir, no la pieza principal de la pantalla. Ancho
               entero y cuadrados chicos significa más días por fila, que es
               lo que hace que esto se lea de un vistazo. */
            <ul className="mx-auto flex max-w-sm flex-wrap justify-center gap-2 sm:max-w-none">
              {days.map((day) => {
                const libres = day.slots.filter((s) => s.available).length;
                const activo = diaActivo?.date === day.date;

                return (
                  <li key={day.date} className="w-[4.25rem] sm:w-[5rem]">
                    <button
                      type="button"
                      disabled={libres === 0}
                      aria-pressed={activo}
                      onClick={() => {
                        setFecha(day.date);
                        setHora(null);
                      }}
                      className={[
                        "flex w-full flex-col items-center rounded-lg px-1 py-2 sm:py-2.5",
                        "transition-[background-color,color,box-shadow] duration-150 ease-out",
                        "disabled:cursor-not-allowed disabled:bg-transparent disabled:text-ink/20 disabled:shadow-none",
                        activo
                          ? "bg-ink text-bg glow"
                          : "bg-ink/[0.04] text-ink hover:bg-ink/[0.09] active:bg-ink/[0.14]",
                      ].join(" ")}
                    >
                      <span className="text-[9px] font-semibold tracking-[0.08em] uppercase opacity-60 sm:text-[10px]">
                        {ABREV[day.weekday]}
                      </span>
                      <span className="tabular font-display text-lg leading-tight font-bold sm:text-xl">
                        {day.dayNumber}
                      </span>
                      <span
                        key={libres}
                        className="count-in tabular flex items-center gap-1 text-[9px] leading-none opacity-55 sm:text-[10px]"
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

        {/* ---- ④ Hora ---- */}
        <Paso
          numero={paso(4)}
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
              key={`${service.id}-${barberoId}-${diaActivo.date}`}
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
                          ? "bg-accent text-surface glow-accent"
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
                {variosServicios ? (
                  <span className="text-ink">{service.name}</span>
                ) : null}
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
              href={`/reservar?fecha=${diaActivo.date}&hora=${slotElegido.time}&barbero=${barberoId}&servicio=${service.id}`}
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
  foto,
  sinInicial = false,
  onClick,
}: {
  nombre: string;
  activo: boolean;
  /** La cara del barbero. Sin foto va la inicial, que es el caso normal. */
  foto?: string | null;
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
          ? "bg-ink text-bg glow"
          : "bg-ink/[0.04] text-ink hover:bg-ink/[0.09] active:bg-ink/[0.14]",
      ].join(" ")}
    >
      {/* La forma dice qué hay adentro: círculo si es una persona, cuadrado si
          es "el primero que haya", que no lo es. Mismo tamaño en los dos para
          que la fila no se desalinee. */}
      <span
        className={[
          "relative flex size-9 shrink-0 items-center justify-center overflow-hidden",
          "font-display text-sm font-bold",
          sinInicial ? "rounded-lg" : "rounded-full",
          activo ? "bg-bg/15 text-bg ring-1 ring-bg/25" : "bg-ink/[0.07] text-ink ring-1 ring-ink/10",
        ].join(" ")}
      >
        {sinInicial ? (
          <IconoGrupo className="size-4 opacity-80" />
        ) : foto ? (
          // Sin texto alternativo a propósito: el nombre está al lado y
          // repetirlo le hace escuchar dos veces lo mismo a quien usa lector.
          <Image src={foto} alt="" fill sizes="36px" className="object-cover" />
        ) : (
          nombre.charAt(0).toUpperCase()
        )}
      </span>
      {nombre}
    </button>
  );
}
