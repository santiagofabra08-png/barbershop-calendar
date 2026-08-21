import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Ledger } from "@/app/panel/ledger";
import { ChatDeWhatsApp } from "@/components/chat-whatsapp";
import { LINK, MarcoDelDetras, Nota, Pantalla } from "@/components/detras/marco";
import { barberiaDelDetras } from "@/lib/detras/barberia";
import {
  AHORA_DE_EJEMPLO,
  jornadaDeEjemplo,
  nombresDeEjemplo,
} from "@/lib/detras/jornada";
import { TenantTheme } from "@/components/tenant-theme";
import { urlDeLaPortada } from "@/lib/demo";
import { formatDateLong, nowInTimeZone } from "@/lib/schedule";
import { mensajeDeRecordatorio } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "El panel por dentro",
  description:
    "La pantalla que ve el barbero: la agenda del día, el mensaje ya escrito y la guía entera.",
  // Es material de venta que vive en el dominio de una barbería. Que lo
  // encuentre quien llega por el link, no quien busca esa barbería en Google.
  robots: { index: false, follow: false },
};

/**
 * El panel visto desde afuera, sin cuenta.
 *
 * **Qué es y qué no.** Es la interfaz de verdad del panel, con datos
 * inventados, en una página pública sin sesión y sin ninguna acción conectada.
 * No son capturas muertas: la agenda de acá abajo es el mismo componente que
 * dibuja la agenda de una barbería que paga, con las mismas clases y el mismo
 * comportamiento en el celular.
 *
 * **Por qué no se puede escribir nada.** No porque los botones estén
 * deshabilitados: deshabilitar un botón no bloquea nada, las Server Actions
 * son direcciones a las que se puede mandar un POST sin pasar por la pantalla.
 * Acá no hay con qué escribir. Sin sesión no hay a quién atribuirle una
 * escritura, y sin `action` en los formularios no hay a dónde mandarla. El
 * bloqueo no es una regla que haya que acordarse de poner, es la ausencia de
 * la maquinaria.
 *
 * Eso fue lo que descartó la primera idea, que era abrirle el panel de la demo
 * a cualquiera: quien entra ahí puede cambiarle el nombre a la barbería y
 * subir fotos, o sea publicar lo que quiera en una página del dominio y pasar
 * el link. Un límite por IP no frena eso: con una vez alcanza.
 */
