# IntentGuard — Frontend Redesign

A seven-phase re-staging of the IntentGuard web app. The foundation (oklch
token palette, Bricolage Grotesque + Red Hat Text type system, UI primitives)
was strong; the work below re-composes those primitives into a coherent,
premium, operator-grade experience without touching API contracts, SIWE auth,
wagmi/react-query wiring, mock mode, or scenario semantics.

## Site map

| Route            | Purpose                                                   | Auth |
|------------------|-----------------------------------------------------------|------|
| `/`              | Public landing — hero, proof, 3-step, preview, CTA        | No   |
| `/login`         | Editorial sign-in surface, 4-state, config recovery       | No   |
| `/onboarding`    | Guided 5-step wizard (wallet, network, policy, delegate, first-run) | Mixed |
| `/dashboard`     | Operator console — posture, setup completion, exposure, activity | Yes  |
| `/theater`       | Scenario theater (canonical) — S-01 / S-02 / S-03         | Yes  |
| `/demo`          | Legacy — redirects to `/theater`                          | —    |
| `/receipt/[id]`  | Forensic receipt — hero, delta-viz (overspend), challenge | Yes  |
| `/review`        | Arbiter queue — tabbed Pending/Resolved/All               | Yes  |

## Design principles

**Tokens.** Every surface reads from `globals.css` — no ad-hoc hex. Palette is
warm gold (accent hue 75) against deep navy (bg hue 260) in oklch. Type uses
`--t-xl/2xl/3xl/4xl` for display, `--t-sm/md` for body. Motion tokens live in
`src/lib/motion.ts`: `easeStage` (0.22,1,0.36,1), `easeOutExpo`, shared
`fadeRise`, `beatReveal`, `stagePacket`, `drawerRise` variants.

**Motion vocabulary.** One library — `framer-motion`. One vocabulary — reveals
rise 8-12px, durations 300-500ms, stagger 40-80ms. Shared-layout animations
(`layoutId`) carry accent bars across state changes. `whileInView` reveals
once with `-10%` margin. Reduced-motion is respected via framer's defaults.

**Composition rules.** No nested cards. Hairline rules separate sections.
Hero KPIs lead every dense surface. Status always uses `StatusBadge` with its
semantic variant. Numbers are `tnum`; addresses are `font-mono` + truncated
mid-hash.

## Key components

### Design-system primitives (Phase 1)

- [ui/beat-indicator.tsx](src/components/ui/beat-indicator.tsx) — dot + connector for phase sequences
- [ui/policy-check.tsx](src/components/ui/policy-check.tsx) — pass/fail row with plain-English + technical detail
- [ui/evidence-drawer.tsx](src/components/ui/evidence-drawer.tsx) — bottom drawer with tabs
- [ui/wizard-stepper.tsx](src/components/ui/wizard-stepper.tsx) — vertical progress rail
- [ui/hero-kpi.tsx](src/components/ui/hero-kpi.tsx) — large-scale metric
- [ui/fade-in.tsx](src/components/ui/fade-in.tsx) — scroll-triggered reveal wrapper
- [lib/motion.ts](src/lib/motion.ts) — shared easing curves + variants

### Theater (Phase 2)

- [theater/theater-experience.tsx](src/components/theater/theater-experience.tsx) — orchestrator, hoists `useDemoVisualizer` so stage + evidence share one timer
- [theater/scenario-rail.tsx](src/components/theater/scenario-rail.tsx) — left rail, 3 scenarios with shared-layout accent bar
- [theater/theater-stage.tsx](src/components/theater/theater-stage.tsx) — 5-node corridor with tone-shifting guard and blocked-terminal freeze
- [theater/decision-panel.tsx](src/components/theater/decision-panel.tsx) — outcome + 3 policy checks + next action
- [theater/playback-bar.tsx](src/components/theater/playback-bar.tsx) — play/pause/replay/scrub + Story ↔ Evidence mode toggle
- [theater/evidence-content.tsx](src/components/theater/evidence-content.tsx) — Overview/Trace/Policy Math/Raw tab content builder

Blocked vs challengeable is visually unmistakable: blocked freezes the packet
at the guard with `danger` red barrier; challengeable bends through with
`warning` amber. Each gets a dedicated badge.

### Landing (Phase 3)

