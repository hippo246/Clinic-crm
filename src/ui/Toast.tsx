import React, { useState, useEffect, useCallback, useRef } from "react";

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

const COLORS = {
  success: { bg: "var(--green-bg)",   border: "var(--green-border)",  color: "var(--green)"  },
  error:   { bg: "var(--red-bg)",     border: "var(--red-border)",    color: "var(--red)"    },
  warning: { bg: "var(--amber-bg)",   border: "var(--amber-border)",  color: "var(--amber)"  },
  info:    { bg: "var(--blue-bg)",    border: "var(--blue-border)",   color: "var(--blue)"   },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string, type: ToastItem["type"] = "success", duration = 3000) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, message, type, duration }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts((p) => p.filter((t) => t.id !== id))} />
    </ToastContext.Provider>
  );
}

function ToastContainer({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 9999,
      display: "flex", flexDirection: "column", gap: 8,
      pointerEvents: "none",
    }}>
      {toasts.map((t) => {
        const c = COLORS[t.type];
        return (
          <div key={t.id} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "12px 16px", borderRadius: "var(--radius-lg)",
            background: c.bg, border: `1px solid ${c.border}`,
            boxShadow: "var(--shadow-lg)",
            minWidth: 280, maxWidth: 400,
            animation: "slideIn 0.25s ease",
            pointerEvents: "all",
          }}>
            <i className={`ti ${ICONS[t.type]}`} style={{ fontSize: 17, color: c.color, flexShrink: 0 }} />
            <span style={{ fontSize: "var(--font-sm)", fontWeight: 500, color: "var(--text)", flex: 1 }}>
              {t.message}
            </span>
            <button onClick={() => onDismiss(t.id)} style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--muted)", padding: 2, display: "flex", alignItems: "center",
            }}>
              <i className="ti ti-x" style={{ fontSize: 13 }} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
