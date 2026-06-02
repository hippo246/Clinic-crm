import { useState } from "react";
import { getActionHistorySummary } from "../utils/workflowIntelligence";

/**
 * Action History Summary - Shows activity summary for the last 7 days
 * Instead of scrolling timeline, shows a compact summary
 */
export default function ActionHistorySummary({ auditEntries = [], days = 7 }) {
  const [expanded, setExpanded] = useState(false);
  const summary = getActionHistorySummary(auditEntries, days);

  if (summary.total === 0) {
    return null;
  }

  const actionIcons = {
    created: "ti-user-plus",
    updated: "ti-pencil",
    deleted: "ti-trash",
    status_change: "ti-arrows-exchange",
  };

  const actionColors = {
    created: "#22c55e",
    updated: "#4f7cff",
    deleted: "#ef4444",
    status_change: "#f59e0b",
  };

  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: 12, overflow: "hidden",
    }}>
      {/* Header */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          padding: "12px 16px", cursor: "pointer",
          background: expanded ? "var(--surface2)" : "transparent",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            background: "var(--accent-soft)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <i className="ti ti-history" style={{ fontSize: 14, color: "var(--accent)" }} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
              Last {days} Days
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>
              {summary.total} action{summary.total !== 1 ? "s" : ""}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Action type badges */}
          {Object.entries(summary.byType).slice(0, 3).map(([action, count]) => (
            <span key={action} style={{
              padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 600,
              background: (actionColors[action] || "#64748b") + "15",
              color: actionColors[action] || "#64748b",
            }}>
              {count} {action}
            </span>
          ))}
          <i className={`ti ti-chevron-${expanded ? "up" : "down"}`} style={{ fontSize: 12, color: "var(--muted)" }} />
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div style={{ padding: "0 16px 16px" }}>
          {/* By Type */}
          <div style={{ marginTop: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              By Action Type
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {Object.entries(summary.byType).map(([action, count]) => (
                <div key={action} style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "6px 10px", borderRadius: 8,
                  background: (actionColors[action] || "#64748b") + "10",
                  border: `1px solid ${(actionColors[action] || "#64748b")}30`,
                }}>
                  <i className={`ti ${actionIcons[action] || "ti-circle"}`} style={{ fontSize: 12, color: actionColors[action] || "#64748b" }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>
                    {count}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>
                    {action}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* By User */}
          {Object.keys(summary.byUser).length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                By Staff
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {Object.entries(summary.byUser).map(([user, count]) => (
                  <div key={user} style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "6px 10px", borderRadius: 8,
                    background: "var(--surface2)", border: "1px solid var(--border)",
                  }}>
                    <div style={{
                      width: 20, height: 20, borderRadius: "50%",
                      background: "var(--accent-soft)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 10, fontWeight: 700, color: "var(--accent)",
                    }}>
                      {user.charAt(0).toUpperCase()}
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>
                      {user}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Actions */}
          {summary.recent.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Recent Activity
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {summary.recent.slice(0, 5).map((entry) => (
                  <div key={entry.id} style={{
                    padding: "8px 10px", borderRadius: 6,
                    background: "var(--surface2)", border: "1px solid var(--border)",
                    display: "flex", alignItems: "center", gap: 8,
                  }}>
                    <i className={`ti ${actionIcons[entry.action] || "ti-circle"}`} style={{
                      fontSize: 11, color: actionColors[entry.action] || "#64748b",
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text)" }}>
                        {entry.label || entry.action}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>
                        {entry.user} · {entry.timeAgo}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
