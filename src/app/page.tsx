import type { Metadata } from "next";
import { notFound } from "next/navigation";

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

export default async function PaginaDeReservas() {
  const slug = await currentTenantSlug();
  if (!slug) notFound();

  const data = await cargarBarberia(slug);
  if (!data) notFound();

  const { tenant, barbers, services, workingHours } = data;
  const activos = barbers.filter((b) => b.acceptsBookings);
  const service = services[0];

  const { date: hoy, time: ahora } = nowInTimeZone(tenant.timezone);
  const fin = bookingWindowEnd(tenant, hoy, ahora);
  const ocupados = await cargarOcupados(slug, tenant.timezone, hoy, fin.date);

  const agendas = service
    ? buildAgendas({
        tenant,
        service,
        barbers: activos,
        workingHours,
        busy: ocupados,
      })
    : [];

  return (
    <>
      <TenantTheme tenant={tenant} />

      {/* El servicio va en la franja oscura, junto al nombre: es el dato que
          define todo lo de abajo, no una sección aparte. */}
      <ShopHeader tenant={tenant}>
        {service ? (
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-display text-xl font-bold">
              {service.name}
            </span>
            <span className="tabular text-sm opacity-70">
              {formatDuration(service.durationMinutes)} ·{" "}
              {formatPrice(service.priceCents, tenant.currency)}
            </span>
          </div>
        ) : null}
      </ShopHeader>

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pt-7 pb-16 sm:px-8">
        {service && activos.length > 0 ? (
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
              agendas={agendas}
              service={service}
              tenant={tenant}
            />
          </>
        ) : (
          <div className="card px-6 py-12 text-center">
            <p className="text-sm text-muted">
              La agenda todavía no está abierta. Volvé en un rato.
            </p>
          </div>
        )}
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
