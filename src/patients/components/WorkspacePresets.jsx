/**
 * Workspace Presets - Role-based UI layouts
 * Reception Layout, Doctor Layout, Admin Layout with different arrangements
 */
export default function WorkspacePresets({ currentPreset, onPresetChange }) {
  const presets = [
    {
      key: "reception",
      label: "Reception",
      icon: "ti-phone-call",
      color: "#22c55e",
      description: "Patient registration, contact info, documents, follow-ups",
      sections: ["search", "registration", "contact", "documents", "followUp"],
    },
    {
      key: "doctor",
      label: "Doctor",
      icon: "ti-stethoscope",
      color: "#7c4fff",
      description: "Alerts, notes, timeline, medical history",
      sections: ["alerts", "notes", "timeline", "conditions", "medications"],
    },
    {
      key: "admin",
      label: "Admin",
      icon: "ti-shield",
      color: "#f59e0b",
      description: "Full access to all sections and controls",
      sections: ["*"],
    },
  ];

  return (
    <div style={{
      display: "flex", gap: 8,
      background: "var(--surface2)",
      padding: 6, borderRadius: 10,
      border: "1px solid var(--border)",
      marginBottom: 16,
    }}>
      {presets.map(preset => (
        <button
          key={preset.key}
          onClick={() => onPresetChange(preset.key)}
          title={preset.description}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            fontSize: 12, fontWeight: 600,
            background: currentPreset === preset.key ? preset.color + "20" : "transparent",
            border: currentPreset === preset.key ? `1px solid ${preset.color}` : "none",
            color: currentPreset === preset.key ? preset.color : "var(--muted)",
            cursor: "pointer",
            display: "flex", alignItems: "center", gap: 8,
            transition: "all 0.15s ease",
          }}
        >
          <i className={`ti ${preset.icon}`} style={{ fontSize: 14 }} />
          <span>{preset.label}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * Get visible sections based on workspace preset
 */
export function getVisibleSections(presetKey) {
  const sectionConfigs = {
    reception: {
      visible: ["alerts", "contact", "documents", "followUp", "tasks"],
      hidden: ["timeline", "audit", "dataQuality"],
      priority: ["alerts", "contact", "documents"],
    },
    doctor: {
      visible: ["alerts", "notes", "timeline", "conditions", "medications"],
      hidden: ["registration", "billing", "audit"],
      priority: ["alerts", "notes", "timeline"],
    },
    admin: {
      visible: ["*"],
      hidden: [],
      priority: ["alerts", "dataQuality", "audit"],
    },
  };

  return sectionConfigs[presetKey] || sectionConfigs.reception;
}

/**
 * Check if a section should be visible in current preset
 */
export function isSectionVisible(sectionKey, presetKey) {
  const config = getVisibleSections(presetKey);
  
  if (config.visible.includes("*")) return true;
  return config.visible.includes(sectionKey);
}

/**
 * Get section priority for ordering
 */
export function getSectionPriority(sectionKey, presetKey) {
  const config = getVisibleSections(presetKey);
  const priority = config.priority.indexOf(sectionKey);
  return priority === -1 ? 999 : priority;
}
