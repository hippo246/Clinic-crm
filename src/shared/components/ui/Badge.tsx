/**
 * Reusable Badge primitive
 * Displays status or category information with color coding
 */

import React from "react";

interface BadgeProps {
  tone?: "default" | "success" | "warning" | "danger" | "info";
  children: React.ReactNode;
}

export function Badge({ tone = "default", children }: BadgeProps) {
  const toneStyles: Record<string, React.CSSProperties> = {
    default: {
      background: "var(--surface2)",
      color: "var(--text)",
      border: "1px solid var(--border)",
    },
    success: {
      background: "rgba(34, 197, 94, 0.1)",
      color: "var(--green)",
      border: "1px solid rgba(34, 197, 94, 0.2)",
    },
    warning: {
      background: "rgba(217, 119, 6, 0.1)",
      color: "var(--amber)",
      border: "1px solid rgba(217, 119, 6, 0.2)",
    },
    danger: {
      background: "rgba(239, 68, 68, 0.1)",
      color: "var(--red)",
      border: "1px solid rgba(239, 68, 68, 0.2)",
    },
    info: {
      background: "rgba(59, 130, 246, 0.1)",
      color: "var(--accent)",
      border: "1px solid rgba(59, 130, 246, 0.2)",
    },
  };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        fontSize: "11px",
        fontWeight: 600,
        borderRadius: "9999px",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        ...toneStyles[tone],
      }}
    >
      {children}
    </span>
  );
}
