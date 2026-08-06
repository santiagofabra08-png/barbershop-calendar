/**
 * ¿Los mails salen de verdad?
 *
 *   node --env-file=.env.local scripts/probar-mail.mts vos@ejemplo.com
 *
 * Manda un mail real por Resend, con el remitente configurado en `RESEND_FROM`.
 * Es la única forma de saber si el dominio quedó verificado: la pantalla de
 * Resend puede decir "Verified" y el mail rebotar igual por un registro mal
 * copiado.
 *
 * Existe porque este es el único fallo del sistema que NO se nota. Un mail que
 * no sale no rompe ninguna reserva —está hecho así a propósito, el turno se
 * guarda igual— y no aparece un error en ninguna pantalla. El cliente
 * simplemente no recibe nada y la barbería se entera cuando alguien no viene.
 */
import { Resend } from "resend";

const para = process.argv[2];

if (!para) {
  console.error(
    "Falta a quién mandárselo.\n" +
      "  node --env-file=.env.local scripts/probar-mail.mts vos@ejemplo.com",
  );
  process.exit(1);
}

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.RESEND_FROM;

if (!apiKey || !from) {
  console.error(
    "Faltan RESEND_API_KEY o RESEND_FROM en .env.local.\n" +
      "¿Corriste el comando con --env-file=.env.local?",
  );
  process.exit(1);
}

// El dominio del remitente es lo que Resend compara contra los verificados.
const dominio = from.match(/@([^>\s]+)/)?.[1] ?? "(no se entiende)";

console.log(`\nMandando desde ${from}\n            a ${para}\n`);

const resend = new Resend(apiKey);

const { data, error } = await resend.emails.send({
  from,
  to: para,
  subject: "Prueba de envío",
  text:
    "Si estás leyendo esto, los mails de la barbería funcionan.\n\n" +
    `Salió desde ${dominio}.\n\n` +
    "Esto lo manda scripts/probar-mail.mts y no le llega a ningún cliente.",
});

if (error) {
  console.error(`✗ No salió.\n  ${error.message}\n`);

  const m = error.message.toLowerCase();

  // Los tres errores que se ven en la práctica, con el arreglo al lado.
  if (m.includes("domain is not verified") || m.includes("not verified")) {
    console.error(
      `  El dominio ${dominio} todavía no está verificado en Resend.\n` +
        "  · Si recién cargaste los registros DNS, esperá: tarda hasta unas horas.\n" +
        "  · Revisá en resend.com → Domains si dice Verified o Pending.\n" +
        "  · El error más común es copiar el dominio entero en el campo Host.\n" +
        "    Va solo la parte de adelante: `send`, no `send.tudominio.com`.\n",
    );
  } else if (m.includes("api key") || m.includes("unauthorized")) {
    console.error(
      "  La API key no sirve. Generá una nueva en resend.com → API Keys\n" +
        "  y pegala en RESEND_API_KEY.\n",
    );
  } else if (m.includes("testing emails") || m.includes("own email")) {
    console.error(
      "  Estás usando el remitente de prueba de Resend, que solo entrega\n" +
        "  al dueño de la cuenta. Verificá un dominio propio y cambiá\n" +
        "  RESEND_FROM.\n",
    );
  }

  process.exit(1);
}

console.log(
  `✓ Salió. Id: ${data?.id}\n\n` +
    `  Fijate en la bandeja de ${para} —y en el correo no deseado—.\n` +
    "  Si llegó y no cayó en spam, el dominio está bien configurado.\n",
);
