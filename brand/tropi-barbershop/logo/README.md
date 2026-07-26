# Logo — Tropi Barbershop

| Archivo | Usar sobre | Notas |
| --- | --- | --- |
| `logo-tropibarbershop-transparente.png` | Fondos claros: crema `#F5F0E8`, tarjetas blancas | Dibujo negro, fondo transparente |
| `logo-tropibarbershop-claro.png` | Fondos oscuros: header y footer `#111111` | Tinta en crema, rojo y azul del poste intactos |
| `logo-tropibarbershop.png` | — | Original tal como llegó. No usar en la app: tiene fondo blanco sólido |

Los dos primeros se derivaron del original con `sharp`: recorte del fondo por
flood fill desde el borde (para no perforar el blanco de las franjas del
poste), bordes despejados del blanco para que no dejen halo, y sombras suaves
convertidas en tinta de baja opacidad.

## Limitación

Son imágenes de 500×500. Alcanzan para el header (se muestra a ~200px, o sea
2x en pantallas retina) y para las tarjetas. **No alcanzan** para usar el logo
grande en la portada, en un cartel o impreso.

El original vectorial se perdió: el dueño lo mandó por WhatsApp y no hay acceso
a la cuenta donde se generó. Si en algún momento aparece un `.svg` o un `.ai`,
reemplaza a estos dos y el problema de escala desaparece.

## Decidido: la portada no lleva logo grande

En vez de agrandar un PNG de 500px, la portada se construye sobre el motivo de
franjas diagonales rojo/blanco/azul que define el brand guide. Es CSS, así que
escala infinito y no depende del archivo.

El logo se usa chico —header, tarjetas, favicon— que es donde 500px alcanza.
