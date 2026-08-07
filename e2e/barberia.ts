/**
 * La barbería descartable contra la que corren las pruebas de navegador.
 *
 * Se crea antes de todo y se borra después. Ninguna prueba toca una barbería
 * que estés mirando, y como se arma con `crearBarberia` —el mismo código del
 * alta real— cada corrida de las pruebas del navegador ejercita también el alta.
 *
 * Los datos del acceso viajan por variables de entorno porque `globalSetup` y
 * las pruebas corren en procesos distintos y no comparten memoria.
 */
import { PALETAS, type BarberiaNueva } from "../scripts/lib/alta.mts";

/**
 * El subdominio lo elige `playwright.config.ts` y lo pasa por variable de
 * entorno: la configuración se carga antes que todo lo demás y es el único
 * lugar donde puede quedar decidido para la corrida entera.
 */
export const SLUG = process.env.E2E_SLUG ?? "e2e-prueba";
export const MAIL = `${SLUG}@ejemplo.com`;

/** Dónde se guarda la contraseña generada, para que la lean las pruebas. */
export const ARCHIVO_ACCESO = "e2e/.acceso.json";

/**
 * Abre todos los días y todo el día, a propósito.
 *
 * Una prueba de navegador que dependa de si hoy es martes es una prueba que
 * falla los domingos y nadie sabe por qué. Con la agenda siempre abierta,
 * siempre hay un horario para elegir.
 */
export const BARBERIA: BarberiaNueva = {
  slug: SLUG,
  nombre: "Barbería de Prueba",
  // El nombre no lleva el slug adentro a propósito: las pruebas buscan textos
  // en la pantalla y un nombre que cambia cada corrida los rompería.
  timezone: "America/Montevideo",
  moneda: "UYU",
  direccion: "Calle Falsa 123",
  colores: PALETAS.serena.colores,
  // Ventana ancha: así siempre hay días para elegir, corra cuando corra.
  ventana: { modo: "rolling", dias: 30 },
  minLead: 0,
  plazoCancelacion: 0,
  vidriera: true,
  servicios: [
    { nombre: "Corte", minutos: 30, precio: 500, desc: "Lavado, corte y peinado." },
    { nombre: "Barba", minutos: 30, precio: 300 },
  ],
  productos: [
    { nombre: "Cera de prueba", precio: 400, stock: 10, desc: "Para el carrito." },
  ],
  barberos: [
    {
      nombre: "Ana",
      rol: "owner",
      cobro: { modelo: "revenue_only" },
      email: MAIL,
      dias: [0, 1, 2, 3, 4, 5, 6],
      tramos: [["08:00", "22:00"]],
    },
    {
      nombre: "Beto",
      rol: "barber",
      cobro: { modelo: "commission", porcentaje: 50 },
      dias: [0, 1, 2, 3, 4, 5, 6],
      tramos: [["08:00", "22:00"]],
    },
  ],
};
