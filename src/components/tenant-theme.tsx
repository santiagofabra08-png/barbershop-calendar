import { legibleSobre, tonoDe } from "@/lib/tenant/tono";
import type { Tenant } from "@/lib/tenant/types";

const HEX = /^#[0-9a-fA-F]{6}$/;

/**
 * Inyecta los colores de la barbería como variables CSS.
 *
 * Es el único lugar de toda la aplicación donde un color se convierte en
 * pixeles. Los componentes usan `bg-surface` o `text-accent` sin saber nunca
 * qué color es: por eso la misma página funciona igual para una barbería
 * roja que para una verde.
 *
 * Los valores ya vienen validados por la base (hay un CHECK sobre cada
 * columna), pero se vuelven a chequear acá porque esto termina como CSS.
 */
export function TenantTheme({ tenant }: { tenant: Tenant }) {
  const { colors } = tenant;
  const safe = (value: string, fallback: string) =>
    HEX.test(value) ? value : fallback;

  const bg = safe(colors.bg, "#ffffff");

  // Sobre fondo oscuro lo elegido resplandece; sobre fondo claro se despega
  // con sombra. Las dos recetas viven en `globals.css`: acá solo se elige.
  const tono = tonoDe(bg);

  // Y lo mismo, un piso más abajo: qué color de letra sobrevive encima del
  // acento. Es la misma pregunta y la misma frontera de luminancia, aplicada
  // al acento en vez de al fondo.
  const acento = safe(colors.accent, "#000000");
  const sobreAcento =
    tonoDe(acento) === "oscuro"
      ? safe(colors.surface, "#ffffff")
      : safe(colors.ink, "#000000");

  // Y el acento como tinta: si no contrasta contra la tarjeta, se oscurece
  // hasta que se lea, conservando el matiz.
  const acentoComoTinta = legibleSobre(
    acento,
    safe(colors.surface, "#ffffff"),
    safe(colors.ink, "#000000"),
  );

  const css = `:root{
    --tenant-bg:${bg};
    --tenant-surface:${safe(colors.surface, "#ffffff")};
    --tenant-ink:${safe(colors.ink, "#000000")};
    --tenant-ink-muted:${safe(colors.inkMuted, "#666666")};
    --tenant-accent:${acento};
    --tenant-accent-alt:${safe(colors.accentAlt, "#666666")};
    --tenant-on-accent:${sobreAcento};
    --tenant-accent-text:${acentoComoTinta};
    --glow:var(--glow-${tono});
    --glow-accent:var(--glow-accent-${tono});
  }`;

  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
