import { useState } from "react";

/**
 * Conflict Resolution - Handle concurrent edits to patient records
 * Hospital-grade systems handle record locking, merge changes, conflict warnings
 */
export default function ConflictResolution({ patient, currentUser, conflicts, onResolve, onLockRecord }) {
  const [showMergeModal, setShowMergeModal] = useState(false);

  if (conflicts.length === 0) return null;

  return (
    <div style={{
      background: "#fef3c7",
      border: "2px solid #f59e0b",
      borderRadius: 12,
      padding: "16px 20px",
      marginBottom: 20,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{
          width: 32, height: 32, borderRadius: "50%",
          background: "#f59e0b",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <i className="ti ti-alert-triangle" style={{ fontSize: 16, color: "#fff" }} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#92400e" }}>
            Edit Conflict Detected
          </div>
          <div style={{ fontSize: 11, color: "#78350f" }}>
            {conflicts.length} conflict{conflicts.length > 1 ? "s" : ""} need resolution
          </div>
        </div>
      </div>

      {/* Conflict List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {conflicts.map((conflict, idx) => (
          <ConflictCard
            key={idx}
            conflict={conflict}
            onResolve={(resolution) => onResolve(conflict, resolution)}
          />
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
        <button
          onClick={() => onLockRecord(patient.id)}
          style={{
            flex: 1,
            padding: "10px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600,
            background: "#f59e0b", border: "none", color: "#fff", cursor: "pointer",
          }}
        >
          Lock Record
        </button>
        <button
          onClick={() => setShowMergeModal(true)}
          style={{
            flex: 1,
            padding: "10px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600,
            background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)",
            cursor: "pointer",
          }}
        >
          Review Changes
        </button>
      </div>
    </div>
  );
}

function ConflictCard({ conflict, onResolve }) {
  return (
    <div style={{
      background: "#fff",
      border: "1px solid #fcd34d",
      borderRadius: 8,
      padding: 12,
    }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#92400e", marginBottom: 8 }}>
        {conflict.field}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {/* Your Version */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, color: "#15803d", marginBottom: 4 }}>
            Your Version
          </div>
          <div style={{
            padding: 8, borderRadius: 6,
            background: "#dcfce7", border: "1px solid #22c55e30",
            fontSize: 11, color: "#166534",
          }}>
            {conflict.yourValue}
          </div>
        </div>

        {/* Their Version */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, color: "#dc2626", marginBottom: 4 }}>
            {conflict.otherUser}'s Version
          </div>
          <div style={{
            padding: 8, borderRadius: 6,
            background: "#fee2e2", border: "1px solid #ef444430",
            fontSize: 11, color: "#991b1b",
          }}>
            {conflict.theirValue}
          </div>
        </div>
      </div>

      {/* Resolution Options */}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button
          onClick={() => onResolve("keep_yours")}
          style={{
            flex: 1,
            padding: "6px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600,
            background: "#dcfce7", border: "1px solid #22c55e", color: "#15803d",
            cursor: "pointer",
          }}
        >
          Keep Yours
        </button>
        <button
          onClick={() => onResolve("keep_theirs")}
          style={{
            flex: 1,
            padding: "6px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600,
            background: "#fee2e2", border: "1px solid #ef4444", color: "#991b1b",
            cursor: "pointer",
          }}
        >
          Keep Theirs
        </button>
        <button
          onClick={() => onResolve("manual_merge")}
          style={{
            flex: 1,
            padding: "6px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600,
            background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)",
            cursor: "pointer",
          }}
        >
          Manual Merge
        </button>
      </div>
    </div>
  );
}

/**
 * Record Locking - Prevent concurrent edits
 */
export function RecordLock({ patient, lockedBy, onUnlock, onLock }) {
  if (!lockedBy) {
    return (
      <button
        onClick={() => onLock(patient.id)}
        style={{
          padding: "6px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600,
          background: "transparent", border: "1px solid var(--border)", color: "var(--muted)",
          cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
        }}
      >
        <i className="ti ti-lock-open" style={{ fontSize: 12 }} />
        Lock Record
      </button>
    );
  }

  return (
    <div style={{
      padding: 8, borderRadius: 6,
      background: "#fee2e2", border: "1px solid #ef444430",
      display: "flex", alignItems: "center", gap: 8,
    }}>
      <i className="ti ti-lock" style={{ fontSize: 12, color: "#dc2626" }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#dc2626" }}>
          Locked by {lockedBy.user}
        </div>
        <div style={{ fontSize: 10, color: "#991b1b" }}>
          {lockedBy.timeAgo}
        </div>
      </div>
      <button
        onClick={() => onUnlock(patient.id)}
        style={{
          padding: "4px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600,
          background: "#dc2626", border: "none", color: "#fff", cursor: "pointer",
        }}
      >
        Unlock
      </button>
    </div>
  );
}

/**
 * Detect conflicts between two versions of patient data
 */
export function detectConflicts(original, modified, otherModified) {
  const conflicts = [];
  const allFields = new Set([...Object.keys(modified), ...Object.keys(otherModified)]);

  allFields.forEach(field => {
    const originalValue = original[field];
    const yourValue = modified[field];
    const theirValue = otherModified[field];

    // Skip if values are the same
    if (yourValue === theirValue) return;

    // Skip if only one side modified
    if (yourValue === originalValue || theirValue === originalValue) return;

    // Conflict detected
    conflicts.push({
      field,
      originalValue,
      yourValue,
      theirValue,
    });
  });

  return conflicts;
}
