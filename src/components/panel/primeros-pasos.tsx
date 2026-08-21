import Link from "next/link";

import {
  loQueFalta,
  primerosPasos,
  tituloDeLaLista,
  type EstadoDelLocal,
} from "@/lib/panel/primeros-pasos";

/**
 * Lo que falta para terminar de armar la página, arriba de la agenda.
 *
 * Cuatro decisiones que conviene no revertir sin pensarlo:
 *
 * - **Se dibuja solo si falta algo.** No es una sección del panel que se
 *   visita: es un andamio. Cuando la barbería está armada desaparece y no
 *   deja rastro, ni un "listo" ni una tilde verde. Un bloque que sigue ahí
 *   diciendo que todo está bien ocupa la mejor parte de la pantalla para no
 *   decir nada.
 * - **Solo lo ve el dueño.** Los cinco pasos llevan a pantallas que un barbero
 *   no puede abrir. Mostrárselo sería pedirle que arregle algo que no puede
 *   tocar.
 * - **Cada paso dice qué se rompe, no qué hay que hacer.** "Cargá el logo" es
 *   una tarea; "sin logo arriba de la página va tu nombre escrito y nada más"
 *   es un motivo. Lo primero se posterga, lo segundo se hace.
 * - **Cuenta cuánto falta.** "Van 2 de 5" promete que esto se termina. Sin el
 *   número, una lista de tareas en la pantalla principal parece infinita.
 *
 * El paso que impide reservar (un barbero que atiende y no tiene horario) va
 * primero y con el acento, porque no es lo mismo que la página se vea a medio
 * hacer que un barbero que no aparece.
 */
export function PrimerosPasos({ estado }: { estado: EstadoDelLocal }) {
  const faltan = loQueFalta(estado);
  if (faltan.length === 0) return null;

  const total = primerosPasos(estado).length;
  const hechos = total - faltan.length;

  return (
    <section
      aria-labelledby="primeros-pasos"
      className="card mb-6 overflow-hidden"
    >
      <div className="border-b border-ink/10 px-5 py-4">
        <p className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">
          Primeros pasos
        </p>
        <h2
          id="primeros-pasos"
          className="mt-1 font-display text-xl leading-tight text-ink"
        >
          {tituloDeLaLista(faltan)}
        </h2>
        <p className="mt-1.5 text-sm text-muted">
          {hechos === 0
            ? `${total} cosas, y esto no aparece más.`
            : `Van ${hechos} de ${total}. Cuando estén las ${total}, esto no aparece más.`}
        </p>
      </div>

      <ul>
        {faltan.map((paso) => (
          <li key={paso.id} className="border-b border-ink/10 last:border-b-0">
            <Link
              href={paso.href}
              className="flex items-start gap-3 px-5 py-4 transition-colors duration-150 ease-out hover:bg-ink/[0.04] focus-visible:bg-ink/[0.04] focus-visible:outline-none active:bg-ink/[0.08]"
            >
              <span
                aria-hidden="true"
                className={[
                  "mt-1.5 size-2 shrink-0 rounded-full",
                  paso.bloquea ? "bg-accent" : "bg-ink/25",
                ].join(" ")}
              />

              <span className="min-w-0 flex-1">
                <span className="block font-medium text-ink">
                  {paso.titulo}
                </span>
                <span className="mt-0.5 block text-sm leading-relaxed text-muted">
                  {paso.porque}
                </span>
              </span>

              <span
                aria-hidden="true"
                className="mt-0.5 text-lg leading-none text-muted"
              >
                ›
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
