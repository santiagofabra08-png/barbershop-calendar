import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { IconoEtiqueta, IconoReloj } from "@/components/icons";
import { ShopFooter, ShopHeader } from "@/components/shop-chrome";
import { TenantTheme } from "@/components/tenant-theme";
import { WeekSchedule } from "@/components/week-schedule";
import {
  bookingWindowEnd,
  buildAgendas,
  formatDuration,
  formatPrice,
  nowInTimeZone,
} from "@/lib/schedule";
import { cargarBarberia, cargarOcupados } from "@/lib/tenant/load";
import { currentTenantSlug } from "@/lib/tenant/resolve";

// La grilla depende de la hora exacta en que alguien entra. Cachearla la
// dejaría mostrando turnos de otro día.
export const dynamic = "force-dynamic";

// TODO: la foto de la barbería va a Supabase Storage, como la marca.
const FOTO_PROVISORIA = "/dev/tropi-estacion.jpg";

export async function generateMetadata(): Promise<Metadata> {
  const slug = await currentTenantSlug();
  const data = slug ? await cargarBarberia(slug) : null;
  if (!data) return { title: "Reservá tu turno" };

  return {
    title: `Reservá tu turno · ${data.tenant.name}`,
    description: `Elegí un horario de esta semana en ${data.tenant.name}.`,
  };
}

export default async function PaginaDeReservas({
  searchParams,
}: {
  searchParams: Promise<{ servicio?: string }>;
}) {
  const { servicio } = await searchParams;
  const slug = await currentTenantSlug();
  if (!slug) notFound();

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

  return (
    <>
      <TenantTheme tenant={tenant} />

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
              {tenant.bookingWindow.mode === "weekly" ? (
                <p className="text-sm text-muted">
                  La semana que viene se abre el sábado{" "}
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
                También vendemos
              </p>
              <p className="mt-1 text-sm text-muted">
                Ceras, polvos y algo más para llevarte a casa.
              </p>
            </div>
            <span
              aria-hidden="true"
              className="text-xs font-semibold tracking-[0.1em] text-accent uppercase"
            >
              Ver ›
            </span>
          </Link>
        ) : null}
      </main>

      <ShopFooter
        tenant={tenant}
        workingHours={workingHours}
        photoUrl={FOTO_PROVISORIA}
        photoAlt={`La estación de trabajo de ${tenant.name}`}
      />
    </>
  );
}
