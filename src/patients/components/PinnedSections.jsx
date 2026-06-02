import { useState } from "react";

/**
 * Pinned Sections - Allow users to pin important sections to top of profile
 * Sections: Notes, Documents, Alerts, Follow-Ups
 */
export default function PinnedSections({ patient, pinnedSections, onTogglePin, onEdit }) {
  const availableSections = [
    {
      key: "alerts",
      label: "Alerts",
      icon: "ti-alert-triangle",
      color: "#ef4444",
      count: (patient.alerts || []).length,
      priority: 1,
    },
    {
      key: "followUp",
      label: "Follow-Ups",
      icon: "ti-clock",
      color: "#f59e0b",
      count: patient.followUpDate ? 1 : 0,
      priority: 2,
    },
    {
      key: "notes",
      label: "Notes",
      icon: "ti-notes",
      color: "#7c4fff",
      count: (patient.notes || []).filter(n => n.pinned).length,
      priority: 3,
    },
    {
      key: "documents",
      label: "Documents",
      icon: "ti-files",
      color: "#4f7cff",
      count: (patient.documents || []).length,
      priority: 4,
    },
  ];

  const pinned = availableSections.filter(s => pinnedSections.includes(s.key))
    .sort((a, b) => a.priority - b.priority);

  if (pinned.length === 0) {
    return null;
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        marginBottom: 12,
      }}>
        <i className="ti ti-pin" style={{ fontSize: 14, color: "var(--accent)" }} />
        <span style={{
          fontSize: 12, fontWeight: 700, color: "var(--text)",
          textTransform: "uppercase", letterSpacing: "0.06em",
        }}>
          Pinned Sections
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {pinned.map(section => (
          <PinnedSectionCard
            key={section.key}
            section={section}
            patient={patient}
            onUnpin={() => onTogglePin(section.key)}
            onEdit={onEdit}
          />
        ))}
      </div>
    </div>
  );
}

function PinnedSectionCard({ section, patient, onUnpin, onEdit }) {
  const [expanded, setExpanded] = useState(true);

  const renderContent = () => {
    switch (section.key) {
      case "alerts":
        return (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {(patient.alerts || []).map(alert => (
              <span key={alert} style={{
                padding: "4px 10px", borderRadius: 6,
                fontSize: 11, fontWeight: 600,
                background: section.color + "20",
                color: section.color,
              }}>
                {alert}
              </span>
            ))}
          </div>
        );

      case "followUp":
        if (!patient.followUpDate) return <span style={{ fontSize: 11, color: "var(--muted)" }}>No follow-up scheduled</span>;
        return (
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>
              {patient.followUpReason || "Follow-up required"}
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>
              Due: {new Date(patient.followUpDate).toLocaleDateString("en-IN", {
                day: "numeric", month: "short", year: "numeric"
              })}
            </div>
          </div>
        );

      case "notes":
        const pinnedNotes = (patient.notes || []).filter(n => n.pinned);
        if (pinnedNotes.length === 0) return <span style={{ fontSize: 11, color: "var(--muted)" }}>No pinned notes</span>;
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {pinnedNotes.slice(0, 3).map(note => (
              <div key={note.id} style={{
                padding: 8, borderRadius: 6,
                background: "var(--surface2)", border: "1px solid var(--border)",
              }}>
                <div style={{ fontSize: 11, color: "var(--text)", lineHeight: 1.4 }}>
                  {note.text}
                </div>
              </div>
            ))}
          </div>
        );

      case "documents":
        const docs = patient.documents || [];
        if (docs.length === 0) return <span style={{ fontSize: 11, color: "var(--muted)" }}>No documents</span>;
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {docs.slice(0, 3).map(doc => (
              <div key={doc.id} style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: 6, borderRadius: 6,
                background: "var(--surface2)",
              }}>
                <i className="ti ti-file" style={{ fontSize: 12, color: section.color }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 11, fontWeight: 500, color: "var(--text)",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>
                    {doc.type}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--muted)" }}>
                    {doc.size}
                  </div>
                </div>
              </div>
            ))}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 10,
      overflow: "hidden",
    }}>
      {/* Header */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          padding: "10px 14px",
          background: "var(--surface2)",
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            background: section.color + "20",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <i className={`ti ${section.icon}`} style={{ fontSize: 13, color: section.color }} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>
              {section.label}
            </div>
            <div style={{ fontSize: 10, color: "var(--muted)" }}>
              {section.count} item{section.count !== 1 ? "s" : ""}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            style={{
              padding: "4px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600,
              background: "transparent", border: "1px solid var(--border)",
              color: "var(--muted)", cursor: "pointer",
            }}
          >
            <i className="ti ti-pencil" style={{ fontSize: 11 }} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onUnpin(); }}
            style={{
              padding: "4px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600,
              background: "transparent", border: "1px solid var(--border)",
              color: "var(--muted)", cursor: "pointer",
            }}
          >
            <i className="ti ti-pin-off" style={{ fontSize: 11 }} />
          </button>
          <i className={`ti ti-chevron-${expanded ? "up" : "down"}`} style={{ fontSize: 12, color: "var(--muted)" }} />
        </div>
      </div>

      {/* Content */}
      {expanded && (
        <div style={{ padding: "12px 14px" }}>
          {renderContent()}
        </div>
      )}
    </div>
  );
}

/**
 * Section Pin Menu - Allow users to pin sections
 */
export function SectionPinMenu({ availableSections, pinnedSections, onTogglePin, onClose }) {
  return (
    <div style={{
      position: "absolute",
      right: 0,
      top: "100%",
      marginTop: 8,
      width: 200,
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 8,
      boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
      zIndex: 1000,
      padding: 8,
    }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color: "var(--muted)",
        marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em",
      }}>
        Pin to Top
      </div>
      {availableSections.map(section => (
        <button
          key={section.key}
          onClick={() => { onTogglePin(section.key); onClose(); }}
          style={{
            width: "100%",
            padding: "8px 10px",
            borderRadius: 6,
            fontSize: 11, fontWeight: 500,
            background: pinnedSections.includes(section.key) ? section.color + "15" : "transparent",
            border: pinnedSections.includes(section.key) ? `1px solid ${section.color}30` : "none",
            color: "var(--text)",
            cursor: "pointer",
            display: "flex", alignItems: "center", gap: 8,
            marginBottom: 4,
          }}
        >
          <i className={`ti ${section.icon}`} style={{ fontSize: 12, color: section.color }} />
          <span style={{ flex: 1 }}>{section.label}</span>
          {pinnedSections.includes(section.key) && (
            <i className="ti ti-check" style={{ fontSize: 12, color: section.color }} />
          )}
        </button>
      ))}
    </div>
  );
}
