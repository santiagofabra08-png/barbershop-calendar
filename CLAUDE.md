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
  el dueño Servicios, Productos, Pedidos, Equipo y Ajustes agrupados bajo Local.
- **Vidriera** (`/productos`, `/productos/listo`) — el catálogo público. Existe
  solo si la barbería prendió `tenants.products_enabled`; si no, es un 404.
- **Portada** (`/` en el dominio pelado) — la página de ventas. No es de
  ninguna barbería: tiene paleta y tipografía propias, y se ve cuando el host
  no resuelve a ningún local.

## Dónde está cada cosa
- `src/lib/schedule.ts` — grilla de horarios. Puro: `now` entra como argumento.
- `src/lib/payroll.ts` — recuento y reparto de la plata. Puro.
- `src/lib/panel/day-strip.ts` — la agenda del día como tira. Puro.
- `src/lib/validation.ts` — nombre, teléfono y mail del cliente.
- `src/lib/carrito.ts` — elegir productos y contar lo que da. Puro y neutral.
  Vive fuera de `panel/` porque lo usan el ticket, el mostrador y la vidriera
  pública, y la página pública no tiene por qué depender del panel para sumar.
- `src/lib/panel/imagen.ts` — qué se espera de cada imagen, el recorte al
  cuadrado en el navegador y la validación que corre en las dos puntas.
- `src/lib/tenant/` — `resolve` saca la barbería del subdominio, `load` traduce
  filas de Supabase a la forma de la pantalla.
- `src/lib/panel/` — lo que lee el panel. `session` dice quién entró y a qué
  barbería; `data` y `cobros` traen los datos; `cobro.ts` y `dias.ts` son puros
  y los comparten cliente y servidor.
- `src/components/` — piezas compartidas de la página pública.
- `src/app/panel/<sección>/` — cada pantalla con sus acciones al lado.
- `scripts/*.mts` — utilidades que no se despliegan. `crear-barberia` da de alta
  una nueva preguntando; `dar-acceso` crea un acceso suelto; `sembrar-demo` crea
  dos barberías de prueba; los `probar-*` son las pruebas contra la base.
- `scripts/lib/alta.mts` — el alta de una barbería, en un solo lugar. La usan
  `crear-barberia` y `sembrar-demo`, a propósito: el alta que le corrés a un
  cliente que paga es exactamente la que se ejercita cada vez que rehacés las
  demos, en vez de una copia parecida que puede haber quedado atrás.
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
- **Un pedido de la web no es una venta.** No descuenta stock, no toca la caja
  y no promete nada: es alguien levantando la mano. Si se concreta, se cobra
  por Mostrador como cualquier otra venta. Prometer stock que después no está
  es peor que no prometer nada.
- **Lo que la caja espera y lo que la base calcula tienen que incluir lo
  mismo.** El cierre suma turnos cobrados *y* ventas de mostrador; la pantalla
  de Cobros también. Si una de las dos se olvida de algo, la diferencia aparece
  como plata que sobra y el cierre deja de servir para lo único que sirve.
- **RLS filtra filas, `GRANT` filtra columnas.** Que una fila se pueda ver no
  significa que todas sus columnas se puedan ver. `barbers` es público para
  `anon` —la página muestra quién atiende— y por eso el mail y el teléfono del
  barbero están fuera del grant. Al agregar una columna sensible a una tabla
  que el público lee, hay que preguntarse esto.

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
restricciones y los permisos. Para eso hay dos pruebas que corren contra la base
de verdad:

- `scripts/probar-reserva.mts <slug>` — reserva un turno real, revisa cómo quedó
  la fila y lo borra. **Correrlo después de cada migración que toque
  `appointments` o `crear_reserva`**: dos veces un cambio en la base rompió la
  reserva pública sin que nadie se enterara.
- `scripts/probar-aislamiento.mts <slugA> <slugB>` — 25 chequeos de que una
  barbería no ve ni toca nada de otra. **Correrlo después de cada migración que
  toque una política, un `grant` o una función `SECURITY DEFINER`.**
- `scripts/probar-panel.mts [slug…]` — la jornada entera del panel: ajustes,
  servicios, productos, equipo, horarios, agenda, el camino completo de la plata
  y los pedidos. Unos 45 chequeos por barbería, y la deja como estaba.
- `scripts/probar-roles.mts [slug]` — lo mismo que aislamiento pero un piso más
  abajo: dentro de una barbería, que un barbero vea lo suyo y nada más. La mitad
  de la prueba es al revés —que SÍ pueda trabajar—, porque achicar permisos
  hasta que nadie pueda hacer nada es tan malo como dejarlos abiertos.
- `scripts/probar-cliente.mts [slug] [url-base]` — reservar, abrir el link,
  cancelar, y que el hueco vuelva a quedar libre. Incluye el plazo de
  cancelación y, si el servidor está corriendo, las páginas por HTTP. Es la
  única prueba que abre la aplicación de verdad.
