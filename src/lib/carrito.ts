/**
 * Elegir productos y contar lo que da.
 *
 * Lo mismo pasa en tres lugares que no se parecen en nada: el ticket de un
 * turno, la venta de mostrador y el catálogo público. En los tres alguien junta
 * cosas de un estante y hay que decirle cuánto es.
 *
 * Vive fuera de `panel/` porque la página pública no tiene por qué depender del
 * panel para sumar. Módulo neutral —sin directiva— y puro: lo importan
 * componentes de cliente y acciones de servidor por igual.
 */

/** Un producto disponible: con su precio y cuántos quedan. */
export type ProductoParaVender = {
  id: string;
  name: string;
  priceCents: number;
  stock: number;
};

/** Cuántos de cada producto lleva. Id del producto → cantidad. */
export type Carrito = Record<string, number>;

/** Las líneas del carrito, en orden y sin los que quedaron en cero. */
export function lineasDelCarrito(
  productos: ProductoParaVender[],
  carrito: Carrito,
): { producto: ProductoParaVender; cantidad: number }[] {
  return productos
    .map((producto) => ({ producto, cantidad: carrito[producto.id] ?? 0 }))
    .filter((l) => l.cantidad > 0);
}

export function totalDelCarrito(
  productos: ProductoParaVender[],
  carrito: Carrito,
): number {
  return lineasDelCarrito(productos, carrito).reduce(
    (t, l) => t + l.producto.priceCents * l.cantidad,
    0,
  );
}

/**
 * El carrito como lo espera la base: `[{"id": "...", "qty": 2}]`.
 *
 * Van ids y cantidades, nunca precios. Los montos los busca Postgres, así que
 * editar este campo desde el navegador no compra nada más barato.
 */
export function carritoAJson(
  productos: ProductoParaVender[],
  carrito: Carrito,
): string {
  return JSON.stringify(
    lineasDelCarrito(productos, carrito).map((l) => ({
      id: l.producto.id,
      qty: l.cantidad,
    })),
  );
}

