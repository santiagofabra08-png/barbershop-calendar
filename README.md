# Barbershop Booking Platform

Plataforma multi-tenant de reservas para barberías. Un solo código y una sola
base de datos para muchas barberías; cada una con sus barberos, servicios,
horarios y marca.

Dos superficies:

- **Página pública de reservas** — el cliente elige servicio, barbero y horario. Sin login.
- **Dashboard** — dueño y barberos gestionan su agenda. Con login.

Las convenciones del proyecto (multi-tenancy, reglas de reserva, diseño) están
en [CLAUDE.md](CLAUDE.md). Leelo antes de tocar código.

## Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS v4 (compilado, sin CDN)
- Supabase — Postgres, Auth y Row Level Security
- Vercel

## Puesta en marcha

```bash
npm install
cp .env.example .env.local   # completá los valores
npm run dev
```

Abrí http://localhost:3000

Las variables van en `.env.local` (nunca se commitea). Para crear el proyecto
de Supabase, aplicar el esquema y cargar las credenciales, seguí
[docs/configurar-supabase.md](docs/configurar-supabase.md).

## Scripts

| Script              | Qué hace                            |
| ------------------- | ----------------------------------- |
| `npm run dev`       | Servidor de desarrollo (Turbopack)  |
| `npm run build`     | Build de producción                 |
| `npm run start`     | Sirve el build                      |
| `npm run lint`      | ESLint                              |
| `npm run typecheck` | TypeScript sin emitir               |

## Estructura

```
src/
  app/                  rutas (App Router)
  lib/
    env.ts              lectura validada de variables de entorno
    supabase/
      client.ts         cliente browser  — anon key, RLS activo
      server.ts         cliente servidor — anon key + sesión, RLS activo
      admin.ts          cliente service role — ⚠️ saltea RLS, solo servidor
      types.ts          tipos generados de la DB (no editar a mano)
supabase/
  migrations/           migraciones SQL, en orden
```

## Base de datos

El esquema vive en `supabase/migrations/` como SQL versionado. Los tipos de
TypeScript se regeneran desde el esquema:

```bash
npx supabase gen types typescript --project-id <ref> > src/lib/supabase/types.ts
```

## Seguridad

- RLS activo en toda tabla con datos de barbería. No se desactiva.
- `SUPABASE_SERVICE_ROLE_KEY` nunca se prefija con `NEXT_PUBLIC_` ni se importa
  desde un componente cliente.
- El servidor calcula y valida el horario final de una reserva; nunca se confía
  en el horario que manda el browser.
