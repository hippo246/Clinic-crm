/**
 * Duplicate Confidence Display - Shows match percentage and details
 * Helps staff identify potential duplicate patients
 */
export default function DuplicateConfidence({ patient, allPatients, onMerge, onDismiss }) {
  const duplicates = findPotentialDuplicates(patient, allPatients, 50);

  if (duplicates.length === 0) {
    return null;
  }

  return (
    <div style={{
      background: "#fef3c7",
      border: "2px solid #f59e0b",
      borderRadius: 12,
      padding: "16px 20px",
      marginBottom: 20,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{
          width: 32, height: 32, borderRadius: "50%",
          background: "#f59e0b",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <i className="ti ti-users" style={{ fontSize: 16, color: "#fff" }} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#92400e" }}>
            Potential Duplicate{duplicates.length > 1 ? "s" : ""} Detected
          </div>
          <div style={{ fontSize: 11, color: "#78350f" }}>
            {duplicates.length} possible match{duplicates.length > 1 ? "es" : ""} found
          </div>
        </div>
      </div>

      {/* Duplicate List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {duplicates.slice(0, 3).map((dup, idx) => (
          <DuplicateCard
            key={dup.patient.id}
            duplicate={dup}
            rank={idx + 1}
            onMerge={() => onMerge(dup.patient)}
            onDismiss={() => onDismiss(dup.patient.id)}
          />
        ))}
        {duplicates.length > 3 && (
          <div style={{
            textAlign: "center", fontSize: 11, color: "#78350f",
            padding: "8px", fontStyle: "italic",
          }}>
            +{duplicates.length - 3} more potential duplicate{duplicates.length - 3 !== 1 ? "s" : ""}
          </div>
        )}
      </div>
    </div>
  );
}

function DuplicateCard({ duplicate, rank, onMerge, onDismiss }) {
  const levelColors = {
    "Very High": { bg: "#fee2e2", color: "#dc2626", border: "#ef4444" },
    "High": { bg: "#fef3c7", color: "#d97706", border: "#f59e0b" },
    "Medium": { bg: "#dbeafe", color: "#2563eb", border: "#3b82f6" },
    "Low": { bg: "#f1f5f9", color: "#64748b", border: "#94a3b8" },
    "Very Low": { bg: "#f1f5f9", color: "#94a3b8", border: "#cbd5e1" },
  };

  const levelConfig = levelColors[duplicate.level] || levelColors.Medium;

  return (
    <div style={{
      background: "#fff",
      border: `1px solid ${levelConfig.border}`,
      borderRadius: 8,
      padding: "12px 14px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* Confidence Score */}
        <div style={{
          width: 56, height: 56, borderRadius: "50%",
          background: levelConfig.bg,
          border: `2px solid ${levelConfig.border}`,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: levelConfig.color }}>
            {duplicate.score}%
          </span>
          <span style={{ fontSize: 8, fontWeight: 600, color: levelConfig.color, textTransform: "uppercase" }}>
            Match
          </span>
        </div>

        {/* Patient Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>
              #{rank} {duplicate.patient.name}
            </span>
            <span style={{
              padding: "2px 6px", borderRadius: 4, fontSize: 9, fontWeight: 600,
              background: levelConfig.bg, color: levelConfig.color, textTransform: "uppercase",
            }}>
              {duplicate.level}
            </span>
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>
            {duplicate.patient.id} · {duplicate.patient.phone} · {duplicate.patient.age} yrs
          </div>

          {/* Match Details */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {duplicate.matches.slice(0, 4).map(match => (
              <span key={match.field} style={{
                padding: "2px 6px", borderRadius: 4,
                fontSize: 9, fontWeight: 600,
                background: "#f1f5f9", color: "#64748b",
              }}>
                {match.field}
              </span>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <button
            onClick={onMerge}
            style={{
              padding: "6px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600,
              background: levelConfig.color, border: "none", color: "#fff",
              cursor: "pointer",
            }}
          >
            Review
          </button>
          <button
            onClick={onDismiss}
            style={{
              padding: "4px 8px", borderRadius: 6, fontSize: 10, fontWeight: 600,
              background: "transparent", border: "1px solid #d1d5db", color: "#64748b",
              cursor: "pointer",
            }}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

function findPotentialDuplicates(patient, allPatients, threshold) {
  // This would use the actual utility function
  // For now, return empty array
  return [];
}
