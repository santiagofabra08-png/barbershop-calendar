"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  borrarFotoPorUrl,
  fotoDelFormulario,
  subirFoto,
  urlDeLaRuta,
} from "@/lib/panel/fotos";
import { FOTO_BARBERO } from "@/lib/panel/imagen";
import { sesionDelPanel } from "@/lib/panel/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { PaymentModel, PayPeriod } from "@/lib/payroll";

export type EstadoEquipo = { error?: string; ok?: string };

const MODELOS: PaymentModel[] = [
  "commission",
  "salary",
  "chair_rent",
  "revenue_only",
];

/**
 * Las cuatro columnas de cobro, a partir de lo que se eligió en el formulario.
 *
 * Devuelve siempre las cuatro, con null en las que no aplican. Mandar solo las
 * que corresponden dejaría las viejas puestas: alguien que pasa de comisión a
 * sueldo se quedaría con el porcentaje colgado, y el CHECK de la base —con
 * razón— rechazaría la fila entera.
 */
function columnasDeCobro(formData: FormData):
  | { ok: true; valores: Record<string, string | number | null> }
  | { ok: false; error: string } {
  const modelo = String(formData.get("payment_model") ?? "");
  if (!MODELOS.includes(modelo as PaymentModel)) {
    return { ok: false, error: "Elegí cómo cobra." };
  }

  const vacio = {
    payment_model: modelo,
    commission_percent: null,
    pay_amount_cents: null,
    pay_period: null,
  };

  if (modelo === "commission") {
    const pct = Number(String(formData.get("commission_percent") ?? "").replace(",", "."));
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      return { ok: false, error: "El porcentaje tiene que estar entre 0 y 100." };
    }
    return { ok: true, valores: { ...vacio, commission_percent: pct } };
  }

  if (modelo === "salary" || modelo === "chair_rent") {
    const monto = Number(String(formData.get("pay_amount") ?? "").replace(",", "."));
    if (!Number.isFinite(monto) || monto < 0) {
      return { ok: false, error: "El monto tiene que ser un número." };
    }
    const periodo = String(formData.get("pay_period") ?? "");
    if (periodo !== "week" && periodo !== "month") {
      return { ok: false, error: "Elegí si es por semana o por mes." };
    }
    return {
      ok: true,
      valores: {
        ...vacio,
        // El formulario habla en pesos y la base guarda centavos.
        pay_amount_cents: Math.round(monto * 100),
        pay_period: periodo as PayPeriod,
      },
    };
  }

  return { ok: true, valores: vacio };
}

function limpiarMail(formData: FormData): string | null {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  return email === "" ? null : email;
}

const MAIL = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/;

export async function crearBarbero(
  _previo: EstadoEquipo,
  formData: FormData,
): Promise<EstadoEquipo> {
  const sesion = await sesionDelPanel();
  if (!sesion?.esDuenio) return { error: "Solo el dueño puede dar de alta." };

  const nombre = String(formData.get("display_name") ?? "").trim();
  if (nombre.length < 2) return { error: "Escribí el nombre del barbero." };

  const email = limpiarMail(formData);
  if (email !== null && !MAIL.test(email)) {
    return { error: "Ese mail no tiene forma de mail." };
  }

  const cobro = columnasDeCobro(formData);
  if (!cobro.ok) return { error: cobro.error };

  const sb = await createClient();

  let photoUrl: string | null = null;
  const foto = fotoDelFormulario(formData);
  if (foto) {
    const subida = await subirFoto(sb, sesion.tenant.id, "equipo", foto, FOTO_BARBERO);
    if (!subida.ok) return { error: subida.error };
    photoUrl = urlDeLaRuta(subida.path);
  }

  const { error } = await sb.from("barbers").insert({
    tenant_id: sesion.tenant.id,
    display_name: nombre,
    email,
    role: "barber",
    accepts_bookings: formData.get("accepts_bookings") === "on",
    photo_url: photoUrl,
    ...cobro.valores,
  });

  if (error) {
    // Si la fila no entró, la foto queda huérfana en el bucket. Se limpia acá.
    await borrarFotoPorUrl(sb, photoUrl);
    return { error: `No se pudo guardar: ${error.message}` };
  }

  revalidatePath("/panel/equipo");
  redirect("/panel/equipo");
}

