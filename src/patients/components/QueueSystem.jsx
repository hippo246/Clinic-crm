import { useState } from "react";

/**
 * Queue System - Patient queues for operations staff
 * Missing documents, Insurance verification, Follow-up needed, Data cleanup, High risk review
 */
export default function QueueSystem({ patients, queues, onProcessItem, onRemoveItem }) {
  const [selectedQueue, setSelectedQueue] = useState("all");

  const queueTypes = [
    { key: "missingDocs", label: "Missing Documents", icon: "ti-file-off", color: "#f59e0b" },
    { key: "insuranceVerify", label: "Insurance Verification", icon: "ti-shield", color: "#7c4fff" },
    { key: "followUpNeeded", label: "Follow-Up Needed", icon: "ti-clock", color: "#ec4899" },
    { key: "dataCleanup", label: "Data Cleanup", icon: "ti-broom", color: "#22c55e" },
    { key: "highRiskReview", label: "High Risk Review", icon: "ti-alert-triangle", color: "#ef4444" },
  ];

  const filteredQueues = selectedQueue === "all" 
    ? queues 
    : queues.filter(q => q.type === selectedQueue);

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        marginBottom: 16,
      }}>
        <i className="ti ti-list-queued" style={{ fontSize: 14, color: "var(--accent)" }} />
        <span style={{
          fontSize: 12, fontWeight: 700, color: "var(--text)",
          textTransform: "uppercase", letterSpacing: "0.06em",
        }}>
          Patient Queues
        </span>
      </div>

      {/* Queue Type Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto" }}>
        <button
          onClick={() => setSelectedQueue("all")}
          style={{
            padding: "8px 14px", borderRadius: 20, fontSize: 11, fontWeight: 600,
            background: selectedQueue === "all" ? "var(--accent)" : "var(--surface2)",
            border: selectedQueue === "all" ? "1px solid var(--accent)" : "1px solid var(--border)",
            color: selectedQueue === "all" ? "#fff" : "var(--text)",
            cursor: "pointer", whiteSpace: "nowrap",
          }}
        >
          All ({queues.length})
        </button>
        {queueTypes.map(type => {
          const count = queues.filter(q => q.type === type.key).length;
          return (
            <button
              key={type.key}
              onClick={() => setSelectedQueue(type.key)}
              style={{
                padding: "8px 14px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                background: selectedQueue === type.key ? type.color + "20" : "var(--surface2)",
                border: selectedQueue === type.key ? `1px solid ${type.color}` : "1px solid var(--border)",
                color: selectedQueue === type.key ? type.color : "var(--text)",
                cursor: "pointer", whiteSpace: "nowrap",
              }}
            >
              <i className={`ti ${type.icon}`} style={{ fontSize: 11, marginRight: 4 }} />
              {type.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Queue Items */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filteredQueues.map(item => (
          <QueueItem
            key={item.id}
            item={item}
            onProcess={() => onProcessItem(item)}
            onRemove={() => onRemoveItem(item.id)}
          />
        ))}
        {filteredQueues.length === 0 && (
          <div style={{
            padding: 32, borderRadius: 8,
            background: "var(--surface2)", border: "1px dashed var(--border)",
            textAlign: "center",
          }}>
            <i className="ti ti-list-queued" style={{ fontSize: 32, color: "var(--muted)" }} />
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 12 }}>
              No items in this queue
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function QueueItem({ item, onProcess, onRemove }) {
  const queueConfig = {
    missingDocs: { icon: "ti-file-off", color: "#f59e0b", label: "Missing Documents" },
    insuranceVerify: { icon: "ti-shield", color: "#7c4fff", label: "Insurance Verification" },
    followUpNeeded: { icon: "ti-clock", color: "#ec4899", label: "Follow-Up Needed" },
    dataCleanup: { icon: "ti-broom", color: "#22c55e", label: "Data Cleanup" },
    highRiskReview: { icon: "ti-alert-triangle", color: "#ef4444", label: "High Risk Review" },
  };

  const config = queueConfig[item.type] || queueConfig.dataCleanup;

  return (
    <div style={{
      padding: 14, borderRadius: 8,
      background: "var(--surface)", border: "1px solid var(--border)",
      display: "flex", alignItems: "center", gap: 12,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: "50%",
        background: config.color + "20", display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        <i className={`ti ${config.icon}`} style={{ fontSize: 18, color: config.color }} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
          {item.patientName}
        </div>
        <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>
          {item.patientId} · {config.label}
        </div>
        <div style={{ fontSize: 11, color: config.color, fontWeight: 500 }}>
          {item.reason}
        </div>
      </div>

      <div style={{ display: "flex", gap: 6 }}>
        <button
          onClick={onProcess}
          style={{
            padding: "6px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600,
            background: config.color, border: "none", color: "#fff", cursor: "pointer",
          }}
        >
          Process
        </button>
        <button
          onClick={onRemove}
          style={{
            padding: "6px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
            background: "transparent", border: "1px solid #fecaca", color: "#dc2626",
            cursor: "pointer",
          }}
        >
          <i className="ti ti-x" style={{ fontSize: 12 }} />
        </button>
      </div>
    </div>
  );
}

/**
 * Generate queue items from patients
 */
export function generateQueueItems(patients) {
  const items = [];

  patients.forEach(patient => {
    // Missing documents
    if (!patient.documentsComplete) {
      items.push({
        id: `queue-docs-${patient.id}`,
        type: "missingDocs",
        patientId: patient.id,
        patientName: patient.name,
        reason: "Required documents incomplete",
        priority: "high",
        addedAt: new Date().toISOString(),
      });
    }

    // Insurance verification
    if (patient.insurer && patient.insurer !== "None" && !patient.insuranceVerified) {
      items.push({
        id: `queue-ins-${patient.id}`,
        type: "insuranceVerify",
        patientId: patient.id,
        patientName: patient.name,
        reason: `Verify ${patient.insurer} insurance`,
        priority: patient.insuranceStatus === "Expiring" ? "high" : "medium",
        addedAt: new Date().toISOString(),
      });
    }

    // Follow-up needed
    if (patient.status === "Follow-Up Due" || (patient.followUpDate && new Date(patient.followUpDate) < new Date())) {
      items.push({
        id: `queue-follow-${patient.id}`,
        type: "followUpNeeded",
        patientId: patient.id,
        patientName: patient.name,
        reason: patient.followUpReason || "Follow-up overdue",
        priority: "high",
        addedAt: new Date().toISOString(),
      });
    }

    // High risk review
    const criticalAlerts = (patient.alerts || []).filter(a =>
      ["Allergy", "Heart Condition", "Pregnancy", "High Risk"].includes(a)
    );
    if (criticalAlerts.length > 0 && !patient.alertsReviewed) {
      items.push({
        id: `queue-risk-${patient.id}`,
        type: "highRiskReview",
        patientId: patient.id,
        patientName: patient.name,
        reason: `Review critical alerts: ${criticalAlerts.join(", ")}`,
        priority: "critical",
        addedAt: new Date().toISOString(),
      });
    }

    // Data cleanup
    if (!patient.emergencyName || !patient.emergencyPhone || !patient.consentSigned) {
      items.push({
        id: `queue-cleanup-${patient.id}`,
        type: "dataCleanup",
        patientId: patient.id,
        patientName: patient.name,
        reason: "Missing required data",
        priority: "medium",
        addedAt: new Date().toISOString(),
      });
    }
  });

  return items;
}
