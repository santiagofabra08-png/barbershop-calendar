/**
 * La guía del panel, partida por sección y dibujada adentro del panel.
 *
 * Puro: entra el texto de `docs/guia-del-panel.md` y sale HTML. No lee
 * archivos ni consulta nada. Quien lo lee del disco es `src/lib/guia-fuente.ts`.
 *
 * **Por qué se lee el archivo y no se copia el texto.** La guía ya está
 * escrita, son 730 líneas y explican el panel entero. Copiar los párrafos a un
 * módulo de TypeScript sería un segundo lugar donde vive el mismo texto, y un
 * día uno de los dos va a decir algo que el otro no. Se lee el original.
 *
 * **Por qué hay un renderizador de Markdown escrito a mano.** El proyecto no
 * suma librerías sin preguntar, y de Markdown la guía usa apenas nueve cosas:
 * títulos, párrafos, listas, listas numeradas, tablas, citas, bloques de
 * código, líneas divisorias, y adentro negrita, código y links. Eso entra en
 * un archivo, es puro y se puede probar. Traer un parser entero para esto
 * sería cargar la página de todas las barberías con lo que necesita una
 * pantalla de ayuda.
 */

export type SeccionDeGuia = {
  /** El número que la guía le da: `## 4. Agenda` es la 4. */
  numero: number;
  /** "Agenda", ya sin el número. */
  titulo: string;
  /** El Markdown de la sección, sin su propio título. */
  cuerpo: string;
};

// ============================================================================
// De qué habla cada pantalla
// ============================================================================

/**
 * Qué sección de la guía le corresponde a cada pantalla del panel.
 *
 * Las rutas van de la más larga a la más corta: `/panel/servicios/nuevo` tiene
 * que encontrar Servicios antes de que `/panel` se quede con todo.
 */
const SECCION_POR_RUTA: [string, number][] = [
  ["/panel/cobros", 5],
  ["/panel/semana", 6],
  ["/panel/horarios", 7],
  ["/panel/servicios", 8],
  // Productos y pedidos son la misma sección: un pedido es lo que pasa
  // después de cargar un producto, y separarlos partiría la explicación al
  // medio.
  ["/panel/productos", 9],
  ["/panel/pedidos", 9],
  ["/panel/equipo", 10],
  ["/panel/ajustes", 11],
  ["/panel/cuenta", 2],
];

/**
 * La sección que corresponde a una ruta, o null si ninguna.
 *
 * Null no es un error: `/panel/local` es un índice de otras pantallas y no
 * tiene nada propio que explicar. Ahí la ayuda abre en la lista de temas, que
 * es exactamente lo que hace falta cuando estás parado en un índice.
 */
export function seccionParaRuta(ruta: string): number | null {
  const limpia = ruta.replace(/\/+$/, "") || "/panel";

  // La agenda va aparte y solo por coincidencia exacta. Como `/panel` es
  // prefijo de todas las demás rutas, adentro de la lista se quedaría con
  // todas las que la lista no nombra, incluido `/panel/local`.
  if (limpia === "/panel") return 4;

  for (const [prefijo, numero] of SECCION_POR_RUTA) {
    if (limpia === prefijo || limpia.startsWith(`${prefijo}/`)) return numero;
  }
  return null;
}

// ============================================================================
// Partir la guía
// ============================================================================

const TITULO_DE_SECCION = /^## (\d+)\.\s+(.+)$/;

/**
 * Las secciones numeradas de la guía.
 *
 * Lo que está antes de la primera (el índice y la introducción) queda afuera a
 * propósito: adentro del panel el índice lo arma esta misma función, y la
 * introducción explica que hay una página pública y un panel, que a esta
 * altura ya lo sabe.
 */
export function partirGuia(md: string): SeccionDeGuia[] {
  const lineas = md.split(/\r?\n/);
  const secciones: SeccionDeGuia[] = [];
  let actual: SeccionDeGuia | null = null;
  let cuerpo: string[] = [];
  let enCodigo = false;

  const cerrar = () => {
    if (actual) secciones.push({ ...actual, cuerpo: recortar(cuerpo) });
  };

  for (const linea of lineas) {
    if (linea.startsWith("```")) enCodigo = !enCodigo;

    // Un `## 3. …` adentro de un bloque de código es texto, no un título.
    const m = enCodigo ? null : TITULO_DE_SECCION.exec(linea);
    if (m) {
      cerrar();
      actual = { numero: Number(m[1]), titulo: m[2].trim(), cuerpo: "" };
      cuerpo = [];
      continue;
    }

    if (actual) cuerpo.push(linea);
  }

  cerrar();
  return secciones;
}

