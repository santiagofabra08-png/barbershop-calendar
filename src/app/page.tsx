import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { FranjaDemo } from "@/components/franja-demo";
import { IconoEtiqueta, IconoReloj } from "@/components/icons";
import { Portada } from "@/components/portada";
import { ShopFooter, ShopHeader } from "@/components/shop-chrome";
import { TenantTheme } from "@/components/tenant-theme";
import { WeekSchedule } from "@/components/week-schedule";
import {
  bookingWindowEnd,
  buildAgendas,
  formatDuration,
  formatPrice,
  nowInTimeZone,
  weekdayName,
} from "@/lib/schedule";
import { SLUG_DEMO, urlDeLaPortada } from "@/lib/demo";
import type { Day } from "@/lib/schedule";
import { cargarBarberia, cargarOcupados } from "@/lib/tenant/load";
import { currentTenantSlug } from "@/lib/tenant/resolve";
import { mensajeDeRecordatorio } from "@/lib/whatsapp";

// La grilla depende de la hora exacta en que alguien entra. Cachearla la
// dejaría mostrando turnos de otro día.
export const dynamic = "force-dynamic";

/*
 * La foto del local todavía no existe como dato.
 *
 * Acá había una constante con la foto de Tropi, y la pasaba **todas** las
 * barberías: cada local mostraba al pie la estación de trabajo de otro, con un
 * texto alternativo que decía "La estación de trabajo de {su nombre}". Con una
 * sola barbería en la base era invisible; con la segunda es material de otro
 * negocio presentado como propio.
 *
 * `ShopFooter` ya dibuja bien sin foto, así que hasta que sea un dato de cada
 * barbería —una columna y una subida desde Ajustes, como el logo— no se pasa
 * ninguna. Mejor un pie sin foto que un pie con la foto equivocada.
 */

export async function generateMetadata(): Promise<Metadata> {
  const slug = await currentTenantSlug();

  // Sin subdominio no hay barbería: lo que se muestra es la portada del
  // producto, y le corresponde su propio título.
  if (!slug) {
    return {
      title: "Reservas para barberías",
      description:
        "Tus clientes reservan desde el teléfono a cualquier hora. Vos abrís el panel y el día ya está armado.",
    };
  }

  const data = await cargarBarberia(slug);
  if (!data) return { title: "Reservá tu turno" };

  return {
    title: `Reservá tu turno · ${data.tenant.name}`,
    description: `Elegí un horario de esta semana en ${data.tenant.name}.`,
  };
}

