import type { ReactNode } from "react";

interface SectionProps {
  /** Two-digit sequence label (e.g. "01"). */
  index?: string;
  /** Eyebrow chip above the title (e.g. "INTENT"). */
  kicker?: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
}

export function Section({
  index,
  kicker,
  title,
  subtitle,
  children,
  action,
}: SectionProps) {
  return (
    <section className="flex flex-col">
      {/* Header strip with hairline below — no card wrap */}
      <header className="flex items-end justify-between gap-6 pb-4 hairline-bottom">
        <div className="flex items-baseline gap-4 min-w-0">
          {(index || kicker) && (
            <div className="flex items-center gap-2.5 shrink-0 pt-1.5">
              {index && <span className="seq tabular-nums">{index}</span>}
              {kicker && <span className="eyebrow text-text-secondary">{kicker}</span>}
            </div>
          )}
          <div className="min-w-0">
            <h2
              className="font-display font-semibold tracking-tight text-text-primary leading-[1.05]"
              style={{ fontSize: "var(--t-xl)" }}
            >
              {title}
            </h2>
            {subtitle && (
              <p className="text-text-secondary mt-1.5" style={{ fontSize: "var(--t-sm)" }}>
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>

      <div className="pt-6">{children}</div>
    </section>
  );
}
