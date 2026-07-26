# Tropi Barbershop — Guía de marca

Referencia de identidad visual para el sitio web de reservas. Basada en el logo oficial (poste de barbero con colores del Union Jack).

## Identidad

- **Nombre:** Tropi Barbershop
- **Eyebrow/subtítulo:** "TROPI" siempre en mayúsculas con tracking amplio (letter-spacing: 0.4em aprox.)
- **Nombre principal:** "Barbershop" en serif, peso bold
- **Concepto:** barbería clásica-vintage con toques modernos. Sobrio, masculino, confiable.

## Paleta de colores

| Token | Hex | Uso |
|-------|-----|-----|
| `--color-black` | #111111 | Fondos oscuros, header, footer, texto principal |
| `--color-red` | #D0021B | CTA primario (botón "Reservar"), precios, acentos |
| `--color-blue` | #1D3FA3 | Links, acentos secundarios, detalles |
| `--color-cream` | #F5F0E8 | Fondo de página (aire vintage, no blanco frío) |
| `--color-white` | #FFFFFF | Tarjetas, superficies elevadas |
| `--color-gray` | #6B6B6B | Texto secundario, metadatos |

**Reglas de color:**
- Rojo y azul solo como acentos: máximo ~10% de la pantalla. Nunca como fondos grandes.
- El rojo (#D0021B) es el único color de acción primaria. Un solo CTA rojo por vista.
- El azul (#1D3FA3) nunca compite con el rojo en la misma jerarquía.
- Fondo predominante: crema #F5F0E8 con tarjetas blancas encima.

## Tipografía

| Fuente | Uso | Detalles |
|--------|-----|----------|
| **Playfair Display** (serif) | Títulos, nombre de marca, nombres de servicios | Pesos 400/700. H1 grande y elegante. |
| **Montserrat** (sans) | Cuerpo, botones, labels, navegación | Pesos 400/500/600. |

**Reglas tipográficas:**
- Eyebrows y botones: Montserrat en MAYÚSCULAS con letter-spacing 0.08–0.15em.
- Títulos: Playfair Display, sin mayúsculas forzadas ("Corte clásico", no "CORTE CLÁSICO").
- Nunca mezclar más de estas dos familias.
- Google Fonts: `Playfair+Display:wght@400;700` y `Montserrat:wght@400;500;600`.

## Componentes UI

### Botones
- **Primario:** fondo #D0021B, texto blanco, Montserrat 600 mayúsculas, tracking 0.08em, border-radius 4px, padding generoso (12px 24px aprox.).
- **Secundario:** transparente con borde 1.5px #111111, texto #111111, mismo formato de texto.
- Hover: oscurecer el rojo (~#B00218) o rellenar el secundario con negro.

### Tarjetas (servicios, barberos, reservas)
- Fondo blanco #FFFFFF, borde sutil o sombra muy leve, border-radius 4–8px.
- Nombre del servicio en Playfair Display bold, precio en Montserrat 600 rojo.
- Metadatos (duración, incluye) en Montserrat 12–13px gris #6B6B6B.

### Motivo visual del poste de barbero
- Usar franjas diagonales rojo/blanco/azul como divisores decorativos, subrayados de sección o detalles finos (altura 3–6px).
- CSS ejemplo: `background: repeating-linear-gradient(90deg, #D0021B 0 12px, #FFFFFF 12px 18px, #1D3FA3 18px 30px, #FFFFFF 30px 36px);`
- Es el elemento distintivo de la marca: usarlo con moderación (1–2 apariciones por página).

## Estilo general

- **Bordes:** radio pequeño (4–8px). Look sobrio, nada muy redondeado.
- **Sombras:** mínimas o inexistentes. Preferir bordes finos.
- **Espaciado:** generoso, mucho aire. Secciones bien separadas.
- **Fotografía:** blanco y negro o tonos cálidos desaturados. Nada saturado ni con filtros llamativos.
- **Iconos:** estilo outline, trazo fino, color #111111 o #6B6B6B.
- **Header:** fondo #111111 con logo centrado o a la izquierda, navegación en Montserrat mayúsculas.
- **Footer:** fondo #111111, texto crema/blanco.

## Tono de comunicación

- Español rioplatense, cercano pero profesional ("Reservá tu turno", "Elegí tu barbero").
- Frases cortas y directas. Sin jerga corporativa.
- El CTA principal del sitio es siempre reservar un turno.

## Archivos de marca

- Logo: ver carpeta `Brand/[nombre]/logo/`
- Fotos: ver carpeta `Brand/[nombre]/fotos/`
- Referencias visuales: ver carpeta `Brand/[nombre]/referencias/`
