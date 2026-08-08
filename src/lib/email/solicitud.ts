import { Resend } from "resend";

import { formatTelefono, paraWhatsApp } from "@/lib/validation";

/**
 * El aviso de que alguien quiere probar el producto.
 *
 * ⚠️ Solo servidor: lee `RESEND_API_KEY`.
 *
 * Va para adentro, no para el cliente: lo lee Santiago. Por eso no tiene marca
 * ni diseño de barbería —no hay barbería todavía— y está armado para una sola
 * cosa: que desde el teléfono, en diez segundos, se pueda tocar el número y
 * escribirle a la persona.
 *
 * Como el mail de confirmación, **un fallo acá nunca puede perder la
 * solicitud**: cuando esto corre, la fila ya está guardada en la base. Si
 * Resend está caído, la solicitud sigue existiendo y se puede leer de la tabla.
 */

export type DatosSolicitud = {
  barberia: string;
  nombre: string;
  telefono: string; // +598XXXXXXXX
  email: string;
  mensaje?: string | null;
};

function escapar(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function armarHtml(d: DatosSolicitud): string {
  const wa = `https://wa.me/${paraWhatsApp(d.telefono)}`;
  const saludo = encodeURIComponent(
    `Hola ${d.nombre.split(" ")[0]}, soy de turnos para barberías. ` +
      `Vi que dejaste los datos de ${d.barberia}. ¿Arrancamos la prueba?`,
  );

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#eef0f6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef0f6;padding:32px 16px;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:10px;">

    <tr><td style="padding:28px 28px 0;">
      <p style="margin:0;font:600 11px/1 Helvetica,Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#2e3ab0;">Quieren probarlo</p>
      <p style="margin:10px 0 0;font:700 24px/1.25 Helvetica,Arial,sans-serif;color:#101426;">${escapar(d.barberia)}</p>
    </td></tr>

    <tr><td style="padding:22px 28px 0;">
      <p style="margin:0;font:400 15px/1.7 Helvetica,Arial,sans-serif;color:#101426;">
        <strong>${escapar(d.nombre)}</strong><br>
        ${escapar(formatTelefono(d.telefono))}<br>
        <a href="mailto:${escapar(d.email)}" style="color:#2e3ab0;">${escapar(d.email)}</a>
      </p>
    </td></tr>

    ${
      d.mensaje
        ? `<tr><td style="padding:20px 28px 0;">
      <p style="margin:0;padding:14px 16px;background:#eef0f6;border-radius:8px;font:400 14px/1.6 Helvetica,Arial,sans-serif;color:#101426;">${escapar(d.mensaje)}</p>
    </td></tr>`
        : ""
    }

    <tr><td style="padding:24px 28px 28px;">
      <a href="${wa}?text=${saludo}" style="display:block;padding:14px 24px;background:#2e3ab0;color:#ffffff;font:600 13px/1 Helvetica,Arial,sans-serif;letter-spacing:.06em;text-transform:uppercase;text-align:center;text-decoration:none;border-radius:8px;">Escribirle por WhatsApp</a>
      <p style="margin:16px 0 0;font:400 13px/1.6 Helvetica,Arial,sans-serif;color:#5b6076;">
        Para darla de alta:<br>
        <code style="font:400 12px/1.6 monospace;color:#101426;">node --env-file=.env.local scripts/crear-barberia.mts</code>
      </p>
    </td></tr>

  </table>
</td></tr></table>
</body></html>`;
}

function armarTexto(d: DatosSolicitud): string {
  return [
    `Quieren probarlo: ${d.barberia}`,
    "",
    d.nombre,
    formatTelefono(d.telefono),
    d.email,
    d.mensaje ? `\n"${d.mensaje}"` : "",
    "",
    `WhatsApp: https://wa.me/${paraWhatsApp(d.telefono)}`,
    "",
    "Para darla de alta:",
    "node --env-file=.env.local scripts/crear-barberia.mts",
  ]
    .filter(Boolean)
    .join("\n");
}

export type ResultadoAviso = { enviado: true } | { enviado: false; motivo: string };

export async function avisarSolicitud(d: DatosSolicitud): Promise<ResultadoAviso> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  // A quién se le avisa. Server-only a propósito: es tu casilla, no tiene por
  // qué viajar al navegador de todo el que abre la portada.
  const para = process.env.SOLICITUDES_MAIL;

  if (!apiKey || !from || !para) {
    return {
      enviado: false,
      motivo: "RESEND_API_KEY, RESEND_FROM o SOLICITUDES_MAIL sin definir",
    };
  }

  try {
    const { error } = await new Resend(apiKey).emails.send({
      from,
      to: para,
      // El nombre de la barbería en el asunto: en una bandeja llena, es lo que
      // deja ver de un vistazo cuántos entraron y de dónde.
      subject: `Quieren probarlo: ${d.barberia}`,
      replyTo: d.email,
      html: armarHtml(d),
      text: armarTexto(d),
    });

    if (error) return { enviado: false, motivo: error.message };
    return { enviado: true };
  } catch (e) {
    return { enviado: false, motivo: e instanceof Error ? e.message : String(e) };
  }
}
