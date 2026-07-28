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
        className={`mx-auto w-full max-w-3xl px-5 sm:px-8 ${
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

        {children ? <div className="mt-5">{children}</div> : null}
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

  return (
    <footer className="mt-auto border-t border-ink/10">
      <div className="mx-auto grid w-full max-w-3xl gap-8 px-5 py-14 sm:grid-cols-[9rem_1fr] sm:px-8">
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
              {tenant.mapsUrl ? (
                <a
                  href={tenant.mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-[15px] leading-relaxed text-ink underline decoration-1 underline-offset-4 transition-opacity duration-150 ease-out hover:opacity-60"
                >
                  {tenant.address}
                </a>
              ) : (
                <p className="mt-2 text-[15px] leading-relaxed text-ink">
                  {tenant.address}
                </p>
              )}
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
