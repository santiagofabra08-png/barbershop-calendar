import Link from "next/link";
import { redirect } from "next/navigation";

import { marcarPedido } from "@/app/panel/pedidos/actions";
import { cargarPedidos, type PedidoDelPanel } from "@/lib/panel/pedidos";
import { sesionDelPanel } from "@/lib/panel/session";
import { formatPrice } from "@/lib/schedule";
import { formatTelefono, paraWhatsApp } from "@/lib/validation";

export const dynamic = "force-dynamic";

export default async function PedidosPage() {
  const sesion = await sesionDelPanel();
  if (!sesion) redirect("/entrar");

  const { tenant } = sesion;
  const pedidos = await cargarPedidos(tenant);

  const nuevos = pedidos.filter((p) => p.status === "new");
  const enCurso = pedidos.filter((p) => p.status === "contacted");
  const cerrados = pedidos.filter((p) => p.status === "closed");

  return (
    <>
      <p className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">
        Pedidos
      </p>
      <h1 className="mt-1 font-display text-3xl leading-tight text-ink">
        Quién quiere algo del catálogo
      </h1>
      <p className="mt-3 max-w-prose text-sm text-muted">
        Nadie pagó nada todavía. Escribile, arreglen cómo y cuándo, y si se
        concreta cobralo desde el mostrador en Cobros.
      </p>

      {pedidos.length === 0 ? (
        <p className="card mt-8 px-5 py-10 text-center text-sm text-muted">
          {tenant.productsEnabled
            ? "Todavía no pidió nadie. Los pedidos de la página aparecen acá."
            : "El catálogo está oculto, así que nadie puede pedir. Se prende desde Productos."}
        </p>
      ) : null}

      <Grupo
        titulo="Sin contestar"
        pedidos={nuevos}
        moneda={tenant.currency}
        timezone={tenant.timezone}
      />
      <Grupo
        titulo="Ya los contactaste"
        pedidos={enCurso}
        moneda={tenant.currency}
        timezone={tenant.timezone}
      />
      <Grupo
        titulo="Terminados"
        pedidos={cerrados}
        moneda={tenant.currency}
        timezone={tenant.timezone}
        apagado
      />
    </>
  );
}

function Grupo({
  titulo,
  pedidos,
  moneda,
  timezone,
  apagado = false,
}: {
  titulo: string;
  pedidos: PedidoDelPanel[];
  moneda: string;
  timezone: string;
  apagado?: boolean;
}) {
  if (pedidos.length === 0) return null;

  return (
    <>
      <h2 className="mt-10 text-xs font-semibold tracking-[0.18em] text-muted uppercase">
        {titulo} · {pedidos.length}
      </h2>
      <ul className={`mt-4 space-y-3 ${apagado ? "opacity-60" : ""}`}>
        {pedidos.map((p) => (
          <li key={p.id}>
            <Ficha pedido={p} moneda={moneda} timezone={timezone} />
          </li>
        ))}
      </ul>
    </>
  );
}

function Ficha({
  pedido,
  moneda,
  timezone,
}: {
  pedido: PedidoDelPanel;
  moneda: string;
  timezone: string;
}) {
  const plata = (c: number) => formatPrice(c, moneda);

  const cuando = new Intl.DateTimeFormat("es-UY", {
    timeZone: timezone,
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(pedido.createdAt));

  return (
    <div className="card px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="font-medium text-ink">{pedido.clientName}</p>
        <p className="text-sm text-muted">{cuando}</p>
      </div>

      <p className="tabular mt-0.5 text-sm text-muted">
        {formatTelefono(pedido.clientPhone)}
        {pedido.clientEmail ? ` · ${pedido.clientEmail}` : ""}
      </p>

      <ul className="mt-3 space-y-1 border-t border-ink/10 pt-3">
        {pedido.items.map((i, n) => (
          <li
            key={`${pedido.id}-${n}`}
            className="flex items-baseline justify-between gap-4 text-sm"
          >
            <span className="text-ink">
              {i.name}
              {i.quantity > 1 ? (
                <span className="tabular text-muted"> ×{i.quantity}</span>
              ) : null}
            </span>
            <span className="tabular shrink-0 text-muted">
              {plata(i.unitPriceCents * i.quantity)}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 border-t border-ink/10 pt-3">
        {/* "Serían" y no "Total": son los precios que vio en la página. Lo que
            se cobre de verdad se decide cuando pase por el local. */}
        <p className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">
          Serían
        </p>
        <p className="tabular font-semibold text-ink">
          {plata(pedido.totalCents)}
        </p>
      </div>

      {pedido.note ? (
        <p className="mt-3 rounded-lg bg-ink/[0.04] px-4 py-3 text-sm text-ink">
          {pedido.note}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <a
          href={`https://wa.me/${paraWhatsApp(pedido.clientPhone)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg bg-accent px-4 py-2 text-xs font-semibold tracking-[0.08em] text-surface uppercase transition-colors duration-150 ease-out hover:bg-ink active:bg-ink/90"
        >
          Escribirle
        </a>

        {pedido.status !== "closed" ? (
          <Marcar
            id={pedido.id}
            estado={pedido.status === "new" ? "contacted" : "closed"}
            label={pedido.status === "new" ? "Ya lo contacté" : "Terminado"}
          />
        ) : null}

        {pedido.status !== "new" ? (
          <Marcar id={pedido.id} estado="new" label="Volver a pendiente" />
        ) : null}

        {pedido.handledByName && pedido.status !== "new" ? (
          <span className="ml-auto text-sm text-muted">
            {pedido.handledByName}
          </span>
        ) : null}
      </div>

      {pedido.status === "contacted" ? (
        <p className="mt-3 text-sm text-muted">
          Cuando pase a buscarlo, cobralo desde{" "}
          <Link
            href="/panel/cobros"
            className="font-medium text-ink underline decoration-ink/25 underline-offset-4 transition-colors duration-150 ease-out hover:decoration-ink"
          >
            Cobros
          </Link>
          , en Mostrador. Ahí baja el stock y entra a la caja.
        </p>
      ) : null}
    </div>
  );
}

function Marcar({
  id,
  estado,
  label,
}: {
  id: string;
  estado: string;
  label: string;
}) {
  return (
    <form action={marcarPedido}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="estado" value={estado} />
      <button
        type="submit"
        className="rounded-lg border border-ink/15 px-4 py-2 text-xs font-semibold tracking-[0.06em] text-muted uppercase transition-colors duration-150 ease-out hover:border-ink/40 hover:text-ink active:bg-ink/[0.06]"
      >
        {label}
      </button>
    </form>
  );
}
