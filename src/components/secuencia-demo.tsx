"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

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
 * Avanzan solas porque el que abrió esto no vino a estudiar una infografía,
 * pero **no hay que esperarlas**: se pasa con las flechas, tocando una barrita
 * o con el dedo. Al principio solo estaba lo de la barrita y no alcanzaba, y no
 * porque no funcionara: tres píxeles de alto no parecen un control, parecen un
 * adorno, así que el que quería adelantar no sabía que podía.
 *
 * Al primer toque el reloj se apaga para siempre. El que empezó a manejar
 * maneja: seguir corriendo por debajo le movería la pantalla justo cuando está
 * leyendo.
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
  const desde = useRef<{ x: number; y: number } | null>(null);

  /*
   * Moverse a mano, por donde sea: las flechas, una barrita o el dedo.
   *
   * Da la vuelta en las dos puntas, así ninguna flecha queda muerta: una flecha
   * apagada obliga a mirar en qué paso estás antes de tocarla, que es
   * exactamente el trabajo que uno no quiere hacer.
   *
   * Y apaga el avance solo. El que empezó a manejar maneja: seguir corriendo el
   * reloj por debajo le movería la pantalla justo cuando está leyendo.
   */
  const ir = useCallback((destino: number) => {
    const n = PASOS.length;
    setPaso(((destino % n) + n) % n);
    setManual(true);
  }, []);

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
      {/*
        Las flechas y las barritas van juntas, en la misma fila: es un solo
        lugar donde se ve dónde estás y cómo moverte.

        Se podía pasar de paso tocando una barrita, pero eso no se ve. Una
        barrita de tres píxeles no parece un control, parece un adorno, así que
        el que quería adelantar no tenía más remedio que esperar.
      */}
      <div className="secuencia-barras">
        <button
          type="button"
          aria-label="Paso anterior"
          onClick={() => ir(paso - 1)}
          className="secuencia-flecha"
        >
          <Flecha />
        </button>

        {PASOS.map((p, i) => (
          <button
            key={p.titulo}
            type="button"
            aria-label={`Paso ${i + 1}: ${p.titulo}`}
            aria-current={i === paso}
            onClick={() => ir(i)}
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

        <button
          type="button"
          aria-label="Paso siguiente"
          onClick={() => ir(paso + 1)}
          className="secuencia-flecha secuencia-flecha-derecha"
        >
          <Flecha />
        </button>
      </div>

      <div className="mt-4">
        <Titulo numero={paso + 1} texto={PASOS[paso].titulo} />
      </div>

      {/*
        La caja no cambia de alto al pasar de un paso al otro: si creciera y se
        achicara, lo de abajo saltaría solo y se lee como un error.

        Y se pasa con el dedo, que en un teléfono es lo primero que alguien
        intenta con una imagen que va cambiando. Se exige medio centímetro de
        movimiento horizontal para que arrastrar la página hacia abajo, o
        seleccionar un pedazo del mensaje, no cuenten como pasar de paso.
      */}
      <div
        className="secuencia-caja mt-3"
        onPointerDown={(e) => {
          desde.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e) => {
          const p0 = desde.current;
          desde.current = null;
          if (!p0) return;
          const dx = e.clientX - p0.x;
          const dy = e.clientY - p0.y;
          if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy)) return;
          ir(dx < 0 ? paso + 1 : paso - 1);
        }}
      >
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

/** La punta de flecha. Apunta a la derecha; la de la izquierda se espeja. */
function Flecha() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden className="size-3.5">
      <path
        d="m6 3 5 5-5 5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
