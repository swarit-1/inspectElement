import { forwardRef, type InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input({ label, error, className = "", id, ...props }, ref) {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-medium text-text-secondary uppercase tracking-wider"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`
            w-full bg-bg-surface border border-border rounded-[--radius-md]
            px-3 py-2 text-sm text-text-primary
            placeholder:text-text-tertiary
            hover:border-border/80
            focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent
            transition-colors duration-[--duration-fast]
            disabled:opacity-40 disabled:pointer-events-none
            ${error ? "border-danger focus:ring-danger/40 focus:border-danger" : ""}
            ${className}
          `}
          {...props}
        />
        {error && (
          <p className="text-xs text-danger">{error}</p>
        )}
      </div>
    );
  }
);
