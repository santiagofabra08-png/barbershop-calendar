# Guía de uso

Cómo funciona la página de reservas y el panel, explicado sin vueltas.

Está escrita para que la lea el dueño de una barbería o cualquiera del equipo.
No hace falta saber nada de computación.

---

## Índice

1. [Las dos partes](#1-las-dos-partes)
2. [Entrar al panel](#2-entrar-al-panel)
3. [Quién puede hacer qué](#3-quién-puede-hacer-qué)
4. [Agenda](#4-agenda)
5. [Semana: cortes, plata y pagos](#5-semana-cortes-plata-y-pagos)
6. [Horarios](#6-horarios)
7. [Servicios](#7-servicios)
8. [Equipo](#8-equipo)
9. [Ajustes de la barbería](#9-ajustes-de-la-barbería)
10. [Reglas que la página hace cumplir sola](#10-reglas-que-la-página-hace-cumplir-sola)
11. [Preguntas que aparecen siempre](#11-preguntas-que-aparecen-siempre)

---

## 1. Las dos partes

**La página de reservas** es la que ve el cliente. Entra desde el link, elige
qué se quiere hacer, con quién, qué día y a qué hora, deja su nombre, teléfono
y mail, y listo. No se crea ninguna cuenta.

Apenas reserva le llega un mail con su turno, un botón para agendarlo en el
celular y un link para cancelar si no puede venir.

**El panel** es la parte de adentro. Entra el equipo con mail y contraseña, y
ahí está la agenda, los horarios, el recuento de la semana y la plata.

Son la misma página: el cliente ve una parte y el equipo ve la otra.

---

## 2. Entrar al panel

Al final de la dirección de tu barbería agregá `/entrar`. Por ejemplo:

```
tubarberia.tuapp.com/entrar
```

Ponés tu mail y tu contraseña.

**El acceso te lo da el dueño**, desde la ficha de cada barbero. Si sos barbero
y no podés entrar, pedísela a él.

**Consejo:** en el celular, abrí el panel y guardalo en la pantalla de inicio.
Queda como una aplicación más y no tenés que escribir la dirección cada vez.

Cuando terminás, el botón **Salir** está arriba a la derecha.

### Mi cuenta

**Tocá tu nombre**, arriba a la derecha. Ahí cambiás tu nombre, tu teléfono y
**tu contraseña**.

La primera contraseña te la pone el dueño, porque es la única forma de que
puedas entrar la primera vez. **Cambiala apenas entres**: a partir de ahí la
cuenta es tuya. Si algún día te la olvidás, el dueño te pone una nueva y
volvés a empezar.

Ahí también ves cómo cobrás, para consultarlo. Eso no se edita desde ahí.

---

## 3. Quién puede hacer qué

Hay dos perfiles. **Un dueño también puede cortar**: no son dos personas
distintas, es la misma con más permisos.

| | Dueño | Barbero |
|---|:---:|:---:|
| Ver su propia agenda | ✅ | ✅ |
| Ver la agenda de todo el local | ✅ | — |
| Marcar que un cliente no vino | ✅ | ✅ (los suyos) |
| Cargar un turno a mano | ✅ (a cualquiera) | ✅ (a él) |
| Bloquear un rato | ✅ (a cualquiera) | ✅ (a él) |
| Cambiar sus propios horarios | ✅ | ✅ |
| Cambiar los horarios de otro | ✅ | — |
| Ver sus cortes y su plata | ✅ | ✅ |
| Ver la plata de todo el local | ✅ | — |
| Registrar pagos | ✅ | — |
| Ver lo que le pagaron a él | ✅ | ✅ |
| Agregar, editar y sacar servicios | ✅ | — |
| Agregar y dar de baja barberos | ✅ | — |
| Definir cómo cobra cada uno | ✅ | — |
| Cambiar los datos y colores de la barbería | ✅ | — |
| Cambiar su propio nombre, teléfono y contraseña | ✅ | ✅ |

Un barbero no ve las secciones de Servicios, Equipo ni Ajustes. No están
escondidas: para él directamente no existen.

**En el celular** las tres las vas a encontrar juntas bajo **Local**, en la
barra de abajo. En la computadora están todas arriba. Es la misma división que
hay de verdad: Agenda, Semana y Horarios son de todos los días; las otras tres
se configuran una vez.

Esto no es una cortesía de la pantalla. Los permisos los aplica la base de
datos: aunque alguien intentara entrar por otro lado, no hay dato que darle.

---

## 4. Agenda

Es la pantalla que se abre al entrar, y muestra **un día**.

### Cómo leerla

Los turnos cuelgan de una línea, con la hora en el margen izquierdo, igual que
en la agenda de papel.

- **Los ratos libres están escritos** (`1 h 20 libres`). No es espacio vacío: es
  información. Ahí podés comer, o meter a alguien que llame.
- **La línea de "Ahora"** te dice en qué punto del día estás. Aparece solo si
  estás mirando hoy.
- Con las flechas **‹ ›** te movés de día. **Hoy** te trae de vuelta.
- Arriba se ve el resumen del día: cuántos cortes y cuánto entró.
- Si en el día trabajó más de un barbero, cada turno dice de quién es.

### Qué podés hacer en cada turno

**WhatsApp** — abre el chat con el cliente, con su número ya puesto. Sirve para
recordarle el turno del día siguiente.

**No vino** — para el cliente que reservó y no apareció.

> Este botón aparece **recién cuando el turno ya empezó**. Uno de mañana no
> puede haber faltado todavía.

Un turno que ya pasó **se cuenta como cumplido salvo que digas lo contrario**.
Solo tenés que tocar el botón en el caso raro. Si hubiera que confirmar uno por
uno los que sí vinieron, nadie lo haría y a la semana el recuento estaría en
cero.

Marcar que no vino **no le suma plata a nadie**, pero queda contado aparte. Al
final de la semana vas a ver cuántos faltaron y cuánto se dejó de cobrar.
¿Se equivocaron y sí vino? El botón cambia a **Sí vino** y se deshace.

### Cargar un turno

Abajo de la agenda, **Cargar un turno**. Es para el que cae sin reservar.

Solo se pide la hora y qué se hizo. El nombre y el teléfono son opcionales: al
que entra por la puerta un martes a las tres no le vas a pedir el mail.

El precio se congela igual que en una reserva de la página. Estos turnos
aparecen marcados como **Cargado a mano**.

> **Cargalos.** Si la mitad de los cortes entra por la puerta y no se anota, el
> recuento de la semana va a estar siempre por debajo de lo que trabajaste.

### Bloquear un rato

Para un turno médico, un almuerzo suelto, la tarde que te vas antes. Ponés
desde, hasta y el motivo.

Nadie va a poder reservar en ese rato. Para el horario de **todas** las semanas
no uses esto: usá Horarios.

---

## 5. Semana: cortes, plata y pagos

El recuento del período. **La semana va de lunes a domingo.**

Con **Ver el mes** cambiás a mes completo, y con **‹ ›** mirás períodos
anteriores.

### Lo que ves

Arriba, **cuánto entró por cortes**. Abajo, en cuatro números:

- **Cortes** — cuántos se hicieron.
- **No vinieron** — cuántos faltaron y cuánto se dejó de cobrar.
- **A pagar al equipo** — lo que hay que repartir.
- **Pagado** — lo que ya anotaste que pagaste, y cuánto falta.

Y al pie, **queda al local**: lo que sobra después de repartir.

Un barbero ve esta misma pantalla con sus propios números: sus cortes, lo que
le corresponde y lo que le pagaron. No ve lo de sus compañeros ni el total del
local.

### Los cuatro modelos de cobro

Cada barbero tiene el suyo, y pueden convivir distintos en el mismo local.

**A comisión** — se lleva un porcentaje de cada corte. Si corta más, cobra más.
Es lo más común con un empleado.

**Sueldo fijo** — cobra siempre lo mismo, corte más o corte menos. El recuento
sirve para ver cómo viene trabajando, no para calcular cuánto pagarle.

**Alquiler de silla** — te paga un fijo por usar la silla y se queda con todo lo
que corta. **Acá la plata va para el otro lado**: el que cobra sos vos.

**Solo recaudación** — no se reparte nada desde el panel. Es lo que corresponde
para el dueño, o si el arreglo se maneja por afuera.

El porcentaje se **congela en cada turno**. Si en agosto le subís la comisión a
alguien, la liquidación de julio no se mueve: lo que se pactó, se pactó.

### Registrar un pago

En la ficha de cada barbero, **Registrar pago**. Se abre con el monto, el
período y la fecha de hoy ya puestos: en el caso normal es abrir y confirmar.

**Esto no mueve plata.** La plata se la das vos en la mano. Acá queda anotado
para que el balance muestre lo que salió y no solo lo que se generó.

Podés cambiar el monto. **Los adelantos existen**: si le diste la mitad el
miércoles y el resto el sábado, anotá dos pagos de la misma semana. Lo pagado
del período es la suma de los dos.

Al lado de cada barbero vas a ver **Falta $X**, **Al día**, o **$X de más** si
le pagaste por encima.

¿Anotaste algo mal? Se borra con la **×**. Un pago mal cargado no es historia,
es un error de tipeo.

> **Este balance es de cortes y pagos a barberos.** El alquiler del local, la
> luz, el agua y los productos no entran acá. Eso se lleva por otro lado.

---

## 6. Horarios

Tu horario de **todas las semanas**: "martes a sábado de 14 a 21".

Cada barbero maneja el suyo sin depender de nadie. El dueño puede editar el de
cualquiera, eligiéndolo arriba.

### Agregar un horario

Tocá los días (`Lu Ma Mi Ju Vi Sá Do`), poné a qué hora abrís y a qué hora
cerrás, y **Agregar**. Se cargan todos los días juntos, porque así se habla: de
martes a sábado de 14 a 21 es un horario, no cinco.

### Un corte al mediodía

Cargá **dos tramos el mismo día**: uno hasta la hora en que te vas y otro desde
que volvés. El hueco del medio simplemente no existe como horario, y nadie
puede reservar ahí.

### Sacar un horario

La **×** al lado de cada tramo.

> Sacar un horario **no cancela los turnos que ya estaban dados**. Si ya había
> alguien anotado en ese rato, seguí en la agenda y hay que avisarle vos.

Si dos tramos del mismo día se pisan, la página no te deja y te dice en qué día
fue.

---

## 7. Servicios

*(Solo el dueño.)*

Todo lo que se puede reservar: corte, barba, cejas, color, mechas, lavado, corte
de niño, lo que ofrezcas.

De cada uno se define el **nombre**, el **precio**, **cuánto lleva** y una
descripción opcional que se ve en la página.

### La duración importa más de lo que parece

**La duración define los horarios que se ofrecen.** Un servicio de 40 minutos en
una agenda de 14 a 21 da turnos a las 14:00, 14:40, 15:20, y así.

Por eso cada servicio tiene su propia grilla: si alguien reserva una barba de 20
minutos, los horarios que ve no son los mismos que los del corte.

### Cambiar el precio

Entrás al servicio, cambiás el número y guardás.

> **Los turnos que ya estaban dados conservan su precio.** Si el corte pasa de
> $300 a $350, el que reservó ayer sigue pagando $300. Cada turno guarda lo que
> se pactó.

### El orden

Con las flechas **↑ ↓** ordenás la lista. Es el orden en que los ve el cliente,
así que poné arriba lo que más se pide.

### Sacar un servicio

**Sacar de la página** deja de ofrecerlo. No se borra nunca: los turnos viejos
que lo usaron siguen estando, con lo que se cobró.

Si te arrepentís, **Volver a ofrecer**.

No te va a dejar sacar el último que queda: sin ningún servicio, nadie puede
reservar.

---

## 8. Equipo

*(Solo el dueño.)*

### Agregar un barbero

Nombre, mail y cómo cobra. El mail podés cargarlo después si todavía no lo
sabés.

**Recibe turnos por la página** viene tildado. Destildalo si administra pero no
corta: va a seguir entrando al panel, pero no va a aparecer para reservar.

### Darle acceso al panel

En su ficha, **Acceso al panel**. Ponés una contraseña y se la pasás en persona.
La contraseña se ve mientras la escribís, a propósito: la estás eligiendo para
otro, y taparla con puntitos solo serviría para que la copie mal.

Si se la olvida, ponés una nueva desde el mismo lugar.

Necesita tener un mail cargado: es con lo que entra.

### Dar de baja

**Nunca se borra a nadie.** Dar de baja significa que deja de recibir turnos y
de entrar al panel. Sus turnos y todo lo que trabajó quedan en el historial.

Si vuelve, **Dar de alta** y entra con el mismo mail de antes.

Un dueño no puede darse de baja a sí mismo.

### Un barbero no se puede cambiar el sueldo

Cada uno puede editar su nombre y su teléfono. **El rol, el mail y cómo cobra
solo los toca el dueño**, aunque sea su propia ficha.

---

## 9. Ajustes de la barbería

*(Solo el dueño.)*

Todo lo que ve el cliente en la página, y las reglas con las que se dan los
turnos.

### Datos

**Nombre**, **dirección** y **link del mapa**.

Si dejás el link vacío, el botón del mapa busca solo la dirección de arriba en
Google Maps. Pegá un link únicamente si querés apuntar a un punto exacto —por
ejemplo si la dirección sola no cae bien.

También están la **zona horaria** y la **moneda**. Solo se tocan si la barbería
no está en Uruguay.

### Colores

Son seis, y cada uno tiene su función:

| | Para qué |
|---|---|
| Fondo | El papel de toda la página |
| Tarjetas | Lo que se apoya sobre el fondo |
| Texto | Y también la franja oscura de arriba |
| Texto suave | Aclaraciones y datos secundarios |
| Color principal | Botones y lo que está elegido |
| Color secundario | La segunda franja del poste |

Abajo hay una **muestra de cómo va a quedar** la página, que cambia mientras
elegís. Está ahí por una razón: seis cuadraditos sueltos no te dicen si el texto
se va a leer sobre el fondo. En la muestra sí se ve.

Tocá el cuadrado para abrir el selector de colores, o pegá el código exacto
(`#1B1A18`) en el campo de al lado, que es como suele venir un color de una guía
de marca.

### Reglas de la agenda

**Anticipación mínima** — no se ofrece un turno que arranque antes de esto.
Evita que alguien reserve para dentro de cinco minutos, cuando ya estás cortando.

**Plazo para cancelar** — hasta cuándo el cliente puede cancelar solo. Después
de eso tiene que llamar.

**Hasta cuándo se puede reservar** — dos formas:

- **Una cantidad fija de días.** Siempre se reserva con la misma anticipación.
  Es lo más común.
- **Solo la semana en curso.** La siguiente se abre toda junta, un día y hora
  fijos que elegís vos. Sirve si no querés comprometerte con mucha
  anticipación.

### Lo que no se cambia desde acá

**La dirección web** (el slug). Es el link que tus clientes ya tienen guardado y
que circula por WhatsApp. Cambiarlo los rompería todos de golpe, sin aviso y sin
forma de arreglarlo. Si de verdad hace falta cambiarlo, se coordina.

**El logo**, por ahora. Todavía se carga por atrás.

---

## 10. Reglas que la página hace cumplir sola

Estas no dependen de que nadie se acuerde. Están abajo de todo y no se pueden
saltear.

**Nunca hay dos turnos superpuestos.** Si dos clientes tocan "Reservar" en el
mismo horario en el mismo instante, uno de los dos no entra. No es que la página
revise y después guarde: es imposible que los dos queden.

**El horario lo calcula el servidor.** Nadie puede conseguir un turno fuera de
hora editando la dirección o dejando la pestaña abierta media hora.

**Un turno solo se ofrece si entra entero.** Si cerrás a las 21 y el servicio
lleva 40 minutos, el último turno es a las 20:20.

**Anticipación mínima.** No se puede reservar sobre la hora. Cuánto es lo define
la barbería.

**Cancelación.** El cliente puede cancelar solo hasta un rato antes de su turno,
desde el link que le llegó al mail. Pasado eso, tiene que llamar.

**Precio y duración se congelan** en cada turno, al reservarlo.

**Los datos de los clientes no son públicos.** Nombres, teléfonos y mails no
salen de la barbería. Un visitante ve qué horarios están libres y nada más:
nunca quién reservó.

---

## 11. Preguntas que aparecen siempre

**El dueño sabe mi contraseña.**
Solo la primera, la que te puso para que pudieras entrar. Cambiala desde **Mi
cuenta**, tocando tu nombre arriba a la derecha, y deja de saberla.

**¿Cómo funciona "El primero que haya"?**
El cliente dice que le da igual con quién cortarse, y el reparto lo decide el
servidor: entre los que están libres a esa hora, le toca **al que menos turnos
tiene ese día**. Si empatan, manda el orden del equipo. Así el trabajo se
empareja solo en vez de caerle siempre al primero de la lista.

**Un cliente quiere cancelar y no encuentra el mail.**
Cancelalo vos desde la agenda, o marcalo como que no vino si ya pasó.

**¿Por qué no me deja poner un horario?**
Porque se pisa con otro tramo del mismo día. La página te dice cuál.

**Cambié un precio, ¿qué pasa con los turnos de esta semana?**
Nada. Cada turno guarda el precio que tenía cuando se reservó. El precio nuevo
vale para los que se reserven de ahora en más.

**Le pagué a un barbero de menos, ¿está mal anotarlo?**
No. Anotá lo que le diste de verdad. El panel te va a mostrar **Falta $X** hasta
que completes, y así no se te pierde.

**¿La plata que muestra el panel es la que tengo en la caja?**
Es lo que entró por cortes menos lo que anotaste que pagaste a los barberos. No
incluye el alquiler del local, la luz ni los productos.

**Un barbero se va del local.**
Dalo de baja. No lo borres —no se puede— y así todo lo que trabajó sigue
contando en el historial.

**Se me olvidó marcar que alguien no vino la semana pasada.**
Andá a ese día con las flechas y marcalo. El recuento de esa semana se corrige
solo.

**¿Se pueden ver los turnos de la semana que viene?**
Sí, con la flecha de la agenda. Cuántos días para adelante se pueden **reservar**
lo define la barbería: puede ser una ventana de N días, o solo la semana en
curso con la siguiente abriéndose un día y hora fijos.

---

*Si algo no está acá o no se entiende, decilo: la guía se corrige.*
