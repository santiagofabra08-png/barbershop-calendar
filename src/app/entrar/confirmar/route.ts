import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * La vuelta del link del mail.
 *
 * Supabase manda a esta dirección con un código de un solo uso. Acá se canjea
 * por una sesión y recién ahí se puede elegir la contraseña nueva.
 *
 * Es una ruta y no una página por un detalle de Next: canjear el código escribe
 * cookies, y una página no puede escribirlas mientras se dibuja. Se canjea acá,
 * se redirige, y la pantalla siguiente ya encuentra la sesión hecha.
 */
export async function GET(request: NextRequest) {
  // ⚠️ La dirección se arma con el `host` del pedido y NO con `request.url`.
  //
  // Next normaliza `request.url` al origen interno del servidor, así que salía
  // `localhost:3000`. Con una sola barbería eso sería feo; con varias es un
  // error: el dueño de Studio Norte volvería del mail a la página de otro
  // local, o a ninguna. El subdominio ES la barbería.
  const host = request.headers.get("host");
  const protocolo =
    request.headers.get("x-forwarded-proto") ??
    (host?.includes("localhost") || host?.includes("lvh.me") ? "http" : "https");
  const aca = (ruta: string) => `${protocolo}://${host}${ruta}`;

  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(aca("/entrar/recuperar?vencido=1"));
  }

  const sb = await createClient();
  const { error } = await sb.auth.exchangeCodeForSession(code);

  if (error) {
    // Un link vencido o ya usado no es un error del sistema: es lo que pasa
    // cuando alguien pide dos y abre el viejo. Se lo manda a pedir otro.
    return NextResponse.redirect(aca("/entrar/recuperar?vencido=1"));
  }

  return NextResponse.redirect(aca("/entrar/nueva-clave"));
}