- `scripts/probar-simultaneo.mts [slug] [cuántas]` — diez reservas disparadas
  en el mismo instante. Con barbero fijo gana una sola; sin elegir barbero
  ganan tantas como sillas libres haya, y nunca dos en la misma silla.
- `scripts/probar-carga.mts [slug] [semanas]` — llena una barbería con un año de
  turnos, mide lo que espera una persona y borra todo. Con 4680 turnos la página
  de reservas pasó de 371 a 420 ms: el historial no le pesa porque solo mira
  hacia adelante.

## Las pruebas que abren un navegador
```
npm run test:e2e
```
Playwright, en `e2e/`. Es lo único que toca un botón: todo lo demás habla con la
base. Cubre lo que solo existe en el navegador —el recorte de las fotos, que
pasa entero con canvas— y lo que solo se ve en pantalla: que los formularios
envíen, que nada se salga de la pantalla en el celular.

Corren contra una barbería descartable que se crea antes y se borra después, con
un **subdominio distinto en cada corrida**. Eso último no es capricho: con el
slug fijo, la aplicación seguía usando el id de la barbería de la corrida
anterior —hay una capa de caché sobre esa búsqueda— y las pruebas del panel
rebotaban al login sin motivo aparente.

La barbería la arma `crearBarberia`, así que cada corrida ejercita también el
alta.

## Dos cuentas de correo, y no son la misma
Los mails de la barbería —confirmación de turno, pedido nuevo— salen por
**Resend**, con el remitente del local. Los de la cuenta —recuperar contraseña—
salen por **Supabase**, porque son de la autenticación y no del negocio.

Eso significa que hay **dos** configuraciones de correo que pueden estar mal por
separado, y ninguna avisa: un fallo de mail nunca rompe una reserva, a propósito.

- `RESEND_FROM` con `onboarding@resend.dev` **solo entrega al dueño de la cuenta
  de Resend**. En producción hay que verificar un dominio propio.
- El correo interno de Supabase tiene un límite de pocos mails por hora y no
  sirve para producción. Se arregla apuntando el SMTP de Supabase a Resend.
- En Supabase, *Authentication → URL Configuration → Redirect URLs* tiene que
  incluir los subdominios con comodín (`https://*.tuapp.com/**`). Sin eso, el
  link de recuperar contraseña no vuelve.

Cada una tiene su prueba, y hay que correr **las dos**: `probar-mail.mts` para
el de la barbería y `probar-recuperar.mts` para el de la cuenta. Que ande uno no
dice nada del otro —ya pasó: el dominio verificado y el mail saliendo por la API
mientras el de contraseña devolvía 500—.

En el SMTP de Supabase, **`Username` es literalmente la palabra `resend`**, no
el mail ni la API key. Es el campo que más veces queda mal, y el error que
devuelve es un 500 vacío que no dice nada.

**Pendiente**: `turnos@…` es solo un remitente, no una casilla. Si un cliente
contesta la confirmación —"no voy a poder ir"— esa respuesta se pierde. Hay que
reenviarla a alguien, y cuando se venda a barberías de verdad tiene que ir al
mail del local y no al nuestro. Va junto con el alta de barberías.

El link vuelve a `/entrar/confirmar`, que canja el código y redirige. Esa ruta
arma la dirección con el header `host` y **no** con `request.url`: Next
normaliza `request.url` al origen interno y mandaba a `localhost`. Con varias
barberías eso devuelve a la persona a la página de otro local.

Las dos van con `node --env-file=.env.local`.

La de aislamiento es la que decide si esto se puede vender. Que la agenda
calcule mal es un error molesto; que el dueño de una barbería vea los teléfonos
de los clientes de otra es el fin del producto. Y no se nota probando a mano:
con una sola barbería en la base, la separación nunca se ejerce.

Por eso `scripts/sembrar-demo.mts` crea dos barberías de demostración —clara y
oscura, dos zonas horarias, dos monedas, las dos formas de ventana de reserva—
que existen justamente para que haya de quién separarse. Con `--rehacer` las
borra y las vuelve a crear.

La de aislamiento tiene un chequeo de control que verifica que la sesión SÍ ve
lo suyo. Sin eso, una sesión rota haría pasar toda la prueba: no ver nada de la
otra barbería es fácil si tampoco se ve nada de la propia.

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

## Subir imágenes
Toda pantalla que pida una imagen tiene que **decir en pantalla qué se espera**,
antes de que la persona elija el archivo. Un dueño de barbería no sabe qué es
"1:1" ni cuánto pesa una foto: hay que decírselo en criollo y al lado del botón.

Siempre estas tres cosas: **medida recomendada, formato y peso máximo.**

