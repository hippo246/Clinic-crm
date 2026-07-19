/**
 * Reusable form wrapper component
 * Handles form submission, loading state, and error/success display
 */

import React from "react";

interface FormProps {
  children: React.ReactNode;
  onSubmit?: (e: React.FormEvent) => void | Promise<void>;
  title?: string;
  description?: string;
  error?: string | null;
  success?: string | null;
  submitting?: boolean;
  submitText?: string;
  cancelText?: string;
  onCancel?: () => void;
  footer?: React.ReactNode;
}

export function Form({
  children,
  onSubmit,
  title,
  description,
  error,
  success,
  submitting = false,
  submitText = "Submit",
  cancelText = "Cancel",
  onCancel,
  footer,
}: FormProps) {
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (onSubmit) {
      await onSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ width: "100%" }}>
      {title && (
        <div style={{ marginBottom: "16px" }}>
          <h2
            style={{
              fontSize: "18px",
              fontWeight: 600,
              color: "var(--text)",
              margin: 0,
              marginBottom: description ? "6px" : 0,
            }}
          >
            {title}
          </h2>
          {description && (
            <p
              style={{
                fontSize: "13px",
                color: "var(--muted)",
                margin: 0,
              }}
            >
              {description}
            </p>
          )}
        </div>
      )}

      {error && (
        <div
          role="alert"
          style={{
            padding: "10px 14px",
            marginBottom: "16px",
            borderRadius: "6px",
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.2)",
            color: "var(--red)",
            fontSize: "13px",
          }}
        >
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          style={{
            padding: "10px 14px",
            marginBottom: "16px",
            borderRadius: "6px",
            background: "rgba(34, 197, 94, 0.1)",
            border: "1px solid rgba(34, 197, 94, 0.2)",
            color: "var(--green)",
            fontSize: "13px",
          }}
        >
          {success}
        </div>
      )}

      {children}

      {footer !== undefined ? (
        footer
      ) : (
        <div
          style={{
            display: "flex",
            gap: "8px",
            justifyContent: "flex-end",
            marginTop: "20px",
            paddingTop: "16px",
            borderTop: "1px solid var(--border)",
          }}
        >
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              style={{
                padding: "8px 16px",
                fontSize: "13px",
                fontWeight: 500,
                borderRadius: "6px",
                border: "1px solid var(--border)",
                background: "var(--surface2)",
                color: "var(--text)",
                cursor: submitting ? "not-allowed" : "pointer",
              }}
            >
              {cancelText}
            </button>
          )}
          <button
            type="submit"
            disabled={submitting}
            style={{
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 500,
              borderRadius: "6px",
              border: "none",
              background: submitting ? "var(--muted)" : "var(--accent)",
              color: "#fff",
              cursor: submitting ? "not-allowed" : "pointer",
            }}
          >
            {submitting ? "Submitting..." : submitText}
          </button>
        </div>
      )}
    </form>
  );
}
