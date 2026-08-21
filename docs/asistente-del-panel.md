# El asistente del panel

Escrito el 21 de agosto de 2026 como plan, antes de empezar. Reescrito el 22 de
agosto, cuando las tres piezas quedaron hechas, para que diga qué hay y no qué
se pensaba hacer.

## Qué problema resuelve

Una barbería recién dada de alta llega a un panel casi vacío. Tiene un servicio
y un horario porque `crear-barberia` pide lo mínimo, y nada más: ni logo, ni
colores, ni el resto del equipo, ni productos. **Quien entra ahí no ve un
producto a medio configurar, ve un producto que no anda.** Ése es el momento en
que se abandona, y no había ninguna pantalla que lo acompañara.

Hoy eso lo tapaba Santiago cargando todo a mano antes de entregar la barbería.
Con diez barberías deja de ser posible.

## Las tres piezas, y dónde está cada una

| Pieza | Dónde | Qué hace |
| --- | --- | --- |
| La lista de primeros pasos | `src/lib/panel/primeros-pasos.ts`, `src/components/panel/primeros-pasos.tsx` | Arriba de `/panel`: qué falta y por qué duele que falte |
| El botón de ayuda | `src/app/panel/boton-ayuda.tsx`, `/panel/ayuda`, `src/lib/guia.ts` | El `?` de arriba abre la parte de la guía que explica esa pantalla |
| El detrás de escena | `/detras` en la barbería demo, `src/lib/detras/` | El panel de verdad visto desde afuera, sin cuenta |

## 1 · La lista de primeros pasos

Un bloque arriba de `/panel` que dice qué falta. Cada ítem lleva a su pantalla y
desaparece cuando el dato existe. El bloque entero desaparece cuando está todo.

| Paso | Listo cuando |
| --- | --- |
| El horario de cada barbero | todo el que atiende tiene al menos un tramo |
| Los servicios que ofrecés | más de uno activo |
| El logo del local | `logo_light_url` **y** `logo_dark_url` |
| La dirección | `address` |
| El WhatsApp del local | `whatsapp_phone` |

**No necesitó esquema nuevo.** Todo se deduce de datos que ya están. Nada de una
columna `onboarding_step`: un estado guardado se desincroniza del mundo real el
día que alguien borra un servicio, y entonces la lista miente, que es peor que
no existir.

Cuatro decisiones que conviene no revertir sin pensarlas:

- **Solo entran pasos que se pueden verificar.** "Elegí tus colores" quedó
  afuera: para saber si los cambiaron habría que comparar contra las paletas de
  arranque, que viven en `scripts/lib/alta.mts` y no se despliegan. Copiarlas a
  `src/` sería un segundo lugar que un día dice otra cosa, y una barbería que se
  queda con la paleta de arranque no está rota. **Un paso que no se puede
  tildar deja la lista para siempre en pantalla, y una lista que no se termina
  se convierte en un cartel que nadie lee.**
- **Cada paso dice qué se rompe, no qué hay que hacer.** "Cargá el logo" es una
  tarea; "sin logo arriba de la página va tu nombre escrito y nada más" es un
  motivo. Lo primero se posterga, lo segundo se hace.
- **Cuenta cuánto falta** ("Van 3 de 5"). Sin el número, una lista de tareas en
  la pantalla principal parece infinita.
- **Solo la ve el dueño**, porque los cinco pasos llevan a pantallas que un
  barbero no puede abrir.

⚠️ **Y no la ve la barbería demo.** Su panel es de donde `scripts/capturas.mts`
saca las fotos que muestra la portada: un "para terminar de armar tu página"
arriba convierte la pantalla que dice "tu día ya está armado" en la de un
producto a medio configurar. No es una barbería dándose de alta, es la vidriera.

**El único paso que impide reservar** es el del horario, y va marcado distinto:
un barbero que atiende y no tiene horario no aparece en la página, así que nadie
puede reservar con él. Los otros cuatro hacen que la página se vea a medio
hacer, que es feo pero no impide nada.

## 2 · El botón de ayuda

Un `?` en el encabezado del panel que abre la sección de la guía que corresponde
a la pantalla donde estás. Desde Cobros va a Cobros; desde Horarios, a Horarios.
**Una ayuda que siempre abre en el índice obliga a buscar, y buscar es
exactamente lo que no puede hacer alguien que ya está perdido.**

