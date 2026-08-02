# CLAUDE.md — Barbershop Booking Platform

## What this is
A multi-tenant booking app sold to barbershops. Many shops share one codebase and one database. Each shop has its own barbers, services, schedule, and branding. There is always a "tenant" — never just "the shop".

Two surfaces:
- **Public booking page** — client picks a service, barber, and time slot. No login.
- **Dashboard** — owner and barbers log in to manage their agenda.

## Stack
- Next.js (App Router) + TypeScript
- Tailwind CSS (compiled, not the CDN)
- Supabase (Postgres, Auth, Row Level Security)
- Vercel for hosting

Don't add extra libraries without asking.

## Always do first
- Invoke the `frontend-design` skill before writing any UI.
- Write the database schema first. Show it and get approval before building on top of it.

## Multi-tenancy
- Every table with shop data has a `tenant_id`.
- Isolation is enforced with Supabase Row Level Security, so one shop can never see another's data.
- Each shop is reached at `{slug}.tuapp.com`. A custom domain per shop is optional and added later.
- Never hardcode a tenant, domain, or brand color.

## Booking
- Always store times in UTC; display them in the shop's timezone (default `America/Montevideo`).
- The server computes and validates the final booking time — never trust a time sent by the browser.
- A slot is available if it fits the barber's working hours and doesn't overlap an existing appointment or a blocked time.
- Bookings and blocked time (breaks, days off) live in the same table.
- A client books with name, phone, and email — no account needed.

## Roles
- **Owner** — manages the whole shop: barbers, services, hours, settings.
- **Barber** — manages only their own agenda.
- **Client** — no login; can view or cancel via a link.

## Notifications
- Send an email confirmation automatically when a booking is made.
- For WhatsApp reminders: the dashboard shows tomorrow's bookings with a button that opens WhatsApp with the message pre-filled. Owner taps to send.
- Don't build automated/unofficial WhatsApp sending — it risks getting the shop's number banned.

## Branding
- Each shop has its own logo and colors, stored as data and applied with CSS variables.
- The public booking page must look good in any shop's colors — spend the design effort on typography, spacing, and layout, and let color be the variable.

## Design
Apply the `frontend-design` skill, plus:
- No default Tailwind colors (no indigo/blue-600).
- Different fonts for headings and body.
- Every clickable element has hover, focus, and active states.
- Mobile-first — almost everyone books on a phone.
- All user-facing text in Rioplatense Spanish (voseo: "reservá", "elegí").

## Rules
- Never disable Row Level Security.
- Never expose the Supabase service role key to the browser.
- Never hardcode a tenant, domain, timezone, or brand color.
- Never use `transition-all` or the Tailwind CDN.
- When a scheduling edge case is unclear, ask instead of guessing.

---

# Cómo está construido

Lo de arriba son las reglas. Lo de acá abajo es el estado real del proyecto,
para no tener que reconstruirlo leyendo todo.

## Las dos superficies
- **Página pública** (`/`, `/reservar`, `/turno/[token]`) — el cliente elige
  servicio, barbero, día y hora. Sin login.
- **Panel** (`/entrar`, `/panel/*`) — Agenda, Cobros, Semana, Horarios, y para
  el dueño Servicios, Equipo y Ajustes agrupados bajo Local.

## Dónde está cada cosa
- `src/lib/schedule.ts` — grilla de horarios. Puro: `now` entra como argumento.
- `src/lib/payroll.ts` — recuento y reparto de la plata. Puro.
- `src/lib/panel/day-strip.ts` — la agenda del día como tira. Puro.
- `src/lib/validation.ts` — nombre, teléfono y mail del cliente.
- `src/lib/tenant/` — `resolve` saca la barbería del subdominio, `load` traduce
  filas de Supabase a la forma de la pantalla.
- `src/lib/panel/` — lo que lee el panel. `session` dice quién entró y a qué
  barbería; `data` y `cobros` traen los datos; `cobro.ts` y `dias.ts` son puros
  y los comparten cliente y servidor.
- `src/components/` — piezas compartidas de la página pública.
- `src/app/panel/<sección>/` — cada pantalla con sus acciones al lado.
- `scripts/*.mts` — utilidades que no se despliegan. `dar-acceso` crea el primer
  acceso de una barbería; `probar-reserva` es la prueba de humo contra la base.
- `supabase/migrations/` — el esquema, en SQL versionado y numerado.
- `brand/<slug>/` — material de referencia de cada barbería. No lo lee la app.

## Convenciones que ya están tomadas
- **El público nunca toca `appointments`.** Ni para leer: esa tabla tiene
  teléfonos y mails. Todo entra y sale por funciones `SECURITY DEFINER`
  (`crear_reserva`, `horarios_ocupados`, `turno_por_token`, `cancelar_turno`,
  `crear_pedido`).
