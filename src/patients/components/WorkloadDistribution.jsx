/**
 * Workload Distribution - Show patient assignment across staff
 * Sarah: 147 patients, Ahmed: 83 patients
 * Helps management balance workload
 */
export default function WorkloadDistribution({ patients, staff }) {
  const distribution = calculateWorkload(patients, staff);

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
          width: 32, height: 32, borderRadius: "50%",
          background: "#f59e0b20",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <i className="ti ti-chart-pie" style={{ fontSize: 16, color: "#f59e0b" }} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
            Workload Distribution
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>
            Patient assignments across staff
          </div>
        </div>
      </div>

      {/* Distribution Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: 16,
      }}>
        {distribution.map((staffMember, idx) => (
          <StaffWorkloadCard
            key={idx}
            staff={staffMember}
            maxPatients={Math.max(...distribution.map(s => s.patientCount))}
          />
        ))}
      </div>

      {/* Summary */}
      <div style={{
        marginTop: 20, padding: 12, borderRadius: 8,
        background: "#f0fdf4", border: "1px solid #22c55e30",
      }}>
        <div style={{ fontSize: 11, color: "#166534" }}>
          <i className="ti ti-info-circle" style={{ fontSize: 12, marginRight: 6 }} />
          Total patients: {patients.length} · Average per staff: {Math.round(patients.length / staff.length)}
        </div>
      </div>
    </div>
  );
}

function StaffWorkloadCard({ staff, maxPatients }) {
  const percentage = maxPatients > 0 ? (staff.patientCount / maxPatients) * 100 : 0;
  const utilizationLevel = percentage > 80 ? "high" : percentage > 60 ? "medium" : "low";
  
  const levelColors = {
    high: { bg: "#fee2e2", color: "#dc2626", label: "High Load" },
    medium: { bg: "#fef3c7", color: "#d97706", label: "Moderate" },
    low: { bg: "#dcfce7", color: "#15803d", label: "Normal" },
  };

  const levelConfig = levelColors[utilizationLevel];

  return (
    <div style={{
      padding: 16, borderRadius: 8,
      background: "var(--surface2"), border: "1px solid var(--border)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: "50%",
          background: getAvatarColor(staff.name),
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14, fontWeight: 700, color: "#fff",
        }}>
          {getInitials(staff.name)}
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
            {staff.name}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>
            {staff.role}
          </div>
        </div>
      </div>

      <div style={{ fontSize: 28, fontWeight: 800, color: "var(--text)", marginBottom: 8 }}>
        {staff.patientCount}
      </div>

      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 12 }}>
        patients assigned
      </div>

      {/* Progress Bar */}
      <div style={{ marginBottom: 8 }}>
        <div style={{
          height: 6, borderRadius: 3,
          background: "var(--border",
          overflow: "hidden",
        }}>
          <div
            style={{
              height: "100%",
              width: `${percentage}%`,
              background: levelConfig.color,
              transition: "width 0.3s ease",
            }}
          />
        </div>
      </div>

      <div style={{
        padding: "4px 8px", borderRadius: 4,
        background: levelConfig.bg, color: levelConfig.color,
        fontSize: 10, fontWeight: 600, display: "inline-block",
      }}>
        {levelConfig.label}
      </div>
    </div>
  );
}

/**
 * Calculate workload distribution
 */
function calculateWorkload(patients, staff) {
  const distribution = staff.map(person => ({
    name: person.name,
    role: person.role,
    patientCount: 0,
    highRiskCount: 0,
    followUpCount: 0,
  }));

  patients.forEach(patient => {
    const assignedStaff = distribution.find(s => s.name === patient.doctor);
    if (assignedStaff) {
      assignedStaff.patientCount++;
      
      const criticalAlerts = (patient.alerts || []).filter(a =>
        ["Allergy", "Heart Condition", "Pregnancy", "High Risk"].includes(a)
      );
      if (criticalAlerts.length > 0) {
        assignedStaff.highRiskCount++;
      }
      
      if (patient.status === "Follow-Up Due" || (patient.followUpDate && new Date(patient.followUpDate) < new Date())) {
        assignedStaff.followUpCount++;
      }
    }
  });

  return distribution.sort((a, b) => b.patientCount - a.patientCount);
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