export default async function DetrasDeEscenaPage() {
  const tenant = await barberiaDelDetras();
  if (!tenant) notFound();

  const raiz = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "";
  const portada = urlDeLaPortada(raiz);

  // El día de ejemplo se dibuja siempre como "hoy": una agenda fechada la
  // semana pasada dice que esto no se usa.
  const hoy = nowInTimeZone(tenant.timezone).date;
  const turnos = jornadaDeEjemplo(hoy);

  // El mensaje del último turno del día, que es el que todavía no empezó y por
  // eso lleva el botón Recordar. Sale de la misma función que usa el panel: un
  // ejemplo escrito a mano se vería igual hoy y empezaría a mentir el día que
  // el mensaje cambie.
  const proximo = turnos[turnos.length - 1];
  const recordatorio = mensajeDeRecordatorio({
    barberia: tenant.name,
    cliente: proximo.clientName,
    servicio: proximo.serviceName,
    fecha: proximo.dateLocal,
    hora: proximo.startLocal,
    hoy,
  });

  return (
    <>
      <TenantTheme tenant={tenant} />

      <MarcoDelDetras urlPortada={portada}>
        <p className="text-xs font-semibold tracking-[0.18em] text-[color:var(--barbicide)] uppercase">
          Detrás de escena
        </p>
        <h1 className="titulo-producto mt-3 text-3xl leading-tight sm:text-4xl">
          Del otro lado del mostrador
        </h1>
        <p className="mt-4 max-w-2xl leading-relaxed text-[color:color-mix(in_oklab,var(--esmalte)_72%,transparent)]">
          Ya viste lo que ve tu cliente. Esto es lo que ves vos: la pantalla que
          abrís a la mañana. Es la de verdad, con un día inventado adentro, y
          acá no se puede tocar nada.
        </p>

        {/* ---- La agenda, viva ---------------------------------------- */}

        <section className="mt-14 grid gap-8 lg:grid-cols-[20rem_1fr] lg:items-start lg:gap-12">
          <Nota rotulo="Agenda" titulo="El día, ya armado" pegada>
            <p>
              Los turnos cuelgan de una línea con la hora al costado, igual que
              en la agenda de papel que hay abajo del mostrador. Nadie los
              anotó: entraron solos, mientras estabas cortando.
            </p>
            <p>
              <strong className="font-semibold text-[color:var(--esmalte)]">
                Los ratos libres están escritos.
              </strong>{" "}
              Un hueco de una hora a las cuatro no es un espacio en blanco: es
              cuando podés comer, o meter al que llame.
            </p>
            <p>
              El que entra por la puerta sin reservar se carga a mano y queda
              marcado como tal, así el recuento de la semana no le queda corto.
            </p>
          </Nota>

          <Pantalla>
            <p className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">
              Hoy
            </p>
            <h3 className="mt-1 font-display text-2xl leading-tight text-ink sm:text-3xl">
              {formatDateLong(hoy)}
            </h3>

            <Ledger
              turnos={turnos}
              tenant={tenant}
              ahora={AHORA_DE_EJEMPLO}
              hoy={hoy}
              diaPasado={false}
              nombrePorBarbero={nombresDeEjemplo()}
              soloLectura
            />
          </Pantalla>
        </section>

        {/* ---- El recordatorio ---------------------------------------- */}

        <section className="mt-16 grid gap-8 lg:grid-cols-[20rem_1fr] lg:items-start lg:gap-12">
          <Nota rotulo="Recordar" titulo="Un toque, y WhatsApp se abre escrito">
            <p>
              El botón que dice{" "}
              <strong className="font-semibold text-[color:var(--esmalte)]">
                Recordar
              </strong>{" "}
              abre el chat de esa persona con el mensaje ya tipeado. Lo leés, lo
              cambiás si querés, y mandás.
            </p>
            <p>
              <strong className="font-semibold text-[color:var(--esmalte)]">
                Nada se manda solo.
              </strong>{" "}
              El último toque lo das vos. Mandar por afuera de WhatsApp es la
              forma más rápida de que le bloqueen el número al local, y eso no
              lo hacemos ni aunque se pida.
            </p>
            <p className="text-sm">
              Este es el mensaje del turno de las {proximo.startLocal} de acá
              arriba, escrito por la misma función que lo escribe en el panel.
            </p>
          </Nota>

          <div className="lg:pt-2">
            <ChatDeWhatsApp
              contacto={proximo.clientName ?? "Cliente"}
              mensaje={recordatorio}
            />
          </div>
        </section>

        {/* ---- Las otras pantallas ------------------------------------ */}
        {/*
          Fotos y no la pantalla viva, a propósito y por ahora. Cobros y Semana
          leen y escriben de la base en la misma pantalla, así que traerlas acá
          es partirlas en dos, y eso es un trabajo que se hace bien o no se
          hace. Estas capturas las saca `scripts/capturas.mts` del sitio en
          producción: envejecen, pero se vuelven a sacar con un comando, y
          recrear las pantallas en HTML se vería igual de bien hoy y empezaría a
          mentir el día que cambie el panel.
        */}
        <section className="mt-16">
          <Nota rotulo="Lo que sigue" titulo="La plata, sin sacar cuentas">
            <p className="max-w-2xl">
              Estas dos son fotos del panel de verdad, sacadas del sitio en
              producción.
            </p>
          </Nota>

          <div className="mt-8 grid gap-8 sm:grid-cols-2">
            {[
              {
                src: "/portada/panel-cobros.png",
                alt: "La pantalla de Cobros, con el ticket de un turno y el cierre de caja.",
                titulo: "Cobros",
                texto:
                  "Cada turno abre un ticket con lo que el cliente vino a hacerse. Se le suma lo que pidió sobre la marcha, se elige con qué pagó, y al final del día la caja cuadra sola.",
              },
              {
                src: "/portada/panel-semana.png",
                alt: "La pantalla de Semana, con los cortes de cada barbero y lo que le toca cobrar.",
                titulo: "Semana",
                texto:
                  "Cuántos cortes hizo cada uno y cuánto le toca. La comisión sale de lo cobrado, no de lo reservado: hasta que no se cobra no entra a ningún número.",
              },
            ].map((x) => (
              <figure key={x.src}>
                <div className="overflow-hidden rounded-2xl ring-1 ring-[color:var(--vidrio)]">
                  <Image
                    src={x.src}
                    alt={x.alt}
                    width={1170}
                    height={2400}
                    className="block h-auto w-full"
                    sizes="(min-width: 640px) 320px, 90vw"
                  />
                </div>
                <figcaption className="mt-4">
                  <p className="font-semibold">{x.titulo}</p>
                  <p className="mt-1 text-sm leading-relaxed text-[color:color-mix(in_oklab,var(--esmalte)_70%,transparent)]">
                    {x.texto}
                  </p>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        {/* ---- La guía entera ----------------------------------------- */}

        <section className="mt-16 rounded-2xl bg-[color:var(--tiza)] px-6 py-8 ring-1 ring-[color:var(--vidrio)] sm:px-8">
          <Nota rotulo="Sin letra chica" titulo="La guía entera, antes de pagar">
            <p className="max-w-2xl">
              Los trece temas del manual que recibe cada barbería, completos y
              acá mismo. Es el mismo texto que está adentro del panel, en el
              botón de ayuda de cada pantalla.
            </p>
          </Nota>

          <Link
            href="/detras/guia"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[color:var(--barbicide)] px-5 py-3 text-sm font-semibold text-[color:var(--tiza)] transition-colors duration-150 ease-out hover:bg-[color:var(--esmalte)] focus-visible:bg-[color:var(--esmalte)] focus-visible:outline-none active:opacity-90"
          >
            Leer la guía
            <span aria-hidden="true">›</span>
          </Link>
        </section>

        <p className="mt-12 text-sm leading-relaxed text-[color:color-mix(in_oklab,var(--esmalte)_60%,transparent)]">
          Los nombres, los precios y los turnos de esta página son inventados.{" "}
          <Link href="/" className={LINK}>
            Del otro lado
          </Link>{" "}
          hay una barbería de ejemplo donde sí podés reservar de verdad.
        </p>
      </MarcoDelDetras>
    </>
  );
}
