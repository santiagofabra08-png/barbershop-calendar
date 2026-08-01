"use server";

import { revalidatePath } from "next/cache";

import { sesionDelPanel } from "@/lib/panel/session";
import { createClient } from "@/lib/supabase/server";

export type EstadoCobro = { error?: string; ok?: string };

/**
 * Cobra un turno.
 *
 * La cuenta la hace Postgres, no esta función ni el navegador. Acá solo viajan
 * los ids de lo que se agregó: los precios los busca el servidor, y así nadie
 * puede cobrar $10 un corte de $300 editando el formulario.
 */
export async function cobrarTurno(
  _previo: EstadoCobro,
  formData: FormData,
): Promise<EstadoCobro> {
  const sesion = await sesionDelPanel();
  if (!sesion) return { error: "Se cerró la sesión. Entrá de nuevo." };

  const id = String(formData.get("id") ?? "");
  const medio = String(formData.get("payment_method") ?? "");
  const extras = formData.getAll("extras").map(String).filter(Boolean);

  if (!id) return { error: "Falta el turno." };
  if (!medio) return { error: "Elegí con qué pagó." };

  const sb = await createClient();

  const { error } = await sb.rpc("cobrar_turno", {
    p_appointment_id: id,
    p_extras: extras,
    p_payment_method: medio,
  });

  if (error) return { error: error.message };

  revalidar();
  return { ok: "Cobrado." };
}

/** Deshace un cobro mal hecho. */
export async function anularCobro(formData: FormData) {
  const sesion = await sesionDelPanel();
  if (!sesion) return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const sb = await createClient();
  await sb.rpc("anular_cobro", { p_appointment_id: id });

  revalidar();
}

/**
 * Marca si el cliente vino, desde la pantalla de cobros.
 *
 * Distinta de la de la agenda: acá cualquiera del equipo puede resolver
 * cualquier turno, porque el que cierra la caja tiene que poder destrabar el
 * turno de un compañero que ya se fue.
 */
export async function marcarAsistenciaEnCobros(formData: FormData) {
  const sesion = await sesionDelPanel();
  if (!sesion) return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const sb = await createClient();
  await sb.rpc("marcar_asistencia", {
    p_appointment_id: id,
    p_vino: formData.get("vino") === "1",
  });

  revalidar();
}

export type EstadoCierre = { error?: string };

/**
 * Cierra la caja del día.
 *
 * Solo viajan los montos contados. Los esperados los calcula la base a partir
 * de lo cobrado: si los mandara el navegador, el cierre no verificaría nada
 * —serían dos números elegidos por la misma mano—.
 */
export async function cerrarCaja(
  _previo: EstadoCierre,
  formData: FormData,
): Promise<EstadoCierre> {
  const sesion = await sesionDelPanel();
  if (!sesion) return { error: "Se cerró la sesión. Entrá de nuevo." };

  const fecha = String(formData.get("fecha") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { error: "Falta el día." };

  const enCentavos = (campo: string) => {
    const n = Number(String(formData.get(campo) ?? "0").replace(",", "."));
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
  };

  const cash = enCentavos("cash");
  const card = enCentavos("card");
  const transfer = enCentavos("transfer");

  if (cash === null || card === null || transfer === null) {
    return { error: "Los montos contados tienen que ser números." };
  }

  const sb = await createClient();

  const { error } = await sb.rpc("cerrar_caja", {
    p_tenant_slug: sesion.tenant.slug,
    p_fecha: fecha,
    p_contado_cash: cash,
    p_contado_card: card,
    p_contado_transfer: transfer,
    p_nota: String(formData.get("note") ?? ""),
  });

  if (error) return { error: error.message };

  revalidar();
  return {};
}

/** Reabre un día cerrado. La base solo se lo permite al dueño. */
export async function reabrirCaja(formData: FormData) {
  const sesion = await sesionDelPanel();
  if (!sesion) return;

  const fecha = String(formData.get("fecha") ?? "");
  if (!fecha) return;

  const sb = await createClient();
  await sb.rpc("reabrir_caja", {
    p_tenant_slug: sesion.tenant.slug,
    p_fecha: fecha,
  });

  revalidar();
}

/** Cobrar toca la agenda, el recuento y la caja: se rehacen las tres. */
function revalidar() {
  revalidatePath("/panel/cobros");
  revalidatePath("/panel/semana");
  revalidatePath("/panel");
}
