import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  LINK,
  MarcoDelDetras,
  TextoConPaletaDelProducto,
} from "@/components/detras/marco";
import { urlDeLaPortada } from "@/lib/demo";
import { barberiaDelDetras } from "@/lib/detras/barberia";
import { aHtml } from "@/lib/guia";
import { seccionesDeLaGuia } from "@/lib/guia-fuente";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ numero: string }>;
}): Promise<Metadata> {
  const { numero } = await params;
  const seccion = (await seccionesDeLaGuia()).find(
    (s) => String(s.numero) === numero,
  );

  return {
    title: seccion ? `${seccion.titulo} · La guía` : "La guía del panel",
    robots: { index: false, follow: false },
  };
}

/** Un tema de la guía, público. Mismo texto y mismo renderizador que el panel. */
export default async function TemaPublicoPage({
  params,
}: {
  params: Promise<{ numero: string }>;
}) {
  const tenant = await barberiaDelDetras();
  if (!tenant) notFound();

  const { numero } = await params;
  const secciones = await seccionesDeLaGuia();

  const i = secciones.findIndex((s) => String(s.numero) === numero);
  if (i === -1) notFound();

  const seccion = secciones[i];
  const anterior = secciones[i - 1] ?? null;
  const siguiente = secciones[i + 1] ?? null;

  const portada = urlDeLaPortada(process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "");

  return (
    <MarcoDelDetras urlPortada={portada}>
      <Link href="/detras/guia" className={LINK}>
        ‹ Todos los temas
      </Link>

      <p className="mt-6 text-xs font-semibold tracking-[0.18em] text-[color:var(--barbicide)] uppercase">
        Guía · Tema {seccion.numero}
      </p>
      <h1 className="titulo-producto mt-2 text-3xl leading-tight sm:text-4xl">
        {seccion.titulo}
      </h1>

      <TextoConPaletaDelProducto>
        {/*
          El HTML lo arma `aHtml` a partir del Markdown de la guía, y todo lo
          que sale del archivo pasa por `escapar` antes de que se le agregue
          una sola etiqueta. El texto no lo escribe ningún usuario: viene del
          repositorio, no de la base.
        */}
        <div
          className="mt-6 max-w-3xl"
          dangerouslySetInnerHTML={{ __html: aHtml(seccion.cuerpo) }}
        />
      </TextoConPaletaDelProducto>

      <nav className="mt-12 flex flex-wrap gap-3 border-t border-[color:var(--vidrio)] pt-6">
        {anterior ? (
          <Link href={`/detras/guia/${anterior.numero}`} className={PASO}>
            ‹ {anterior.titulo}
          </Link>
        ) : null}
        {siguiente ? (
          <Link href={`/detras/guia/${siguiente.numero}`} className={PASO}>
            {siguiente.titulo} ›
          </Link>
        ) : null}
      </nav>
    </MarcoDelDetras>
  );
}

const PASO =
  "rounded-lg border border-[color:var(--vidrio)] px-3 py-2 text-sm transition-colors duration-150 ease-out hover:border-[color:var(--barbicide)] hover:text-[color:var(--barbicide)] focus-visible:border-[color:var(--barbicide)] focus-visible:outline-none";
