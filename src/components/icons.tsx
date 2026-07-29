/**
 * Iconos de línea.
 *
 * Dibujados a mano en vez de traer una librería: son cinco, pesan nada y así
 * todos comparten el mismo grosor de trazo y el mismo aire. Heredan el color
 * del texto, así que funcionan sobre crema y sobre negro sin variantes.
 *
 * Trazo fino y estilo outline, como pide la guía de marca.
 */

type Props = { className?: string };

const base = "shrink-0";
const svg = {
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.4,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

/** Duración. */
export function IconoReloj({ className = "size-4" }: Props) {
  return (
    <svg {...svg} className={`${base} ${className}`}>
      <circle cx="8" cy="8" r="6.2" />
      <path d="M8 4.6V8l2.4 1.6" />
    </svg>
  );
}

/** Precio. */
export function IconoEtiqueta({ className = "size-4" }: Props) {
  return (
    <svg {...svg} className={`${base} ${className}`}>
      <path d="M8.4 1.8H14v5.6l-6.6 6.6a1 1 0 0 1-1.4 0L1.8 9.4a1 1 0 0 1 0-1.4Z" />
      <circle cx="11.2" cy="4.8" r="1.05" />
    </svg>
  );
}

/** Barbero. */
export function IconoTijera({ className = "size-4" }: Props) {
  return (
    <svg {...svg} className={`${base} ${className}`}>
      <circle cx="4" cy="12" r="2.1" />
      <circle cx="12" cy="12" r="2.1" />
      <path d="M5.5 10.6 12.6 2M10.5 10.6 3.4 2" />
    </svg>
  );
}

/** Días y horarios de atención. */
export function IconoCalendario({ className = "size-4" }: Props) {
  return (
    <svg {...svg} className={`${base} ${className}`}>
      <rect x="1.9" y="3.2" width="12.2" height="10.9" rx="1.6" />
      <path d="M1.9 6.6h12.2M5.3 1.9v2.6M10.7 1.9v2.6" />
    </svg>
  );
}

/** Dónde queda. */
export function IconoUbicacion({ className = "size-4" }: Props) {
  return (
    <svg {...svg} className={`${base} ${className}`}>
      <path d="M13 6.8c0 3.3-5 8.2-5 8.2S3 10.1 3 6.8a5 5 0 0 1 10 0Z" />
      <circle cx="8" cy="6.7" r="1.8" />
    </svg>
  );
}

/**
 * Cualquiera del equipo.
 *
 * Dos personas, una apenas detrás de la otra: no es "nadie en particular",
 * es "cualquiera de estos". La de adelante va entera y la de atrás asomando,
 * que es lo que hace que se lea como grupo y no como una figura sola.
 */
export function IconoGrupo({ className = "size-4" }: Props) {
  return (
    <svg {...svg} className={`${base} ${className}`}>
      <circle cx="6.3" cy="5.6" r="2.5" />
      <path d="M1.9 13.6a4.4 4.4 0 0 1 8.8 0" />
      <path d="M10.6 3.5a2.5 2.5 0 0 1 1.3 4.5" />
      <path d="M12.4 9.7a4.4 4.4 0 0 1 1.7 3.5" />
    </svg>
  );
}

/** Agregar el turno al calendario del teléfono. */
export function IconoDescarga({ className = "size-4" }: Props) {
  return (
    <svg {...svg} className={`${base} ${className}`}>
      <path d="M8 2v8.2M4.9 7.3 8 10.4l3.1-3.1M2.6 12.4v.6a1.4 1.4 0 0 0 1.4 1.4h8a1.4 1.4 0 0 0 1.4-1.4v-.6" />
    </svg>
  );
}
