import { useState } from "react";
import { fmtDate } from "../utils/patientUtils";
import { PriorityTag } from "./PatientBadges";

const STATUSES = [
  { id: "Pending",     label: "Pending",     color: "#f59e0b", bg: "#fef3c7", icon: "ti-clock"           },
  { id: "Called",      label: "Called",      color: "#3b82f6", bg: "#dbeafe", icon: "ti-phone"            },
  { id: "No Answer",   label: "No Answer",   color: "#6b7280", bg: "#f3f4f6", icon: "ti-phone-off"       },
  { id: "Rescheduled", label: "Rescheduled", color: "#8b5cf6", bg: "#ede9fe", icon: "ti-calendar-event"  },
  { id: "Completed",   label: "Completed",   color: "#22c55e", bg: "#dcfce7", icon: "ti-check"            },
  { id: "Cancelled",   label: "Cancelled",   color: "#ef4444", bg: "#fee2e2", icon: "ti-x"                },
];

const QUICK_OUTCOMES = [
  { id: "reached",      label: "Reached Patient",  icon: "ti-phone-check",  color: "#22c55e", status: "Called" },
  { id: "no_answer",    label: "No Answer",         icon: "ti-phone-off",    color: "#6b7280", status: "No Answer" },
  { id: "left_vm",      label: "Left Voicemail",     icon: "ti-phone-incoming", color: "#3b82f6", status: "Called" },
  { id: "wrong_number", label: "Wrong Number",      icon: "ti-phone-x",      color: "#ef4444", status: "Cancelled" },
  { id: "reschedule",   label: "Reschedule",        icon: "ti-calendar-plus", color: "#8b5cf6", status: "Rescheduled" },
  { id: "complete",     label: "Complete",          icon: "ti-check",        color: "#22c55e", status: "Completed" },
];

const PRIORITIES = [
  { id: "low",      label: "Low",      color: "#22c55e", bg: "#dcfce7" },
  { id: "medium",   label: "Medium",   color: "#f59e0b", bg: "#fef3c7" },
  { id: "high",     label: "High",     color: "#ef4444", bg: "#fee2e2" },
  { id: "critical", label: "Critical", color: "#dc2626", bg: "#fecaca" },
];

const REASONS = [
  "Routine Check-up",
  "Post-Visit Follow-Up",
  "Lab Results Review",
  "Medication Review",
  "Symptom Check",
  "Vaccination Reminder",
  "Appointment Reminder",
  "Other",
];

