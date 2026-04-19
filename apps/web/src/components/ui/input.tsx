import { forwardRef, type InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  /** Inline suffix (e.g. "USDC", "days"). Renders right-aligned inside the field. */
  suffix?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input({ label, error, suffix, className = "", id, ...props }, ref) {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="eyebrow">
            {label}
          </label>
        )}
        <div
          className={`
            relative flex items-center
            bg-bg-inset border-b border-rule
            transition-colors duration-[--duration-fast]
            hover:border-rule-strong
            focus-within:border-accent
            ${error ? "border-danger" : ""}
          `}
        >
          <input
            ref={ref}
            id={inputId}
            className={`
              flex-1 min-w-0 bg-transparent
              h-10 px-0 text-[13px] text-text-primary tnum
              placeholder:text-text-quat
              focus:outline-none
              disabled:opacity-35 disabled:pointer-events-none
              ${className}
            `}
            {...props}
          />
          {suffix && (
            <span className="eyebrow shrink-0 pl-3 text-text-tertiary">
              {suffix}
            </span>
          )}
        </div>
        {error && <p className="text-[12px] text-danger tnum">{error}</p>}
      </div>
    );
  }
);
