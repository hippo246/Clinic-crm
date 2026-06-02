import { useState } from "react";

/**
 * Saved Filters - Allow users to save and reuse complex filter combinations
 * Receptionists can create one-click filters for common queries
 */
export default function SavedFilters({ patients, onApplyFilter, currentFilter }) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [savedFilters, setSavedFilters] = useState(getDefaultSavedFilters());

  const handleApplyFilter = (filter) => {
    onApplyFilter(filter);
  };

  const handleSaveFilter = (name, criteria) => {
    const newFilter = {
      id: `filter-${Date.now()}`,
      name,
      criteria,
      createdAt: new Date().toISOString(),
      useCount: 0,
    };
    setSavedFilters([...savedFilters, newFilter]);
    setShowCreateModal(false);
  };

  const handleDeleteFilter = (filterId) => {
    setSavedFilters(savedFilters.filter(f => f.id !== filterId));
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <i className="ti ti-filter" style={{ fontSize: 14, color: "var(--accent)" }} />
          <span style={{
            fontSize: 12, fontWeight: 700, color: "var(--text)",
            textTransform: "uppercase", letterSpacing: "0.06em",
          }}>
            Saved Filters
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
          Save Current
        </button>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {savedFilters.map(filter => (
          <FilterChip
            key={filter.id}
            filter={filter}
            isActive={currentFilter?.id === filter.id}
            onApply={() => handleApplyFilter(filter)}
            onDelete={() => handleDeleteFilter(filter.id)}
          />
        ))}
      </div>

      {showCreateModal && (
        <CreateFilterModal
          currentFilter={currentFilter}
          onSave={handleSaveFilter}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
}

function FilterChip({ filter, isActive, onApply, onDelete }) {
  return (
    <button
      onClick={onApply}
      style={{
        padding: "8px 14px",
        borderRadius: 20,
        fontSize: 11, fontWeight: 600,
        background: isActive ? "var(--accent)" : "var(--surface2)",
        border: isActive ? "1px solid var(--accent)" : "1px solid var(--border)",
        color: isActive ? "#fff" : "var(--text)",
        cursor: "pointer",
        display: "flex", alignItems: "center", gap: 8,
        transition: "all 0.15s ease",
      }}
    >
      <i className="ti ti-filter" style={{ fontSize: 12 }} />
      <span>{filter.name}</span>
      <span style={{
        padding: "2px 6px", borderRadius: 10,
        fontSize: 9, background: isActive ? "#ffffff30" : "var(--border)",
        color: isActive ? "#fff" : "var(--muted)",
      }}>
        {filter.useCount || 0}
      </span>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        style={{
          width: 16, height: 16, borderRadius: "50%",
          background: "transparent", border: "none",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer",
        }}
      >
        <i className="ti ti-x" style={{ fontSize: 10, color: isActive ? "#fff" : "var(--muted)" }} />
      </button>
    </button>
  );
}

function CreateFilterModal({ currentFilter, onSave, onClose }) {
  const [name, setName] = useState("");

  const handleSave = () => {
    if (!name.trim()) return;
    onSave(name.trim(), currentFilter?.criteria || {});
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
          Save Current Filter
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 8, display: "block" }}>
            Filter Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Missing Consent Forms"
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              fontSize: 13,
              background: "var(--surface2)",
              color: "var(--text)",
            }}
            autoFocus
          />
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
            disabled={!name.trim()}
            style={{
              padding: "8px 16px", borderRadius: 6, fontSize: 12, fontWeight: 600,
              background: "var(--accent)", border: "none", color: "#fff",
              cursor: name.trim() ? "pointer" : "not-allowed",
              opacity: name.trim() ? 1 : 0.5,
            }}
          >
            Save Filter
          </button>
        </div>
      </div>
    </div>
  );
}

function getDefaultSavedFilters() {
  return [
    {
      id: "filter-1",
      name: "Missing Consent",
      criteria: { consentSigned: false },
      createdAt: new Date().toISOString(),
      useCount: 0,
    },
    {
      id: "filter-2",
      name: "High Risk Patients",
      criteria: { alerts: ["Allergy", "Heart Condition", "Pregnancy", "High Risk"] },
      createdAt: new Date().toISOString(),
      useCount: 0,
    },
    {
      id: "filter-3",
      name: "Follow-Up Due",
      criteria: { status: "Follow-Up Due" },
      createdAt: new Date().toISOString(),
      useCount: 0,
    },
    {
      id: "filter-4",
      name: "VIP Patients",
      criteria: { status: "VIP" },
      createdAt: new Date().toISOString(),
      useCount: 0,
    },
  ];
}
