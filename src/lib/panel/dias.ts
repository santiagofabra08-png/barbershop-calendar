/**
 * Los días de la semana, con el lunes primero.
 *
 * `weekday` es el número que usa Postgres, donde 0 es domingo. El orden de
 * este array es otra cosa: es el orden en que se muestran, y la semana de
 * trabajo no empieza el domingo.
 *
 * Vive en su propio módulo —sin "use client" ni "use server"— porque lo usan
 * las dos mitades. Un módulo de cliente solo puede exportar componentes hacia
 * el servidor: cualquier otra cosa llega del otro lado como un proxy vacío, y
 * un array deja de tener `.map`.
 */
export const DIAS_ORDENADOS = [
  { weekday: 1, corto: "Lu", largo: "Lunes" },
  { weekday: 2, corto: "Ma", largo: "Martes" },
  { weekday: 3, corto: "Mi", largo: "Miércoles" },
  { weekday: 4, corto: "Ju", largo: "Jueves" },
  { weekday: 5, corto: "Vi", largo: "Viernes" },
  { weekday: 6, corto: "Sá", largo: "Sábado" },
  { weekday: 0, corto: "Do", largo: "Domingo" },
];

/** Indexado por el número de Postgres, no por el orden de arriba. */
export const NOMBRE_DIA = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
];
