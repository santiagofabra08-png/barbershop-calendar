import { NextResponse } from "next/server";

import { SLUG_DEMO } from "@/lib/demo";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Vacía la barbería que la portada muestra incrustada.
 *
 * La llama Vercel una vez por día. Hace falta porque la demo se puede reservar
 * de verdad —ése es todo el punto de tenerla— y sin limpiar, en unas semanas la
 * agenda queda llena de turnos de curiosos y el próximo visitante no encuentra
 * un horario libre para tocar. Una demo sin huecos no demuestra nada.
 *
 * Borra TODOS los turnos de esa barbería, siempre filtrando por `tenant_id`.
 * Ese filtro es lo único que separa "vaciar la demo" de "borrarle la agenda a
 * un cliente que paga" —ver `src/lib/demo.ts`—.
 */

// Nunca cacheada: es una acción, no una página.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secreto = process.env.CRON_SECRET;

  // Sin secreto configurado la ruta no se abre sola: quedaría un borrado sin
  // llave colgando de una dirección pública. Preferible que la tarea falle
  // ruidosamente a que cualquiera pueda dispararla.
  if (!secreto) {
    return NextResponse.json({ error: "Falta CRON_SECRET." }, { status: 500 });
  }

  // Es el encabezado que manda Vercel solo, cuando la variable existe.
  if (request.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: demo, error: eTenant } = await admin
    .from("tenants")
    .select("id")
    .eq("slug", SLUG_DEMO)
    .maybeSingle();

  if (eTenant) {
    return NextResponse.json({ error: eTenant.message }, { status: 500 });
  }

  // Que la demo no exista no es un error de la tarea: puede haberse borrado a
  // propósito. Se informa y se sale bien, para no llenar el registro de fallas
  // rojas que no hay que arreglar.
  if (!demo) {
    return NextResponse.json({ ok: true, demo: SLUG_DEMO, sinBarberia: true });
  }

  // `as string` porque los tipos de la base todavía son el placeholder que
  // devuelve `unknown` para cualquier columna. Se afirma en el borde, como en
  // el resto del proyecto, y no más adentro.
  const { data, error } = await admin
    .from("appointments")
    .delete()
    .eq("tenant_id", demo.id as string)
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, borrados: data?.length ?? 0 });
}
