import { useState } from "react";

/**
 * Critical Alert Override - Forces staff to actively acknowledge critical alerts
 * Not just a badge - staff must confirm they've seen and understood
 */
export default function CriticalAlertOverride({ patient, onAcknowledge, acknowledgedAlerts = {} }) {
  const criticalAlerts = (patient.alerts || []).filter(alert =>
    ["Allergy", "Heart Condition", "Pregnancy", "High Risk"].includes(alert)
  );

  if (criticalAlerts.length === 0) return null;

  const allAcknowledged = criticalAlerts.every(alert => acknowledgedAlerts[alert]);

  return (
    <div style={{
      background: allAcknowledged ? "#dcfce7" : "linear-gradient(135deg, #fff0f0 0%, #fee2e2 100%)",
      border: `2px solid ${allAcknowledged ? "#22c55e" : "#ef4444"}`,
      borderRadius: 12,
      padding: "16px 20px",
      marginBottom: 20,
      boxShadow: allAcknowledged ? "none" : "0 0 20px rgba(239,68,68,0.2)",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{
          width: 32, height: 32, borderRadius: "50%",
          background: allAcknowledged ? "#22c55e" : "#ef4444",
          display: "flex", alignItems: "center", justifyContent: "center",
          animation: allAcknowledged ? "none" : "criticalPulse 2s ease-in-out infinite",
        }}>
          <style>{`
            @keyframes criticalPulse {
              0%, 100% { transform: scale(1); opacity: 1; }
              50% { transform: scale(1.1); opacity: 0.9; }
            }
          `}</style>
          <i className={`ti ${allAcknowledged ? "ti-check" : "ti-alert-triangle"}`} style={{ fontSize: 16, color: "#fff" }} />
        </div>
        <div>
          <div style={{
            fontSize: 13, fontWeight: 800,
            color: allAcknowledged ? "#15803d" : "#991b1b",
            textTransform: "uppercase", letterSpacing: "0.08em",
          }}>
            {allAcknowledged ? "Critical Alerts Acknowledged" : "Critical Alert Override Required"}
          </div>
          <div style={{ fontSize: 11, color: allAcknowledged ? "#166534" : "#b91c1c" }}>
            {allAcknowledged ? "All critical alerts have been reviewed" : "Staff must actively confirm they have reviewed these alerts"}
          </div>
        </div>
      </div>

      {/* Alert List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {criticalAlerts.map(alert => {
          const isAcked = acknowledgedAlerts[alert];
          return (
            <AlertItem
              key={alert}
              alert={alert}
              patient={patient}
              acknowledged={isAcked}
              onAcknowledge={() => onAcknowledge(alert)}
            />
          );
        })}
      </div>

      {/* Warning text if not acknowledged */}
      {!allAcknowledged && (
        <div style={{
          marginTop: 12, paddingTop: 12, borderTop: "1px solid #fecaca",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <i className="ti ti-info-circle" style={{ fontSize: 14, color: "#dc2626" }} />
          <span style={{ fontSize: 12, color: "#dc2626", fontWeight: 500 }}>
            You cannot proceed until all critical alerts are acknowledged
          </span>
        </div>
      )}
    </div>
  );
}

function AlertItem({ alert, patient, acknowledged, onAcknowledge }) {
  const [expanded, setExpanded] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const alertDetails = {
    "Allergy": {
      icon: "ti-alert-triangle",
      color: "#ef4444",
      description: "Patient has a documented allergy that requires special attention",
      action: "Verify allergy details before any treatment or medication",
      patientData: patient.allergies || "No specific allergy recorded"
    },
    "Heart Condition": {
      icon: "ti-heart-pulse",
      color: "#dc2626",
      description: "Patient has a cardiac condition requiring monitoring",
      action: "Review cardiac history before any procedures",
      patientData: (patient.conditions || []).filter(c => c.includes("Heart") || c.includes("Cardiac")).join(", ") || "No specific condition recorded"
    },
    "Pregnancy": {
      icon: "ti-baby-carriage",
      color: "#9333ea",
      description: "Patient is pregnant - medication and treatment restrictions apply",
      action: "Confirm pregnancy stage before prescribing any medication",
      patientData: patient.alerts?.includes("Pregnancy") ? "Pregnancy alert active" : "No details recorded"
    },
    "High Risk": {
      icon: "ti-urgent",
      color: "#b91c1c",
      description: "Patient has been flagged as high risk",
      action: "Review full medical history before any intervention",
      patientData: (patient.conditions || []).join(", ") || "No specific conditions recorded"
    }
  };

  const details = alertDetails[alert] || { icon: "ti-alert-triangle", color: "#ef4444", description: "", action: "", patientData: "" };

  if (confirming) {
    return (
      <div style={{
        background: "#fff0f0", border: "2px solid #ef4444", borderRadius: 8,
        padding: 16,
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#991b1b", marginBottom: 12 }}>
          Confirm Acknowledgment: {alert}
        </div>
        <div style={{ fontSize: 12, color: "#7f1d1d", marginBottom: 16, lineHeight: 1.5 }}>
          By acknowledging this alert, you confirm that you have:
        </div>
        <ul style={{ fontSize: 12, color: "#7f1d1d", marginLeft: 20, marginBottom: 16, lineHeight: 1.8 }}>
          <li>Reviewed the patient's {alert.toLowerCase()} status</li>
          <li>Understood the implications for treatment</li>
          <li>Will take appropriate precautions</li>
          <li>This action will be logged in the audit trail</li>
        </ul>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => setConfirming(false)}
            style={{
              padding: "8px 16px", borderRadius: 6, fontSize: 12, fontWeight: 600,
              background: "#fff", border: "1px solid #d1d5db", color: "#374151", cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => { onAcknowledge(); setConfirming(false); }}
            style={{
              padding: "8px 16px", borderRadius: 6, fontSize: 12, fontWeight: 600,
              background: "#ef4444", border: "none", color: "#fff", cursor: "pointer",
            }}
          >
            I Acknowledge This Alert
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: acknowledged ? "#dcfce7" : "#fff0f0",
      border: acknowledged ? "1px solid #22c55e" : "1px solid #fecaca",
      borderRadius: 8,
      padding: "12px 14px",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            background: acknowledged ? "#22c55e" : details.color + "20",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <i className={`ti ${acknowledged ? "ti-check" : details.icon}`} style={{
              fontSize: 14,
              color: acknowledged ? "#fff" : details.color,
            }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: 13, fontWeight: 700,
              color: acknowledged ? "#15803d" : "#991b1b",
              textDecoration: acknowledged ? "line-through" : "none",
            }}>
              {alert}
            </div>
            <div style={{ fontSize: 11, color: acknowledged ? "#166534" : "#b91c1c" }}>
              {details.description}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              padding: "6px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
              background: "transparent", border: "1px solid #d1d5db", color: "#374151", cursor: "pointer",
            }}
          >
            {expanded ? "Hide" : "Details"}
          </button>
          {!acknowledged && (
            <button
              onClick={() => setConfirming(true)}
              style={{
                padding: "6px 16px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                background: "#ef4444", border: "none", color: "#fff", cursor: "pointer",
              }}
            >
              Acknowledge
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div style={{
          marginTop: 12, paddingTop: 12, borderTop: "1px solid #fecaca",
          display: "flex", flexDirection: "column", gap: 8,
        }}>
          <div style={{ fontSize: 12, color: "#7f1d1d" }}>
            <strong>Required Action:</strong> {details.action}
          </div>
          <div style={{ fontSize: 12, color: "#7f1d1d" }}>
            <strong>Patient Data:</strong> {details.patientData}
          </div>
        </div>
      )}
    </div>
  );
}
