/**
 * Reusable Button primitive
 * Supports variants, sizes, loading state, and accessibility
 */

import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  disabledReason?: string;
  children: React.ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabledReason,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const baseStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    fontWeight: 500,
    borderRadius: "6px",
    border: "none",
    cursor: isDisabled ? "not-allowed" : "pointer",
    transition: "background 0.15s, opacity 0.15s",
    opacity: isDisabled ? 0.6 : 1,
  };

  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      background: "var(--accent)",
      color: "#fff",
    },
    secondary: {
      background: "var(--surface2)",
      color: "var(--text)",
      border: "1px solid var(--border)",
    },
    danger: {
      background: "var(--red)",
      color: "#fff",
    },
    ghost: {
      background: "transparent",
      color: "var(--text)",
    },
  };

  const sizeStyles: Record<string, React.CSSProperties> = {
    sm: {
      padding: "6px 12px",
      fontSize: "12px",
    },
    md: {
      padding: "8px 16px",
      fontSize: "13px",
    },
    lg: {
      padding: "10px 20px",
      fontSize: "14px",
    },
  };

  return (
    <button
      {...props}
      disabled={isDisabled}
      title={disabledReason || (isDisabled && loading ? "Loading..." : undefined)}
      style={{
        ...baseStyle,
        ...variantStyles[variant],
        ...sizeStyles[size],
      }}
    >
      {loading && (
        <span
          style={{
            display: "inline-block",
            width: "12px",
            height: "12px",
            border: "2px solid rgba(255, 255, 255, 0.3)",
            borderTopColor: "currentColor",
            borderRadius: "50%",
            animation: "spin 0.6s linear infinite",
          }}
        />
      )}
      {loading ? "Loading..." : children}
    </button>
  );
}
