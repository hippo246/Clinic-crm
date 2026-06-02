import { useState } from "react";
import { getPendingTasks, getTaskStats, completeTask } from "../utils/workflowIntelligence";

/**
 * Pending Tasks Widget - Shows pending tasks for a patient
 * Acts like a mini to-do list for each patient
 */
export default function PendingTasksWidget({ patient, onTaskComplete, onEdit }) {
  const [expanded, setExpanded] = useState(false);
  const tasks = getPendingTasks(patient);
  const stats = getTaskStats(patient);

  if (tasks.length === 0) {
    return (
      <div style={{
        padding: "12px 16px", borderRadius: 8,
        background: "#dcfce7", border: "1px solid #22c55e30",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <i className="ti ti-circle-check" style={{ fontSize: 14, color: "#15803d" }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: "#15803d" }}>
          All tasks completed
        </span>
      </div>
    );
  }

  const priorityConfig = {
    critical: { bg: "#fee2e2", color: "#dc2626", icon: "ti-urgent", label: "Critical" },
    high: { bg: "#fef3c7", color: "#d97706", icon: "ti-alert-triangle", label: "High" },
    medium: { bg: "#dbeafe", color: "#2563eb", icon: "ti-info-circle", label: "Medium" },
    low: { bg: "#f1f5f9", color: "#64748b", icon: "ti-circle", label: "Low" },
  };

  const categoryConfig = {
    documents: { icon: "ti-files", color: "#4f7cff" },
    contact: { icon: "ti-phone-call", color: "#22c55e" },
    insurance: { icon: "ti-shield", color: "#f59e0b" },
    followup: { icon: "ti-clock", color: "#ec4899" },
    medical: { icon: "ti-heart-pulse", color: "#ef4444" },
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
            background: stats.critical > 0 ? "#ef4444" : stats.high > 0 ? "#f59e0b" : "#4f7cff",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <i className="ti ti-list-check" style={{ fontSize: 14, color: "#fff" }} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
              Pending Tasks
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>
              {stats.total} task{stats.total !== 1 ? "s" : ""} · {stats.critical > 0 ? `${stats.critical} critical` : stats.high > 0 ? `${stats.high} high priority` : "routine"}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Category badges */}
          {stats.byCategory.documents > 0 && (
            <span style={{
              padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 600,
              background: "#4f7cff15", color: "#4f7cff",
            }}>
              {stats.byCategory.documents} docs
            </span>
          )}
          {stats.byCategory.followup > 0 && (
            <span style={{
              padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 600,
              background: "#ec489915", color: "#ec4899",
            }}>
              {stats.byCategory.followup} follow-up
            </span>
          )}
          <i className={`ti ti-chevron-${expanded ? "up" : "down"}`} style={{ fontSize: 12, color: "var(--muted)" }} />
        </div>
      </div>

      {/* Task List */}
      {expanded && (
        <div style={{ padding: "0 16px 16px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
            {tasks.slice(0, 5).map((task) => {
              const pConfig = priorityConfig[task.priority];
              const cConfig = categoryConfig[task.category];

              return (
                <div
                  key={task.id}
                  style={{
                    padding: "10px 12px", borderRadius: 8,
                    background: pConfig.bg, border: `1px solid ${pConfig.color}30`,
                    display: "flex", alignItems: "flex-start", gap: 10,
                  }}
                >
                  <div style={{
                    width: 24, height: 24, borderRadius: "50%",
                    background: pConfig.color + "20",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0, marginTop: 1,
                  }}>
                    <i className={`ti ${cConfig.icon}`} style={{ fontSize: 11, color: cConfig.color }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>
                        {task.title}
                      </span>
                      <span style={{
                        padding: "1px 6px", borderRadius: 3, fontSize: 9, fontWeight: 700,
                        background: pConfig.color, color: "#fff", textTransform: "uppercase",
                      }}>
                        {pConfig.label}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>
                      {task.description}
                    </div>
                    {task.dueDate && (
                      <div style={{ fontSize: 10, color: pConfig.color, fontWeight: 500 }}>
                        Due: {task.dueDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      const result = completeTask(patient, task.id);
                      if (result.needsInput) {
                        onEdit();
                      } else if (result.updatedPatient) {
                        onTaskComplete(result.updatedPatient);
                      }
                    }}
                    style={{
                      padding: "6px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                      background: pConfig.color, border: "none", color: "#fff",
                      cursor: "pointer", flexShrink: 0,
                    }}
                  >
                    Complete
                  </button>
                </div>
              );
            })}
            {tasks.length > 5 && (
              <div style={{
                textAlign: "center", fontSize: 11, color: "var(--muted)",
                padding: "8px", fontStyle: "italic",
              }}>
                +{tasks.length - 5} more task{tasks.length - 5 !== 1 ? "s" : ""}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
