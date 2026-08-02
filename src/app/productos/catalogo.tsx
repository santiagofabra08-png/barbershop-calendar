"use client";

import Image from "next/image";
import { useActionState, useState } from "react";

import { pedir, type EstadoPedido } from "@/app/productos/actions";
import {
  carritoAJson,
  lineasDelCarrito,
  totalDelCarrito,
  type Carrito,
} from "@/lib/carrito";
import { formatPrice } from "@/lib/schedule";

export type ProductoEnVidriera = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  stock: number;
  imageUrl: string | null;
};

const etiqueta =
  "block text-xs font-semibold tracking-[0.14em] text-ink uppercase";

const campo =
  "mt-2 w-full rounded-lg border border-transparent bg-ink/[0.04] px-4 py-3 text-ink transition-[background-color,border-color] duration-150 ease-out placeholder:text-ink/30 hover:border-ink/15 focus:border-ink focus:bg-surface focus:outline-none";

/**
 * El catálogo.
 *
 * Esto no es una tienda y no trata de parecerlo. Nadie paga acá: se elige lo
 * que se quiere, se deja un teléfono, y la barbería llama. Por eso ningún botón
 * dice "comprar" ni "pagar" —diría algo que no va a pasar— y el final del
 * camino no es un pago sino un "te escribimos".
 *
 * Lo que sí se toma en serio es el estante: la foto grande y cuadrada, el
 * precio legible, y lo agotado a la vista en vez de escondido. Que exista una
 * cera que hoy no está es información; hacerla desaparecer haría creer que no
 * la venden.
 */
