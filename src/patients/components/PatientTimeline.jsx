import { useState } from "react";
import { fmtDate } from "../utils/patientUtils";

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

export default function PatientTimeline({ patient }) {
  const [activeFilter, setActiveFilter] = useState("all");

  const allEvents = patient.timeline;

  const activeTypes = FILTERS.find((f) => f.key === activeFilter)?.types ?? null;
  const events = activeTypes
    ? allEvents.filter((e) => activeTypes.includes(e.type))
    : allEvents;

  // Count per filter for badges
  function countFor(filter) {
    if (!filter.types) return allEvents.length;
    return allEvents.filter((e) => filter.types.includes(e.type)).length;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>

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
            </div>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>{ev.doctor}</span>
            {ev.note && (
              <span style={{ fontSize: 12, color: "var(--muted)", fontStyle: "italic", marginTop: 2 }}>
                "{ev.note}"
              </span>
            )}
          </div>
        </div>
      ))}
      </div>
    </div>
  );
}
