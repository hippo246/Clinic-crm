import { useState } from "react";
import { fmtDate } from "../utils/patientUtils";
import { TIMELINE_TYPES } from "../constants/patientConstants";

// Maps filter key → event types from TIMELINE_TYPES
const FILTERS = [
  { key: "all",            label: "All",             types: null,                                          icon: "ti-list"           },
  { key: "visits",         label: "Visits",           types: ["appointment", "consultation"],               icon: "ti-stethoscope"    },
  { key: "notes",          label: "Notes",            types: ["note"],                                      icon: "ti-notes"          },
  { key: "documents",      label: "Documents",        types: ["report"],                                    icon: "ti-file-analytics" },
  { key: "followups",      label: "Follow-Ups",       types: ["followup"],                                  icon: "ti-clock"          },
  { key: "prescriptions",  label: "Prescriptions",    types: ["prescription"],                              icon: "ti-pill"           },
  { key: "consultations",  label: "Consultations",    types: ["consultation"],                              icon: "ti-stethoscope"    },
  { key: "billing",        label: "Billing",          types: ["invoice", "payment"],                        icon: "ti-receipt"        },
  { key: "insurance",      label: "Insurance",        types: ["insurance"],                                 icon: "ti-shield"         },
  { key: "communications", label: "Communications",   types: ["communication", "sms", "call"],              icon: "ti-message"        },
  { key: "alerts",         label: "Alerts",           types: ["alert", "created"],                          icon: "ti-alert-triangle" },
];

