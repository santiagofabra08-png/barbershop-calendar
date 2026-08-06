/**
 * ¿Por qué no llega el mail de "no me acuerdo"?
 *
 *   node --env-file=.env.local scripts/probar-recuperar.mts <mail> [slug]
 *
 * La pantalla contesta siempre lo mismo, exista o no ese mail: decir "esa
 * cuenta no existe" le confirma a cualquiera qué cuentas hay. Eso está bien
 * para el que mira desde afuera y es inútil para arreglar algo, así que este
 * script pide lo mismo sin esa protección y muestra el error tal cual.
 *
 * Sirve para separar tres problemas que se parecen desde afuera:
 *   · la cuenta no existe o está de baja
 *   · Supabase no puede entregarle el mail a Resend (SMTP mal configurado)
 *   · el límite de envíos
 *
 * Es el mail de la CUENTA, que sale por Supabase. El de la barbería
 * —confirmación de turno, pedido— sale por Resend y se prueba con
 * `probar-mail.mts`. Son dos configuraciones distintas que fallan por separado.
 */
import { createClient } from "@supabase/supabase-js";

const email = (process.argv[2] ?? "").trim().toLowerCase();
const slug = process.argv[3] ?? "tropi-barbershop";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!email || !url || !anon || !service) {
  console.error(
    "Falta el mail o alguna variable de entorno.\n" +
      "  node --env-file=.env.local scripts/probar-recuperar.mts <mail> [slug]",
  );
  process.exit(1);
}

const sinSesion = { auth: { autoRefreshToken: false, persistSession: false } };
const admin = createClient(url, service, sinSesion);

// ---- 1. ¿Existe esa cuenta, y trabaja en algún lado? ------------------------
const { data: lista } = await admin.auth.admin.listUsers({ perPage: 200 });
const usuario = lista?.users.find((u) => u.email?.toLowerCase() === email);

console.log("\n── La cuenta ──────────────────────────────────────────");

if (!usuario) {
  console.log(`✗ No hay ninguna cuenta con ${email}.`);
  console.log("  Las que sí existen:");
  for (const u of lista?.users ?? []) console.log(`    · ${u.email}`);
  console.log("");
  process.exit(1);
}

console.log(`✓ Existe: ${usuario.email}`);
console.log(`  Mail confirmado: ${usuario.email_confirmed_at ? "sí" : "NO"}`);
console.log(`  Último ingreso:  ${usuario.last_sign_in_at ?? "nunca"}`);

const { data: filas } = await admin
  .from("barbers")
  .select("display_name, role, is_active, tenants(slug)")
  .eq("user_id", usuario.id);

console.log("  Trabaja en:");
for (const f of filas ?? []) {
  const t = f.tenants as { slug: string } | { slug: string }[] | null;
  const donde = Array.isArray(t) ? t[0]?.slug : t?.slug;
  console.log(
    `    · ${donde} — ${f.display_name} (${f.role})${f.is_active ? "" : " [de baja]"}`,
  );
}

if ((filas ?? []).length === 0) {
  console.log("    (ninguna — esa cuenta no entra a ningún panel)");
}

// ---- 2. Pedir el mail y mirar el error --------------------------------------
console.log("\n── El envío ───────────────────────────────────────────");

const publico = createClient(url, anon, sinSesion);
const { error } = await publico.auth.resetPasswordForEmail(email, {
  redirectTo: `http://${slug}.lvh.me:3000/entrar/confirmar`,
});

if (!error) {
  console.log("✓ Supabase aceptó el pedido y se lo pasó a Resend.\n");
  console.log(`  Fijate en ${email}, y en el correo no deseado.`);
  console.log("  Si igual no aparece, mirá los logs en resend.com → Emails.\n");
  process.exit(0);
}

console.log(`✗ ${error.message || "(sin mensaje)"}`);
console.log(`  código ${error.status ?? "?"}\n`);

const m = error.message.toLowerCase();

if (error.status === 429 || m.includes("rate") || m.includes("seconds")) {
  console.log("  Es el límite de envíos: esperá y probá de nuevo.");
  console.log("  Con SMTP propio el límite lo pone Resend y es mucho más alto.\n");
} else {
  // Un 500 sin mensaje es siempre lo mismo: Supabase no pudo entregarle el
  // mail al servidor SMTP. El error viene vacío porque GoTrue no reenvía lo
  // que le dijo el otro lado.
  console.log("  Supabase no pudo entregarle el mail a Resend.");
  console.log("  Authentication → Emails → SMTP Settings:\n");
  console.log("    Host          smtp.resend.com");
  console.log("    Port          587   (si falla, probá 465)");
  console.log("    Username      resend        ← la palabra, no tu mail ni la key");
  console.log("    Password      la API key de Resend (re_...)");
  console.log("    Sender email  algo@tu-dominio-verificado\n");
  console.log("  Si el mail sí sale con `probar-mail.mts`, el problema está");
  console.log("  seguro en uno de esos cinco campos y no en Resend.\n");
}

process.exit(1);
