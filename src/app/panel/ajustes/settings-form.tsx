"use client";

import { useActionState, useState } from "react";

import {
  guardarAjustes,
  type EstadoAjustes,
} from "@/app/panel/ajustes/actions";
import type { Tenant } from "@/lib/tenant/types";

const etiqueta =
  "block text-xs font-semibold tracking-[0.14em] text-ink uppercase";

const campo =
  "mt-2 w-full rounded-lg border border-transparent bg-ink/[0.03] px-4 py-3 text-ink transition-[background-color,border-color] duration-150 ease-out placeholder:text-ink/30 hover:border-ink/15 focus:border-ink focus:bg-surface focus:outline-none";

/** Zonas donde puede estar una barbería que compre esto. */
const ZONAS = [
  ["America/Montevideo", "Uruguay"],
  ["America/Argentina/Buenos_Aires", "Argentina"],
  ["America/Santiago", "Chile"],
  ["America/Asuncion", "Paraguay"],
  ["America/Sao_Paulo", "Brasil"],
  ["America/Bogota", "Colombia"],
  ["America/Lima", "Perú"],
  ["America/Mexico_City", "México"],
  ["Europe/Madrid", "España"],
];

const MONEDAS = ["UYU", "ARS", "CLP", "PYG", "BRL", "COP", "PEN", "MXN", "EUR", "USD"];

const DIAS = [
  [0, "domingo"],
  [1, "lunes"],
  [2, "martes"],
  [3, "miércoles"],
  [4, "jueves"],
  [5, "viernes"],
  [6, "sábado"],
] as const;

/** Los seis colores, con el nombre de para qué sirve cada uno. */
const COLORES = [
  ["color_bg", "Fondo", "El papel de toda la página."],
  ["color_surface", "Tarjetas", "Lo que se apoya sobre el fondo."],
  ["color_ink", "Texto", "Y también la franja de arriba."],
  ["color_ink_muted", "Texto suave", "Aclaraciones y datos secundarios."],
  ["color_accent", "Color principal", "Botones y lo elegido."],
  ["color_accent_alt", "Color secundario", "La segunda franja del poste."],
] as const;

