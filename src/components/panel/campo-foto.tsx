"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import {
  accept,
  prepararFoto,
  type EspecDeImagen,
  type ImagenLista,
} from "@/lib/panel/imagen";

/**
 * El campo para subir una foto, en el panel.
 *
 * Salió de la pantalla de Productos cuando la de Equipo necesitó lo mismo. Es
 * la misma razón por la que las medidas viven en `imagen.ts` y no escritas a
 * mano en cada pantalla: dos copias del mismo campo se separan solas, y un día
 * una recorta y la otra no, o una avisa el peso máximo y la otra se olvida.
 *
 * Lo que hace, y que no es obvio mirando el markup:
 *
 * - **La foto que viaja no es la que eligió la persona.** `prepararFoto`
 *   recorta y achica en el navegador; el input que se ve no tiene `name` y no
 *   manda nada, y el archivo ya preparado se le asigna a uno escondido que sí
 *   lo tiene. Una foto de celular pesa 4 MB y sube 60 KB.
 * - **La vista previa es una URL contra la memoria del navegador.** Sin
 *   revocarla, cada foto que se prueba queda ocupando lugar hasta recargar.
 * - **Lo que se espera se lee antes de elegir el archivo.** Enterarse de que la
 *   foto no servía recién después de elegirla es hacer el trabajo dos veces.
 */
export function CampoFoto({
  espec,
  etiqueta,
  nombreCampo,
  urlGuardada,
  redonda = false,
  onPreparando,
}: {
  espec: EspecDeImagen;
  /** "Foto", "Foto de {nombre}". Lo que se lee arriba del recuadro. */
  etiqueta: string;
  /** El `name` del input escondido, y `quitar_{nombre}` para el borrado. */
  nombreCampo: string;
  /**
   * La foto que ya está guardada, como URL lista para mostrar.
   *
   * Ya armada y no la ruta del bucket: los productos guardan la ruta y arman
   * la URL al mostrar, los barberos y los logos guardan la URL entera. El
   * campo no tiene por qué saber cuál de las dos formas usa cada tabla.
   */
  urlGuardada: string | null;
  /** Se muestra en círculo. Para caras, que es como se ven después. */
  redonda?: boolean;
  /**
   * Avisa mientras recorta. El botón de guardar vive afuera y tiene que quedar
   * deshabilitado hasta que el archivo esté puesto: si no, se puede enviar el
   * formulario sin la foto y parece que no se subió.
   */
  onPreparando?: (preparando: boolean) => void;
}) {
  const [nueva, setNueva] = useState<ImagenLista | null>(null);
  const [quitada, setQuitada] = useState(false);
  const [problema, setProblema] = useState<string | null>(null);
  const [preparando, setPreparando] = useState(false);

  const paraEnviar = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (nueva) URL.revokeObjectURL(nueva.vistaPrevia);
    };
  }, [nueva]);

  async function elegir(archivo: File | undefined) {
    if (!archivo) return;
    setProblema(null);
    setPreparando(true);
    onPreparando?.(true);
    try {
      const lista = await prepararFoto(archivo, espec);
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
      onPreparando?.(false);
    }
  }

  function quitar() {
    if (nueva) URL.revokeObjectURL(nueva.vistaPrevia);
    setNueva(null);
    setQuitada(true);
    setProblema(null);
    if (paraEnviar.current) paraEnviar.current.value = "";
  }

  const guardada = quitada ? null : urlGuardada;
  const mostrando = nueva?.vistaPrevia ?? guardada;
  const id = `foto-elegir-${nombreCampo}`;

  return (
    <div>
      {quitada ? (
        <input type="hidden" name={`quitar_${nombreCampo}`} value="1" />
      ) : null}
      <input
        ref={paraEnviar}
        type="file"
        name={nombreCampo}
        className="hidden"
        tabIndex={-1}
      />

      <p className="block text-xs font-semibold tracking-[0.14em] text-ink uppercase">
        {etiqueta}
      </p>

      <div className="mt-2 flex items-start gap-4">
        <input
          id={id}
          type="file"
          accept={accept(espec)}
          onChange={(e) => elegir(e.target.files?.[0])}
          className="peer sr-only"
        />
        <label
          htmlFor={id}
          className={[
            "relative flex size-24 shrink-0 cursor-pointer items-center justify-center overflow-hidden",
            redonda ? "rounded-full" : "rounded-xl",
            "border border-dashed border-ink/25 bg-ink/[0.03] text-center text-xs font-medium text-muted",
            "transition-colors duration-150 ease-out hover:border-ink/50 hover:text-ink active:bg-ink/[0.07]",
            "peer-focus-visible:border-ink peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface",
          ].join(" ")}
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
          <p className="text-sm text-muted">{espec.ayuda}</p>

          {mostrando ? (
            <button
              type="button"
              onClick={quitar}
              className="mt-2 -ml-2 rounded-lg px-2 py-1 text-sm font-medium text-muted transition-colors duration-150 ease-out hover:bg-ink/[0.05] hover:text-ink active:bg-ink/[0.09]"
            >
              Quitar foto
            </button>
          ) : null}
        </div>
      </div>

      {nueva?.recortada ? (
        <p className="mt-3 text-sm text-muted">
          La recortamos al cuadrado desde el centro. Fijate en la vista previa
          que no se haya ido nada.
        </p>
      ) : null}

      {problema ? (
        <p role="alert" className="mt-3 text-sm font-medium text-accent-text">
          {problema}
        </p>
      ) : null}
    </div>
  );
}
