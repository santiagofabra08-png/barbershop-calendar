import { IconoInstagram, IconoWhatsApp } from "@/components/icons";
import type { Tenant } from "@/lib/tenant/types";

/**
 * El WhatsApp y el Instagram del local, siempre a mano.
 *
 * Abajo a la derecha, fijos. La página de reservas contesta "cuándo", pero
 * queda una cantidad de preguntas que no: si hay estacionamiento, si atienden a
 * un nene de tres años, si tienen otro modelo de lentes. Sin un lugar visible
 * donde preguntar, esa persona cierra la pestaña.
 *
 * Tres cosas que conviene no revertir sin pensarlo:
 *
 * - **Van en la paleta de la barbería, no en verde y violeta.** El logo oficial
 *   de cada red es sólido y de un color que no eligió el local; pegado sobre una
 *   página que se pinta con los colores de cada barbería queda como una
 *   calcomanía. Se reconocen por la forma.
 * - **Quedan por debajo de la barra del turno elegido** (`z-10` contra el 5 de
 *   acá). En el celular esa barra ocupa todo el ancho y tapa estos botones por
 *   completo: cuando alguien está por confirmar, lo único que importa es el
 *   botón de confirmar.
 * - **No se dibuja lo que no está cargado.** Una barbería sin Instagram no
 *   muestra un botón que lleve a ningún lado.
 */
export function ContactoFlotante({ tenant }: { tenant: Tenant }) {
  // `wa.me` quiere solo dígitos; en la base está normalizado como +598…
  const whatsapp = tenant.whatsappPhone?.replace(/\D/g, "");
  const instagram = tenant.instagramUrl;

  if (!whatsapp && !instagram) return null;

  const boton = [
    "flex size-11 items-center justify-center rounded-full",
    "bg-surface text-ink ring-1 ring-ink/10 shadow-[0_4px_16px_-4px] shadow-ink/25",
    "transition-[background-color,box-shadow,transform] duration-150 ease-out",
    "hover:-translate-y-px hover:bg-bg hover:shadow-[0_8px_20px_-6px] hover:shadow-ink/35",
    "focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none",
    "active:translate-y-0 active:bg-ink/[0.08]",
  ].join(" ");

  return (
    <div
      className="fixed right-4 bottom-4 z-[5] flex flex-col gap-2.5"
      style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}
    >
      {whatsapp ? (
        <a
          href={`https://wa.me/${whatsapp}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Escribirle a ${tenant.name} por WhatsApp`}
          className={boton}
        >
          <IconoWhatsApp className="size-5" />
        </a>
      ) : null}

      {instagram ? (
        <a
          href={instagram}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Ver a ${tenant.name} en Instagram`}
          className={boton}
        >
          <IconoInstagram className="size-5" />
        </a>
      ) : null}
    </div>
  );
}
