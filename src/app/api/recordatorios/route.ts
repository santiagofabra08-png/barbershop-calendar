import { NextResponse } from "next/server";

import { SLUG_DEMO, protocoloDe } from "@/lib/demo";
import { enviarRecordatorio } from "@/lib/email/recordatorio";
import { formatDateLong, nowInTimeZone } from "@/lib/schedule";
import { createAdminClient } from "@/lib/supabase/admin";
import { cargarTenant } from "@/lib/tenant/load";
import type { Tenant } from "@/lib/tenant/types";

/**
 * El recordatorio de los turnos que empiezan dentro de las próximas dos horas.
 *
 * La llama una acción programada de GitHub cada quince minutos. No manda nada
 * dos veces: `appointments.reminder_sent_at` es la marca, y es lo único que lo
 * impide.
 *
 * **La ventana es "de acá a dos horas", no "dentro de dos horas exactas."** Con
 * una franja angosta —de 1h45 a 2h15— una corrida que falla pierde esos turnos
 * para siempre. Así, si una corrida no sale, la siguiente los agarra: la persona
 * recibe el aviso una hora y media antes en vez de dos, que sigue sirviendo.
 *
 * ⚠️ **La barbería de demostración queda afuera.** Ahí reserva gente que está
 * probando el producto, con su mail de verdad. La portada les promete la
 * confirmación; un recordatorio de un turno que no existe es correo que nadie
 * pidió.
 */

export const dynamic = "force-dynamic";

const DOS_HORAS_MS = 2 * 60 * 60 * 1000;

type FilaTurno = {
  id: string;
  starts_at: string;
  client_name: string;
  client_email: string;
  public_token: string;
  services: { name: string } | null;
  barbers: { display_name: string } | null;
  tenants: { slug: string } | null;
};

/** "Hoy a las 15:00", o con la fecha si por lo que sea cayó en otro día. */
function cuandoEnPalabras(inicio: Date, tenant: Tenant): string {
  const turno = nowInTimeZone(tenant.timezone, inicio);
  const hoy = nowInTimeZone(tenant.timezone).date;

  return turno.date === hoy
    ? `Hoy a las ${turno.time}`
    : `${formatDateLong(turno.date)} a las ${turno.time}`;
}

export async function GET(request: Request) {
  const secreto = process.env.CRON_SECRET;

  // Sin secreto la ruta no se abre sola: quedaría un disparador de correo
  // colgando de una dirección pública.
  if (!secreto) {
    return NextResponse.json({ error: "Falta CRON_SECRET." }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const raiz = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "";
  if (!raiz) {
    return NextResponse.json(
      { error: "Falta NEXT_PUBLIC_ROOT_DOMAIN: sin eso el link del turno no se puede armar." },
      { status: 500 },
    );
  }

  const admin = createAdminClient();
  const ahora = new Date();
  const limite = new Date(ahora.getTime() + DOS_HORAS_MS);

  const { data, error } = await admin
    .from("appointments")
    .select(
      "id, starts_at, client_name, client_email, public_token, " +
        "services(name), barbers(display_name), tenants(slug)",
    )
    .eq("kind", "booking")
    .eq("status", "confirmed")
    .is("reminder_sent_at", null)
    .gt("starts_at", ahora.toISOString())
    .lte("starts_at", limite.toISOString())
    .order("starts_at");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const turnos = (data ?? []) as unknown as FilaTurno[];

  // Una barbería por consulta y no una por turno: en una tarde con veinte
  // turnos del mismo local, eso es una ida a la base en vez de veinte.
  const barberias = new Map<string, Tenant | null>();
  const problemas: string[] = [];
  let enviados = 0;
  let salteados = 0;

  for (const t of turnos) {
    const slug = t.tenants?.slug;
    if (!slug || slug === SLUG_DEMO) {
      salteados += 1;
      continue;
    }

    if (!barberias.has(slug)) barberias.set(slug, await cargarTenant(slug));
    const tenant = barberias.get(slug);
    if (!tenant) {
      salteados += 1;
      continue;
    }

    const url = `${protocoloDe(raiz)}://${slug}.${raiz}/turno/${t.public_token}`;

    const resultado = await enviarRecordatorio({
      tenant,
      para: t.client_email,
      cliente: t.client_name,
      barbero: t.barbers?.display_name ?? "tu barbero",
      servicio: t.services?.name ?? "Turno",
      cuando: cuandoEnPalabras(new Date(t.starts_at), tenant),
      urlTurno: url,
    });

    // Se marca haya salido o no, a propósito. Si no saliera y no se marcara,
    // la próxima corrida lo intenta de nuevo, y con una dirección que rebota
    // eso son ocho mails en dos horas al mismo lugar: ensucia la reputación
    // del remitente de la barbería, que es lo que hace que los demás lleguen.
    const { error: eMarca } = await admin
      .from("appointments")
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq("id", t.id);

    if (eMarca) problemas.push(`${t.id}: no se pudo marcar (${eMarca.message})`);
    if (resultado.enviado) enviados += 1;
    else problemas.push(`${t.id}: ${resultado.motivo}`);
  }

  return NextResponse.json({
    ok: true,
    encontrados: turnos.length,
    enviados,
    salteados,
    problemas,
  });
}
