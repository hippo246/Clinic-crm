/**
 * Field-Level Permissions - Granular access control per field
 * Reception can see phone but not clinical notes
 * Doctor can see clinical notes but not edit billing fields
 */
export default function FieldLevelPermissions({ role, permissions }) {
  const roleConfigs = {
    reception: {
      label: "Reception",
      icon: "ti-phone-call",
      color: "#22c55e",
      description: "Patient registration, contact info, documents",
    },
    doctor: {
      label: "Doctor",
      icon: "ti-stethoscope",
      color: "#7c4fff",
      description: "Medical records, alerts, notes, timeline",
    },
    admin: {
      label: "Admin",
      icon: "ti-shield",
      color: "#f59e0b",
      description: "Full access to all fields and operations",
    },
  };

  const config = roleConfigs[role] || roleConfigs.reception;

  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 12,
      padding: "16px 20px",
      marginBottom: 20,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{
          width: 32, height: 32, borderRadius: "50%",
          background: config.color + "20",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <i className={`ti ${config.icon}`} style={{ fontSize: 16, color: config.color }} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
            {config.label} Permissions
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>
            {config.description}
          </div>
        </div>
      </div>

      {/* Permission Categories */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
        <PermissionCategory
          title="Can Edit"
          fields={permissions.canEdit || []}
          color="#22c55e"
          icon="ti-pencil"
        />
        <PermissionCategory
          title="Can View"
          fields={permissions.canView || []}
          color="#4f7cff"
          icon="ti-eye"
        />
        <PermissionCategory
          title="Cannot Edit"
          fields={permissions.cannotEdit || []}
          color="#ef4444"
          icon="ti-lock"
        />
        <PermissionCategory
          title="Cannot View"
          fields={permissions.cannotView || []}
          color="#dc2626"
          icon="ti-eye-off"
        />
      </div>
    </div>
  );
}

function PermissionCategory({ title, fields, color, icon }) {
  if (fields.length === 0) return null;

  return (
    <div style={{
      padding: 12, borderRadius: 8,
      background: "var(--surface2)", border: "1px solid var(--border)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <i className={`ti ${icon}`} style={{ fontSize: 12, color }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text)" }}>
          {title}
        </span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {fields.slice(0, 6).map(field => (
          <span key={field} style={{
            padding: "3px 8px", borderRadius: 4,
            fontSize: 10, fontWeight: 500,
            background: color + "15", color,
          }}>
            {field}
          </span>
        ))}
        {fields.length > 6 && (
          <span style={{ fontSize: 10, color: "var(--muted)" }}>
            +{fields.length - 6} more
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Get default permissions for a role
 */
export function getDefaultPermissions(role) {
  const permissions = {
    reception: {
      canEdit: ["phone", "email", "address", "emergencyName", "emergencyPhone", "emergencyRelation", "consentSigned"],
      canView: ["phone", "email", "address", "emergencyName", "emergencyPhone", "emergencyRelation", "doctor", "status", "insuranceStatus", "alerts"],
      cannotEdit: ["allergies", "conditions", "medications", "clinicalNotes", "timeline"],
      cannotView: ["clinicalNotes", "detailedHistory"],
    },
    doctor: {
      canEdit: ["allergies", "conditions", "medications", "alerts", "notes", "followUpDate", "followUpReason"],
      canView: ["allergies", "conditions", "medications", "alerts", "notes", "timeline", "documents", "followUpDate", "followUpReason"],
      cannotEdit: ["phone", "email", "address", "insuranceProvider", "policyNumber", "billing"],
      cannotView: ["billing", "paymentHistory"],
    },
    admin: {
      canEdit: ["*"],
      canView: ["*"],
      cannotEdit: [],
      cannotView: [],
    },
  };

  return permissions[role] || permissions.reception;
}

/**
 * Check if a role can edit a field
 */
export function canEditField(role, field) {
  const permissions = getDefaultPermissions(role);
  if (permissions.canEdit.includes("*")) return true;
  return permissions.canEdit.includes(field) && !permissions.cannotEdit.includes(field);
}

/**
 * Check if a role can view a field
 */
export function canViewField(role, field) {
  const permissions = getDefaultPermissions(role);
  if (permissions.canView.includes("*")) return true;
  return permissions.canView.includes(field) && !permissions.cannotView.includes(field);
}
