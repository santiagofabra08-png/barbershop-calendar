import { Archivo_Black } from "next/font/google";
import Image from "next/image";

import { Demo } from "./portada-demo";
import { Funciones } from "./portada-funciones";
import { Registro } from "./portada-registro";
import { SLUG_DEMO, protocoloDe } from "@/lib/demo";
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

/**
 * Qué entra en el plan. Hay uno solo, así que no hay asteriscos ni "según el
 * plan": todo lo de esta lista lo tiene cualquiera que pague.
 *
 * ⚠️ Acá va **solo lo que existe hoy**. Es tentador copiar la lista de un
 * competidor y sumar cosas que suenan bien —proyecciones, alertas, tasa de
 * ausentismo—, y es la forma más rápida de que alguien pague, no lo encuentre,
 * pida la baja el primer mes y encima lo cuente. En un rubro donde todos se
 * conocen, eso cuesta más que las bajas.
 *
 * Al agregar una función al producto, sumarla acá. Al sacarla, sacarla acá.
 */
const INCLUYE: { grupo: string; puntos: string[] }[] = [
  {
    grupo: "Tu página de reservas",
    puntos: [
      "Reservas a cualquier hora, sin que el cliente se cree una cuenta",
      "Tu nombre, tu logo y tus colores",
      "Tu propia dirección, del estilo tubarberia.turnos…",
      "Confirmación por mail automática a cada cliente",
      "El cliente cancela solo, con su link, y el horario se libera",
    ],
  },
  {
    // Va segundo, apenas después de la página que ve el cliente, porque es la
    // respuesta a la duda que más frena a un dueño: "¿y después dependo de vos
    // para cambiar un precio?". No: entra y lo cambia.
    grupo: "Tu panel, y lo manejás vos",
    puntos: [
      "Tu propio panel, con tu cuenta y una para cada barbero",
      "Cambiás precios, servicios y horarios cuando querés, sin pedirle nada a nadie",
      "Subís tu logo y elegís tus colores desde ahí mismo",
      "Cada barbero entra y ve lo suyo; vos ves todo el local",
    ],
  },
  {
    grupo: "Tu agenda",
    puntos: [
      "Todos los barberos que tengas, cada uno con su horario",
      "Cargar turnos a mano y bloquear ratos o días libres",
      "Recordatorio por WhatsApp con un toque, desde la agenda",
      "Nadie se pisa: dos personas no pueden tomar la misma hora",
    ],
  },
  {
    grupo: "La plata",
    puntos: [
      "Cobrás el turno con los productos que se llevó y el medio de pago",
      "Cierre de caja del día, con lo que tendría que haber",
      "El reparto de cada barbero: comisión, sueldo o alquiler de silla",
      "Resumen de la semana y del mes",
    ],
  },
  {
    grupo: "Tus productos",
    puntos: [
      "Catálogo público con fotos",
      "Pedidos desde la web, que te avisan por mail",
      "Stock que se descuenta cuando vendés",
    ],
  },
  {
    grupo: "Y además",
    puntos: [
      "Funciona igual en el celular y en la computadora, sin instalar nada",
      "Los datos de tu barbería son solo tuyos",
      "Las mejoras que salgan, sin pagar de nuevo",
    ],
  },
];