export function Catalogo({
  productos,
  moneda,
}: {
  productos: ProductoEnVidriera[];
  moneda: string;
}) {
  const [estado, accion, pendiente] = useActionState<EstadoPedido, FormData>(
    pedir,
    {},
  );

  const [carrito, setCarrito] = useState<Carrito>({});

  const plata = (c: number) => formatPrice(c, moneda);
  const lineas = lineasDelCarrito(productos, carrito);
  const total = totalDelCarrito(productos, carrito);
  const cuantos = lineas.reduce((n, l) => n + l.cantidad, 0);

  const cambiar = (id: string, delta: number) => {
    const p = productos.find((x) => x.id === id);
    if (!p) return;
    const nuevo = Math.max(0, Math.min(p.stock, (carrito[id] ?? 0) + delta));
    setCarrito({ ...carrito, [id]: nuevo });
  };

  const valores = estado.valores;

  return (
    <>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-6">
        {productos.map((p) => {
          const cantidad = carrito[p.id] ?? 0;
          const agotado = p.stock === 0;

          return (
            <li key={p.id} className={agotado ? "opacity-55" : ""}>
              <div className="relative aspect-square overflow-hidden rounded-xl bg-ink/[0.05]">
                {p.imageUrl ? (
                  <Image
                    src={p.imageUrl}
                    alt={p.name}
                    fill
                    sizes="(min-width: 640px) 15rem, 45vw"
                    className="object-cover"
                  />
                ) : (
                  // Sin foto no se pide disculpas: se pone el nombre grande y
                  // listo. Un cuadrado gris con "sin imagen" se ve peor que
                  // cualquier cosa que se pueda leer.
                  <span className="flex h-full items-center justify-center px-3 text-center font-display text-lg leading-tight font-bold text-ink/25">
                    {p.name}
                  </span>
                )}
              </div>

              <p className="mt-3 leading-snug font-medium text-ink">{p.name}</p>
              {p.description ? (
                <p className="mt-0.5 text-sm leading-snug text-muted">
                  {p.description}
                </p>
              ) : null}
              <p className="tabular mt-1 font-display text-lg leading-none text-ink">
                {plata(p.priceCents)}
              </p>

              <div className="mt-3">
                {agotado ? (
                  <p className="text-sm text-muted">Ahora no hay</p>
                ) : cantidad === 0 ? (
                  <button
                    type="button"
                    onClick={() => cambiar(p.id, +1)}
                    className="w-full rounded-lg border border-ink/20 px-3 py-2.5 text-xs font-semibold tracking-[0.08em] text-ink uppercase transition-colors duration-150 ease-out hover:border-ink hover:bg-ink hover:text-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:opacity-90"
                  >
                    Lo quiero
                  </button>
                ) : (
                  <div className="flex items-center justify-between gap-2 rounded-lg bg-ink/[0.06] px-1.5 py-1.5">
                    <Paso
                      label={`Sacar un ${p.name}`}
                      onClick={() => cambiar(p.id, -1)}
                    >
                      −
                    </Paso>
                    <span className="tabular text-sm font-semibold text-ink">
                      {cantidad}
                    </span>
                    <Paso
                      label={`Agregar otro ${p.name}`}
                      onClick={() => cambiar(p.id, +1)}
                      deshabilitado={cantidad >= p.stock}
                    >
                      +
                    </Paso>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {/* ---- El pedido -----------------------------------------------------
          Aparece recién cuando hay algo. Un formulario vacío arriba de un
          catálogo vacío no invita a nada. */}
      {lineas.length > 0 ? (
        <section id="pedido" className="mt-14 scroll-mt-6">
          <h2 className="font-display text-2xl leading-tight font-bold text-ink">
            Tu pedido
          </h2>

          <form action={accion} className="card mt-4 px-5 py-5 sm:px-6">
            <input
              type="hidden"
              name="productos"
              value={carritoAJson(productos, carrito)}
            />

            <ul className="space-y-2">
              {lineas.map(({ producto, cantidad }) => (
                <li
                  key={producto.id}
                  className="flex items-baseline justify-between gap-4 text-sm"
                >
                  <span className="min-w-0 text-ink">
                    {producto.name}
                    {cantidad > 1 ? (
                      <span className="tabular text-muted"> ×{cantidad}</span>
                    ) : null}
                  </span>
                  <span className="tabular shrink-0 text-ink">
                    {plata(producto.priceCents * cantidad)}
                  </span>
                </li>
              ))}
            </ul>

            <p className="mt-4 flex items-baseline justify-between gap-4 border-t border-ink/10 pt-4">
              <span className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">
                Total
              </span>
              <span className="tabular font-display text-2xl leading-none text-ink">
                {plata(total)}
              </span>
            </p>

            <div className="mt-6 space-y-5">
              <Campo
                id="nombre"
                label="Tu nombre"
                defaultValue={valores?.nombre}
                error={estado.errores?.nombre}
                autoComplete="name"
                placeholder="Como te llamamos"
              />
              <Campo
                id="telefono"
                label="Teléfono"
                type="tel"
                inputMode="tel"
                defaultValue={valores?.telefono}
                error={estado.errores?.telefono}
                autoComplete="tel"
                placeholder="099 123 456"
              />
              <Campo
                id="email"
                label="Mail"
                type="email"
                inputMode="email"
                defaultValue={valores?.email}
                error={estado.errores?.email}
                autoComplete="email"
                placeholder="opcional"
              />
              <Campo
                id="nota"
                label="Algo que quieras aclarar"
                defaultValue={valores?.nota}
                autoComplete="off"
                placeholder="opcional: color, tamaño, cuándo pasás"
              />
            </div>

            {estado.error ? (
              <p
                role="alert"
                className="mt-5 rounded-lg border-l-2 border-accent bg-accent/[0.06] px-4 py-3 text-sm text-ink"
              >
                {estado.error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={pendiente}
              className="mt-6 w-full rounded-lg bg-accent px-6 py-4 text-sm font-semibold tracking-[0.08em] text-surface uppercase transition-colors duration-150 ease-out hover:bg-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink active:bg-ink/90 disabled:cursor-wait disabled:opacity-60"
            >
              {pendiente ? "Enviando…" : "Enviar el pedido"}
            </button>

            {/* La promesa va pegada al botón, no en letra chica al final: es lo
                que la persona necesita saber justo antes de dejar su teléfono. */}
            <p className="mt-3 text-center text-sm text-muted">
              Te escribimos para coordinar cuándo lo pasás a buscar. No pagás
              nada ahora.
            </p>
          </form>
        </section>
      ) : null}

      {/* ---- La barra ------------------------------------------------------
          En el celular el formulario queda lejos después de mirar el estante.
          Esta barra es el atajo, y de paso el recuento: cuántos y cuánto.
          Es un ancla y no un botón con JavaScript, así que el navegador maneja
          el desplazamiento —incluido el de quien pidió menos movimiento—. */}
      {lineas.length > 0 ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <a
            href="#pedido"
            className="pointer-events-auto mx-auto flex max-w-md items-center justify-between gap-4 rounded-xl bg-ink px-5 py-4 text-bg shadow-lg transition-opacity duration-150 ease-out hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:opacity-80"
          >
            <span className="text-sm">
              <span className="tabular font-semibold">{cuantos}</span>{" "}
              {cuantos === 1 ? "producto" : "productos"}
              <span className="tabular opacity-70"> · {plata(total)}</span>
            </span>
            <span className="text-xs font-semibold tracking-[0.1em] uppercase">
              Ver el pedido
            </span>
          </a>
        </div>
      ) : null}

      {/* Espacio para que la barra no tape el último renglón. */}
      {lineas.length > 0 ? <div className="h-24" aria-hidden="true" /> : null}
    </>
  );
}

function Campo({
  id,
  label,
  error,
  ...props
}: {
  id: string;
  label: string;
  error?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} className={etiqueta}>
        {label}
      </label>
      <input
        id={id}
        name={id}
        className={campo}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      />
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-sm text-accent">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Paso({
  label,
  onClick,
  deshabilitado,
  children,
}: {
  label: string;
  onClick: () => void;
  deshabilitado?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={deshabilitado}
      className="flex size-8 items-center justify-center rounded-lg bg-surface text-base leading-none text-ink shadow-sm transition-colors duration-150 ease-out hover:bg-ink hover:text-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:opacity-80 disabled:bg-surface/50 disabled:text-ink/25 disabled:hover:bg-surface/50 disabled:hover:text-ink/25"
    >
      <span aria-hidden="true">{children}</span>
    </button>
  );
}