/** Saca las líneas vacías y las divisorias de las puntas. */
function recortar(lineas: string[]): string {
  const util = (l: string) => l.trim() !== "" && !/^-{3,}$/.test(l.trim());
  let desde = 0;
  let hasta = lineas.length;
  while (desde < hasta && !util(lineas[desde])) desde += 1;
  while (hasta > desde && !util(lineas[hasta - 1])) hasta -= 1;
  return lineas.slice(desde, hasta).join("\n");
}

// ============================================================================
// De Markdown a HTML
// ============================================================================

export function escapar(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const CLASES = {
  h3: "mt-7 font-display text-lg leading-tight text-ink first:mt-0",
  h4: "mt-5 text-sm font-semibold tracking-[0.08em] text-muted uppercase",
  p: "mt-3 text-[15px] leading-relaxed text-ink",
  ul: "mt-3 space-y-2 text-[15px] leading-relaxed text-ink",
  ol: "mt-3 list-decimal space-y-2 pl-5 text-[15px] leading-relaxed text-ink",
  li: "relative pl-4 before:absolute before:top-[0.6em] before:left-0 before:size-1.5 before:rounded-full before:bg-ink/25",
  cita: "mt-4 border-l-2 border-accent bg-accent/[0.06] px-4 py-3 text-[15px] leading-relaxed text-ink",
  pre: "mt-3 overflow-x-auto rounded-lg bg-ink/[0.06] px-4 py-3 text-[13px] leading-relaxed text-ink",
  tablaCaja: "mt-4 overflow-x-auto",
  tabla: "w-full border-collapse text-left text-[15px] text-ink",
  th: "border-b border-ink/15 py-2 pr-4 text-xs font-semibold tracking-[0.08em] text-muted uppercase",
  td: "border-b border-ink/10 py-2 pr-4 align-top",
  hr: "mt-7 border-t border-ink/10",
  code: "rounded bg-ink/[0.07] px-1.5 py-0.5 text-[0.9em]",
  a: "text-accent-text underline decoration-1 underline-offset-4 transition-colors duration-150 ease-out hover:text-ink",
};

/**
 * Lo de adentro de una línea: negrita, código y links.
 *
 * El código se aparta primero y vuelve al final. Si no, un `**` adentro de un
 * bloque de código se convertiría en negrita, que es justo lo contrario de lo
 * que quiere decir escribir algo entre backticks.
 */
export function enLinea(texto: string): string {
  const guardados: string[] = [];
  const conMarcas = texto.replace(/`([^`]+)`/g, (_, codigo: string) => {
    guardados.push(`<code class="${CLASES.code}">${escapar(codigo)}</code>`);
    // La marca va entre caracteres nulos y no entre espacios ni corchetes: lo
    // que reemplaza al bloque de código tiene que ser algo que no pueda
    // aparecer nunca en el texto de la guía, o un renglón cualquiera podría
    // hacerse pasar por un hueco y desaparecer.
    return `\u0000${guardados.length - 1}\u0000`;
  });

  let html = escapar(conMarcas)
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold">$1</strong>')
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      (_, txt: string, url: string) =>
        // Los links internos de la guía apuntan a anclas de un documento que
        // acá no existe. Se dibujan como texto en negrita: el destino no está,
        // pero lo que decían sigue leyéndose.
        url.startsWith("#")
          ? `<strong class="font-semibold">${txt}</strong>`
          : `<a class="${CLASES.a}" href="${url}" target="_blank" rel="noreferrer">${txt}</a>`,
    );

  html = html.replace(/\u0000(\d+)\u0000/g, (_, i: string) => guardados[Number(i)]);
  return html;
}

const ARRANQUE_DE_BLOQUE =
  /^(#{3,6}\s|[-*]\s|\d+\.\s|>\s|\||```|-{3,}\s*$)/;

