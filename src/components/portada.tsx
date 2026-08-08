import { Archivo_Black } from "next/font/google";
import Image from "next/image";

import { Funciones } from "./portada-funciones";
import { SLUG_DEMO } from "@/lib/demo";
import "../app/portada.css";

/**
 * La portada del producto: lo que se ve en el dominio pelado, sin subdominio.
 *
 * Empezó siendo una pantalla que explicaba qué es esto, porque lo que había
 * antes era el 404 de fábrica de Next, en inglés. Ahora tiene que vender: buena
 * parte de quien entra llega de un reel, sin saber que existís, y la página es
 * lo único que va a leer antes de decidir.
 *
 * De eso salen las decisiones de acá abajo:
 *
 *   · **Se muestra el producto, no dibujos del producto.** Una barbería de
 *     verdad incrustada y funcionando, y capturas sacadas del sitio en
 *     producción por `scripts/capturas.mts`. Una recreación en HTML se vería
 *     igual de bien y empezaría a mentir el día que cambie el panel.
 *   · **No lleva colores de ninguna barbería.** Es la cara del producto y tiene
 *     que distinguirse de la de cualquier cliente.
 *   · **No hay testimonios.** Con una sola barbería usándolo, inventar una
 *     reseña sería mentir, y decir "lo usan barberías" queda flojo. La prueba
 *     es la demo viva, que no depende de que nadie diga nada.
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

/** Cuánto dura la prueba. Un mes entero, para que llegue a cerrar una caja. */
const DIAS_DE_PRUEBA = 30;

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

/** Qué entra en el plan. Sin asteriscos ni "según el plan": hay uno solo. */
const INCLUYE = [
  "Tu página de reservas, con tu nombre, tu logo y tus colores",
  "Tu propia dirección web, para compartir por WhatsApp o poner en Instagram",
  "Todos los barberos y todos los servicios que tengas",
  "Cobros, cierre de caja y el reparto de cada barbero",
  "Catálogo de productos y pedidos, si vendés",
  "Confirmación por mail a cada cliente, automática",
  "Las mejoras que vayan saliendo, sin pagar de nuevo",
];

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
 *
 * Los botones abren en otra pestaña. En el celular el link entra derecho a
 * WhatsApp y no se nota, pero en una computadora sin WhatsApp instalado lleva a
 * una página que pide escanear un código: en la misma pestaña, eso se lleva
 * puesta la portada y hay que volver atrás para recuperarla.
 */
function destinoDeContacto(): string | null {
  const { whatsapp, mail } = comoContactar();

  if (whatsapp) {
    const texto = encodeURIComponent(
      "Hola, tengo una barbería y quiero probar el sistema de reservas.",
    );
    return `https://wa.me/${whatsapp}?text=${texto}`;
  }

  if (mail) {
    const asunto = encodeURIComponent("Quiero probarlo en mi barbería");
    return `mailto:${mail}?subject=${asunto}`;
  }

  return null;
}

/**
 * El precio, si está configurado.
 *
 * Se carga desde el entorno por lo mismo que el WhatsApp: cambiar un precio no
 * puede ser un cambio de código y un despliegue. Sin número, la sección no
 * inventa uno ni deja un hueco: invita a preguntarlo.
 */
function precioMensual(): string | null {
  const monto = Number(process.env.NEXT_PUBLIC_PRECIO_MENSUAL);
  if (!Number.isFinite(monto) || monto <= 0) return null;

  const moneda = process.env.NEXT_PUBLIC_PRECIO_MONEDA || "UYU";

  try {
    return new Intl.NumberFormat("es-UY", {
      style: "currency",
      currency: moneda,
      maximumFractionDigits: 0,
    }).format(monto);
  } catch {
    // Una moneda mal escrita no puede tumbar la portada entera.
    return `${monto} ${moneda}`;
  }
}

/** El botón de siempre, en sus dos tonos. */
function Boton({
  href,
  children,
  tono = "azul",
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  tono?: "azul" | "claro";
  className?: string;
}) {
  const base =
    "inline-flex items-center justify-center rounded-lg px-6 py-3.5 text-base " +
    "font-semibold transition-[background-color,transform] duration-150 " +
    "hover:-translate-y-px active:translate-y-0 ";

  const colores =
    tono === "azul"
      ? "bg-[color:var(--barbicide)] text-[color:var(--tiza)] " +
        "hover:bg-[color:var(--esmalte)] active:bg-[color:var(--esmalte)]"
      : "sobre-azul bg-[color:var(--tiza)] text-[color:var(--barbicide)] " +
        "hover:bg-[color:var(--porcelana)] active:bg-[color:var(--vidrio)]";

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      className={base + colores + " " + className}
    >
      {children}
    </a>
  );
}

