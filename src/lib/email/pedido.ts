import { Resend } from "resend";

import { remitenteDe } from "@/lib/email/remitente";
import { formatPrice } from "@/lib/schedule";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Tenant } from "@/lib/tenant/types";
import { formatTelefono } from "@/lib/validation";
import { linkDeWhatsApp, mensajeDePedido } from "@/lib/whatsapp";

/**
 * Aviso al dueño de que alguien pidió algo.
 *
 * ⚠️ Solo servidor: lee `RESEND_API_KEY` y usa el cliente con service role.
 *
 * Misma regla que el mail de confirmación: **un fallo acá nunca puede romper un
 * pedido**. El pedido ya está guardado y visible en el panel cuando esto corre.
 * Si Resend está caído o falta la clave, se anota en el log y se sigue.
 *
 * El mail no es el sistema: es el empujón. Lo que hay que atender vive en el
 * panel, que es donde se marca. Por eso el mail no lleva ningún botón que
 * cambie nada —un link que marcara "contactado" desde el mail sería un link
 * que cualquiera con el mail reenviado podría tocar—.
 */

export type PedidoParaAvisar = {
  tenant: Tenant;
  cliente: string;
  telefono: string;
  email: string | null;
  nota: string | null;
  items: { name: string; unitPriceCents: number; quantity: number }[];
  urlPanel: string;
};

function escapar(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * A dónde se avisa: al mail del dueño.
 *
 * Se busca con el cliente de service role porque quien acaba de hacer el
 * pedido no tiene sesión, y el mail de un barbero no lo puede leer el público
 * —ni tiene por qué—. Va filtrado por `tenant_id` a mano: acá no hay RLS que
 * ataje un error.
 */
async function mailesDelLocal(tenantId: string): Promise<string[]> {
  const sb = createAdminClient();

  const { data } = await sb
    .from("barbers")
    .select("email")
    .eq("tenant_id", tenantId)
    .eq("role", "owner")
    .eq("is_active", true);

  return ((data ?? []) as { email: string | null }[])
    .map((b) => b.email)
    .filter((e): e is string => Boolean(e));
}

export type ResultadoAviso = { enviado: true } | { enviado: false; motivo: string };

export async function avisarDelPedido(
  d: PedidoParaAvisar,
): Promise<ResultadoAviso> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;

  if (!apiKey || !from) {
    return { enviado: false, motivo: "RESEND_API_KEY o RESEND_FROM sin definir" };
  }

  const para = await mailesDelLocal(d.tenant.id);
  if (para.length === 0) {
    return { enviado: false, motivo: "la barbería no tiene un dueño con mail" };
  }

  const c = d.tenant.colors;
  const plata = (cents: number) => formatPrice(cents, d.tenant.currency);
  const total = d.items.reduce(
    (t, i) => t + i.unitPriceCents * i.quantity,
    0,
  );

  const renglones = d.items
    .map(
      (i) =>
        `<tr><td style="padding:6px 0;font:400 14px/1.4 Helvetica,Arial,sans-serif;color:${c.ink};">${escapar(i.name)}${i.quantity > 1 ? ` ×${i.quantity}` : ""}</td>` +
        `<td align="right" style="padding:6px 0;font:400 14px/1.4 Helvetica,Arial,sans-serif;color:${c.inkMuted};">${escapar(plata(i.unitPriceCents * i.quantity))}</td></tr>`,
    )
    .join("");

  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${c.bg};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${c.bg};padding:32px 16px;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:${c.surface};border:1px solid ${c.ink}1f;">

    <tr><td style="padding:32px 32px 0;">
      <p style="margin:0;font:600 11px/1 Helvetica,Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:${c.accent};">Pedido nuevo</p>
      <p style="margin:10px 0 0;font:700 24px/1.25 Georgia,'Times New Roman',serif;color:${c.ink};">${escapar(d.cliente)}</p>
      <p style="margin:8px 0 0;font:400 14px/1.5 Helvetica,Arial,sans-serif;color:${c.inkMuted};">
        ${escapar(formatTelefono(d.telefono))}${d.email ? `<br>${escapar(d.email)}` : ""}
      </p>
    </td></tr>

    <tr><td style="padding:24px 32px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${c.ink}1f;">
        ${renglones}
        <tr><td style="padding:10px 0 0;border-top:1px solid ${c.ink}1f;font:600 11px/1 Helvetica,Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:${c.inkMuted};">Serían</td>
            <td align="right" style="padding:10px 0 0;border-top:1px solid ${c.ink}1f;font:700 16px/1 Georgia,'Times New Roman',serif;color:${c.ink};">${escapar(plata(total))}</td></tr>
      </table>
    </td></tr>

    ${
      d.nota
        ? `<tr><td style="padding:20px 32px 0;">
      <p style="margin:0;padding:12px 16px;background:${c.ink}0a;font:400 14px/1.5 Helvetica,Arial,sans-serif;color:${c.ink};">${escapar(d.nota)}</p>
    </td></tr>`
        : ""
    }

    <tr><td style="padding:24px 32px 0;">
      <a href="${escapar(
        linkDeWhatsApp(
          d.telefono,
          mensajeDePedido({
            barberia: d.tenant.name,
            cliente: d.cliente,
            items: d.items,
            totalCents: total,
            moneda: d.tenant.currency,
          }),
        ),
      )}" style="display:block;padding:14px 24px;background:${c.accent};color:${c.surface};font:600 12px/1 Helvetica,Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;text-align:center;text-decoration:none;">Escribirle por WhatsApp</a>
    </td></tr>

    <tr><td style="padding:24px 32px 32px;">
      <p style="margin:0;padding-top:20px;border-top:1px solid ${c.ink}1f;font:400 13px/1.6 Helvetica,Arial,sans-serif;color:${c.inkMuted};">
        No se cobró nada ni bajó el stock: esto es alguien que quiere algo.
        Cuando pase a buscarlo, cobralo desde Cobros, en Mostrador.
        <br><br>
        <a href="${escapar(d.urlPanel)}" style="color:${c.ink};">Ver el pedido en el panel</a>
      </p>
    </td></tr>

  </table>
</td></tr></table>
</body></html>`;

  const texto = [
    `${d.tenant.name} — pedido nuevo`,
    "",
    d.cliente,
    formatTelefono(d.telefono),
    d.email ?? "",
    "",
    ...d.items.map(
      (i) =>
        `${i.name}${i.quantity > 1 ? ` ×${i.quantity}` : ""} — ${plata(i.unitPriceCents * i.quantity)}`,
    ),
    `Serían ${plata(total)}`,
    d.nota ? `\nNota: ${d.nota}` : "",
    "",
    "No se cobró nada ni bajó el stock. Cuando pase a buscarlo, cobralo desde Cobros, en Mostrador.",
    d.urlPanel,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const { error } = await new Resend(apiKey).emails.send({
      // Firma la barbería, no el entorno: si el dueño tiene dos locales, el
      // remitente es lo que le dice de cuál le acaban de pedir algo.
      from: remitenteDe(d.tenant.name, from),
      to: para,
      subject: `Pedido nuevo de ${d.cliente} — ${d.tenant.name}`,
      // Contesta al cliente si tiene mail. Es el gesto obvio al leer el aviso.
      replyTo: d.email ?? undefined,
      html,
      text: texto,
    });

    if (error) return { enviado: false, motivo: error.message };
    return { enviado: true };
  } catch (e) {
    return { enviado: false, motivo: e instanceof Error ? e.message : String(e) };
  }
}
