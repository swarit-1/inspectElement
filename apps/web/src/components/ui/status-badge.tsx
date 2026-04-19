import type { ReactNode } from "react";

type BadgeVariant = "success" | "danger" | "warning" | "info" | "neutral";

interface StatusBadgeProps {
  variant: BadgeVariant;
  children: ReactNode;
  /** Override the default leading glyph. Pass "" to omit. */
  glyph?: string;
}

const styles: Record<BadgeVariant, string> = {
  success: "bg-success-dim/55 text-success",
  danger: "bg-danger-dim/55 text-danger",
  warning: "bg-warning-dim/55 text-warning",
  info: "bg-info-dim/65 text-info",
  neutral: "bg-bg-raised text-text-secondary",
};

const defaultGlyph: Record<BadgeVariant, string> = {
  success: "●",
  danger: "✕",
  warning: "△",
  info: "◆",
  neutral: "○",
};

export function StatusBadge({ variant, children, glyph }: StatusBadgeProps) {
  const mark = glyph ?? defaultGlyph[variant];
  return (
    <span className={`statuscode ${styles[variant]}`}>
      {mark && <span aria-hidden className="text-[10px] leading-none">{mark}</span>}
      <span>{children}</span>
    </span>
  );
}
