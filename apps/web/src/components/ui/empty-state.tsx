import Link from "next/link";
import type { ReactNode } from "react";

interface EmptyStateProps {
  /** Mono caption like "NO EVENTS YET", "RECEIPT NOT FOUND". */
  caption: string;
  /** Larger display-font headline (optional — else just caption + body). */
  headline?: string;
  /** Body copy (supports inline links). */
  body: ReactNode;
  /** Optional primary link action. */
  primary?: { label: string; href: string };
  /** Optional secondary link/button action. */
  secondary?: { label: string; href?: string; onClick?: () => void };
  /** Monospace glyph overline, e.g. ✕, ○, △. */
  glyph?: string;
  tone?: "neutral" | "warning" | "danger";
}

/**
 * Neutral editorial empty state. No cards, no illustrations — just the
 * hairline grid the rest of the app uses. Works for empty feed, missing
 * receipt, disconnected wallet, and failed fetches.
 */
export function EmptyState({
  caption,
  headline,
  body,
  primary,
  secondary,
  glyph,
  tone = "neutral",
}: EmptyStateProps) {
  const toneClass =
    tone === "danger"
      ? "text-danger"
      : tone === "warning"
        ? "text-warning"
        : "text-text-quat";
  return (
    <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-10 py-10">
      <div className="flex flex-col">
        {glyph && (
          <span aria-hidden className={`text-[18px] leading-none mb-3 ${toneClass}`}>
            {glyph}
          </span>
        )}
        <div
          className={`font-mono text-[11px] tnum tracking-wider mb-3 ${toneClass}`}
        >
          {caption}
        </div>
        {headline && (
          <div
            className="font-display text-text-secondary leading-tight"
            style={{ fontSize: "var(--t-lg)" }}
          >
            {headline}
          </div>
        )}
      </div>
      <div className="text-[13px] text-text-tertiary leading-relaxed max-w-[56ch]">
        {body}
        {(primary || secondary) && (
          <div className="mt-5 flex items-center gap-5 font-mono text-[12px] tnum tracking-wider">
            {primary && (
              <Link
                href={primary.href}
                className="text-accent hover:text-accent-bright uppercase underline-offset-4 hover:underline"
              >
                {primary.label} →
              </Link>
            )}
            {secondary &&
              (secondary.href ? (
                <Link
                  href={secondary.href}
                  className="text-text-tertiary hover:text-text-primary uppercase underline-offset-4 hover:underline"
                >
                  {secondary.label}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={secondary.onClick}
                  className="text-text-tertiary hover:text-text-primary uppercase underline-offset-4 hover:underline"
                >
                  {secondary.label}
                </button>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