El mapa de pantalla a sección está en `SECCION_POR_RUTA`, en `src/lib/guia.ts`.
`/panel/local` no tiene sección propia a propósito: es un índice de otras
pantallas, y ahí abrir en el índice de la guía es la respuesta correcta.

### De dónde sale el texto

De `docs/guia-del-panel.md`, el mismo archivo que se le manda a la barbería. No
hay una copia adentro de `src/`: con una copia, el día que alguien corrija la
guía la ayuda del panel seguiría explicando lo de antes y nadie se entera hasta
que un cliente pregunta.

Lo lee `src/lib/guia-fuente.ts`, una vez por proceso. **Si el archivo no está,
la ayuda no se rompe: no aparece.** Un despliegue que por lo que sea no incluya
`docs/` no puede tumbar el panel entero por una pantalla de ayuda.

### El renderizador de Markdown escrito a mano

`src/lib/guia.ts` convierte Markdown en HTML. Es puro y está probado.

Se escribió a mano porque el proyecto no suma librerías sin preguntar, y de
Markdown la guía usa nueve cosas: títulos, párrafos, listas, listas numeradas,
tablas, citas, bloques de código, líneas divisorias, y adentro negrita, código
y links. Traer un parser entero para eso sería cargar la página de todas las
barberías con lo que necesita una pantalla de ayuda.

**Los tests corren contra la guía de verdad, no contra un ejemplo inventado**
(`src/lib/guia.test.ts`). Dibujan las trece secciones y fallan si queda Markdown
crudo en la pantalla. Lo que se rompe el día que alguien escriba algo que el
subconjunto no cubre es la guía, no el ejemplo.

⚠️ **Al escribir en la guía, quedarse adentro de esas nueve cosas.** Si hace
falta algo más (listas anidadas, imágenes), hay que agregarlo al renderizador y
al test, no confiar en que se vea bien.

### Por qué es un link y no un cajón que se despliega

El cajón se ve mejor en una demostración y obliga a cargar el texto de la guía
en **cada** pantalla del panel: varios kilobytes por pantalla que casi nadie va
a abrir, pagados con los datos del celular de quien está trabajando. Así, el
texto se pide solo cuando alguien lo pide.

## 3 · El detrás de escena

`/detras`, en la barbería demo. La interfaz real del panel, con datos
inventados, en una página pública sin sesión y sin ninguna acción conectada.

Lo que hay adentro:

- **La agenda, viva.** El mismo componente `Ledger` que dibuja la agenda de una
  barbería que paga, con `soloLectura`. Los botones se ven ("No vino",
  "Recordar", la × del bloqueo) pero no cuelgan de ningún formulario.
- **El mensaje de WhatsApp**, sacado de `mensajeDeRecordatorio` con el turno que
  se ve arriba. Un ejemplo escrito a mano se vería igual hoy y empezaría a
  mentir el día que el mensaje cambie.
- **Cobros y Semana**, como capturas de `scripts/capturas.mts`. Esas dos leen y
  escriben de la base en la misma pantalla, así que traerlas vivas es partirlas
  en dos, y eso se hace bien o no se hace.
- **La guía entera**, pública, en `/detras/guia`. El manual completo antes de
  pagar. Es raro y es a propósito: lo que hay adentro es lo que se está
  vendiendo, y esconderlo solo sirve si lo de adentro decepciona.

### Por qué no se puede escribir nada

**No porque los botones estén deshabilitados.** Deshabilitar un botón no bloquea
nada: las Server Actions son direcciones a las que se puede mandar un POST sin
pasar por la pantalla. Si el bloqueo fuera ése, tendría que estar en la base
—todas las políticas de escritura y las diez funciones `SECURITY DEFINER`— y
cada una que se escape es un agujero.

Acá no hay con qué escribir. Sin sesión no hay a quién atribuirle una escritura,
y sin `action` en los formularios no hay a dónde mandarla. **El bloqueo no es
una regla que haya que acordarse de poner, es la ausencia de la maquinaria.**
`e2e/detras.spec.ts` lo comprueba contando: cero `<form>`, y todos los botones
deshabilitados.

Eso fue lo que descartó la primera idea, que era abrirle el panel de la demo a
cualquiera: quien entra ahí puede cambiarle el nombre a la barbería y subir
fotos, o sea **publicar lo que quiera en una página de `turnosforbarber.com` y
pasar el link**. Un límite por IP no frena eso: con una vez alcanza. Está
analizado entero en `CLAUDE.md`, en "El panel de prueba por visitante".

### ⚠️ Solo la barbería demo

