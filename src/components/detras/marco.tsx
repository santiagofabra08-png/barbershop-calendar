import Link from "next/link";

import "../../app/producto.css";

/**
 * El marco del detrás de escena: lo que decimos nosotros alrededor del panel.
 *
 * **La separación la hace el fondo, no un borde.** Adentro va la pantalla del
 * panel, pintada con los colores de la barbería; afuera, la paleta del
 * producto. Una barbería puede tener cualquier color, así que un borde o una
 * línea no alcanzan para decir dónde termina una cosa y empieza la otra: el
 * corte de superficie se lee igual arriba de un local cálido que de uno
 * oscuro. Es la misma decisión que ya tomó `FranjaDemo`.
 */
export function MarcoDelDetras({
  urlPortada,
  children,
}: {
  /** La portada del producto. Vacío: no se ofrece el link. */
  urlPortada: string;
  children: React.ReactNode;
}) {
  return (
    <div className="paleta-producto flex min-h-full flex-1 flex-col bg-[color:var(--porcelana)] text-[color:var(--esmalte)]">
      <header className="border-b border-[color:var(--vidrio)]">
        <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-8">
          <p className="text-xs font-semibold tracking-[0.18em] text-[color:var(--barbicide)] uppercase">
            Turnos for Barber
          </p>

          {urlPortada ? (
            <a href={urlPortada} className={LINK}>
              Ver el producto ›
            </a>
          ) : null}
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-12 sm:px-8 sm:py-16">
        {children}
      </main>

      <footer className="border-t border-[color:var(--vidrio)]">
        <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-3 px-5 py-6 sm:px-8">
          <Link href="/" className={LINK}>
            ‹ Volver a la barbería de ejemplo
          </Link>
          {urlPortada ? (
            <a href={urlPortada} className={LINK}>
              Quiero una para mi barbería ›
            </a>
          ) : null}
        </div>
      </footer>
    </div>
  );
}

export const LINK =
  "text-sm font-medium text-[color:var(--barbicide)] underline decoration-1 underline-offset-4 transition-colors duration-150 ease-out hover:text-[color:var(--esmalte)] focus-visible:text-[color:var(--esmalte)] focus-visible:outline-none";

/**
 * Una explicación al lado de una pantalla.
 *
 * El rótulo dice de qué pantalla del panel se trata, con el mismo nombre que
 * tiene adentro. Que coincidan no es cosmético: quien después entre al panel
 * de verdad tiene que reconocer lo que vio acá.
 */
export function Nota({
  rotulo,
  titulo,
  pegada = false,
  children,
}: {
  rotulo: string;
  titulo: string;
  /**
   * Que acompañe a la pantalla mientras se la recorre, en pantalla ancha.
   *
   * La agenda es alta y la explicación es corta: sin esto, quien llega
   * mirando el turno de las cinco tiene el texto que lo explica dos pantallas
   * más arriba. En el celular no aplica, que es donde van una abajo de la otra
   * y el problema no existe.
   */
  pegada?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={pegada ? "lg:sticky lg:top-8" : undefined}>
      <p className="text-xs font-semibold tracking-[0.18em] text-[color:var(--barbicide)] uppercase">
        {rotulo}
      </p>
      <h2 className="titulo-producto mt-2 text-2xl leading-tight sm:text-3xl">
        {titulo}
      </h2>
      <div className="mt-4 space-y-3 leading-relaxed text-[color:color-mix(in_oklab,var(--esmalte)_72%,transparent)]">
        {children}
      </div>
    </div>
  );
}

/**
 * El texto de la guía, dibujado con la paleta del producto.
 *
 * `aHtml` arma la guía con las clases del panel (`text-ink`, `bg-accent`), que
 * salen de las variables de cada barbería. Acá eso no sirve: la guía se lee en
 * una página del producto, no adentro de una barbería, y con el acento rojo de
 * la demo quedarían barras rojas cruzando una página azul.
 *
 * En vez de darle a `aHtml` una segunda paleta —dos juegos de clases para el
 * mismo texto, que un día dicen cosas distintas— se redefinen las variables en
 * este contenedor. Las clases son las mismas; lo que cambia es de qué colores
 * salen. Es exactamente lo que hace `TenantTheme`, un piso más abajo y para un
 * pedazo de página en vez de para todas.
 */
export function TextoConPaletaDelProducto({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      // Los subtítulos de la guía van en `font-display`, que adentro del panel
      // es la serif de la barbería y ahí es lo correcto: el título de la
      // pantalla también lo es. Acá el título es el del producto, sin serif, y
      // un subtítulo serif queda como una tercera voz en la misma página.
      className="paleta-producto [&_h3]:font-[family-name:var(--font-body)] [&_h3]:font-semibold [&_h3]:tracking-tight"
      style={
        {
          "--tenant-bg": "#eef0f6",
          "--tenant-surface": "#ffffff",
          "--tenant-ink": "#101426",
          "--tenant-ink-muted": "#565d75",
          "--tenant-accent": "#2e3ab0",
          "--tenant-accent-alt": "#6470d8",
          "--tenant-accent-text": "#2e3ab0",
          "--tenant-on-accent": "#ffffff",
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}

/**
 * La caja donde vive una pantalla del panel de verdad.
 *
 * Pinta el fondo de la barbería adentro, así lo que se ve es la pantalla tal
 * cual, sin que el fondo del producto se le meta por los costados.
 */
export function Pantalla({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-bg shadow-[0_24px_60px_-30px_rgba(16,20,38,0.55)] ring-1 ring-[color:var(--vidrio)]">
      <div className="px-4 py-6 sm:px-6">{children}</div>
    </div>
  );
}
