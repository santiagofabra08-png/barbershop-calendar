import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { publicEnv, serviceRoleKey } from "@/lib/env";
import type { Database } from "@/lib/supabase/types";

/**
 * ⚠️ Cliente con service role: SALTEA Row Level Security por completo.
 *
 * Nunca importar este módulo desde un archivo con "use client" ni desde
 * código que llegue al browser. Usar solo en Route Handlers / Server Actions
 * y siempre filtrando por `tenant_id` a mano, porque acá no hay red de
 * seguridad de RLS.
 *
 * Casos válidos: webhooks, envío de mails, jobs. Para todo lo demás usá
 * `@/lib/supabase/server`.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    publicEnv.supabaseUrl,
    serviceRoleKey(),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
