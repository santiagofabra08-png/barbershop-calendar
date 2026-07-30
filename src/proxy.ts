import type { NextRequest } from "next/server";

import { refrescarSesion } from "@/lib/supabase/middleware";

/**
 * Corre antes de cada pedido. En Next 16 este archivo se llama `proxy`; hasta
 * la 15 se llamaba `middleware` y hacía exactamente lo mismo.
 */
export default async function proxy(request: NextRequest) {
  return refrescarSesion(request);
}

export const config = {
  matcher: [
    /**
     * Todo menos los archivos que no tienen sesión que renovar: los estáticos
     * de Next, el favicon y las imágenes. Refrescar el token en cada PNG sería
     * una ida al servidor de Supabase por imagen.
     */
    "/((?!_next/static|_next/image|icon.svg|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif)$).*)",
  ],
};
