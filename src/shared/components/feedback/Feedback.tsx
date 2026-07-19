import React, { useEffect, useState } from "react";

interface FeedbackProps {
  message: string;
  type?: "success" | "error" | "info" | "warning";
  onClose?: () => void;
  duration?: number;
}

const typeStyles: Record<FeedbackProps["type"], { bg: string; border: string; color: string; icon: string }> = {
  success: { bg: "#dcfce7", border: "#22c55e", color: "#166534", icon: "✓" },
  error: { bg: "#fee2e2", border: "#ef4444", color: "#991b1b", icon: "✕" },
  info: { bg: "#dbeafe", border: "#3b82f6", color: "#1e40af", icon: "ℹ" },
  warning: { bg: "#fef3c7", border: "#f59e0b", color: "#92400e", icon: "⚠" },
};

export function Feedback({ message, type = "info", onClose, duration = 4000 }: FeedbackProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        setVisible(false);
        onClose?.();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  if (!visible) return null;

  const handleClose = () => {
    setVisible(false);
    onClose?.();
  };

  const styles = typeStyles[type];

  return (
    <div
      style={{
        backgroundColor: styles.bg,
        border: `1px solid ${styles.border}`,
        borderRadius: "var(--radius)",
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        minWidth: "300px",
        maxWidth: "500px",
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
      }}
    >
      <span
        style={{
          fontSize: "18px",
          fontWeight: "bold",
          color: styles.color,
          minWidth: "20px",
          textAlign: "center",
        }}
      >
        {styles.icon}
      </span>
      <span style={{ flex: 1, color: styles.color, fontSize: "var(--font-sm)" }}>{message}</span>
      {onClose && (
        <button
          onClick={handleClose}
          aria-label="Close"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: "16px",
            color: styles.color,
            padding: "4px",
            lineHeight: 1,
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}
