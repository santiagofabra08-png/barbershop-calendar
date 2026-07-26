import { createBrowserClient } from "@supabase/ssr";

import { publicEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/types";

/**
 * Cliente para componentes cliente ("use client").
 * Usa la anon key: toda lectura/escritura pasa por Row Level Security.
 */
export function createClient() {
  return createBrowserClient<Database>(
    publicEnv.supabaseUrl,
    publicEnv.supabaseAnonKey,
  );
}
