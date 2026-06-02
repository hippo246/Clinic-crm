import { useState } from "react";

/**
 * Dynamic Form Builder - Drag and drop form builder for patient registration
 * Create custom registration forms per clinic needs
 */
export default function DynamicFormBuilder({ formConfig, onSave, onPreview }) {
  const [draggedItem, setDraggedItem] = useState(null);
  const [showFieldLibrary, setShowFieldLibrary] = useState(false);

  const availableFields = [
    { key: "firstName", label: "First Name", type: "text", required: true },
    { key: "lastName", label: "Last Name", type: "text", required: true },
    { key: "dob", label: "Date of Birth", type: "date", required: true },
    { key: "gender", label: "Gender", type: "select", options: ["Male", "Female", "Other"], required: true },
    { key: "phone", label: "Phone Number", type: "text", required: true },
    { key: "email", label: "Email", type: "text", required: false },
    { key: "address", label: "Address", type: "textarea", required: false },
    { key: "bloodGroup", label: "Blood Group", type: "select", options: ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"], required: false },
    { key: "emergencyName", label: "Emergency Contact Name", type: "text", required: true },
    { key: "emergencyPhone", label: "Emergency Contact Phone", type: "text", required: true },
    { key: "emergencyRelation", label: "Emergency Contact Relation", type: "select", options: ["Parent", "Spouse", "Sibling", "Guardian", "Other"], required: true },
    { key: "insuranceProvider", label: "Insurance Provider", type: "select", options: ["Star Health", "HDFC ERGO", "ICICI Lombard", "Bajaj Allianz", "None"], required: false },
    { key: "policyNumber", label: "Policy Number", type: "text", required: false },
    { key: "allergies", label: "Allergies", type: "textarea", required: false },
    { key: "consent", label: "Consent Form", type: "boolean", required: true },
  ];

  const handleDragStart = (e, field) => {
    setDraggedItem(field);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, targetIndex) => {
    e.preventDefault();
    if (!draggedItem) return;

    const newConfig = [...formConfig.fields];
    const draggedIndex = newConfig.findIndex(f => f.key === draggedItem.key);
    
    if (draggedIndex !== -1) {
      newConfig.splice(draggedIndex, 1);
      newConfig.splice(targetIndex, 0, draggedItem);
    } else {
      newConfig.splice(targetIndex, 0, { ...draggedItem, id: `field-${Date.now()}` });
    }

    onSave({ ...formConfig, fields: newConfig });
    setDraggedItem(null);
  };

  const handleRemoveField = (fieldKey) => {
    const newConfig = {
      ...formConfig,
      fields: formConfig.fields.filter(f => f.key !== fieldKey),
    };
    onSave(newConfig);
  };

  const handleToggleRequired = (fieldKey) => {
    const newConfig = {
      ...formConfig,
      fields: formConfig.fields.map(f =>
        f.key === fieldKey ? { ...f, required: !f.required } : f
      ),
    };
    onSave(newConfig);
  };

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 16,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <i className="ti ti-forms" style={{ fontSize: 14, color: "var(--accent)" }} />
          <span style={{
            fontSize: 12, fontWeight: 700, color: "var(--text)",
            textTransform: "uppercase", letterSpacing: "0.06em",
          }}>
            Form Builder
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setShowFieldLibrary(!showFieldLibrary)}
            style={{
              padding: "6px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600,
              background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
            }}
          >
            <i className="ti ti-apps" style={{ fontSize: 12 }} />
            Add Fields
          </button>
          <button
            onClick={onPreview}
            style={{
              padding: "6px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600,
              background: "var(--accent)", border: "none", color: "#fff", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            <i className="ti ti-eye" style={{ fontSize: 12 }} />
            Preview
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 16 }}>
        {/* Form Canvas */}
        <div style={{ flex: 1 }}>
          <div style={{
            padding: 16, borderRadius: 8,
            background: "var(--surface)", border: "2px dashed var(--border)",
            minHeight: 400,
          }}>
            {formConfig.fields.length === 0 ? (
              <div style={{
                textAlign: "center", padding: 40,
                color: "var(--muted)",
              }}>
                <i className="ti ti-forms" style={{ fontSize: 32, marginBottom: 12 }} />
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  Drag fields here to build your form
                </div>
                <div style={{ fontSize: 11 }}>
                  Click "Add Fields" to see available options
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {formConfig.fields.map((field, index) => (
                  <FormField
                    key={field.key}
                    field={field}
                    index={index}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onRemove={handleRemoveField}
                    onToggleRequired={handleToggleRequired}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Field Library */}
        {showFieldLibrary && (
          <div style={{
            width: 280,
            padding: 16, borderRadius: 8,
            background: "var(--surface2)", border: "1px solid var(--border)",
          }}>
            <div style={{
              fontSize: 12, fontWeight: 700, color: "var(--text)",
              marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.06em",
            }}>
              Available Fields
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {availableFields.map(field => (
                <FieldLibraryItem
                  key={field.key}
                  field={field}
                  onDragStart={handleDragStart}
                  onAdd={() => {
                    const newConfig = {
                      ...formConfig,
                      fields: [...formConfig.fields, { ...field, id: `field-${Date.now()}` }],
                    };
                    onSave(newConfig);
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FormField({ field, index, onDragStart, onDragOver, onDrop, onRemove, onToggleRequired }) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, field)}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, index)}
      style={{
        padding: 12, borderRadius: 8,
        background: "var(--surface2)", border: "1px solid var(--border)",
        cursor: "move",
        display: "flex", alignItems: "center", gap: 12,
      }}
    >
      <i className="ti ti-grip-vertical" style={{ fontSize: 16, color: "var(--muted)" }} />
      
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
          {field.label}
        </div>
        <div style={{ fontSize: 11, color: "var(--muted)" }}>
          {field.type} · {field.key}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          onClick={() => onToggleRequired(field.key)}
          style={{
            padding: "4px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600,
            background: field.required ? "#dcfce7" : "var(--surface)",
            border: field.required ? "1px solid #22c55e" : "1px solid var(--border)",
            color: field.required ? "#15803d" : "var(--muted)",
            cursor: "pointer",
          }}
        >
          {field.required ? "Required" : "Optional"}
        </button>
        <button
          onClick={() => onRemove(field.key)}
          style={{
            padding: "4px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600,
            background: "transparent", border: "1px solid #fecaca", color: "#dc2626",
            cursor: "pointer",
          }}
        >
          <i className="ti ti-trash" style={{ fontSize: 11 }} />
        </button>
      </div>
    </div>
  );
}

function FieldLibraryItem({ field, onDragStart, onAdd }) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, field)}
      onClick={onAdd}
      style={{
        padding: 10, borderRadius: 6,
        background: "var(--surface)", border: "1px solid var(--border)",
        cursor: "pointer",
        display: "flex", alignItems: "center", gap: 10,
        transition: "all 0.15s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--accent-soft)";
        e.currentTarget.style.borderColor = "var(--accent)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "var(--surface)";
        e.currentTarget.style.borderColor = "var(--border)";
      }}
    >
      <i className="ti ti-drag-drop" style={{ fontSize: 14, color: "var(--muted)" }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>
          {field.label}
        </div>
        <div style={{ fontSize: 10, color: "var(--muted)" }}>
          {field.type}
        </div>
      </div>
      {field.required && (
        <span style={{
          padding: "2px 6px", borderRadius: 4,
          fontSize: 9, fontWeight: 600,
          background: "#dcfce7", color: "#15803d",
        }}>
          Required
        </span>
      )}
    </div>
  );
}
