import { Archivo_Black } from "next/font/google";

import "../app/portada.css";

/**
 * La portada del producto: lo que se ve en el dominio pelado, sin subdominio.
 *
 * Hasta acá, `turnosforbarber.com` sin barbería devolvía el 404 de fábrica de
 * Next —en inglés y con la tipografía por defecto—. Funcionalmente correcto,
 * porque no hay ninguna barbería que mostrar, pero es la primera pantalla que
 * ve un dueño que escribe el dominio para saber qué le están vendiendo.
 *
 * No lleva colores de ninguna barbería a propósito. Es la cara del producto y
 * tiene que distinguirse de la de cualquier cliente.
 */

// Pesada y ancha, como letra pintada en un cartel de barbería. Se carga acá y
// no en el layout para que no viaje en las páginas de las barberías, que usan
// la tipografía de su propia marca.
const cartel = Archivo_Black({
  variable: "--font-cartel",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

/**
 * Un martes cualquiera.
 *
 * Ilustrativo, no son datos de nadie: nombres con la inicial del apellido,
 * como se anotan en un cuaderno de verdad. Los dos huecos libres están puestos
 * a propósito —una agenda llena al 100% no se parece a ninguna real, y además
 * el hueco es lo que el cliente viene a buscar—.
 */
const DIA = [
  { hora: "09:00", quien: "Martín R.", que: "Corte" },
  { hora: "09:40", quien: "Diego S.", que: "Corte y barba" },
  { hora: "10:20", quien: null, que: null },
  { hora: "11:00", quien: "Nicolás P.", que: "Corte" },
  { hora: "11:40", quien: "Rodrigo A.", que: "Barba" },
  { hora: "12:20", quien: null, que: null },
  { hora: "13:00", quien: "Federico M.", que: "Corte y barba" },
] as const;

/**
 * Cómo se pide. Todo sale del entorno: acá no se escribe ningún dominio.
 *
 * El puerto se saca porque en desarrollo la variable vale `lvh.me:3000`, y de
 * ahí salían un `hola@lvh.me:3000` que no es una dirección de correo y un
 * `tubarberia.lvh.me:3000` que no es lo que alguien va a escribir. En
 * producción no hay puerto y no se notaría nunca: el error viviría hasta que
 * alguien mirara la portada en su máquina.
 *
 * El mail no se deduce del dominio. Antes, sin `NEXT_PUBLIC_CONTACT_EMAIL`, la
 * portada mostraba `hola@<dominio>` —una dirección que suena razonable y que
 * puede no existir—. Alguien escribía ahí, creía haber avisado, y el mensaje
 * se perdía. Una casilla se muestra cuando alguien la lee, y eso no se puede
 * adivinar desde el código: o está configurada, o no se ofrece.
 */
function comoContactar() {
  const dominio = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "").split(":")[0];
  const whatsapp = process.env.NEXT_PUBLIC_CONTACT_WHATSAPP?.replace(/\D/g, "");
  const mail = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "";

  return { dominio, whatsapp, mail };
}

/**
 * A dónde lleva el botón de pedirlo.
 *
 * WhatsApp primero si hay número: un dueño de barbería en Uruguay escribe por
 * WhatsApp, no manda un mail. El mail queda como alternativa y no como opción
 * de igual peso. Si no hay ninguno de los dos, no hay botón: una llamada a la
 * acción que no lleva a ningún lado es peor que ninguna.
 */
function destinoDeContacto(): string | null {
  const { whatsapp, mail } = comoContactar();

  if (whatsapp) {
    const texto = encodeURIComponent(
      "Hola, tengo una barbería y quiero ver cómo funciona.",
    );
    return `https://wa.me/${whatsapp}?text=${texto}`;
  }

  if (mail) {
    const asunto = encodeURIComponent("Quiero verlo para mi barbería");
    return `mailto:${mail}?subject=${asunto}`;
  }

  return null;
}

export function Portada() {
  const { dominio, mail } = comoContactar();
  const contacto = destinoDeContacto();

  return (
    <div className={`portada ${cartel.variable} flex min-h-full flex-col`}>
      {/* ---- Encabezado ---------------------------------------------- */}
      <header className="mx-auto flex w-full max-w-5xl items-center gap-3 px-5 py-6 sm:px-8">
        <span className="pole-rule w-9 shrink-0 rounded-full" aria-hidden>
          <span />
        </span>
        <span
          className="font-[family-name:var(--font-cartel)] text-sm tracking-tight"
          // El nombre del producto es su dominio, y el dominio es un dato del
          // entorno. Escribirlo acá sería clavarlo en el código.
        >
          {dominio}
        </span>
      </header>

      {/* ---- Lo primero que se ve ------------------------------------ */}
      <section className="mx-auto w-full max-w-5xl grow px-5 pb-16 pt-6 sm:px-8 sm:pt-12">
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_20rem] lg:gap-16">
          <div>
            <p
              className="entrar-portada text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--barbicide)]"
              style={{ "--delay": "0ms" } as React.CSSProperties}
            >
              Reservas para barberías
            </p>

            <h1
              className="entrar-portada mt-4 font-[family-name:var(--font-cartel)] text-4xl leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl"
              style={{ "--delay": "80ms" } as React.CSSProperties}
            >
              Tu agenda, abierta cuando la barbería está cerrada.
            </h1>

            <p
              className="entrar-portada mt-6 max-w-xl text-lg leading-relaxed text-[color:color-mix(in_oklab,var(--esmalte)_72%,transparent)]"
              style={{ "--delay": "160ms" } as React.CSSProperties}
            >
              Tus clientes eligen servicio, barbero y hora desde el teléfono, a
              cualquier hora del día. Vos abrís el panel y el día ya está armado.
            </p>

            {contacto ? (
              <div
                className="entrar-portada mt-8"
                style={{ "--delay": "240ms" } as React.CSSProperties}
              >
                <a
                  href={contacto}
                  className="inline-flex items-center justify-center rounded-lg bg-[color:var(--barbicide)] px-6 py-3.5 text-base font-semibold text-[color:var(--tiza)] transition-[background-color,transform] duration-150 hover:-translate-y-px hover:bg-[color:var(--esmalte)] active:translate-y-0 active:bg-[color:var(--esmalte)]"
                >
                  Pedir una demostración
                </a>
              </div>
            ) : null}
          </div>

          {/* El cuaderno. Es la pieza que tiene que quedar. */}
          <div className="cuaderno overflow-hidden p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:color-mix(in_oklab,var(--esmalte)_50%,transparent)]">
              Un martes cualquiera
            </p>

            <ul className="mt-4">
              {DIA.map((t, i) => (
                <li
                  key={t.hora}
                  className="renglon escribir flex items-baseline gap-4 py-2.5"
                  style={{ "--i": i } as React.CSSProperties}
                >
                  <span className="tabular w-12 shrink-0 text-sm text-[color:color-mix(in_oklab,var(--esmalte)_55%,transparent)]">
                    {t.hora}
                  </span>

                  {t.quien ? (
                    <span className="min-w-0">
                      <span className="block truncate text-[0.9375rem] font-semibold">
                        {t.quien}
                      </span>
                      <span className="block text-xs text-[color:color-mix(in_oklab,var(--esmalte)_55%,transparent)]">
                        {t.que}
                      </span>
                    </span>
                  ) : (
                    <span className="text-[0.9375rem] text-[color:var(--vidrio)]">
                      libre
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ---- Las dos caras ------------------------------------------- */}
      {/*
        Dos bloques y no tres: el producto tiene exactamente dos superficies,
        la página del cliente y el panel. Eso es verdad sobre cómo está hecho,
        no una lista de ventajas inventada para llenar una fila de tres.
      */}
      <section className="border-t border-[color:var(--vidrio)] bg-[color:var(--tiza)]">
        <div className="mx-auto grid w-full max-w-5xl gap-10 px-5 py-14 sm:px-8 sm:py-16 md:grid-cols-2 md:gap-14">
          <div>
            <h2 className="font-[family-name:var(--font-cartel)] text-2xl tracking-tight">
              Lo que ve tu cliente
            </h2>
            <p className="mt-3 leading-relaxed text-[color:color-mix(in_oklab,var(--esmalte)_72%,transparent)]">
              Una página con el nombre, el logo y los colores de tu barbería.
              Elige el servicio, con quién se quiere atender y a qué hora, entre
              los horarios que realmente tenés libres. Sin crear una cuenta y sin
              bajar ninguna aplicación. La confirmación le llega por mail.
            </p>
          </div>

          <div>
            <h2 className="font-[family-name:var(--font-cartel)] text-2xl tracking-tight">
              Lo que ves vos
            </h2>
            <p className="mt-3 leading-relaxed text-[color:color-mix(in_oklab,var(--esmalte)_72%,transparent)]">
              El día entero apenas entrás. Cobrás, cerrás la caja y sabés cuánto
              le toca a cada uno sin sacar la cuenta a mano. Los servicios, los
              precios, los horarios y el equipo los cargás vos, cuando querés,
              sin pedirle nada a nadie.
            </p>
          </div>
        </div>
      </section>

      {/* ---- Cómo se consigue ---------------------------------------- */}
      <section className="bg-[color:var(--barbicide)] text-[color:var(--tiza)]">
        <div className="mx-auto w-full max-w-5xl px-5 py-14 sm:px-8 sm:py-16">
          <h2 className="font-[family-name:var(--font-cartel)] text-3xl leading-tight tracking-tight sm:text-4xl">
            Cada barbería tiene su propia dirección.
          </h2>

          <p className="mt-4 max-w-xl leading-relaxed text-[color:color-mix(in_oklab,var(--tiza)_82%,transparent)]">
            La tuya sería{" "}
            <span className="whitespace-nowrap font-semibold text-[color:var(--tiza)]">
              tubarberia.{dominio}
            </span>
            . La compartís por WhatsApp o la ponés en tu perfil de Instagram, y
            tus clientes reservan solos.
          </p>

          {contacto ? (
            <a
              href={contacto}
              className="sobre-azul mt-8 inline-flex items-center justify-center rounded-lg bg-[color:var(--tiza)] px-6 py-3.5 text-base font-semibold text-[color:var(--barbicide)] transition-[background-color,transform] duration-150 hover:-translate-y-px hover:bg-[color:var(--porcelana)] active:translate-y-0 active:bg-[color:var(--vidrio)]"
            >
              Escribime y lo vemos
            </a>
          ) : null}
        </div>
      </section>

      {/* ---- Pie ------------------------------------------------------ */}
      <footer className="border-t border-[color:var(--vidrio)] px-5 py-8 sm:px-8">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 text-sm text-[color:color-mix(in_oklab,var(--esmalte)_60%,transparent)]">
          <span>{dominio}</span>
          {mail ? (
            <a
              href={`mailto:${mail}`}
              className="rounded transition-colors duration-150 hover:text-[color:var(--barbicide)] active:text-[color:var(--esmalte)]"
            >
              {mail}
            </a>
          ) : null}
        </div>
      </footer>
    </div>
  );
}
