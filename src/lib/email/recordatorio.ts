import { Resend } from "resend";

import { escapar } from "@/lib/email/html";
import { remitenteDe } from "@/lib/email/remitente";
import { plazoEnPalabras } from "@/lib/plazo";
import type { Tenant } from "@/lib/tenant/types";

/**
 * El recordatorio, dos horas antes del turno.
 *
 * ⚠️ Solo servidor: lee `RESEND_API_KEY`.
 *
 * **Para qué existe.** No es para que la persona se acuerde: es para que la que
 * no va a ir avise. Una silla vacía a las tres de la tarde es plata que no
 * vuelve, y el que iba a faltar casi nunca avisa por vergüenza de escribir.
 * Un botón en un mail que ya tiene abierto es mucho más fácil que un mensaje.
 *
 * Por eso lo que este mail empuja no es "confirmá": es **cancelá si no venís**.
 * El botón que importa ya existía; lo que faltaba era el recordatorio.
 *
 * Igual que la confirmación: un fallo acá no rompe nada. El turno sigue en pie.
 */

export type DatosRecordatorio = {
  tenant: Tenant;
  para: string;
  cliente: string;
  barbero: string;
  servicio: string;
  /** "Hoy a las 15:00", ya en la zona horaria de la barbería. */
  cuando: string;
  urlTurno: string;
};

function armarHtml(d: DatosRecordatorio): string {
  const c = d.tenant.colors;
  const [primera, ...resto] = d.tenant.name.split(" ");
  const plazo = plazoEnPalabras(d.tenant.cancelDeadlineMinutes);

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
      <p style="margin:0;font:600 11px/1 Helvetica,Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:${c.accent};">Te esperamos</p>
      <p style="margin:10px 0 0;font:700 24px/1.25 Georgia,'Times New Roman',serif;color:${c.ink};">${escapar(d.cuando)}</p>
      <p style="margin:8px 0 0;font:400 14px/1.5 Helvetica,Arial,sans-serif;color:${c.inkMuted};">
        ${escapar(d.servicio)} con ${escapar(d.barbero)}
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
        Si no vas a poder venir, avisanos desde ese link y le damos el lugar a
        otra persona. Se puede cancelar ${escapar(plazo)}.
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

function armarTexto(d: DatosRecordatorio): string {
  return [
    `${d.tenant.name} — te esperamos`,
    "",
    d.cuando,
    `${d.servicio} con ${d.barbero}`,
    d.tenant.address ? `\nDónde: ${d.tenant.address}` : "",
    "",
    `Ver o cancelar: ${d.urlTurno}`,
    `Si no vas a poder venir, avisanos desde ese link. Se puede cancelar ${plazoEnPalabras(d.tenant.cancelDeadlineMinutes)}.`,
  ]
    .filter(Boolean)
    .join("\n");
}

export type ResultadoEnvio = { enviado: true } | { enviado: false; motivo: string };

export async function enviarRecordatorio(
  d: DatosRecordatorio,
): Promise<ResultadoEnvio> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;

  if (!apiKey || !from) {
    return { enviado: false, motivo: "RESEND_API_KEY o RESEND_FROM sin definir" };
  }

  try {
    const { error } = await new Resend(apiKey).emails.send({
      from: remitenteDe(d.tenant.name, from),
      // El remitente lo pone el dominio verificado; la respuesta, la barbería.
      // Sin esto, quien contesta "no voy a poder ir" le escribe a una casilla
      // que el local no lee.
      ...(d.tenant.replyToEmail ? { replyTo: d.tenant.replyToEmail } : {}),
      to: d.para,
      subject: `${d.cuando} tenés turno en ${d.tenant.name}`,
      html: armarHtml(d),
      text: armarTexto(d),
    });

    if (error) return { enviado: false, motivo: error.message };
    return { enviado: true };
  } catch (e) {
    return { enviado: false, motivo: e instanceof Error ? e.message : String(e) };
  }
}
