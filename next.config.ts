import type { NextConfig } from "next";

// Los logos de cada barbería viven en Supabase Storage. next/image solo carga
// imágenes de hosts declarados, así que se toma el host del propio proyecto de
// Supabase en vez de escribirlo fijo: cada entorno apunta al suyo.
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

// En desarrollo, Next bloquea sus propios recursos cuando la página se abre
// desde un host distinto a localhost. Al entrar desde el celular por la IP de
// la computadora, eso deja la página sin JavaScript: se ve, pero los botones
// no responden.
//
// Se habilitan los rangos de red doméstica en vez de una IP concreta, porque
// el router la reasigna. Solo aplica a `next dev`; en producción se ignora.
const origenesDeDesarrollo = (
  // `*.lvh.me` es un dominio público que resuelve a 127.0.0.1, subdominios
  // incluidos. Sirve para probar varias barberías a la vez en desarrollo, por
  // el mismo camino que usa producción —el subdominio— y no por la salida de
  // emergencia de `DEV_TENANT_SLUG`.
  process.env.DEV_ALLOWED_ORIGINS ??
  "192.168.*.*,10.*.*.*,172.16.*.*,*.local,*.lvh.me"
)
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  allowedDevOrigins: origenesDeDesarrollo,
  // Transiciones entre pantallas: al tocar "Continuar", la página no salta,
  // se funde con la siguiente. Lo maneja el navegador, no una librería.
  experimental: {
    viewTransition: true,
    // Las imágenes viajan dentro de una Server Action, y el límite de fábrica
    // es 1 MB —justo el tope de un logo—. Con los otros campos del formulario
    // adentro, un logo de 1 MB no entraría. Las fotos de producto llegan acá ya
    // recortadas por el navegador y pesan centésimas de esto.
    serverActions: {
      bodySizeLimit: "3mb",
    },
  },
  images: {
    remotePatterns: supabaseHost
      ? [
          {
            protocol: "https",
            hostname: supabaseHost,
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [],
  },
};

export default nextConfig;
