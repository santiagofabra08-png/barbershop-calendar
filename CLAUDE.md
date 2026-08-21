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
- Render for hosting (GitHub deploys on push)

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
- **A reminder email goes out two hours before the appointment**, with the same
  cancel link (`src/lib/email/recordatorio.ts`, `/api/recordatorios`, fired
  every 15 minutes by `.github/workflows/recordatorios.yml`). It exists so the
  person who is not coming cancels, not so anyone remembers.
- For WhatsApp reminders: the dashboard shows tomorrow's bookings with a button that opens WhatsApp with the message pre-filled (`src/lib/whatsapp.ts`). Owner taps to send.
- Don't build automated/unofficial WhatsApp sending — it risks getting the shop's number banned.
- Whatever the landing page claims about a feature has to be true of the code. The pre-filled message was promised there for two weeks before it existed; the guide, which described the button honestly, was the only thing that caught it.

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
- **Sin rayas en la prosa.** Una frase partida al medio para meterle un inciso
  se escribe con dos puntos o se parte en dos. La `—` sí se usa como **valor**
  en una celda, donde quiere decir "acá no hay nada": sacarla dejaría un hueco
  en blanco, que se lee como que la pantalla se rompió.

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
- `src/lib/plazo.ts` — el plazo de cancelación dicho como lo diría una persona.
  Puro. Devuelve la frase entera y no los pedazos, porque el castellano no deja
  componerla: "una hora" y "30 minutos" no llevan el mismo artículo.
- `src/lib/tenant/tono.ts` — luminancia, contraste y `legibleSobre`. Puro. De
  acá sale la receta del resplandor y el color de la letra sobre el acento.
- `src/lib/panel/fotos.ts` — subir y borrar fotos del panel. Recibe el cliente
  de Supabase ya armado en vez de crearlo.
- `src/components/panel/campo-foto.tsx` — el campo de subir foto, compartido
  entre Productos y Equipo. Recibe la URL ya armada: los productos guardan la
  ruta del bucket y los barberos y los logos guardan la URL entera, y el campo
  no tiene por qué saber cuál usa cada tabla.
- `src/components/contacto-flotante.tsx` — el WhatsApp y el Instagram del
  local, abajo a la derecha. En la paleta de la barbería y no en verde y
  violeta, y por debajo de la barra del turno elegido.
- `src/lib/whatsapp.ts` — los mensajes ya escritos (el recordatorio del turno y
  el del pedido) y el link a `wa.me`. Puro:
  `hoy` entra como argumento, que es lo que deja probar que el turno de mañana
  dice "mañana". El mensaje sale escrito solo si todavía sirve; para un turno
  que ya empezó, o un pedido terminado, el chat abre en blanco, porque ahí lo
  que hay para decir depende de qué pasó. El del pedido **da por sentado que el
  producto está**, que es el caso normal: el dueño lo lee y lo reescribe si no
  lo tiene, porque poner "si es que tengo" en todos los mensajes para el caso
  raro los arruina todos.
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
- `scripts/limpiar-storage.mts` — archivos de Storage que quedaron sin
  barbería. Mira y cuenta; borra solo con `--borrar`.
- `scripts/guia.mts` — envuelve `docs/guia-del-panel.html` en un archivo suelto
  (`docs/guia-para-mandar.html`) que se le manda a una barbería. La fuente no
  lleva `<!doctype>` porque está escrita para publicarse como artefacto, y sin
  eso el navegador la abre en modo quirks.
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
- **Borrar una barbería se lleva sus archivos.** Storage no cuelga del tenant,
  así que el borrado en cascada no lo alcanza: `borrarBarberia` lista y borra
  las carpetas del bucket antes de borrar la fila, porque después no queda de
  dónde sacar el id. Durante meses no lo hizo nadie y se juntaron 24 archivos
  públicos de 15 barberías que ya no existían, uno por cada corrida de las
  pruebas de navegador. Con una barbería de prueba es basura; con un cliente
  que se da de baja, son las fotos de su local siguiendo accesibles con el link.
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
- `scripts/probar-solicitud.mjs [url]` — el formulario de la portada de punta a
  punta y **contra producción**: lo llena en el sitio de verdad, comprueba que
  la fila llegó a la base con el teléfono normalizado y que la validación
  rechaza lo que tiene que rechazar. Manda un mail de aviso real a propósito:
  ése es el eslabón que falla en silencio, porque la solicitud se guarda igual
  aunque el correo no salga. Borra la solicitud de prueba al terminar.
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

