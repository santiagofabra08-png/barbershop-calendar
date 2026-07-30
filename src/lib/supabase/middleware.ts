import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { publicEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/types";

/**
 * Renueva la sesión en cada pedido.
 *
 * El token de Supabase dura una hora. Sin esto, el barbero deja el panel
 * abierto, vuelve a la tarde y está afuera. Acá se refresca solo y las cookies
 * nuevas viajan tanto al servidor —para que el render de esta misma página ya
 * use la sesión nueva— como al navegador.
 *
 * ⚠️ Esto NO es el guardia del panel. El middleware corre antes de saber quién
 * sos en la barbería, y confiar solo en él para proteger rutas es un error
 * conocido en Next. Quien decide si entrás es el layout de `/panel`, y por
 * abajo Row Level Security, que no depende de que ningún código nuestro se
 * acuerde de preguntar.
 */
export async function refrescarSesion(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    publicEnv.supabaseUrl,
    publicEnv.supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getUser y no getSession: getSession lee la cookie y confía en lo que dice.
  // getUser va al servidor de Supabase y verifica la firma del token. La
  // diferencia importa, porque una cookie la escribe cualquiera.
  await supabase.auth.getUser();

  return response;
}
