/**
 * Validación de los datos del cliente.
 *
 * Funciones puras: entra un string, sale un resultado. Sin base, sin red, sin
 * reloj. Por eso se pueden probar de verdad (ver validation.test.ts).
 *
 * Corren en tres lugares, y no es redundancia:
 *   · en el formulario, para avisar mientras se escribe
 *   · en el servidor, porque el formulario se puede saltear
 *   · en Postgres, porque la base es la última línea
 *
 * Los mensajes de error dicen qué está mal Y cómo arreglarlo. Un "dato
 * inválido" obliga a adivinar.
 */

export type Resultado =
  | { ok: true; valor: string }
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Nombre
// ---------------------------------------------------------------------------

export function validarNombre(entrada: string): Resultado {
  // Espacios de más adentro y afuera: "  Juan   Pérez " → "Juan Pérez"
  const valor = entrada.trim().replace(/\s+/g, " ");

  if (valor === "") {
    return { ok: false, error: "Escribí tu nombre." };
  }
  if (valor.length < 2) {
    return { ok: false, error: "El nombre es muy corto." };
  }
  if (valor.length > 60) {
    return { ok: false, error: "El nombre es muy largo." };
  }

  // Tiene que haber letras de verdad: "123" o "..." no son un nombre.
  const letras = valor.match(/\p{L}/gu)?.length ?? 0;
  if (letras < 2) {
    return { ok: false, error: "Escribí tu nombre, no solo números o símbolos." };
  }

  return { ok: true, valor };
}

// ---------------------------------------------------------------------------
// Teléfono
// ---------------------------------------------------------------------------
//
// Reglas de Uruguay. El día que la plataforma se venda en otro país, esto se
// vuelve una función por país y el tenant elige cuál usar — hoy sería
// inventar complejidad para un caso que no existe.
//
//   celulares  09X XXX XXX   → 9 dígitos, arrancan en 09
//   Montevideo 2XXX XXXX     → 8 dígitos, arrancan en 2
//   interior   4XXX XXXX     → 8 dígitos, arrancan en 4
//
// Se guarda en formato internacional (+598XXXXXXXX) porque es el que necesita
// el link de WhatsApp y no depende de cómo lo escribió cada uno.

const PREFIJOS_VALIDOS = ["9", "2", "4"];

export function validarTelefono(entrada: string): Resultado {
  const crudo = entrada.trim();

  if (crudo === "") {
    return { ok: false, error: "Escribí tu teléfono." };
  }

  // Solo se admiten dígitos y los separadores que la gente usa naturalmente.
  if (/[^\d\s+()-]/.test(crudo)) {
    return { ok: false, error: "El teléfono solo lleva números." };
  }

  let digitos = crudo.replace(/\D/g, "");

  // Prefijo internacional, escrito de cualquiera de las formas.
  if (digitos.startsWith("00598")) digitos = digitos.slice(5);
  else if (digitos.startsWith("598")) digitos = digitos.slice(3);
  // Cero de salida nacional: 099… → 99…
  else if (digitos.length === 9 && digitos.startsWith("0")) digitos = digitos.slice(1);

  if (digitos.length === 0) {
    return { ok: false, error: "Escribí tu teléfono." };
  }
  if (digitos.length < 8) {
    return {
      ok: false,
      error: "Faltan números. Un celular tiene 9, como 099 123 456.",
    };
  }
  if (digitos.length > 8) {
    return {
      ok: false,
      error: "Sobran números. Un celular tiene 9, como 099 123 456.",
    };
  }
  if (!PREFIJOS_VALIDOS.includes(digitos[0])) {
    return {
      ok: false,
      error: "Ese número no parece uruguayo. Un celular empieza con 09.",
    };
  }

  return { ok: true, valor: `+598${digitos}` };
}

/** De +59899123456 a "099 123 456", que es como se lee acá. */
export function formatTelefono(e164: string): string {
  const d = e164.replace(/\D/g, "").replace(/^598/, "");
  if (d.length !== 8) return e164;
  if (d[0] === "9") return `0${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5)}`;
  return `${d.slice(0, 4)} ${d.slice(4)}`;
}

/** El número listo para un link de WhatsApp: wa.me/59899123456 */
export function paraWhatsApp(e164: string): string {
  return e164.replace(/\D/g, "");
}

// ---------------------------------------------------------------------------
// Mail
// ---------------------------------------------------------------------------

export function validarEmail(entrada: string): Resultado {
  const valor = entrada.trim().toLowerCase();

  if (valor === "") {
    return { ok: false, error: "Escribí tu mail." };
  }
  if (valor.length > 254) {
    return { ok: false, error: "Ese mail es demasiado largo." };
  }
  if (/\s/.test(valor)) {
    return { ok: false, error: "El mail no lleva espacios." };
  }

  const partes = valor.split("@");
  if (partes.length !== 2) {
    return { ok: false, error: "Falta el @. Por ejemplo: vos@gmail.com" };
  }

  const [local, dominio] = partes;

  if (local === "" || local.length > 64) {
    return { ok: false, error: "Revisá lo que va antes del @." };
  }
  if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) {
    return { ok: false, error: "Revisá los puntos de tu mail." };
  }
  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local)) {
    return { ok: false, error: "Hay un carácter raro antes del @." };
  }

  if (!dominio.includes(".")) {
    return {
      ok: false,
      error: "Al dominio le falta el punto. Por ejemplo: vos@gmail.com",
    };
  }
  if (dominio.startsWith(".") || dominio.endsWith(".") || dominio.includes("..")) {
    return { ok: false, error: "Revisá los puntos de tu mail." };
  }
  if (!/^[a-z0-9.-]+$/.test(dominio) || dominio.startsWith("-")) {
    return { ok: false, error: "Hay un carácter raro después del @." };
  }

  const tld = dominio.split(".").pop() ?? "";
  if (!/^[a-z]{2,}$/.test(tld)) {
    return { ok: false, error: "Revisá la terminación del mail (.com, .uy…)." };
  }

  return { ok: true, valor };
}

// ---------------------------------------------------------------------------
// Los tres juntos
// ---------------------------------------------------------------------------

export type CamposCliente = {
  nombre: string;
  telefono: string;
  email: string;
};

export type ResultadoCliente =
  | { ok: true; valores: CamposCliente }
  | { ok: false; errores: Partial<Record<keyof CamposCliente, string>> };

/**
 * Valida los tres campos y devuelve TODOS los errores juntos.
 *
 * Cortar en el primero obligaría a la persona a descubrir los problemas de a
 * uno, mandando el formulario tres veces.
 */
export function validarCliente(entrada: CamposCliente): ResultadoCliente {
  const nombre = validarNombre(entrada.nombre);
  const telefono = validarTelefono(entrada.telefono);
  const email = validarEmail(entrada.email);

  const errores: Partial<Record<keyof CamposCliente, string>> = {};
  if (!nombre.ok) errores.nombre = nombre.error;
  if (!telefono.ok) errores.telefono = telefono.error;
  if (!email.ok) errores.email = email.error;

  if (Object.keys(errores).length > 0) return { ok: false, errores };

  return {
    ok: true,
    valores: {
      nombre: (nombre as { ok: true; valor: string }).valor,
      telefono: (telefono as { ok: true; valor: string }).valor,
      email: (email as { ok: true; valor: string }).valor,
    },
  };
}
