import { forwardRef, type ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "link";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  // The minted-gold key. Inset highlight + ink-dark text. Sharp corners.
  primary:
    "bg-accent text-accent-ink font-semibold shadow-[inset_0_1px_0_oklch(1_0_0_/_0.25),inset_0_-1px_0_oklch(0_0_0_/_0.25)] hover:bg-accent-bright active:translate-y-px",
  secondary:
    "bg-bg-raised text-text-primary border border-rule hover:border-rule-strong hover:bg-bg-overlay active:translate-y-px",
  ghost:
    "bg-transparent text-text-secondary hover:text-text-primary hover:bg-bg-raised",
  danger:
    "bg-danger-dim/70 text-danger font-semibold border border-danger/30 hover:bg-danger-dim hover:border-danger/50 active:translate-y-px",
  link:
    "bg-transparent text-accent hover:text-accent-bright px-0 underline-offset-4 hover:underline",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "text-[12px] h-7 px-3 gap-1.5",
  md: "text-[13px] h-9 px-4 gap-2",
  lg: "text-[14px] h-11 px-6 gap-2.5",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      loading = false,
      disabled,
      children,
      className = "",
      ...props
    },
    ref
  ) {
    const isLink = variant === "link";
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`
          inline-flex items-center justify-center tnum
          ${isLink ? "" : "rounded-[--radius-sharp]"}
          font-medium tracking-[0.01em]
          transition-[background,color,border-color,transform] duration-[--duration-fast] ease-[--ease-out-expo]
          disabled:opacity-35 disabled:pointer-events-none
          cursor-pointer select-none
          ${variantStyles[variant]}
          ${isLink ? "" : sizeStyles[size]}
          ${className}
        `}
        {...props}
      >
        {loading && <Spinner />}
        {children}
      </button>
    );
  }
);

function Spinner() {
  return (
    <svg
      className="animate-spin h-3.5 w-3.5"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="28 28"
        strokeDashoffset="14"
      />
    </svg>
  );
}
