import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Masthead, ShopFooter } from "@/components/shop-chrome";
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

// TODO: la foto de la barbería va a Supabase Storage, como el logo. Hasta
// entonces vive en public/dev/.
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

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pt-14 pb-16 sm:px-8 sm:pt-20">
        <Masthead tenant={tenant} />

        {activos.length > 0 && service ? (
          <>
            <p className="mt-6 max-w-md text-[15px] leading-relaxed text-muted">
              {activos.length === 1
                ? `Corte con ${activos[0].displayName}. Elegí una hora de esta semana y reservá.`
                : "Elegí barbero, día y hora. Los turnos son de esta semana."}
            </p>

            <div className="mt-10 flex items-baseline justify-between gap-4 border-y border-ink/12 py-4">
              <span className="font-display text-xl font-bold">
                {service.name}
              </span>
              <span className="tabular text-sm font-medium text-muted">
                {formatDuration(service.durationMinutes)} ·{" "}
                {formatPrice(service.priceCents, tenant.currency)}
              </span>
            </div>

            <div className="mt-12">
              {tenant.bookingWindow.mode === "weekly" ? (
                <p className="mb-8 text-sm text-muted">
                  Los horarios de la semana que viene se abren el sábado a las{" "}
                  <span className="tabular">
                    {tenant.bookingWindow.releaseTime}
                  </span>
                  .
                </p>
              ) : null}

              <WeekSchedule
                agendas={agendas}
                service={service}
                tenant={tenant}
              />
            </div>
          </>
        ) : (
          <p className="mt-10 border border-ink/12 bg-surface px-5 py-8 text-center text-sm text-muted">
            La agenda todavía no está abierta. Volvé en un rato.
          </p>
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