export function Portada() {
  const { dominio, mail } = comoContactar();
  const contacto = destinoDeContacto();
  const precio = precioMensual();

  // El protocolo se deduce del dominio: en desarrollo la demo vive en
  // `demo.lvh.me:3000`, que no tiene certificado.
  const dominioCompleto = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "";
  const protocolo = dominioCompleto.includes("localhost") ||
    dominioCompleto.includes("lvh.me")
    ? "http"
    : "https";
  const urlDemo = `${protocolo}://${SLUG_DEMO}.${dominioCompleto}`;

  return (
    <div className={`portada ${cartel.variable} flex min-h-full flex-col`}>
      {/* ---- Encabezado ---------------------------------------------- */}
      <header className="mx-auto flex w-full max-w-5xl items-center gap-3 px-5 py-6 sm:px-8">
        <span className="pole-rule w-9 shrink-0 rounded-full" aria-hidden>
          <span />
        </span>
        <span className="font-[family-name:var(--font-cartel)] text-sm tracking-tight">
          {dominio}
        </span>
      </header>

      {/* ---- Lo primero que se ve ------------------------------------ */}
      <section className="mx-auto w-full max-w-5xl px-5 pb-16 pt-6 sm:px-8 sm:pt-12">
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
                className="entrar-portada mt-8 flex flex-wrap items-center gap-4"
                style={{ "--delay": "240ms" } as React.CSSProperties}
              >
                <Boton href={contacto}>
                  Probalo {DIAS_DE_PRUEBA} días gratis
                </Boton>
                <span className="text-sm text-[color:color-mix(in_oklab,var(--esmalte)_60%,transparent)]">
                  Sin tarjeta.
                </span>
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

      {/* ---- La demo viva -------------------------------------------- */}
      {/*
        Una barbería de verdad, funcionando, adentro de la página. Es la prueba
        que ningún texto reemplaza: el visitante elige un horario y ve que
        responde. Va acá y no arriba de todo porque tarda un momento en cargar,
        y no querés que lo primero que vea alguien sea un rectángulo en blanco.
      */}
      <section className="border-t border-[color:var(--vidrio)] bg-[color:var(--tiza)]">
        <div className="mx-auto w-full max-w-5xl px-5 py-14 sm:px-8 sm:py-16">
          <h2 className="font-[family-name:var(--font-cartel)] text-3xl leading-tight tracking-tight sm:text-4xl">
            Probala ahora, sin registrarte.
          </h2>
          <p className="mt-4 max-w-xl leading-relaxed text-[color:color-mix(in_oklab,var(--esmalte)_72%,transparent)]">
            Esto de acá abajo no es una foto: es una barbería de demostración
            funcionando de verdad. Elegí un servicio y un horario, como haría un
            cliente tuyo.
          </p>

          <div className="marco-demo mt-8">
            <iframe
              src={urlDemo}
              title="Barbería de demostración: página de reservas"
              loading="lazy"
            />
          </div>

          <p className="mt-3 text-sm text-[color:color-mix(in_oklab,var(--esmalte)_55%,transparent)]">
            Es una barbería de demostración. Se vacía todos los días, así que
            reservá tranquilo.
          </p>
        </div>
      </section>

      {/* ---- Qué resuelve -------------------------------------------- */}
      <section className="mx-auto w-full max-w-5xl px-5 py-14 sm:px-8 sm:py-20">
        <h2 className="font-[family-name:var(--font-cartel)] text-3xl leading-tight tracking-tight sm:text-4xl">
          Cuatro cosas que dejás de hacer.
        </h2>
        <p className="mt-4 max-w-xl leading-relaxed text-[color:color-mix(in_oklab,var(--esmalte)_72%,transparent)]">
          Tocá la que más te suene.
        </p>

        <div className="mt-10">
          <Funciones />
        </div>
      </section>

      {/* ---- Se ve con tu marca -------------------------------------- */}
      {/*
        La misma pantalla en dos barberías distintas. Es el argumento que menos
        se cree cuando se escribe y más se entiende cuando se ve: no es la misma
        página con otro nombre arriba.
      */}
      <section className="border-t border-[color:var(--vidrio)] bg-[color:var(--tiza)]">
        <div className="mx-auto w-full max-w-5xl px-5 py-14 sm:px-8 sm:py-16">
          <h2 className="font-[family-name:var(--font-cartel)] text-3xl leading-tight tracking-tight sm:text-4xl">
            Es tu barbería, no la mía.
          </h2>
          <p className="mt-4 max-w-2xl leading-relaxed text-[color:color-mix(in_oklab,var(--esmalte)_72%,transparent)]">
            Estas dos son la misma pantalla, de dos barberías distintas. Tu
            nombre, tu logo y tus colores; y tu propia dirección, del estilo{" "}
            <span className="whitespace-nowrap font-semibold text-[color:var(--esmalte)]">
              tubarberia.{dominio}
            </span>
            .
          </p>

          {/*
            Acotadas y centradas: dos teléfonos del mismo tamaño que los de las
            pestañas. A todo el ancho de la columna se veían enormes y rompían
            la escala del resto de la página.
          */}
          <div className="mx-auto mt-10 grid max-w-lg grid-cols-2 gap-5 sm:gap-10">
            {[
              {
                src: "/portada/marca-clara.png",
                alt: "La página de reservas de una barbería con marca clara y acento verde.",
                pie: "Una barbería clara",
              },
              {
                src: "/portada/marca-oscura.png",
                alt: "La misma pantalla en una barbería con marca oscura y acento ámbar.",
                pie: "Otra, oscura",
              },
            ].map((x) => (
              <figure key={x.src}>
                <div className="marco-telefono">
                  <Image
                    src={x.src}
                    alt={x.alt}
                    width={780}
                    height={1600}
                    className="block h-auto w-full"
                    sizes="(min-width: 640px) 260px, 45vw"
                  />
                </div>
                <figcaption className="mt-3 text-center text-sm text-[color:color-mix(in_oklab,var(--esmalte)_55%,transparent)]">
                  {x.pie}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ---- El precio ----------------------------------------------- */}
      <section className="bg-[color:var(--barbicide)] text-[color:var(--tiza)]">
        <div className="mx-auto w-full max-w-5xl px-5 py-14 sm:px-8 sm:py-20">
          <div className="grid gap-12 md:grid-cols-2 md:gap-16">
            <div>
              <h2 className="font-[family-name:var(--font-cartel)] text-3xl leading-tight tracking-tight sm:text-4xl">
                Un plan, todo adentro.
              </h2>

              <p className="mt-6 text-lg leading-relaxed text-[color:color-mix(in_oklab,var(--tiza)_82%,transparent)]">
                Los primeros{" "}
                <span className="font-semibold text-[color:var(--tiza)]">
                  {DIAS_DE_PRUEBA} días son gratis
                </span>
                , sin dejar una tarjeta. Un mes entero alcanza para llenar una
                agenda y cerrar cajas de verdad, que es cuando se ve si te sirve.
              </p>

              {precio ? (
                <p className="mt-8">
                  <span className="font-[family-name:var(--font-cartel)] text-5xl tracking-tight">
                    {precio}
                  </span>
                  <span className="ml-2 text-lg text-[color:color-mix(in_oklab,var(--tiza)_75%,transparent)]">
                    por mes
                  </span>
                </p>
              ) : (
                <p className="mt-8 text-lg text-[color:color-mix(in_oklab,var(--tiza)_75%,transparent)]">
                  Escribime y te paso el precio.
                </p>
              )}

              {contacto ? (
                <div className="mt-8">
                  <Boton href={contacto} tono="claro">
                    Empezar la prueba
                  </Boton>
                </div>
              ) : null}

              <p className="mt-4 text-sm text-[color:color-mix(in_oklab,var(--tiza)_70%,transparent)]">
                Te escribo, la dejamos andando el mismo día y te paso la
                dirección de tu barbería.
              </p>
            </div>

            <ul className="space-y-3">
              {INCLUYE.map((x) => (
                <li key={x} className="flex gap-3 leading-relaxed">
                  <span
                    aria-hidden
                    className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:color-mix(in_oklab,var(--tiza)_70%,transparent)]"
                  />
                  <span className="text-[color:color-mix(in_oklab,var(--tiza)_88%,transparent)]">
                    {x}
                  </span>
                </li>
              ))}
            </ul>
          </div>
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
