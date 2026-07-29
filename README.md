# Barbershop Booking Platform

Plataforma multi-tenant de reservas para barberías. Un solo código y una sola
base de datos para muchas barberías; cada una con sus barberos, servicios,
horarios y marca.

Dos superficies:

- **Página pública de reservas** — el cliente elige barbero, día y hora. Sin login.
- **Panel** — dueño y barberos gestionan su agenda. Con login. _(en construcción)_

Las convenciones del proyecto (multi-tenancy, reglas de reserva, diseño) están
en [CLAUDE.md](CLAUDE.md). Leelo antes de tocar código.

## Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS v4 (compilado, sin CDN)
- Supabase — Postgres, Auth, Storage y Row Level Security
- Resend para los mails de confirmación
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

### Abrirlo desde el celular

Tiene que estar en el mismo WiFi. Se usa la IP de la computadora, no
`localhost` — que desde el celular significa "el celular". La imprime el propio
servidor al arrancar, en la línea `Network`.

## Scripts

| Script              | Qué hace                                    |
| ------------------- | ------------------------------------------- |
| `npm run dev`       | Servidor de desarrollo (Turbopack)          |
| `npm test`          | Tests con `node --test`, sin dependencias   |
| `npm run typecheck` | TypeScript sin emitir                       |
| `npm run lint`      | ESLint                                      |
| `npm run build`     | Build de producción                         |
| `npm run start`     | Sirve el build                              |

## Estructura

```
src/
  app/
    page.tsx                    portada: elegir barbero, día y hora
    reservar/                   datos del cliente y alta del turno
    turno/[token]/              ver, cancelar y bajar al calendario
    icon.svg                    favicon: un poste genérico, no el de un cliente
  components/                   piezas compartidas de la página pública
  lib/
    schedule.ts                 grilla de horarios y ventana de reserva (puro)
    validation.ts               nombre, teléfono y mail (puro)
    env.ts                      lectura validada de variables de entorno
    email/send.ts               mail de confirmación (solo servidor)
    tenant/
      resolve.ts                de qué barbería es la petición
      load.ts                   de filas de Supabase a la forma de la pantalla
      types.ts                  la forma que usa la interfaz
    supabase/
      client.ts                 browser  — anon key, RLS activo
      server.ts                 servidor — anon key + sesión, RLS activo
      admin.ts                  service role — ⚠️ saltea RLS, solo servidor
      types.ts                  tipos generados de la DB (no editar a mano)
supabase/
  migrations/                   el esquema, en SQL versionado
  seed_tropi.sql                datos de la primera barbería
brand/<slug>/                   material de referencia: logo, fotos, guía
docs/                           puesta en marcha
```

## Base de datos

Cinco tablas, todas con `tenant_id` y RLS: `tenants`, `barbers`, `services`,
`working_hours` y `appointments` — que guarda reservas y bloqueos juntos,
porque para calcular disponibilidad son lo mismo.

Las migraciones se aplican pegándolas en el SQL Editor de Supabase, en orden.
Los tipos de TypeScript se regeneran desde el esquema:

```bash
npx supabase gen types typescript --project-id <ref> > src/lib/supabase/types.ts
```

## Seguridad

- RLS activo en toda tabla con datos de barbería. No se desactiva.
- El público **no puede leer `appointments`**, ni una fila: tiene nombres,
  teléfonos y mails. Los horarios libres se calculan del lado del servidor y se
  devuelven sin datos de nadie.
- `SUPABASE_SERVICE_ROLE_KEY` nunca se prefija con `NEXT_PUBLIC_` ni se importa
  desde un componente cliente.
- El servidor calcula y valida el horario final de una reserva; nunca se confía
  en el horario que manda el navegador.
- Turnos superpuestos los impide Postgres con una restricción de exclusión, no
  la aplicación: verificar y después insertar deja una ventana donde otro se
  cuela.
