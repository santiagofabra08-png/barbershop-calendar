import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  aHtml,
  enLinea,
  escapar,
  partirGuia,
  seccionParaRuta,
} from "./guia.ts";

// ============================================================================
// Partir la guía
// ============================================================================

const GUIA = `# Guía de uso

Una introducción que no es de ninguna sección.

## 1. Las dos partes

La página y el panel.

---

## 4. Agenda

Es la pantalla que se abre al entrar.

### Cómo leerla

Los turnos cuelgan de una línea.
`;

test("las secciones salen con su número y su título por separado", () => {
  const s = partirGuia(GUIA);
  assert.deepEqual(
    s.map((x) => [x.numero, x.titulo]),
    [
      [1, "Las dos partes"],
      [4, "Agenda"],
    ],
  );
});

test("lo que está antes de la primera sección queda afuera", () => {
  const s = partirGuia(GUIA);
  assert.ok(!s.some((x) => x.cuerpo.includes("introducción")));
});

test("el cuerpo llega sin su propio título y sin la divisoria del final", () => {
  const [primera] = partirGuia(GUIA);
  assert.equal(primera.cuerpo, "La página y el panel.");
});

test("un título adentro de un bloque de código no parte la guía", () => {
  const con = `## 1. Una

\`\`\`
## 2. Esto es texto
\`\`\`

Sigue la uno.

## 3. Tres
`;
  const s = partirGuia(con);
  assert.deepEqual(
    s.map((x) => x.numero),
    [1, 3],
  );
});

// ============================================================================
// Qué sección le toca a cada pantalla
// ============================================================================

test("cada pantalla del panel encuentra su sección", () => {
  assert.equal(seccionParaRuta("/panel"), 4);
  assert.equal(seccionParaRuta("/panel/cobros"), 5);
  assert.equal(seccionParaRuta("/panel/semana"), 6);
  assert.equal(seccionParaRuta("/panel/horarios"), 7);
  assert.equal(seccionParaRuta("/panel/servicios"), 8);
  assert.equal(seccionParaRuta("/panel/productos"), 9);
  assert.equal(seccionParaRuta("/panel/pedidos"), 9);
  assert.equal(seccionParaRuta("/panel/equipo"), 10);
  assert.equal(seccionParaRuta("/panel/ajustes"), 11);
  assert.equal(seccionParaRuta("/panel/cuenta"), 2);
});

test("una pantalla de adentro hereda la sección de la suya", () => {
  assert.equal(seccionParaRuta("/panel/servicios/nuevo"), 8);
  assert.equal(seccionParaRuta("/panel/equipo/abc-123"), 10);
  assert.equal(seccionParaRuta("/panel/productos/abc-123"), 9);
});

test("la barra del final no cambia nada", () => {
  assert.equal(seccionParaRuta("/panel/cobros/"), 5);
  assert.equal(seccionParaRuta("/panel/"), 4);
});

test("el índice del celular no tiene sección propia", () => {
  assert.equal(seccionParaRuta("/panel/local"), null);
});

// ============================================================================
// De Markdown a HTML
// ============================================================================

test("un párrafo partido en varias líneas queda en uno solo", () => {
  const html = aHtml("Los turnos cuelgan\nde una línea.");
  assert.match(html, /<p[^>]*>Los turnos cuelgan de una línea\.<\/p>/);
  assert.equal(html.match(/<p /g)?.length, 1);
});

test("la negrita y el código se dibujan", () => {
  const html = aHtml("Muestra **un día** y dice `1 h 20 libres`.");
  assert.match(html, /<strong[^>]*>un día<\/strong>/);
  assert.match(html, /<code[^>]*>1 h 20 libres<\/code>/);
});

test("un asterisco adentro de un bloque de código no se vuelve negrita", () => {
  const html = aHtml("Escribí `**esto**` tal cual.");
  assert.match(html, /<code[^>]*>\*\*esto\*\*<\/code>/);
  assert.ok(!html.includes("<strong"));
});

test("un número suelto no se confunde con un bloque de código guardado", () => {
  const html = aHtml("Son `tres` cosas, no 0 ni 1 ni 2.");
  assert.match(html, /Son <code[^>]*>tres<\/code> cosas, no 0 ni 1 ni 2\./);
});

test("los links externos abren afuera; los internos quedan como texto", () => {
  const externo = aHtml("Mirá [la página](https://ejemplo.com).");
  assert.match(externo, /<a [^>]*href="https:\/\/ejemplo\.com"/);
  assert.match(externo, /target="_blank"/);

  const interno = aHtml("Mirá [Agenda](#4-agenda).");
  assert.ok(!interno.includes("<a "));
  assert.match(interno, /<strong[^>]*>Agenda<\/strong>/);
});

test("una lista se dibuja como lista y el renglón partido no se corta", () => {
  const html = aHtml(
    "- **Los ratos libres** no son espacio vacío: son\n  información.\n- La línea de Ahora.",
  );
  assert.equal(html.match(/<li/g)?.length, 2);
  assert.match(html, /son información\./);
});