- [landing/landing-nav.tsx](src/components/landing/landing-nav.tsx) — fixed translucent top nav
- [landing/hero.tsx](src/components/landing/hero.tsx) — `clamp(56px,9vw,128px)` headline, live spec card, caret, backdrop grid
- [landing/proof-strip.tsx](src/components/landing/proof-strip.tsx) — 5 pillar hairline grid
- [landing/three-step.tsx](src/components/landing/three-step.tsx) — 01/02/03 beats with custom SVG glyphs animating policy + packet + check-mark
- [landing/why-it-matters.tsx](src/components/landing/why-it-matters.tsx) — prompt injection, drift, constrained autonomy threats
- [landing/theater-preview.tsx](src/components/landing/theater-preview.tsx) — looping packet with trail, CTA to `/theater`
- [landing/closing-cta.tsx](src/components/landing/closing-cta.tsx) — final CTA
- [landing/auth-cta.tsx](src/components/landing/auth-cta.tsx) — 4-state button (no config, loading, authed → dashboard, else → login)

Replaced a 1,055-line scrolling narrative with ~200 lines of composed
sections. Headline answers "what is this" in one sentence.

### Auth + onboarding (Phase 4)

- [app/login/page.tsx](src/app/login/page.tsx) — 4 states (sign in / connect wallet / switch network / redirect), StepTicker pills, RecoveryState when `NEXT_PUBLIC_PRIVY_APP_ID` is missing
- [app/onboarding/page.tsx](src/app/onboarding/page.tsx) — Suspense-wrapped wizard mount
- [components/onboarding/onboarding-wizard.tsx](src/components/onboarding/onboarding-wizard.tsx) — query-param routed, localStorage flags, 5 steps
- [hooks/use-onboarding-progress.ts](src/hooks/use-onboarding-progress.ts) — derives `{stepStates, firstIncomplete, percentComplete, isFullyConfigured}` from wallet + network + persisted flags

`WalletGate` now redirects unauthenticated visitors to `/login` rather than
rendering an inline empty state.

### Dashboard (Phase 5)

- [dashboard/posture-header.tsx](src/components/dashboard/posture-header.tsx) — 3 HeroKpi tiles (exposure, active-today, needs-attention) + status chip
- [dashboard/setup-completion.tsx](src/components/dashboard/setup-completion.tsx) — 5-cell progress grid, resume CTA, deep-links to `/onboarding?step=…`
- [dashboard/exposure-panel.tsx](src/components/dashboard/exposure-panel.tsx) — `BudgetGauge` + 4 policy cards (per-tx, daily, counterparties, expiry)
- [dashboard/quick-actions.tsx](src/components/dashboard/quick-actions.tsx) — 4-cell action grid
- [feed/activity-feed.tsx](src/components/feed/activity-feed.tsx) — existing feed retained, linked to `/theater`

### Receipt + review (Phase 6)

- [receipt/delta-viz.tsx](src/components/receipt/delta-viz.tsx) — bipartite bar (allowed vs overage) with legend and 3 stat cards, shown only on overspend
- [app/review/page.tsx](src/app/review/page.tsx) — tabbed queue with shared-layout underline, `Pending/Resolved/All` filters, `AnimatePresence` row transitions

## Per-surface state model

| Surface      | Loading | Empty | Error | Wrong-network | Partial-setup | Complete |
|--------------|---------|-------|-------|---------------|---------------|----------|
| Landing      | n/a     | n/a   | n/a   | nav warns     | CTA adapts    | CTA → dashboard |
| Login        | Privy ready pulse | n/a | recovery state | shell toast | n/a | auto-redirect to `/onboarding` |
| Onboarding   | step-scoped | per-step | per-step | step=network blocked | resume from `firstIncomplete` | redirect to `/dashboard` |
| Dashboard    | feed pulse | empty feed | feed error | shell warns | `SetupCompletion` dominant | normal header |
| Theater      | scenario boot | n/a | runtime surfaced | shell warns | scenario rail gated | scenario rail active |
| Receipt      | pulse   | NotFound editorial | unreachable | shell warns | n/a | challenge CTA visible if eligible |
| Review       | queue pulse | per-filter copy | unreachable | shell warns | n/a | list rendered |

## Verification run

```
$ npx next build
✓ Compiled successfully in 5.4s
✓ Generating static pages (10/10)
  Routes: / · /_not-found · /dashboard · /demo · /icon.svg ·
          /login · /onboarding · /receipt/[id] · /review · /theater
```

TypeScript: `npx tsc --noEmit` → exit 0, no new errors or warnings.

## Dependency delta

Only `framer-motion` added at runtime. No routes removed — `/demo`
redirects to `/theater` via `next.config.mjs`.
