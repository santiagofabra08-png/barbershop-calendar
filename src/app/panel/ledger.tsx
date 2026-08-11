import { borrarBloqueo, marcarAsistencia } from "@/app/panel/actions";
import { IconoTijera } from "@/components/icons";
import { armarTira } from "@/lib/panel/day-strip";
import type { TurnoDelPanel } from "@/lib/panel/data";
import { formatDuration, formatPrice } from "@/lib/schedule";
import { enMinutos } from "@/lib/panel/day-strip";
import { linkDeWhatsApp, mensajeDeRecordatorio } from "@/lib/whatsapp";
import type { Tenant } from "@/lib/tenant/types";

/**
 * El día, como la página de un libro de turnos.
 *
 * La hora vive en el margen y los turnos cuelgan de una línea fina, igual que
 * en la agenda de papel que toda barbería tiene abajo del mostrador. Los ratos
 * libres se escriben en vez de dejarse en blanco: un hueco de una hora a las
 * cuatro no es ausencia de información, es cuando se puede comer.
 */

const GUTTER = "grid grid-cols-[3.25rem_1fr] gap-x-3 sm:grid-cols-[4rem_1fr]";

export function Ledger({
  turnos,
  tenant,
  ahora,
  hoy,
  diaPasado,
  nombrePorBarbero,
}: {
  turnos: TurnoDelPanel[];
  tenant: Tenant;
  /** "HH:MM" si el día que se mira es hoy; null si no. */
  ahora: string | null;
  /** "YYYY-MM-DD" local de verdad, que no es el día que se está mirando. */
  hoy: string;
  /** El día que se mira ya terminó. */
  diaPasado: boolean;
  /** Con más de un barbero a la vista, cada turno dice de quién es. */
  nombrePorBarbero: Map<string, string> | null;
}) {
  const tira = armarTira(turnos, ahora);

  if (tira.length === 0) {
    return (
      <p className="card mt-6 px-5 py-8 text-center text-sm text-muted">
        No hay nada anotado para este día.
      </p>
    );
  }

  return (
    <ol className="mt-6">
      {tira.map((a, i) => {
        if (a.tipo === "ahora") {
          return (
            <li key={`ahora-${i}`} className={GUTTER}>
              <p className="tabular pt-px text-right text-xs font-semibold text-accent">
                {a.at}
              </p>
              <div className="flex items-center gap-2 pb-5">
                <span className="size-1.5 shrink-0 rounded-full bg-accent" />
                <span className="h-px flex-1 bg-accent/40" />
                <span className="text-[0.65rem] font-semibold tracking-[0.18em] text-accent uppercase">
                  Ahora
                </span>
              </div>
            </li>
          );
        }

        if (a.tipo === "hueco") {
          return (
            <li key={`hueco-${i}`} className={GUTTER}>
              <span />
              <p className="border-l border-dashed border-ink/20 py-2 pb-5 pl-4 text-xs text-muted">
                {formatDuration(a.minutos)} libres
              </p>
            </li>
          );
        }

        return (
          <li key={a.turno.id} className={GUTTER}>
            <div className="pt-0.5 text-right">
              <p className="tabular text-sm font-semibold text-ink">
                {a.turno.startLocal}
              </p>
              <p className="tabular text-xs text-muted">{a.turno.endLocal}</p>
            </div>

            <div className="border-l border-ink/12 pb-5 pl-4">
              <Turno
                turno={a.turno}
                tenant={tenant}
                hoy={hoy}
                nombrePorBarbero={nombrePorBarbero}
                // Un turno que todavía no empezó no puede haber faltado: el
                // botón aparece recién cuando la pregunta tiene sentido.
                yaEmpezo={
                  diaPasado ||
                  (ahora !== null &&
                    enMinutos(a.turno.startLocal) <= enMinutos(ahora))
                }
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Turno({
  turno,
  tenant,
  hoy,
  nombrePorBarbero,
  yaEmpezo,
}: {
  turno: TurnoDelPanel;
  tenant: Tenant;
  hoy: string;
  nombrePorBarbero: Map<string, string> | null;
  yaEmpezo: boolean;
}) {
  const barbero = nombrePorBarbero?.get(turno.barberId) ?? null;

  if (turno.kind === "block") {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-dashed border-ink/20 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-muted">
            {turno.reason ?? "Bloqueado"}
          </p>
          {barbero ? (
            <p className="mt-0.5 text-xs text-muted">{barbero}</p>
          ) : null}
        </div>

        <form action={borrarBloqueo}>
          <input type="hidden" name="id" value={turno.id} />
          <button
            type="submit"
            aria-label="Quitar el bloqueo"
            className="flex size-6 items-center justify-center rounded-md text-muted transition-colors duration-150 ease-out hover:bg-ink/10 hover:text-ink active:bg-ink/15"
          >
            <span aria-hidden="true">×</span>
          </button>
        </form>
      </div>
    );
  }

  const falto = turno.status === "no_show";
  const duracion =
    enMinutos(turno.endLocal) - enMinutos(turno.startLocal) || null;

  /*
   * El recordatorio, solo mientras siga sirviendo de recordatorio. Para un
   * turno que ya empezó, o uno marcado como que no vino, el chat abre en
   * blanco: ahí lo que hay para decir depende de qué pasó, y adivinarlo mal es
   * peor que no escribir nada.
   *
   * De eso sale la etiqueta del botón, y no es un detalle. Antes decía
   * "WhatsApp" en los dos casos y no había forma de saber cuál te tocaba: el
   * que diseñó esto probó con un turno ya empezado, vio el chat vacío y creyó
   * que estaba roto. Si le pasa a quien lo escribió, le pasa a cualquiera. La
   * etiqueta es lo que hace visible una regla que si no es adivinanza.
   */
  const recordatorio =
    yaEmpezo || turno.status !== "confirmed"
      ? undefined
      : mensajeDeRecordatorio({
          barberia: tenant.name,
          cliente: turno.clientName,
          servicio: turno.serviceName,
          fecha: turno.dateLocal,
          hora: turno.startLocal,
          hoy,
        });

  return (
    <div
      className={[
        "card px-4 py-3.5 transition-colors duration-150 ease-out",
        falto ? "opacity-60" : "",
      ].join(" ")}
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="truncate font-medium text-ink">
          {turno.clientName ?? "Sin nombre"}
        </p>
        {turno.priceCents !== null ? (
          <p className="tabular shrink-0 text-sm font-semibold text-ink">
            {formatPrice(turno.priceCents, tenant.currency)}
          </p>
        ) : null}
      </div>

      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
        {turno.serviceName ? <span>{turno.serviceName}</span> : null}
        {duracion ? (
          <>
            <span aria-hidden="true">·</span>
            <span>{formatDuration(duracion)}</span>
          </>
        ) : null}
        {barbero ? (
          <>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">
              <IconoTijera className="size-3.5" />
              {barbero}
            </span>
          </>
        ) : null}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {falto ? <Chip>No vino</Chip> : null}
        {turno.source === "panel" ? <Chip>Cargado a mano</Chip> : null}

        {yaEmpezo ? (
          <form action={marcarAsistencia}>
            <input type="hidden" name="id" value={turno.id} />
            <input type="hidden" name="vino" value={falto ? "1" : "0"} />
            <button
              type="submit"
              className="rounded-lg border border-ink/15 px-3 py-1.5 text-xs font-semibold tracking-[0.06em] text-muted uppercase transition-colors duration-150 ease-out hover:border-ink/40 hover:text-ink active:bg-ink/[0.06]"
            >
              {falto ? "Sí vino" : "No vino"}
            </button>
          </form>
        ) : null}

        {turno.clientPhone ? (
          <a
            href={linkDeWhatsApp(turno.clientPhone, recordatorio)}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto rounded-lg border border-ink/15 px-3 py-1.5 text-xs font-semibold tracking-[0.06em] text-muted uppercase transition-colors duration-150 ease-out hover:border-ink/40 hover:text-ink active:bg-ink/[0.06]"
          >
            {recordatorio ? "Recordar" : "WhatsApp"}
          </a>
        ) : null}
      </div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-ink/[0.06] px-2.5 py-1 text-[0.65rem] font-semibold tracking-[0.1em] text-muted uppercase">
      {children}
    </span>
  );
}