- **Foto de producto** — cuadrada, 800×800 px. JPG, PNG o WebP, hasta 2 MB.
  Se recorta centrada si viene con otra forma, así que lo importante va al medio.
- **Logo** — con fondo transparente. SVG es lo mejor porque no se pixela nunca;
  si es PNG, 400 px de ancho como mínimo. Hasta 1 MB.
  Son **dos**: uno para fondo claro y otro para fondo oscuro. Un logo oscuro
  desaparece sobre la franja negra del encabezado.

Nunca rechazar un archivo solo por la medida: se recorta y se avisa. El rechazo
se reserva para el formato y el peso, que sí rompen la página.

Las medidas y los límites viven en `src/lib/panel/imagen.ts`, en un solo lugar,
y de ahí salen tanto el texto de la pantalla como la validación. Escribirlos dos
veces es garantizar que un día digan cosas distintas.

**Las fotos se recortan en el navegador, antes de subir.** Una foto de celular
pesa 4 MB y mide 4000 px; recortada son 60 KB. Hacerlo del otro lado significa
que el dueño espera medio minuto mirando una barra, gastando sus datos, para
subir algo que se va a tirar.

**El logo es la excepción: se sube tal cual.** Un SVG es un dibujo, no una foto,
y pasarlo por un canvas lo convertiría en píxeles —justo lo que lo hace bueno—.
Un PNG con transparencia tampoco sobreviviría el recorte.

## Cómo se da de alta una barbería
```
node --env-file=.env.local scripts/crear-barberia.mts
```
Pregunta lo mínimo para que la página funcione el mismo día —nombre,
subdominio, un servicio, un horario, el mail del dueño— y al final muestra lo
que va a crear antes de crearlo. Todo lo demás lo carga el dueño desde el panel.
Pedirle veinte datos a alguien que todavía no vio el producto es la forma más
rápida de que abandone.

Después, antes de entregarla, correr `probar-reserva` y `probar-aislamiento`
contra el slug nuevo. El script los deja escritos al terminar.

## Bug abierto: el rebote después de guardar
Al guardar desde el panel, el navegador tendría que quedar en la lista. En
cambio pasa por la lista, rebota a `/entrar` y termina en `/panel`. Está
registrado como `test.fixme` en `e2e/panel-foto.spec.ts`, con todo lo averiguado.

**Solo pasa en las pruebas automáticas.** Cargando un producto a mano, en un
navegador de verdad, no se reproduce. Eso lo baja de "hay que arreglarlo antes
de vender" a "hay que entenderlo": molesta porque tapa una prueba, no porque le
pase a alguien. Y el mismo dato acota la búsqueda —lo que cambia entre los dos
casos es la velocidad y que el navegador arranca sin nada guardado—.

Lo descartado: no es la subida de la foto (pasa igual con servicios y sin
foto), no es de desarrollo (pasa compilado) y no se pierde la cookie de sesión
—es la misma antes y después—.

Dónde está: en ese render, `sesionDelPanel()` encuentra usuario y barbería pero
la consulta de la fila del barbero devuelve cero filas **sin error**. Como
`/panel/…` manda a `/entrar` cuando no hay sesión, ahí nace el rebote. Y el id
de barbería que veía la aplicación era el de una corrida anterior, así que hay
una caché sobre `cargarTenant` que conviene entender antes de tocar nada.

## Lo que está a medio camino
- **Nico** es un barbero de prueba en la base de Tropi.
- **Barbería Central** y **Studio Norte** son de demostración, creadas por
  `sembrar-demo`. No son clientes. Antes de salir a producción de verdad hay que
  decidir si se borran o se dejan como vidriera para mostrar el producto.

## El resplandor de lo elegido
Lo que está elegido ahora mismo lleva `.glow` (o `.glow-accent`), y nada más.
No es un adorno repetible: si dos cosas resplandecen, ninguna está elegida.

Hay **dos recetas** porque el gesto no se traduce solo de un fondo al otro.
Sobre oscuro, una pieza clara con un halo parece emitir luz: la sombra sale
para todos lados y sin caída, porque la luz no cae. Sobre claro eso es
imposible —no se puede brillar más blanco que el papel— y el equivalente es una
sombra honda con caída, que despega la pieza de la hoja.

Las recetas viven en `globals.css`; `TenantTheme` elige cuál según la
luminancia del fondo de cada barbería (`src/lib/tenant/tono.ts`). El corte está
en 0.179, que es donde el blanco y el negro contrastan igual contra ese fondo:
la misma frontera que la pregunta "¿acá funciona un halo claro?".

Al agregar un color nuevo a una barbería, esto se acomoda solo. Al agregar una
pieza que se elige, usar la clase y no escribir una sombra a mano.

## La portada, y por qué muestra el producto en vez de dibujarlo

