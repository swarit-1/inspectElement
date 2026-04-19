import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen grid place-items-center px-6">
      <div className="max-w-[520px] w-full flex flex-col gap-8">
        <div className="flex items-center gap-3">
          <span className="seq tabular-nums">ERR · 404</span>
          <span className="h-px flex-1 bg-rule" />
        </div>

        <div>
          <h1
            className="font-display font-semibold tracking-tight text-text-primary leading-[0.95]"
            style={{ fontSize: "var(--t-3xl)" }}
          >
            Route not found.
          </h1>
          <p className="mt-4 text-text-secondary leading-relaxed">
            The address you followed doesn&apos;t exist in this guard layer.
            Head back to the dashboard and continue from there.
          </p>
        </div>

        <div className="hairline-top pt-6 flex items-center gap-5">
          <Link
            href="/dashboard"
            className="font-mono text-[12px] tnum tracking-wider uppercase text-accent hover:text-accent-bright underline-offset-4 hover:underline"
          >
            ← Back to dashboard
          </Link>
          <Link
            href="/"
            className="font-mono text-[12px] tnum tracking-wider uppercase text-text-tertiary hover:text-text-primary underline-offset-4 hover:underline"
          >
            Onboarding
          </Link>
        </div>
      </div>
    </div>
  );
}
