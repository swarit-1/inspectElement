import type { ReactNode } from "react";

/**
 * The small LED-pulsed monospace label used while fetching ledger data.
 * One consistent affordance across feed, review, receipt, and challenge views.
 */
export function LoadingPulse({
  label = "LOADING",
  align = "center",
  pad = true,
}: {
  label?: string;
  align?: "left" | "center";
  pad?: boolean;
}) {
  return (
    <div
      className={`${pad ? "py-12" : ""} ${
        align === "center" ? "grid place-items-center" : ""
      }`}
    >
      <div className="flex items-center gap-3 font-mono text-[12px] tnum text-text-tertiary tracking-wider uppercase">
        <span className="led-pulse h-1.5 w-1.5 rounded-full bg-text-tertiary" />
        {label}…
      </div>
    </div>
  );
}

/**
 * Skeleton row — monochrome, flat, hairline-divided. No shimmer (tacky).
 */
export function SkeletonRow({ columns = 5 }: { columns?: number }) {
  return (
    <div className="grid gap-x-5 items-center py-3 px-4 -mx-4 border-b border-rule-subtle opacity-40"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      aria-hidden
    >
      {Array.from({ length: columns }).map((_, i) => (
        <span key={i} className="h-3 bg-bg-raised rounded-[var(--radius-sharp)]" />
      ))}
    </div>
  );
}

/**
 * A linear progress rail drawn as a hairline that fills with the gold accent.
 * Used to visualize multi-step async flows (e.g. challenge pipeline).
 */
export function ProgressRail({
  steps,
  currentIndex,
  failedIndex,
}: {
  steps: { id: string; label: string }[];
  currentIndex: number;
  failedIndex?: number;
}) {
  const total = Math.max(1, steps.length - 1);
  const clamped = Math.max(0, Math.min(currentIndex, steps.length - 1));
  const pct = (clamped / total) * 100;
  return (
    <div className="flex flex-col gap-2.5">
      <div className="relative h-[2px] w-full bg-bg-inset">
        <div
          className="absolute inset-y-0 left-0 bg-accent transition-[width] duration-[--duration-slow] ease-[--ease-out-expo]"
          style={{ width: `${pct}%` }}
        />
        {steps.map((_, i) => {
          const left = (i / total) * 100;
          const done = i < clamped;
          const active = i === clamped && failedIndex === undefined;
          const failed = failedIndex === i;
          return (
            <span
              key={i}
              className={`absolute -top-[3px] h-2 w-2 rounded-full ${
                failed
                  ? "bg-danger"
                  : done
                    ? "bg-accent"
                    : active
                      ? "bg-accent led-pulse"
                      : "bg-bg-inset border border-rule"
              }`}
              style={{ left: `calc(${left}% - 4px)` }}
              aria-hidden
            />
          );
        })}
      </div>
      <div className="grid" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
        {steps.map((s, i) => {
          const done = i < clamped;
          const active = i === clamped && failedIndex === undefined;
          const failed = failedIndex === i;
          return (
            <div
              key={s.id}
              className={`eyebrow text-[10px] tracking-[0.12em] ${
                failed
                  ? "text-danger"
                  : done
                    ? "text-text-secondary"
                    : active
                      ? "text-accent"
                      : "text-text-quat"
              } ${i === 0 ? "text-left" : i === steps.length - 1 ? "text-right" : "text-center"}`}
            >
              {s.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function InlineStatus({
  tone,
  children,
}: {
  tone: "neutral" | "success" | "danger" | "warning" | "info";
  children: ReactNode;
}) {
  const color =
    tone === "success"
      ? "text-success"
      : tone === "danger"
        ? "text-danger"
        : tone === "warning"
          ? "text-warning"
          : tone === "info"
            ? "text-info"
            : "text-text-tertiary";
  return (
    <span className={`font-mono text-[11.5px] tnum tracking-wider uppercase ${color}`}>
      {children}
    </span>
  );
}
