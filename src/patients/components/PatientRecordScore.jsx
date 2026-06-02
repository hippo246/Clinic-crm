/**
 * Patient Record Score - Overall quality score
 * Not completion, not risk - overall quality
 * Factors: Complete data, Verified data, No duplicates, Documents present
 */
export default function PatientRecordScore({ patient }) {
  const score = calculateRecordScore(patient);

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
          background: score.level === "Excellent" ? "#dcfce7" : score.level === "Good" ? "#dbeafe" : score.level === "Fair" ? "#fef3c7" : "#fee2e2",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <i className="ti ti-star" style={{ fontSize: 16, color: score.level === "Excellent" ? "#15803d" : score.level === "Good" ? "#1e40af" : score.level === "Fair" ? "#92400e" : "#991b1b" }} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
            Patient Record Quality
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>
            Overall data quality and completeness
          </div>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <ScoreBadge score={score.score} level={score.level} />
        </div>
      </div>

      {/* Score Breakdown */}
      <div style={{ marginBottom: 16 }}>
        <div style={{
          height: 8, borderRadius: 4,
          background: "var(--surface2)",
          overflow: "hidden",
          marginBottom: 8,
        }}>
          <div
            style={{
              height: "100%",
              width: `${score.score}%`,
              background: score.level === "Excellent" ? "#22c55e" : score.level === "Good" ? "#3b82f6" : score.level === "Fair" ? "#f59e0b" : "#ef4444",
              transition: "width 0.3s ease",
            }}
          />
        </div>
      </div>

      {/* Factors */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        <FactorItem
          label="Complete Data"
          value={score.factors.completeData}
          icon="ti-checkbox"
          color="#22c55e"
        />
        <FactorItem
          label="Verified Data"
          value={score.factors.verifiedData}
          icon="ti-shield-check"
          color="#3b82f6"
        />
        <FactorItem
          label="Documents"
          value={score.factors.documents}
          icon="ti-files"
          color="#7c4fff"
        />
        <FactorItem
          label="No Duplicates"
          value={score.factors.noDuplicates}
          icon="ti-users"
          color="#f59e0b"
        />
      </div>

      {/* Recommendations */}
      {score.recommendations.length > 0 && (
        <div style={{
          marginTop: 16, padding: 12, borderRadius: 8,
          background: score.score >= 80 ? "#f0fdf4" : score.score >= 60 ? "#fef3c7" : "#fee2e2",
          border: score.score >= 80 ? "1px solid #22c55e30" : score.score >= 60 ? "1px solid #f59e0b30" : "1px solid #ef444430",
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, color: score.score >= 80 ? "#166534" : score.score >= 60 ? "#92400e" : "#991b1b" }}>
            Recommendations
          </div>
          <ul style={{ fontSize: 11, color: score.score >= 80 ? "#166534" : score.score >= 60 ? "#78350f" : "#7f1d1d", marginLeft: 20, lineHeight: 1.8 }}>
            {score.recommendations.map((rec, idx) => (
              <li key={idx}>{rec}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function FactorItem({ label, value, icon, color }) {
  return (
    <div style={{
      padding: 10, borderRadius: 6,
      background: "var(--surface2)", border: "1px solid var(--border)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <i className={`ti ${icon}`} style={{ fontSize: 12, color }} />
        <span style={{ fontSize: 10, color: "var(--muted)" }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color }}>
        {value}%
      </div>
    </div>
  );
}

function ScoreBadge({ score, level }) {
  const colors = {
    Excellent: { bg: "#dcfce7", color: "#15803d" },
    Good: { bg: "#dbeafe", color: "#1e40af" },
    Fair: { bg: "#fef3c7", color: "#92400e" },
    Poor: { bg: "#fee2e2", color: "#991b1b" },
  };

  const c = colors[level] || colors.Fair;

  return (
    <div style={{
      padding: "6px 14px", borderRadius: 20,
      background: c.bg, color: c.color,
      fontSize: 14, fontWeight: 700,
    }}>
      {level} ({score})
    </div>
  );
}

/**
 * Calculate patient record score
 */
function calculateRecordScore(patient) {
  let score = 100;
  const factors = {
    completeData: 0,
    verifiedData: 0,
    documents: 0,
    noDuplicates: 100, // Would need duplicate check
  };
  const recommendations = [];

  // Complete Data (40 points)
  const requiredFields = ["phone", "email", "dob", "gender", "address", "bloodGroup", "emergencyName", "emergencyPhone"];
  const presentFields = requiredFields.filter(field => {
    if (field === "emergencyName") return patient.emergencyName;
    if (field === "emergencyPhone") return patient.emergencyPhone;
    return patient[field];
  }).length;

  factors.completeData = Math.round((presentFields / requiredFields.length) * 100);
  score -= (40 - (presentFields / requiredFields.length) * 40);

  if (factors.completeData < 100) {
    recommendations.push(`Complete missing fields: ${requiredFields.filter(f => {
      if (f === "emergencyName") return !patient.emergencyName;
      if (f === "emergencyPhone") return !patient.emergencyPhone;
      return !patient[f];
    }).join(", ")}`);
  }

  // Verified Data (30 points)
  const verifications = ["phoneVerified", "idVerified", "consentSigned", "insuranceVerified"];
  const verifiedCount = verifications.filter(v => patient[v]).length;
  factors.verifiedData = Math.round((verifiedCount / verifications.length) * 100);
  score -= (30 - (verifiedCount / verifications.length) * 30);

  if (factors.verifiedData < 100) {
    const missingVerifications = verifications.filter(v => !patient[v]).map(v => v.replace("Verified", "").replace("Signed", ""));
    recommendations.push(`Complete verifications: ${missingVerifications.join(", ")}`);
  }

  // Documents (20 points)
  factors.documents = patient.documentsComplete ? 100 : 0;
  if (!patient.documentsComplete) {
    score -= 20;
    recommendations.push("Upload required documents");
  }

  // No Duplicates (10 points) - Placeholder
  // In real implementation, this would check against database
  factors.noDuplicates = 100;

  const level = score >= 90 ? "Excellent" : score >= 75 ? "Good" : score >= 60 ? "Fair" : "Poor";

  return {
    score: Math.max(0, Math.round(score)),
    level,
    factors,
    recommendations,
  };
}
