import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MarcoDelDetras, Nota } from "@/components/detras/marco";
import { urlDeLaPortada } from "@/lib/demo";
import { barberiaDelDetras } from "@/lib/detras/barberia";
import { seccionesDeLaGuia } from "@/lib/guia-fuente";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "La guía del panel",
  description: "El manual completo del panel, por tema.",
  robots: { index: false, follow: false },
};

/**
 * La guía entera, pública, adentro del detrás de escena.
 *
 * Es exactamente el mismo texto que se ve en `/panel/ayuda` con sesión y el
 * mismo que se le manda en PDF a cada barbería: sale de
 * `docs/guia-del-panel.md`, un solo archivo. Poder leer el manual completo
 * antes de pagar es raro y es a propósito: lo que hay adentro es lo que se
 * está vendiendo, y esconderlo solo sirve si lo de adentro decepciona.
 */
export default async function GuiaDelDetrasPage() {
  const tenant = await barberiaDelDetras();
  if (!tenant) notFound();

  const secciones = await seccionesDeLaGuia();
  const portada = urlDeLaPortada(process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "");

  return (
    <MarcoDelDetras urlPortada={portada}>
      <Nota rotulo="Guía del panel" titulo="Cómo funciona todo esto">
        <p className="max-w-2xl">
          El manual completo, por tema. Es el mismo que recibe cada barbería y
          el mismo que está adentro del panel, en el botón de ayuda de cada
          pantalla.
        </p>
      </Nota>

      {secciones.length === 0 ? (
        <p className="mt-10 text-sm">La guía no está disponible en este momento.</p>
      ) : (
        <ol className="mt-10 space-y-2">
          {secciones.map((s) => (
            <li key={s.numero}>
              <Link
                href={`/detras/guia/${s.numero}`}
                className="flex items-center gap-4 rounded-xl bg-[color:var(--tiza)] px-5 py-4 ring-1 ring-[color:var(--vidrio)] transition-shadow duration-150 ease-out hover:shadow-[0_12px_30px_-18px_rgba(16,20,38,0.6)] focus-visible:shadow-[0_12px_30px_-18px_rgba(16,20,38,0.6)] focus-visible:outline-none"
              >
                <span className="w-6 shrink-0 text-sm text-[color:color-mix(in_oklab,var(--esmalte)_55%,transparent)] tabular-nums">
                  {s.numero}
                </span>
                <span className="min-w-0 flex-1 font-medium">{s.titulo}</span>
                <span aria-hidden="true" className="text-lg text-[color:var(--barbicide)]">
                  ›
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}

      <Link href="/detras" className="mt-10 inline-block text-sm font-medium text-[color:var(--barbicide)] underline decoration-1 underline-offset-4 transition-colors duration-150 ease-out hover:text-[color:var(--esmalte)]">
        ‹ Volver al panel por dentro
      </Link>
    </MarcoDelDetras>
  );
}
