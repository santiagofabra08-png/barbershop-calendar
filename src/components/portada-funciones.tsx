"use client";

import Image from "next/image";
import { useState } from "react";

/**
 * Los cuatro problemas, y la pantalla que resuelve cada uno.
 *
 * Es lo único de la portada que necesita JavaScript, y por eso vive aparte:
 * el resto de la página se dibuja entera en el servidor.
 *
 * Son pestañas y no cuatro bloques largos por una razón concreta: el visitante
 * elige cuál de los cuatro le duele en vez de scrollear los cuatro. Un dueño de
 * barbería que odia sacar cuentas no necesita leer sobre recordatorios.
 *
 * El orden no es casual: va del problema que más veces se escucha al que menos.
 */

type Funcion = {
  /** El problema, en las palabras en que lo cuenta un barbero. */
  dolor: string;
  /** El título corto para la pestaña, que tiene que entrar en un botón. */
  etiqueta: string;
  titulo: string;
  texto: string;
  imagen: string;
  alt: string;
};

const FUNCIONES: Funcion[] = [
  {
    etiqueta: "El teléfono",
    dolor: "Estás cortando y suena el teléfono para pedir un turno.",
    titulo: "Dejás de dar turnos por mensaje",
    texto:
      "Tu página queda abierta toda la noche. El cliente entra, ve los horarios " +
      "que tenés libres de verdad y reserva. Sin ida y vuelta, sin “después te " +
      "confirmo”, y sin dos personas anotadas a la misma hora.",
    imagen: "/portada/publica-demo.png",
    alt: "La página de reservas de una barbería, con los servicios y los horarios libres.",
  },
  {
    etiqueta: "La caja",
    dolor: "Al cerrar, papel y calculadora para saber cuánto le toca a cada uno.",
    titulo: "La cuenta del día se hace sola",
    texto:
      "Cobrás cada turno con lo que se llevó puesto: el corte, los productos y " +
      "cómo pagó. El reparto sale solo. Cada barbero cobra como se arregló con " +
      "él: comisión, sueldo o alquiler de silla.",
    imagen: "/portada/panel-cobros.png",
    alt: "La pantalla de cobros, con el ticket de un turno abierto.",
  },
  {
    etiqueta: "Los que no vienen",
    dolor: "La silla vacía que ya estaba vendida.",
    titulo: "Un recordatorio antes de que se olvide",
    texto:
      "La agenda del día siguiente te muestra a quién atendés y, al lado de cada " +
      "uno, un botón que abre WhatsApp con el mensaje ya escrito. Tocás, mandás y " +
      "seguís cortando.",
    imagen: "/portada/panel-agenda.png",
    alt: "La agenda del día siguiente, con un botón de WhatsApp en cada turno.",
  },
  {
    etiqueta: "La semana",
    dolor: "No saber cuánto se hizo hasta que se termina el mes.",
    titulo: "La semana entera, en un número",
    texto:
      "Cuánto se cobró, cuántos cortes salieron, cuánto va al equipo y cuánto " +
      "queda en el local. Y si quedó plata sin cobrar, te lo avisa en vez de " +
      "dejarla afuera de la cuenta en silencio.",
    imagen: "/portada/panel-semana.png",
    alt: "El resumen de la semana, con lo cobrado y el reparto al equipo.",
  },
];

export function Funciones() {
  const [elegida, setElegida] = useState(0);
  const f = FUNCIONES[elegida];

  return (
    <div>
      {/*
        Pestañas de verdad, no botones sueltos: el lector de pantalla anuncia
        cuántas hay y cuál está activa, y las flechas del teclado se mueven
        entre ellas como espera cualquiera que no use el mouse.

        Envuelven en vez de correrse de costado. La primera versión las dejaba
        en una tira con scroll horizontal y en un teléfono la cuarta quedaba
        fuera de la pantalla: se llegaba arrastrando, pero nadie arrastra algo
        que no sabe que está. Una función escondida es una función que no
        existe.
      */}
      <div
        role="tablist"
        aria-label="Qué resuelve"
        className="flex flex-wrap gap-2"
      >
        {FUNCIONES.map((x, i) => {
          const activa = i === elegida;
          return (
            <button
              key={x.etiqueta}
              role="tab"
              id={`pestania-${i}`}
              aria-selected={activa}
              aria-controls={`panel-${i}`}
              tabIndex={activa ? 0 : -1}
              onClick={() => setElegida(i)}
              onKeyDown={(e) => {
                if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
                const paso = e.key === "ArrowRight" ? 1 : -1;
                const siguiente =
                  (elegida + paso + FUNCIONES.length) % FUNCIONES.length;
                setElegida(siguiente);
                document.getElementById(`pestania-${siguiente}`)?.focus();
              }}
              className={
                "rounded-lg px-4 py-2.5 text-sm font-semibold " +
                "transition-[background-color,color] duration-150 " +
                (activa
                  ? "bg-[color:var(--barbicide)] text-[color:var(--tiza)]"
                  : "bg-[color:var(--tiza)] text-[color:color-mix(in_oklab,var(--esmalte)_65%,transparent)] " +
                    "hover:text-[color:var(--esmalte)] active:bg-[color:var(--porcelana)]")
              }
            >
              {x.etiqueta}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`panel-${elegida}`}
        aria-labelledby={`pestania-${elegida}`}
        // `items-start` y no `items-center`: el teléfono mide casi el triple
        // que el texto, y centrado dejaba la explicación flotando en el medio
        // con un vacío grande arriba. Arrancando los dos a la misma altura se
        // lee como una cosa sola.
        className="mt-8 grid items-start gap-10 md:grid-cols-[1fr_19rem] md:gap-14"
      >
        <div>
          {/*
            El problema primero y en la voz del barbero, antes que la solución.
            Alguien que no se reconoce en el problema no tiene por qué creerle
            a la solución.
          */}
          <p className="text-sm font-semibold text-[color:var(--barbicide)]">
            {f.dolor}
          </p>

          <h3 className="mt-3 font-[family-name:var(--font-cartel)] text-2xl leading-tight tracking-tight sm:text-3xl">
            {f.titulo}
          </h3>

          <p className="mt-4 max-w-xl leading-relaxed text-[color:color-mix(in_oklab,var(--esmalte)_72%,transparent)]">
            {f.texto}
          </p>
        </div>

        {/*
          La captura es del producto de verdad, sacada por `scripts/capturas.mts`
          contra el sitio en producción. El marco de teléfono no es decoración:
          dice sin escribirlo que esto se usa parado, entre corte y corte, y no
          sentado frente a una computadora.

          Sobre la nitidez, que costó una vuelta: se veía borrosa por dos cosas
          a la vez. Se mostraba a 240 píxeles, que para una pantalla de teléfono
          entera es poquísimo, y encima Next comprime a calidad 75 por defecto
          —bien para una foto, pastoso sobre texto fino de interfaz—. Se arregla
          agrandando el marco y subiendo la calidad; `sizes` tiene que decir el
          ancho real o el navegador se baja una imagen más chica de la que va a
          mostrar.
        */}
        <div className="mx-auto w-full max-w-[19rem] md:mx-0 md:max-w-none">
          <div className="marco-telefono">
            <Image
              key={f.imagen}
              src={f.imagen}
              alt={f.alt}
              width={1170}
              height={2400}
              quality={95}
              priority={elegida === 0}
              className="aparecer block h-auto w-full"
              sizes="(min-width: 768px) 19rem, 19rem"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
