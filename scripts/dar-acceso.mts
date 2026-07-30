/**
 * Le da acceso al panel a un barbero que ya existe en la base.
 *
 *   node --env-file=.env.local scripts/dar-acceso.mts <slug>
 *       lista los barberos de esa barbería y dice quién puede entrar
 *
 *   node --env-file=.env.local scripts/dar-acceso.mts <slug> <id-del-barbero>
 *       pide mail y contraseña, crea la cuenta y la enlaza con esa fila
 *
 * Esto es solo para el PRIMER acceso de cada barbería —el del dueño—, porque
 * hasta que alguien pueda entrar no hay panel desde donde dar de alta a nadie.
 * De ahí en adelante, los barberos los invita el dueño desde el panel.
 *
 * La contraseña se pide por consola y no por argumento a propósito: lo que se
 * escribe como argumento queda guardado en el historial de la terminal.
 *
 * Usa la service role key, así que saltea RLS. Por eso vive en `scripts/` y no
 * en `src/`: no es parte de la aplicación y no se despliega.
 */
import { createClient } from "@supabase/supabase-js";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const [slug, barberId] = process.argv.slice(2);

if (!slug) {
  console.error(
    "Falta la barbería.\n" +
      "  node --env-file=.env.local scripts/dar-acceso.mts <slug>",
  );
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error(
    "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.\n" +
      "¿Corriste el comando con --env-file=.env.local?",
  );
  process.exit(1);
}

const sb = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: tenant } = await sb
  .from("tenants")
  .select("id, name")
  .eq("slug", slug)
  .maybeSingle();

if (!tenant) {
  console.error(`No existe ninguna barbería con el slug "${slug}".`);
  process.exit(1);
}

const { data: barberos } = await sb
  .from("barbers")
  .select("id, display_name, role, email, user_id, is_active")
  .eq("tenant_id", tenant.id)
  .order("sort_order");

// ---- Sin id: solo listar ---------------------------------------------------
if (!barberId) {
  console.log(`\n${tenant.name}\n`);
  for (const b of barberos ?? []) {
    const estado = b.user_id
      ? `entra con ${b.email ?? "(mail no guardado)"}`
      : "sin acceso";
    const baja = b.is_active ? "" : "  [dado de baja]";
    console.log(`  ${b.id}  ${b.display_name} (${b.role})  — ${estado}${baja}`);
  }
  console.log(
    "\nPara darle acceso a uno:\n" +
      `  node --env-file=.env.local scripts/dar-acceso.mts ${slug} <id-del-barbero>\n`,
  );
  process.exit(0);
}

// ---- Con id: crear la cuenta y enlazarla -----------------------------------
const barbero = (barberos ?? []).find((b) => b.id === barberId);

if (!barbero) {
  console.error(`Ese barbero no es de ${tenant.name}. Revisá el id.`);
  process.exit(1);
}

if (barbero.user_id) {
  console.error(
    `${barbero.display_name} ya tiene acceso (${barbero.email ?? "sin mail guardado"}).\n` +
      "Si perdió la contraseña, se resetea desde el panel de Supabase > Authentication.",
  );
  process.exit(1);
}

const rl = createInterface({ input: stdin, output: stdout });

const email = (await rl.question(`Mail de ${barbero.display_name}: `))
  .trim()
  .toLowerCase();
const password = await rl.question("Contraseña (mínimo 8): ");
rl.close();

if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(email)) {
  console.error("Ese mail no tiene forma de mail.");
  process.exit(1);
}
if (password.length < 8) {
  console.error("La contraseña tiene que tener al menos 8 caracteres.");
  process.exit(1);
}

// `email_confirm: true` porque el mail lo está poniendo el dueño, en persona,
// y no hay a quién mandarle un mail de verificación que ya sabemos que es suyo.
const { data: creado, error: errorAlta } = await sb.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});

if (errorAlta || !creado?.user) {
  console.error(`No se pudo crear la cuenta: ${errorAlta?.message}`);
  process.exit(1);
}

const { error: errorEnlace } = await sb
  .from("barbers")
  .update({ user_id: creado.user.id, email })
  .eq("id", barbero.id);

if (errorEnlace) {
  // La cuenta quedó creada pero suelta. Se borra para no dejar basura: si no,
  // el próximo intento con el mismo mail falla por duplicado y no se entiende.
  await sb.auth.admin.deleteUser(creado.user.id);
  console.error(`No se pudo enlazar la cuenta: ${errorEnlace.message}`);
  process.exit(1);
}

console.log(
  `\nListo. ${barbero.display_name} ya puede entrar al panel con ${email}.\n`,
);
