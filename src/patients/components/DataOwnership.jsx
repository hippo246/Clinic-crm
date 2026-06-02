/**
 * Data Ownership Display - Shows who owns/manages patient data
 * Helps with accountability and access control
 */
export default function DataOwnership({ patient }) {
  const ownership = getDataOwnership(patient);

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
          background: "var(--accent-soft)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <i className="ti ti-shield-check" style={{ fontSize: 16, color: "var(--accent)" }} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
            Data Ownership
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>
            Access control and accountability
          </div>
        </div>
      </div>

      {/* Primary Manager */}
      {ownership.primaryManager && (
        <div style={{
          marginBottom: 16,
          padding: 12, borderRadius: 8,
          background: "#dbeafe", border: "1px solid #3b82f630",
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#1e40af", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Primary Manager
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 700, color: "#fff",
            }}>
              {ownership.primaryManager.name.charAt(0)}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#1e40af" }}>
                {ownership.primaryManager.name}
              </div>
              <div style={{ fontSize: 11, color: "#1e40af70" }}>
                {ownership.primaryManager.role} · Since {ownership.primaryManager.since ? new Date(ownership.primaryManager.since).toLocaleDateString("en-IN", { month: "short", year: "numeric" }) : "N/A"}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Role Permissions */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
        <RoleCard
          role="Reception"
          icon="ti-phone-call"
          color="#22c55e"
          permissions={ownership.reception}
        />
        <RoleCard
          role="Doctor"
          icon="ti-stethoscope"
          color="#7c4fff"
          permissions={ownership.doctor}
        />
        <RoleCard
          role="Admin"
          icon="ti-shield"
          color="#f59e0b"
          permissions={ownership.admin}
        />
      </div>
    </div>
  );
}

function RoleCard({ role, icon, color, permissions }) {
  return (
    <div style={{
      padding: 12, borderRadius: 8,
      background: "var(--surface2)", border: "1px solid var(--border)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{
          width: 28, height: 28, borderRadius: "50%",
          background: color + "20", display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <i className={`ti ${icon}`} style={{ fontSize: 13, color }} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>
          {role}
        </span>
      </div>

      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: "var(--muted)", marginBottom: 4 }}>
          Can Edit
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {permissions.canEdit.includes("*") ? (
            <span style={{ fontSize: 10, color, fontWeight: 600 }}>All fields</span>
          ) : (
            permissions.canEdit.slice(0, 4).map(field => (
              <span key={field} style={{
                padding: "2px 6px", borderRadius: 4,
                fontSize: 9, background: color + "15", color,
              }}>
                {field}
              </span>
            ))
          )}
          {permissions.canEdit.length > 4 && !permissions.canEdit.includes("*") && (
            <span style={{ fontSize: 9, color: "var(--muted)" }}>
              +{permissions.canEdit.length - 4} more
            </span>
          )}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 10, fontWeight: 600, color: "var(--muted)", marginBottom: 4 }}>
          Can View
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {permissions.canView.includes("*") ? (
            <span style={{ fontSize: 10, color, fontWeight: 600 }}>All fields</span>
          ) : (
            permissions.canView.slice(0, 4).map(field => (
              <span key={field} style={{
                padding: "2px 6px", borderRadius: 4,
                fontSize: 9, background: color + "15", color,
              }}>
                {field}
              </span>
            ))
          )}
          {permissions.canView.length > 4 && !permissions.canView.includes("*") && (
            <span style={{ fontSize: 9, color: "var(--muted)" }}>
              +{permissions.canView.length - 4} more
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function getDataOwnership(patient) {
  return {
    primaryManager: patient.doctor ? {
      role: "doctor",
      name: patient.doctor,
      since: patient.lastVisit || patient.created,
    } : null,
    reception: {
      canEdit: ["phone", "email", "address", "emergencyName", "emergencyPhone", "emergencyRelation"],
      canView: ["phone", "email", "address", "emergencyName", "emergencyPhone", "emergencyRelation", "doctor", "status"],
      lastUpdated: null,
    },
    doctor: {
      canEdit: ["allergies", "conditions", "medications", "alerts", "notes"],
      canView: ["allergies", "conditions", "medications", "alerts", "notes", "timeline"],
      lastUpdated: null,
    },
    admin: {
      canEdit: ["*"],
      canView: ["*"],
      lastUpdated: null,
    },
  };
}
