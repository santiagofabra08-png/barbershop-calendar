/**
 * Lectura de variables de entorno con validación al arranque.
 * Falla temprano y con un mensaje claro en vez de reventar en runtime.
 *
 * `process.env.X` se escribe literal a propósito: Next reemplaza las
 * NEXT_PUBLIC_* en build time solo si el acceso es estático.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Falta la variable de entorno ${name}. Copiá .env.example a .env.local y completala.`,
    );
  }
  return value;
}

/**
 * Seguro en el browser.
 * Getters y no constantes: así el módulo se puede importar sin las variables
 * presentes (build, tests) y la validación corre recién al leer cada valor.
 */
export const publicEnv = {
  get supabaseUrl() {
    return required(
      "NEXT_PUBLIC_SUPABASE_URL",
      process.env.NEXT_PUBLIC_SUPABASE_URL,
    );
  },
  get supabaseAnonKey() {
    return required(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    );
  },
  get rootDomain() {
    return required(
      "NEXT_PUBLIC_ROOT_DOMAIN",
      process.env.NEXT_PUBLIC_ROOT_DOMAIN,
    );
  },
  get appUrl() {
    return required("NEXT_PUBLIC_APP_URL", process.env.NEXT_PUBLIC_APP_URL);
  },
};

/**
 * SOLO servidor. Nunca importar desde un componente cliente.
 * Es una función y no una constante para que el módulo pueda cargarse
 * sin la key presente (build, tests) y falle recién al usarla.
 */
export function serviceRoleKey(): string {
  return required(
    "SUPABASE_SERVICE_ROLE_KEY",
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}
