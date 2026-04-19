# Phase 0 — Pre-redesign Audit

Internal working doc. Goal: ground-truth the current surfaces before we touch code.

## Token system — already strong, no gaps

[apps/web/src/app/globals.css](../../apps/web/src/app/globals.css) is in good shape:
- **Palette**: deep navy base (`--bg-root` oklch 0.135), warm gold accent family (`--accent`, `-bright`, `-dim`, `-subtle`, `-ink`), full semantic status set (success/danger/warning/info with matching dim shades), three tiers of rules.
- **Type scale**: 11–64px fixed rem, Bricolage Grotesque display + Red Hat Text body, both mapped into Tailwind 4 `@theme`.
- **Motion**: `--ease-out-expo`, `--ease-out-quart`, 120/240/480ms durations. `reduced-motion` respected.
- **Editorial utilities already present**: `.reveal`, `.reveal-d1..d4`, `[data-sr]`, `[data-sr-stagger]` (IntersectionObserver-driven), `.shimmer`, `.breath`, `.led-pulse`, `.marquee-track`, `.scanlines`, `.crosshair`, `.kinetic` (clamp display head), `.link-slide`, `.file-tag`.

**Decision:** preserve 100% of the token + editorial utility layer. The redesign re-composes using what's here. Layer `framer-motion` *on top* of this for the theater's sequenced beats — it doesn't replace the existing CSS reveal system.

## Per-surface findings

### [apps/web/src/app/page.tsx](../../apps/web/src/app/page.tsx) — landing
- 1,055 lines single file
- 5 scrolling narrative sections (Hero → Threat → Vault → Scenarios → Recourse → CTA) + live OPS sidebar in hero
- Strong atmospheric pieces to preserve: grain, vignette, kinetic head, marquee, scroll-reveal stagger
- **Weaknesses:** hero competes with the OPS sidebar, too many paragraphs per section, CTAs buried below fold, no obvious "Watch the system decide" path to theater
- **Redesign:** split into ~6 subcomponents, trim copy to ≤3 paragraphs per block, hoist dual CTAs into hero, embed a mini theater loop as the hook

### [apps/web/src/components/demo/demo-panel.tsx](../../apps/web/src/components/demo/demo-panel.tsx) + `demo-run-*.tsx` — theater
- Scenario set is solid and must be preserved byte-for-byte: S-01 Legit 2 USDC, S-02 Blocked 20 USDC, S-03 Overspend 15 USDC (see [demo-visualizer.ts:56-217](../../apps/web/src/components/demo/demo-visualizer.ts))
- Phase model is excellent — `kind: normal | guard-evaluating | guard-deny | guard-warn | hold | terminal`, `durationMs`, `holdsForRealResult`. We reuse this engine verbatim.
- `POLICY_BY_SCENARIO` ([demo-visualizer.ts:336](../../apps/web/src/components/demo/demo-visualizer.ts#L336)) already gives us the plain-English policy snapshot. Decision panel reads directly from it.
- **Weakness:** stage + waterfall + policy panel all compete on screen; playback controls live inside the panel rather than framing the whole stage
- **Redesign:** `/theater` route with scenario rail (left) · single dominant stage (center) · decision panel (right) · evidence drawer (bottom). Playback bar floats above stage. Story/Evidence mode toggle.

### [apps/web/src/app/dashboard/page.tsx](../../apps/web/src/app/dashboard/page.tsx) — dashboard
- Has `BudgetGauge`, setup flow (IntentBuilder → OwnerSpendApproval → AgentDelegate), `ActivityFeed` via `useFeed()`
- **Weakness:** header doesn't answer "what's my exposure right now"; setup blocks and feed fight for vertical space
- **Redesign:** posture header with hero KPI · exposure panel · activity feed · quick actions. If setup incomplete, completion surface dominates and links to `/onboarding`.

### [apps/web/src/app/receipt/[id]/page.tsx](../../apps/web/src/app/receipt/[id]/page.tsx) — receipt
- Structure OK. Hero, metadata grid, challenge CTA, challenge status.
- **Weakness:** overspend-vs-allowed isn't visually expressed; challenge CTA isn't anchored to a sticky rail
- **Redesign:** hero + 4-tab surface (Summary/Timeline/Evidence/Challenge) + sticky challenge rail + delta viz for overspend.

### [apps/web/src/app/review/page.tsx](../../apps/web/src/app/review/page.tsx) — review
- Plain table of pending challenges with Uphold/Reject buttons
- **Weakness:** no case workspace; reviewer lands on a list, not on active case evidence
- **Redesign:** queue (left) · selected workspace (center) · decision rail (right).

### Shared primitives
All present, all reusable:
- `Button` (5 variants), `StatusBadge`, `Shell`, `Section`, `EmptyState`, `LoadingPulse`, `ProgressRail`, `BudgetGauge`, `Input`, `Toast`, `WalletGate`.
- **Need to add in Phase 1:** `BeatIndicator`, `PolicyCheck`, `EvidenceDrawer`, `WizardStepper`, `HeroKPI`, `MotionVariants`.

## Onboarding reality check

[apps/web/src/lib/types.ts:205](../../apps/web/src/lib/types.ts#L205) currently states `OnboardingStep = "connect" | "connected"`. That was the old single-gate design. The real existing flow (scattered across dashboard) is actually five actions:
1. Connect wallet (Privy)
2. Confirm network (Base Sepolia)
3. Define policy (IntentBuilder + OwnerSpendApproval)
4. Delegate agent (AgentDelegate)
5. First run (S-01 in theater)

The wizard unifies these existing surfaces into a linear flow. We drop the "smart account deploy" step from the original plan — GuardedExecutor is a shared protocol, per [apps/web/src/components/onboarding/wallet-connect.tsx](../../apps/web/src/components/onboarding/wallet-connect.tsx). Final wizard: **5 steps, not 6**.

## Mock mode / scenario fixtures

Confirmed `NEXT_PUBLIC_USE_MOCKS=true` path uses `src/mocks/mock-store.ts` and keeps the theater fully playable without backend. [apps/web/src/lib/constants.ts:36](../../apps/web/src/lib/constants.ts#L36) gates this. Redesign preserves this.

## Dependencies to add

Single runtime addition: `framer-motion`. Everything else already present ([apps/web/package.json](../../apps/web/package.json)).

## Phase 0 deliverables — complete

- [x] Token system audited and confirmed fit for redesign
- [x] Per-surface critique written (above)
- [x] Scenario semantics confirmed intact
- [x] Onboarding scope corrected from 6 → 5 steps
- [x] Dependency plan finalized (framer-motion only)

Proceed to Phase 1.
