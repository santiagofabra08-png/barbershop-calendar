"use client";

import Image from "next/image";
import { useActionState, useEffect, useRef, useState } from "react";

import type { EstadoProducto } from "@/app/panel/productos/actions";
import {
  FOTO_PRODUCTO,
  accept,
  prepararFoto,
  urlDeImagen,
  type ImagenLista,
} from "@/lib/panel/imagen";

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

  const [nueva, setNueva] = useState<ImagenLista | null>(null);
  const [quitada, setQuitada] = useState(false);
  const [problema, setProblema] = useState<string | null>(null);
  const [preparando, setPreparando] = useState(false);

  // La foto que viaja no es la que eligió la persona: es la versión recortada y
  // achicada por `prepararFoto`. El input que se ve no tiene `name` —no manda
  // nada—, y el archivo ya preparado se le pone a este, que sí lo tiene.
  const paraEnviar = useRef<HTMLInputElement>(null);

  // Una vista previa es una URL viva contra la memoria del navegador. Sin
  // revocarla, cada foto que se prueba queda ocupando lugar hasta recargar.
  useEffect(() => {
    return () => {
      if (nueva) URL.revokeObjectURL(nueva.vistaPrevia);
    };
  }, [nueva]);

  async function elegir(archivo: File | undefined) {
    if (!archivo) return;
    setProblema(null);
    setPreparando(true);
    try {
      const lista = await prepararFoto(archivo, FOTO_PRODUCTO);
      setNueva((previa) => {
        if (previa) URL.revokeObjectURL(previa.vistaPrevia);
        return lista;
      });
      setQuitada(false);

      const dt = new DataTransfer();
      dt.items.add(lista.archivo);
      if (paraEnviar.current) paraEnviar.current.files = dt.files;
    } catch (e) {
      setProblema(e instanceof Error ? e.message : "No se pudo leer esa imagen.");
    } finally {
      setPreparando(false);
    }
  }

  function quitar() {
    if (nueva) URL.revokeObjectURL(nueva.vistaPrevia);
    setNueva(null);
    setQuitada(true);
    setProblema(null);
    if (paraEnviar.current) paraEnviar.current.value = "";
  }

  const guardada = quitada ? null : urlDeImagen(inicial.imagePath);
  const mostrando = nueva?.vistaPrevia ?? guardada;

  return (
    <form action={enviar} className="mt-6">
      {inicial.id ? <input type="hidden" name="id" value={inicial.id} /> : null}
      {quitada ? <input type="hidden" name="quitar_foto" value="1" /> : null}
      <input ref={paraEnviar} type="file" name="foto" className="hidden" tabIndex={-1} />

      <div className="card space-y-6 px-5 py-5">
        {/* ---- La foto ------------------------------------------------------
            Va primero porque es lo único de esta pantalla que después ocupa
            media vidriera. Y lo que se espera se lee antes de tocar el botón:
            enterarse de que la foto no servía recién después de elegirla es
            hacer el trabajo dos veces. */}
        <div>
          <p className={etiqueta}>Foto</p>

          <div className="mt-2 flex items-start gap-4">
            <input
              id="foto-elegir"
              type="file"
              accept={accept(FOTO_PRODUCTO)}
              onChange={(e) => elegir(e.target.files?.[0])}
              className="peer sr-only"
            />
            <label
              htmlFor="foto-elegir"
              className="relative flex size-24 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-ink/25 bg-ink/[0.03] text-center text-xs font-medium text-muted transition-colors duration-150 ease-out hover:border-ink/50 hover:text-ink active:bg-ink/[0.07] peer-focus-visible:border-ink peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface"
            >
              {mostrando ? (
                <Image
                  src={mostrando}
                  alt=""
                  fill
                  sizes="96px"
                  unoptimized={Boolean(nueva)}
                  className="object-cover"
                />
              ) : (
                <span className="px-2">
                  {preparando ? "Preparando…" : "Elegir foto"}
                </span>
              )}
            </label>

            <div className="min-w-0 flex-1">
              <p className="text-sm text-muted">{FOTO_PRODUCTO.ayuda}</p>

              {mostrando ? (
                <button
                  type="button"
                  onClick={quitar}
                  className="mt-2 rounded-lg px-2 py-1 -ml-2 text-sm font-medium text-muted transition-colors duration-150 ease-out hover:bg-ink/[0.05] hover:text-ink active:bg-ink/[0.09]"
                >
                  Quitar foto
                </button>
              ) : null}
            </div>
          </div>

          {nueva?.recortada ? (
            <p className="mt-3 text-sm text-muted">
              La recortamos al cuadrado desde el centro. Fijate en la vista
              previa que no se haya ido nada.
            </p>
          ) : null}

          {problema ? (
            <p role="alert" className="mt-3 text-sm font-medium text-accent">
              {problema}
            </p>
          ) : null}
        </div>

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
              <span className="text-sm text-muted">
                baja solo al vender
              </span>
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
