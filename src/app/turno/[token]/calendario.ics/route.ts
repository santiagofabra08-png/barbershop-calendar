import { plazoEnPalabras } from "@/lib/plazo";
import { localToUtc } from "@/lib/schedule";
import { createClient } from "@/lib/supabase/server";
import { cargarBarberia } from "@/lib/tenant/load";
import { currentTenantSlug } from "@/lib/tenant/resolve";

/**
 * El turno como archivo de calendario.
 *
 * Un .ics lo entienden todos: el calendario de Android, el de iPhone, Google
 * Calendar, Outlook. Sin cuentas, sin permisos, sin integraciones — se baja y
 * el teléfono lo abre solo.
 *
 * Es lo que más ayuda a que el cliente no se olvide de ir.
 */

type Turno = {
  barberia: string;
  barbero: string;
  servicio: string | null;
  fecha: string;
  hora: string;
  duracion_minutos: number;
  estado: "confirmed" | "cancelled";
};

/** Los saltos de línea, las comas y los punto y coma se escapan en un .ics. */
function escapar(texto: string): string {
  return texto
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function utcCompacto(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/**
 * El formato exige líneas de 75 octetos como máximo, y las que siguen van
 * con un espacio adelante. Sin esto, una dirección larga rompe el archivo en
 * algunos calendarios.
 */
function plegar(linea: string): string {
  if (linea.length <= 75) return linea;
  const partes = [linea.slice(0, 75)];
  let resto = linea.slice(75);
  while (resto.length > 74) {
    partes.push(` ${resto.slice(0, 74)}`);
    resto = resto.slice(74);
  }
  if (resto) partes.push(` ${resto}`);
  return partes.join("\r\n");
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const slug = await currentTenantSlug();
  if (!slug) return new Response("No encontrado", { status: 404 });

  const barberia = await cargarBarberia(slug);
  if (!barberia) return new Response("No encontrado", { status: 404 });

  const sb = await createClient();
  const { data } = await sb.rpc("turno_por_token", { p_token: token });
  const turno = (data as Turno[] | null)?.[0];

  if (!turno || turno.estado !== "confirmed") {
    return new Response("No encontrado", { status: 404 });
  }

  const { tenant } = barberia;
  const inicio = localToUtc(
    turno.fecha,
    turno.hora.slice(0, 5),
    tenant.timezone,
  );
  const fin = new Date(inicio.getTime() + turno.duracion_minutos * 60_000);

  const descripcion = [
    `${turno.servicio ?? "Turno"} con ${turno.barbero}.`,
    `Se paga en el local. Podés cancelar ${plazoEnPalabras(tenant.cancelDeadlineMinutes)} desde el link del mail.`,
  ].join(" ");

  const lineas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Barbershop Booking//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${token}@${tenant.slug}`,
    `DTSTAMP:${utcCompacto(new Date())}`,
    `DTSTART:${utcCompacto(inicio)}`,
    `DTEND:${utcCompacto(fin)}`,
    `SUMMARY:${escapar(`${turno.servicio ?? "Turno"} · ${tenant.name}`)}`,
    `DESCRIPTION:${escapar(descripcion)}`,
    tenant.address ? `LOCATION:${escapar(tenant.address)}` : null,
    "STATUS:CONFIRMED",
    // Un recordatorio dos horas antes, que es cuando todavía se llega a
    // reacomodar el día.
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapar(`Turno en ${tenant.name}`)}`,
    "TRIGGER:-PT2H",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter((l): l is string => l !== null);

  const ics = lineas.map(plegar).join("\r\n");

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="turno-${tenant.slug}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