**Las respuestas ya no se pierden, pero llegan al lugar equivocado.**
`turnos@turnosforbarber.com` es un remitente, no una casilla, así que si un
cliente contesta la confirmación —"no voy a poder ir"— esa respuesta necesitaba
un destino. Lo tiene: el reenvío de Porkbun la manda a la casilla de Santiago.

Alcanza mientras las barberías sean de prueba. **Con barberías de verdad está
mal**, y de una forma que no se nota: la clienta avisa que no viene, el mensaje
llega a una casilla nuestra, y la dueña se entera cuando el turno no aparece. El
reenvío tiene que ir al mail del local, o el remitente tiene que llevar el
`replyTo` de cada barbería. Lo segundo es una línea en `send.ts` y no depende de
ningún panel de DNS.

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
`/panel/…` manda a `/entrar` cuando no hay sesión, ahí nace el rebote.

### La pista buena: el host se pierde en el redirect (en local)

Se creía que había una caché sobre `cargarTenant` devolviendo el id de una
corrida anterior. **No es una caché.** Lo que pasa es esto, y está reproducido:

Corriendo en local, el render que sigue a un `redirect()` de una Server Action llega
con **`host: localhost:<puerto>`** en vez del host real. Como `slugFromHost` no
encuentra subdominio en `localhost`, `currentTenantSlug()` cae en la salida de
emergencia y devuelve **`DEV_TENANT_SLUG`**: otra barbería. Recargando esa misma
URL a mano vuelve el host de verdad y todo anda.

Se ve entero reservando en la demo con `npm run dev`: la confirmación aparece
con la marca de Tropi, y al recargar aparece con la de Barbería Modelo.

Explica los dos `test.fixme` de una: en el panel, la barbería equivocada es
justo lo que hace que la fila del barbero devuelva cero filas; y en la vitrina,
con `DEV_TENANT_SLUG` vacío no hay a qué caer y la página del turno responde 404.

**En producción no pasa**, y está verificado reservando en
`demo.turnosforbarber.com`: ahí el host llega bien y la confirmación sale con la
barbería correcta. Por eso esto tapa pruebas y no le pasa a nadie. Es la misma
familia que lo de `/entrar/confirmar`, donde Next normalizaba `request.url` al
origen interno.

Está reproducido con `next dev`. Que `panel-foto` lo viera también con la
aplicación compilada no lo contradice: compilada o no, en local el servidor
igual escucha en `localhost` y el host que se pierde es el mismo. Lo que separa
los dos mundos no es el modo sino el dominio.

## El panel de prueba por visitante, pensado y postergado

La portada deja probar la mitad del cliente; del panel solo muestra capturas.
La idea era crear una barbería descartable por visitante, sembrada con una
semana creíble, que se borra sola a las horas. `crearBarberia` y
`sembrarJornada` ya hacen la mitad difícil.

Se frenó a propósito, y conviene releer esto antes de retomarlo:

- **Cada prueba es una barbería entera**: tenant, barberos, servicios, horarios,
  medio centenar de turnos y un usuario de `auth` que cuenta para el plan.
- **Cada prueba es una página pública en el dominio.** El que entra puede
  cambiar el nombre del local y subir fotos, o sea publicar lo que quiera en una
  página de `turnosforbarber.com` y pasar el link. Un límite por IP no frena eso:
  con una vez alcanza.
- **Apagarla no sirve**: con `is_active = false` la página pública desaparece,
  pero la única política de lectura de `tenants` exige `is_active` también para
  quien tiene sesión, así que el panel se rompe igual.
- **El marcador va en tabla aparte, no en `tenants`.** `tenants` tiene lectura
  pública para `anon` sin restricción de columnas, así que una columna nueva ahí
  la lee cualquiera. Iba a llevar el hash de la IP del visitante.

