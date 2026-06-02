import { useState } from "react";

/**
 * Custom Field Builder - Allow clinics to create custom patient fields
 * Every clinic wants something weird - National Health ID, Passport, Employee Number, etc.
 */
export default function CustomFieldBuilder({ customFields, onAddField, onEditField, onDeleteField }) {
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingField, setEditingField] = useState(null);

  const handleSaveField = (field) => {
    if (editingField) {
      onEditField(field);
    } else {
      onAddField(field);
    }
    setEditingField(null);
    setShowBuilder(false);
  };

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 16,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <i className="ti ti-layout-grid-add" style={{ fontSize: 14, color: "var(--accent)" }} />
          <span style={{
            fontSize: 12, fontWeight: 700, color: "var(--text)",
            textTransform: "uppercase", letterSpacing: "0.06em",
          }}>
            Custom Fields
          </span>
        </div>
        <button
          onClick={() => { setEditingField(null); setShowBuilder(true); }}
          style={{
            padding: "6px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600,
            background: "var(--accent)", border: "none", color: "#fff", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6,
          }}
        >
          <i className="ti ti-plus" style={{ fontSize: 12 }} />
          Add Field
        </button>
      </div>

      {/* Field List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {customFields.map(field => (
          <FieldCard
            key={field.id}
            field={field}
            onEdit={() => { setEditingField(field); setShowBuilder(true); }}
            onDelete={() => onDeleteField(field.id)}
          />
        ))}
        {customFields.length === 0 && (
          <div style={{
            padding: 24, borderRadius: 8,
            background: "var(--surface2)", border: "1px dashed var(--border)",
            textAlign: "center",
          }}>
            <i className="ti ti-layout-grid-off" style={{ fontSize: 24, color: "var(--muted)" }} />
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
              No custom fields yet
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>
              Add fields to capture clinic-specific data
            </div>
          </div>
        )}
      </div>

      {showBuilder && (
        <FieldBuilderModal
          field={editingField}
          onSave={handleSaveField}
          onClose={() => { setShowBuilder(false); setEditingField(null); }}
        />
      )}
    </div>
  );
}

function FieldCard({ field, onEdit, onDelete }) {
  const typeIcons = {
    text: "ti-text",
    number: "ti-calculator",
    date: "ti-calendar",
    select: "ti-selector",
    multiselect: "ti-checkbox",
    boolean: "ti-toggle-left",
    textarea: "ti-file-text",
  };

  const typeColors = {
    text: "#4f7cff",
    number: "#f59e0b",
    date: "#22c55e",
    select: "#7c4fff",
    multiselect: "#ec4899",
    boolean: "#64748b",
    textarea: "#00b4a0",
  };

  return (
    <div style={{
      padding: 12, borderRadius: 8,
      background: "var(--surface)", border: "1px solid var(--border)",
      display: "flex", alignItems: "center", gap: 12,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 8,
        background: typeColors[field.type] + "20",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <i className={`ti ${typeIcons[field.type]}`} style={{ fontSize: 16, color: typeColors[field.type] }} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
          {field.label}
        </div>
        <div style={{ fontSize: 11, color: "var(--muted)" }}>
          {field.key} · {field.type} · {field.required ? "Required" : "Optional"}
        </div>
      </div>

      <div style={{ display: "flex", gap: 6 }}>
        <button
          onClick={onEdit}
          style={{
            padding: "6px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
            background: "transparent", border: "1px solid var(--border)", color: "var(--text)",
            cursor: "pointer",
          }}
        >
          <i className="ti ti-pencil" style={{ fontSize: 12 }} />
        </button>
        <button
          onClick={onDelete}
          style={{
            padding: "6px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
            background: "transparent", border: "1px solid #fecaca", color: "#dc2626",
            cursor: "pointer",
          }}
        >
          <i className="ti ti-trash" style={{ fontSize: 12 }} />
        </button>
      </div>
    </div>
  );
}

function FieldBuilderModal({ field, onSave, onClose }) {
  const [formData, setFormData] = useState(field || {
    key: "",
    label: "",
    type: "text",
    required: false,
    options: [],
    placeholder: "",
    defaultValue: "",
    description: "",
  });

  const fieldTypes = [
    { value: "text", label: "Text", icon: "ti-text" },
    { value: "number", label: "Number", icon: "ti-calculator" },
    { value: "date", label: "Date", icon: "ti-calendar" },
    { value: "select", label: "Dropdown", icon: "ti-selector" },
    { value: "multiselect", label: "Multi-select", icon: "ti-checkbox" },
    { value: "boolean", label: "Yes/No", icon: "ti-toggle-left" },
    { value: "textarea", label: "Long Text", icon: "ti-file-text" },
  ];

  const handleSave = () => {
    if (!formData.key.trim() || !formData.label.trim()) return;
    onSave({
      ...formData,
      id: field?.id || `field-${Date.now()}`,
      key: formData.key.trim().toLowerCase().replace(/\s+/g, "_"),
      createdAt: field?.createdAt || new Date().toISOString(),
    });
  };

  const isSelectType = ["select", "multiselect"].includes(formData.type);

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 10000,
    }}>
      <div style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 24,
        width: 500,
        maxWidth: "90vw",
        maxHeight: "90vh",
        overflowY: "auto",
      }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", marginBottom: 20 }}>
          {field ? "Edit Custom Field" : "Add Custom Field"}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Field Label */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 8, display: "block" }}>
              Field Label *
            </label>
            <input
              type="text"
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              placeholder="e.g., National Health ID"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                fontSize: 13,
                background: "var(--surface2)",
                color: "var(--text)",
              }}
            />
          </div>

          {/* Field Key */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 8, display: "block" }}>
              Field Key *
            </label>
            <input
              type="text"
              value={formData.key}
              onChange={(e) => setFormData({ ...formData, key: e.target.value })}
              placeholder="e.g., national_health_id"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                fontSize: 13,
                background: "var(--surface2)",
                color: "var(--text)",
              }}
            />
            <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
              Auto-generated from label, used in database
            </div>
          </div>

          {/* Field Type */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 8, display: "block" }}>
              Field Type
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {fieldTypes.map(type => (
                <button
                  key={type.value}
                  onClick={() => setFormData({ ...formData, type: type.value })}
                  style={{
                    padding: 10, borderRadius: 8,
                    background: formData.type === type.value ? "var(--accent-soft)" : "var(--surface2)",
                    border: formData.type === type.value ? "1px solid var(--accent)" : "1px solid var(--border)",
                    cursor: "pointer",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                  }}
                >
                  <i className={`ti ${type.icon}`} style={{ fontSize: 18, color: formData.type === type.value ? "var(--accent)" : "var(--muted)" }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: formData.type === type.value ? "var(--accent)" : "var(--text)" }}>
                    {type.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Options for select/multiselect */}
          {isSelectType && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 8, display: "block" }}>
                Options (comma-separated)
              </label>
              <textarea
                value={formData.options.join(", ")}
                onChange={(e) => setFormData({ ...formData, options: e.target.value.split(",").map(o => o.trim()).filter(o => o) })}
                placeholder="e.g., Option 1, Option 2, Option 3"
                rows={3}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  fontSize: 13,
                  background: "var(--surface2)",
                  color: "var(--text)",
                  resize: "vertical",
                }}
              />
            </div>
          )}

          {/* Required Toggle */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <input
              type="checkbox"
              checked={formData.required}
              onChange={(e) => setFormData({ ...formData, required: e.target.checked })}
              style={{ width: 18, height: 18 }}
            />
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>
              Required field
            </label>
          </div>

          {/* Placeholder */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text"), marginBottom: 8, display: "block" }}>
              Placeholder
            </label>
            <input
              type="text"
              value={formData.placeholder}
              onChange={(e) => setFormData({ ...formData, placeholder: e.target.value })}
              placeholder="e.g., Enter ID number"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                fontSize: 13,
                background: "var(--surface2)",
                color: "var(--text)",
              }}
            />
          </div>

          {/* Description */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 8, display: "block" }}>
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional description for staff"
              rows={2}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                fontSize: 13,
                background: "var(--surface2)",
                color: "var(--text)",
                resize: "vertical",
              }}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 24 }}>
          <button
            onClick={onClose}
            style={{
              padding: "8px 16px", borderRadius: 6, fontSize: 12, fontWeight: 600,
              background: "transparent", border: "1px solid var(--border)", color: "var(--text)",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!formData.key.trim() || !formData.label.trim()}
            style={{
              padding: "8px 16px", borderRadius: 6, fontSize: 12, fontWeight: 600,
              background: "var(--accent)", border: "none", color: "#fff",
              cursor: (formData.key.trim() && formData.label.trim()) ? "pointer" : "not-allowed",
              opacity: (formData.key.trim() && formData.label.trim()) ? 1 : 0.5,
            }}
          >
            Save Field
          </button>
        </div>
      </div>
    </div>
  );
}
