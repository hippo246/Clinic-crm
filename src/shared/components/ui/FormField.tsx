/**
 * Reusable form field component
 * Supports various input types with validation and accessibility
 */

import React from "react";
import type { BaseFormFieldProps, FormFieldType, FormFieldOption } from "../../types/form.types";

export function FormField({
  name,
  label,
  type = "text",
  value,
  onChange,
  onBlur,
  error,
  helperText,
  required = false,
  disabled = false,
  placeholder,
  options = [],
  rows = 3,
  min,
  max,
  step,
  autoComplete,
  disabledReason,
}: BaseFormFieldProps) {
  const fieldId = `field-${name}`;
  const errorId = error ? `${fieldId}-error` : undefined;
  const helperId = helperText ? `${fieldId}-helper` : undefined;
  const hasError = Boolean(error);
  const errorMessage = typeof error === "string" ? error : error?.message;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const target = e.target;
    
    if (type === "checkbox") {
      onChange?.((target as HTMLInputElement).checked);
    } else if (type === "number") {
      onChange?.(target.value === "" ? "" : Number(target.value));
    } else {
      onChange?.(target.value);
    }
  };

  const commonProps = {
    id: fieldId,
    name,
    disabled,
    onChange: handleChange,
    onBlur,
    "aria-invalid": hasError,
    "aria-describedby": [errorId, helperId].filter(Boolean).join(" ") || undefined,
    title: disabled && disabledReason ? disabledReason : undefined,
  };

  const renderInput = () => {
    switch (type) {
      case "select":
        return (
          <select
            {...commonProps}
            value={value ?? ""}
            className="form-select"
          >
            <option value="">Select...</option>
            {options.map((opt: FormFieldOption) => (
              <option key={String(opt.value)} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))}
          </select>
        );

      case "textarea":
        return (
          <textarea
            {...commonProps}
            value={value ?? ""}
            placeholder={placeholder}
            rows={rows}
            className="form-textarea"
          />
        );

      case "checkbox":
        return (
          <input
            {...commonProps}
            type="checkbox"
            checked={Boolean(value)}
            className="form-checkbox"
          />
        );

      default:
        return (
          <input
            {...commonProps}
            type={type === "phone" ? "tel" : type}
            value={value ?? ""}
            placeholder={placeholder}
            min={min}
            max={max}
            step={step}
            autoComplete={autoComplete}
            className="form-input"
          />
        );
    }
  };

  return (
    <div className="form-field" style={{ marginBottom: "16px" }}>
      {label && (
        <label
          htmlFor={fieldId}
          className="form-label"
          style={{
            display: "block",
            marginBottom: "6px",
            fontSize: "13px",
            fontWeight: 500,
            color: "var(--text)",
          }}
        >
          {label}
          {required && <span style={{ color: "var(--red)", marginLeft: "2px" }}>*</span>}
        </label>
      )}

      {renderInput()}

      {helperText && !hasError && (
        <p
          id={helperId}
          className="form-helper"
          style={{
            marginTop: "4px",
            fontSize: "12px",
            color: "var(--muted)",
          }}
        >
          {helperText}
        </p>
      )}

      {hasError && (
        <p
          id={errorId}
          className="form-error"
          role="alert"
          style={{
            marginTop: "4px",
            fontSize: "12px",
            color: "var(--red)",
          }}
        >
          {errorMessage}
        </p>
      )}
    </div>
  );
}