Si se retoma: pedir el mail antes de crear nada, y resolver lo de las fotos
antes de abrir la puerta.

## Quién usa esto de verdad

Conviene saberlo antes de pesar cualquier riesgo, porque cambia todas las
cuentas.

**AL Studio (`alstudio`) es la primera barbería real**, dada de alta el 20 de
agosto de 2026. Avenida Italia 4557, Malvín. Dos socios, Agustín y Lucas, que
entran los dos con la misma cuenta. Los datos y las decisiones del alta están
en `brand/alstudio/notas.md`.

Desde ese día **un despliegue le puede arruinar la tarde a alguien**, y eso ya
no es una abstracción. Todo lo demás en la base sigue siendo nuestro:

- **Tropi Barbershop no es un cliente.** Es la maqueta con la que se construyó
  la plataforma: un local concreto que sirvió para no diseñar en el aire. Nadie
  reservó nunca un turno ahí. Sus datos y su guía de marca están en
  `brand/tropi-barbershop/` y siguen sirviendo de referencia, y el tenant sigue
  haciendo falta como contraparte de `probar-aislamiento`, que necesita dos
  barberías para probar que una no ve a la otra.
- **Nico** es un barbero de prueba en la base de Tropi.
- **Barbería Central** y **Studio Norte** son de demostración, creadas por
  `sembrar-demo`. Antes de salir a producción de verdad hay que decidir si se
  borran o se dejan como vidriera para mostrar el producto.
- **Barbería Modelo** (`demo`) es la que muestra la portada. Se vacía sola todos
  los días.

**Cada barbería real que entra destapa algo que la maqueta tapaba.** AL Studio
lo hizo dos veces el primer día: el plazo de cancelación estaba escrito a mano
como "una hora" en cuatro textos y era verdad por casualidad, porque la maqueta
lo tenía en 60; y el acento se usaba como relleno y como tinta a la vez, algo
que solo se rompe cuando alguien elige un color claro. Al dar de alta la
siguiente, conviene mirar qué valores eligió distintos.

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

### Lo elegido se pinta con el acento, y la letra la decide el contraste

Todo lo que está elegido —el servicio, el día, el barbero, la hora— lleva
`bg-accent text-on-accent`. Antes había dos mecanismos: unas piezas se
invertían a tinta y otras usaban el acento con `text-surface` escrito a mano.
Con un acento oscuro los dos se veían igual y la diferencia no molestaba; con
uno claro, las letras blancas desaparecen.

`--tenant-on-accent` lo resuelve: `TenantTheme` mira la luminancia del acento y
elige tinta o superficie. Es la misma pregunta que ya decidía la receta del
resplandor, un piso más abajo.

⚠️ **El acento tiene un segundo trabajo, y un color claro no lo puede hacer.**
En trece archivos es también el color del texto: los errores, los saldos, "Ver
›". Un celeste pastel pinta bien un botón y no se lee sobre una tarjeta blanca.
Para eso está `--tenant-accent-text`, que sale de `legibleSobre`: devuelve el
acento tal cual si ya contrasta, y si no lo mezcla con la tinta hasta pasar el
mínimo, conservando el matiz. Un celeste se vuelve azul profundo, no gris.

Al escribir una pieza nueva: `text-accent-text` para texto, `bg-accent` con
`text-on-accent` para relleno. **Nunca `text-surface` a mano sobre el acento**,
que es exactamente lo que se rompió.

Y el hover de un botón de acento no puede saltar a tinta: con acento claro eso
deja letras negras sobre negro. Se atenuúa con opacidad, que preserva la
relación entre el fondo y la letra sea cual sea el color.

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
  para mostrar. Lo hace `/api/limpiar-demo`, que llama una acción programada de
  GitHub una vez por día (`.github/workflows/limpiar-demo.yml`). Va al `www` y no
  al dominio pelado, que devuelve un 301 que `curl` no sigue: contra el pelado la
  tarea quedaba en verde sin haber limpiado nunca. Borra **todos** los turnos de
  esa barbería, siempre filtrando por `tenant_id`: ese `eq` es lo único que
  separa "vaciar la demo" de "borrarle la agenda a un cliente". El slug vive en
  `src/lib/demo.ts`, en un solo lugar, porque lo necesitan la portada, la tarea
  y dos scripts.
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

