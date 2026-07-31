"use server";

import { revalidatePath } from "next/cache";

import { NOMBRE_DIA } from "@/lib/panel/dias";
import { sesionDelPanel } from "@/lib/panel/session";
import { createClient } from "@/lib/supabase/server";

export type EstadoHorarios = { error?: string; ok?: string };

const HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Postgres avisa así que dos tramos del mismo día se pisan. */
const SUPERPOSICION = "23P01";

/**
 * Agrega el mismo tramo a varios días de una vez.
 *
 * Es como se habla: "de martes a sábado de 14 a 21" es un solo horario, no
 * cinco. Cargarlo cinco veces sería hacerle repetir al barbero algo que ya
 * dijo una vez.
 */
export async function agregarTramo(
  _previo: EstadoHorarios,
  formData: FormData,
): Promise<EstadoHorarios> {
  const sesion = await sesionDelPanel();
  if (!sesion) return { error: "Se cerró la sesión. Entrá de nuevo." };

  const { tenant, barbero, esDuenio } = sesion;

  // Un barbero solo toca lo suyo. El dueño puede editar el de cualquiera.
  // RLS lo impone igual; esto es para dar un mensaje claro en vez de un error.
  const barberId = String(formData.get("barberId") ?? barbero.id);
  if (barberId !== barbero.id && !esDuenio) {
    return { error: "Solo podés cambiar tus propios horarios." };
  }

  const desde = String(formData.get("desde") ?? "");
  const hasta = String(formData.get("hasta") ?? "");
  const dias = formData
    .getAll("dias")
    .map((d) => Number(d))
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);

  if (dias.length === 0) return { error: "Elegí al menos un día." };
  if (!HORA.test(desde) || !HORA.test(hasta)) {
    return { error: "Las horas tienen que estar completas, como 14:00." };
  }
  if (hasta <= desde) {
    return { error: "La hora de cierre tiene que ser posterior a la de apertura." };
  }

  const sb = await createClient();

  // De a un día, para poder decir exactamente cuál se pisó. Un insert de los
  // cinco juntos fallaría entero por culpa de uno solo.
  const pisados: number[] = [];
  let agregados = 0;

  for (const weekday of dias) {
    const { error } = await sb.from("working_hours").insert({
      tenant_id: tenant.id,
      barber_id: barberId,
      weekday,
      starts_at: desde,
      ends_at: hasta,
    });

    if (!error) {
      agregados++;
    } else if (error.code === SUPERPOSICION) {
      pisados.push(weekday);
    } else {
      return { error: `No se pudo guardar: ${error.message}` };
    }
  }

  revalidatePath("/panel/horarios");
  revalidatePath("/panel");

  if (pisados.length > 0) {
    const nombres = pisados.map((d) => NOMBRE_DIA[d]).join(", ");
    return {
      error:
        agregados > 0
          ? `Se guardó, menos en ${nombres}: ahí ya hay un horario que se pisa con este.`
          : `En ${nombres} ya hay un horario que se pisa con este.`,
    };
  }

  return { ok: "Horario agregado." };
}

export async function borrarTramo(formData: FormData) {
  const sesion = await sesionDelPanel();
  if (!sesion) return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const sb = await createClient();
  // Sin filtro por barbero a propósito: quién puede borrar qué lo decide RLS.
  // Agregarlo acá daría la impresión de que la seguridad vive en esta línea.
  await sb.from("working_hours").delete().eq("id", id);

  revalidatePath("/panel/horarios");
  revalidatePath("/panel");
}
