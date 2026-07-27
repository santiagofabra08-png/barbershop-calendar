"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";

import { enviarConfirmacion } from "@/lib/email/send";
import { formatDuration, formatPrice } from "@/lib/schedule";
import { createClient } from "@/lib/supabase/server";
import { cargarBarberia } from "@/lib/tenant/load";
import { currentTenantSlug } from "@/lib/tenant/resolve";

export type EstadoReserva = {
  error?: string;
  valores?: { nombre: string; telefono: string; email: string };
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

/** La URL pública de esta barbería, tal como la está viendo el cliente. */
async function urlAbsoluta(path: string): Promise<string> {
  const h = await headers();
  const host = h.get("host");
  if (!host) return `${process.env.NEXT_PUBLIC_APP_URL ?? ""}${path}`;
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}${path}`;
}

/**
 * Crea el turno.
 *
 * No inserta nada por su cuenta: llama a `crear_reserva`, que valida todo del
 * lado de Postgres y devuelve el token del cliente. Todo lo que llega del
 * formulario es sospechoso hasta que esa función diga lo contrario — incluidas
 * la fecha y la hora, que acá viajan como texto y allá se convierten al
 * instante real.
 */
export async function reservar(
  _estado: EstadoReserva,
  formData: FormData,
): Promise<EstadoReserva> {
  const slug = await currentTenantSlug();
  if (!slug) return { error: "No pudimos identificar la barbería." };

  const leer = (campo: string) => String(formData.get(campo) ?? "").trim();

  const valores = {
    nombre: leer("nombre"),
    telefono: leer("telefono"),
    email: leer("email"),
  };

  const fecha = leer("fecha");
  const hora = leer("hora");
  const serviceId = leer("serviceId");
  const barberId = leer("barberId");

  if (!valores.nombre || !valores.telefono || !valores.email) {
    return { error: "Completá tu nombre, teléfono y mail.", valores };
  }

  const sb = await createClient();
  const { data, error } = await sb.rpc("crear_reserva", {
    p_tenant_slug: slug,
    p_service_id: serviceId,
    p_barber_id: barberId,
    p_fecha: fecha,
    p_hora: hora,
    p_nombre: valores.nombre,
    p_telefono: valores.telefono,
    p_email: valores.email,
  });

  if (error) {
    // Los mensajes de la función ya están escritos para leerse en pantalla.
    return { error: error.message, valores };
  }

  const token = data as string;
  const urlTurno = await urlAbsoluta(`/turno/${token}`);

  // El mail sale DESPUÉS de responder, con `after`. El turno ya está guardado:
  // que Resend tarde, falle o no esté configurado no puede demorar ni romper
  // una reserva que ya existe.
  after(async () => {
    const barberia = await cargarBarberia(slug);
    const service = barberia?.services.find((s) => s.id === serviceId);
    const barber = barberia?.barbers.find((b) => b.id === barberId);
    if (!barberia || !service || !barber) return;

    const [anio, mes, dia] = fecha.split("-").map(Number);
    const weekday = new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay();

    const resultado = await enviarConfirmacion({
      tenant: barberia.tenant,
      para: valores.email,
      cliente: valores.nombre,
      barbero: barber.displayName,
      servicio: service.name,
      cuando: `${DIAS[weekday]} ${dia} de ${MESES[mes - 1]}, ${hora}`,
      precio: formatPrice(service.priceCents, barberia.tenant.currency),
      duracion: formatDuration(service.durationMinutes),
      urlTurno,
    });

    if (!resultado.enviado) {
      console.warn(
        `[mail] no se envió la confirmación del turno ${token}: ${resultado.motivo}`,
      );
    }
  });

  redirect(`/turno/${token}`);
}

export async function cancelar(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const sb = await createClient();
  await sb.rpc("cancelar_turno", { p_token: token });
  redirect(`/turno/${token}`);
}
