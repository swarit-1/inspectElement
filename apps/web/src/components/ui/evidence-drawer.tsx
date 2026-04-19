"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState, type ReactNode } from "react";
import { drawerRise, easeStage } from "@/lib/motion";

export interface EvidenceTab {
  id: string;
  label: string;
  kicker?: string;
  content: ReactNode;
}

interface EvidenceDrawerProps {
  tabs: EvidenceTab[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: string;
  title?: string;
}

export function EvidenceDrawer({
  tabs,
  open,
  onOpenChange,
  defaultTab,
  title = "Evidence",
}: EvidenceDrawerProps) {
  const [activeId, setActiveId] = useState<string>(defaultTab ?? tabs[0]?.id);
  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];

  return (
    <AnimatePresence>
      {open && (
        <motion.section
          key="evidence-drawer"
          variants={drawerRise}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="
            fixed inset-x-0 bottom-0 z-40
            bg-bg-surface/95 backdrop-blur-md
            border-t border-rule-strong
            shadow-[0_-24px_60px_-24px_oklch(0_0_0_/_0.45)]
          "
          role="dialog"
          aria-label={title}
        >
          <header className="flex items-center justify-between px-6 pt-4 pb-3 hairline-bottom">
            <div className="flex items-center gap-6 min-w-0">
              <span className="eyebrow text-accent">{title}</span>
              <nav className="flex items-center gap-1" aria-label="Evidence tabs">
                {tabs.map((t) => {
                  const isActive = t.id === activeId;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setActiveId(t.id)}
                      className={`
                        relative px-3 h-8 text-[12px] font-medium tracking-tight
                        transition-colors duration-[--duration-fast]
                        cursor-pointer
                        ${isActive ? "text-text-primary" : "text-text-tertiary hover:text-text-secondary"}
                      `}
                    >
                      <span className="relative z-10">{t.label}</span>
                      {isActive && (
                        <motion.span
                          layoutId="evidence-tab-underline"
                          className="absolute inset-x-2 bottom-0 h-[2px] bg-accent"
                          transition={{ duration: 0.28, ease: easeStage }}
                        />
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="
                eyebrow text-text-tertiary hover:text-text-primary
                transition-colors cursor-pointer px-2 h-8 inline-flex items-center gap-2
              "
              aria-label="Close evidence drawer"
            >
              <span>Close</span>
              <span className="font-mono text-[13px]">↓</span>
            </button>
          </header>
          <div className="px-6 py-5 max-h-[42vh] overflow-y-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={active?.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.26, ease: easeStage }}
              >
                {active?.content}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}

interface EvidenceDrawerHandleProps {
  open: boolean;
  onClick: () => void;
  hint?: string;
}

export function EvidenceDrawerHandle({
  open,
  onClick,
  hint = "Show evidence",
}: EvidenceDrawerHandleProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="
        inline-flex items-center gap-2 eyebrow
        text-text-tertiary hover:text-text-primary transition-colors
        cursor-pointer
      "
    >
      <span
        aria-hidden
        className="block w-6 h-[2px] bg-current transition-transform"
        style={{ transform: open ? "rotate(180deg)" : "rotate(0)" }}
      />
      <span>{open ? "Hide evidence" : hint}</span>
    </button>
  );
}