**La demo cierra el círculo.** Al reservar ahí adentro, la página del turno le
manda a la portada —por `postMessage`, con destino explícito y nunca `"*"`— el
recordatorio que le escribiría el barbero, y la portada lo muestra. Así el
visitante ve la mitad del cliente y la del barbero con el mismo turno, el que él
acaba de sacar. El texto sale de `mensajeDeRecordatorio`, la función que usa el
panel: un ejemplo escrito a mano se vería igual hoy y empezaría a mentir el día
que el mensaje cambie. Vive en `src/components/aviso-vitrina.tsx`, no dibuja
nada, y solo habla si está dentro de un iframe.

**Y también se cierra entrando derecho a la demo**, que es como se comparte el
link la mayoría de las veces. Ahí la página del turno dibuja el mismo bloque al
pie, en una franja con la paleta del producto (`src/components/franja-demo.tsx`).
Cuatro cosas que conviene no revertir sin pensarlo:

- **El bloque es uno solo** (`src/components/otro-lado.tsx`) y lo usan los dos
  lados. Escrito dos veces, un día dirían cosas distintas.
- ⚠️ **Solo la barbería demo**, comparando el slug contra `SLUG_DEMO`. La página
  del turno es la misma para todas: sin ese `===`, un cliente de un local que
  paga abre su confirmación y encuentra material de ventas nuestro adentro.
- **Adentro de la portada no se dibuja.** Ahí la demo va incrustada y la portada
  ya muestra el bloque afuera del teléfono, donde se lee. La señal es la misma
  que usa `AvisoVitrina`, invertida: aquel habla si está dentro de un iframe,
  este dibuja si no lo está. No se puede decidir en el servidor porque al turno
  se llega navegando y el `?vitrina=1` del iframe queda en la página anterior.
- **La separación la hace el fondo, no un borde.** Una barbería puede tener
  cualquier color; el corte de superficie es lo único que se lee igual arriba de
  un local cálido que de uno oscuro. La paleta del producto vive en
  `src/app/producto.css` —salió de `portada.css` cuando dejó de usarla solo la
  portada— y el título cae en la tipografía de siempre cuando la Archivo Black
  no está cargada, que es a propósito: esa fuente solo viaja en la portada, para
  que las páginas de las barberías no la paguen por veinte palabras.

⚠️ El lado que recibe no tiene prueba automática, y el motivo está escrito en
`e2e/vitrina.spec.ts`: para que la portada aparezca en desarrollo hay que vaciar
`DEV_TENANT_SLUG`, y ahí reservar rompe porque el redirect de la Server Action
pierde el host (ver "la pista buena"). Se verifica a mano contra una compilación
de producción.

### La secuencia explicativa

Un título y un mensaje alcanzaban para el que ya había entendido, pero no
explicaban el mecanismo. Adentro de la franja va la cadena entera, en tres pasos
que avanzan solos (`src/components/secuencia-demo.tsx`):

1. **El cliente elige la hora** — recorte de la grilla pública, con un horario
   elegido y su resplandor.
2. **Le aparece al barbero en la agenda** — recorte del panel: dos turnos, el
   hueco entre ellos y el botón **Recordar**.
3. **Un toque, y WhatsApp se abre escrito** — no es una foto: es
   `ChatDeWhatsApp` con el mensaje de esta persona.

Lo que conviene no revertir sin pensarlo:

- **Los dos primeros son capturas del sitio de verdad**, de `scripts/capturas.mts`
  (`paso-elegir-hora.png`, `paso-agenda.png`). Recrear las pantallas en HTML se
  vería igual de bien hoy y mentiría el día que cambie el panel.
- ⚠️ **La captura de la agenda tiene que ser un turno de la web, no uno cargado a
  mano.** La jornada sembrada mezcla los dos a propósito, y el script filtra por
  `hasNotText: "Cargado a mano"`: con ese cartelito al lado, el paso mostraría lo
  contrario de lo que dice.
