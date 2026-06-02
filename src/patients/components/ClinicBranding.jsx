/**
 * Clinic Branding Layer - Patient profiles show clinic branding
 * Department colors, branch colors
 * Useful when multi-branch comes later
 */
export default function ClinicBranding({ branding }) {
  return (
    <div style={{
      padding: "16px 20px",
      background: branding.primaryColor + "10",
      borderLeft: `4px solid ${branding.primaryColor}`,
      marginBottom: 20,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {branding.logo && (
          <div style={{
            width: 48, height: 48, borderRadius: 8,
            background: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          }}>
            <img src={branding.logo} alt="Clinic Logo" style={{ width: 40, height: 40, objectFit: "contain" }} />
          </div>
        )}

        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: branding.primaryColor }}>
            {branding.clinicName}
          </div>
          <div style={{ fontSize: 12, color: branding.secondaryColor || "var(--muted)" }}>
            {branding.branchName && `${branding.branchName} · `}
            {branding.department && `${branding.department} Department`}
          </div>
        </div>

        {branding.badge && (
          <div style={{
            padding: "6px 12px", borderRadius: 20,
            background: branding.accentColor || branding.primaryColor,
            color: "#fff",
            fontSize: 11, fontWeight: 600,
          }}>
            {branding.badge}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Get branding configuration
 */
export function getClinicBranding(clinicId) {
  const brandingConfigs = {
    default: {
      clinicName: "ClinicOS",
      branchName: null,
      department: null,
      primaryColor: "#4f7cff",
      secondaryColor: "#64748b",
      accentColor: "#7c4fff",
      logo: null,
      badge: null,
    },
    cardiology: {
      clinicName: "Heart Care Clinic",
      branchName: "Main Branch",
      department: "Cardiology",
      primaryColor: "#ef4444",
      secondaryColor: "#dc2626",
      accentColor: "#f97316",
      logo: null,
      badge: "Heart Specialist",
    },
    pediatrics: {
      clinicName: "Kids Health Center",
      branchName: "Downtown",
      department: "Pediatrics",
      primaryColor: "#22c55e",
      secondaryColor: "#16a34a",
      accentColor: "#4ade80",
      logo: null,
      badge: "Child Care",
    },
    orthopedics: {
      clinicName: "Bone & Joint Clinic",
      branchName: "West Wing",
      department: "Orthopedics",
      primaryColor: "#3b82f6",
      secondaryColor: "#2563eb",
      accentColor: "#60a5fa",
      logo: null,
      badge: "Orthopedic Care",
    },
  };

  return brandingConfigs[clinicId] || brandingConfigs.default;
}

/**
 * Department color themes
 */
export const DEPARTMENT_THEMES = {
  general: { primary: "#4f7cff", secondary: "#64748b", accent: "#7c4fff" },
  cardiology: { primary: "#ef4444", secondary: "#dc2626", accent: "#f97316" },
  pediatrics: { primary: "#22c55e", secondary: "#16a34a", accent: "#4ade80" },
  orthopedics: { primary: "#3b82f6", secondary: "#2563eb", accent: "#60a5fa" },
  neurology: { primary: "#8b5cf6", secondary: "#7c3aed", accent: "#a78bfa" },
  dermatology: { primary: "#ec4899", secondary: "#db2777", accent: "#f472b6" },
  oncology: { primary: "#f59e0b", secondary: "#d97706", accent: "#fbbf24" },
  emergency: { primary: "#dc2626", secondary: "#b91c1c", accent: "#ef4444" },
};
