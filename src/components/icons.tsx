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

/**
 * WhatsApp.
 *
 * La burbuja con la cola y el tubo adentro. Dibujada en trazo como el resto:
 * el logo oficial es verde y sólido, y meterlo así en una página que se pinta
 * con los colores de cada barbería quedaría como un sticker pegado encima.
 * Se reconoce por la forma, que es lo que se lee a 20 píxeles.
 */
export function IconoWhatsApp({ className = "size-4" }: Props) {
  return (
    <svg {...svg} className={`${base} ${className}`}>
      <path d="M8 1.9a6.1 6.1 0 0 0-5.2 9.3l-.9 3 3.1-.8A6.1 6.1 0 1 0 8 1.9Z" />
      <path d="M6.1 5.6c.15-.3.35-.3.5-.3h.4c.15 0 .3.02.42.3l.42 1c.05.12.03.25-.04.36l-.24.35c-.07.1-.08.22-.01.33.26.42.74.9 1.16 1.16.11.07.23.06.33-.02l.35-.26c.1-.08.24-.1.35-.05l1 .42c.28.12.3.28.3.42v.4c0 .2-.02.4-.34.56-.25.12-.58.2-.9.16-.9-.12-1.9-.74-2.62-1.47-.73-.73-1.35-1.7-1.47-2.56-.05-.32.02-.65.16-.87Z" />
    </svg>
  );
}

/** Instagram. El cuadrado con el lente y el punto. */
export function IconoInstagram({ className = "size-4" }: Props) {
  return (
    <svg {...svg} className={`${base} ${className}`}>
      <rect x="2.2" y="2.2" width="11.6" height="11.6" rx="3.4" />
      <circle cx="8" cy="8" r="2.9" />
      <circle cx="11.4" cy="4.6" r="0.7" fill="currentColor" stroke="none" />
    </svg>
  );
}