export default function FollowUpPanel({ patient, onPatientUpdate }) {
  const [status,        setStatus]        = useState(patient.followUpStatus  || "Pending");
  const [callAttempts,  setCallAttempts]  = useState(patient.callAttempts    || 0);
  const [lastContacted, setLastContacted] = useState(patient.lastContacted   || null);
  const [notes,         setNotes]         = useState(patient.followUpNotes   || "");
  const [saved,         setSaved]         = useState(false);
  const [showHistory,   setShowHistory]   = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    date: "",
    time: "",
    priority: "medium",
    reason: "Routine Check-up",
    assignedTo: "",
  });

  // Mock historical follow-ups for success rate calculation
  const history = patient.followUpHistory || [
    { date: "2024-01-15", status: "Completed", attempts: 1 },
    { date: "2024-02-20", status: "No Answer", attempts: 3 },
    { date: "2024-03-10", status: "Completed", attempts: 1 },
  ];
  const successRate = Math.round((history.filter((h) => h.status === "Completed").length / history.length) * 100);

  if (!patient.followUpDate) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 13, color: "var(--muted)" }}>No follow-up scheduled.</div>
        <button className="btn btn-primary" style={{ fontSize: 13, alignSelf: "flex-start" }} onClick={() => setShowScheduleModal(true)}>
          <i className="ti ti-clock" style={{ fontSize: 14 }} /> Schedule Follow-Up
        </button>
        {showScheduleModal && <ScheduleModal form={scheduleForm} setForm={setScheduleForm} onClose={() => setShowScheduleModal(false)} onSchedule={handleSchedule} />}
      </div>
    );
  }

  function handleSchedule() {
    if (!scheduleForm.date || !scheduleForm.time) return;
    
    const followUpDate = `${scheduleForm.date}T${scheduleForm.time}`;
    const updatedPatient = {
      ...patient,
      followUpDate,
      followUpStatus: "Pending",
      followUpPriority: scheduleForm.priority,
      followUpReason: scheduleForm.reason,
      followUpStaff: scheduleForm.assignedTo,
      callAttempts: 0,
      lastContacted: null,
      followUpHistory: [
        ...(patient.followUpHistory || []),
        { date: new Date().toISOString().split("T")[0], status: "Scheduled", attempts: 0 },
      ],
    };
    
    onPatientUpdate?.(updatedPatient);
    setShowScheduleModal(false);
    setStatus("Pending");
    setCallAttempts(0);
    setLastContacted(null);
  }

  const statusCfg = STATUSES.find((s) => s.id === status) || STATUSES[0];

  function logCall() {
    setCallAttempts((n) => n + 1);
    setLastContacted(new Date().toISOString().split("T")[0]);
    if (status === "Pending") setStatus("Called");
  }

  function markComplete() {
    setStatus("Completed");
    saveChanges();
  }

  function applyOutcome(outcome) {
    setStatus(outcome.status);
    if (outcome.status === "Called" || outcome.status === "No Answer") {
      setCallAttempts((n) => n + 1);
      setLastContacted(new Date().toISOString().split("T")[0]);
    }
    saveChanges();
  }

  function saveChanges() {
    const updatedPatient = {
      ...patient,
      followUpStatus: status,
      callAttempts,
      lastContacted,
      followUpNotes: notes,
      followUpHistory: [
        ...(patient.followUpHistory || []),
        { date: new Date().toISOString().split("T")[0], status, attempts: callAttempts },
      ],
    };
    onPatientUpdate?.(updatedPatient);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* ── Summary card ── */}
      <div style={{
        padding: "14px 16px",
        background: "var(--surface2)",
        borderRadius: 10,
        border: "1px solid var(--border)",
      }}>
        <div style={{
          display: "flex", alignItems: "center",
          justifyContent: "space-between", marginBottom: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: "#fef3c720", border: "1px solid #f59e0b40",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <i className="ti ti-clock" style={{ fontSize: 14, color: "#f59e0b" }} />
            </div>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Follow-Up</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <SuccessRateBadge rate={successRate} />
            <StatusPill cfg={statusCfg} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <InfoBlock label="Due Date"      value={fmtDate(patient.followUpDate)} />
          <InfoBlock label="Priority"      valueNode={<PriorityTag priority={patient.followUpPriority} />} />
          <InfoBlock label="Reason"        value={patient.followUpReason}  span />
          <InfoBlock label="Assigned To"   value={patient.followUpStaff} />
          {lastContacted && (
            <InfoBlock label="Last Contacted" value={fmtDate(lastContacted)} />
          )}
        </div>
      </div>

      {/* ── Quick Outcomes ── */}
      <div>
        <FLabel>Quick Outcomes</FLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          {QUICK_OUTCOMES.map((outcome) => (
            <button
              key={outcome.id}
              onClick={() => applyOutcome(outcome)}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                padding: "12px 8px", borderRadius: 8, fontSize: 12, fontWeight: 500,
                cursor: "pointer",
                border: `1px solid ${status === outcome.status ? outcome.color : "var(--border)"}`,
                background: status === outcome.status ? outcome.color + "15" : "var(--surface2)",
                color: status === outcome.status ? outcome.color : "var(--muted)",
                transition: "all 0.12s ease",
              }}
            >
              <i className={`ti ${outcome.icon}`} style={{ fontSize: 18 }} />
              {outcome.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Status selector ── */}
      <div>
        <FLabel>Update Status</FLabel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {STATUSES.map((s) => (
            <button
              key={s.id}
              onClick={() => setStatus(s.id)}
              style={{
                padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500,
                cursor: "pointer",
                border: `1px solid ${status === s.id ? s.color : "var(--border)"}`,
                background: status === s.id ? s.bg : "var(--surface)",
                color: status === s.id ? s.color : "var(--muted)",
                display: "flex", alignItems: "center", gap: 5,
                transition: "all 0.12s ease",
              }}
            >
              <i className={`ti ${s.icon}`} style={{ fontSize: 11 }} />
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Call log ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "11px 14px",
        background: "var(--surface2)",
        borderRadius: 8, border: "1px solid var(--border)",
      }}>
        <div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 3 }}>Call Attempts</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 24, fontWeight: 700 }}>{callAttempts}</span>
            {callAttempts > 0 && lastContacted && (
              <span style={{ fontSize: 11, color: "var(--muted)" }}>
                Last: {fmtDate(lastContacted)}
              </span>
            )}
          </div>
        </div>
        <button
          className="btn btn-ghost"
          onClick={logCall}
          style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}
        >
          <i className="ti ti-phone" style={{ fontSize: 14, color: "#3b82f6" }} />
          Log Call
        </button>
      </div>

      {/* ── Follow-up notes ── */}
      <div>
        <FLabel>Follow-Up Notes</FLabel>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add notes about this follow-up…"
          style={{
            width: "100%", minHeight: 76, resize: "vertical",
            fontSize: 13, padding: "9px 11px",
            borderRadius: 8, border: "1px solid var(--border)",
            background: "var(--surface2)", color: "var(--text)",
            fontFamily: "'DM Sans', sans-serif",
            boxSizing: "border-box", lineHeight: 1.5,
          }}
        />
      </div>

      {/* ── Follow-Up History ── */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <FLabel>Follow-Up History</FLabel>
          <button
            onClick={() => setShowHistory(!showHistory)}
            style={{
              fontSize: 11, fontWeight: 500, color: "var(--accent)",
              background: "none", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 4,
            }}
          >
            {showHistory ? "Hide" : "Show"}
            <i className={`ti ti-chevron-${showHistory ? "up" : "down"}`} style={{ fontSize: 10 }} />
          </button>
        </div>
        {showHistory && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {history.map((h, i) => (
              <div key={i} style={{
                padding: "10px 12px", borderRadius: 8,
                background: "var(--surface2)", border: "1px solid var(--border)",
                display: "flex", alignItems: "center", gap: 10,
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: h.status === "Completed" ? "#dcfce7" : "#f3f4f6",
                  border: `1px solid ${h.status === "Completed" ? "#22c55e40" : "var(--border)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <i className={`ti ${h.status === "Completed" ? "ti-check" : "ti-phone-off"}`}
                    style={{ fontSize: 14, color: h.status === "Completed" ? "#22c55e" : "#6b7280" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{h.status}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>
                    {fmtDate(h.date)} · {h.attempts} attempt{h.attempts > 1 ? "s" : ""}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Actions ── */}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          className="btn btn-primary"
          style={{ flex: 1, fontSize: 13 }}
          onClick={markComplete}
        >
          <i className="ti ti-check" style={{ fontSize: 14 }} />
          Mark Complete
        </button>
        <button
          className="btn btn-ghost"
          style={{ fontSize: 13 }}
          onClick={() => setStatus("Rescheduled")}
        >
          <i className="ti ti-calendar-event" style={{ fontSize: 14 }} />
          Reschedule
        </button>
        <button
          className="btn btn-ghost"
          style={{ fontSize: 13, padding: "7px 12px" }}
          onClick={flash}
        >
          {saved
            ? <i className="ti ti-check" style={{ fontSize: 14, color: "#22c55e" }} />
            : <i className="ti ti-device-floppy" style={{ fontSize: 14 }} />}
        </button>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function SuccessRateBadge({ rate }) {
  const color = rate >= 80 ? "#22c55e" : rate >= 60 ? "#f59e0b" : "#ef4444";
  const bg = rate >= 80 ? "#dcfce7" : rate >= 60 ? "#fef3c7" : "#fee2e2";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 8px", borderRadius: 20,
      background: bg, color: color,
      fontSize: 10, fontWeight: 700,
      border: `1px solid ${color}40`,
    }}>
      <i className="ti ti-chart-pie" style={{ fontSize: 10 }} />
      {rate}% Success
    </span>
  );
}

function StatusPill({ cfg }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 10px", borderRadius: 20,
      background: cfg.bg, color: cfg.color,
      fontSize: 11, fontWeight: 600,
      border: `1px solid ${cfg.color}40`,
    }}>
      <i className={`ti ${cfg.icon}`} style={{ fontSize: 11 }} />
      {cfg.label}
    </span>
  );
}

function InfoBlock({ label, value, valueNode, span }) {
  if (!value && !valueNode) return null;
  return (
    <div style={{ gridColumn: span ? "1 / -1" : undefined }}>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 500 }}>{valueNode ?? value}</div>
    </div>
  );
}

function FLabel({ children }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 600, letterSpacing: "0.08em",
      textTransform: "uppercase", color: "var(--muted)", marginBottom: 8,
    }}>
      {children}
    </div>
  );
}

function ScheduleModal({ form, setForm, onClose, onSchedule }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16,
    }}>
      <div style={{
        background: "var(--surface)", borderRadius: 12, padding: 20,
        width: "100%", maxWidth: 400, maxHeight: "90vh", overflow: "auto",
        border: "1px solid var(--border)",
      }}>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Schedule Follow-Up</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 500, marginBottom: 4, display: "block" }}>Date *</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                style={{ width: "100%" }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 500, marginBottom: 4, display: "block" }}>Time *</label>
              <input
                type="time"
                value={form.time}
                onChange={(e) => setForm({ ...form, time: e.target.value })}
                style={{ width: "100%" }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 500, marginBottom: 4, display: "block" }}>Priority</label>
            <select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
              style={{ width: "100%" }}
            >
              {PRIORITIES.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 500, marginBottom: 4, display: "block" }}>Reason</label>
            <select
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              style={{ width: "100%" }}
            >
              {REASONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 500, marginBottom: 4, display: "block" }}>Assigned To</label>
            <input
              type="text"
              value={form.assignedTo}
              onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
              placeholder="Staff member name"
              style={{ width: "100%" }}
            />
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              className="btn btn-primary"
              style={{ flex: 1 }}
              onClick={onSchedule}
              disabled={!form.date || !form.time}
            >
              Schedule
            </button>
            <button
              className="btn btn-ghost"
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