/** De Markdown a HTML, con el subconjunto que usa la guía. */
export function aHtml(md: string): string {
  const lineas = md.split(/\r?\n/);
  const salida: string[] = [];
  let i = 0;

  while (i < lineas.length) {
    const linea = lineas[i];

    if (linea.trim() === "") {
      i += 1;
      continue;
    }

    if (/^-{3,}\s*$/.test(linea.trim())) {
      salida.push(`<hr class="${CLASES.hr}" />`);
      i += 1;
      continue;
    }

    const titulo = /^(#{3,6})\s+(.+)$/.exec(linea);
    if (titulo) {
      const nivel = titulo[1].length === 3 ? "h3" : "h4";
      const clase = nivel === "h3" ? CLASES.h3 : CLASES.h4;
      salida.push(`<${nivel} class="${clase}">${enLinea(titulo[2])}</${nivel}>`);
      i += 1;
      continue;
    }

    if (linea.startsWith("```")) {
      const cuerpo: string[] = [];
      i += 1;
      while (i < lineas.length && !lineas[i].startsWith("```")) {
        cuerpo.push(lineas[i]);
        i += 1;
      }
      i += 1; // el cierre
      salida.push(
        `<pre class="${CLASES.pre}"><code>${escapar(cuerpo.join("\n"))}</code></pre>`,
      );
      continue;
    }

    if (/^>\s?/.test(linea)) {
      const cuerpo: string[] = [];
      while (i < lineas.length && /^>\s?/.test(lineas[i])) {
        cuerpo.push(lineas[i].replace(/^>\s?/, ""));
        i += 1;
      }
      salida.push(
        `<blockquote class="${CLASES.cita}">${enLinea(cuerpo.join(" "))}</blockquote>`,
      );
      continue;
    }

    if (linea.startsWith("|")) {
      const filas: string[] = [];
      while (i < lineas.length && lineas[i].startsWith("|")) {
        filas.push(lineas[i]);
        i += 1;
      }
      salida.push(tabla(filas));
      continue;
    }

    const item = /^([-*]|\d+\.)\s+/.exec(linea);
    if (item) {
      const numerada = !/^[-*]$/.test(item[1]);
      const items = juntarItems(lineas, i, numerada);
      i = items.hasta;
      const lis = items.textos
        .map(
          (t) =>
            `<li${numerada ? "" : ` class="${CLASES.li}"`}>${enLinea(t)}</li>`,
        )
        .join("");
      salida.push(
        numerada
          ? `<ol class="${CLASES.ol}">${lis}</ol>`
          : `<ul class="${CLASES.ul}">${lis}</ul>`,
      );
      continue;
    }

    // Lo que queda es un párrafo: sigue hasta la línea vacía o hasta que
    // arranque otro bloque.
    const cuerpo: string[] = [];
    while (
      i < lineas.length &&
      lineas[i].trim() !== "" &&
      !ARRANQUE_DE_BLOQUE.test(lineas[i])
    ) {
      cuerpo.push(lineas[i].trim());
      i += 1;
    }
    if (cuerpo.length > 0) {
      salida.push(`<p class="${CLASES.p}">${enLinea(cuerpo.join(" "))}</p>`);
    } else {
      // Red de seguridad: sin esto, una línea que no encaja en ningún caso
      // dejaría el bucle girando para siempre.
      i += 1;
    }
  }

  return salida.join("");
}

/**
 * Los renglones de una lista, con sus líneas de continuación pegadas.
 *
 * En la guía un ítem largo sigue en la línea de abajo con dos espacios de
 * sangría. Sin juntarlas, cada pedazo quedaría como un renglón suelto.
 */
function juntarItems(
  lineas: string[],
  desde: number,
  numerada: boolean,
): { textos: string[]; hasta: number } {
  const marca = numerada ? /^\d+\.\s+/ : /^[-*]\s+/;
  const textos: string[] = [];
  let i = desde;

  while (i < lineas.length) {
    const linea = lineas[i];
    if (marca.test(linea)) {
      textos.push(linea.replace(marca, ""));
      i += 1;
      continue;
    }
    // Continuación: sangrada y con la lista ya empezada.
    if (textos.length > 0 && /^\s+\S/.test(linea)) {
      textos[textos.length - 1] += ` ${linea.trim()}`;
      i += 1;
      continue;
    }
    break;
  }

  return { textos, hasta: i };
}

/** Encabezado, línea de alineación y cuerpo. */
function tabla(filas: string[]): string {
  const celdas = (fila: string) =>
    fila
      .replace(/^\|/, "")
      .replace(/\|\s*$/, "")
      .split("|")
      .map((c) => c.trim());

  const esSeparador = (fila: string) =>
    celdas(fila).every((c) => /^:?-{2,}:?$/.test(c));

  const encabezado = celdas(filas[0]);
  const cuerpo = filas.slice(esSeparador(filas[1] ?? "") ? 2 : 1);

  const alineacion = esSeparador(filas[1] ?? "")
    ? celdas(filas[1]).map((c) =>
        c.startsWith(":") && c.endsWith(":")
          ? " text-center"
          : c.endsWith(":")
            ? " text-right"
            : "",
      )
    : encabezado.map(() => "");

  const ths = encabezado
    .map(
      (c, n) =>
        `<th class="${CLASES.th}${alineacion[n] ?? ""}">${enLinea(c)}</th>`,
    )
    .join("");

  const trs = cuerpo
    .map(
      (fila) =>
        `<tr>${celdas(fila)
          .map(
            (c, n) =>
              `<td class="${CLASES.td}${alineacion[n] ?? ""}">${enLinea(c)}</td>`,
          )
          .join("")}</tr>`,
    )
    .join("");

  return (
    `<div class="${CLASES.tablaCaja}"><table class="${CLASES.tabla}">` +
    `<thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table></div>`
  );
}
