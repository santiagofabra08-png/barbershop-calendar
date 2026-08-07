import type { Metadata } from "next";
import { Archivo_Black } from "next/font/google";

import "./portada.css";

/**
 * Lo que se ve cuando no hay nada que mostrar.
 *
 * Cubre dos casos que no se parecen: un subdominio que no es de nadie
 * —`cualquier-cosa.tuapp.com`— y una dirección equivocada dentro de una
 * barbería que sí existe. Los dos terminan acá porque los dos son lo mismo
 * para quien mira: se escribió algo que no lleva a ningún lado.
 *
 * Va con los colores del producto y no con los de una barbería, porque en el
 * primer caso no hay barbería de la cual tomarlos. Es preferible una pantalla
 * consistente a una que a veces tiene marca y a veces no.
 */

const cartel = Archivo_Black({
  variable: "--font-cartel",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  title: "No encontramos esa página",
};

export default function NoEncontrado() {
  // Sin el puerto: en desarrollo la variable lo trae y el link saldría roto.
  const dominio = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "").split(":")[0];

  return (
    <main
      // `grow` y no solo `min-h-full`: el body es una columna flex, así que sin
      // esto la pantalla queda a media altura y debajo asoma el blanco.
      className={`portada ${cartel.variable} flex grow flex-col items-center justify-center px-5 py-16 text-center`}
    >
      <span className="pole-rule w-16 rounded-full" aria-hidden>
        <span />
      </span>

      <h1 className="mt-8 font-[family-name:var(--font-cartel)] text-3xl leading-tight tracking-tight sm:text-4xl">
        Acá no hay nada.
      </h1>

      {/*
        Se explican las dos razones porque son las dos que pasan de verdad, y
        porque cuál de las dos es cambia qué tiene que hacer la persona: si se
        equivocó al escribir, lo arregla sola; si el link se lo pasaron mal,
        tiene que pedirlo de nuevo.
      */}
      <p className="mt-4 max-w-md leading-relaxed text-[color:color-mix(in_oklab,var(--esmalte)_72%,transparent)]">
        La dirección que escribiste no corresponde a ninguna barbería, o el link
        que te pasaron ya no sirve. Si te lo mandó tu barbería, pediles que te lo
        manden otra vez.
      </p>

      {dominio ? (
        <a
          href={`https://${dominio}`}
          className="mt-8 inline-flex items-center justify-center rounded-lg bg-[color:var(--barbicide)] px-6 py-3.5 text-base font-semibold text-[color:var(--tiza)] transition-[background-color,transform] duration-150 hover:-translate-y-px hover:bg-[color:var(--esmalte)] active:translate-y-0 active:bg-[color:var(--esmalte)]"
        >
          Ir a {dominio}
        </a>
      ) : null}
    </main>
  );
}
