import Image from "next/image";
import Link from "next/link";

import { PoleRule } from "@/components/pole-rule";
import { summarizeHours } from "@/lib/schedule";
import type { Tenant, WorkingHour } from "@/lib/tenant/types";

/**
 * El nombre de la barbería, partido en dos como en el logo: la primera
 * palabra en versalitas espaciadas, el resto en serif.
 *
 * `compact` lo achica para las pantallas que no son la portada, donde el
 * protagonista es el turno y no la marca.
 */
export function Masthead({
  tenant,
  compact = false,
}: {
  tenant: Tenant;
  compact?: boolean;
}) {
  const [primera, ...resto] = tenant.name.split(" ");
  const segunda = resto.join(" ");

  const contenido = (
    <>
      <p
        className={`font-semibold tracking-[0.4em] text-ink uppercase ${
          compact ? "text-[10px]" : "text-xs"
        }`}
      >
        {primera}
      </p>
      {segunda ? (
        <span
          className={`mt-1 block font-display font-bold leading-none ${
            compact ? "text-2xl" : "text-5xl sm:text-6xl"
          }`}
        >
          {segunda}
        </span>
      ) : null}
    </>
  );

  if (compact) {
    return (
      <header>
        <Link
          href="/"
          className="inline-block transition-opacity duration-150 ease-out hover:opacity-70"
        >
          <h1>{contenido}</h1>
        </Link>
        <PoleRule className="mt-3 max-w-24" />
      </header>
    );
  }

  return (
    <header>
      <h1>{contenido}</h1>
      <PoleRule className="mt-5 max-w-40" />
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
    <footer className="mt-auto bg-ink text-bg">
      <div className="mx-auto grid w-full max-w-3xl gap-8 px-5 py-12 sm:grid-cols-[10rem_1fr] sm:px-8">
        {photoUrl ? (
          <Image
            src={photoUrl}
            alt={photoAlt ?? ""}
            width={320}
            height={320}
            className="h-40 w-40 object-cover"
          />
        ) : null}

        <div className="grid gap-8 sm:grid-cols-2">
          {tenant.address ? (
            <div>
              <h2 className="text-xs font-semibold tracking-[0.14em] uppercase opacity-60">
                Dónde
              </h2>
              {tenant.mapsUrl ? (
                <a
                  href={tenant.mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-[15px] leading-relaxed underline decoration-1 underline-offset-4 transition-opacity duration-150 ease-out hover:opacity-70"
                >
                  {tenant.address}
                </a>
              ) : (
                <p className="mt-2 text-[15px] leading-relaxed">
                  {tenant.address}
                </p>
              )}
            </div>
          ) : null}

          <div>
            <h2 className="text-xs font-semibold tracking-[0.14em] uppercase opacity-60">
              Cuándo
            </h2>
            <dl className="mt-2 text-[15px] leading-relaxed">
              {horario.map((fila) => (
                <div key={fila.dias}>
                  <dt className="inline">{fila.dias}</dt>
                  <dd className="tabular inline"> · {fila.horas}</dd>
                </div>
              ))}
            </dl>
          </div>

          <p className="text-sm opacity-60 sm:col-span-2">
            Se paga en el local, en efectivo o por transferencia. Podés cancelar
            hasta una hora antes del turno.
          </p>
        </div>
      </div>
    </footer>
  );
}
