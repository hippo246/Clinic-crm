import React, { useState, useCallback } from "react";

export interface ToastItem {
  id: string;
  message: string;
  type: "success" | "error" | "warning" | "info";
  duration?: number;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastItem["type"], duration?: number) => void;
}

export const ToastContext = React.createContext<ToastContextValue>({
  toast: () => {},
});

export function useToast() {
  return React.useContext(ToastContext);
}

const ICONS = {
  success: "ti-circle-check",
  error:   "ti-alert-circle",
  warning: "ti-alert-triangle",
  info:    "ti-info-circle",
};

const MAX_VISIBLE_TOASTS = 5;

const COLORS = {
  success: { bg: "var(--green-bg)",   border: "var(--green-border)",  color: "var(--green)"  },
  error:   { bg: "var(--red-bg)",     border: "var(--red-border)",    color: "var(--red)"    },
  warning: { bg: "var(--amber-bg)",   border: "var(--amber-border)",  color: "var(--amber)"  },
  info:    { bg: "var(--blue-bg)",    border: "var(--blue-border)",   color: "var(--blue)"   },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timeoutsRef = React.useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  // tracks { remaining, startedAt } per toast so a hover-pause can resume with the time left, not the full duration
  const timingRef = React.useRef<Map<string, { remaining: number; startedAt: number }>>(new Map());

  const clearToastTimer = (id: string) => {
    const handle = timeoutsRef.current.get(id);
    if (handle) {
      clearTimeout(handle);
      timeoutsRef.current.delete(id);
    }
  };

  const dismiss = useCallback((id: string) => {
    clearToastTimer(id);
    timingRef.current.delete(id);
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const scheduleAutoDismiss = useCallback((id: string, ms: number) => {
    if (ms <= 0) return; // <= 0 means "persist until dismissed"
    timingRef.current.set(id, { remaining: ms, startedAt: Date.now() });
    const handle = setTimeout(() => {
      timeoutsRef.current.delete(id);
      timingRef.current.delete(id);
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, ms);
    timeoutsRef.current.set(id, handle);
  }, []);

  const pause = useCallback((id: string) => {
    const timing = timingRef.current.get(id);
    if (!timing) return;
    clearToastTimer(id);
    const elapsed = Date.now() - timing.startedAt;
    timingRef.current.set(id, { remaining: Math.max(0, timing.remaining - elapsed), startedAt: timing.startedAt });
  }, []);

  const resume = useCallback((id: string) => {
    const timing = timingRef.current.get(id);
    if (!timing || timeoutsRef.current.has(id)) return;
    scheduleAutoDismiss(id, timing.remaining);
  }, [scheduleAutoDismiss]);

  const toast = useCallback((message: string, type: ToastItem["type"] = "success", duration = 3000) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => {
      const next = [...prev, { id, message, type, duration }];
      if (next.length > MAX_VISIBLE_TOASTS) {
        const dropped = next.slice(0, next.length - MAX_VISIBLE_TOASTS);
        dropped.forEach((d) => { clearToastTimer(d.id); timingRef.current.delete(d.id); });
        return next.slice(next.length - MAX_VISIBLE_TOASTS);
      }
      return next;
    });
    scheduleAutoDismiss(id, duration);
  }, [scheduleAutoDismiss]);

  React.useEffect(() => {
    return () => {
      timeoutsRef.current.forEach((handle) => clearTimeout(handle));
      timeoutsRef.current.clear();
      timingRef.current.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} onPause={pause} onResume={resume} />
    </ToastContext.Provider>
  );
}

function ToastContainer({ toasts, onDismiss, onPause, onResume }: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed", bottom: 24, right: 24, zIndex: 9999,
        display: "flex", flexDirection: "column", gap: 8,
        pointerEvents: "none",
      }}
    >
      <style>{`
        @keyframes toast-slide-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      {toasts.map((t) => {
        const c = COLORS[t.type];
        return (
          <div
            key={t.id}
            role={t.type === "error" ? "alert" : "status"}
            onMouseEnter={() => onPause(t.id)}
            onMouseLeave={() => onResume(t.id)}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "12px 16px", borderRadius: "var(--radius-lg)",
              background: c.bg, border: `1px solid ${c.border}`,
              boxShadow: "var(--shadow-lg)",
              minWidth: 280, maxWidth: 400,
              animation: "toast-slide-in 0.25s ease",
              pointerEvents: "all",
            }}
          >
            <i className={`ti ${ICONS[t.type]}`} style={{ fontSize: 17, color: c.color, flexShrink: 0 }} />
            <span style={{ fontSize: "var(--font-sm)", fontWeight: 500, color: "var(--text)", flex: 1 }}>
              {t.message}
            </span>
            <button
              onClick={() => onDismiss(t.id)}
              aria-label="Dismiss notification"
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: "var(--muted)", padding: 2, display: "flex", alignItems: "center",
              }}
            >
              <i className="ti ti-x" style={{ fontSize: 13 }} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
