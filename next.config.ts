import type { NextConfig } from "next";

// Los logos de cada barbería viven en Supabase Storage. next/image solo carga
// imágenes de hosts declarados, así que se toma el host del propio proyecto de
// Supabase en vez de escribirlo fijo: cada entorno apunta al suyo.
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
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
