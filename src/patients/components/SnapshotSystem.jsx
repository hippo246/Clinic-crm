import { useState } from "react";

/**
 * Snapshot System - Create and restore patient record snapshots
 * View patient exactly as they were at a point in time
 * Useful for audits and disputes
 */
export default function SnapshotSystem({ patient, snapshots, onCreateSnapshot, onRestoreSnapshot, onDeleteSnapshot }) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState(null);

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 16,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <i className="ti ti-camera" style={{ fontSize: 14, color: "var(--accent)" }} />
          <span style={{
            fontSize: 12, fontWeight: 700, color: "var(--text)",
            textTransform: "uppercase", letterSpacing: "0.06em",
          }}>
            Snapshots
          </span>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          style={{
            padding: "6px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600,
            background: "var(--accent)", border: "none", color: "#fff", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6,
          }}
        >
          <i className="ti ti-plus" style={{ fontSize: 12 }} />
          Create Snapshot
        </button>
      </div>

      {/* Snapshot List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {snapshots.map(snapshot => (
          <SnapshotCard
            key={snapshot.id}
            snapshot={snapshot}
            onView={() => setSelectedSnapshot(snapshot)}
            onRestore={() => onRestoreSnapshot(snapshot)}
            onDelete={() => onDeleteSnapshot(snapshot.id)}
          />
        ))}
        {snapshots.length === 0 && (
          <div style={{
            padding: 24, borderRadius: 8,
            background: "var(--surface2)", border: "1px dashed var(--border)",
            textAlign: "center",
          }}>
            <i className="ti ti-camera-off" style={{ fontSize: 24, color: "var(--muted)" }} />
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
              No snapshots yet
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>
              Create snapshots to preserve patient state
            </div>
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateSnapshotModal
          patient={patient}
          onSave={(note) => {
            onCreateSnapshot(note);
            setShowCreateModal(false);
          }}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {selectedSnapshot && (
        <SnapshotViewer
          snapshot={selectedSnapshot}
          onClose={() => setSelectedSnapshot(null)}
        />
      )}
    </div>
  );
}

function SnapshotCard({ snapshot, onView, onRestore, onDelete }) {
  return (
    <div style={{
      padding: 12, borderRadius: 8,
      background: "var(--surface)", border: "1px solid var(--border)",
      display: "flex", alignItems: "center", gap: 12,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: "50%",
        background: "#dbeafe", display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <i className="ti ti-camera" style={{ fontSize: 16, color: "#3b82f6" }} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
          {snapshot.note || "Unnamed Snapshot"}
        </div>
        <div style={{ fontSize: 11, color: "var(--muted)" }}>
          {new Date(snapshot.createdAt).toLocaleDateString("en-IN", {
            day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
          })}
          {" · by "}{snapshot.createdBy}
        </div>
      </div>

      <div style={{ display: "flex", gap: 6 }}>
        <button
          onClick={onView}
          style={{
            padding: "6px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
            background: "transparent", border: "1px solid var(--border)", color: "var(--text)",
            cursor: "pointer",
          }}
        >
          <i className="ti ti-eye" style={{ fontSize: 12 }} />
        </button>
        <button
          onClick={onRestore}
          style={{
            padding: "6px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
            background: "#dbeafe", border: "1px solid #3b82f6", color: "#1e40af",
            cursor: "pointer",
          }}
        >
          <i className="ti ti-refresh" style={{ fontSize: 12 }} />
        </button>
        <button
          onClick={onDelete}
          style={{
            padding: "6px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
            background: "transparent", border: "1px solid #fecaca", color: "#dc2626",
            cursor: "pointer",
          }}
        >
          <i className="ti ti-trash" style={{ fontSize: 12 }} />
        </button>
      </div>
    </div>
  );
}

function CreateSnapshotModal({ patient, onSave, onClose }) {
  const [note, setNote] = useState("");

  const handleSave = () => {
    onSave(note || `Snapshot of ${patient.name}`);
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
        width: 400,
        maxWidth: "90vw",
      }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", marginBottom: 16 }}>
          Create Snapshot
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 8, display: "block" }}>
            Snapshot Note
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g., Before surgery, Pre-treatment state"
            rows={3}
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

        <div style={{
          padding: 12, borderRadius: 8,
          background: "#f0fdf4", border: "1px solid #22c55e30",
          marginBottom: 16,
        }}>
          <div style={{ fontSize: 11, color: "#166534" }}>
            <i className="ti ti-info-circle" style={{ fontSize: 12, marginRight: 6 }} />
            This will capture the current state of the patient record including all fields, notes, and documents.
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
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
            onClick={handleSave}
            style={{
              padding: "8px 16px", borderRadius: 6, fontSize: 12, fontWeight: 600,
              background: "var(--accent)", border: "none", color: "#fff", cursor: "pointer",
            }}
          >
            Create Snapshot
          </button>
        </div>
      </div>
    </div>
  );
}

function SnapshotViewer({ snapshot, onClose }) {
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
        width: 600,
        maxWidth: "90vw",
        maxHeight: "90vh",
        overflowY: "auto",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
              {snapshot.note || "Snapshot"}
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>
              {new Date(snapshot.createdAt).toLocaleString("en-IN")}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: "6px 10px", borderRadius: 6,
              background: "transparent", border: "1px solid var(--border)",
              cursor: "pointer",
            }}
          >
            <i className="ti ti-x" style={{ fontSize: 16, color: "var(--muted)" }} />
          </button>
        </div>

        <div style={{
          padding: 16, borderRadius: 8,
          background: "#f0fdf4", border: "1px solid #22c55e30",
          marginBottom: 20,
        }}>
          <div style={{ fontSize: 11, color: "#166534" }}>
            <i className="ti ti-info-circle" style={{ fontSize: 12, marginRight: 6 }} />
            This is a read-only view of the patient record as it existed at the time of snapshot.
          </div>
        </div>

        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 12 }}>
          Patient Data
        </div>

        <div style={{
          padding: 16, borderRadius: 8,
          background: "var(--surface2)", border: "1px solid var(--border)",
          fontFamily: "monospace", fontSize: 11,
          whiteSpace: "pre-wrap",
          wordBreak: "break-all",
        }}>
          {JSON.stringify(snapshot.data, null, 2)}
        </div>
      </div>
    </div>
  );
}

/**
 * Create a snapshot of patient data
 */
export function createSnapshot(patient, note, createdBy) {
  return {
    id: `snapshot-${Date.now()}`,
    patientId: patient.id,
    data: JSON.parse(JSON.stringify(patient)), // Deep clone
    note,
    createdAt: new Date().toISOString(),
    createdBy,
  };
}
