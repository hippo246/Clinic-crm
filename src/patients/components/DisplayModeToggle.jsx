/**
 * Display Mode Toggle - Switch between Standard, Compact, and Reading modes
 * Different layouts for different user roles and preferences
 */
export default function DisplayModeToggle({ mode, onModeChange }) {
  const modes = [
    {
      key: "standard",
      label: "Standard",
      icon: "ti-layout-grid",
      description: "Balanced layout for general use",
    },
    {
      key: "compact",
      label: "Compact",
      icon: "ti-layout-list",
      description: "Dense data for receptionists",
    },
    {
      key: "reading",
      label: "Reading",
      icon: "ti-book",
      description: "Clean view for doctors",
    },
  ];

  return (
    <div style={{
      display: "flex", gap: 4,
      background: "var(--surface2)",
      padding: 4, borderRadius: 8,
      border: "1px solid var(--border)",
    }}>
      {modes.map((m) => (
        <button
          key={m.key}
          onClick={() => onModeChange(m.key)}
          title={m.description}
          style={{
            padding: "6px 12px",
            borderRadius: 6,
            fontSize: 11, fontWeight: 600,
            background: mode === m.key ? "var(--surface)" : "transparent",
            border: mode === m.key ? "1px solid var(--border)" : "none",
            color: mode === m.key ? "var(--text)" : "var(--muted)",
            cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6,
            transition: "all 0.15s ease",
          }}
        >
          <i className={`ti ${m.icon}`} style={{ fontSize: 14 }} />
          <span className="desktop-only">{m.label}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * Get display mode configuration
 */
export function getDisplayModeConfig(mode) {
  const configs = {
    standard: {
      cardPadding: "16px",
      cardGap: 16,
      fontSize: "normal",
      showAllSections: true,
      dense: false,
      minimal: false,
    },
    compact: {
      cardPadding: "10px",
      cardGap: 10,
      fontSize: "small",
      showAllSections: true,
      dense: true,
      minimal: false,
    },
    reading: {
      cardPadding: "16px",
      cardGap: 16,
      fontSize: "normal",
      showAllSections: false,
      dense: false,
      minimal: true,
    },
  };

  return configs[mode] || configs.standard;
}
