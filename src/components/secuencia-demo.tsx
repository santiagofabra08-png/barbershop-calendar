"use client";

import Image from "next/image";
import { useEffect, useState, useSyncExternalStore } from "react";

import { ChatDeWhatsApp } from "@/components/chat-whatsapp";

/**
 * La cadena entera, en tres pasos que avanzan solos.
 *
 * Un título y un mensaje alcanzaban para el que ya había entendido. Lo que no
 * explicaban es el mecanismo: que el cliente elige solo, que eso le aparece al
 * barbero sin que nadie anote nada, y que el mensaje sale de ahí. Son tres
 * momentos y hay que verlos en orden, porque el orden es la explicación.
 *
 * **Las dos primeras son capturas del sitio de verdad**, sacadas por
 * `scripts/capturas.mts`. Recrear las pantallas en HTML se vería igual de bien
 * hoy y empezaría a mentir el día que cambie el panel, sin que nadie se entere.
 * Una foto también envejece, pero se vuelve a sacar con un comando.
 *
 * **El tercero no es una foto: es el mensaje de esta persona**, calculado con
 * la misma función que usa el panel. Lo genérico explica el mecanismo; el turno
 * propio lo hace suyo.
 *
 * Avanzan solas porque el que abrió esto no vino a estudiar una infografía. El
 * que quiera manejarlas toca una barrita y ahí se quedan quietas: tomó el
 * control y no se lo saca nadie.
 */

type Paso = {
  titulo: string;
  imagen?: { src: string; ancho: number; alto: number; alt: string };
};

const PASOS: Paso[] = [
  {
    titulo: "El cliente elige la hora",
    imagen: {
      src: "/portada/paso-elegir-hora.png",
      ancho: 1050,
      alto: 945,
      alt: "La grilla de horarios de la página pública, con las diez de la mañana elegida.",
    },
  },
  {
    titulo: "Le aparece al barbero en la agenda",
    imagen: {
      src: "/portada/paso-agenda.png",
      ancho: 1050,
      alto: 417,
      alt: "El turno en la agenda del panel, con el nombre del cliente y el botón Recordar al lado.",
    },
  },
  { titulo: "Un toque, y WhatsApp se abre escrito" },
];

/*
 * Cuánto se queda cada paso. El tercero dura más porque hay un mensaje entero
 * para leer; los dos primeros son una imagen que se entiende de un vistazo.
 */
const DURACION = [3800, 3800, 6000];

export function SecuenciaDemo({
  cliente,
  mensaje,
}: {
  /** Cómo lo tiene guardado el barbero: el nombre del contacto en el chat. */
  cliente: string;
  /** El recordatorio ya escrito, tal como sale de `mensajeDeRecordatorio`. */
  mensaje: string;
}) {
  const [paso, setPaso] = useState(0);
  const [manual, setManual] = useState(false);

  /*
   * Quien pidió menos movimiento no ve una secuencia sino los tres pasos, uno
   * abajo del otro. No es una versión degradada: es la misma información sin
   * nada que se mueva, y de paso es lo que se ve si el JavaScript no corre.
   */
  const quieto = useSyncExternalStore(
    (avisar) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", avisar);
      return () => mq.removeEventListener("change", avisar);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );

  useEffect(() => {
    if (manual || quieto) return;
    const t = setTimeout(() => setPaso((p) => (p + 1) % PASOS.length), DURACION[paso]);
    return () => clearTimeout(t);
  }, [paso, manual, quieto]);

  const cuerpo = (i: number) => {
    const p = PASOS[i];
    return p.imagen ? (
      <Image
        src={p.imagen.src}
        alt={p.imagen.alt}
        width={p.imagen.ancho}
        height={p.imagen.alto}
        // Se muestra bastante más chica de lo que se sacó, y Next comprime a 75
        // por defecto: bien para una foto, pastoso sobre texto de interfaz.
        quality={95}
        priority={i === 0}
        sizes="(min-width: 640px) 26rem, 88vw"
        className="secuencia-foto"
      />
    ) : (
      <ChatDeWhatsApp contacto={cliente} mensaje={mensaje} />
    );
  };

  if (quieto) {
    return (
      <div className="secuencia">
        {PASOS.map((p, i) => (
          <div key={p.titulo} className={i === 0 ? "" : "mt-7"}>
            <Titulo numero={i + 1} texto={p.titulo} />
            <div className="secuencia-caja mt-3">{cuerpo(i)}</div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="secuencia">
      <div className="secuencia-barras">
        {PASOS.map((p, i) => (
          <button
            key={p.titulo}
            type="button"
            aria-label={`Paso ${i + 1}: ${p.titulo}`}
            aria-current={i === paso}
            onClick={() => {
              setPaso(i);
              setManual(true);
            }}
            className="secuencia-barra"
          >
            {/*
              Las que ya pasaron quedan llenas y la de ahora se va llenando: así
              la fila dice a la vez cuántos pasos hay, en cuál va y cuánto falta.
              Vaciando las anteriores se vería un solo punto saltando, que no
              cuenta ninguna de las tres cosas.

              La clave reinicia la animación al volver a este paso: sin eso, la
              segunda vuelta muestra la barra ya llena desde el principio.
            */}
            <span
              key={`${paso}-${manual}`}
              className={
                i < paso || (i === paso && manual)
                  ? "lleno"
                  : i === paso
                    ? "corriendo"
                    : ""
              }
              style={{ animationDuration: `${DURACION[i]}ms` }}
            />
          </button>
        ))}
      </div>

      <div className="mt-4">
        <Titulo numero={paso + 1} texto={PASOS[paso].titulo} />
      </div>

      {/* La caja no cambia de alto al pasar de un paso al otro: si creciera y
          se achicara, lo de abajo saltaría solo y se lee como un error. */}
      <div className="secuencia-caja mt-3">
        <div key={paso} className="secuencia-entra">
          {cuerpo(paso)}
        </div>
      </div>
    </div>
  );
}

function Titulo({ numero, texto }: { numero: number; texto: string }) {
  return (
    <p className="flex items-center gap-2.5">
      <span className="secuencia-numero">{numero}</span>
      <span className="text-[15px] leading-snug font-semibold sm:text-base">
        {texto}
      </span>
    </p>
  );
}
