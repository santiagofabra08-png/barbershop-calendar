"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { seccionParaRuta } from "@/lib/guia";

/**
 * El `?` de arriba, que abre la ayuda de la pantalla donde estás.
 *
 * Es un link y no un panel que se despliega, a propósito. Un cajón lateral con
 * la explicación adentro se ve mejor en una demostración, pero obliga a cargar
 * el texto de la guía en cada pantalla del panel: son varios kilobytes por
 * pantalla que casi nadie va a abrir, pagados con los datos del celular de
 * quien está trabajando. Así, el texto se pide solo cuando alguien lo pide.
 *
 * **Sabe dónde estás.** Desde Cobros lleva a la parte de cobros, desde
 * Horarios a la de horarios. Una ayuda que siempre abre en el índice obliga a
 * buscar, y buscar es exactamente lo que no puede hacer alguien que ya está
 * perdido. Cuando la pantalla no tiene una sección propia, abre en el índice,
 * que ahí sí es la respuesta correcta.
 */
export function BotonDeAyuda() {
  const pathname = usePathname();

  // Adentro de la ayuda el botón no se dibuja: el `?` que te lleva a donde ya
  // estás es un botón muerto.
  if (pathname.startsWith("/panel/ayuda")) return null;

  const seccion = seccionParaRuta(pathname);
  const href = seccion === null ? "/panel/ayuda" : `/panel/ayuda/${seccion}`;

  return (
    <Link
      href={href}
      aria-label="Ayuda de esta pantalla"
      title="Ayuda de esta pantalla"
      className="flex size-8 shrink-0 items-center justify-center rounded-full border border-ink/15 text-sm font-semibold text-muted transition-colors duration-150 ease-out hover:border-ink/40 hover:text-ink focus-visible:border-ink/40 focus-visible:outline-none active:bg-ink/[0.06]"
    >
      <span aria-hidden="true">?</span>
    </Link>
  );
}
