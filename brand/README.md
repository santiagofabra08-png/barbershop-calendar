# Brand assets — material de referencia

Acá van logos, fotos y referencias visuales de las barberías, para que quien
diseñe la interfaz (humano o Claude) entienda la estética de cada una.

## ⚠️ Esto NO es lo que sirve la app

Esta carpeta es **material de consulta durante el diseño**. No es de donde la
aplicación saca los logos en producción.

|                | Esta carpeta            | Producción                    |
| -------------- | ----------------------- | ----------------------------- |
| Para qué       | Inspirar el diseño      | Mostrarle el logo al cliente  |
| Dónde vive     | En el repo              | Supabase Storage, por tenant  |
| Quién lo sube  | Nosotros, a mano        | El dueño, desde el dashboard  |

Nunca importar un archivo de `brand/` desde `src/`. Eso sería hardcodear un
tenant, y el CLAUDE.md lo prohíbe. El logo y los colores de cada barbería son
**datos en la base**, aplicados con variables CSS.

Cuando entre la barbería número 12, nadie toca este repo.

## Cómo organizarlo

Una subcarpeta por barbería, nombrada con su slug (el mismo que va a usar en
`{slug}.tuapp.com`): minúsculas, sin espacios ni tildes.

```
brand/
  _plantilla/              copiá esta carpeta para cada barbería nueva
  don-carlos/
    logo/                  logo en todas las versiones que tengas
    fotos/                 el local, las herramientas, cortes, el equipo
    referencias/           capturas de cosas que le gustan (o que no)
    notas.md               contexto en palabras
```

`_plantilla/` empieza con guion bajo para que quede arriba de todo y se note
que no es una barbería real.

## Qué sirve dejar

Ordenado por lo que más ayuda a diseñar:

1. **El logo**, preferentemente en `.svg`. Es el que más define la paleta y el
   carácter tipográfico.
2. **Fotos del local.** Muchas veces dicen más que el logo: la madera, los
   azulejos, la luz, los sillones. De ahí sale la textura del diseño.
3. **Referencias.** Capturas de webs, cuentas de Instagram, flyers — cosas que
   al dueño le gustan. Y también las que no: saber qué rechaza acota tanto
   como saber qué quiere.
4. **`notas.md`.** Lo que no se ve en una imagen: quién es el cliente, qué
   precio maneja, cómo habla la barbería.

## Formatos

Se pueden leer directamente:

- **Imágenes** — `.png`, `.jpg`, `.webp`, `.gif`
- **Vectores** — `.svg` (es texto, se leen los colores exactos)
- **Documentos** — `.pdf`

No se pueden leer:

- **`.ai`, `.psd`, `.fig`, `.sketch`** — formatos propietarios. Exportá a PNG
  o SVG antes de dejarlos acá.
- **Links sueltos** — un link a Instagram no se abre solo. Sacá captura, o
  pegá el link en `notas.md` para pedirlo explícitamente.

Si el logo viene en `.ai` o `.psd`, dejalo igual (sirve como original) pero
sumá al lado un `.png` o `.svg` exportado.

## Peso

Estos archivos se commitean, así que suman al tamaño del repo. Las fotos del
celular pesan 5–10 MB cada una y git nunca olvida un archivo grande, aunque
después lo borres.

Antes de dejar una foto, bajala a ~1500px de ancho. Para elegir una paleta
alcanza de sobra, y el repo se mantiene liviano.
