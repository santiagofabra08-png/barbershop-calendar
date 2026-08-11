/**
 * La guía, en un archivo suelto que se puede mandar.
 *
 * `docs/guia-del-panel.html` es la fuente y está escrita para publicarse como
 * artefacto: no lleva `<!doctype>` ni `<head>`, porque eso se lo pone el
 * publicador. Un archivo así abierto a mano en un navegador cae en modo
 * quirks, donde la grilla y las medidas se acomodan distinto y el documento se
 * ve roto justo cuando se lo estás mandando a alguien que todavía no te
 * compró nada.
 *
 * Esto lo envuelve. No reescribe nada: el texto y el estilo salen del mismo
 * archivo, así que corregir la guía en un lugar la corrige en los dos. Tener
 * dos copias de un documento de 700 líneas es garantizar que un día digan
 * cosas distintas y que nadie se entere hasta que un cliente pregunte.
 *
 *   node scripts/guia.mts
 */

import { readFile, writeFile } from "node:fs/promises";

const FUENTE = "docs/guia-del-panel.html";
const SALIDA = "docs/guia-para-mandar.html";

/*
 * Windows no distingue mayúsculas en los nombres de archivo, así que
 * "Guia-del-panel.html" y "guia-del-panel.html" son el mismo archivo y este
 * script se escribiría encima de su propia fuente. Ya pasó una vez. El chequeo
 * cuesta tres líneas y lo que evita es perder el documento entero.
 */
if (FUENTE.toLowerCase() === SALIDA.toLowerCase()) {
  console.error("La salida pisaría la fuente. Cambiá SALIDA.");
  process.exit(1);
}

const fuente = await readFile(FUENTE, "utf8");

// El corte es el final del estilo: lo de arriba va al head y lo de abajo al
// cuerpo. Si algún día la guía deja de tener un solo bloque de estilo, esto
// tiene que fallar ruidosamente y no armar un archivo a medias en silencio.
const cierre = fuente.indexOf("</style>");
if (cierre === -1) {
  console.error(`No encontré el </style> en ${FUENTE}. No sé dónde cortar.`);
  process.exit(1);
}

const corte = cierre + "</style>".length;
const cabeza = fuente.slice(0, corte).trim();
const cuerpo = fuente.slice(corte).trim();

const documento = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
${cabeza}
</head>
<body>
${cuerpo}
</body>
</html>
`;

await writeFile(SALIDA, documento, "utf8");

const kb = Math.round(Buffer.byteLength(documento) / 102.4) / 10;

console.log(`Listo: ${SALIDA} (${kb} KB)`);
console.log("");
console.log("Es un solo archivo y no pide nada de internet, así que anda");
console.log("abierto desde el escritorio, adjunto en un mail o sin señal.");
console.log("");
console.log("Para mandarlo por WhatsApp conviene el PDF: abrilo en el");
console.log("navegador, Imprimir, y en Destino elegí «Guardar como PDF».");
