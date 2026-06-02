import { useState } from "react";

/**
 * Conditional Fields - Show/hide fields based on other field values
 * Example: Insurance = Yes → Show Insurance Section
 */
export default function ConditionalFields({ conditions, onAddCondition, onRemoveCondition, onUpdateCondition }) {
  const [showAddModal, setShowAddModal] = useState(false);

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 16,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <i className="ti ti-git-branch" style={{ fontSize: 14, color: "var(--accent)" }} />
          <span style={{
            fontSize: 12, fontWeight: 700, color: "var(--text)",
            textTransform: "uppercase", letterSpacing: "0.06em",
          }}>
            Conditional Fields
          </span>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            padding: "6px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600,
            background: "var(--accent)", border: "none", color: "#fff", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6,
          }}
        >
          <i className="ti ti-plus" style={{ fontSize: 12 }} />
          Add Condition
        </button>
      </div>

      {/* Conditions List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {conditions.map(condition => (
          <ConditionCard
            key={condition.id}
            condition={condition}
            onRemove={() => onRemoveCondition(condition.id)}
            onUpdate={(updates) => onUpdateCondition(condition.id, updates)}
          />
        ))}
        {conditions.length === 0 && (
          <div style={{
            padding: 24, borderRadius: 8,
            background: "var(--surface2)", border: "1px dashed var(--border)",
            textAlign: "center",
          }}>
            <i className="ti ti-git-branch" style={{ fontSize: 24, color: "var(--muted)" }} />
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
              No conditional rules yet
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>
              Add rules to show/hide fields dynamically
            </div>
          </div>
        )}
      </div>

      {showAddModal && (
        <AddConditionModal
          onAdd={(condition) => {
            onAddCondition(condition);
            setShowAddModal(false);
          }}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}

function ConditionCard({ condition, onRemove, onUpdate }) {
  const operators = {
    equals: { label: "Equals", icon: "ti-equals" },
    not_equals: { label: "Not Equals", icon: "ti-not-equals" },
    contains: { label: "Contains", icon: "ti-search" },
    not_contains: { label: "Does Not Contain", icon: "ti-x" },
    greater_than: { label: "Greater Than", icon: "ti-arrow-up" },
    less_than: { label: "Less Than", icon: "ti-arrow-down" },
  };

  return (
    <div style={{
      padding: 14, borderRadius: 8,
      background: "var(--surface)", border: "1px solid var(--border)",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{
          width: 32, height: 32, borderRadius: "50%",
          background: "#dbeafe", display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <i className="ti ti-git-branch" style={{ fontSize: 14, color: "#3b82f6" }} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>
            IF {condition.triggerField} {operators[condition.operator]?.label || condition.operator} "{condition.triggerValue}"
          </div>

          <div style={{
            padding: 10, borderRadius: 6,
            background: "#dcfce7", border: "1px solid #22c55e30",
            marginBottom: 8,
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#15803d", marginBottom: 4 }}>
              THEN
            </div>
            <div style={{ fontSize: 12, color: "#166534" }}>
              {condition.action === "show" ? "Show" : "Hide"} field: <strong>{condition.targetField}</strong>
            </div>
          </div>

          <div style={{ fontSize: 11, color: "var(--muted)" }}>
            Applied to: {condition.appliesTo === "registration" ? "Registration Form" : condition.appliesTo === "profile" ? "Patient Profile" : "All Forms"}
          </div>
        </div>

        <button
          onClick={onRemove}
          style={{
            padding: "6px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
            background: "transparent", border: "1px solid #fecaca", color: "#dc2626",
            cursor: "pointer", flexShrink: 0,
          }}
        >
          <i className="ti ti-trash" style={{ fontSize: 12 }} />
        </button>
      </div>
    </div>
  );
}

function AddConditionModal({ onAdd, onClose }) {
  const [condition, setCondition] = useState({
    triggerField: "insuranceProvider",
    operator: "equals",
    triggerValue: "None",
    action: "hide",
    targetField: "policyNumber",
    appliesTo: "registration",
  });

  const availableFields = [
    { key: "insuranceProvider", label: "Insurance Provider" },
    { key: "gender", label: "Gender" },
    { key: "age", label: "Age" },
    { key: "status", label: "Patient Status" },
    { key: "consentSigned", label: "Consent Signed" },
  ];

  const targetFields = [
    { key: "policyNumber", label: "Policy Number" },
    { key: "insuranceExpiry", label: "Insurance Expiry" },
    { key: "emergencyName", label: "Emergency Contact Name" },
    { key: "emergencyPhone", label: "Emergency Contact Phone" },
    { key: "allergies", label: "Allergies" },
    { key: "medications", label: "Medications" },
  ];

  const operators = [
    { key: "equals", label: "Equals" },
    { key: "not_equals", label: "Not Equals" },
    { key: "contains", label: "Contains" },
    { key: "not_contains", label: "Does Not Contain" },
  ];

  const handleAdd = () => {
    onAdd({
      ...condition,
      id: `condition-${Date.now()}`,
      createdAt: new Date().toISOString(),
    });
  };

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
        width: 450,
        maxWidth: "90vw",
      }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", marginBottom: 20 }}>
          Add Conditional Rule
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Trigger Field */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 8, display: "block" }}>
              Trigger Field
            </label>
            <select
              value={condition.triggerField}
              onChange={(e) => setCondition({ ...condition, triggerField: e.target.value })}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                fontSize: 13,
                background: "var(--surface2)",
                color: "var(--text)",
              }}
            >
              {availableFields.map(field => (
                <option key={field.key} value={field.key}>{field.label}</option>
              ))}
            </select>
          </div>

          {/* Operator */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text"), marginBottom: 8, display: "block" }}>
              Operator
            </label>
            <select
              value={condition.operator}
              onChange={(e) => setCondition({ ...condition, operator: e.target.value })}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                fontSize: 13,
                background: "var(--surface2)",
                color: "var(--text)",
              }}
            >
              {operators.map(op => (
                <option key={op.key} value={op.key}>{op.label}</option>
              ))}
            </select>
          </div>

          {/* Trigger Value */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text"), marginBottom: 8, display: "block" }}>
              Trigger Value
            </label>
            <input
              type="text"
              value={condition.triggerValue}
              onChange={(e) => setCondition({ ...condition, triggerValue: e.target.value })}
              placeholder="e.g., None, Male, Active"
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

          {/* Action */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 8, display: "block" }}>
              Action
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => setCondition({ ...condition, action: "show" })}
                style={{
                  flex: 1,
                  padding: 10, borderRadius: 8,
                  background: condition.action === "show" ? "#dcfce7" : "var(--surface2)",
                  border: condition.action === "show" ? "1px solid #22c55e" : "1px solid var(--border)",
                  fontSize: 12, fontWeight: 600,
                  color: condition.action === "show" ? "#15803d" : "var(--text)",
                  cursor: "pointer",
                }}
              >
                Show Field
              </button>
              <button
                type="button"
                onClick={() => setCondition({ ...condition, action: "hide" })}
                style={{
                  flex: 1,
                  padding: 10, borderRadius: 8,
                  background: condition.action === "hide" ? "#fee2e2" : "var(--surface2)",
                  border: condition.action === "hide" ? "1px solid #ef4444" : "1px solid var(--border)",
                  fontSize: 12, fontWeight: 600,
                  color: condition.action === "hide" ? "#dc2626" : "var(--text)",
                  cursor: "pointer",
                }}
              >
                Hide Field
              </button>
            </div>
          </div>

          {/* Target Field */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text"), marginBottom: 8, display: "block" }}>
              Target Field
            </label>
            <select
              value={condition.targetField}
              onChange={(e) => setCondition({ ...condition, targetField: e.target.value })}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                fontSize: 13,
                background: "var(--surface2)",
                color: "var(--text)",
              }}
            >
              {targetFields.map(field => (
                <option key={field.key} value={field.key}>{field.label}</option>
              ))}
            </select>
          </div>

          {/* Applies To */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text"), marginBottom: 8, display: "block" }}>
              Applies To
            </label>
            <select
              value={condition.appliesTo}
              onChange={(e) => setCondition({ ...condition, appliesTo: e.target.value })}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                fontSize: 13,
                background: "var(--surface2)",
                color: "var(--text)",
              }}
            >
              <option value="registration">Registration Form</option>
              <option value="profile">Patient Profile</option>
              <option value="all">All Forms</option>
            </select>
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
            onClick={handleAdd}
            style={{
              padding: "8px 16px", borderRadius: 6, fontSize: 12, fontWeight: 600,
              background: "var(--accent)", border: "none", color: "#fff", cursor: "pointer",
            }}
          >
            Add Rule
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Evaluate conditional rules to determine which fields should be visible
 */
