/**
 * Smart Views - Pre-configured intelligent views for common use cases
 * High Risk, Missing Documents, VIP, Follow-Up Due, New Patients
 */
export default function SmartViews({ patients, onViewSelect, currentView }) {
  const views = [
    {
      key: "all",
      label: "All Patients",
      icon: "ti-users",
      color: "#4f7cff",
      count: patients.length,
      description: "Complete patient list",
    },
    {
      key: "highRisk",
      label: "High Risk",
      icon: "ti-alert-triangle",
      color: "#ef4444",
      count: patients.filter(p => 
        (p.alerts || []).some(a => ["Allergy", "Heart Condition", "Pregnancy", "High Risk"].includes(a))
      ).length,
      description: "Patients with critical alerts",
    },
    {
      key: "missingDocs",
      label: "Missing Documents",
      icon: "ti-file-off",
      color: "#f59e0b",
      count: patients.filter(p => !p.documentsComplete).length,
      description: "Incomplete documentation",
    },
    {
      key: "missingConsent",
      label: "Missing Consent",
      icon: "ti-shield-x",
      color: "#ec4899",
      count: patients.filter(p => !p.consentSigned).length,
      description: "Consent not signed",
    },
    {
      key: "followUpDue",
      label: "Follow-Up Due",
      icon: "ti-clock",
      color: "#7c4fff",
      count: patients.filter(p => p.status === "Follow-Up Due" || (p.followUpDate && new Date(p.followUpDate) < new Date())).length,
      description: "Overdue or pending follow-ups",
    },
    {
      key: "vip",
      label: "VIP Patients",
      icon: "ti-crown",
      color: "#f97316",
      count: patients.filter(p => p.status === "VIP").length,
      description: "Priority patients",
    },
    {
      key: "newPatients",
      label: "New Patients",
      icon: "ti-user-plus",
      color: "#22c55e",
      count: patients.filter(p => p.status === "New").length,
      description: "Recently registered",
    },
    {
      key: "insuranceExpiring",
      label: "Insurance Expiring",
      icon: "ti-shield-exclamation",
      color: "#dc2626",
      count: patients.filter(p => p.insuranceStatus === "Expiring" || p.insuranceStatus === "Expired").length,
      description: "Insurance needs attention",
    },
  ];

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        marginBottom: 12,
      }}>
        <i className="ti ti-layout-grid" style={{ fontSize: 14, color: "var(--accent)" }} />
        <span style={{
          fontSize: 12, fontWeight: 700, color: "var(--text)",
          textTransform: "uppercase", letterSpacing: "0.06em",
        }}>
          Smart Views
        </span>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
        gap: 12,
      }}>
        {views.map(view => (
          <ViewCard
            key={view.key}
            view={view}
            isActive={currentView === view.key}
            onSelect={() => onViewSelect(view.key)}
          />
        ))}
      </div>
    </div>
  );
}

function ViewCard({ view, isActive, onSelect }) {
  return (
    <button
      onClick={onSelect}
      style={{
        padding: 16,
        borderRadius: 12,
        background: isActive ? view.color + "15" : "var(--surface)",
        border: isActive ? `2px solid ${view.color}` : "1px solid var(--border)",
        cursor: "pointer",
        textAlign: "left",
        transition: "all 0.15s ease",
        width: "100%",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <div style={{
          width: 36, height: 36, borderRadius: "50%",
          background: view.color + "20",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <i className={`ti ${view.icon}`} style={{ fontSize: 18, color: view.color }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
            {view.label}
          </div>
          <div style={{ fontSize: 10, color: "var(--muted)" }}>
            {view.description}
          </div>
        </div>
      </div>

      <div style={{
        fontSize: 24, fontWeight: 800, color: view.color,
        lineHeight: 1,
      }}>
        {view.count}
      </div>
    </button>
  );
}

/**
 * Apply smart view filter to patients
 */
export function applySmartView(viewKey, patients) {
  switch (viewKey) {
    case "all":
      return patients;
    case "highRisk":
      return patients.filter(p =>
        (p.alerts || []).some(a => ["Allergy", "Heart Condition", "Pregnancy", "High Risk"].includes(a))
      );
    case "missingDocs":
      return patients.filter(p => !p.documentsComplete);
    case "missingConsent":
      return patients.filter(p => !p.consentSigned);
    case "followUpDue":
      return patients.filter(p => 
        p.status === "Follow-Up Due" || 
        (p.followUpDate && new Date(p.followUpDate) < new Date())
      );
    case "vip":
      return patients.filter(p => p.status === "VIP");
    case "newPatients":
      return patients.filter(p => p.status === "New");
    case "insuranceExpiring":
      return patients.filter(p => p.insuranceStatus === "Expiring" || p.insuranceStatus === "Expired");
    default:
      return patients;
  }
}