export default async function PaginaDeReservas({
  searchParams,
}: {
  searchParams: Promise<{ servicio?: string; vitrina?: string }>;
}) {
  const { servicio, vitrina } = await searchParams;
  const slug = await currentTenantSlug();

  // El dominio pelado no es ninguna barbería, pero sí es la puerta del
  // producto: ahí va la portada, no un 404.
  if (!slug) return <Portada />;

  const data = await cargarBarberia(slug);
  if (!data) notFound();

  const { tenant, barbers, services, workingHours } = data;
  const activos = barbers.filter((b) => b.acceptsBookings);

  const { date: hoy, time: ahora } = nowInTimeZone(tenant.timezone);
  const fin = bookingWindowEnd(tenant, hoy, ahora);
  const ocupados = await cargarOcupados(slug, tenant.timezone, hoy, fin.date);

  // Una grilla por servicio, calculadas todas de una.
  //
  // Cada servicio arma su propia grilla porque la duración la define: un corte
  // de 40 minutos y una barba de 20 no caen en las mismas horas. Se calculan
  // todas acá, sobre los mismos ratos ocupados, para que cambiar de servicio en
  // la pantalla sea instantáneo en vez de otra ida al servidor. Son funciones
  // puras sobre datos que ya están en memoria: sale casi gratis.
  const opciones = services.map((service) => ({
    service,
    agendas: buildAgendas({
      tenant,
      service,
      barbers: activos,
      workingHours,
      busy: ocupados,
    }),
  }));

  // La franja oscura muestra el servicio solo cuando hay uno: con varios, cuál
  // es lo decide el cliente más abajo, y adelantarlo sería mentir.
  const service = services.length === 1 ? services[0] : null;
  const hayAgenda = opciones.length > 0 && activos.length > 0;

  /*
   * ---- La franja explicativa de la barbería demo --------------------------
   *
   * ⚠️ Solo la demo, comparando contra `SLUG_DEMO`. Esta página es la misma
   * para todas: sin ese `===`, un cliente entra a reservar en su barbería y se
   * encuentra material de ventas nuestro al pie.
   *
   * Va también acá y no solo después de reservar porque el link de la demo se
   * comparte en frío: lo más probable es que quien lo abre mire los horarios y
   * cierre sin reservar nada, y esa persona es justamente la que necesita la
   * explicación.
   *
   * El turno del ejemplo sale del primer horario libre de verdad, el mismo que
   * la persona está viendo arriba. Podría inventarse una fecha y una hora, pero
   * un ejemplo que coincide con lo que hay en pantalla se lee como el producto
   * y no como un folleto.
   */
  const ejemplo = esLaDemo(slug) ? primerHueco(opciones) : null;

  return (
    <>
      <TenantTheme tenant={tenant} />

      {/*
        Marca la página como incrustada en la portada. Lo único que cambia es
        que se esconde la barra de scroll: una barra gris de navegador cruzando
        el costado del teléfono dibujado arruina la ilusión, y es lo primero
        que se nota. La regla vive en `globals.css`.

        Nada más cambia. La demo tiene que ser la página de verdad, no una
        versión recortada de la página de verdad.
      */}
      {vitrina ? <div className="vitrina" hidden /> : null}

      {/* El servicio va en la franja oscura, junto al nombre: es el dato que
          define todo lo de abajo, no una sección aparte. */}
      <ShopHeader tenant={tenant}>
        {service ? (
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            <span className="font-display text-xl font-bold">
              {service.name}
            </span>
            <span className="inline-flex items-center gap-1.5 text-sm opacity-70">
              <IconoReloj className="size-3.5" />
              {formatDuration(service.durationMinutes)}
            </span>
            <span className="tabular inline-flex items-center gap-1.5 text-sm opacity-70">
              <IconoEtiqueta className="size-3.5" />
              {formatPrice(service.priceCents, tenant.currency)}
            </span>
          </div>
        ) : null}
      </ShopHeader>

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pt-7 pb-16 sm:px-8">
        {hayAgenda ? (
          <>
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-2xl leading-tight font-bold sm:text-3xl">
                Reservá tu turno
              </h2>
              {/* Decir "se abre el sábado" sonaba a que la barbería abre ese
                  día. Lo que se abre es la agenda, y conviene nombrarlo. */}
              {tenant.bookingWindow.mode === "weekly" ? (
                <p className="text-sm text-muted">
                  Los turnos de la semana que viene se habilitan el{" "}
                  {weekdayName(tenant.bookingWindow.releaseWeekday)} a las{" "}
                  <span className="tabular">
                    {tenant.bookingWindow.releaseTime}
                  </span>
                </p>
              ) : null}
            </div>

            <WeekSchedule
              opciones={opciones}
              tenant={tenant}
              servicioInicial={servicio}
            />
          </>
        ) : (
          <div className="card px-6 py-12 text-center">
            <p className="text-sm text-muted">
              La agenda todavía no está abierta. Volvé en un rato.
            </p>
          </div>
        )}

        {/* Los productos se ofrecen después del turno, no antes: quien entra
            acá viene a reservar. Y solo si la barbería prendió la vidriera. */}
        {tenant.productsEnabled ? (
          <Link
            href="/productos"
            className="card mt-10 flex items-center gap-4 px-5 py-5 transition-shadow duration-150 ease-out hover:shadow-lg"
          >
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg leading-tight font-bold text-ink">
                Catálogo de productos
              </p>
              <p className="mt-1 text-sm text-muted">
                Ceras, polvos y todo lo que usamos en el local.
              </p>
            </div>
            <span
              aria-hidden="true"
              className="text-xs font-semibold tracking-[0.1em] text-accent-text uppercase"
            >
              Ver ›
            </span>
          </Link>
        ) : null}
      </main>

      <ShopFooter tenant={tenant} workingHours={workingHours} />

      {ejemplo ? (
        <FranjaDemo
          cliente={CLIENTE_DE_EJEMPLO}
          mensaje={mensajeDeRecordatorio({
            barberia: tenant.name,
            cliente: CLIENTE_DE_EJEMPLO,
            servicio: ejemplo.servicio,
            fecha: ejemplo.fecha,
            hora: ejemplo.hora,
            hoy,
          })}
          barberia={tenant.name}
          urlPortada={urlDeLaPortada(process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "")}
        />
      ) : null}
    </>
  );
}

/** La franja explicativa es solo de la barbería de demostración. */
function esLaDemo(slug: string): boolean {
  return slug === SLUG_DEMO;
}

/**
 * Un nombre ilustrativo, no el de nadie.
 *
 * Con apellido de una letra, como se anota un cliente en un cuaderno de verdad
 * y como ya se escriben los nombres del cuaderno de la portada. Acá adentro no
 * hay ningún turno todavía —la persona no reservó nada—, así que el mensaje del
 * último paso necesita un destinatario de ejemplo. Que se lea como ejemplo es
 * parte del punto.
 */
const CLIENTE_DE_EJEMPLO = "Martín R.";

/**
 * El primer horario libre de la grilla que la persona está mirando.
 *
 * Devuelve `null` si no queda ninguno, y entonces la franja no se dibuja: un
 * ejemplo con una hora inventada valdría menos que no mostrar nada, porque la
 * gracia es que sea el mismo turno que se ve arriba.
 */
function primerHueco(
  opciones: { service: { name: string }; agendas: { days: Day[] }[] }[],
): { servicio: string; fecha: string; hora: string } | null {
  for (const opcion of opciones) {
    for (const agenda of opcion.agendas) {
      for (const dia of agenda.days) {
        const hueco = dia.slots.find((s) => s.available);
        if (hueco) {
          return {
            servicio: opcion.service.name,
            fecha: dia.date,
            hora: hueco.time,
          };
        }
      }
    }
  }
  return null;
}
