"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type Seccion = {
  href: string;
  label: string;
  /** Otras rutas que dejan esta sección marcada como la actual. */
  matches?: string[];
};

/**
 * Las secciones del panel.
 *
 * Abajo en el celular y arriba en pantalla grande. No es la misma barra movida
 * de lugar: abajo está donde llega el pulgar de quien tiene la máquina en la
 * otra mano, y arriba está donde se mira cuando hay un mouse.
 */
export function PanelNav({
  secciones,
  variante,
}: {
  secciones: Seccion[];
  variante: "barra" | "linea";
}) {
  const pathname = usePathname();

  // "/panel/semana" activa Semana, y "/panel" solo activa Agenda —si no, la
  // agenda quedaría marcada estando en cualquier otra pantalla.
  const cubre = (href: string) =>
    href === "/panel" ? pathname === "/panel" : pathname.startsWith(href);

  const activo = (s: Seccion) =>
    cubre(s.href) || (s.matches?.some(cubre) ?? false);

  if (variante === "linea") {
    return (
      <nav className="hidden items-center gap-1 sm:flex">
        {secciones.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            aria-current={activo(s) ? "page" : undefined}
            className={[
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-150 ease-out",
              activo(s)
                ? "bg-ink/[0.07] text-ink"
                : "text-muted hover:bg-ink/[0.04] hover:text-ink active:bg-ink/[0.08]",
            ].join(" ")}
          >
            {s.label}
          </Link>
        ))}
      </nav>
    );
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-ink/10 bg-surface sm:hidden">
      <ul
        className="grid"
        style={{ gridTemplateColumns: `repeat(${secciones.length}, 1fr)` }}
      >
        {secciones.map((s) => (
          <li key={s.href}>
            <Link
              href={s.href}
              aria-current={activo(s) ? "page" : undefined}
              className={[
                // Chico y sin espaciar de más: con cinco secciones cada nombre
                // tiene un quinto de pantalla y "Horarios" tiene que entrar.
                "flex flex-col items-center gap-1 px-1 pt-3 text-[0.65rem] font-semibold tracking-[0.04em] uppercase",
                "pb-[calc(0.75rem+env(safe-area-inset-bottom))]",
                "transition-colors duration-150 ease-out active:bg-ink/[0.05]",
                activo(s) ? "text-ink" : "text-muted",
              ].join(" ")}
            >
              {/* La marca de la sección activa: una barra corta arriba del
                  nombre, del color de la barbería. */}
              <span
                aria-hidden="true"
                className={[
                  "h-0.5 w-6 rounded-full transition-colors duration-150 ease-out",
                  activo(s) ? "bg-accent" : "bg-transparent",
                ].join(" ")}
              />
              {s.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
