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

  const css = `:root{
    --tenant-bg:${safe(colors.bg, "#ffffff")};
    --tenant-surface:${safe(colors.surface, "#ffffff")};
    --tenant-ink:${safe(colors.ink, "#000000")};
    --tenant-ink-muted:${safe(colors.inkMuted, "#666666")};
    --tenant-accent:${safe(colors.accent, "#000000")};
    --tenant-accent-alt:${safe(colors.accentAlt, "#666666")};
  }`;

  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
