"use client";

import { useActionState, useState } from "react";

import type { EstadoProducto } from "@/app/panel/productos/actions";
import { CampoFoto } from "@/components/panel/campo-foto";
import { FOTO_PRODUCTO, urlDeImagen } from "@/lib/panel/imagen";

const etiqueta =
  "block text-xs font-semibold tracking-[0.14em] text-ink uppercase";

const campo =
  "mt-2 w-full rounded-lg border border-transparent bg-ink/[0.03] px-4 py-3 text-ink transition-[background-color,border-color] duration-150 ease-out placeholder:text-ink/30 hover:border-ink/15 focus:border-ink focus:bg-surface focus:outline-none";

const numero =
  "tabular rounded-lg border border-transparent bg-ink/[0.03] px-4 py-3 text-ink transition-[background-color,border-color] duration-150 ease-out hover:border-ink/15 focus:border-ink focus:bg-surface focus:outline-none";

export type ProductoInicial = {
  id?: string;
  name: string;
  description: string | null;
  priceCents: number;
  stock: number;
  imagePath: string | null;
};

export function ProductForm({
  accion,
  inicial,
  textoBoton,
  moneda,
}: {
  accion: (
    previo: EstadoProducto,
    formData: FormData,
  ) => Promise<EstadoProducto>;
  inicial: ProductoInicial;
  textoBoton: string;
  moneda: string;
}) {
  const [estado, enviar, pendiente] = useActionState<EstadoProducto, FormData>(
    accion,
    {},
  );

  const [preparando, setPreparando] = useState(false);

  return (
    <form action={enviar} className="mt-6">
      {inicial.id ? <input type="hidden" name="id" value={inicial.id} /> : null}

      <div className="card space-y-6 px-5 py-5">
        {/* La foto va primero porque es lo único de esta pantalla que después
            ocupa media vidriera. */}
        <CampoFoto
          espec={FOTO_PRODUCTO}
          etiqueta="Foto"
          nombreCampo="foto"
          urlGuardada={urlDeImagen(inicial.imagePath)}
          onPreparando={setPreparando}
        />

        {/* ---- Los datos ---------------------------------------------------- */}
        <div>
          <label htmlFor="name" className={etiqueta}>
            Nombre
          </label>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="off"
            defaultValue={inicial.name}
            placeholder="Cera mate"
            className={campo}
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="price" className={etiqueta}>
              Precio
            </label>
            <div className="mt-2 flex items-center gap-2">
              <input
                id="price"
                name="price"
                type="number"
                inputMode="decimal"
                min={0}
                step="10"
                defaultValue={inicial.priceCents / 100}
                className={`${numero} w-36`}
              />
              <span className="text-sm text-muted">{moneda}</span>
            </div>
          </div>

          <div>
            <label htmlFor="stock" className={etiqueta}>
              Cuántos hay
            </label>
            <div className="mt-2 flex items-center gap-3">
              <input
                id="stock"
                name="stock"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                defaultValue={inicial.stock}
                className={`${numero} w-28`}
              />
              <span className="text-sm text-muted">baja solo al vender</span>
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="description" className={etiqueta}>
            Descripción
          </label>
          <input
            id="description"
            name="description"
            type="text"
            autoComplete="off"
            defaultValue={inicial.description ?? ""}
            placeholder="opcional, se ve debajo del nombre"
            className={campo}
          />
        </div>
      </div>

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
