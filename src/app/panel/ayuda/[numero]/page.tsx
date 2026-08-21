import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { aHtml } from "@/lib/guia";
import { seccionesDeLaGuia } from "@/lib/guia-fuente";
import { sesionDelPanel } from "@/lib/panel/session";

export const dynamic = "force-dynamic";

/**
 * Un tema de la guía.
 *
 * El HTML sale de `aHtml`, que arma el texto a partir del Markdown de la guía y
 * escapa todo lo que viene del archivo. Se inserta con `dangerouslySetInnerHTML`
 * porque no hay otra forma de dibujar HTML armado a mano, y es seguro por dos
 * motivos que conviene no perder de vista: el texto no lo escribe ningún
 * usuario (viene de un archivo del repositorio, no de la base) y aun así pasa
 * por `escapar` antes de que se le agregue una sola etiqueta.
 */
export default async function TemaDeAyudaPage({
  params,
}: {
  params: Promise<{ numero: string }>;
}) {
  const sesion = await sesionDelPanel();
  if (!sesion) redirect("/entrar");

  const { numero } = await params;
  const secciones = await seccionesDeLaGuia();

  const i = secciones.findIndex((s) => String(s.numero) === numero);
  if (i === -1) notFound();

  const seccion = secciones[i];
  const anterior = secciones[i - 1] ?? null;
  const siguiente = secciones[i + 1] ?? null;

  return (
    <>
      <Link
        href="/panel/ayuda"
        className="text-sm text-muted transition-colors duration-150 ease-out hover:text-ink"
      >
        ‹ Todos los temas
      </Link>

      <p className="mt-6 text-xs font-semibold tracking-[0.18em] text-muted uppercase">
        Ayuda · Tema {seccion.numero}
      </p>
      <h1 className="mt-1 font-display text-3xl leading-tight text-ink">
        {seccion.titulo}
      </h1>

      {/* La medida de lectura la fija el ancho del panel, que ya es angosto.
          No se le pone `max-w-prose` porque adentro hay tablas, y una tabla
          recortada a 65 caracteres se lee peor que el párrafo más ancho. */}
      <div
        className="mt-6"
        dangerouslySetInnerHTML={{ __html: aHtml(seccion.cuerpo) }}
      />

      {/* Se puede leer la guía entera de corrido, sin volver al índice cada
          vez. Es como se lee un manual cuando querés entender el producto y no
          resolver una duda puntual. */}
      <nav className="mt-10 flex flex-wrap gap-3 border-t border-ink/10 pt-6">
        {anterior ? (
          <Link href={`/panel/ayuda/${anterior.numero}`} className={PASO}>
            ‹ {anterior.titulo}
          </Link>
        ) : null}
        {siguiente ? (
          <Link href={`/panel/ayuda/${siguiente.numero}`} className={PASO}>
            {siguiente.titulo} ›
          </Link>
        ) : null}
      </nav>
    </>
  );
}

const PASO =
  "rounded-lg border border-ink/15 px-3 py-2 text-sm text-muted transition-colors duration-150 ease-out hover:border-ink/40 hover:text-ink focus-visible:border-ink/40 focus-visible:outline-none active:bg-ink/[0.06]";
