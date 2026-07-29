import Image from "next/image";
import Link from "next/link";

import { PoleRule } from "@/components/pole-rule";
import { summarizeHours } from "@/lib/schedule";
import type { Tenant, WorkingHour } from "@/lib/tenant/types";

/**
 * La franja oscura de arriba.
 *
 * Antes el nombre iba sobre el mismo crema que el resto y la página entera
 * quedaba en un solo plano. Arrancar en negro le da un borde superior claro,
 * hace que el poste y el rojo del logo salten, y deja el crema para lo que
 * importa: elegir el turno.
 */
export function ShopHeader({
  tenant,
  compact = false,
  children,
}: {
  tenant: Tenant;
  compact?: boolean;
  children?: React.ReactNode;
}) {
  const [primera, ...resto] = tenant.name.split(" ");
  const segunda = resto.join(" ");

  // La franja del poste va DENTRO de la columna de texto, no debajo de todo:
  // así mide exactamente lo que mide la palabra más larga del nombre.
  const marca = (
    <span className="inline-flex items-center gap-3 sm:gap-4">
      {tenant.logoDarkUrl ? (
        <Image
          src={tenant.logoDarkUrl}
          alt=""
          width={128}
          height={145}
          priority={!compact}
          className={compact ? "h-9 w-auto" : "h-14 w-auto sm:h-16"}
        />
      ) : null}

      <span className="block">
        <span
          className={`block font-semibold tracking-[0.4em] uppercase opacity-70 ${
            compact ? "text-[10px]" : "text-[11px]"
          }`}
        >
          {primera}
        </span>
        {segunda ? (
          <span
            className={`mt-0.5 block font-display leading-[0.95] font-bold ${
              compact ? "text-2xl" : "text-4xl sm:text-5xl"
            }`}
          >
            {segunda}
          </span>
        ) : null}
        <PoleRule className={compact ? "mt-2 w-full" : "mt-2.5 w-full"} />
      </span>
    </span>
  );

  return (
    <header className="bg-ink text-bg">
      <div
        className={`mx-auto w-full max-w-3xl px-5 text-center sm:px-8 ${
          compact ? "py-5" : "py-7 sm:py-8"
        }`}
      >
        {compact ? (
          <Link
            href="/"
            className="inline-block transition-opacity duration-150 ease-out hover:opacity-70"
          >
            <h1>{marca}</h1>
          </Link>
        ) : (
          <h1>{marca}</h1>
        )}

        {children ? (
          <div className="mt-5 flex justify-center">{children}</div>
        ) : null}
      </div>
    </header>
  );
}

export function ShopFooter({
  tenant,
  workingHours,
  photoUrl,
  photoAlt,
}: {
  tenant: Tenant;
  workingHours: WorkingHour[];
  photoUrl?: string | null;
  photoAlt?: string;
}) {
  const horario = summarizeHours(workingHours);

  // Si la barbería no cargó un link propio, se arma uno de búsqueda con su
  // dirección. Así toda barbería tiene mapa sin que nadie complete nada.
  const mapa =
    tenant.mapsUrl ??
    (tenant.address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(tenant.address)}`
      : null);

  return (
    <footer className="mt-auto border-t border-ink/10">
      <div
        className={`mx-auto grid w-full max-w-3xl gap-8 px-5 py-14 sm:px-8 ${
          photoUrl ? "sm:grid-cols-[9rem_1fr]" : ""
        }`}
      >
        {photoUrl ? (
          <Image
            src={photoUrl}
            alt={photoAlt ?? ""}
            width={320}
            height={320}
            className="h-36 w-36 rounded-xl object-cover"
          />
        ) : null}

        <div className="grid gap-8 sm:grid-cols-2">
          {tenant.address ? (
            <div>
              <h2 className="text-[11px] font-semibold tracking-[0.16em] text-muted uppercase">
                Dónde
              </h2>
              <p className="mt-2 text-[15px] leading-relaxed text-ink">
                {tenant.address}
              </p>
              {mapa ? (
                <a
                  href={mapa}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-ink/[0.05] py-1.5 pr-3 pl-2.5 text-[13px] font-medium text-ink transition-colors duration-150 ease-out hover:bg-ink/[0.1] active:bg-ink/[0.15]"
                >
                  <IconoUbicacion />
                  Ver en el mapa
                </a>
              ) : null}
            </div>
          ) : null}

          <div>
            <h2 className="text-[11px] font-semibold tracking-[0.16em] text-muted uppercase">
              Cuándo
            </h2>
            <dl className="mt-2 text-[15px] leading-relaxed text-ink">
              {horario.map((fila) => (
                <div key={fila.dias}>
                  <dt className="inline">{fila.dias}</dt>
                  <dd className="tabular inline"> · {fila.horas}</dd>
                </div>
              ))}
            </dl>
          </div>

          <p className="text-sm leading-relaxed text-muted sm:col-span-2">
            Se paga en el local, en efectivo o por transferencia. Podés cancelar
            hasta una hora antes del turno.
          </p>
        </div>
      </div>
    </footer>
  );
}

/** Chinche de mapa. Trazo fino y color heredado, como pide la guía. */
function IconoUbicacion() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="size-4 shrink-0 opacity-70"
    >
      <path d="M13 6.8c0 3.3-5 8.2-5 8.2S3 10.1 3 6.8a5 5 0 0 1 10 0Z" />
      <circle cx="8" cy="6.7" r="1.8" />
    </svg>
  );
}
