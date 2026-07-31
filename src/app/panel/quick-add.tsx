"use client";

import { useActionState } from "react";

import {
  bloquearRato,
  cargarTurnoAMano,
  type EstadoTurno,
} from "@/app/panel/actions";
import { formatPrice } from "@/lib/schedule";

type Servicio = {
  id: string;
  name: string;
  durationMinutes: number;
  priceCents: number;
};

type Opcion = { id: string; displayName: string };

const etiqueta =
  "block text-xs font-semibold tracking-[0.14em] text-ink uppercase";

const campo =
  "mt-2 w-full rounded-lg border border-transparent bg-ink/[0.03] px-3 py-2.5 text-ink transition-[background-color,border-color] duration-150 ease-out placeholder:text-ink/30 hover:border-ink/15 focus:border-ink focus:bg-surface focus:outline-none";

/**
 * Cargar algo en el día que se está mirando.
 *
 * Van plegados porque no es lo que se viene a hacer al panel: se viene a ver
 * la agenda. Se abren cuando hacen falta y el resto del tiempo no ocupan la
 * pantalla. Se usa `details`, que es del navegador: abre y cierra sin
 * JavaScript, y anda igual si algo falla al cargar.
 */
export function QuickAdd({
  fecha,
  servicios,
  barberos,
  moneda,
}: {
  fecha: string;
  servicios: Servicio[];
  /** Más de uno solo si es el dueño. */
  barberos: Opcion[];
  moneda: string;
}) {
  return (
    <div className="mt-8 space-y-2">
      <Plegable titulo="Cargar un turno">
        <FormTurno
          fecha={fecha}
          servicios={servicios}
          barberos={barberos}
          moneda={moneda}
        />
      </Plegable>

      <Plegable titulo="Bloquear un rato">
        <FormBloqueo fecha={fecha} barberos={barberos} />
      </Plegable>
    </div>
  );
}

function Plegable({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <details className="card group px-5 py-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-ink select-none">
        {titulo}
        <span
          aria-hidden="true"
          className="text-lg leading-none text-muted transition-transform duration-150 ease-out group-open:rotate-45"
        >
          +
        </span>
      </summary>
      {children}
    </details>
  );
}

function FormTurno({
  fecha,
  servicios,
  barberos,
  moneda,
}: {
  fecha: string;
  servicios: Servicio[];
  barberos: Opcion[];
  moneda: string;
}) {
  const [estado, accion, pendiente] = useActionState<EstadoTurno, FormData>(
    cargarTurnoAMano,
    {},
  );

  return (
    <form action={accion} className="mt-5">
      <input type="hidden" name="fecha" value={fecha} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="hora" className={etiqueta}>
            Hora
          </label>
          <input
            id="hora"
            name="hora"
            type="time"
            step={300}
            required
            className={`tabular ${campo}`}
          />
        </div>

        <div>
          <label htmlFor="serviceId" className={etiqueta}>
            Qué se hizo
          </label>
          <select id="serviceId" name="serviceId" className={campo}>
            {servicios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {formatPrice(s.priceCents, moneda)} ·{" "}
                {s.durationMinutes} min
              </option>
            ))}
          </select>
        </div>

        {barberos.length > 1 ? (
          <div>
            <label htmlFor="barberId" className={etiqueta}>
              Quién lo atiende
            </label>
            <select id="barberId" name="barberId" className={campo}>
              {barberos.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.displayName}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <input type="hidden" name="barberId" value={barberos[0]?.id ?? ""} />
        )}

        <div>
          <label htmlFor="nombre" className={etiqueta}>
            Nombre
          </label>
          <input
            id="nombre"
            name="nombre"
            type="text"
            autoComplete="off"
            placeholder="opcional"
            className={campo}
          />
        </div>

        <div>
          <label htmlFor="telefono" className={etiqueta}>
            Teléfono
          </label>
          <input
            id="telefono"
            name="telefono"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            placeholder="opcional"
            className={campo}
          />
        </div>
      </div>

      <Aviso estado={estado} />

      <button
        type="submit"
        disabled={pendiente}
        className="mt-5 w-full rounded-lg bg-accent px-6 py-3.5 text-xs font-semibold tracking-[0.08em] text-surface uppercase transition-colors duration-150 ease-out hover:bg-ink active:bg-ink/90 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
      >
        {pendiente ? "Guardando…" : "Cargar turno"}
      </button>

      <p className="mt-3 text-sm text-muted">
        El precio queda congelado como está hoy, igual que en una reserva de la
        página.
      </p>
    </form>
  );
}

function FormBloqueo({
  fecha,
  barberos,
}: {
  fecha: string;
  barberos: Opcion[];
}) {
  const [estado, accion, pendiente] = useActionState<EstadoTurno, FormData>(
    bloquearRato,
    {},
  );

  return (
    <form action={accion} className="mt-5">
      <input type="hidden" name="fecha" value={fecha} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="desde" className={etiqueta}>
            Desde
          </label>
          <input
            id="desde"
            name="desde"
            type="time"
            step={300}
            required
            className={`tabular ${campo}`}
          />
        </div>

        <div>
          <label htmlFor="hasta" className={etiqueta}>
            Hasta
          </label>
          <input
            id="hasta"
            name="hasta"
            type="time"
            step={300}
            required
            className={`tabular ${campo}`}
          />
        </div>

        {barberos.length > 1 ? (
          <div>
            <label htmlFor="barberIdBloqueo" className={etiqueta}>
              De quién
            </label>
            <select id="barberIdBloqueo" name="barberId" className={campo}>
              {barberos.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.displayName}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <input type="hidden" name="barberId" value={barberos[0]?.id ?? ""} />
        )}

        <div>
          <label htmlFor="motivo" className={etiqueta}>
            Motivo
          </label>
          <input
            id="motivo"
            name="motivo"
            type="text"
            autoComplete="off"
            placeholder="almuerzo, médico, lo que sea"
            className={campo}
          />
        </div>
      </div>

      <Aviso estado={estado} />

      <button
        type="submit"
        disabled={pendiente}
        className="mt-5 w-full rounded-lg border border-ink/20 px-6 py-3.5 text-xs font-semibold tracking-[0.08em] text-ink uppercase transition-colors duration-150 ease-out hover:border-ink hover:bg-ink hover:text-surface active:opacity-90 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
      >
        {pendiente ? "Guardando…" : "Bloquear"}
      </button>

      <p className="mt-3 text-sm text-muted">
        Nadie va a poder reservar en ese rato. Para el horario de todas las
        semanas usá Horarios.
      </p>
    </form>
  );
}

function Aviso({ estado }: { estado: EstadoTurno }) {
  if (estado.error) {
    return (
      <p
        role="alert"
        className="mt-4 rounded-lg border-l-2 border-accent bg-accent/[0.06] px-4 py-3 text-sm text-ink"
      >
        {estado.error}
      </p>
    );
  }
  if (estado.ok) {
    return (
      <p role="status" className="mt-4 text-sm text-muted">
        {estado.ok}
      </p>
    );
  }
  return null;
}
