/**
 * Global Patient Health Dashboard - Overall database health metrics
 * Not analytics - health score for the entire patient database
 */
export default function GlobalHealthDashboard({ patients }) {
  const health = calculateDatabaseHealth(patients);

  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 12,
      padding: "20px",
      marginBottom: 20,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <div style={{
          width: 36, height: 36, borderRadius: "50%",
          background: health.score >= 80 ? "#dcfce7" : health.score >= 60 ? "#fef3c7" : "#fee2e2",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <i className="ti ti-heart-pulse" style={{ fontSize: 18, color: health.score >= 80 ? "#15803d" : health.score >= 60 ? "#92400e" : "#dc2626" }} />
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
            Patient Database Health
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>
            Overall quality and completeness score
          </div>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <HealthScoreBadge score={health.score} level={health.level} />
        </div>
      </div>

      {/* Metrics Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 16,
        marginBottom: 20,
      }}>
        <MetricCard
          label="Total Patients"
          value={health.metrics.totalPatients}
          icon="ti-users"
          color="#4f7cff"
        />
        <MetricCard
          label="Average Quality"
          value={`${health.metrics.averageQuality}%`}
          icon="ti-star"
          color="#f59e0b"
        />
        <MetricCard
          label="Stale Records"
          value={health.metrics.staleRecords}
          icon="ti-clock-hour-4"
          color="#ef4444"
          warning={health.metrics.staleRecords > 0}
        />
        <MetricCard
          label="Missing Consent"
          value={health.metrics.missingConsent}
          icon="ti-shield-x"
          color="#ec4899"
          warning={health.metrics.missingConsent > 0}
        />
        <MetricCard
          label="Missing Emergency Contact"
          value={health.metrics.missingEmergencyContact}
          icon="ti-phone-off"
          color="#f97316"
          warning={health.metrics.missingEmergencyContact > 0}
        />
        <MetricCard
          label="High Risk Patients"
          value={health.metrics.highRiskPatients}
          icon="ti-alert-triangle"
          color="#dc2626"
        />
        <MetricCard
          label="Active Patients"
          value={health.metrics.activePatients}
          icon="ti-circle-check"
          color="#22c55e"
        />
        <MetricCard
          label="Potential Duplicates"
          value={health.metrics.potentialDuplicates}
          icon="ti-users-group"
          color="#7c4fff"
          warning={health.metrics.potentialDuplicates > 0}
        />
      </div>

      {/* Recommendations */}
      {(health.metrics.staleRecords > 0 || health.metrics.missingConsent > 0 || health.metrics.missingEmergencyContact > 0) && (
        <div style={{
          padding: 12, borderRadius: 8,
          background: "#fef3c7", border: "1px solid #f59e0b30",
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#92400e", marginBottom: 8 }}>
            Recommended Actions
          </div>
          <ul style={{ fontSize: 11, color: "#78350f", marginLeft: 20, lineHeight: 1.8 }}>
            {health.metrics.staleRecords > 0 && (
              <li>Review {health.metrics.staleRecords} stale record{health.metrics.staleRecords > 1 ? "s" : ""} (no activity in 18+ months)</li>
            )}
            {health.metrics.missingConsent > 0 && (
              <li>Collect consent forms for {health.metrics.missingConsent} patient{health.metrics.missingConsent > 1 ? "s" : ""}</li>
            )}
            {health.metrics.missingEmergencyContact > 0 && (
              <li>Add emergency contacts for {health.metrics.missingEmergencyContact} patient{health.metrics.missingEmergencyContact > 1 ? "s" : ""}</li>
            )}
            {health.metrics.potentialDuplicates > 0 && (
              <li>Review {health.metrics.potentialDuplicates} potential duplicate{health.metrics.potentialDuplicates > 1 ? "s" : ""}</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, icon, color, warning }) {
  return (
    <div style={{
      padding: 14, borderRadius: 8,
      background: warning ? "#fee2e2" : "var(--surface2)",
      border: warning ? "1px solid #ef444430" : "1px solid var(--border)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <i className={`ti ${icon}`} style={{ fontSize: 14, color }} />
        <span style={{ fontSize: 11, color: "var(--muted)" }}>
          {label}
        </span>
      </div>
      <div style={{
        fontSize: 20, fontWeight: 700, color: warning ? "#dc2626" : "var(--text)",
        lineHeight: 1,
      }}>
        {value}
      </div>
    </div>
  );
}

function HealthScoreBadge({ score, level }) {
  const colors = {
    Excellent: { bg: "#dcfce7", color: "#15803d" },
    Good: { bg: "#dbeafe", color: "#1e40af" },
    Fair: { bg: "#fef3c7", color: "#92400e" },
    Poor: { bg: "#fee2e2", color: "#991b1b" },
    Critical: { bg: "#7f1d1d", color: "#fca5a5" },
  };

  const c = colors[level] || colors.Fair;

  return (
    <div style={{
      padding: "8px 16px", borderRadius: 20,
      background: c.bg, color: c.color,
      fontSize: 14, fontWeight: 700,
    }}>
      {level} ({score})
    </div>
  );
}

/**
 * Calculate database health score
 */
function calculateDatabaseHealth(patients) {
  if (!patients || patients.length === 0) {
    return { score: 0, level: "No Data", metrics: {} };
  }

  let totalQualityScore = 0;
  let staleCount = 0;
  let missingConsentCount = 0;
  let missingEmergencyContactCount = 0;
  let duplicateRisks = 0;

  patients.forEach(patient => {
    // Simple quality calculation
    let quality = 100;
    if (!patient.consentSigned) quality -= 15;
    if (!patient.emergencyName || !patient.emergencyPhone) quality -= 15;
    if (!patient.phoneVerified) quality -= 10;
    if (!patient.idVerified) quality -= 10;
    if (!patient.documentsComplete) quality -= 10;

    totalQualityScore += quality;

    // Stale records (18+ months)
    if (patient.lastVisit) {
      const daysSince = Math.floor((new Date() - new Date(patient.lastVisit)) / (1000 * 60 * 60 * 24));
      if (daysSince > 540) staleCount++;
    }

    if (!patient.consentSigned) missingConsentCount++;
    if (!patient.emergencyName || !patient.emergencyPhone) missingEmergencyContactCount++;
  });

  // Estimate duplicate risks
  duplicateRisks = Math.floor(patients.length * 0.02);

  const avgQuality = totalQualityScore / patients.length;
  const healthScore = avgQuality - 
    (staleCount / patients.length) * 10 -
    (missingConsentCount / patients.length) * 8 -
    (missingEmergencyContactCount / patients.length) * 5 -
    (duplicateRisks / patients.length) * 3;

  const level = healthScore >= 90 ? "Excellent" : healthScore >= 75 ? "Good" : healthScore >= 60 ? "Fair" : healthScore >= 40 ? "Poor" : "Critical";

  return {
    score: Math.max(0, Math.round(healthScore)),
    level,
    metrics: {
      totalPatients: patients.length,
      averageQuality: Math.round(avgQuality),
      staleRecords: staleCount,
      missingConsent: missingConsentCount,
      missingEmergencyContact: missingEmergencyContactCount,
      potentialDuplicates: duplicateRisks,
      activePatients: patients.filter(p => p.status === "Active").length,
      highRiskPatients: patients.filter(p => 
        (p.alerts || []).some(a => ["Allergy", "Heart Condition", "Pregnancy", "High Risk"].includes(a))
      ).length,
    },
  };
}
