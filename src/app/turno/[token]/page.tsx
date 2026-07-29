import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { cancelar } from "@/app/reservar/actions";
import { IconoDescarga } from "@/components/icons";
import { PoleRule } from "@/components/pole-rule";
import { ShopFooter, ShopHeader } from "@/components/shop-chrome";
import { TenantTheme } from "@/components/tenant-theme";
import { formatDuration, formatPrice } from "@/lib/schedule";
import { createClient } from "@/lib/supabase/server";
import { cargarBarberia } from "@/lib/tenant/load";
import { currentTenantSlug } from "@/lib/tenant/resolve";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tu turno",
  robots: { index: false },
};

const DIAS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];
const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "setiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

type Turno = {
  barberia: string;
  barbero: string;
  servicio: string | null;
  fecha: string;
  hora: string;
  duracion_minutos: number;
  precio_centavos: number;
  moneda: string;
  estado: "confirmed" | "cancelled";
  cliente: string;
  se_puede_cancelar: boolean;
};

export default async function PaginaDelTurno({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const slug = await currentTenantSlug();
  if (!slug) notFound();

  const data = await cargarBarberia(slug);
  if (!data) notFound();

  const sb = await createClient();
  const { data: filas } = await sb.rpc("turno_por_token", { p_token: token });
  const turno = (filas as Turno[] | null)?.[0];
  if (!turno) notFound();

  const [y, m, d] = turno.fecha.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const cancelado = turno.estado === "cancelled";

  return (
    <>
      <TenantTheme tenant={data.tenant} />
      <ShopHeader tenant={data.tenant} compact />

      <main className="mx-auto w-full max-w-lg flex-1 px-5 pt-10 pb-16 sm:px-8">
        <div className="card overflow-hidden">
          {/* La secuencia: el poste se desenrolla y detrás sube el turno, en
              orden de importancia. Una sola vez, al llegar. */}
          <section className="border-b border-ink/[0.07] px-5 py-7 sm:px-7">
            {!cancelado ? (
              <div className="pole-burst mb-6 max-w-24">
                <PoleRule unroll />
              </div>
            ) : null}

            <h2 className="rise text-[11px] font-semibold tracking-[0.16em] uppercase">
              <span className={cancelado ? "text-muted" : "text-accent"}>
                {cancelado ? "Turno cancelado" : "Turno confirmado"}
              </span>
            </h2>

            <p
              className={`rise mt-3 font-display text-3xl leading-tight font-bold ${
                cancelado ? "text-muted line-through" : ""
              }`}
              style={{ "--delay": "0.1s" } as React.CSSProperties}
            >
              {DIAS[weekday]} {d} de {MESES[m - 1]}
              <br />
              <span className="tabular">{turno.hora.slice(0, 5)}</span>
            </p>

            <p
              className="rise mt-3 text-[15px] text-muted"
              style={{ "--delay": "0.2s" } as React.CSSProperties}
            >
              {turno.servicio} con {turno.barbero} ·{" "}
              {formatDuration(turno.duracion_minutos)} ·{" "}
              {formatPrice(turno.precio_centavos, turno.moneda)}
            </p>

            <p
              className="rise mt-1 text-[15px] text-muted"
              style={{ "--delay": "0.26s" } as React.CSSProperties}
            >
              A nombre de {turno.cliente}
            </p>
          </section>

          <section className="px-5 py-6 sm:px-7">
            {cancelado ? (
              <>
                <p className="text-[15px] leading-relaxed text-muted">
                  Este turno quedó libre. Si querés otro, elegilo desde los
                  horarios de esta semana.
                </p>
                <Link
                  href="/"
                  className="mt-5 inline-block rounded-lg bg-accent px-7 py-3.5 text-sm font-semibold tracking-[0.08em] text-surface uppercase transition-colors duration-150 ease-out hover:bg-ink active:bg-ink/90"
                >
                  Ver los horarios
                </Link>
              </>
            ) : (
              <>
                <a
                  href={`/turno/${token}/calendario.ics`}
                  className="inline-flex items-center gap-2 rounded-lg bg-ink px-6 py-3.5 text-sm font-semibold tracking-[0.06em] text-bg uppercase transition-colors duration-150 ease-out hover:bg-accent active:bg-accent/90"
                >
                  <IconoDescarga className="size-4" />
                  Agregar al calendario
                </a>
                <p className="mt-3 text-sm text-muted">
                  Te avisa dos horas antes.
                </p>

                <p className="mt-6 text-[15px] leading-relaxed text-muted">
                  Guardá este link: es el que te deja ver o cancelar el turno.
                  Te lo mandamos también por mail.
                </p>

                {turno.se_puede_cancelar ? (
                  <form action={cancelar} className="mt-5">
                    <input type="hidden" name="token" value={token} />
                    <button
                      type="submit"
                      className="rounded-lg bg-ink/[0.05] px-6 py-3.5 text-sm font-semibold tracking-[0.08em] text-ink uppercase transition-colors duration-150 ease-out hover:bg-accent hover:text-surface active:bg-accent/90"
                    >
                      Cancelar turno
                    </button>
                  </form>
                ) : (
                  <p className="mt-5 text-sm text-muted">
                    Ya no se puede cancelar desde acá — falta menos de{" "}
                    {formatDuration(data.tenant.cancelDeadlineMinutes)} para el
                    turno. Escribile a la barbería si no vas a poder ir.
                  </p>
                )}
              </>
            )}
          </section>
        </div>
      </main>

      <ShopFooter tenant={data.tenant} workingHours={data.workingHours} />
    </>
  );
}