export function SettingsForm({ tenant }: { tenant: Tenant }) {
  const [estado, accion, pendiente] = useActionState<EstadoAjustes, FormData>(
    guardarAjustes,
    {},
  );

  // Los colores viven en el cliente para que la muestra de abajo cambie
  // mientras se eligen. El resto de los campos los maneja el navegador.
  const [colores, setColores] = useState<Record<string, string>>({
    color_bg: tenant.colors.bg,
    color_surface: tenant.colors.surface,
    color_ink: tenant.colors.ink,
    color_ink_muted: tenant.colors.inkMuted,
    color_accent: tenant.colors.accent,
    color_accent_alt: tenant.colors.accentAlt,
  });

  const [modo, setModo] = useState(tenant.bookingWindow.mode);

  return (
    <form action={accion} className="mt-6 space-y-10">
      {/* ---- Datos -------------------------------------------------------- */}
      <section>
        <h2 className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">
          Datos
        </h2>

        <div className="card mt-4 space-y-5 px-5 py-5">
          <div>
            <label htmlFor="name" className={etiqueta}>
              Nombre
            </label>
            <input
              id="name"
              name="name"
              type="text"
              defaultValue={tenant.name}
              className={campo}
            />
          </div>

          <div>
            <label htmlFor="address" className={etiqueta}>
              Dirección
            </label>
            <input
              id="address"
              name="address"
              type="text"
              defaultValue={tenant.address ?? ""}
              placeholder="Calle 1234, Ciudad"
              className={campo}
            />
          </div>

          <div>
            <label htmlFor="maps_url" className={etiqueta}>
              Link del mapa
            </label>
            <input
              id="maps_url"
              name="maps_url"
              type="url"
              inputMode="url"
              defaultValue={tenant.mapsUrl ?? ""}
              placeholder="opcional"
              className={campo}
            />
            <p className="mt-2 text-sm text-muted">
              Si lo dejás vacío, el botón del mapa busca la dirección de arriba
              en Google Maps. Pegá un link solo si querés apuntar a un lugar
              exacto.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="timezone" className={etiqueta}>
                Zona horaria
              </label>
              <select
                id="timezone"
                name="timezone"
                defaultValue={tenant.timezone}
                className={campo}
              >
                {ZONAS.map(([valor, pais]) => (
                  <option key={valor} value={valor}>
                    {pais}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="currency" className={etiqueta}>
                Moneda
              </label>
              <select
                id="currency"
                name="currency"
                defaultValue={tenant.currency}
                className={campo}
              >
                {MONEDAS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* ---- Marca -------------------------------------------------------- */}
      <section>
        <h2 className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">
          Colores
        </h2>
        <p className="mt-2 max-w-prose text-sm text-muted">
          Se aplican a toda la página del cliente. La muestra de abajo cambia
          mientras elegís.
        </p>

        <div className="card mt-4 space-y-4 px-5 py-5">
          {COLORES.map(([clave, titulo, para]) => (
            <div key={clave} className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <label
                htmlFor={clave}
                className="flex min-w-[11rem] flex-1 cursor-pointer items-center gap-3"
              >
                {/* El cuadrado es el control: se toca y abre el selector del
                    sistema. El campo de texto al lado es para pegar un hex
                    exacto, que es como llega un color de una guía de marca. */}
                <input
                  id={clave}
                  type="color"
                  value={colores[clave]}
                  onChange={(e) =>
                    setColores((c) => ({ ...c, [clave]: e.target.value }))
                  }
                  className="size-10 shrink-0 cursor-pointer rounded-lg border border-ink/15 bg-transparent p-1"
                />
                <span>
                  <span className="block text-sm font-medium text-ink">
                    {titulo}
                  </span>
                  <span className="block text-xs text-muted">{para}</span>
                </span>
              </label>

              <input
                name={clave}
                type="text"
                value={colores[clave]}
                onChange={(e) =>
                  setColores((c) => ({ ...c, [clave]: e.target.value }))
                }
                spellCheck={false}
                aria-label={`Código del color ${titulo}`}
                className="tabular w-28 rounded-lg border border-transparent bg-ink/[0.03] px-3 py-2 text-sm text-ink uppercase transition-[background-color,border-color] duration-150 ease-out hover:border-ink/15 focus:border-ink focus:bg-surface focus:outline-none"
              />
            </div>
          ))}
        </div>

        <Muestra colores={colores} nombre={tenant.name} />
      </section>

      {/* ---- Agenda ------------------------------------------------------- */}
      <section>
        <h2 className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">
          Reglas de la agenda
        </h2>

        <div className="card mt-4 space-y-5 px-5 py-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="min_lead_minutes" className={etiqueta}>
                Anticipación mínima
              </label>
              <div className="mt-2 flex items-center gap-2">
                <input
                  id="min_lead_minutes"
                  name="min_lead_minutes"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={10080}
                  step={5}
                  defaultValue={tenant.minLeadMinutes}
                  className="tabular w-28 rounded-lg border border-transparent bg-ink/[0.03] px-4 py-3 text-ink transition-[background-color,border-color] duration-150 ease-out hover:border-ink/15 focus:border-ink focus:bg-surface focus:outline-none"
                />
                <span className="text-sm text-muted">minutos</span>
              </div>
              <p className="mt-2 text-sm text-muted">
                No se ofrece un turno que arranque antes de esto. Evita que
                alguien reserve para dentro de cinco minutos.
              </p>
            </div>

            <div>
              <label htmlFor="cancel_deadline_minutes" className={etiqueta}>
                Plazo para cancelar
              </label>
              <div className="mt-2 flex items-center gap-2">
                <input
                  id="cancel_deadline_minutes"
                  name="cancel_deadline_minutes"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={10080}
                  step={5}
                  defaultValue={tenant.cancelDeadlineMinutes}
                  className="tabular w-28 rounded-lg border border-transparent bg-ink/[0.03] px-4 py-3 text-ink transition-[background-color,border-color] duration-150 ease-out hover:border-ink/15 focus:border-ink focus:bg-surface focus:outline-none"
                />
                <span className="text-sm text-muted">minutos antes</span>
              </div>
              <p className="mt-2 text-sm text-muted">
                Hasta cuándo el cliente puede cancelar solo. Después de eso
                tiene que llamar.
              </p>
            </div>
          </div>

          <fieldset className="border-t border-ink/10 pt-5">
            <legend className={etiqueta}>Hasta cuándo se puede reservar</legend>

            <div className="mt-3 space-y-2.5">
              <label
                className={[
                  "block cursor-pointer rounded-xl border px-4 py-3.5 transition-colors duration-150 ease-out select-none",
                  "has-focus-visible:outline has-focus-visible:outline-2 has-focus-visible:outline-ink has-focus-visible:outline-offset-2",
                  modo === "rolling"
                    ? "border-accent bg-accent/[0.05]"
                    : "border-ink/15 hover:border-ink/40",
                ].join(" ")}
              >
                <span className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="booking_window_mode"
                    value="rolling"
                    checked={modo === "rolling"}
                    onChange={() => setModo("rolling")}
                    className="mt-1 size-4 shrink-0 accent-[var(--tenant-accent)]"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-ink">
                      Una cantidad fija de días
                    </span>
                    <span className="mt-1 block text-sm text-muted">
                      Siempre se puede reservar con la misma anticipación. Es lo
                      más común.
                    </span>
                  </span>
                </span>

                {modo === "rolling" ? (
                  <span className="mt-3 flex items-center gap-2 pl-7">
                    <input
                      name="booking_window_days"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={180}
                      defaultValue={
                        tenant.bookingWindow.mode === "rolling"
                          ? tenant.bookingWindow.days
                          : 14
                      }
                      aria-label="Días para adelante"
                      className="tabular w-24 rounded-lg border border-transparent bg-ink/[0.03] px-3 py-2.5 text-ink transition-[background-color,border-color] duration-150 ease-out hover:border-ink/15 focus:border-ink focus:bg-surface focus:outline-none"
                    />
                    <span className="text-sm text-muted">días para adelante</span>
                  </span>
                ) : null}
              </label>

              <label
                className={[
                  "block cursor-pointer rounded-xl border px-4 py-3.5 transition-colors duration-150 ease-out select-none",
                  "has-focus-visible:outline has-focus-visible:outline-2 has-focus-visible:outline-ink has-focus-visible:outline-offset-2",
                  modo === "weekly"
                    ? "border-accent bg-accent/[0.05]"
                    : "border-ink/15 hover:border-ink/40",
                ].join(" ")}
              >
                <span className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="booking_window_mode"
                    value="weekly"
                    checked={modo === "weekly"}
                    onChange={() => setModo("weekly")}
                    className="mt-1 size-4 shrink-0 accent-[var(--tenant-accent)]"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-ink">
                      Solo la semana en curso
                    </span>
                    <span className="mt-1 block text-sm text-muted">
                      La semana siguiente se abre toda junta, un día y hora
                      fijos. Sirve si no querés comprometerte con mucha
                      anticipación.
                    </span>
                  </span>
                </span>

                {modo === "weekly" ? (
                  <span className="mt-3 flex flex-wrap items-center gap-2 pl-7">
                    <span className="text-sm text-muted">Se abre el</span>
                    <select
                      name="booking_week_release_dow"
                      defaultValue={
                        tenant.bookingWindow.mode === "weekly"
                          ? tenant.bookingWindow.releaseWeekday
                          : 6
                      }
                      aria-label="Día en que se abre la semana siguiente"
                      className="rounded-lg border border-transparent bg-ink/[0.03] px-3 py-2.5 text-ink transition-[background-color,border-color] duration-150 ease-out hover:border-ink/15 focus:border-ink focus:bg-surface focus:outline-none"
                    >
                      {DIAS.map(([valor, nombre]) => (
                        <option key={valor} value={valor}>
                          {nombre}
                        </option>
                      ))}
                    </select>
                    <span className="text-sm text-muted">a las</span>
                    <input
                      name="booking_week_release_time"
                      type="time"
                      step={300}
                      defaultValue={
                        tenant.bookingWindow.mode === "weekly"
                          ? tenant.bookingWindow.releaseTime
                          : "21:00"
                      }
                      aria-label="Hora en que se abre la semana siguiente"
                      className="tabular rounded-lg border border-transparent bg-ink/[0.03] px-3 py-2.5 text-ink transition-[background-color,border-color] duration-150 ease-out hover:border-ink/15 focus:border-ink focus:bg-surface focus:outline-none"
                    />
                  </span>
                ) : null}
              </label>
            </div>
          </fieldset>
        </div>
      </section>

      {estado.error ? (
        <p
          role="alert"
          className="rounded-lg border-l-2 border-accent bg-accent/[0.06] px-4 py-3 text-sm text-ink"
        >
          {estado.error}
        </p>
      ) : null}

      {estado.ok ? (
        <p role="status" className="text-sm text-muted">
          {estado.ok}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pendiente}
        className="w-full rounded-lg bg-accent px-6 py-4 text-sm font-semibold tracking-[0.08em] text-surface uppercase transition-colors duration-150 ease-out hover:bg-ink active:bg-ink/90 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
      >
        {pendiente ? "Guardando…" : "Guardar cambios"}
      </button>
    </form>
  );
}

/**
 * Cómo se va a ver la página del cliente.
 *
 * Los colores no se entienden en abstracto: seis cuadraditos no dicen nada
 * sobre si el texto se va a leer sobre el fondo. Esto es la portada en chico,
 * con las mismas piezas —franja, poste, tarjeta, botón— para poder decidir
 * mirando en vez de imaginando.
 */
function Muestra({
  colores,
  nombre,
}: {
  colores: Record<string, string>;
  nombre: string;
}) {
  return (
    <div className="mt-4">
      <p className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">
        Cómo se va a ver
      </p>

      <div
        className="mt-3 overflow-hidden rounded-xl border border-ink/10"
        style={{ backgroundColor: colores.color_bg }}
      >
        <div
          className="px-5 py-5 text-center"
          style={{ backgroundColor: colores.color_ink }}
        >
          <p
            className="font-display text-xl leading-tight font-bold"
            style={{ color: colores.color_bg }}
          >
            {nombre}
          </p>
          <div className="mx-auto mt-2.5 h-1.5 w-24 overflow-hidden rounded-full">
            <div
              className="h-full w-full"
              style={{
                backgroundImage: `repeating-linear-gradient(135deg, ${colores.color_accent} 0 10px, ${colores.color_surface} 10px 16px, ${colores.color_accent_alt} 16px 26px, ${colores.color_surface} 26px 32px)`,
              }}
            />
          </div>
        </div>

        <div className="px-5 py-5">
          <div
            className="rounded-xl px-4 py-4"
            style={{ backgroundColor: colores.color_surface }}
          >
            <p
              className="text-[11px] font-semibold tracking-[0.16em] uppercase"
              style={{ color: colores.color_ink_muted }}
            >
              Hora
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              {["14:00", "14:40", "15:20"].map((hora, i) => (
                <span
                  key={hora}
                  className="tabular rounded-lg px-3 py-2 text-sm font-semibold"
                  style={
                    i === 1
                      ? {
                          backgroundColor: colores.color_accent,
                          color: colores.color_surface,
                        }
                      : {
                          backgroundColor: `${colores.color_ink}12`,
                          color: colores.color_ink,
                        }
                  }
                >
                  {hora}
                </span>
              ))}
            </div>

            <p className="mt-3 text-sm" style={{ color: colores.color_ink_muted }}>
              Elegí un horario y seguimos.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