test("una lista numerada se numera sola", () => {
  const html = aHtml("1. Primero\n2. Segundo");
  assert.match(html, /<ol/);
  assert.equal(html.match(/<li/g)?.length, 2);
});

test("una cita de varias líneas es una sola cita", () => {
  const html = aHtml("> Hola Martín!\n> ¿Confirmás que venís?");
  assert.equal(html.match(/<blockquote/g)?.length, 1);
  assert.match(html, /Hola Martín! ¿Confirmás que venís\?/);
});

test("dos citas separadas por una línea vacía son dos citas", () => {
  const html = aHtml("> Una.\n\n> Otra.");
  assert.equal(html.match(/<blockquote/g)?.length, 2);
});

test("una tabla sale con encabezado, cuerpo y alineación", () => {
  const html = aHtml(
    "| | Dueño | Barbero |\n|---|:---:|:---:|\n| Ver su agenda | ✅ | ✅ |",
  );
  assert.match(html, /<table/);
  assert.equal(html.match(/<th /g)?.length, 3);
  assert.equal(html.match(/<td /g)?.length, 3);
  assert.match(html, /<th[^>]*text-center[^>]*>Dueño<\/th>/);
});

test("la tabla viaja adentro de una caja que se puede arrastrar", () => {
  const html = aHtml("| A | B |\n|---|---|\n| 1 | 2 |");
  assert.match(html, /<div class="[^"]*overflow-x-auto[^"]*"><table/);
  assert.equal(html.match(/<\/div>/g)?.length, 1);
});

test("un bloque de código se dibuja tal cual, sin interpretar nada", () => {
  const html = aHtml("```\ntubarberia.tuapp.com/entrar\n```");
  assert.match(html, /<pre[^>]*><code>tubarberia\.tuapp\.com\/entrar<\/code>/);
});

test("los títulos de adentro bajan un nivel: la sección ya es el h2", () => {
  const html = aHtml("### Cómo leerla\n\n#### Detalle");
  assert.match(html, /<h3[^>]*>Cómo leerla<\/h3>/);
  assert.match(html, /<h4[^>]*>Detalle<\/h4>/);
});

test("el HTML del texto se escapa", () => {
  assert.equal(escapar('<b>"x" & y</b>'), "&lt;b&gt;&quot;x&quot; &amp; y&lt;/b&gt;");
  assert.match(aHtml("Un <script> suelto."), /&lt;script&gt;/);
  assert.ok(!aHtml("Un <script> suelto.").includes("<script>"));
});

test("enLinea no deja marcas sueltas", () => {
  const html = enLinea("Con `código` y **negrita** y [link](https://x.com).");
  assert.ok(!/\u0000/.test(html));
});

// ============================================================================
// Contra la guía de verdad
// ============================================================================
// Los ejemplos de arriba prueban el renderizador. Esto prueba que la guía que
// se va a dibujar de verdad se puede partir y dibujar entera, que es lo que
// se rompería el día que alguien escriba algo que el subconjunto no cubre.

const REAL = readFileSync("docs/guia-del-panel.md", "utf8");

test("la guía de verdad tiene sus trece secciones", () => {
  const s = partirGuia(REAL);
  assert.deepEqual(
    s.map((x) => x.numero),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
  );
});

test("toda pantalla del panel encuentra una sección que existe de verdad", () => {
  const numeros = new Set(partirGuia(REAL).map((s) => s.numero));

  for (const ruta of [
    "/panel",
    "/panel/cobros",
    "/panel/semana",
    "/panel/horarios",
    "/panel/servicios",
    "/panel/productos",
    "/panel/pedidos",
    "/panel/equipo",
    "/panel/ajustes",
    "/panel/cuenta",
  ]) {
    const n = seccionParaRuta(ruta);
    assert.ok(n !== null, `${ruta} no tiene sección`);
    assert.ok(numeros.has(n), `${ruta} apunta a la sección ${n}, que no existe`);
  }
});

test("las trece secciones se dibujan enteras y sin dejar Markdown crudo", () => {
  for (const s of partirGuia(REAL)) {
    const html = aHtml(s.cuerpo);
    assert.ok(html.length > 0, `la sección ${s.numero} quedó vacía`);

    // Si algo del Markdown no se entendió, queda escrito tal cual en la
    // pantalla. Estas tres marcas son las que más se notarían.
    assert.ok(
      !html.includes("**"),
      `quedó negrita sin cerrar en la sección ${s.numero}`,
    );
    assert.ok(
      !/<p[^>]*>\s*[|]/.test(html),
      `una tabla quedó como párrafo en la sección ${s.numero}`,
    );
    assert.ok(
      !/<p[^>]*>\s*&gt;/.test(html),
      `una cita quedó como párrafo en la sección ${s.numero}`,
    );
  }
});

test("ninguna sección de la guía queda sin dibujarse por un renglón raro", () => {
  // El renderizador avanza línea por línea. Si una línea no encajara en ningún
  // caso y no avanzara, esto no terminaría nunca; que termine ya es la prueba.
  const html = partirGuia(REAL)
    .map((s) => aHtml(s.cuerpo))
    .join("");
  assert.ok(html.length > 20000, "la guía dibujada salió sospechosamente corta");
});
