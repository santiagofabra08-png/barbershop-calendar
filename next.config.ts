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
  process.env.DEV_ALLOWED_ORIGINS ?? "192.168.*.*,10.*.*.*,172.16.*.*,*.local"
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
