# Tropi Barbershop — datos operativos

La identidad visual (paleta, tipografía, componentes, tono) está en
[brand-guide.md](brand-guide.md). Acá va solo lo que ese archivo no cubre.

Lo que no sepas, dejalo en blanco — es mejor un hueco que un invento.

---

**Slug** — `tropi-barbershop` → tropi-barbershop.tuapp.com ¿confirmás?

**Dónde queda** — Veracierto 3359

**Zona horaria** — `America/Montevideo`

---

## 🔴 Bloquean el esquema de base de datos

Estas cuatro definen las tablas. Sin ellas no puedo escribir el esquema.

### Servicios

Duración y precio reales. La duración es lo que determina los horarios que se
le ofrecen al cliente.

| Servicio      | Duración            | Precio |
| Corte de pelo | 40 minutos cda corte| 300$   |
|               |                     |        |

La duración es siempre la misma. Solo hay un barbero.

### Barberos

Un barbero. Facundo.

### Horarios de atención

Días y horas. 

| Día       | Abre        | Cierra   |
| Martes    |   2:00 pm   | 21:00 pm |
| Miércoles |   2:00 pm   | 21:00 pm |
| Jueves    |   2:00 pm   | 21:00 pm |
| Viernes   |   2:00 pm   | 21:00 pm |
| Sábado    |   2:00 pm   | 21:00 pm |


## 🟡 Afectan el diseño de la pantalla

### Quién entra por la puerta

Barberia para personas jovenes (pibes), entre 16 a 29 años aproxomadamente.


### Fotos del local — qué muestran

Tres fotos, 1536×2048, todas del **mismo rincón** desde ángulos distintos. En
la práctica es una sola vista, no tres.

El espacio: un cuarto acondicionado, no un local a la calle. Un sillón, una
estación, un espejo, un sillón de cuero de espera al costado.

**La paleta real confirma el brand guide.** Lo que hay en el cuarto es crema
(cortinas, paredes), arena cálida (piso), negro (la caja de herramientas, la
base del sillón, los trípodes) y marrón cuero. El `#F5F0E8` y el `#111111` del
brand guide describen bien el lugar.

**El rojo y el azul no existen en el espacio.** Solo aparecen en el logo
bordado en la capa. Son colores de marca, no del ambiente: hay que usarlos
como acento puntual, nunca como superficie.

**Lo más característico del lugar es la estación:** una caja de herramientas
de mecánico usada como mueble de trabajo, con las máquinas doradas arriba. Es
un objeto de oficio, no de decoración, y encaja con "sobrio, masculino,
confiable" mejor que cualquier mueble de barbería comprado.

Ese dorado de las máquinas es el único color cálido del lugar y no está en el
brand guide. Queda anotado como posible acento, sin decidir.

### Lo que NO conviene hacer con estas fotos

No usarlas grandes en la página. Motivos concretos: la luz de los paneles LED
es plana y dura, hay cables a la vista, el encuadre es de documentación, y el
espejo refleja una cama — deja claro que es una casa.

Sirven como referencia de materiales y para recortes chicos de detalle. La
portada se sostiene con tipografía y el motivo de franjas, como ya se decidió.

---

## Reglas de agenda — decidido

**Anticipación mínima: 1 hora.** No se ofrece un turno que arranque en menos
de una hora. Si son las 15:20, el primer horario disponible es 16:20 (o el
siguiente de la grilla).

**Al achicar el horario, avisar y dejar decidir.** Si el barbero recorta su
horario y quedan turnos afuera, el cambio se guarda igual, pero la pantalla
lista los turnos en conflicto con el teléfono del cliente para reagendar o
avisar por WhatsApp. El sistema nunca cancela por su cuenta.

**Cancelación: hasta 1 hora antes.** Desde el link que le llega al cliente por
mail, sin cuenta. Si el cliente no viene, no pasa nada: no hay penalidad ni
registro de ausencias.

**Sin seña.** Se paga en el local, efectivo o transferencia, como se arregle
con el barbero. El sistema no cobra ni registra pagos.

**Ventana de reserva: solo la semana en curso.** No se puede reservar para la
semana siguiente. La semana nueva se habilita el sábado al cerrar (21:00), así
el domingo —con el local cerrado— el cliente ya puede sacar turno para el
martes.

## Pendiente

- Logo en SVG, y una versión clara para usar sobre el header negro
  (el actual es 500px, sin alfa, artwork negro)
- Fotos del local