export function evaluateConditionalFields(conditions, formData, context = "registration") {
  const visibleFields = new Set();
  const hiddenFields = new Set();

  conditions.forEach(condition => {
    // Check if condition applies to current context
    if (condition.appliesTo !== "all" && condition.appliesTo !== context) {
      return;
    }

    // Get trigger field value
    const triggerValue = formData[condition.triggerField];
    
    // Evaluate condition
    let matches = false;
    switch (condition.operator) {
      case "equals":
        matches = String(triggerValue) === String(condition.triggerValue);
        break;
      case "not_equals":
        matches = String(triggerValue) !== String(condition.triggerValue);
        break;
      case "contains":
        matches = String(triggerValue).toLowerCase().includes(String(condition.triggerValue).toLowerCase());
        break;
      case "not_contains":
        matches = !String(triggerValue).toLowerCase().includes(String(condition.triggerValue).toLowerCase());
        break;
      case "greater_than":
        matches = Number(triggerValue) > Number(condition.triggerValue);
        break;
      case "less_than":
        matches = Number(triggerValue) < Number(condition.triggerValue);
        break;
    }

    // Apply action
    if (matches) {
      if (condition.action === "show") {
        visibleFields.add(condition.targetField);
      } else {
        hiddenFields.add(condition.targetField);
      }
    }
  });

  return { visibleFields, hiddenFields };
}
