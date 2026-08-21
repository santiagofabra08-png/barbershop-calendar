import Link from "next/link";
import { redirect } from "next/navigation";

import { seccionesDeLaGuia } from "@/lib/guia-fuente";
import { sesionDelPanel } from "@/lib/panel/session";

export const dynamic = "force-dynamic";

/**
 * La lista de temas de la guía, adentro del panel.
 *
 * Se llega acá desde el `?` cuando la pantalla en la que estás no tiene una
 * sección propia, y desde cualquier sección con el link de arriba. Es la misma
 * guía que se le manda en PDF a la barbería: no hay dos textos que mantener.
 */
export default async function AyudaPage() {
  const sesion = await sesionDelPanel();
  if (!sesion) redirect("/entrar");

  const secciones = await seccionesDeLaGuia();

  return (
    <>
      <p className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">
        Ayuda
      </p>
      <h1 className="mt-1 font-display text-3xl leading-tight text-ink">
        Cómo funciona todo esto
      </h1>
      <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted">
        La guía entera, por tema. Desde cualquier pantalla del panel podés tocar
        el <span className="font-semibold text-ink">?</span> de arriba y caés
        directo en la parte que explica esa pantalla.
      </p>

      {secciones.length === 0 ? (
        <p className="mt-8 text-sm text-muted">
          La guía no está disponible en este momento.
        </p>
      ) : (
        <ol className="mt-8 space-y-2">
          {secciones.map((s) => (
            <li key={s.numero}>
              <Link
                href={`/panel/ayuda/${s.numero}`}
                className="card flex items-center gap-4 px-5 py-4 transition-shadow duration-150 ease-out hover:shadow-lg focus-visible:shadow-lg focus-visible:outline-none"
              >
                <span className="tabular w-6 shrink-0 text-sm text-muted">
                  {s.numero}
                </span>
                <span className="min-w-0 flex-1 font-medium text-ink">
                  {s.titulo}
                </span>
                <span aria-hidden="true" className="text-lg text-muted">
                  ›
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}

      <Link
        href="/panel"
        className="mt-8 inline-block text-sm text-muted transition-colors duration-150 ease-out hover:text-ink"
      >
        ‹ Volver a la agenda
      </Link>
    </>
  );
}
