import { Resend } from "resend";

import { escapar } from "@/lib/email/html";
import { remitenteDe } from "@/lib/email/remitente";
import { plazoEnPalabras } from "@/lib/plazo";
import type { Tenant } from "@/lib/tenant/types";

/**
 * Mail de confirmación de un turno.
 *
 * ⚠️ Solo servidor: lee `RESEND_API_KEY`. Nunca importar desde un componente
 * con "use client".
 *
 * Regla principal: **un fallo acá nunca puede romper una reserva**. El turno
 * ya está guardado cuando esto corre. Si Resend está caído, si falta la clave
 * o si el mail rebota, se anota en el log y se sigue: el cliente igual tiene
 * su turno y su link en pantalla.
 *
 * Por eso todo devuelve un resultado en vez de tirar excepción.
 */

export type DatosConfirmacion = {
  tenant: Tenant;
  para: string;
  cliente: string;
  barbero: string;
  servicio: string;
  cuando: string; // "Sábado 1 de agosto, 15:20"
  precio: string;
  duracion: string;
  urlTurno: string;
};

/**
 * Los clientes de mail son de 2005: nada de flexbox ni de grid, todo con
 * tablas y estilos en línea. Los colores igual salen del tenant.
 */
function armarHtml(d: DatosConfirmacion): string {
  const c = d.tenant.colors;
  const [primera, ...resto] = d.tenant.name.split(" ");

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${c.bg};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${c.bg};padding:32px 16px;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:${c.surface};border:1px solid ${c.ink}1f;">

    <tr><td style="padding:32px 32px 0;">
      <p style="margin:0;font:600 11px/1 Helvetica,Arial,sans-serif;letter-spacing:.4em;text-transform:uppercase;color:${c.ink};">${escapar(primera)}</p>
      ${resto.length ? `<p style="margin:6px 0 0;font:700 26px/1 Georgia,'Times New Roman',serif;color:${c.ink};">${escapar(resto.join(" "))}</p>` : ""}
      <div style="height:5px;margin-top:14px;background:repeating-linear-gradient(135deg,${c.accent} 0 10px,${c.surface} 10px 16px,${c.accentAlt} 16px 26px,${c.surface} 26px 32px);"></div>
    </td></tr>

    <tr><td style="padding:28px 32px 0;">
      <p style="margin:0;font:600 11px/1 Helvetica,Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:${c.accent};">Turno confirmado</p>
      <p style="margin:10px 0 0;font:700 24px/1.25 Georgia,'Times New Roman',serif;color:${c.ink};">${escapar(d.cuando)}</p>
      <p style="margin:8px 0 0;font:400 14px/1.5 Helvetica,Arial,sans-serif;color:${c.inkMuted};">
        ${escapar(d.servicio)} con ${escapar(d.barbero)}<br>
        ${escapar(d.duracion)} · ${escapar(d.precio)}
      </p>
    </td></tr>

    ${
      d.tenant.address
        ? `<tr><td style="padding:24px 32px 0;">
      <p style="margin:0;font:600 11px/1 Helvetica,Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:${c.inkMuted};">Dónde</p>
      <p style="margin:8px 0 0;font:400 14px/1.5 Helvetica,Arial,sans-serif;color:${c.ink};">${escapar(d.tenant.address)}</p>
    </td></tr>`
        : ""
    }

    <tr><td style="padding:28px 32px 0;">
      <a href="${escapar(d.urlTurno)}" style="display:block;padding:14px 24px;background:${c.accent};color:${c.surface};font:600 12px/1 Helvetica,Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;text-align:center;text-decoration:none;">Ver o cancelar el turno</a>
      <p style="margin:14px 0 0;font:400 13px/1.6 Helvetica,Arial,sans-serif;color:${c.inkMuted};">
        Guardá este mail: el link de arriba es la forma de cancelar si no podés ir.
        Se puede cancelar ${plazoEnPalabras(d.tenant.cancelDeadlineMinutes)}.
      </p>
    </td></tr>

    <tr><td style="padding:24px 32px 32px;">
      <p style="margin:0;padding-top:20px;border-top:1px solid ${c.ink}1f;font:400 13px/1.6 Helvetica,Arial,sans-serif;color:${c.inkMuted};">
        Se paga en el local, en efectivo o por transferencia.
      </p>
    </td></tr>

  </table>
</td></tr></table>
</body></html>`;
}

function armarTexto(d: DatosConfirmacion): string {
  return [
    `${d.tenant.name} — turno confirmado`,
    "",
    d.cuando,
    `${d.servicio} con ${d.barbero}`,
    `${d.duracion} · ${d.precio}`,
    d.tenant.address ? `\nDónde: ${d.tenant.address}` : "",
    "",
    `Ver o cancelar: ${d.urlTurno}`,
    `Se puede cancelar ${plazoEnPalabras(d.tenant.cancelDeadlineMinutes)}.`,
    "",
    "Se paga en el local, en efectivo o por transferencia.",
  ]
    .filter(Boolean)
    .join("\n");
}

export type ResultadoEnvio =
  | { enviado: true }
  | { enviado: false; motivo: string };

export async function enviarConfirmacion(
  d: DatosConfirmacion,
): Promise<ResultadoEnvio> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;

  if (!apiKey || !from) {
    // Sin configurar no es un error: el proyecto anda igual, sin mails.
    return { enviado: false, motivo: "RESEND_API_KEY o RESEND_FROM sin definir" };
  }

  try {
    const { error } = await new Resend(apiKey).emails.send({
      // El nombre lo pone la barbería, no el entorno: en la bandeja de entrada
      // el remitente es casi lo único que se lee antes de abrir, y ahí tiene
      // que decir el local donde el cliente reservó.
      from: remitenteDe(d.tenant.name, from),
      // El remitente lo pone el dominio verificado; la respuesta, la barbería.
      // Sin esto, quien contesta "no voy a poder ir" le escribe a una casilla
      // que el local no lee.
      ...(d.tenant.replyToEmail ? { replyTo: d.tenant.replyToEmail } : {}),
      to: d.para,
      subject: `Tu turno en ${d.tenant.name} — ${d.cuando}`,
      html: armarHtml(d),
      text: armarTexto(d),
    });

    if (error) return { enviado: false, motivo: error.message };
    return { enviado: true };
  } catch (e) {
    return { enviado: false, motivo: e instanceof Error ? e.message : String(e) };
  }
}
