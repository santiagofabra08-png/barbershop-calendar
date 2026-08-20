# AL Studio

Los datos que pasó Santiago el 20 de agosto de 2026, para dar de alta la
barbería. **Es la primera barbería real del producto**: hasta acá todo lo que
hay en la base son maquetas y demos.

---

**Slug** — `alstudio`

**Dónde queda** — Avenida Italia 4557, Malvín, Montevideo, Uruguay
· [en el mapa](https://maps.app.goo.gl/dbpSbg8ahiMiWyfMA?g_st=ic)

**WhatsApp del local** — 091040556

**Cobra** — efectivo o transferencia. No hay tarjeta, aunque el sistema la
soporte.

## Quién atiende

Son **dos socios**, y entran los dos con el mismo mail
(`alstudio1326@gmail.com`).

| | Teléfono | Rol |
| --- | --- | --- |
| Agustín Freitas | 091040556 | socio |
| Lucas Martínez | 093793939 | socio |

Los dos trabajan los mismos días y las mismas horas.

## Horarios

| | Abre | Cierra |
| --- | --- | --- |
| Lunes a viernes | 10:00 | 19:00 |
| Sábado | 10:00 | 16:00 |
| Domingo | cerrado | — |

Dijeron "cerramos las horas 18:30" y "las horas 15:30". Eso no hay que
configurarlo: la grilla solo ofrece un horario si el servicio **termina** antes
de cerrar, así que con un corte de 30 minutos el último turno cae solo a las
18:30, y con uno de 45 a las 18:15.

## Políticas de agenda

- **Anticipación mínima**: 5 minutos.
- **Cancelación**: hasta 30 minutos antes.
- **Hasta cuándo se puede reservar**: pidieron "sin límite de fecha". La base
  no lo permite: `booking_window_days` acepta hasta 180. Queda en 180, que son
  seis meses. Nadie reserva un corte de pelo con más anticipación que eso.

## Servicios

| Servicio | Duración | Precio |
| -------- | -------- | ------ |
| Corte de cabello | 30 min | $450 |
| Corte y barba | 45 min | $550 |
| Corte de niño | 30 min | $400 |
| Barba | 15 min | $300 |
| Lavado de cabello | 15 min ⚠️ | $150 |
| Color global | 30 min ⚠️ | $2200 |
| Mechas | 30 min ⚠️ | $1600 |

⚠️ **Lavado** vino sin duración; 15 minutos es una suposición.

⚠️ **Color global y mechas a 30 minutos** es lo que pasaron, y llama la
atención: en la mayoría de las barberías un color global lleva bastante más. Si
está mal, el efecto no es cosmético: la grilla ofrece el turno siguiente
demasiado pronto y la persona espera parada.

## La membresía, que no es un servicio

Pasaron **"Membresía Corte + barba $1900"**. No entró como servicio a propósito:
un servicio se cobra cada vez que se reserva, así que quedaría cobrando $1900 en
cada visita en lugar de una vez por mes. El producto no modela suscripciones
todavía. Está pendiente de decidir cómo se cobra.

## Productos

| Producto | Precio | Stock |
| --- | --- | --- |
| Lentes de sol | $590 | 40 |

La vidriera pública (`/productos`) queda **prendida**. Las fotos vienen después;
sin foto el producto se muestra igual.

## Colores

Lo que usan: **negro, blanco y celeste turquesa**.

La paleta definitiva sale del logo, que todavía no está en `logo/`. Mientras
tanto, la de arranque:

| Rol | Valor | Qué es |
| --- | --- | --- |
| `bg` | `#0C0E10` | el negro del fondo |
| `surface` | `#171A1D` | las tarjetas sobre ese fondo |
| `ink` | `#F2F5F6` | el texto |
| `inkMuted` | `#98A2A8` | el texto secundario |
| `accent` | `#2ED3C6` | el celeste turquesa |
| `accentAlt` | `#E8EDEF` | el blanco, que es la segunda franja del poste |

Con fondo oscuro, `TenantTheme` elige sola la receta de resplandor para fondos
oscuros (`src/lib/tenant/tono.ts`). No hay nada que configurar.

Los colores se cambian desde **Ajustes** cuando ellos quieran: son datos, no
código.

## Las fotos que faltan

Santiago va a subir a esta carpeta:

- `logo/` — las dos versiones. Una para fondo claro y otra para fondo oscuro.
  Un logo oscuro desaparece sobre la franja negra del encabezado.
- `fotos/barberos/` — Agustín y Lucas.
- `fotos/trabajos/` — cortes hechos por ellos.
- `fotos/local/` — el espacio de trabajo.

⚠️ Recordatorio de qué es esta carpeta: **material de consulta**. La aplicación
no lee nada de acá. Los logos y las fotos de producción se suben desde el panel
y viven en Supabase Storage, por tenant. Ver `brand/README.md`.

## Lo que pidieron para la página, y todavía no existe

Tres cosas, en orden de cuánto cuestan:

1. **La foto de cada barbero al elegir con quién reservar.** Hoy se muestra la
   inicial en un círculo. Es la que más rinde: la gente elige barbero por la
   cara.
2. **Una galería de trabajos.** Sirve para convencer, pero alarga la página de
   reservas justo antes del botón, y las caras de clientes necesitan permiso.
3. **Fotos del local, sutiles.** Ojo acá: una foto de local hardcodeada fue un
   error real que se arregló el 19 de agosto de 2026, cuando todas las
   barberías mostraban la estación de trabajo de Tropi diciendo que era la suya.
   Tiene que ser un dato por barbería, subido desde el panel.
