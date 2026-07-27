/**
 * Tipos de la base de datos.
 *
 * Este archivo se REGENERA, no se edita a mano:
 *   npx supabase login
 *   npx supabase gen types typescript --project-id <ref> > src/lib/supabase/types.ts
 *
 * Hasta que se genere, este placeholder deja pasar cualquier tabla y cualquier
 * función. La seguridad de tipos real vive por ahora en `@/lib/tenant/load`,
 * que declara la forma de cada fila en el borde.
 */

type FilaGenerica = Record<string, unknown>;

export type Database = {
  public: {
    Tables: {
      [tabla: string]: {
        Row: FilaGenerica;
        Insert: FilaGenerica;
        Update: FilaGenerica;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      [funcion: string]: {
        Args: FilaGenerica;
        Returns: unknown;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
