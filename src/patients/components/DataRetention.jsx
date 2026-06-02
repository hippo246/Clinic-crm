/**
 * Data Retention Rules - Hospitals care about data retention
 * Archive after X years, never delete
 */
export default function DataRetention({ patients, retentionRules, onUpdateRules }) {
  const [showSettings, setShowSettings] = useState(false);

  const affectedPatients = calculateAffectedPatients(patients, retentionRules);

  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 12,
      padding: "20px",
      marginBottom: 20,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            background: "#64748b20",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <i className="ti ti-archive" style={{ fontSize: 16, color: "#64748b" }} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
              Data Retention Rules
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>
              Archive and retention policies
            </div>
          </div>
        </div>
        <button
          onClick={() => setShowSettings(true)}
          style={{
            padding: "6px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600,
            background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)",
            cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
          }}
        >
          <i className="ti ti-settings" style={{ fontSize: 12 }} />
          Configure
        </button>
      </div>

      {/* Retention Rules */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {retentionRules.map((rule, idx) => (
          <RetentionRuleCard
            key={idx}
            rule={rule}
            affectedCount={affectedPatients[rule.dataType] || 0}
          />
        ))}
      </div>

      {/* Warning */}
      <div style={{
        marginTop: 16, padding: 12, borderRadius: 8,
        background: "#fef3c7", border: "1px solid #f59e0b30",
      }}>
        <div style={{ fontSize: 11, color: "#92400e" }}>
          <i className="ti ti-alert-triangle" style={{ fontSize: 12, marginRight: 6 }} />
          Data is archived, not deleted. All records remain accessible in read-only mode.
        </div>
      </div>

      {showSettings && (
        <RetentionSettingsModal
          rules={retentionRules}
          onSave={onUpdateRules}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

function RetentionRuleCard({ rule, affectedCount }) {
  const ruleIcons = {
    patientRecords: "ti-users",
    clinicalNotes: "ti-notes",
    documents: "ti-files",
    auditLogs: "ti-history",
    communications: "ti-message",
  };

  const ruleColors = {
    patientRecords: "#4f7cff",
    clinicalNotes: "#7c4fff",
    documents: "#00b4a0",
    auditLogs: "#f59e0b",
    communications: "#ec4899",
  };

  return (
    <div style={{
      padding: 14, borderRadius: 8,
      background: "var(--surface2)", border: "1px solid var(--border)",
      display: "flex", alignItems: "center", gap: 12,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: "50%",
        background: ruleColors[rule.dataType] + "20",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <i className={`ti ${ruleIcons[rule.dataType]}`} style={{ fontSize: 18, color: ruleColors[rule.dataType] }} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
          {rule.label}
        </div>
        <div style={{ fontSize: 11, color: "var(--muted)" }}>
          Archive after {rule.retentionYears} years · {affectedCount} records affected
        </div>
      </div>

      <div style={{
        padding: "4px 10px", borderRadius: 4,
        background: rule.action === "archive" ? "#dbeafe" : "#fee2e2",
        color: rule.action === "archive" ? "#1e40af" : "#dc2626",
        fontSize: 10, fontWeight: 600, textTransform: "uppercase",
      }}>
        {rule.action}
      </div>
    </div>
  );
}

function RetentionSettingsModal({ rules, onSave, onClose }) {
  const [localRules, setLocalRules] = useState(rules);

  const handleUpdateRule = (idx, field, value) => {
    const updated = [...localRules];
    updated[idx] = { ...updated[idx], [field]: value };
    setLocalRules(updated);
  };

  const handleSave = () => {
    onSave(localRules);
    onClose();
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
        width: 500,
        maxWidth: "90vw",
        maxHeight: "90vh",
        overflowY: "auto",
      }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", marginBottom: 20 }}>
          Configure Retention Rules
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {localRules.map((rule, idx) => (
            <div key={idx} style={{
              padding: 12, borderRadius: 8,
              background: "var(--surface2)", border: "1px solid var(--border)",
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 12 }}>
                {rule.label}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginBottom: 6, display: "block" }}>
                    Retention Period (years)
                  </label>
                  <input
                    type="number"
                    value={rule.retentionYears}
                    onChange={(e) => handleUpdateRule(idx, "retentionYears", Number(e.target.value))}
                    min="1"
                    max="50"
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: 6,
                      border: "1px solid var(--border)",
                      fontSize: 12,
                      background: "var(--surface)",
                      color: "var(--text)",
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginBottom: 6, display: "block" }}>
                    Action
                  </label>
                  <select
                    value={rule.action}
                    onChange={(e) => handleUpdateRule(idx, "action", e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: 6,
                      border: "1px solid var(--border)",
                      fontSize: 12,
                      background: "var(--surface)",
                      color: "var(--text)",
                    }}
                  >
                    <option value="archive">Archive</option>
                    <option value="delete">Delete</option>
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{
          marginTop: 16, padding: 12, borderRadius: 8,
          background: "#fef3c7", border: "1px solid #f59e0b30",
        }}>
          <div style={{ fontSize: 11, color: "#92400e" }}>
            <i className="ti ti-alert-triangle" style={{ fontSize: 12, marginRight: 6 }} />
            Changes will apply to all existing and future records. Archive is recommended for compliance.
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
            style={{
              padding: "8px 16px", borderRadius: 6, fontSize: 12, fontWeight: 600,
              background: "var(--accent)", border: "none", color: "#fff", cursor: "pointer",
            }}
          >
            Save Rules
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Calculate affected patients based on retention rules
 */
function calculateAffectedPatients(patients, retentionRules) {
  const affected = {};
  const now = new Date();

  retentionRules.forEach(rule => {
    const cutoffDate = new Date(now.getFullYear() - rule.retentionYears, now.getMonth(), now.getDate());
    
    let count = 0;
    patients.forEach(patient => {
      const patientDate = new Date(patient.createdAt || patient.lastVisit || patient.dob);
      if (patientDate < cutoffDate) {
        count++;
      }
    });

    affected[rule.dataType] = count;
  });

  return affected;
}

/**
 * Default retention rules
 */
export const DEFAULT_RETENTION_RULES = [
  {
    dataType: "patientRecords",
    label: "Patient Records",
    retentionYears: 25,
    action: "archive",
  },
  {
    dataType: "clinicalNotes",
    label: "Clinical Notes",
    retentionYears: 25,
    action: "archive",
  },
  {
    dataType: "documents",
    label: "Documents",
    retentionYears: 10,
    action: "archive",
  },
  {
    dataType: "auditLogs",
    label: "Audit Logs",
    retentionYears: 7,
    action: "archive",
  },
  {
    dataType: "communications",
    label: "Communications",
    retentionYears: 5,
    action: "archive",
  },
];
