import Link from "next/link";
import { redirect } from "next/navigation";

import { crearBarbero } from "@/app/panel/equipo/actions";
import { BarberForm } from "@/app/panel/equipo/barber-form";
import { sesionDelPanel } from "@/lib/panel/session";

export const dynamic = "force-dynamic";

export default async function NuevoBarberoPage() {
  const sesion = await sesionDelPanel();
  if (!sesion) redirect("/entrar");
  if (!sesion.esDuenio) redirect("/panel");

  return (
    <>
      <Link
        href="/panel/equipo"
        className="text-sm text-muted transition-colors duration-150 ease-out hover:text-ink"
      >
        ‹ Equipo
      </Link>

      <h1 className="mt-3 font-display text-3xl leading-tight text-ink">
        Agregar barbero
      </h1>
      <p className="mt-3 max-w-prose text-sm text-muted">
        Con esto queda dado de alta y empieza a recibir turnos. Para que pueda
        entrar al panel hay un paso más, en su ficha.
      </p>

      <BarberForm
        accion={crearBarbero}
        textoBoton="Agregar barbero"
        inicial={{
          displayName: "",
          email: null,
          acceptsBookings: true,
          // Comisión al 50% es el arreglo más común con un empleado, y quien
          // agrega a alguien casi siempre está agregando a un empleado.
          pay: { model: "commission", percent: 50 },
        }}
      />
    </>
  );
}