- **Un barbero solo ve lo suyo**, y lo impone RLS, no la pantalla. La excepción
  es Cobros: ahí cobra el que está al lado de la caja, y eso se resuelve con
  funciones `SECURITY DEFINER` que verifican membresía —nunca aflojando las
  políticas de la tabla, que dejaría al barbero ver de más en las otras
  pantallas.
- **La plata es lo cobrado, no lo reservado.** Un turno vale lo que dice
  `charged_at`; hasta que no se cobra no entra a ningún número. La comisión sale
  de `charged_services_cents`, no del total: los productos no pagan comisión.
- **Los horarios semanales se guardan en hora local** (`time`), porque "abro a
  las 14" no cambia con el horario de verano. UTC es solo para instantes
  concretos (`appointments.starts_at`).
- **Validación en tres capas**: el formulario avisa, el servidor revalida, y
  Postgres tiene los CHECK como última línea. Cada capa tapa un agujero
  distinto.
- **Los precios nunca viajan desde el navegador.** Al cobrar van ids y
  cantidades; los montos los busca la base.
- **Los teléfonos se guardan normalizados** como `+598XXXXXXXX`, que es lo que
  necesita el link de WhatsApp.
- **Lo pactado se congela**: precio y duración en cada turno, el porcentaje de
  comisión, el nombre y el monto de cada renglón del ticket.
- **Nadie se borra, se desactiva** (`is_active = false`). Se borra solo lo que
  es un error de tipeo: un pago mal anotado, un cobro mal hecho.
- **Un día con la caja cerrada no se toca más.** Lo impone la base.

## Cuidado con la frontera cliente/servidor
Un módulo con `"use client"` solo puede exportar **componentes** hacia el
servidor. Cualquier otra cosa —una constante, un array— llega del otro lado como
un proxy vacío. Y al revés: si un componente de cliente importa algo de un
módulo que toca el servidor, se rompe el build.

Por eso hay módulos neutrales, sin ninguna de las dos directivas, para lo que
comparten los dos lados: `src/lib/panel/dias.ts` y `src/lib/panel/cobro.ts`.
Esto ya rompió dos veces; si algo se comparte, va en un módulo aparte.

## Tests
`npm test` corre `node --test` sobre `src/**/*.test.ts`. Node 24 ejecuta
TypeScript directo, así que no hay ninguna dependencia de testing instalada.
Los imports relativos dentro de los tests llevan la extensión `.ts`.

Lo cubierto: grilla de horarios, ventana de reserva, agendas de varios
barberos, conversión a UTC, validación de datos, reparto de la plata según cómo
cobra cada uno, y armado de la tira del día.

Lo que los tests **no** pueden cubrir son las funciones de la base, las
restricciones y los permisos. Para eso está
`node --env-file=.env.local scripts/probar-reserva.mts <slug>`, que reserva un
turno real, revisa cómo quedó la fila y lo borra. **Correrlo después de cada
migración que toque `appointments` o `crear_reserva`**: dos veces un cambio en
la base rompió la reserva pública sin que nadie se enterara.

## Migraciones
Se escriben a mano en `supabase/migrations/` con nombre `<timestamp>_<qué>.sql`
y se aplican pegándolas en el SQL Editor de Supabase. Van siempre envueltas en
`begin; … commit;` para que un error no deje el esquema a medias.

Antes de agregar una restricción o una política, preguntarse **qué pasa con lo
que ya está guardado**. Las dos formas en que esto muerde:
- Una restricción nueva se valida contra todas las filas existentes. Si agrega
  columnas, hay que rellenarlas en la misma migración, antes.
- Una política se compila al crearla, así que toda columna que menciona tiene
  que existir ya. El orden dentro del archivo importa.

Y cuidado con `NOT VALID`: no perdona una fila para siempre, solo mientras nadie
la toque. Cualquier `UPDATE` posterior sobre esa fila la revisa entera.

## Lo que está a medio camino
- **Productos**: el esquema está escrito y aprobado
  (`20260801170000_productos.sql` y `20260801180000_vender_productos.sql`) pero
  todavía no hay pantallas. Falta el panel para cargarlos con foto, la vidriera
  pública con carrito, la venta de mostrador en Cobros y la sección de Pedidos.
- **El logo** se sigue cargando por atrás. El bucket de Storage llega con la
  migración de productos, así que después de eso es solo la pantalla.
- **Alta de una barbería nueva**: hoy se hace con SQL a mano. Es lo que falta
  para poder venderle a alguien sin intervención.
- **Nico** es un barbero de prueba en la base de Tropi.

## Sobre el diseño
La guía de marca de Tropi describe un local "clásico-vintage" y pide bordes
finos, sin sombras y radios chicos. Eso se apartó a pedido del dueño: la página
usa superficies suaves, radios de 8 a 14px y una sombra mínima. Se mantienen
intactos la paleta, la tipografía y el poste. Si alguna vez se quiere volver al
look clásico, son esas tres cosas y nada más.
