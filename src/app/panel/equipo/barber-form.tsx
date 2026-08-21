"use client";

import { useActionState, useState } from "react";

import type { EstadoEquipo } from "@/app/panel/equipo/actions";
import { CampoFoto } from "@/components/panel/campo-foto";
import { FOTO_BARBERO } from "@/lib/panel/imagen";
import { NOMBRE_MODELO, RESENIA_MODELO } from "@/lib/panel/pay-copy";
import type { Pay, PaymentModel } from "@/lib/payroll";

const MODELOS: PaymentModel[] = [
  "commission",
  "salary",
  "chair_rent",
  "revenue_only",
];

const etiqueta =
  "block text-xs font-semibold tracking-[0.14em] text-ink uppercase";

const campo = [
  "mt-2 w-full rounded-lg border border-transparent bg-ink/[0.03] px-4 py-3 text-ink",
  "transition-[background-color,border-color] duration-150 ease-out",
  "placeholder:text-ink/30 hover:border-ink/15 focus:border-ink focus:bg-surface focus:outline-none",
].join(" ");

export type BarberoInicial = {
  id?: string;
  displayName: string;
  email: string | null;
  acceptsBookings: boolean;
  pay: Pay;
  photoUrl: string | null;
};

export function BarberForm({
  accion,
  inicial,
  textoBoton,
}: {
  accion: (previo: EstadoEquipo, formData: FormData) => Promise<EstadoEquipo>;
  inicial: BarberoInicial;
  textoBoton: string;
}) {
  const [estado, enviar, pendiente] = useActionState<EstadoEquipo, FormData>(
    accion,
    {},
  );

  // El modelo elegido vive en el cliente porque decide qué campos se ven. Los
  // otros valores no: los pone el navegador con defaultValue y los lee el
  // servidor del formulario.
  const [modelo, setModelo] = useState<PaymentModel>(inicial.pay.model);

  // Mientras se recorta la foto no se puede guardar: el archivo todavía no
  // está puesto en el formulario y se guardaría sin ella.
  const [preparando, setPreparando] = useState(false);

  return (
    <form action={enviar} className="mt-6">
      {inicial.id ? <input type="hidden" name="id" value={inicial.id} /> : null}

      <div className="card space-y-5 px-5 py-5">
        {/* La cara va primero: es lo que ve el cliente al elegir con quién
            reservar, antes que cualquier otro dato de esta pantalla. */}
        <CampoFoto
          espec={FOTO_BARBERO}
          etiqueta="Foto"
          nombreCampo="foto"
          urlGuardada={inicial.photoUrl}
          redonda
          onPreparando={setPreparando}
        />

        <div>
          <label htmlFor="display_name" className={etiqueta}>
            Nombre
          </label>
          <input
            id="display_name"
            name="display_name"
            type="text"
            autoComplete="off"
            defaultValue={inicial.displayName}
            placeholder="Como lo conocen los clientes"
            className={campo}
          />
        </div>

        <div>
          <label htmlFor="email" className={etiqueta}>
            Mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="off"
            defaultValue={inicial.email ?? ""}
            placeholder="opcional"
            className={campo}
          />
          <p className="mt-2 text-sm text-muted">
            Es con lo que va a entrar al panel. Si todavía no lo sabés, cargalo
            después.
          </p>
        </div>

        <label className="flex cursor-pointer items-start gap-3 select-none">
          <input
            type="checkbox"
            name="accepts_bookings"
            defaultChecked={inicial.acceptsBookings}
            className="mt-0.5 size-4 shrink-0 accent-[var(--tenant-accent)]"
          />
          <span>
            <span className="text-sm font-medium text-ink">
              Recibe turnos por la página
            </span>
            <span className="mt-0.5 block text-sm text-muted">
              Destildalo si administra pero no corta.
            </span>
          </span>
        </label>
      </div>

      {/* ---- Cómo cobra ------------------------------------------------- */}
      <h2 className="mt-8 text-xs font-semibold tracking-[0.18em] text-muted uppercase">
        Cómo cobra
      </h2>

      <fieldset className="mt-4 space-y-2.5">
        <legend className="sr-only">Modelo de cobro</legend>

        {MODELOS.map((m) => (
          <label
            key={m}
            className={[
              "block cursor-pointer rounded-xl border px-4 py-3.5 transition-colors duration-150 ease-out select-none",
              "has-focus-visible:outline has-focus-visible:outline-2 has-focus-visible:outline-ink has-focus-visible:outline-offset-2",
              modelo === m
                ? "border-accent bg-accent/[0.05]"
                : "border-ink/15 hover:border-ink/40",
            ].join(" ")}
          >
            <span className="flex items-start gap-3">
              <input
                type="radio"
                name="payment_model"
                value={m}
                checked={modelo === m}
                onChange={() => setModelo(m)}
                className="mt-1 size-4 shrink-0 accent-[var(--tenant-accent)]"
              />
              <span>
                <span className="block text-sm font-semibold text-ink">
                  {NOMBRE_MODELO[m]}
                </span>
                <span className="mt-1 block text-sm text-muted">
                  {RESENIA_MODELO[m]}
                </span>
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      {/* Los datos que pide el modelo elegido. Cambian con él, y los que no
          corresponden no se mandan: el servidor los pone en null. */}
      {modelo === "commission" ? (
        <div className="card mt-4 px-5 py-5">
          <label htmlFor="commission_percent" className={etiqueta}>
            Porcentaje para el barbero
          </label>
          <div className="mt-2 flex items-center gap-2">
            <input
              id="commission_percent"
              name="commission_percent"
              type="number"
              inputMode="decimal"
              min={0}
              max={100}
              step="0.5"
              defaultValue={
                inicial.pay.model === "commission" ? inicial.pay.percent : 50
              }
              className="tabular w-28 rounded-lg border border-transparent bg-ink/[0.03] px-4 py-3 text-ink transition-[background-color,border-color] duration-150 ease-out hover:border-ink/15 focus:border-ink focus:bg-surface focus:outline-none"
            />
            <span className="text-sm text-muted">% de cada corte</span>
          </div>
        </div>
      ) : null}

      {modelo === "salary" || modelo === "chair_rent" ? (
        <div className="card mt-4 px-5 py-5">
          <label htmlFor="pay_amount" className={etiqueta}>
            {modelo === "salary" ? "Cuánto cobra" : "Cuánto paga por la silla"}
          </label>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <input
              id="pay_amount"
              name="pay_amount"
              type="number"
              inputMode="decimal"
              min={0}
              step="1"
              defaultValue={
                inicial.pay.model === "salary" ||
                inicial.pay.model === "chair_rent"
                  ? inicial.pay.amountCents / 100
                  : ""
              }
              placeholder="0"
              className="tabular w-40 rounded-lg border border-transparent bg-ink/[0.03] px-4 py-3 text-ink transition-[background-color,border-color] duration-150 ease-out hover:border-ink/15 focus:border-ink focus:bg-surface focus:outline-none"
            />
            <select
              name="pay_period"
              defaultValue={
                inicial.pay.model === "salary" ||
                inicial.pay.model === "chair_rent"
                  ? inicial.pay.period
                  : "month"
              }
              className="rounded-lg border border-transparent bg-ink/[0.03] px-4 py-3 text-ink transition-[background-color,border-color] duration-150 ease-out hover:border-ink/15 focus:border-ink focus:bg-surface focus:outline-none"
            >
              <option value="week">por semana</option>
              <option value="month">por mes</option>
            </select>
          </div>
        </div>
      ) : null}

      {estado.error ? (
        <p
          role="alert"
          className="mt-6 rounded-lg border-l-2 border-accent bg-accent/[0.06] px-4 py-3 text-sm text-ink"
        >
          {estado.error}
        </p>
      ) : null}

      {estado.ok ? (
        <p role="status" className="mt-6 text-sm text-muted">
          {estado.ok}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pendiente || preparando}
        className="mt-6 w-full rounded-lg bg-accent px-6 py-4 text-sm font-semibold tracking-[0.08em] text-surface uppercase transition-colors duration-150 ease-out hover:bg-ink active:bg-ink/90 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
      >
        {pendiente ? "Guardando…" : textoBoton}
      </button>
    </form>
  );
}
