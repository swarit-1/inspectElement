import { forwardRef, type ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-[oklch(0.15_0.01_75)] font-semibold hover:brightness-110 active:brightness-95",
  secondary:
    "bg-bg-raised text-text-primary border border-border hover:bg-bg-overlay active:bg-bg-surface",
  ghost:
    "bg-transparent text-text-secondary hover:text-text-primary hover:bg-bg-raised active:bg-bg-overlay",
  danger:
    "bg-danger-dim text-danger font-semibold hover:brightness-110 active:brightness-95",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "text-[13px] px-3 py-1.5 gap-1.5",
  md: "text-sm px-4 py-2 gap-2",
  lg: "text-base px-6 py-3 gap-2.5",
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
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`
          inline-flex items-center justify-center rounded-[--radius-md]
          transition-all duration-[--duration-fast] ease-[--ease-out-expo]
          disabled:opacity-40 disabled:pointer-events-none
          cursor-pointer select-none
          ${variantStyles[variant]}
          ${sizeStyles[size]}
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
      className="animate-spin h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="32 32"
        strokeDashoffset="16"
      />
    </svg>
  );
}
