import type { Metadata } from "next";
import Image from "next/image";

import { PoleRule } from "@/components/pole-rule";
import { TenantTheme } from "@/components/tenant-theme";
import { WeekSchedule } from "@/components/week-schedule";
import { buildWeek, formatDuration, formatPrice } from "@/lib/schedule";
// ⚠️ TEMPORAL: hasta que Supabase esté configurado, los datos salen de un
// fixture. Cuando la base esté lista, este import se reemplaza por la consulta
// que resuelve la barbería a partir del subdominio. Nada más de este archivo
// cambia.
import {
  barberoDemo,
  fotoEstacionDemo,
  horariosDemo,
  servicioDemo,
  tenantDemo,
} from "@/lib/tenant/fixture";

export const metadata: Metadata = {
  title: `Reservá tu turno · ${tenantDemo.name}`,
  description: `Corte con ${barberoDemo.displayName} en ${tenantDemo.name}. Elegí un horario de esta semana.`,
};

// Los horarios dependen de la hora exacta en que alguien entra: qué turnos ya
// pasaron, cuáles quedan afuera por la anticipación mínima, dónde termina la
// semana. Si Next la cachea como estática, la grilla queda congelada en el
// momento del build y muestra turnos de otro día.
export const dynamic = "force-dynamic";

export default function PaginaDeReservas() {
  const tenant = tenantDemo;
  const service = servicioDemo;
  const barber = barberoDemo;

  const days = buildWeek({
    tenant,
    service,
    workingHours: horariosDemo,
  });

  return (
    <>
      <TenantTheme tenant={tenant} />

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pt-14 pb-16 sm:px-8 sm:pt-20">
        {/* ---- Masthead ---- */}
        <header>
          <p className="text-xs font-semibold tracking-[0.4em] text-ink uppercase">
            Tropi
          </p>
          <h1 className="mt-1 font-display text-5xl leading-none font-bold sm:text-6xl">
            Barbershop
          </h1>
          <PoleRule className="mt-5 max-w-40" />

          <p className="mt-6 max-w-md text-[15px] leading-relaxed text-muted">
            Corte con {barber.displayName}, en Veracierto. Elegí una hora de
            esta semana y reservá — no hace falta crear una cuenta.
          </p>
        </header>

        {/* ---- El servicio, como una línea de carta ---- */}
        <div className="mt-10 flex items-baseline justify-between gap-4 border-y border-ink/12 py-4">
          <span className="font-display text-xl font-bold">{service.name}</span>
          <span className="tabular text-sm font-medium text-muted">
            {formatDuration(service.durationMinutes)} ·{" "}
            {formatPrice(service.priceCents, tenant.currency)}
          </span>
        </div>

        {/* ---- La semana ---- */}
        <section className="mt-12" aria-labelledby="esta-semana">
          <h2
            id="esta-semana"
            className="text-xs font-semibold tracking-[0.14em] text-ink uppercase"
          >
            Esta semana
          </h2>
          <p className="mt-2 text-sm text-muted">
            Los horarios de la semana que viene se abren el sábado a las 21:00.
          </p>

          <div className="mt-8">
            <WeekSchedule days={days} service={service} tenant={tenant} />
          </div>
        </section>
      </main>

      {/* ---- Pie: dónde y cuándo ---- */}
      <footer className="bg-ink text-bg">
        <div className="mx-auto grid w-full max-w-3xl gap-8 px-5 py-12 sm:grid-cols-[10rem_1fr] sm:px-8">
          <Image
            src={fotoEstacionDemo}
            alt={`La estación de trabajo de ${barber.displayName}`}
            width={320}
            height={320}
            className="h-40 w-40 object-cover"
          />

          <div className="grid gap-8 sm:grid-cols-2">
            <div>
              <h2 className="text-xs font-semibold tracking-[0.14em] uppercase opacity-60">
                Dónde
              </h2>
              <p className="mt-2 text-[15px] leading-relaxed">
                Veracierto 3359
                <br />
                Montevideo
              </p>
            </div>

            <div>
              <h2 className="text-xs font-semibold tracking-[0.14em] uppercase opacity-60">
                Cuándo
              </h2>
              <p className="tabular mt-2 text-[15px] leading-relaxed">
                Martes a sábado
                <br />
                14:00 a 21:00
              </p>
            </div>

            <p className="text-sm opacity-60 sm:col-span-2">
              Se paga en el local, en efectivo o por transferencia. Podés
              cancelar hasta una hora antes del turno.
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}