export default function PatientTimeline({ patient, onPatientUpdate }) {
  const [activeFilter, setActiveFilter] = useState("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [formData, setFormData] = useState({
    type: "note",
    label: "",
    date: new Date().toISOString().split("T")[0],
    doctor: "",
    note: "",
  });

  const allEvents = patient.timeline || [];

  const activeTypes = FILTERS.find((f) => f.key === activeFilter)?.types ?? null;
  const events = activeTypes
    ? allEvents.filter((e) => activeTypes.includes(e.type))
    : allEvents;

  // Count per filter for badges
  function countFor(filter) {
    if (!filter.types) return allEvents.length;
    return allEvents.filter((e) => filter.types.includes(e.type)).length;
  }

  function handleAddEvent() {
    setShowAddModal(true);
    setEditingEvent(null);
    setFormData({
      type: "note",
      label: "",
      date: new Date().toISOString().split("T")[0],
      doctor: "",
      note: "",
    });
  }

  function handleEditEvent(ev) {
    setEditingEvent(ev);
    setFormData({
      type: ev.type,
      label: ev.label,
      date: ev.date,
      doctor: ev.doctor || "",
      note: ev.note || "",
    });
    setShowAddModal(true);
  }

  function handleSaveEvent() {
    if (!formData.type || !formData.label || !formData.date) return;

    const typeConfig = TIMELINE_TYPES.find((t) => t.type === formData.type);
    const newEvent = {
      id: editingEvent?.id || `event-${Date.now()}`,
      type: formData.type,
      label: formData.label,
      date: formData.date,
      doctor: formData.doctor,
      note: formData.note,
      icon: typeConfig?.icon || "ti-circle",
      color: typeConfig?.color || "#64748b",
    };

    let updatedTimeline;
    if (editingEvent) {
      updatedTimeline = allEvents.map((e) => (e.id === editingEvent.id ? newEvent : e));
    } else {
      updatedTimeline = [...allEvents, newEvent].sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    onPatientUpdate?.({ ...patient, timeline: updatedTimeline });
    setShowAddModal(false);
    setEditingEvent(null);
  }

  function handleDeleteEvent(id) {
    if (!confirm("Delete this event?")) return;
    const updatedTimeline = allEvents.filter((e) => e.id !== id);
    onPatientUpdate?.({ ...patient, timeline: updatedTimeline });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>

      {/* ── Header with Add button ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Patient Timeline</div>
        <button
          className="btn btn-primary"
          style={{ fontSize: 12, padding: "6px 12px" }}
          onClick={handleAddEvent}
        >
          <i className="ti ti-plus" style={{ fontSize: 13 }} /> Add Event
        </button>
      </div>

      {/* ── Filter bar ── */}
      <div style={{
        display: "flex", gap: 4, flexWrap: "wrap",
        padding: "0 0 12px 0",
        borderBottom: "1px solid var(--border)",
        marginBottom: 12,
      }}>
        {FILTERS.map((f) => {
          const count   = countFor(f);
          const isActive = activeFilter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 500,
                cursor: "pointer",
                border: `1px solid ${isActive ? "var(--accent)" : "var(--border)"}`,
                background: isActive ? "var(--accent-soft)" : "var(--surface2)",
                color: isActive ? "var(--accent)" : "var(--muted)",
                transition: "all 0.12s",
              }}
            >
              <i className={`ti ${f.icon}`} style={{ fontSize: 11 }} />
              {f.label}
              {count > 0 && (
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  background: isActive ? "var(--accent)" : "var(--border)",
                  color: isActive ? "#fff" : "var(--muted)",
                  padding: "0 5px", borderRadius: 10, minWidth: 16, textAlign: "center",
                  lineHeight: "16px",
                }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Empty state ── */}
      {events.length === 0 && (
        <div style={{ color: "var(--muted)", fontSize: 13, padding: "20px 0", textAlign: "center" }}>
          {activeFilter === "all" ? "No timeline events yet." : `No ${FILTERS.find(f => f.key === activeFilter)?.label.toLowerCase()} events found.`}
        </div>
      )}

      {/* ── Events ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 0, padding: "4px 0" }}>
      {events.map((ev, i) => (
        <div
          key={ev.id}
          style={{ display: "flex", gap: 12, position: "relative", paddingBottom: 16 }}
        >
          {/* Icon + vertical line */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
            <div
              style={{
                width: 30, height: 30, borderRadius: "50%",
                background: ev.color + "18",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <i className={`ti ${ev.icon}`} style={{ fontSize: 14, color: ev.color }} />
            </div>
            {i < events.length - 1 && (
              <div
                style={{
                  width: 1, flex: 1, minHeight: 12,
                  background: "var(--border)", marginTop: 4,
                }}
              />
            )}
          </div>

          {/* Content */}
          <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingTop: 5, flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{ev.label}</span>
              <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: "auto", whiteSpace: "nowrap" }}>
                {fmtDate(ev.date)}
              </span>
              <div style={{ display: "flex", gap: 4 }}>
                <button
                  onClick={() => handleEditEvent(ev)}
                  style={{ padding: "2px 6px", fontSize: 11, background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 4, cursor: "pointer" }}
                  title="Edit"
                >
                  <i className="ti ti-pencil" style={{ fontSize: 10 }} />
                </button>
                <button
                  onClick={() => handleDeleteEvent(ev.id)}
                  style={{ padding: "2px 6px", fontSize: 11, background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 4, cursor: "pointer", color: "#dc2626" }}
                  title="Delete"
                >
                  <i className="ti ti-trash" style={{ fontSize: 10 }} />
                </button>
              </div>
            </div>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>{ev.doctor || "System"}</span>
            {ev.note && (
              <span style={{ fontSize: 12, color: "var(--muted)", fontStyle: "italic", marginTop: 2 }}>
                "{ev.note}"
              </span>
            )}
          </div>
        </div>
      ))}
      </div>

      {/* ── Add/Edit Modal ── */}
      {showAddModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1000,
          background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center",
          padding: 16,
        }}>
          <div style={{
            background: "var(--surface)", borderRadius: 12, padding: 20,
            width: "100%", maxWidth: 450, maxHeight: "90vh", overflow: "auto",
            border: "1px solid var(--border)",
          }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
              {editingEvent ? "Edit Event" : "Add Timeline Event"}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, marginBottom: 4, display: "block" }}>Event Type *</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  style={{ width: "100%" }}
                >
                  {TIMELINE_TYPES.map((t) => (
                    <option key={t.type} value={t.type}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 500, marginBottom: 4, display: "block" }}>Label *</label>
                <input
                  type="text"
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  placeholder="Event description"
                  style={{ width: "100%" }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 500, marginBottom: 4, display: "block" }}>Date *</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  style={{ width: "100%" }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 500, marginBottom: 4, display: "block" }}>Doctor/Staff</label>
                <input
                  type="text"
                  value={formData.doctor}
                  onChange={(e) => setFormData({ ...formData, doctor: e.target.value })}
                  placeholder="Name of doctor or staff"
                  style={{ width: "100%" }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 500, marginBottom: 4, display: "block" }}>Notes</label>
                <textarea
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  placeholder="Additional details..."
                  style={{ width: "100%", minHeight: 80, resize: "vertical" }}
                />
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  onClick={handleSaveEvent}
                  disabled={!formData.type || !formData.label || !formData.date}
                >
                  {editingEvent ? "Update" : "Add"}
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