`barberiaDelDetras()` (`src/lib/detras/barberia.ts`) compara contra `SLUG_DEMO`
y devuelve null si no coincide; las tres páginas hacen `notFound()`. Vive en un
solo lugar a propósito: repetido en cada página, uno donde falte es un agujero.

Sin ese `===`, un cliente que paga tiene colgando de su propio dominio una
página que le explica el producto a sus clientes, con el nombre de otra barbería
adentro. Es la misma condición que ya aplican `FranjaDemo` y
`/api/recordatorios`. La prueba corre contra la barbería descartable —que es
exactamente el caso de un cliente que paga— y exige 404.

### De dónde salen los datos

`src/lib/detras/jornada.ts`, puro, escrito a mano. Dos motivos:

- **Inventado y no el día real de la demo**, porque la demo se vacía todos los
  días: su agenda de verdad está casi siempre en cero, y quien entre a ver el
  panel por dentro se encontraría con "no hay nada anotado para este día".
  Sembrarla ocuparía además los horarios que el visitante necesita encontrar
  libres del otro lado.
- **Escrito a mano y no generado**, porque un día generado con un bucle sale
  parejo: todos los turnos igual de largos, sin huecos raros, sin nadie cargado
  a mano. Un día de barbería no se parece a eso.

Los nombres, los servicios y los precios son los de la barbería de demostración,
para que quien acaba de reservar del otro lado reconozca lo que está mirando.

### Dónde se entra

- Desde la portada, **abajo de la demo incrustada** y no arriba: recién después
  de reservar en el teléfono dibujado tiene sentido la pregunta "¿y del otro
  lado qué pasa?".
- Desde la franja al pie de la demo, para el que llegó por el link suelto.

## Lo que no se hizo, y por qué

**El video queda descartado.** Había un guion de 631 líneas para un video con
voz en off de 25 a 28 minutos. Nadie mira 25 minutos de video en el momento en
que se abandona, que es cuando entró y no sabe qué hacer. El archivo se sacó del
árbol el 21 de agosto para que nadie lo lea después y crea que hay un video
grabado; **sigue en la historia de git**, en el commit anterior al que lo borra.

**No hay un asistente que cree cosas por su cuenta.** Un flujo aparte que te
haga cargar el primer servicio suena mejor y es peor: duplica pantallas que ya
existen y crea un segundo lugar donde se crean servicios, que un día va a decir
algo distinto que el primero. El asistente señala; las pantallas de siempre
hacen.

**Las otras seis pantallas del panel no están vivas en el detrás de escena.** La
medición que había que hacer antes de arrancar dio esto: las diecisiete páginas
del panel llaman a `sesionDelPanel()` arriba de todo, cargan sus datos y dibujan
el JSX ahí mismo, sin componente presentacional en el medio. Son 2650 líneas.
Agenda entró barata porque su parte pesada ya estaba afuera, en `Ledger`, que
recibe todo por props. Cobros son 536 líneas y Semana 437, todas adentro de la
página. Traerlas es extraerlas primero, y eso es un trabajo aparte que conviene
hacer cuando haya un segundo motivo para hacerlo.

## Pendiente

- **Volver a sacar las capturas** (`scripts/capturas.mts`). Las de
  `public/portada/` son de antes del `?` en el encabezado del panel. No se
  corrieron el 22 de agosto a propósito: el script escribe en producción
  —siembra medio centenar de turnos en la demo, le rota la contraseña al dueño
  y después limpia—, y si muere en el medio la demo queda sin horarios libres
  justo en la página de ventas. Vale la pena hacerlo mirando.
- **La barbería demo no tiene logo.** Su encabezado muestra el nombre escrito y
  nada más, que es exactamente lo que la lista de primeros pasos le dice a una
  barbería que le falta. Con logo, la demo se vería como un local de verdad.
- **Cobros y Semana vivas** en el detrás de escena, si alguna vez se extraen.

## El panel en el celular: ya entra

Medido el 21 de agosto de 2026 contra producción, a 390 px de ancho, en las ocho
pantallas: Agenda, Cobros, Semana, Horarios, Servicios, Productos, Equipo y
Ajustes. Ninguna se sale. Abajo hay una barra de pestañas propia del celular y
la tabla del cierre de caja se apila sola.

Las tres piezas nuevas se midieron igual, y la medida quedó como prueba: tanto
`e2e/panel-asistente.spec.ts` como `e2e/detras.spec.ts` comparan el ancho de la
página contra el de la pantalla en el proyecto `celular`.