export async function guardarBarbero(
  _previo: EstadoEquipo,
  formData: FormData,
): Promise<EstadoEquipo> {
  const sesion = await sesionDelPanel();
  if (!sesion?.esDuenio) return { error: "Solo el dueño puede editar el equipo." };

  const id = String(formData.get("id") ?? "");
  const nombre = String(formData.get("display_name") ?? "").trim();
  if (nombre.length < 2) return { error: "Escribí el nombre del barbero." };

  const email = limpiarMail(formData);
  if (email !== null && !MAIL.test(email)) {
    return { error: "Ese mail no tiene forma de mail." };
  }

  const cobro = columnasDeCobro(formData);
  if (!cobro.ok) return { error: cobro.error };

  const sb = await createClient();

  const { data: actual } = await sb
    .from("barbers")
    .select("photo_url")
    .eq("id", id)
    .eq("tenant_id", sesion.tenant.id)
    .maybeSingle();

  const anterior = (actual as { photo_url: string | null } | null)?.photo_url ?? null;

  let photoUrl = anterior;
  const foto = fotoDelFormulario(formData);
  if (foto) {
    const subida = await subirFoto(sb, sesion.tenant.id, "equipo", foto, FOTO_BARBERO);
    if (!subida.ok) return { error: subida.error };
    photoUrl = urlDeLaRuta(subida.path);
  } else if (formData.get("quitar_foto") === "1") {
    photoUrl = null;
  }

  const { error } = await sb
    .from("barbers")
    .update({
      display_name: nombre,
      email,
      accepts_bookings: formData.get("accepts_bookings") === "on",
      photo_url: photoUrl,
      ...cobro.valores,
    })
    .eq("id", id)
    .eq("tenant_id", sesion.tenant.id);

  if (error) {
    if (photoUrl !== anterior) await borrarFotoPorUrl(sb, photoUrl);
    return { error: `No se pudo guardar: ${error.message}` };
  }

  // La vieja recién se borra cuando la nueva ya está guardada: al revés, un
  // error deja al barbero sin foto y sin forma de recuperarla.
  if (photoUrl !== anterior) await borrarFotoPorUrl(sb, anterior);

  revalidatePath("/panel/equipo");
  revalidatePath(`/panel/equipo/${id}`);
  return { ok: "Guardado." };
}

/**
 * Le da acceso al panel a un barbero, o le cambia la contraseña.
 *
 * Usa service role, que saltea RLS por completo. Por eso lo primero que hace
 * es preguntar quién está pidiéndolo: sin ese chequeo, cualquiera con sesión
 * podría crearle una cuenta a cualquiera. Y después el barbero se busca
 * filtrando por tenant a mano, porque acá abajo la base ya no filtra sola.
 */
export async function darAcceso(
  _previo: EstadoEquipo,
  formData: FormData,
): Promise<EstadoEquipo> {
  const sesion = await sesionDelPanel();
  if (!sesion?.esDuenio) return { error: "Solo el dueño puede dar acceso." };

  const id = String(formData.get("id") ?? "");
  const password = String(formData.get("password") ?? "");

  if (password.length < 8) {
    return { error: "La contraseña tiene que tener al menos 8 caracteres." };
  }

  const admin = createAdminClient();

  const { data: fila } = await admin
    .from("barbers")
    .select("id, display_name, email, user_id")
    .eq("id", id)
    .eq("tenant_id", sesion.tenant.id)
    .maybeSingle();

  if (!fila) return { error: "Ese barbero no es de esta barbería." };

  const barbero = fila as {
    id: string;
    display_name: string;
    email: string | null;
    user_id: string | null;
  };

  if (!barbero.email) {
    return { error: "Primero cargale un mail, que es con lo que va a entrar." };
  }

  // Ya tiene cuenta: esto es un cambio de contraseña, no un alta.
  if (barbero.user_id) {
    const { error } = await admin.auth.admin.updateUserById(barbero.user_id, {
      password,
    });
    if (error) return { error: `No se pudo cambiar: ${error.message}` };
    revalidatePath(`/panel/equipo/${id}`);
    return { ok: `Contraseña nueva para ${barbero.display_name}.` };
  }

  const { data: creado, error: errorAlta } = await admin.auth.admin.createUser({
    email: barbero.email,
    password,
    email_confirm: true,
  });

  if (errorAlta || !creado?.user) {
    return { error: `No se pudo crear la cuenta: ${errorAlta?.message}` };
  }

  const { error: errorEnlace } = await admin
    .from("barbers")
    .update({ user_id: creado.user.id })
    .eq("id", barbero.id);

  if (errorEnlace) {
    // La cuenta quedó creada pero suelta. Se borra para que el próximo intento
    // no choque contra un mail duplicado que nadie sabe de dónde salió.
    await admin.auth.admin.deleteUser(creado.user.id);
    return { error: `No se pudo enlazar la cuenta: ${errorEnlace.message}` };
  }

  revalidatePath("/panel/equipo");
  revalidatePath(`/panel/equipo/${id}`);
  return { ok: `${barbero.display_name} ya puede entrar con ${barbero.email}.` };
}

/**
 * Da de baja a un barbero, o lo devuelve.
 *
 * Nunca se borra: sus turnos son el historial de la barbería, y con ellos se
 * fue la plata que hizo. Dado de baja no aparece más en la página pública ni
 * puede entrar al panel, pero lo que trabajó sigue contando.
 */
export async function cambiarEstado(formData: FormData) {
  const sesion = await sesionDelPanel();
  if (!sesion?.esDuenio) return;

  const id = String(formData.get("id") ?? "");
  const activar = formData.get("activar") === "1";

  if (id === sesion.barbero.id) return; // el dueño no se da de baja solo

  const sb = await createClient();
  await sb
    .from("barbers")
    .update({ is_active: activar, accepts_bookings: activar })
    .eq("id", id)
    .eq("tenant_id", sesion.tenant.id);

  revalidatePath("/panel/equipo");
  revalidatePath(`/panel/equipo/${id}`);
}
