import Link from "next/link";
import { redirect } from "next/navigation";

import { cargarEquipo, cargarServiciosDelPanel } from "@/lib/panel/data";
import { contarPedidosNuevos } from "@/lib/panel/pedidos";
import { cargarProductos } from "@/lib/panel/productos";
import { sesionDelPanel } from "@/lib/panel/session";

export const dynamic = "force-dynamic";

/**
 * Lo que se configura una vez.
 *
 * En pantalla grande estas tres secciones están en la barra de arriba y esta
 * página casi no se usa. En el celular es la puerta de entrada a las tres, y
 * cada una llega con el dato que contesta "¿cómo está esto hoy?" sin tener que
 * abrirla.
 */
export default async function LocalPage() {
  const sesion = await sesionDelPanel();
  if (!sesion) redirect("/entrar");
  if (!sesion.esDuenio) redirect("/panel");

  const { tenant } = sesion;
  const [equipo, servicios, productos, pedidosNuevos] = await Promise.all([
    cargarEquipo(tenant),
    cargarServiciosDelPanel(tenant),
    cargarProductos(tenant),
    contarPedidosNuevos(tenant),
  ]);

  const barberos = equipo.filter((b) => b.isActive).length;
  const enLaPagina = servicios.filter((s) => s.isActive).length;
  const aLaVenta = productos.filter((p) => p.isActive).length;

  const secciones = [
    {
      href: "/panel/servicios",
      titulo: "Servicios",
      texto: "Qué se puede reservar, con su precio y cuánto lleva.",
      dato:
        enLaPagina === 1 ? "1 en la página" : `${enLaPagina} en la página`,
    },
    {
      href: "/panel/productos",
      titulo: "Productos",
      texto: "Ceras, polvos, remeras: lo que vendés además del corte.",
      dato: !tenant.productsEnabled
        ? aLaVenta === 0
          ? "Sin cargar"
          : `${aLaVenta} cargados, catálogo oculto`
        : aLaVenta === 1
          ? "1 a la venta"
          : `${aLaVenta} a la venta`,
    },
    {
      href: "/panel/pedidos",
      titulo: "Pedidos",
      texto: "Quién pidió algo del catálogo por la página.",
      dato:
        pedidosNuevos === 0
          ? "Nada sin contestar"
          : pedidosNuevos === 1
            ? "1 sin contestar"
            : `${pedidosNuevos} sin contestar`,
    },
    {
      href: "/panel/equipo",
      titulo: "Equipo",
      texto: "Quién trabaja acá, cómo cobra y quién entra al panel.",
      dato: barberos === 1 ? "1 barbero" : `${barberos} barberos`,
    },
    {
      href: "/panel/ajustes",
      titulo: "Ajustes",
      texto: "Nombre, dirección, colores y las reglas de la agenda.",
      dato: tenant.name,
    },
  ];

  return (
    <>
      <p className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">
        Local
      </p>
      <h1 className="mt-1 font-display text-3xl leading-tight text-ink">
        Configuración
      </h1>
      <p className="mt-3 max-w-prose text-sm text-muted">
        Esto se toca de vez en cuando. El día a día está en Agenda.
      </p>

      <ul className="mt-8 space-y-3">
        {secciones.map((s) => (
          <li key={s.href}>
            <Link
              href={s.href}
              className="card flex items-center gap-4 px-5 py-4 transition-shadow duration-150 ease-out hover:shadow-lg"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink">{s.titulo}</p>
                <p className="mt-0.5 text-sm text-muted">{s.texto}</p>
                <p className="mt-1.5 truncate text-xs text-muted">{s.dato}</p>
              </div>
              <span aria-hidden="true" className="text-lg text-muted">
                ›
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
