"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type ToastVariant = "success" | "danger" | "warning" | "info";

interface ToastInput {
  id?: string;
  variant?: ToastVariant;
  /** Short, mono-cased title (e.g. "Intent committed"). */
  title: string;
  /** Optional longer body. Monospace small. */
  description?: string;
  /** Optional link action shown on the right. */
  action?: { label: string; href?: string; onClick?: () => void };
  /** Millis before auto-dismiss. 0 = sticky. Default 4500. */
  duration?: number;
}

interface Toast extends Required<Pick<ToastInput, "title">> {
  id: string;
  variant: ToastVariant;
  description?: string;
  action?: ToastInput["action"];
  duration: number;
}

interface ToastContextValue {
  toast: (t: ToastInput) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      toast: () => "",
      dismiss: () => {},
    };
  }
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id = input.id ?? `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const next: Toast = {
        id,
        variant: input.variant ?? "info",
        title: input.title,
        description: input.description,
        action: input.action,
        duration: input.duration ?? 4500,
      };
      setToasts((prev) => [...prev.filter((t) => t.id !== id), next].slice(-4));
      if (next.duration > 0) {
        const timer = setTimeout(() => dismiss(id), next.duration);
        timers.current.set(id, timer);
      }
      return id;
    },
    [dismiss]
  );

  useEffect(() => {
    const current = timers.current;
    return () => {
      current.forEach((t) => clearTimeout(t));
      current.clear();
    };
  }, []);

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-5 right-5 z-50 flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

const toneByVariant: Record<ToastVariant, { bar: string; glyph: string; glyphTone: string }> = {
  success: { bar: "bg-success", glyph: "●", glyphTone: "text-success" },
  danger: { bar: "bg-danger", glyph: "✕", glyphTone: "text-danger" },
  warning: { bar: "bg-warning", glyph: "△", glyphTone: "text-warning" },
  info: { bar: "bg-info", glyph: "◆", glyphTone: "text-info" },
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const tone = toneByVariant[toast.variant];
  return (
    <div
      role="status"
      className="toast-enter pointer-events-auto relative flex items-start gap-3 overflow-hidden bg-bg-raised border border-rule-strong pl-3 pr-3 py-3 shadow-[0_12px_30px_-12px_oklch(0_0_0_/_0.65)]"
      style={{ borderRadius: "var(--radius-sm)" }}
    >
      <span aria-hidden className={`absolute inset-y-0 left-0 w-px ${tone.bar}`} />
      <span aria-hidden className={`mt-[2px] text-[12px] leading-none ${tone.glyphTone}`}>
        {tone.glyph}
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-mono text-[12px] tnum text-text-primary tracking-wide leading-tight">
          {toast.title}
        </div>
        {toast.description && (
          <div className="mt-1 text-[11.5px] text-text-tertiary leading-snug break-words">
            {toast.description}
          </div>
        )}
        {toast.action && (
          <div className="mt-2">
            {toast.action.href ? (
              <a
                href={toast.action.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-mono tracking-wider uppercase text-accent hover:text-accent-bright underline-offset-4 hover:underline"
              >
                {toast.action.label} ↗
              </a>
            ) : (
              <button
                type="button"
                onClick={() => toast.action?.onClick?.()}
                className="text-[11px] font-mono tracking-wider uppercase text-accent hover:text-accent-bright underline-offset-4 hover:underline"
              >
                {toast.action.label}
              </button>
            )}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss"
        className="shrink-0 text-text-quat hover:text-text-primary text-[12px] leading-none mt-0.5"
      >
        ×
      </button>
    </div>
  );
}
