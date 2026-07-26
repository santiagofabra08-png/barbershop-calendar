# Configurar Supabase — paso a paso

Guía para dejar la base andando y las credenciales cargadas. Sin Docker.

Al terminar vas a tener: el proyecto creado, el esquema aplicado, los datos de
Tropi cargados, `.env.local` completo y los tipos de TypeScript generados.

---

## 1. Crear el proyecto

Entrá a [supabase.com](https://supabase.com) → **New project**.

| Campo | Qué poner |
| --- | --- |
| **Name** | `barbershop-calendar` |
| **Database Password** | Generala con el botón y **guardala en tu gestor de contraseñas** |
| **Region** | `South America (São Paulo)` |
| **Plan** | Free |

Dos cosas importantes:

**La contraseña de la base no se puede volver a ver.** Supabase la muestra una
sola vez. Si la perdés hay que resetearla. No es la misma que la de tu cuenta.

**La región importa de verdad.** Cada consulta viaja hasta el servidor y
vuelve. Desde Uruguay, São Paulo son ~30 ms; Virginia son ~120 ms. En una
pantalla que hace varias consultas, esa diferencia se nota. La región **no se
puede cambiar** después sin migrar todo.

El proyecto tarda un par de minutos en levantar.

---

## 2. Aplicar el esquema

Cuando el proyecto esté listo: **SQL Editor** (barra lateral) → **New query**.

1. Abrí `supabase/migrations/20260726120000_esquema_inicial.sql`
2. Copiá **todo** el contenido y pegalo en el editor
3. **Run**

El archivo ya viene con `begin;` y `commit;`: si algo falla, no se crea nada y
podés corregir y volver a correrlo entero. No hace falta limpiar nada.

Si da error, copiame el mensaje completo — dice la línea exacta.

## 3. Cargar los datos de Tropi

Misma pantalla, **New query**. Ahora con `supabase/seed_tropi.sql`.

Esto crea la barbería, a Facundo, el servicio y los cinco días de horario.
Al final del archivo hay una consulta comentada para verificar: debería dar
1 barbería, 1 barbero, 1 servicio y 5 días.

Podés confirmar visualmente en **Table Editor** → `tenants`.

---

## 4. Las credenciales

En el dashboard: **Project Settings** (el engranaje) → **API**.

Vas a ver tres cosas que necesitás. Ojo que Supabase renombró las claves y
según cuándo hayas creado el proyecto vas a ver un nombre u otro — las dos
funcionan igual:

| En el dashboard | Nombre nuevo | Va en |
| --- | --- | --- |
| **Project URL** | — | `NEXT_PUBLIC_SUPABASE_URL` |
| **anon / public** | **Publishable key** | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| **service_role** | **Secret key** | `SUPABASE_SERVICE_ROLE_KEY` |

### Cuál es cuál, y por qué importa

**La clave anon es pública a propósito.** Viaja al navegador de cada cliente
que entra a reservar. Cualquiera la puede leer con F12 y está bien: por sí
sola no da acceso a nada, porque Row Level Security filtra todo lo que pide.

**La service_role es la llave maestra.** Saltea RLS por completo: con ella se
leen y borran los datos de todas las barberías. Nunca va al navegador, nunca a
git, nunca pegada en un chat. Si alguna vez se te escapa, se rota desde el
mismo panel.

Por eso una lleva el prefijo `NEXT_PUBLIC_` y la otra no: en Next.js, ese
prefijo es literalmente lo que decide si la variable se empaqueta en el
JavaScript que se descarga el visitante.

---

## 5. Completar `.env.local`

Abrí `.env.local` (no `.env.example`) y dejalo así:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklm.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...
NEXT_PUBLIC_ROOT_DOMAIN=lvh.me
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Sin comillas y sin espacios alrededor del `=`.

### Sobre `lvh.me`

Cada barbería se llega por su subdominio: `tropi-barbershop.tuapp.com`. Pero
en tu máquina no existe ningún dominio, y `localhost` no soporta subdominios.

`lvh.me` es un dominio público cuya única función es apuntar siempre a tu
propia máquina, incluidos todos sus subdominios. Así, cuando construyamos la
resolución de barbería vas a poder abrir:

```
http://tropi-barbershop.lvh.me:3000
```

y funciona sin configurar nada. Cuando tengas el dominio real, se cambia esta
línea y nada más.

---

## 6. Generar los tipos de TypeScript

El `project-id` (o *reference id*) está en la URL del dashboard:
`supabase.com/dashboard/project/<ACÁ>`. También en Project Settings → General.

```bash
npx supabase gen types typescript --project-id <ref> > src/lib/supabase/types.ts
```

Esto lee tu base y escribe los tipos de las cinco tablas, reemplazando el
placeholder. A partir de acá TypeScript sabe que `appointments.starts_at` es
una fecha y te marca en rojo si escribís mal el nombre de una columna.

Te va a pedir login la primera vez (`npx supabase login`).

---

## 7. Verificar

```bash
npm run typecheck
npm run dev
```

`typecheck` tiene que pasar limpio con los tipos nuevos. `dev` tiene que
levantar sin quejarse por variables de entorno faltantes.

Todavía no hay página de reservas — eso viene después. Lo que estás
verificando acá es que la base existe, tiene la forma correcta y la app puede
conectarse.

---

## Si algo falla

| Síntoma | Causa habitual |
| --- | --- |
| `Falta la variable de entorno …` | Falta una línea en `.env.local`, o quedó el servidor viejo corriendo. Cortá con Ctrl+C y `npm run dev` de nuevo |
| El error persiste con todo cargado | Next lee `.env.local` al arrancar: hay que reiniciar el servidor después de tocarlo |
| `permission denied for table …` | Estás consultando sin sesión una tabla que exige login. Es RLS haciendo su trabajo |
| El SQL falla a mitad | No pasa nada: la transacción deshizo todo. Corregí y corré el archivo entero otra vez |
