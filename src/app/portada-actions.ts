"use server";

import { avisarSolicitud } from "@/lib/email/solicitud";
import { createAdminClient } from "@/lib/supabase/admin";
import { validarCliente } from "@/lib/validation";

/**
 * Alguien dejó sus datos en la portada para probar el producto.
 *
 * Corre en el servidor, así que la tabla puede quedar completamente cerrada:
 * `signup_requests` tiene RLS prendido y ninguna política, y la única forma de
 * escribir ahí es esta función con la llave de servicio. Más cerrado que una
 * función `security definer`, que dejaría escribir a cualquiera con la clave
 * pública.
 *
 * El orden importa: **primero se guarda, después se avisa**. Si el mail falla
 * —Resend caído, una variable sin cargar— la solicitud ya está en la base y no
 * se perdió a nadie. Al revés, un error de correo haría desaparecer un cliente
 * potencial sin dejar rastro.
 */

export type EstadoSolicitud = {
  ok: boolean;
  errores?: Partial<Record<"barberia" | "nombre" | "telefono" | "email", string>>;
  /** Un problema que no es culpa de lo que escribió la persona. */
  falla?: string;
};

export async function pedirLaPrueba(
  _anterior: EstadoSolicitud,
  datos: FormData,
): Promise<EstadoSolicitud> {
  const barberia = String(datos.get("barberia") ?? "")
    .trim()
    .replace(/\s+/g, " ");
  const mensaje = String(datos.get("mensaje") ?? "").trim();

  // Los tres campos de siempre se validan con lo mismo que valida al cliente
  // que reserva. Son las mismas reglas y los mismos mensajes: no hay motivo
  // para que "ese número no parece uruguayo" se diga distinto acá.
  const cliente = validarCliente({
    nombre: String(datos.get("nombre") ?? ""),
    telefono: String(datos.get("telefono") ?? ""),
    email: String(datos.get("email") ?? ""),
  });

  const errores: EstadoSolicitud["errores"] = cliente.ok ? {} : { ...cliente.errores };

  if (barberia.length < 2) {
    errores.barberia = "Escribí el nombre de tu barbería.";
  } else if (barberia.length > 80) {
    errores.barberia = "Ese nombre es muy largo.";
  }

  if (Object.keys(errores).length > 0) return { ok: false, errores };
  if (!cliente.ok) return { ok: false, errores };

  const { nombre, telefono, email } = cliente.valores;

  const admin = createAdminClient();

  const { error } = await admin.from("signup_requests").insert({
    shop_name: barberia,
    contact_name: nombre,
    phone: telefono,
    email,
    message: mensaje || null,
  });

  if (error) {
    // Se le dice a la persona que no salió, en vez de mostrarle un "listo" que
    // no es cierto y dejarla esperando un llamado que nunca va a llegar.
    console.error("No se pudo guardar la solicitud:", error.message);
    return {
      ok: false,
      falla: "No se pudo enviar. Probá de nuevo en un momento.",
    };
  }

  // De acá en adelante ya no se puede perder nada: la solicitud está guardada.
  const aviso = await avisarSolicitud({
    barberia,
    nombre,
    telefono,
    email,
    mensaje: mensaje || null,
  });

  if (!aviso.enviado) {
    console.error("Solicitud guardada, pero no se pudo avisar:", aviso.motivo);
  }

  return { ok: true };
}
