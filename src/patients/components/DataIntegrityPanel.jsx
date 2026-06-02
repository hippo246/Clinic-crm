import { detectContradictions, checkActivationRequirements, calculateDataQualityScore, detectStaleRecord } from "../utils/dataIntegrity";

/**
 * DataIntegrityPanel - Shows data contradictions, warnings, and quality issues
 * Helps prevent mistakes by highlighting problematic data
 */
export default function DataIntegrityPanel({ patient, onFixIssue }) {
  const contradictions = detectContradictions(patient);
  const activationCheck = checkActivationRequirements(patient);
  const qualityScore = calculateDataQualityScore(patient);
  const staleCheck = detectStaleRecord(patient);

  if (contradictions.length === 0 && activationCheck.canActivate && qualityScore.score >= 90) {
    return null;
  }

  const criticalIssues = contradictions.filter(c => c.severity === "critical");
  const warnings = contradictions.filter(c => c.severity === "warning");
  const infoItems = contradictions.filter(c => c.severity === "info");

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
          background: criticalIssues.length > 0 ? "#ef4444" : warnings.length > 0 ? "#f59e0b" : "#4f7cff",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <i className={`ti ${criticalIssues.length > 0 ? "ti-alert-triangle" : warnings.length > 0 ? "ti-alert-circle" : "ti-info-circle"}`} style={{ fontSize: 16, color: "#fff" }} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
            Data Integrity Check
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>
            {contradictions.length} issue{contradictions.length !== 1 ? "s" : ""} found · Quality Score: {qualityScore.score}/100
          </div>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <QualityBadge score={qualityScore.score} level={qualityScore.level} />
        </div>
      </div>

      {/* Critical Issues */}
      {criticalIssues.length > 0 && (
        <IssueSection
          title="Critical Issues"
          icon="ti-alert-triangle"
          color="#ef4444"
          bg="#fee2e2"
          issues={criticalIssues}
          onFix={onFixIssue}
        />
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <IssueSection
          title="Warnings"
          icon="ti-alert-circle"
          color="#f59e0b"
          bg="#fef3c7"
          issues={warnings}
          onFix={onFixIssue}
        />
      )}

      {/* Info */}
      {infoItems.length > 0 && (
        <IssueSection
          title="Information"
          icon="ti-info-circle"
          color="#4f7cff"
          bg="#eff6ff"
          issues={infoItems}
          onFix={onFixIssue}
        />
      )}

      {/* Activation Blocker */}
      {!activationCheck.canActivate && patient.status === "Active" && (
        <div style={{
          marginTop: 16, padding: "12px 14px", borderRadius: 8,
          background: "#fef2f2", border: "1px solid #fecaca",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <i className="ti ti-shield-x" style={{ fontSize: 14, color: "#dc2626" }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: "#dc2626" }}>
              Cannot Activate Patient
            </span>
          </div>
          <ul style={{ fontSize: 12, color: "#991b1b", marginLeft: 20, lineHeight: 1.8 }}>
            {activationCheck.missing.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Stale Record Warning */}
      {staleCheck.isStale && (
        <div style={{
          marginTop: 16, padding: "12px 14px", borderRadius: 8,
          background: "#fffbeb", border: "1px solid #fcd34d",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <i className="ti ti-clock-hour-4" style={{ fontSize: 14, color: "#b45309" }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#b45309" }}>
                Stale Record
              </div>
              <div style={{ fontSize: 11, color: "#92400e" }}>
                No activity for {staleCheck.monthsSinceLastVisit} months ({staleCheck.daysSinceLastVisit} days)
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function IssueSection({ title, icon, color, bg, issues, onFix }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        marginBottom: 10, fontSize: 11, fontWeight: 700,
        color, textTransform: "uppercase", letterSpacing: "0.07em",
      }}>
        <i className={`ti ${icon}`} style={{ fontSize: 12 }} />
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {issues.map((issue, idx) => (
          <div key={idx} style={{
            background: bg, border: `1px solid ${color}40`, borderRadius: 8,
            padding: "10px 12px",
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <i className={`ti ${icon}`} style={{ fontSize: 12, color, flexShrink: 0, marginTop: 2 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>
                  {issue.message}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>
                  <span style={{ fontWeight: 500 }}>Fields:</span> {issue.fields.join(", ")}
                </div>
                {issue.suggestion && (
                  <div style={{ fontSize: 11, color: "#6b7280" }}>
                    <span style={{ fontWeight: 500 }}>Suggestion:</span> {issue.suggestion}
                  </div>
                )}
              </div>
              {onFix && (
                <button
                  onClick={() => onFix(issue)}
                  style={{
                    padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                    background: color, border: "none", color: "#fff", cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  Fix
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function QualityBadge({ score, level }) {
  const colors = {
    Excellent: { bg: "#dcfce7", color: "#15803d" },
    Good: { bg: "#dbeafe", color: "#1e40af" },
    Fair: { bg: "#fef3c7", color: "#92400e" },
    Poor: { bg: "#fee2e2", color: "#991b1b" },
  };
  const c = colors[level] || colors.Fair;

  return (
    <div style={{
      padding: "4px 12px", borderRadius: 20,
      background: c.bg, color: c.color,
      fontSize: 11, fontWeight: 700,
    }}>
      {level} ({score})
    </div>
  );
}
