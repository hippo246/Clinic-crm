import { useState } from "react";

/**
 * Patient Quick Peek - Instant mini profile on hover/tap
 * Shows critical information without opening full profile
 */
export default function PatientQuickPeek({ patient, position = { x: 0, y: 0 }, onClose, onSelect }) {
  const [loading, setLoading] = useState(false);

  const riskLevel = calculateRiskLevel(patient);
  const criticalAlerts = (patient.alerts || []).filter(a =>
    ["Allergy", "Heart Condition", "Pregnancy", "High Risk"].includes(a)
  );

  const handleSelect = () => {
    setLoading(true);
    setTimeout(() => {
      onSelect(patient);
      onClose();
    }, 100);
  };

  return (
    <div
      style={{
        position: "fixed",
        left: Math.min(position.x, window.innerWidth - 380),
        top: Math.min(position.y, window.innerHeight - 500),
        width: 360,
        maxHeight: 480,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
        zIndex: 10000,
        overflow: "hidden",
        animation: "peekIn 0.15s ease-out",
      }}
    >
      <style>{`
        @keyframes peekIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Header */}
      <div style={{
        padding: "14px 16px",
        background: "var(--surface2)",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: "50%",
          background: getAvatarColor(patient.name),
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, fontWeight: 700, color: "#fff",
        }}>
          {getInitials(patient.name)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 700, color: "var(--text)",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {patient.name}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>
            {patient.id} · {patient.age} yrs · {patient.gender}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            width: 28, height: 28, borderRadius: 6,
            background: "transparent", border: "none",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <i className="ti ti-x" style={{ fontSize: 16, color: "var(--muted)" }} />
        </button>
      </div>

      {/* Content */}
      <div style={{ padding: 12, overflowY: "auto", maxHeight: 380 }}>
        {/* Risk Badge */}
        <div style={{ marginBottom: 12 }}>
          <RiskBadge level={riskLevel} />
        </div>

        {/* Critical Alerts */}
        {criticalAlerts.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{
              fontSize: 10, fontWeight: 700, color: "var(--muted)",
              marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em",
            }}>
              Critical Alerts
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {criticalAlerts.map(alert => (
                <span key={alert} style={{
                  padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 600,
                  background: "#fee2e2", color: "#dc2626",
                }}>
                  {alert}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Quick Info Grid */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8,
          marginBottom: 12,
        }}>
          <QuickInfoItem label="Phone" value={patient.phone} icon="ti-phone" />
          <QuickInfoItem label="Doctor" value={patient.doctor} icon="ti-stethoscope" />
          <QuickInfoItem label="Status" value={patient.status} icon="ti-circle-dot" colored />
          <QuickInfoItem label="Insurance" value={patient.insuranceStatus} icon="ti-shield" colored />
        </div>

        {/* Last Visit */}
        {patient.lastVisit && (
          <div style={{
            padding: 8, borderRadius: 6,
            background: "var(--surface2)", border: "1px solid var(--border)",
            marginBottom: 12,
          }}>
            <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 2 }}>
              Last Visit
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>
              {new Date(patient.lastVisit).toLocaleDateString("en-IN", {
                day: "numeric", month: "short", year: "numeric"
              })}
            </div>
          </div>
        )}

        {/* Next Appointment */}
        {patient.nextAppointment && (
          <div style={{
            padding: 8, borderRadius: 6,
            background: "#dbeafe", border: "1px solid #3b82f630",
            marginBottom: 12,
          }}>
            <div style={{ fontSize: 10, color: "#1e40af", marginBottom: 2 }}>
              Next Appointment
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#1e40af" }}>
              {new Date(patient.nextAppointment).toLocaleDateString("en-IN", {
                day: "numeric", month: "short", year: "numeric"
              })}
            </div>
          </div>
        )}

        {/* Missing Data Warning */}
        {hasMissingData(patient) && (
          <div style={{
            padding: 8, borderRadius: 6,
            background: "#fef3c7", border: "1px solid #f59e0b30",
            marginBottom: 12,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <i className="ti ti-alert-triangle" style={{ fontSize: 12, color: "#92400e" }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: "#92400e" }}>
                Missing Data
              </span>
            </div>
            <div style={{ fontSize: 10, color: "#78350f" }}>
              {getMissingDataList(patient)}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: 10, borderTop: "1px solid var(--border)",
        background: "var(--surface2)",
      }}>
        <button
          onClick={handleSelect}
          disabled={loading}
          style={{
            width: "100%",
            padding: "8px 16px",
            borderRadius: 6,
            fontSize: 12, fontWeight: 600,
            background: "var(--accent)",
            border: "none",
            color: "#fff",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Opening..." : "Open Full Profile"}
        </button>
      </div>
    </div>
  );
}

function QuickInfoItem({ label, value, icon, colored }) {
  const statusColors = {
    "Active": "#22c55e",
    "New": "#3b82f6",
    "Follow-Up Due": "#f59e0b",
    "Inactive": "#64748b",
    "VIP": "#f97316",
    "Active": "#22c55e",
    "Expiring": "#f59e0b",
    "Expired": "#ef4444",
    "None": "#64748b",
  };

  return (
    <div style={{
      padding: 6, borderRadius: 6,
      background: "var(--surface2)", border: "1px solid var(--border)",
    }}>
      <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 2, display: "flex", alignItems: "center", gap: 4 }}>
        <i className={`ti ${icon}`} style={{ fontSize: 10 }} />
        {label}
      </div>
      <div style={{
        fontSize: 11, fontWeight: 600,
        color: colored ? (statusColors[value] || "var(--text)") : "var(--text)",
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>
        {value || "—"}
      </div>
    </div>
  );
}

function RiskBadge({ level }) {
  const config = {
    Low: { bg: "#dcfce7", color: "#15803d", icon: "ti-circle-check" },
    Medium: { bg: "#fef3c7", color: "#92400e", icon: "ti-alert-circle" },
    High: { bg: "#fee2e2", color: "#991b1b", icon: "ti-alert-triangle" },
    Critical: { bg: "#7f1d1d", color: "#fca5a5", icon: "ti-urgent" },
  };

  const c = config[level] || config.Low;

  return (
    <div style={{
      padding: "6px 10px", borderRadius: 6,
      background: c.bg, color: c.color,
      fontSize: 11, fontWeight: 700,
      display: "flex", alignItems: "center", gap: 6,
    }}>
      <i className={`ti ${c.icon}`} style={{ fontSize: 12 }} />
      {level} Risk
    </div>
  );
}

function calculateRiskLevel(patient) {
  const criticalAlerts = (patient.alerts || []).filter(a =>
    ["Allergy", "Heart Condition", "Pregnancy", "High Risk"].includes(a)
  );

  if (criticalAlerts.length >= 2) return "Critical";
  if (criticalAlerts.length === 1) return "High";
  if (patient.status === "Follow-Up Due") return "Medium";
  return "Low";
}

function hasMissingData(patient) {
  return !patient.emergencyName || !patient.emergencyPhone ||
         !patient.consentSigned || !patient.phoneVerified;
}

function getMissingDataList(patient) {
  const missing = [];
  if (!patient.emergencyName || !patient.emergencyPhone) missing.push("Emergency Contact");
  if (!patient.consentSigned) missing.push("Consent");
  if (!patient.phoneVerified) missing.push("Phone Verification");
  return missing.join(", ");
}

function getAvatarColor(name) {
  const colors = ["#4f7cff", "#7c4fff", "#00b4a0", "#f97316", "#ec4899", "#22c55e"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name) {
  return name
    .split(" ")
    .map(n => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}
