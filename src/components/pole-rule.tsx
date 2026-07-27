/**
 * El poste de barbero, desenrollado en una línea.
 *
 * Aparece una sola vez por página. Es el único adorno de todo el diseño: el
 * resto del peso visual lo llevan la tipografía y el espacio.
 */
export function PoleRule({
  className = "",
  unroll = false,
}: {
  className?: string;
  /** Se desenrolla al entrar. Para la pantalla de confirmación. */
  unroll?: boolean;
}) {
  return (
    <div
      className={`pole-rule ${unroll ? "unroll" : ""} ${className}`}
      aria-hidden="true"
    >
      <span />
    </div>
  );
}
