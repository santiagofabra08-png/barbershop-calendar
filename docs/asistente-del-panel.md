# El asistente del panel

Escrito el 21 de agosto de 2026, antes de empezar, para que el plan no dependa
de la memoria de nadie.

## Qué problema resuelve

Una barbería recién dada de alta llega a un panel casi vacío. Tiene un servicio
y un horario porque `crear-barberia` pide lo mínimo, y nada más: ni logo, ni
colores, ni el resto del equipo, ni productos. **Quien entra ahí no ve un
producto a medio configurar, ve un producto que no anda.** Ése es el momento en
que se abandona, y no hay ninguna pantalla que lo acompañe.

Hoy eso lo tapa Santiago cargando todo a mano antes de entregar la barbería. Con
diez barberías deja de ser posible.

## Lo que se decidió, y lo que se descartó

**El video queda descartado.** Existe un guion de 631 líneas en
`docs/guion-video-panel.md`, de otra sesión, para un video con voz en off de 25
a 28 minutos. No se va a grabar. Nadie mira 25 minutos de video en el momento en
que se abandona, que es cuando entró y no sabe qué hacer.

⚠️ Ese archivo queda en el repositorio sin nada que lo use. Conviene borrarlo o
marcarlo como descartado, o dentro de tres meses alguien lo lee y cree que hay
un video.

**Lo caro ya está hecho.** `docs/guia-del-panel.md` y su versión en HTML (1584
líneas) explican el panel entero, y hay un PDF listo para mandar. Escribir las
explicaciones es el grueso del trabajo de un asistente, y está escrito. Lo que
falta es el mecanismo que las traiga al lugar y al momento donde hacen falta.

**No va a haber un asistente que cree cosas por su cuenta.** Un flujo aparte que
te haga cargar el primer servicio suena mejor y es peor: duplica pantallas que ya
existen y crea un segundo lugar donde se crean servicios, que un día va a decir
algo distinto que el primero. El asistente señala; las pantallas de siempre
hacen.

## Las dos piezas

### 1 · La lista de primeros pasos

Un bloque arriba de `/panel` que dice qué falta. Cada ítem lleva a su pantalla y
se tacha solo cuando el dato existe. Desaparece entero cuando está todo.

Lo que mira, en orden de cuánto duele que falte:

| Paso | Cómo se sabe que está |
| --- | --- |
| Los servicios que ofrecés | más de uno en `services` |
| Los horarios de cada barbero | `working_hours` de todos los que atienden |
| El resto del equipo | opcional, se puede saltar |
| El logo | `logo_light_url` y `logo_dark_url` |
| Los colores | distintos de la paleta de arranque |
| Dirección y contacto | `address`, `whatsapp_phone` |

**No necesita esquema nuevo.** Todo se deduce de datos que ya están. Nada de una
columna `onboarding_step`: un estado guardado se desincroniza del mundo real el
día que alguien borra un servicio.

### 2 · El botón de ayuda

Un `?` fijo en el panel que abre la sección de la guía que corresponde a la
pantalla donde estás. El contenido sale de `docs/guia-del-panel.md`, que ya
existe: hay que partirlo por sección y traerlo, no reescribirlo.

## Cuánto lleva

Dos a tres días. La lista es un día; el botón de ayuda, otro; y queda margen
para que la lista quede bien en el celular, que es donde se va a ver.

## El panel de mentira en la portada

Santiago pidió que se pueda ver el panel desde afuera, sin cuenta: un "detrás de
escena" en la portada, o un enlace desde `demo.turnosforbarber.com`.

**La idea es buena y hay una forma de hacerla que no se puede hacer.**

⚠️ Dar acceso al panel de la demo sin cuenta es exactamente el problema que ya
está analizado en `CLAUDE.md`, en "El panel de prueba por visitante, pensado y
postergado": quien entra puede cambiarle el nombre a la barbería y subir fotos,
o sea **publicar lo que quiera en una página de `turnosforbarber.com` y pasar el
link**. Un límite por IP no frena eso: con una vez alcanza.

Así que el detrás de escena tiene que ser **un recorrido que no guarda nada**:

- Las pantallas del panel de verdad, con datos sembrados, **en modo lectura**.
- Encima, las mismas explicaciones del botón de ayuda. El mismo contenido
  sirviendo para las dos cosas, que es lo que hace que valga la pena.
- Ningún formulario que envíe. Ningún botón que escriba.

Dos caminos para conseguir eso, y hay que elegir uno:

1. **Capturas anotadas.** Barato y seguro. Envejece: el día que cambie el panel
   miente, salvo que se rehagan con `capturas.mts` como ya se hace para la
   portada.
2. **El panel de verdad servido en modo lectura**, con una sesión especial que
   no puede escribir. Más fiel y bastante más caro: hay que garantizar que
   ninguna acción escriba, y eso no se garantiza escondiendo botones sino del
   lado de la base.

El proyecto ya eligió antes "mostrar el producto de verdad" antes que dibujarlo,
y esa decisión salió bien. Pero acá la diferencia de riesgo es grande, y la
opción 1 con `capturas.mts` corriendo después de cada cambio del panel es la
misma disciplina que ya funciona para la portada.

## El panel en el celular: ya entra

Medido el 21 de agosto de 2026 contra producción, a 390 px de ancho, en las ocho
pantallas: Agenda, Cobros, Semana, Horarios, Servicios, Productos, Equipo y
Ajustes. Ninguna se sale. Abajo hay una barra de pestañas propia del celular y
la tabla del cierre de caja se apila sola.

O sea que el asistente tiene que estar pensado para el celular desde el primer
día, no adaptado después: es donde el dueño va a estar cuando lo abra por
primera vez.
