import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { cambiarEstado, guardarBarbero } from "@/app/panel/equipo/actions";
import { BarberForm } from "@/app/panel/equipo/barber-form";
import { AccessForm } from "@/app/panel/equipo/[id]/access-form";
import { cargarEquipo } from "@/lib/panel/data";
import { sesionDelPanel } from "@/lib/panel/session";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function FichaBarberoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const sesion = await sesionDelPanel();
  if (!sesion) redirect("/entrar");
  if (!sesion.esDuenio) redirect("/panel");

  const { id } = await params;
  const equipo = await cargarEquipo(sesion.tenant);
  const barbero = equipo.find((b) => b.id === id);
  if (!barbero) notFound();

  // Si ya tiene cuenta se sabe por `user_id`, que no viaja en el tipo del panel
  // —no hace falta en ningún otro lado— así que se consulta solo acá.
  const sb = await createClient();
  const { data } = await sb
    .from("barbers")
    .select("user_id")
    .eq("id", id)
    .maybeSingle();
  const yaEntra = Boolean((data as { user_id: string | null } | null)?.user_id);

  const esUnoMismo = barbero.id === sesion.barbero.id;

  return (
    <>
      <Link
        href="/panel/equipo"
        className="text-sm text-muted transition-colors duration-150 ease-out hover:text-ink"
      >
        ‹ Equipo
      </Link>

      <h1 className="mt-3 font-display text-3xl leading-tight text-ink">
        {barbero.displayName}
      </h1>
      {!barbero.isActive ? (
        <p className="mt-2 text-sm text-muted">
          Está dado de baja: no aparece en la página ni puede entrar al panel.
        </p>
      ) : null}

      <BarberForm
        accion={guardarBarbero}
        textoBoton="Guardar cambios"
        inicial={{
          id: barbero.id,
          displayName: barbero.displayName,
          email: barbero.email,
          acceptsBookings: barbero.acceptsBookings,
          pay: barbero.pay,
          photoUrl: barbero.photoUrl,
        }}
      />

      <h2 className="mt-10 text-xs font-semibold tracking-[0.18em] text-muted uppercase">
        Acceso al panel
      </h2>
      <AccessForm
        id={barbero.id}
        nombre={barbero.displayName}
        email={barbero.email}
        yaEntra={yaEntra}
      />

      {!esUnoMismo ? (
        <>
          <h2 className="mt-10 text-xs font-semibold tracking-[0.18em] text-muted uppercase">
            {barbero.isActive ? "Dar de baja" : "Volver a dar de alta"}
          </h2>

          <div className="card mt-4 flex flex-wrap items-center justify-between gap-4 px-5 py-5">
            <p className="max-w-prose text-sm text-muted">
              {barbero.isActive
                ? "Deja de recibir turnos y de entrar al panel. Sus turnos y su historial de plata quedan: no se borra nunca a nadie que haya trabajado acá."
                : "Vuelve a recibir turnos y a entrar al panel con el mismo mail de antes."}
            </p>

            <form action={cambiarEstado}>
              <input type="hidden" name="id" value={barbero.id} />
              <input
                type="hidden"
                name="activar"
                value={barbero.isActive ? "0" : "1"}
              />
              <button
                type="submit"
                className="rounded-lg border border-ink/20 px-5 py-3 text-xs font-semibold tracking-[0.08em] text-ink uppercase transition-colors duration-150 ease-out hover:border-ink hover:bg-ink hover:text-surface active:opacity-90"
              >
                {barbero.isActive ? "Dar de baja" : "Dar de alta"}
              </button>
            </form>
          </div>
        </>
      ) : null}
    </>
  );
}
