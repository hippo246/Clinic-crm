import { useState } from "react";

/**
 * Universal Tasks System - Patient-specific tasks
 * Call patient due tomorrow, assigned to Sarah
 * Tasks connected directly to patient
 */
export default function UniversalTasks({ patient, tasks, onAddTask, onCompleteTask, onDeleteTask }) {
  const [showAddModal, setShowAddModal] = useState(false);

  const pendingTasks = tasks.filter(t => !t.completed);
  const completedTasks = tasks.filter(t => t.completed);

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 16,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <i className="ti ti-list-check" style={{ fontSize: 14, color: "var(--accent)" }} />
          <span style={{
            fontSize: 12, fontWeight: 700, color: "var(--text)",
            textTransform: "uppercase", letterSpacing: "0.06em",
          }}>
            Tasks
          </span>
          <span style={{
            padding: "2px 8px", borderRadius: 10,
            fontSize: 10, fontWeight: 600,
            background: "var(--accent-soft)", color: "var(--accent)",
          }}>
            {pendingTasks.length} pending
          </span>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            padding: "6px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600,
            background: "var(--accent)", border: "none", color: "#fff", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6,
          }}
        >
          <i className="ti ti-plus" style={{ fontSize: 12 }} />
          Add Task
        </button>
      </div>

      {/* Pending Tasks */}
      {pendingTasks.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginBottom: 8 }}>
            Pending
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pendingTasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                onComplete={() => onCompleteTask(task.id)}
                onDelete={() => onDeleteTask(task.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Completed Tasks */}
      {completedTasks.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginBottom: 8 }}>
            Completed
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {completedTasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                onComplete={() => onCompleteTask(task.id)}
                onDelete={() => onDeleteTask(task.id)}
              />
            ))}
          </div>
        </div>
      )}

      {tasks.length === 0 && (
        <div style={{
          padding: 24, borderRadius: 8,
          background: "var(--surface2)", border: "1px dashed var(--border)",
          textAlign: "center",
        }}>
          <i className="ti ti-list-check" style={{ fontSize: 24, color: "var(--muted)" }} />
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
            No tasks yet
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>
            Add tasks to track patient-related work
          </div>
        </div>
      )}

      {showAddModal && (
        <AddTaskModal
          patient={patient}
          onAdd={(task) => {
            onAddTask(task);
            setShowAddModal(false);
          }}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}

function TaskCard({ task, onComplete, onDelete }) {
  const priorityConfig = {
    critical: { bg: "#fee2e2", color: "#dc2626", icon: "ti-urgent" },
    high: { bg: "#fef3c7", color: "#d97706", icon: "ti-alert-triangle" },
    medium: { bg: "#dbeafe", color: "#2563eb", icon: "ti-info-circle" },
    low: { bg: "#f1f5f9", color: "#64748b", icon: "ti-circle" },
  };

  const config = priorityConfig[task.priority] || priorityConfig.medium;

  return (
    <div style={{
      padding: 12, borderRadius: 8,
      background: task.completed ? "#f0fdf4" : config.bg,
      border: task.completed ? "1px solid #22c55e30" : `1px solid ${config.color}40`,
      display: "flex", alignItems: "center", gap: 12,
      opacity: task.completed ? 0.7 : 1,
    }}>
      <button
        onClick={onComplete}
        style={{
          width: 24, height: 24, borderRadius: "50%",
          background: task.completed ? "#22c55e" : "transparent",
          border: task.completed ? "none" : "2px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer",
        }}
      >
        {task.completed && <i className="ti ti-check" style={{ fontSize: 12, color: "#fff" }} />}
      </button>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 600, color: "var(--text)",
          textDecoration: task.completed ? "line-through" : "none",
        }}>
          {task.title}
        </div>
        {task.description && (
          <div style={{ fontSize: 11, color: "var(--muted)" }}>
            {task.description}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
          {task.assignedTo && (
            <span style={{ fontSize: 10, color: "var(--muted)" }}>
              Assigned to: {task.assignedTo}
            </span>
          )}
          {task.dueDate && (
            <span style={{ fontSize: 10, color: config.color }}>
              Due: {new Date(task.dueDate).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
            </span>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 6 }}>
        {!task.completed && (
          <span style={{
            padding: "2px 6px", borderRadius: 4, fontSize: 9, fontWeight: 600,
            background: config.color, color: "#fff", textTransform: "uppercase",
          }}>
            {task.priority}
          </span>
        )}
        <button
          onClick={onDelete}
          style={{
            padding: "4px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600,
            background: "transparent", border: "1px solid #fecaca", color: "#dc2626",
            cursor: "pointer",
          }}
        >
          <i className="ti ti-trash" style={{ fontSize: 11 }} />
        </button>
      </div>
    </div>
  );
}

function AddTaskModal({ patient, onAdd, onClose }) {
  const [task, setTask] = useState({
    title: "",
    description: "",
    priority: "medium",
    dueDate: "",
    assignedTo: "",
  });

  const handleAdd = () => {
    if (!task.title.trim()) return;
    onAdd({
      ...task,
      id: `task-${Date.now()}`,
      patientId: patient.id,
      completed: false,
      createdAt: new Date().toISOString(),
    });
  };

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 10000,
    }}>
      <div style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 24,
        width: 450,
        maxWidth: "90vw",
      }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", marginBottom: 20 }}>
          Add Task
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 8, display: "block" }}>
              Task Title *
            </label>
            <input
              type="text"
              value={task.title}
              onChange={(e) => setTask({ ...task, title: e.target.value })}
              placeholder="e.g., Call patient for follow-up"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                fontSize: 13,
                background: "var(--surface2)",
                color: "var(--text)",
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 8, display: "block" }}>
              Description
            </label>
            <textarea
              value={task.description}
              onChange={(e) => setTask({ ...task, description: e.target.value })}
              placeholder="Additional details..."
              rows={2}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                fontSize: 13,
                background: "var(--surface2)",
                color: "var(--text)",
                resize: "vertical",
              }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 8, display: "block" }}>
                Priority
              </label>
              <select
                value={task.priority}
                onChange={(e) => setTask({ ...task, priority: e.target.value })}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  fontSize: 13,
                  background: "var(--surface2)",
                  color: "var(--text)",
                }}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 8, display: "block" }}>
                Due Date
              </label>
              <input
                type="date"
                value={task.dueDate}
                onChange={(e) => setTask({ ...task, dueDate: e.target.value })}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  fontSize: 13,
                  background: "var(--surface2)",
                  color: "var(--text)",
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 8, display: "block" }}>
              Assigned To
            </label>
            <input
              type="text"
              value={task.assignedTo}
              onChange={(e) => setTask({ ...task, assignedTo: e.target.value })}
              placeholder="e.g., Sarah"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                fontSize: 13,
                background: "var(--surface2)",
                color: "var(--text)",
              }}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 24 }}>
          <button
            onClick={onClose}
            style={{
              padding: "8px 16px", borderRadius: 6, fontSize: 12, fontWeight: 600,
              background: "transparent", border: "1px solid var(--border)", color: "var(--text)",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={!task.title.trim()}
            style={{
              padding: "8px 16px", borderRadius: 6, fontSize: 12, fontWeight: 600,
              background: "var(--accent)", border: "none", color: "#fff",
              cursor: task.title.trim() ? "pointer" : "not-allowed",
              opacity: task.title.trim() ? 1 : 0.5,
            }}
          >
            Add Task
          </button>
        </div>
      </div>
    </div>
  );
}
