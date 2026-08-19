/**
 * El chat de WhatsApp como lo ve el barbero al tocar **Recordar**.
 *
 * ⚠️ **Dibujado por nosotros, no es una captura.** No lleva el logo ni ningún
 * material de WhatsApp: es un dibujo que se parece lo suficiente como para que
 * cualquiera lo reconozca sin que se lo expliquen, que es todo lo que hace
 * falta. Una captura de verdad sería material ajeno y además envejecería con
 * cada rediseño de la app.
 *
 * **El mensaje va en la caja de escribir, sin mandar, y eso no es un detalle
 * estético.** El link `wa.me` abre el chat con el texto ya tipeado y ahí se
 * frena: el que aprieta enviar es el barbero. Dibujarlo como un mensaje ya
 * enviado diría que el sistema le escribe solo a los clientes, que es
 * justamente lo que este producto NO hace y no puede hacer sin arriesgar el
 * número del local. El botón verde al lado del texto cuenta eso sin una línea
 * de explicación.
 *
 * Módulo neutral: lo usan la portada y la página del turno de la demo.
 */
export function ChatDeWhatsApp({
  contacto,
  mensaje,
}: {
  /** Cómo tiene guardado el barbero a esta persona. Llega como dato. */
  contacto: string;
  /** El recordatorio ya escrito, tal como sale de `mensajeDeRecordatorio`. */
  mensaje: string;
}) {
  const inicial = contacto.trim().charAt(0).toUpperCase() || "?";
  const lineas = mensaje.split("\n");

  return (
    <div className="chat">
      <div className="chat-barra">
        <svg viewBox="0 0 16 16" fill="none" aria-hidden className="chat-volver">
          <path
            d="M10 3 5 8l5 5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="chat-inicial" aria-hidden>
          {inicial}
        </span>
        <p className="chat-nombre">{contacto}</p>
      </div>

      {/* Vacío a propósito: es la primera vez que le escribe por este turno. */}
      <div className="chat-cuerpo">
        <span className="chat-dia">Hoy</span>
      </div>

      <div className="chat-escribir">
        <p className="chat-campo">
          {lineas.map((linea, i) => (
            <span key={i}>
              {linea}
              {/*
                El cursor es lo que dice "esto está tipeado y todavía no salió".
                Sin él, un globo blanco a la izquierda es, en WhatsApp de
                verdad, un mensaje RECIBIDO: se leería al revés, como si el
                cliente le hubiera escrito eso al barbero.
              */}
              {i === lineas.length - 1 ? (
                <i className="chat-cursor" aria-hidden />
              ) : null}
            </span>
          ))}
        </p>

        <span className="chat-mandar" aria-hidden>
          <svg viewBox="0 0 24 24" fill="currentColor" className="size-[18px]">
            <path d="M3.4 20.4 21.85 12.5a.5.5 0 0 0 0-.92L3.4 3.6a.5.5 0 0 0-.7.52l1.2 6.5c.04.22.22.39.44.42l9.1 1.1a.1.1 0 0 1 0 .2l-9.1 1.1a.55.55 0 0 0-.44.42l-1.2 6.5a.5.5 0 0 0 .7.52Z" />
          </svg>
        </span>
      </div>
    </div>
  );
}
