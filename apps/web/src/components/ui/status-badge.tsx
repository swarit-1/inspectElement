import type { ReactNode } from "react";

type BadgeVariant = "success" | "danger" | "warning" | "info" | "neutral";

interface StatusBadgeProps {
  variant: BadgeVariant;
  children: ReactNode;
}

const styles: Record<BadgeVariant, string> = {
  success: "bg-success-dim text-success",
  danger: "bg-danger-dim text-danger",
  warning: "bg-warning-dim text-warning",
  info: "bg-info-dim text-info",
  neutral: "bg-bg-raised text-text-secondary",
};

export function StatusBadge({ variant, children }: StatusBadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center gap-1.5 px-2.5 py-1
        text-xs font-semibold tracking-wide uppercase
        rounded-[--radius-sm]
        ${styles[variant]}
      `}
    >
      {children}
    </span>
  );
}