/** Las secciones a las que se puede saltar desde arriba. */
const SECCIONES = [
  { id: "demo", texto: "Probala" },
  { id: "funciones", texto: "Qué hace" },
  { id: "precio", texto: "Precio" },
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
function formatearMoneda(valor: number, moneda: string, decimales: number): string {
  try {
    return new Intl.NumberFormat("es-UY", {
      style: "currency",
      currency: moneda,
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales,
    }).format(valor);
  } catch {
    // Una moneda mal escrita no puede tumbar la portada entera.
    return `${valor.toFixed(decimales)} ${moneda}`;
  }
}

function precioMensual(): { mes: string; dia: string; otraMoneda: string | null } | null {
  const monto = Number(process.env.NEXT_PUBLIC_PRECIO_MENSUAL);
  if (!Number.isFinite(monto) || monto <= 0) return null;

  const moneda = process.env.NEXT_PUBLIC_PRECIO_MONEDA || "UYU";

  // Los centavos se muestran solo si los hay: 14,99 se escribe entero, pero
  // 990 no tiene por qué volverse "990,00".
  const conCentavos = (n: number) => (Number.isInteger(n) ? 0 : 2);

  /**
   * El mismo precio en la moneda de acá, si está cargado.
   *
   * Se escribe a mano y NO se convierte con una cotización. Una cotización
   * queda vieja sola, y el día que se mueve la página pasa a mostrar un precio
   * que no es el que vas a cobrar —y nadie se entera hasta que un cliente lo
   * reclama—. Escribiendo los dos números, el que decide cuánto sale sos vos.
   */
  const montoAlt = Number(process.env.NEXT_PUBLIC_PRECIO_MENSUAL_ALT);
  const monedaAlt = process.env.NEXT_PUBLIC_PRECIO_MONEDA_ALT || "UYU";
  const hayAlt = Number.isFinite(montoAlt) && montoAlt > 0;

  return {
    mes: formatearMoneda(monto, moneda, conCentavos(monto)),
    // Lo mismo dividido por treinta. Un precio mensual se compara con otro
    // gasto mensual; por día se compara con un café, y es la forma en que la
    // gente decide si algo es caro.
    dia: formatearMoneda(monto / 30, moneda, 2),
    otraMoneda: hayAlt
      ? formatearMoneda(montoAlt, monedaAlt, conCentavos(montoAlt))
      : null,
  };
}

export function Portada() {
  const { dominio, mail } = comoContactar();
  const contacto = destinoDeContacto();
  const precio = precioMensual();

  // El protocolo lo decide `protocoloDe`, que ahora también necesita la
  // página del turno para saber a qué origen puede hablarle.
  const dominioCompleto = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "";
  const urlDemo = `${protocoloDe(dominioCompleto)}://${SLUG_DEMO}.${dominioCompleto}`;

  return (
    <div className={`portada ${cartel.variable} flex min-h-full flex-col`}>
      {/* ---- Encabezado ---------------------------------------------- */}
      {/*
        Se queda arriba al bajar. En una página larga, el botón de arrancar la
        prueba tiene que estar siempre a un toque: si alguien se convence en la
        mitad del precio, no tiene por qué scrollear a buscar dónde se pide.

        El fondo va translúcido con desenfoque para que el contenido se lea
        pasando por debajo en vez de cortarse contra una franja opaca.
      */}
      <header className="barra-fija">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-5 py-4 sm:px-8">
          <a
            href="#arriba"
            className="flex items-center gap-3 rounded transition-opacity duration-150 hover:opacity-70"
          >
            <span className="pole-rule w-9 shrink-0 rounded-full" aria-hidden>
              <span />
            </span>
            <span className="font-[family-name:var(--font-cartel)] text-sm tracking-tight">
              {dominio}
            </span>
          </a>

          <nav className="ml-auto flex items-center gap-1 sm:gap-2">
            {/* Los anclas se esconden en pantallas chicas: tres links y un
                botón no entran en un teléfono sin apretarse. El botón sí
                queda, porque es el único que tiene que estar siempre. */}
            {SECCIONES.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-[color:color-mix(in_oklab,var(--esmalte)_65%,transparent)] transition-colors duration-150 hover:text-[color:var(--esmalte)] active:text-[color:var(--barbicide)] sm:block"
              >
                {s.texto}
              </a>
            ))}

            <a
              href="#empezar"
              className="rounded-lg bg-[color:var(--barbicide)] px-4 py-2.5 text-sm font-semibold text-[color:var(--tiza)] transition-[background-color,transform] duration-150 hover:-translate-y-px hover:bg-[color:var(--esmalte)] active:translate-y-0"
            >
              Probar gratis
            </a>
          </nav>
        </div>
      </header>

      <span id="arriba" />

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

            {/*
              El reflejo va en un `span` de adentro y no en el `h1`. Los dos
              usan `animation`, y dos clases declarando la misma propiedad
              sobre el mismo elemento se pisan: ganaba la que estuviera más
              abajo en la hoja y el reflejo no se veía nunca. En elementos
              distintos, cada animación es de su dueño.
            */}
            <h1
              className="entrar-portada mt-4 font-[family-name:var(--font-cartel)] text-4xl leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl"
              style={{ "--delay": "80ms" } as React.CSSProperties}
            >
              <span className="reflejo">
                Tu agenda, abierta cuando la barbería está cerrada.
              </span>
            </h1>

            <p
              className="entrar-portada mt-6 max-w-xl text-lg leading-relaxed text-[color:color-mix(in_oklab,var(--esmalte)_72%,transparent)]"
              style={{ "--delay": "160ms" } as React.CSSProperties}
            >
              Tus clientes eligen servicio, barbero y hora desde el teléfono, a
              cualquier hora del día. Vos abrís el panel y el día ya está armado.
            </p>

            {/*
              Lleva al formulario de más abajo y no a WhatsApp. Escribirle por
              WhatsApp a un desconocido es un paso que mucha gente no da, y en
              tráfico frío desde Instagram eso es la mayoría. El WhatsApp sigue
              existiendo, al lado del formulario, para el que lo prefiera.
            */}
            <div
              className="entrar-portada mt-8 flex flex-wrap items-center gap-4"
              style={{ "--delay": "240ms" } as React.CSSProperties}
            >
              <a
                href="#empezar"
                className="inline-flex items-center justify-center rounded-lg bg-[color:var(--barbicide)] px-6 py-3.5 text-base font-semibold text-[color:var(--tiza)] transition-[background-color,transform] duration-150 hover:-translate-y-px hover:bg-[color:var(--esmalte)] active:translate-y-0 active:bg-[color:var(--esmalte)]"
              >
                Probalo {DIAS_DE_PRUEBA} días gratis
              </a>
              <span className="text-sm text-[color:color-mix(in_oklab,var(--esmalte)_60%,transparent)]">
                Sin tarjeta.
              </span>
            </div>
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
      <section
        id="demo"
        className="al-entrar scroll-mt-20 border-t border-[color:var(--vidrio)] bg-[color:var(--tiza)]"
      >
        {/*
          El texto arriba y el marco abajo, y no al costado como antes: el
          marco ahora cambia de ancho con el conmutador, y una columna fija de
          23rem no le sirve al modo computadora.
        */}
        <div className="mx-auto w-full max-w-5xl px-5 py-14 sm:px-8 sm:py-16">
          <div className="max-w-2xl">
            <h2 className="font-[family-name:var(--font-cartel)] text-3xl leading-tight tracking-tight sm:text-4xl">
              Probala ahora, sin registrarte.
            </h2>
            <p className="mt-4 leading-relaxed text-[color:color-mix(in_oklab,var(--esmalte)_72%,transparent)]">
              Esto no es una foto: es una barbería de demostración funcionando
              de verdad, acá adentro. Elegí un servicio y un horario, como haría
              un cliente tuyo. Y cambiá de aparato para ver cómo se acomoda
              sola.
            </p>
            {/*
              Que el mail llega ya era verdad: la demo es una barbería más y la
              reserva dispara la confirmación como en cualquier otra. Lo que no
              estaba era dicho, y una función que nadie sabe que existe no
              existe. Es la forma más barata que hay de que el visitante vea el
              producto funcionando en su propia bandeja de entrada.
            */}
            <p className="mt-4 text-sm text-[color:color-mix(in_oklab,var(--esmalte)_55%,transparent)]">
              Poné tu mail de verdad: te va a llegar la confirmación, la misma
              que va a recibir tu cliente. Se vacía todos los días, así que
              reservá tranquilo.
            </p>
          </div>

          <div className="mt-8">
            <Demo url={urlDemo} dominio={dominio} />
          </div>
        </div>
      </section>

      {/* ---- Qué resuelve -------------------------------------------- */}
      <section
        id="funciones"
        className="al-entrar mx-auto w-full max-w-5xl scroll-mt-20 px-5 py-14 sm:px-8 sm:py-20"
      >
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
      <section className="al-entrar border-t border-[color:var(--vidrio)] bg-[color:var(--tiza)]">
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
                    width={1170}
                    height={2400}
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
      <section
        id="precio"
        className="al-entrar scroll-mt-20 bg-[color:var(--barbicide)] text-[color:var(--tiza)]"
      >
        <div className="mx-auto w-full max-w-5xl px-5 py-14 sm:px-8 sm:py-20">
          <div className="grid gap-12 md:grid-cols-[19rem_1fr] md:gap-16">
            {/* La columna del precio se queda quieta mientras se recorre la
                lista: la pregunta "¿y cuánto sale?" no se puede perder de
                vista mientras se lee todo lo que entra. */}
            <div className="md:sticky md:top-24 md:self-start">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:color-mix(in_oklab,var(--tiza)_70%,transparent)]">
                Un plan, todo adentro
              </p>

              {precio ? (
                <>
                  <p className="mt-5 flex items-baseline gap-2">
                    <span className="font-[family-name:var(--font-cartel)] text-5xl leading-none tracking-tight">
                      {precio.mes}
                    </span>
                    <span className="text-lg text-[color:color-mix(in_oklab,var(--tiza)_75%,transparent)]">
                      /mes
                    </span>
                  </p>
                  <p className="mt-2 text-sm text-[color:color-mix(in_oklab,var(--tiza)_70%,transparent)]">
                    Son {precio.dia} por día
                    {precio.otraMoneda ? (
                      <>
                        {" · unos "}
                        <span className="whitespace-nowrap">
                          {precio.otraMoneda}
                        </span>{" "}
                        por mes
                      </>
                    ) : null}
                    .
                  </p>
                </>
              ) : (
                <p className="mt-5 font-[family-name:var(--font-cartel)] text-3xl leading-tight tracking-tight">
                  Escribime y te paso el precio.
                </p>
              )}

              <p className="mt-6 inline-block rounded-full border border-[color:color-mix(in_oklab,var(--tiza)_45%,transparent)] px-4 py-1.5 text-sm font-semibold">
                {DIAS_DE_PRUEBA} días gratis para probar
              </p>

              <p className="mt-6 leading-relaxed text-[color:color-mix(in_oklab,var(--tiza)_82%,transparent)]">
                Sin dejar una tarjeta. Un mes entero alcanza para llenar una
                agenda y cerrar cajas de verdad, que es cuando se ve si te
                sirve.
              </p>

              <div className="mt-8">
                <a
                  href="#empezar"
                  className="sobre-azul inline-flex items-center justify-center rounded-lg bg-[color:var(--tiza)] px-6 py-3.5 text-base font-semibold text-[color:var(--barbicide)] transition-[background-color,transform] duration-150 hover:-translate-y-px hover:bg-[color:var(--porcelana)] active:translate-y-0 active:bg-[color:var(--vidrio)]"
                >
                  Probar gratis {DIAS_DE_PRUEBA} días →
                </a>
              </div>
            </div>

            {/* Agrupada, no una tirada de veinte renglones: agrupada se puede
                barrer con la vista y encontrar lo que a cada uno le importa. */}
            <div className="escalonado grid gap-8 sm:grid-cols-2">
              {INCLUYE.map((g) => (
                <div key={g.grupo}>
                  <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:color-mix(in_oklab,var(--tiza)_65%,transparent)]">
                    {g.grupo}
                  </h3>
                  <ul className="mt-3 space-y-2.5">
                    {g.puntos.map((p) => (
                      <li key={p} className="flex gap-2.5 leading-relaxed">
                        <span
                          aria-hidden
                          className="mt-1 shrink-0 text-[color:color-mix(in_oklab,var(--tiza)_75%,transparent)]"
                        >
                          ✓
                        </span>
                        <span className="text-[0.9375rem] text-[color:color-mix(in_oklab,var(--tiza)_88%,transparent)]">
                          {p}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---- Dejar los datos ----------------------------------------- */}
      {/*
        El formulario reemplaza al botón que abría WhatsApp directo. WhatsApp
        sigue estando abajo, para el que lo prefiera: no todo el mundo quiere
        escribirle a un desconocido, y no todo el mundo quiere llenar un
        formulario. Ofrecer los dos cuesta poco.
      */}
      <section id="empezar" className="al-entrar scroll-mt-20">
        <div className="mx-auto w-full max-w-2xl px-5 py-14 sm:px-8 sm:py-20">
          <h2 className="text-center font-[family-name:var(--font-cartel)] text-3xl leading-tight tracking-tight sm:text-4xl">
            Empezá los {DIAS_DE_PRUEBA} días.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-center leading-relaxed text-[color:color-mix(in_oklab,var(--esmalte)_72%,transparent)]">
            Dejame estos datos y te escribo hoy. La dejamos andando en un rato y
            te paso la dirección de tu barbería para que la compartas.
          </p>

          <div className="mt-10">
            <Registro dias={DIAS_DE_PRUEBA} />
          </div>

          {contacto ? (
            <p className="mt-8 text-center text-sm text-[color:color-mix(in_oklab,var(--esmalte)_60%,transparent)]">
              ¿Preferís escribirme?{" "}
              <a
                href={contacto}
                target="_blank"
                rel="noopener"
                className="font-semibold text-[color:var(--barbicide)] underline decoration-[color:color-mix(in_oklab,var(--barbicide)_40%,transparent)] underline-offset-4 transition-colors duration-150 hover:text-[color:var(--esmalte)]"
              >
                Mandame un WhatsApp
              </a>
              .
            </p>
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
