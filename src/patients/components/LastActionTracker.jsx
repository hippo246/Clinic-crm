import { getLastAction } from "../utils/workflowIntelligence";

/**
 * Last Action Tracker - Shows who last edited the patient and what changed
 * Displays without needing to open audit logs
 */
export default function LastActionTracker({ auditEntries = [] }) {
  const lastAction = getLastAction(auditEntries);

  if (!lastAction) {
    return (
      <div style={{
        padding: "8px 12px", borderRadius: 8,
        background: "var(--surface2)", border: "1px solid var(--border)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <i className="ti ti-history" style={{ fontSize: 12, color: "var(--muted)" }} />
          <span style={{ fontSize: 11, color: "var(--muted)" }}>
            No recent activity
          </span>
        </div>
      </div>
    );
  }

  const actionColors = {
    created: { bg: "#dcfce7", color: "#15803d", icon: "ti-user-plus" },
    updated: { bg: "#dbeafe", color: "#1e40af", icon: "ti-pencil" },
    deleted: { bg: "#fee2e2", color: "#991b1b", icon: "ti-trash" },
    status_change: { bg: "#fef3c7", color: "#92400e", icon: "ti-arrows-exchange" },
  };

  const actionConfig = actionColors[lastAction.action] || actionColors.updated;

  return (
    <div style={{
      padding: "10px 14px", borderRadius: 8,
      background: actionConfig.bg, border: `1px solid ${actionConfig.color}30`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{
          width: 28, height: 28, borderRadius: "50%",
          background: actionConfig.color + "20",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <i className={`ti ${actionConfig.icon}`} style={{ fontSize: 13, color: actionConfig.color }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: actionConfig.color }}>
              {lastAction.label || lastAction.action}
            </span>
            {lastAction.field && (
              <span style={{ fontSize: 11, color: "var(--muted)" }}>
                · {lastAction.field}
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>
              by <strong>{lastAction.user}</strong>
            </span>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>·</span>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>{lastAction.timeAgo}</span>
          </div>
        </div>
      </div>

      {/* Show value change if available */}
      {lastAction.oldValue !== null && lastAction.newValue !== null && (
        <div style={{
          marginTop: 8, paddingTop: 8, borderTop: `1px solid ${actionConfig.color}20`,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span style={{
            fontSize: 11, color: "var(--muted)",
            background: actionConfig.color + "10", padding: "2px 6px", borderRadius: 4,
          }}>
            {String(lastAction.oldValue)}
          </span>
          <i className="ti ti-arrow-right" style={{ fontSize: 10, color: actionConfig.color }} />
          <span style={{
            fontSize: 11, fontWeight: 500, color: actionConfig.color,
            background: actionConfig.color + "15", padding: "2px 6px", borderRadius: 4,
          }}>
            {String(lastAction.newValue)}
          </span>
        </div>
      )}
    </div>
  );
}
