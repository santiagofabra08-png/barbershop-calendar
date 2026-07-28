import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BookingForm } from "@/app/reservar/booking-form";
import { Masthead, ShopFooter } from "@/components/shop-chrome";
import { TenantTheme } from "@/components/tenant-theme";
import {
  bookingWindowEnd,
  buildAgendas,
  formatDuration,
  formatPrice,
  mergeAgendas,
  nowInTimeZone,
} from "@/lib/schedule";
import { cargarBarberia, cargarOcupados } from "@/lib/tenant/load";
import { currentTenantSlug } from "@/lib/tenant/resolve";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Confirmá tu turno",
  robots: { index: false },
};

export default async function PaginaDeConfirmacion({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string; hora?: string; barbero?: string }>;
}) {
  const {
    fecha = "",
    hora = "",
    barbero = "cualquiera",
  } = await searchParams;

  const slug = await currentTenantSlug();
  if (!slug) notFound();

  const data = await cargarBarberia(slug);
  if (!data) notFound();

  const { tenant, barbers, services, workingHours } = data;
  const activos = barbers.filter((b) => b.acceptsBookings);
  const service = services[0];
  if (activos.length === 0 || !service) notFound();

  // El horario que llega por la URL se vuelve a calcular acá: que exista en la
  // grilla, que siga libre y que siga dentro de la ventana. Alguien puede
  // editar la URL a mano, o dejar la pestaña abierta media hora.
  const { date: hoy, time: ahora } = nowInTimeZone(tenant.timezone);
  const fin = bookingWindowEnd(tenant, hoy, ahora);
  const ocupados = await cargarOcupados(slug, tenant.timezone, hoy, fin.date);

  const agendas = buildAgendas({
    tenant,
    service,
    barbers: activos,
    workingHours,
    busy: ocupados,
  });

  // Con un solo barbero no hay nada que elegir: se toma el que hay, venga lo
  // que venga en la URL.
  const elegido =
    activos.length === 1
      ? activos[0]
      : activos.find((b) => b.id === barbero);

  const days = elegido
    ? (agendas.find((a) => a.barber.id === elegido.id)?.days ?? [])
    : mergeAgendas(agendas);

  const dia = days.find((d) => d.date === fecha);
  const slot = dia?.slots.find((s) => s.time === hora && s.available);

  return (
    <>
      <TenantTheme tenant={tenant} />

      <main className="mx-auto w-full max-w-lg flex-1 px-5 pt-10 pb-16 sm:px-8 sm:pt-14">
        <Masthead tenant={tenant} compact />

        {!dia || !slot ? (
          <div className="mt-12">
            <h2 className="font-display text-3xl font-bold">
              Ese horario ya no está
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-muted">
              Puede que lo haya tomado alguien mientras completabas, o que haya
              quedado muy cerca de la hora. Elegí otro y seguimos.
            </p>
            <Link
              href="/"
              className="mt-6 inline-block bg-accent px-6 py-3 text-sm font-semibold tracking-[0.08em] text-surface uppercase transition-colors duration-150 ease-out hover:bg-ink active:bg-ink/90"
            >
              Ver los horarios
            </Link>
          </div>
        ) : (
          <>
            <section className="mt-12">
              <h2 className="text-xs font-semibold tracking-[0.14em] text-ink uppercase">
                Tu turno
              </h2>

              <p className="mt-3 font-display text-3xl leading-tight font-bold">
                {dia.dayName} {dia.dayNumber} de {dia.monthName}
                <br />
                <span className="tabular">{slot.time}</span>
              </p>

              <p className="mt-3 text-[15px] text-muted">
                {service.name}
                {elegido ? ` con ${elegido.displayName}` : ""} ·{" "}
                {formatDuration(service.durationMinutes)} ·{" "}
                {formatPrice(service.priceCents, tenant.currency)}
              </p>
              {!elegido ? (
                <p className="mt-1 text-sm text-muted">
                  Te va a atender el barbero que esté libre a esa hora.
                </p>
              ) : null}

              <Link
                href="/"
                className="mt-4 inline-block text-sm text-muted underline decoration-1 underline-offset-4 transition-colors duration-150 ease-out hover:text-ink"
              >
                Cambiar horario
              </Link>
            </section>

            <div className="mt-10 border-t border-ink/12 pt-8">
              <h2 className="text-xs font-semibold tracking-[0.14em] text-ink uppercase">
                Tus datos
              </h2>
              <BookingForm
                fecha={fecha}
                hora={hora}
                serviceId={service.id}
                barberId={elegido?.id ?? ""}
              />
            </div>
          </>
        )}
      </main>

      <ShopFooter tenant={tenant} workingHours={workingHours} />
    </>
  );
}