- **El paso 3 lleva el turno de la persona.** Lo genérico explica el mecanismo;
  el turno propio lo hace suyo.
- **La caja tiene alto fijo.** Las tres piezas tienen formas distintas y a su
  aire la página crecía y se achicaba en cada cambio: eso no se lee como una
  animación sino como que algo se rompió, y corre de lugar lo que está abajo
  justo cuando alguien iba a tocarlo.
- **Con `prefers-reduced-motion` se ven los tres pasos, uno abajo del otro.** No
  es una versión degradada: es lo mismo sin nada que se mueva, y es también lo
  que se ve si el JavaScript no corre.
- **No hay que esperarlas.** Se pasa con las flechas de los costados, tocando
  una barrita o con el dedo. Al principio solo estaba lo de la barrita y no
  alcanzaba, y no porque no funcionara: tres píxeles de alto no parecen un
  control, parecen un adorno, así que el que quería adelantar no sabía que
  podía. Al primer toque el reloj se apaga para siempre: quien empezó a manejar
  maneja, y seguir corriendo por debajo le movería la pantalla mientras lee.
- **Las barritas** dicen cuántos pasos hay, en cuál va y cuánto falta. Las
  flechas dan la vuelta en las dos puntas, así ninguna queda muerta: una flecha
  apagada obliga a mirar en qué paso estás antes de tocarla.

**Está en las dos pantallas de la demo**, no solo después de reservar: quien abre
ese link en frío lo más probable es que mire los horarios y cierre. En la página
de reservas el turno del ejemplo sale de **un horario libre de verdad**, el mismo
que la persona ve arriba, con un nombre ilustrativo (`Martín R.`); si no queda
ningún hueco, la franja no se dibuja, porque un ejemplo con una hora inventada
vale menos que nada.

⚠️ **En la portada va el chat solo, sin la secuencia**, y no es un olvido: esa
página ya explica el mecanismo con la demo viva arriba y las capturas del panel
abajo. Repetirlo sería contar dos veces lo mismo en la misma pantalla.

Se descartó un video corto grabado por script. Es lo más intuitivo y lo más caro,
y no puede llevar el turno de la persona. Se revisa cuando esto se haya visto con
gente.

La demo incrustada se pide con `?vitrina=1`, que **solo esconde la barra de
scroll**: una barra gris cruzando el teléfono dibujado arruina la ilusión. Nada
más cambia, a propósito. La demo tiene que ser la página de verdad y no una
versión recortada de la página de verdad.

Arriba tiene un conmutador **celular / computadora**. No es un adorno: casi
todo dueño de barbería asume que "una página de reservas" es una app de
teléfono, y verla acomodarse sola contesta eso sin escribirlo. El iframe no se
vuelve a montar al cambiar de modo —si se recargara, la persona pierde el
horario que había elegido justo cuando estaba entendiendo cómo funciona—. En
modo computadora la barra de direcciones dibujada muestra el subdominio, que es
lo mismo que la sección de al lado afirma con palabras.

Lo que se configura desde el entorno, para que cambiarlo no sea un despliegue:
el WhatsApp de contacto, el mail, y el precio. Sin precio cargado, la sección
invita a preguntarlo en vez de inventar un número.

El precio se muestra en dos monedas, y **las dos se escriben a mano**
(`NEXT_PUBLIC_PRECIO_MENSUAL` y `…_ALT`). No se convierte con una cotización a
propósito: una cotización queda vieja sola, y el día que se mueve la página
muestra un precio que no es el que se va a cobrar. Nadie se entera hasta que un
cliente lo reclama.

⚠️ Las `NEXT_PUBLIC_*` se escriben adentro del código **al construirlo**, no se
leen en cada visita. Después de cambiar una hay que redesplegar **destildando
"Use existing Build Cache"**, o los valores nuevos no entran. Y ojo con otra:
tocar *Redeploy* sobre un despliegue de la lista reconstruye **el commit de ese
despliegue**, no el código más nuevo. Si hubo pushes después, hay que redesplegar
el de más arriba.

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
