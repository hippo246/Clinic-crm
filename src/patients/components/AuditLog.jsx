import { fmtDate } from "../utils/patientUtils";

const ACTION_CONFIG = {
  created: { icon: "ti-user-plus",    color: "#4f7cff", label: "Created"  },
  edited:  { icon: "ti-edit",         color: "#f59e0b", label: "Edited"   },
  merged:  { icon: "ti-git-merge",    color: "#7c4fff", label: "Merged"   },
  deleted: { icon: "ti-trash",        color: "#ef4444", label: "Deleted"  },
  consent: { icon: "ti-writing",      color: "#22c55e", label: "Consent"  },
  viewed:  { icon: "ti-eye",          color: "#64748b", label: "Viewed"   },
  default: { icon: "ti-history",      color: "#64748b", label: "Action"   },
};

function ActionIcon({ action }) {
  const cfg = ACTION_CONFIG[action] || ACTION_CONFIG.default;
  return (
    <div style={{
      width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
      background: cfg.color + "18",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <i className={`ti ${cfg.icon}`} style={{ fontSize: 13, color: cfg.color }} />
    </div>
  );
}

export default function AuditLog({ auditEntries = [] }) {
  if (auditEntries.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center", padding: "32px 16px" }}>
        <div style={{
          width: 56, height: 56, borderRadius: "50%",
          background: "var(--accent-soft)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <i className="ti ti-history" style={{ fontSize: 26, color: "var(--accent)" }} />
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>No audit entries yet</div>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>
            Changes to this patient record will be tracked here.
          </div>
        </div>
      </div>
    );
  }

  // Sort newest first
  const sorted = [...auditEntries].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {sorted.map((entry) => {
        const cfg = ACTION_CONFIG[entry.action] || ACTION_CONFIG.default;
        return (
          <div key={entry.id} style={{
            display: "flex", gap: 10, padding: "10px 4px",
            borderBottom: "1px solid var(--border)",
            alignItems: "flex-start",
          }}>
            <ActionIcon action={entry.action} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{entry.label}</span>
                {entry.field && (
                  <span style={{
                    fontSize: 11, padding: "1px 6px", borderRadius: 4,
                    background: "var(--surface2)", border: "1px solid var(--border)",
                    fontFamily: "'DM Mono', monospace", color: "var(--muted)",
                  }}>
                    {entry.field}
                  </span>
                )}
              </div>
              {(entry.oldValue || entry.newValue) && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                  {entry.oldValue && (
                    <span style={{
                      fontSize: 11, padding: "1px 6px", borderRadius: 4,
                      background: "#fee2e2", color: "#991b1b",
                      maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {String(entry.oldValue)}
                    </span>
                  )}
                  {entry.oldValue && entry.newValue && (
                    <i className="ti ti-arrow-right" style={{ fontSize: 11, color: "var(--muted)", flexShrink: 0 }} />
                  )}
                  {entry.newValue && (
                    <span style={{
                      fontSize: 11, padding: "1px 6px", borderRadius: 4,
                      background: "#dcfce7", color: "#15803d",
                      maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {String(entry.newValue)}
                    </span>
                  )}
                </div>
              )}
              {entry.reason && (
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3, fontStyle: "italic" }}>
                  Reason: {entry.reason}
                </div>
              )}
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                {entry.user} · {fmtDate(entry.timestamp)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
