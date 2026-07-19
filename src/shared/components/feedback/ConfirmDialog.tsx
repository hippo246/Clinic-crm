import React from "react";
import { Modal } from "../ui/Modal";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  danger = false,
}: ConfirmDialogProps) {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const footer = (
    <>
      <button
        onClick={onClose}
        style={{
          padding: "8px 16px",
          borderRadius: "var(--radius)",
          border: "1px solid var(--border)",
          backgroundColor: "var(--surface)",
          color: "var(--fg)",
          cursor: "pointer",
          fontSize: "var(--font-sm)",
        }}
      >
        {cancelText}
      </button>
      <button
        onClick={handleConfirm}
        style={{
          padding: "8px 16px",
          borderRadius: "var(--radius)",
          border: "none",
          backgroundColor: danger ? "var(--red)" : "var(--accent)",
          color: "white",
          cursor: "pointer",
          fontSize: "var(--font-sm)",
          fontWeight: 500,
        }}
      >
        {confirmText}
      </button>
    </>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} footer={footer} size="sm">
      <p style={{ margin: 0, color: "var(--fg)", fontSize: "var(--font-sm)", lineHeight: 1.5 }}>
        {message}
      </p>
    </Modal>
  );
}
