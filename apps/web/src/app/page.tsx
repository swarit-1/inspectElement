"use client";

import { useCallback, useEffect } from "react";
import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import { WalletConnect } from "@/components/onboarding/wallet-connect";
import { CHAIN_ID } from "@/lib/constants";

export default function HomePage() {
  const { isConnected } = useAccount();
  const router = useRouter();

  const goToDashboard = useCallback(() => {
    router.push("/dashboard");
  }, [router]);

  useEffect(() => {
    if (isConnected) router.prefetch("/dashboard");
  }, [isConnected, router]);

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[1.2fr_1fr]">
      {/* Left: editorial onboarding */}
      <div className="px-6 md:px-10 lg:px-16 py-14 flex flex-col justify-center max-w-[640px] reveal">
        <WalletConnect onConnected={goToDashboard} />
      </div>

      {/* Right: vault diagram column — separation through tone, not card */}
      <aside className="hidden lg:flex bg-bg-surface border-l border-rule flex-col justify-between px-10 py-14 reveal reveal-d2">
        <div>
          <div className="flex items-center gap-2 mb-6">
            <span className="led-pulse h-1.5 w-1.5 rounded-full bg-success" />
            <span className="eyebrow text-text-secondary">Live network</span>
            <span className="seq tabular-nums ml-auto">{CHAIN_ID}</span>
          </div>
          <SchematicDiagram />
        </div>

        <div className="hairline-top pt-6 grid grid-cols-3 gap-x-6 text-[11px] tnum font-mono">
          <Stat label="Operator stake" value="50.0" unit="USDC" />
          <Stat label="Challenge bond" value="1.0" unit="USDC" />
          <Stat label="Window" value="24" unit="hours" />
        </div>
      </aside>
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="eyebrow text-text-quat">{label}</span>
      <span className="text-text-secondary">
        <span className="text-text-primary">{value}</span>{" "}
        <span className="text-text-quat uppercase tracking-wider">{unit}</span>
      </span>
    </div>
  );
}

/**
 * Schematic of the trust path: Owner → Intent → Executor → USDC,
 * with Agent attached as a delegate. Pure SVG, no decorative glow.
 */
function SchematicDiagram() {
  return (
    <svg viewBox="0 0 320 380" className="w-full max-w-[320px]" fill="none">
      <defs>
        <marker
          id="arrowhead"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M0,0 L10,5 L0,10 Z" fill="currentColor" className="text-text-tertiary" />
        </marker>
      </defs>

      {/* Nodes */}
      <Node x={20} y={20} w={120} label="Owner" sub="Smart account" tone="primary" />
      <Node x={180} y={20} w={120} label="Agent" sub="Delegate key" tone="muted" />
      <Node x={100} y={140} w={120} label="GuardedExecutor" sub="On-chain ACL + caps" tone="accent" />
      <Node x={100} y={260} w={120} label="USDC" sub="ERC-20" tone="muted" />

      {/* Connectors */}
      <Connector x1={80} y1={50} x2={140} y2={140} dashed />
      <Connector x1={240} y1={50} x2={200} y2={140} />
      <Connector x1={160} y1={184} x2={160} y2={260} thick />

      {/* Side annotations */}
      <text
        x={170}
        y={100}
        className="fill-text-tertiary"
        fontSize="9"
        fontFamily="ui-monospace, monospace"
      >
        commits intent
      </text>
      <text
        x={210}
        y={100}
        className="fill-text-tertiary"
        fontSize="9"
        fontFamily="ui-monospace, monospace"
      >
        signs payment
      </text>
      <text
        x={170}
        y={222}
        className="fill-accent"
        fontSize="9"
        fontFamily="ui-monospace, monospace"
        fontWeight="600"
      >
        guarded transfer
      </text>

      {/* Bottom recourse path */}
      <text
        x={20}
        y={340}
        className="fill-text-tertiary"
        fontSize="10"
        fontFamily="ui-monospace, monospace"
      >
        ↻ Overspend → Owner files challenge → Operator stake slashed
      </text>
    </svg>
  );
}

function Node({
  x,
  y,
  w,
  label,
  sub,
  tone,
}: {
  x: number;
  y: number;
  w: number;
  label: string;
  sub: string;
  tone: "primary" | "muted" | "accent";
}) {
  const stroke =
    tone === "accent"
      ? "stroke-accent"
      : tone === "primary"
        ? "stroke-text-secondary"
        : "stroke-rule";
  const fill =
    tone === "accent" ? "fill-text-primary" : "fill-text-secondary";
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={44}
        className={`fill-bg-root ${stroke}`}
        strokeWidth={tone === "accent" ? 1.5 : 1}
      />
      <text
        x={x + 10}
        y={y + 19}
        className={fill}
        fontSize="12"
        fontFamily="ui-sans-serif, system-ui"
        fontWeight="600"
      >
        {label}
      </text>
      <text
        x={x + 10}
        y={y + 33}
        className="fill-text-tertiary"
        fontSize="9.5"
        fontFamily="ui-monospace, monospace"
      >
        {sub}
      </text>
    </g>
  );
}

function Connector({
  x1,
  y1,
  x2,
  y2,
  dashed,
  thick,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  dashed?: boolean;
  thick?: boolean;
}) {
  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      className={thick ? "stroke-accent" : "stroke-text-tertiary"}
      strokeWidth={thick ? 1.5 : 1}
      strokeDasharray={dashed ? "3 3" : undefined}
      markerEnd="url(#arrowhead)"
    />
  );
}