`turnosforbarber.com` sin subdominio no es ninguna barbería, así que ahí va la
página de ventas. La mayoría de quien entra llega de un reel sin saber que esto
existe: la página es lo único que va a leer antes de decidir.

Tres decisiones que conviene no revertir sin pensarlo:

- **Se muestra el producto de verdad.** Una barbería incrustada y funcionando
  (`demo.<dominio>`) y capturas sacadas del sitio en producción por
  `scripts/capturas.mts`. Recrear las pantallas en HTML se vería igual de bien
  hoy y empezaría a mentir el día que cambie el panel, sin que nadie se entere.
  Una foto también envejece, pero se vuelve a sacar con un comando.
- **La demo se vacía todos los días.** Se puede reservar de verdad ahí adentro
  —ése es el punto—, y sin limpiar, en unas semanas no queda un horario libre
  para mostrar. Lo hace `/api/limpiar-demo`, que llama Vercel una vez por día
  (`vercel.json`). Borra **todos** los turnos de esa barbería, siempre filtrando
  por `tenant_id`: ese `eq` es lo único que separa "vaciar la demo" de
  "borrarle la agenda a un cliente". El slug vive en `src/lib/demo.ts`, en un
  solo lugar, porque lo necesitan la portada, el cron y dos scripts.
- **No hay testimonios.** Con una sola barbería usándolo, inventar una reseña
  es fabricar prueba social, y el rubro es chico: alguien busca esa barbería,
  no la encuentra, y lo que se rompe es la credibilidad. La prueba es la demo
  viva. Cuando haya tres o cuatro barberías contentas, ahí sí, con permiso.

La barbería demo **abre los siete días de mañana a noche**, que ninguna real
hace. Si alguien mira la portada un lunes y la demo dice cerrado, no entiende
que el local descansa: entiende que el producto no anda.

- **La lista de funciones dice solo lo que existe.** Es tentador copiarle la
  lista a un competidor y sumar cosas que suenan bien. Es la forma más rápida
  de que alguien pague, no lo encuentre, pida la baja el primer mes y lo
  cuente. Al agregar o sacar una función del producto, tocar esa lista.

Lo que se configura desde el entorno, para que cambiarlo no sea un despliegue:
el WhatsApp de contacto, el mail, y el precio. Sin precio cargado, la sección
invita a preguntarlo en vez de inventar un número.

### Quién pidió probarlo

El botón principal lleva a un formulario, no a WhatsApp: escribirle por WhatsApp
a un desconocido es un paso que mucha gente no da, y en tráfico frío desde
Instagram eso es la mayoría. El WhatsApp sigue al lado, para el que lo prefiera.

Los datos caen en `signup_requests`, la única tabla del esquema **sin
`tenant_id`**: una solicitud existe justamente porque todavía no hay barbería.
Tiene RLS prendido y **ninguna política**, así que nadie la lee ni la escribe
desde el navegador; la única puerta es la Server Action de la portada, que corre
en el servidor con la llave de servicio. Es más cerrado que una función
`security definer`, y acá se puede porque el formulario no se envía desde el
navegador.

Primero se guarda y después se avisa por mail, no al revés: si Resend falla, la
solicitud ya está y no se perdió a nadie.

**Pendiente: el alta sola.** Hoy Santiago corre `crear-barberia` y le pasa la
dirección. Eso está bien para las primeras diez —hablar con cada una es cómo se
aprende qué falta— pero no escala. Lo que hace falta es un asistente de primeros
pasos: sin él, una barbería recién creada no tiene servicios ni horarios, y
alguien que entra solo a un panel vacío cree que no funciona.

### Animaciones: el modo de falla importa más que el efecto

Las secciones se deslizan al entrar en pantalla con `animation-timeline: view()`,
sin JavaScript. **No se anima la opacidad, solo el desplazamiento**, y eso no es
estético: si un navegador soporta la propiedad a medias y la línea de tiempo no
avanza, con opacidad la página aparece **en blanco**. El canal principal de esta
página es Instagram, o sea el navegador de adentro de la app, que es justo donde
estas cosas fallan raro y donde nadie se entera. Corrida 26 píxeles no la nota
nadie; en blanco, sí.

```
node --env-file=.env.local scripts/barberia-demo.mts            # crearla
node --env-file=.env.local scripts/capturas.mts "https://{slug}.turnosforbarber.com"
```

Correr `capturas` después de cualquier cambio visible del panel o de la página
pública: si no, la página de ventas muestra un producto que ya no existe.

## Sobre el diseño
La guía de marca de Tropi describe un local "clásico-vintage" y pide bordes
finos, sin sombras y radios chicos. Eso se apartó a pedido del dueño: la página
usa superficies suaves, radios de 8 a 14px y una sombra mínima. Se mantienen
intactos la paleta, la tipografía y el poste. Si alguna vez se quiere volver al
look clásico, son esas tres cosas y nada más.
