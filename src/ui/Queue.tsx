import React, { useState, useMemo, useEffect, useCallback } from "react";
import type { Patient } from "./types";
import { fmtDate } from "./utils";

interface QueuePatient {
  id: string;
  patient: Patient;
  tokenNo: number;
  appointmentTime: string;
  doctor: string;
  visitType: string;
  status: "scheduled" | "checked-in" | "waiting" | "with-doctor" | "billing-pending" | "completed" | "no-show" | "cancelled";
  waitingTime: number;
  consultationStartTime?: string;
  priority?: boolean;
  room?: string;
  note?: string;
}

export default function QueuePage({
  patients,
  onUpdatePatient,
  onAction,
  userRole = "admin",
}: {
  patients: Patient[];
  onUpdatePatient?: (updated: Patient, action?: string) => void;
  onAction?: (actionId: string) => void;
  userRole?: "receptionist" | "doctor" | "admin";
}) {
  const todayStr = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [selectedDoctor, setSelectedDoctor] = useState("All");
  const [statusFilter, setStatusFilter] = useState<QueuePatient["status"] | "">("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [tick, setTick] = useState(0);

  // feedback
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const showFeedback = useCallback((message: string, type: "success" | "error" | "info" = "info") => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  }, []);

  // detail modal
  const [detailPatient, setDetailPatient] = useState<QueuePatient | null>(null);

  // confirm modal for risky transitions
  type ConfirmPending = { patientId: string; newStatus: QueuePatient["status"]; label: string };
  const [confirmPending, setConfirmPending] = useState<ConfirmPending | null>(null);

  // localStorage: priority, notes, rooms, activity
  const PRIORITY_KEY = "clinic_crm_queue_priority";
  const NOTES_KEY    = "clinic_crm_queue_notes";
  const ROOMS_KEY    = "clinic_crm_queue_rooms";
  const ACTIVITY_KEY = "clinic_crm_queue_activity";
  const [priorityMap, setPriorityMap] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem(PRIORITY_KEY) || "{}"); } catch { return {}; }
  });
  const [notesMap, setNotesMap] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem(NOTES_KEY) || "{}"); } catch { return {}; }
  });
  const [roomsMap, setRoomsMap] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem(ROOMS_KEY) || "{}"); } catch { return {}; }
  });
  const [activityLog, setActivityLog] = useState<Array<{ timestamp: string; patientId: string; patientName: string; action: string; details?: string }>>(() => {
    try { return JSON.parse(localStorage.getItem(ACTIVITY_KEY) || "[]"); } catch { return []; }
  });
  const [showActivity, setShowActivity] = useState(false);
  const [editingNote, setEditingNote] = useState<{ id: string; text: string } | null>(null);
  const [editingRoom, setEditingRoom] = useState<{ id: string; text: string } | null>(null);
  const [clearActivityPending, setClearActivityPending] = useState(false);

  const savePriority = (map: Record<string, boolean>) => { setPriorityMap(map); try { localStorage.setItem(PRIORITY_KEY, JSON.stringify(map)); } catch {} };
  const saveNotes    = (map: Record<string, string>)   => { setNotesMap(map);   try { localStorage.setItem(NOTES_KEY,    JSON.stringify(map)); } catch {} };
  const saveRooms    = (map: Record<string, string>)   => { setRoomsMap(map);   try { localStorage.setItem(ROOMS_KEY,    JSON.stringify(map)); } catch {} };
  const logActivity  = (patientId: string, patientName: string, action: string, details?: string) => {
    const entry = { timestamp: new Date().toISOString(), patientId, patientName, action, details };
    const updated = [entry, ...activityLog].slice(0, 50);
    setActivityLog(updated);
    try { localStorage.setItem(ACTIVITY_KEY, JSON.stringify(updated)); } catch {}
  };

  // tick every 30 s for live waiting time
  useEffect(() => {
    const id = setInterval(() => { setTick(t => t + 1); if (autoRefresh) setLastRefresh(new Date()); }, 30000);
    return () => clearInterval(id);
  }, [autoRefresh]);

  // Escape closes modals
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setDetailPatient(null); setConfirmPending(null); setEditingNote(null); setEditingRoom(null); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const queuePatients = useMemo(() => {
    const selectedDateStr = selectedDate;
    const todayAppointments = patients.filter(p => {
      if (!p.nextAppointment) return false;
      const appointmentDate = new Date(p.nextAppointment).toISOString().split("T")[0];
      if (selectedDateStr === "week") {
        const weekEnd = new Date(); weekEnd.setDate(weekEnd.getDate() + 6);
        return appointmentDate >= todayStr && appointmentDate <= weekEnd.toISOString().split("T")[0];
      }
      return appointmentDate === selectedDateStr;
    });

    // Recognizes every status the app can write to Patient.status (must match the statusMap in
    // handleStatusChange below) — previously this only recognized 3 of 8 states, so e.g. a patient
    // moved to "Billing Pending" would silently fall back to "scheduled"/"waiting" on the next render.
    const PATIENT_STATUS_TO_QUEUE: Record<string, QueuePatient["status"]> = {
      "Checked In":       "checked-in",
      "Waiting":          "waiting",
      "In Progress":      "with-doctor",
      "Billing Pending":  "billing-pending",
      "Completed":        "completed",
      "No Show":          "no-show",
      "Cancelled":        "cancelled",
      "Scheduled":        "scheduled",
    };

    return todayAppointments.map((p, index) => {
      const appointmentTime = new Date(p.nextAppointment!);
      const waitingTime = Math.floor((Date.now() - appointmentTime.getTime()) / (1000 * 60));

      let status: QueuePatient["status"] = PATIENT_STATUS_TO_QUEUE[p.status ?? ""] ?? "scheduled";
      // Only auto-escalate to "waiting" if the patient hasn't already reached a later stage
      if (status === "scheduled" && waitingTime > 15) status = "waiting";

      return {
        id: p.id,
        patient: p,
        tokenNo: index + 1,
        appointmentTime: appointmentTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
        doctor: p.doctor || "Unassigned",
        visitType: "Consultation",
        status,
        waitingTime: Math.max(0, waitingTime),
        consultationStartTime: undefined,
        priority: !!priorityMap[p.id],
        room: roomsMap[p.id],
        note: notesMap[p.id],
      };
    }).sort((a, b) => {
      // priority patients bubble to top within same status
      if (a.priority !== b.priority) return a.priority ? -1 : 1;
      const statusPriority = { "with-doctor": 0, "checked-in": 1, "waiting": 2, "scheduled": 3, "completed": 4, "billing-pending": 5, "no-show": 6, "cancelled": 7 };
      return statusPriority[a.status] - statusPriority[b.status] || a.tokenNo - b.tokenNo;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patients, selectedDate, priorityMap, roomsMap, notesMap, tick]);

  const filteredQueue = useMemo(() => {
    let list = selectedDoctor === "All" ? queuePatients : queuePatients.filter(q => q.doctor === selectedDoctor);
    if (statusFilter) list = list.filter(q => q.status === statusFilter);
    return list;
  }, [queuePatients, selectedDoctor, statusFilter]);

  const waitingRoom = filteredQueue.filter(q => q.status === "checked-in" || q.status === "waiting");
  const inProgress = filteredQueue.filter(q => q.status === "with-doctor");
  const completed = filteredQueue.filter(q => q.status === "completed");
  const billingPending = filteredQueue.filter(q => q.status === "billing-pending");

  const doctors = useMemo(() => {
    const docSet = new Set(patients.map(p => p.doctor).filter(Boolean));
    return Array.from(docSet).sort();
  }, [patients]);

  // Queue workflow uses extended appointment statuses in frontend mode.
  const RISKY_TRANSITIONS: Partial<Record<QueuePatient["status"], QueuePatient["status"][]>> = {
    "completed":  ["scheduled", "checked-in", "waiting", "with-doctor"],
    "cancelled":  ["scheduled", "checked-in", "waiting", "with-doctor", "billing-pending"],
    "no-show":    ["scheduled", "checked-in", "waiting", "with-doctor", "billing-pending"],
  };

  const handleStatusChange = (patientId: string, newStatus: QueuePatient["status"], force = false) => {
    const patient = patients.find(p => p.id === patientId);
    if (!patient) return;

    // guard risky backward transitions
    const qp = queuePatients.find(q => q.id === patientId);
    if (!force && qp && RISKY_TRANSITIONS[qp.status]?.includes(newStatus)) {
      setConfirmPending({ patientId, newStatus, label: `Move ${patient.name} from "${qp.status}" → "${newStatus}"?` });
      return;
    }

    const statusMap: Record<QueuePatient["status"], string> = {
      "scheduled": "Scheduled",
      "checked-in": "Checked In",
      "waiting": "Waiting",
      "with-doctor": "In Progress",
      "billing-pending": "Billing Pending",
      "completed": "Completed",
      "no-show": "No Show",
      "cancelled": "Cancelled",
    };

    const patch: Partial<Patient> = {
      status: statusMap[newStatus],
      updatedAt: new Date().toISOString(),
    };
    if (newStatus === "completed") patch.lastVisit = new Date().toISOString();

    onUpdatePatient?.({ ...patient, ...patch } as Patient, `moved to ${statusMap[newStatus]}`);
    logActivity(patientId, patient.name, `Status changed to ${statusMap[newStatus]}`, `From: ${qp?.status || "unknown"}`);
    showFeedback(`${patient.name} → ${statusMap[newStatus]}`, "success");
    // refresh detail modal if open for same patient
    if (detailPatient?.id === patientId) setDetailPatient(prev => prev ? { ...prev, status: newStatus } : null);
  };

  return (
    <div className="queue-page" style={{ padding: 24, width: "100%", boxSizing: "border-box" }}>
      <style>{`
        .queue-page .qp-stat-grid { display: grid; grid-template-columns: repeat(8, 1fr); gap: 8px; margin-bottom: 16px; }
        .queue-page .qp-header-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; gap: 12px; flex-wrap: wrap; }
        .queue-page .qp-quick-actions { display: flex; gap: 8px; flex-wrap: wrap; }
        .queue-page .qp-col-hide { display: table-cell; }
        .queue-page .qp-wait-15 { color: var(--amber); font-weight: 700; }
        .queue-page .qp-wait-30 { color: var(--orange,#ea580c); font-weight: 700; }
        .queue-page .qp-wait-60 { color: var(--red); font-weight: 800; }
        .queue-page .qp-priority-row { background: var(--amber-bg) !important; }
        .queue-page .qp-modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 300; display: flex; align-items: center; justify-content: center; padding: 12px; }
        .queue-page .qp-modal { background: var(--surface); border-radius: var(--radius); padding: 24px; max-width: 480px; width: 100%; max-height: 90vh; overflow-y: auto; box-shadow: var(--shadow-lg); }
        .queue-page .qp-feedback { position: sticky; top: 0; z-index: 100; padding: 10px 16px; margin-bottom: 12px; border-radius: var(--radius); font-weight: 500; font-size: var(--font-sm); display: flex; align-items: center; gap: 8px; }
        @media (max-width: 1024px) {
          .queue-page .qp-stat-grid { grid-template-columns: repeat(4, 1fr); }
        }
        @media (max-width: 640px) {
          .queue-page { padding: 12px !important; }
          .queue-page .qp-stat-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 16px; }
          .queue-page .qp-header-row { flex-direction: column; align-items: stretch; }
          .queue-page .qp-col-hide { display: none !important; }
          .queue-page .qp-quick-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
          .queue-page .qp-quick-actions .btn { justify-content: center; min-height: 44px !important; }
          .queue-page .tbl th, .queue-page .tbl td { padding: 6px 4px !important; font-size: 11px !important; }
          .queue-page .card.card-padded { padding: 12px !important; }
          .queue-page select { width: 100% !important; box-sizing: border-box; min-height: 44px !important; }
          .queue-page .qp-header-row > div { width: 100%; justify-content: space-between; flex-wrap: wrap; }
          .queue-page .qp-header-row input[type="checkbox"] { width: 18px; height: 18px; }
          /* Swap the table for stacked cards on phones so Status/Actions get full-width,
             easy-to-tap targets instead of being squeezed into narrow table cells. */
          .queue-page .qp-table-wrap { display: none !important; }
          .queue-page .qp-mobile-list { display: flex !important; }
        }
        .queue-page .qp-mobile-list { display: none; flex-direction: column; gap: 10px; }
        .queue-page .qp-mobile-card { border: 1px solid var(--border); border-radius: var(--radius); padding: 12px; }
        .queue-page .qp-mobile-card-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 8px; }
        .queue-page .qp-mobile-card-meta { font-size: var(--font-xs); color: var(--muted); display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 10px; }
        .queue-page .qp-mobile-card-actions .btn { width: 100%; justify-content: center; min-height: 44px !important; font-size: var(--font-sm) !important; padding: 10px !important; }
      `}</style>
      {/* Feedback banner */}
      {feedback && (
        <div className="qp-feedback" style={{ background: feedback.type === "error" ? "var(--red-bg)" : feedback.type === "success" ? "var(--green-bg,#f0fdf4)" : "var(--accent-soft)", color: feedback.type === "error" ? "var(--red)" : feedback.type === "success" ? "var(--green,#16a34a)" : "var(--accent)", border: `1px solid ${feedback.type === "error" ? "var(--red-border)" : feedback.type === "success" ? "var(--green-border,#86efac)" : "var(--accent-border,var(--border))"}` }}>
          <i className={`ti ${feedback.type === "error" ? "ti-alert-circle" : feedback.type === "success" ? "ti-circle-check" : "ti-info-circle"}`} />
          {feedback.message}
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <div className="qp-header-row">
          <h1 style={{ fontSize: "var(--font-xl)", fontWeight: 800, margin: 0 }}>
            Queue & Front Desk
          </h1>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ fontSize: "var(--font-sm)", display: "flex", alignItems: "center", gap: 4 }}>
              <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
              Auto-refresh
            </label>
            <span style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>
              Last updated: {lastRefresh.toLocaleTimeString()}
            </span>
            <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "4px 10px" }} title="Refresh queue now" onClick={() => { setLastRefresh(new Date()); setTick(t => t + 1); showFeedback("Queue refreshed.", "success"); }}>
              <i className="ti ti-refresh" style={{ fontSize: 12, marginRight: 3 }} />Refresh
            </button>
          </div>
        </div>
        <div style={{ fontSize: "var(--font-sm)", color: "var(--muted)", marginBottom: 10 }}>
          Manage patient flow, walk-ins, check-in/check-out, and waiting room
        </div>

        {/* Date controls */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
          <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "3px 8px" }} title="Previous day" onClick={() => {
            const d = new Date(selectedDate); d.setDate(d.getDate() - 1); setSelectedDate(d.toISOString().split("T")[0]);
          }}><i className="ti ti-chevron-left" /></button>
          {(["today","tomorrow","week"] as const).map(d => {
            const label = d === "today" ? "Today" : d === "tomorrow" ? "Tomorrow" : "This Week";
            const val = d === "today" ? todayStr : d === "tomorrow" ? (() => { const x = new Date(); x.setDate(x.getDate()+1); return x.toISOString().split("T")[0]; })() : "week";
            const active = selectedDate === val;
            return <button key={d} className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "3px 10px", fontWeight: active ? 700 : 400, background: active ? "var(--accent-soft)" : undefined, color: active ? "var(--accent)" : undefined }} onClick={() => setSelectedDate(val)}>{label}</button>;
          })}
          <input type="date" value={selectedDate === "week" ? todayStr : selectedDate} onChange={e => setSelectedDate(e.target.value)} style={{ fontSize: "var(--font-xs)", padding: "3px 6px", borderRadius: "var(--radius)", border: "1px solid var(--border)" }} />
          <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "3px 8px" }} title="Next day" onClick={() => {
            const d = new Date(selectedDate === "week" ? todayStr : selectedDate); d.setDate(d.getDate() + 1); setSelectedDate(d.toISOString().split("T")[0]);
          }}><i className="ti ti-chevron-right" /></button>
        </div>

        {/* Doctor filter + status filter + clear */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select value={selectedDoctor} onChange={e => setSelectedDoctor(e.target.value)} style={{ padding: "6px 10px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)", minHeight: 36 }}>
            <option value="All">All Doctors</option>
            {doctors.map(doc => <option key={doc} value={doc}>{doc}</option>)}
          </select>
          {(selectedDoctor !== "All" || statusFilter) && (
            <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "4px 10px" }} onClick={() => { setSelectedDoctor("All"); setStatusFilter(""); }}>
              <i className="ti ti-x" style={{ fontSize: 11, marginRight: 3 }} />Clear Filters
            </button>
          )}
          {selectedDoctor !== "All" && <span style={{ fontSize: "var(--font-xs)", color: "var(--accent)", fontWeight: 600 }}>🩺 {selectedDoctor}</span>}
          {statusFilter && <span style={{ fontSize: "var(--font-xs)", color: "var(--accent)", fontWeight: 600 }}>● {statusFilter.replace(/-/g," ")}</span>}
        </div>
      </div>

      <div className="qp-stat-grid">
        {([
          { label: "Scheduled",      status: "scheduled"       as const, color: "var(--blue)",   icon: "ti-calendar",       bg: "var(--blue-bg)"   },
          { label: "Checked In",     status: "checked-in"      as const, color: "var(--green)",  icon: "ti-login",          bg: "var(--green-bg)"  },
          { label: "Waiting",        status: "waiting"         as const, color: "var(--amber)",  icon: "ti-clock",          bg: "var(--amber-bg)"  },
          { label: "With Doctor",    status: "with-doctor"     as const, color: "var(--purple)", icon: "ti-stethoscope",    bg: "var(--purple-bg)" },
          { label: "Billing",        status: "billing-pending" as const, color: "var(--orange,#ea580c)", icon: "ti-receipt", bg: "var(--orange-bg,var(--amber-bg))" },
          { label: "Completed",      status: "completed"       as const, color: "var(--green)",  icon: "ti-circle-check",   bg: "var(--green-bg)"  },
          { label: "No Show",        status: "no-show"         as const, color: "var(--red)",    icon: "ti-circle-x",       bg: "var(--red-bg)"    },
          { label: "Cancelled",      status: "cancelled"       as const, color: "var(--muted)",  icon: "ti-ban",            bg: "var(--surface2)"  },
        ]).map(({ label, status, color, icon, bg }) => {
          const count = queuePatients.filter(q => q.status === status).length;
          const active = statusFilter === status;
          return (
            <StatCard key={status} label={label} value={count} color={color} icon={icon} bg={bg}
              active={active} onClick={() => setStatusFilter(active ? "" : status)} />
          );
        })}
      </div>

      <div className="card qp-table-wrap" style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
        <table className="tbl" style={{ minWidth: 480 }}>
          <thead>
            <tr>
              <th style={{ fontSize: "var(--font-xs)" }}>Token</th>
              <th style={{ fontSize: "var(--font-xs)" }}>Patient</th>
              <th style={{ fontSize: "var(--font-xs)" }}>Time</th>
              <th style={{ fontSize: "var(--font-xs)" }} className="qp-col-hide">Doctor</th>
              <th style={{ fontSize: "var(--font-xs)" }} className="qp-col-hide">Type</th>
              <th style={{ fontSize: "var(--font-xs)" }}>Status</th>
              <th style={{ fontSize: "var(--font-xs)" }}>Wait</th>
              <th style={{ fontSize: "var(--font-xs)" }} className="qp-col-hide">Duration</th>
              <th style={{ fontSize: "var(--font-xs)" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredQueue.length === 0 ? (
              <tr><td colSpan={9}>
                <div className="empty-state">
                  <div className="empty-state-sub">No patients in queue for this date/filter</div>
                  <div style={{ marginTop: 8, display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                    <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} onClick={() => { setSelectedDate(todayStr); setStatusFilter(""); setSelectedDoctor("All"); }}>Go to Today</button>
                    {(statusFilter || selectedDoctor !== "All") && <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} onClick={() => { setStatusFilter(""); setSelectedDoctor("All"); }}>Clear Filters</button>}
                  </div>
                </div>
              </td></tr>
            ) : filteredQueue.map(q => {
              const wt = q.waitingTime;
              const waitClass = wt >= 60 ? "qp-wait-60" : wt >= 30 ? "qp-wait-30" : wt >= 15 ? "qp-wait-15" : "";
              const waitLabel = wt <= 0 ? "—" : wt >= 60 ? `⚠ ${Math.floor(wt/60)}h ${wt%60}m` : wt >= 30 ? `🕐 ${wt}m` : `${wt}m`;
              return (
              <tr key={q.id} className={`tbl-row${q.priority ? " qp-priority-row" : ""}`} tabIndex={0} role="button" aria-label={`View details for ${q.patient.name}`} onKeyDown={e => { if (e.key === "Enter") setDetailPatient(q); }} onClick={() => setDetailPatient(q)}>
                <td style={{ fontSize: "var(--font-sm)", fontWeight: 700 }}>
                  {q.priority && <i className="ti ti-arrow-up" style={{ fontSize: 10, color: "var(--red)", marginRight: 2 }} title="Priority" />}
                  #{q.tokenNo}
                </td>
                <td>
                  <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{q.patient.name}</div>
                  <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{q.patient.id}</div>
                  {q.room && <div style={{ fontSize: "var(--font-xs)", color: "var(--accent)", fontWeight: 600 }}>📍 {q.room}</div>}
                  {q.note && <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", fontStyle: "italic" }}>"{q.note}"</div>}
                </td>
                <td style={{ fontSize: "var(--font-sm)" }}>{q.appointmentTime}</td>
                <td style={{ fontSize: "var(--font-sm)" }} className="qp-col-hide">{q.doctor}</td>
                <td style={{ fontSize: "var(--font-sm)" }} className="qp-col-hide">{q.visitType}</td>
                <td><StatusBadge status={q.status} /></td>
                <td className={waitClass} style={{ fontSize: "var(--font-sm)" }}>{waitLabel}</td>
                <td style={{ fontSize: "var(--font-sm)" }} className="qp-col-hide">
                  {q.consultationStartTime ? `${Math.floor((Date.now() - new Date(q.consultationStartTime).getTime()) / 60000)}m` : "—"}
                </td>
                <td>
                  <div style={{ display: "flex", gap: 4, flexDirection: "column", alignItems: "flex-start" }}>
                    <QueueActions status={q.status} onAction={(newStatus) => handleStatusChange(q.id, newStatus)} userRole={userRole} />
                    <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginTop: 2 }}>
                      <button className="btn btn-ghost" style={{ fontSize: 10, padding: "2px 6px", minHeight: 26 }} aria-label="View details for ${q.patient.name}" title="Details" onClick={() => setDetailPatient(q)}>
                        <i className="ti ti-info-circle" style={{ fontSize: 10 }} />
                      </button>
                      <button className="btn btn-ghost" style={{ fontSize: 10, padding: "2px 6px", minHeight: 26 }} aria-label="View patient profile for ${q.patient.name}" title="View patient" onClick={() => { if (onAction) onAction(`view-patient:${q.patient.id}`); else showFeedback(`Patient: ${q.patient.name} · ${q.patient.id}`, "info"); }}>
                        <i className="ti ti-user" style={{ fontSize: 10 }} />
                      </button>
                      {q.patient.phone
                        ? <a href={`tel:${q.patient.phone}`} className="btn btn-ghost" style={{ fontSize: 10, padding: "2px 6px", minHeight: 26, textDecoration: "none", display: "inline-flex", alignItems: "center" }} aria-label={`Call ${q.patient.name}`} title="Call"><i className="ti ti-phone" style={{ fontSize: 10 }} /></a>
                        : <button className="btn btn-ghost" style={{ fontSize: 10, padding: "2px 6px", minHeight: 26 }} aria-label="Call not available - no phone on file" title="Call — no phone on file" onClick={() => showFeedback(`${q.patient.name} has no phone number on file.`, "error")}><i className="ti ti-phone-off" style={{ fontSize: 10 }} /></button>
                      }
                      {(q.patient.phone || (q.patient as any).email)
                        ? <a href={q.patient.phone ? `sms:${q.patient.phone}` : `mailto:${(q.patient as any).email}`} className="btn btn-ghost" style={{ fontSize: 10, padding: "2px 6px", minHeight: 26, textDecoration: "none", display: "inline-flex", alignItems: "center" }} aria-label={`Message ${q.patient.name}`} title="Message"><i className="ti ti-message" style={{ fontSize: 10 }} /></a>
                        : <button className="btn btn-ghost" style={{ fontSize: 10, padding: "2px 6px", minHeight: 26 }} aria-label="Message not available - no contact info" title="Message — no contact info" onClick={() => showFeedback(`${q.patient.name} has no contact info.`, "error")}><i className="ti ti-message-off" style={{ fontSize: 10 }} /></button>
                      }
                      <button className="btn btn-ghost" style={{ fontSize: 10, padding: "2px 6px", minHeight: 26, color: q.priority ? "var(--amber)" : undefined }} aria-label={q.priority ? `Remove priority for ${q.patient.name}` : `Mark ${q.patient.name} as priority`} title={q.priority ? "Remove priority" : "Mark priority"} onClick={() => {
                        const next = { ...priorityMap, [q.id]: !q.priority };
                        if (!next[q.id]) delete next[q.id];
                        savePriority(next);
                        showFeedback(q.priority ? `${q.patient.name} priority removed.` : `${q.patient.name} marked priority.`, "info");
                      }}><i className="ti ti-arrow-up" style={{ fontSize: 10 }} /></button>
                    </div>
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      {/* Mobile-only stacked list — same data/handlers as the table above, just laid out for thumbs */}
      <div className="qp-mobile-list">
        {filteredQueue.length === 0 ? (
          <div className="card card-padded">
            <div className="empty-state">
              <div className="empty-state-sub">No patients in queue for this date/filter</div>
              <div style={{ marginTop: 8, display: "flex", gap: 8, justifyContent: "center" }}>
                <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} onClick={() => { setSelectedDate(todayStr); setStatusFilter(""); setSelectedDoctor("All"); }}>Go to Today</button>
              </div>
            </div>
          </div>
        ) : filteredQueue.map(q => {
          const wt = q.waitingTime;
          const waitClass = wt >= 60 ? "qp-wait-60" : wt >= 30 ? "qp-wait-30" : wt >= 15 ? "qp-wait-15" : "";
          const waitLabel = wt <= 0 ? "—" : wt >= 60 ? `⚠ ${Math.floor(wt/60)}h ${wt%60}m` : `${wt}m`;
          return (
          <div key={q.id} className={`card qp-mobile-card${q.priority ? " qp-priority-row" : ""}`}>
            <div className="qp-mobile-card-top">
              <div>
                <div style={{ fontSize: "var(--font-sm)", fontWeight: 700 }}>
                  {q.priority && <i className="ti ti-arrow-up" style={{ fontSize: 10, color: "var(--red)", marginRight: 3 }} />}
                  #{q.tokenNo} · {q.patient.name}
                </div>
                <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{q.patient.id}</div>
                {q.room && <div style={{ fontSize: "var(--font-xs)", color: "var(--accent)", fontWeight: 600 }}>📍 {q.room}</div>}
              </div>
              <StatusBadge status={q.status} />
            </div>
            <div className="qp-mobile-card-meta">
              <span><i className="ti ti-clock" style={{ fontSize: 11, marginRight: 3 }} />{q.appointmentTime}</span>
              <span><i className="ti ti-stethoscope" style={{ fontSize: 11, marginRight: 3 }} />{q.doctor}</span>
              <span className={waitClass}><i className="ti ti-hourglass" style={{ fontSize: 11, marginRight: 3 }} />{waitLabel}</span>
            </div>
            {q.note && <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", fontStyle: "italic", marginBottom: 6 }}>"{q.note}"</div>}
            <div className="qp-mobile-card-actions">
              <QueueActions status={q.status} onAction={(newStatus) => handleStatusChange(q.id, newStatus)} userRole={userRole} />
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "5px 10px", minHeight: 36, flex: 1 }} onClick={() => setDetailPatient(q)}>
                <i className="ti ti-info-circle" style={{ fontSize: 11, marginRight: 3 }} />Details
              </button>
              <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "5px 10px", minHeight: 36, flex: 1 }} onClick={() => { if (onAction) onAction(`view-patient:${q.patient.id}`); else showFeedback(`${q.patient.name} · ${q.patient.id}`, "info"); }}>
                <i className="ti ti-user" style={{ fontSize: 11, marginRight: 3 }} />Profile
              </button>
              {q.patient.phone
                ? <a href={`tel:${q.patient.phone}`} className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "5px 10px", minHeight: 36, flex: 1, textDecoration: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4 }}><i className="ti ti-phone" style={{ fontSize: 11 }} />Call</a>
                : <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "5px 10px", minHeight: 36, flex: 1 }} onClick={() => showFeedback(`${q.patient.name} has no phone number on file.`, "error")}><i className="ti ti-phone-off" style={{ fontSize: 11, marginRight: 3 }} />Call</button>
              }
            </div>
          </div>
          );
        })}
      </div>

      {/* Quick Actions Panel */}
      <div className="card card-padded" style={{ marginTop: 24 }}>
        <div className="section-label" style={{ marginBottom: 12 }}>Quick Actions</div>
        <div className="qp-quick-actions">
          <button className="btn btn-primary" style={{ fontSize: "var(--font-sm)", minHeight: 40 }} onClick={() => onAction?.("add-patient")}>
            <i className="ti ti-user-plus" style={{ fontSize: 12, marginRight: 4 }} />
            Walk-in Check-in
          </button>
          <button className="btn btn-ghost" style={{ fontSize: "var(--font-sm)", minHeight: 40 }} onClick={() => onAction?.("book-appointment")}>
            <i className="ti ti-calendar-plus" style={{ fontSize: 12, marginRight: 4 }} />
            Schedule Appointment
          </button>
          <button
            className="btn btn-ghost"
            style={{ fontSize: "var(--font-sm)", minHeight: 40 }}
            disabled={waitingRoom.length === 0}
            onClick={() => {
              const next = waitingRoom[0];
              if (next) { handleStatusChange(next.id, "with-doctor"); showFeedback(`Calling ${next.patient.name} (Token #${next.tokenNo})`, "info"); }
              else showFeedback("No patients waiting.", "info");
            }}
          >
            <i className="ti ti-phone-call" style={{ fontSize: 12, marginRight: 4 }} />
            Call Next Patient
          </button>
          <button className="btn btn-ghost" style={{ fontSize: "var(--font-sm)", minHeight: 40 }} onClick={() => onAction?.("create-invoice")}>
            <i className="ti ti-receipt" style={{ fontSize: 12, marginRight: 4 }} />
            Create Invoice
          </button>
          <button className="btn btn-ghost" style={{ fontSize: "var(--font-sm)", minHeight: 40 }} onClick={() => {
            if (filteredQueue.length === 0) { showFeedback("No queue patients to export.", "error"); return; }
            const rows = [
              ["Token","Patient ID","Patient Name","Doctor","Appt Time","Status","Wait (min)","Priority","Room","Note"],
              ...filteredQueue.map(q => [q.tokenNo, q.patient.id, q.patient.name, q.doctor, q.appointmentTime, q.status, q.waitingTime, q.priority ? "Yes" : "No", q.room || "", q.note || ""]),
            ];
            const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,"''")}"`).join(",")).join("\n");
            const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" })); a.download = `queue-${selectedDate}.csv`; a.click();
            showFeedback("Queue exported as CSV.", "success");
          }}>
            <i className="ti ti-table-export" style={{ fontSize: 12, marginRight: 4 }} />
            Export Queue CSV
          </button>
        </div>
      </div>

      {/* Activity Feed */}
      <div className="card card-padded" style={{ marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div className="section-label" style={{ margin: 0 }}>Activity Feed ({activityLog.length})</div>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "4px 8px" }} onClick={() => setShowActivity(!showActivity)}>
              <i className={`ti ${showActivity ? "ti-chevron-up" : "ti-chevron-down"}`} style={{ fontSize: 11, marginRight: 3 }} />
              {showActivity ? "Hide" : "Show"}
            </button>
            <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "4px 8px" }} onClick={() => {
              if (activityLog.length === 0) { showFeedback("No activity to export.", "error"); return; }
              const rows = [
                ["Timestamp","Patient ID","Patient Name","Action","Details"],
                ...activityLog.map(a => [a.timestamp, a.patientId, a.patientName, a.action, a.details || ""]),
              ];
              const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,"''")}"`).join(",")).join("\n");
              const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" })); a.download = `queue-activity-${new Date().toISOString().split("T")[0]}.csv`; a.click();
              showFeedback("Activity exported as CSV.", "success");
            }}>
              <i className="ti ti-table-export" style={{ fontSize: 11, marginRight: 3 }} />
              Export
            </button>
            <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "4px 8px", color: "var(--red)" }} onClick={() => {
              if (activityLog.length === 0) { showFeedback("No activity to clear.", "error"); return; }
              setClearActivityPending(true);
            }}>
              <i className="ti ti-trash" style={{ fontSize: 11, marginRight: 3 }} />
              Clear
            </button>
          </div>
        </div>
        {showActivity && (
          <div style={{ maxHeight: 200, overflowY: "auto", fontSize: "var(--font-xs)" }}>
            {activityLog.length === 0 ? (
              <div style={{ color: "var(--muted)", padding: "12px 0" }}>No activity recorded yet.</div>
            ) : (
              <table className="tbl" style={{ fontSize: "var(--font-xs)" }}>
                <thead>
                  <tr>
                    <th style={{ fontSize: "var(--font-xs)" }}>Time</th>
                    <th style={{ fontSize: "var(--font-xs)" }}>Patient</th>
                    <th style={{ fontSize: "var(--font-xs)" }}>Action</th>
                    <th style={{ fontSize: "var(--font-xs)" }}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {activityLog.map((a, idx) => (
                    <tr key={idx}>
                      <td style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{new Date(a.timestamp).toLocaleTimeString()}</td>
                      <td style={{ fontSize: "var(--font-xs)" }}>{a.patientName}</td>
                      <td style={{ fontSize: "var(--font-xs)" }}>{a.action}</td>
                      <td style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{a.details || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Detail modal */}
      {detailPatient && (() => {
        const q = filteredQueue.find(x => x.id === detailPatient.id) ?? detailPatient;
        const wt = q.waitingTime;
        const waitLabel = wt <= 0 ? "—" : wt >= 60 ? `${Math.floor(wt/60)}h ${wt%60}m` : `${wt}m`;
        return (
          <div className="qp-modal-backdrop" role="dialog" aria-modal="true" onClick={e => { if (e.target === e.currentTarget) setDetailPatient(null); }}>
            <div className="qp-modal">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: "var(--font-lg,1rem)" }}>{q.patient.name}</div>
                  <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{q.patient.id} · Token #{q.tokenNo}</div>
                </div>
                <button className="btn btn-ghost" style={{ padding: "2px 6px", fontSize: 14 }} title="Close (Esc)" onClick={() => setDetailPatient(null)}>✕</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px", fontSize: "var(--font-sm)", marginBottom: 16 }}>
                {([
                  ["Doctor",     q.doctor],
                  ["Appt Time",  q.appointmentTime],
                  ["Status",     q.status.replace(/-/g," ")],
                  ["Wait",       waitLabel],
                  ["Phone",      q.patient.phone || "—"],
                  ["Email",      (q.patient as any).email || "—"],
                  ["Insurance",  q.patient.insuranceStatus || "—"],
                  ["Consent",    (q.patient as any).consentStatus || "—"],
                  ["Room",       q.room || "—"],
                ] as [string,string][]).map(([label, val]) => (
                  <div key={label}><span style={{ color: "var(--muted)", fontSize: "var(--font-xs)" }}>{label}</span><br /><strong>{val}</strong></div>
                ))}
              </div>
              {q.patient.alerts && (q.patient.alerts as any[]).length > 0 && (
                <div style={{ marginBottom: 12, padding: "8px 10px", background: "var(--red-bg)", border: "1px solid var(--red-border)", borderRadius: "var(--radius)", fontSize: "var(--font-xs)", color: "var(--red)" }}>
                  <i className="ti ti-alert-triangle" style={{ marginRight: 4 }} />
                  {(q.patient.alerts as any[]).map((a: any) => a.message || a).join(" · ")}
                </div>
              )}
              {/* note */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: "var(--font-xs)", fontWeight: 700, marginBottom: 4 }}>Queue Note</div>
                {editingNote?.id === q.id ? (
                  <div style={{ display: "flex", gap: 4 }}>
                    <input value={editingNote.text} onChange={e => setEditingNote({ id: q.id, text: e.target.value })} style={{ flex: 1, fontSize: "var(--font-xs)", padding: "4px 8px", borderRadius: "var(--radius)", border: "1px solid var(--border)" }} onKeyDown={e => { if (e.key === "Enter") { saveNotes({ ...notesMap, [q.id]: editingNote.text }); setEditingNote(null); showFeedback("Note saved.", "success"); } }} autoFocus />
                    <button className="btn btn-primary" style={{ fontSize: "var(--font-xs)", padding: "4px 8px" }} onClick={() => { saveNotes({ ...notesMap, [q.id]: editingNote.text }); setEditingNote(null); showFeedback("Note saved.", "success"); }}>Save</button>
                    <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "4px 8px" }} onClick={() => setEditingNote(null)}>✕</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <span style={{ fontSize: "var(--font-xs)", color: q.note ? "var(--fg)" : "var(--muted)", flex: 1 }}>{q.note || "No note"}</span>
                    <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "2px 6px" }} onClick={() => setEditingNote({ id: q.id, text: q.note || "" })}>Edit</button>
                    {q.note && <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "2px 6px", color: "var(--red)" }} onClick={() => { const m = { ...notesMap }; delete m[q.id]; saveNotes(m); showFeedback("Note deleted.", "info"); }}>Delete</button>}
                  </div>
                )}
              </div>
              {/* room */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: "var(--font-xs)", fontWeight: 700, marginBottom: 4 }}>Room Assignment</div>
                {editingRoom?.id === q.id ? (
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {["Room 1","Room 2","Room 3","Room 4"].map(r => (
                      <button key={r} className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "3px 8px", background: editingRoom.text === r ? "var(--accent-soft)" : undefined, color: editingRoom.text === r ? "var(--accent)" : undefined }} onClick={() => setEditingRoom({ id: q.id, text: r })}>{r}</button>
                    ))}
                    <input value={editingRoom.text} onChange={e => setEditingRoom({ id: q.id, text: e.target.value })} placeholder="Custom…" style={{ fontSize: "var(--font-xs)", padding: "3px 6px", borderRadius: "var(--radius)", border: "1px solid var(--border)", width: 80 }} />
                    <button className="btn btn-primary" style={{ fontSize: "var(--font-xs)", padding: "4px 8px" }} onClick={() => { saveRooms({ ...roomsMap, [q.id]: editingRoom.text }); setEditingRoom(null); showFeedback(`Room set to ${editingRoom.text}.`, "success"); }}>Assign</button>
                    {q.room && <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "4px 8px", color: "var(--red)" }} onClick={() => { const m = { ...roomsMap }; delete m[q.id]; saveRooms(m); setEditingRoom(null); showFeedback("Room cleared.", "info"); }}>Clear</button>}
                    <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "4px 8px" }} onClick={() => setEditingRoom(null)}>✕</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <span style={{ fontSize: "var(--font-xs)", color: q.room ? "var(--accent)" : "var(--muted)", flex: 1 }}>{q.room || "Unassigned"}</span>
                    <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "2px 6px" }} onClick={() => setEditingRoom({ id: q.id, text: q.room || "" })}>Assign Room</button>
                  </div>
                )}
              </div>
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                <div style={{ fontSize: "var(--font-xs)", fontWeight: 700, marginBottom: 8 }}>Workflow</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <QueueActions status={q.status} onAction={newStatus => { handleStatusChange(q.id, newStatus); setDetailPatient(prev => prev ? { ...prev, status: newStatus } : null); }} userRole={userRole} />
                  {q.patient.phone && <a href={`tel:${q.patient.phone}`} className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "5px 10px", minHeight: 32, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}><i className="ti ti-phone" style={{ fontSize: 11 }} />Call</a>}
                  <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "5px 10px", minHeight: 32 }} onClick={() => { if (onAction) onAction(`view-patient:${q.patient.id}`); else showFeedback(`${q.patient.name} · ${q.patient.id}`, "info"); setDetailPatient(null); }}>
                    <i className="ti ti-user" style={{ fontSize: 11, marginRight: 3 }} />View Profile
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Confirm risky transition modal */}
      {confirmPending && (
        <div className="qp-modal-backdrop" role="dialog" aria-modal="true">
          <div className="qp-modal" style={{ maxWidth: 340 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Confirm Status Change</div>
            <div style={{ fontSize: "var(--font-sm)", color: "var(--muted)", marginBottom: 16 }}>{confirmPending.label}</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => setConfirmPending(null)}>Cancel</button>
              <button className="btn btn-danger" style={{ background: "var(--red)", color: "#fff" }} onClick={() => { handleStatusChange(confirmPending.patientId, confirmPending.newStatus, true); setConfirmPending(null); }}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* Clear activity confirmation modal */}
      {clearActivityPending && (
        <div className="qp-modal-backdrop" role="dialog" aria-modal="true">
          <div className="qp-modal" style={{ maxWidth: 340 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Clear Activity Log</div>
            <div style={{ fontSize: "var(--font-sm)", color: "var(--muted)", marginBottom: 16 }}>This will permanently delete all {activityLog.length} activity entries. This action cannot be undone.</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => setClearActivityPending(false)}>Cancel</button>
              <button className="btn btn-danger" style={{ background: "var(--red)", color: "#fff" }} onClick={() => {
                setActivityLog([]);
                try { localStorage.setItem(ACTIVITY_KEY, "[]"); } catch {}
                setClearActivityPending(false);
                showFeedback("Activity log cleared.", "success");
              }}>Clear All</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color, icon, bg, active, onClick }: {
  label: string;
  value: number;
  color: string;
  icon: string;
  bg: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <div className="card card-padded" onClick={onClick} style={{ display: "flex", flexDirection: "column", gap: 8, cursor: onClick ? "pointer" : undefined, outline: active ? `2px solid ${color}` : undefined, outlineOffset: -2 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 32, height: 32, borderRadius: "var(--radius)", background: bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <i className={`ti ${icon}`} style={{ fontSize: 16, color }} />
        </div>
        <span style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{label}</span>
      </div>
      <div style={{ fontSize: "var(--font-xl)", fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: QueuePatient["status"] }) {
  const colors: Record<QueuePatient["status"], { bg: string; color: string; border: string }> = {
    "scheduled": { bg: "var(--blue-bg)", color: "var(--blue)", border: "var(--blue-border)" },
    "checked-in": { bg: "var(--green-bg)", color: "var(--green)", border: "var(--green-border)" },
    "waiting": { bg: "var(--amber-bg)", color: "var(--amber)", border: "var(--amber-border)" },
    "with-doctor": { bg: "var(--purple-bg)", color: "var(--purple)", border: "var(--purple-border)" },
    "billing-pending": { bg: "var(--orange-bg)", color: "var(--orange)", border: "var(--orange-border)" },
    "completed": { bg: "var(--green-bg)", color: "var(--green)", border: "var(--green-border)" },
    "no-show": { bg: "var(--red-bg)", color: "var(--red)", border: "var(--red-border)" },
    "cancelled": { bg: "var(--gray-bg)", color: "var(--gray)", border: "var(--gray-border)" },
  };
  const c = colors[status];
  return (
    <span className="badge" style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}`, fontSize: "var(--font-xs)" }}>
      {status.replace("-", " ").replace(/\b\w/g, l => l.toUpperCase())}
    </span>
  );
}

function QueueActions({ status, onAction, userRole = "admin" }: { status: QueuePatient["status"]; onAction: (newStatus: QueuePatient["status"]) => void; userRole?: "receptionist" | "doctor" | "admin" }) {
  const canSendToDoctor = userRole === "admin" || userRole === "doctor";
  const canComplete = userRole === "admin" || userRole === "doctor";
  const canCheckIn = userRole === "admin" || userRole === "receptionist";
  const canMarkWaiting = userRole === "admin" || userRole === "receptionist";
  const canBilling = userRole === "admin" || userRole === "receptionist";
  const canNoShow = userRole === "admin" || userRole === "receptionist";
  const canCancel = userRole === "admin" || userRole === "receptionist";
  const canReopen = userRole === "admin";

  const actions: Record<QueuePatient["status"], any> = {
    "scheduled": (
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        <button 
          className="btn btn-primary" 
          style={{ fontSize: "var(--font-xs)", padding: "5px 10px", minHeight: 32 }} 
          onClick={() => onAction("checked-in")}
          disabled={!canCheckIn}
          title={!canCheckIn ? "Only receptionists and admins can check in patients" : undefined}
        >Check In</button>
        <button 
          className="btn btn-ghost" 
          style={{ fontSize: "var(--font-xs)", padding: "5px 10px", minHeight: 32 }} 
          onClick={() => onAction("no-show")}
          disabled={!canNoShow}
          title={!canNoShow ? "Only receptionists and admins can mark no-show" : undefined}
        >No Show</button>
        <button 
          className="btn btn-ghost" 
          style={{ fontSize: "var(--font-xs)", padding: "5px 10px", minHeight: 32 }} 
          onClick={() => onAction("cancelled")}
          disabled={!canCancel}
          title={!canCancel ? "Only receptionists and admins can cancel appointments" : undefined}
        >Cancel</button>
      </div>
    ),
    "checked-in": (
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        <button 
          className="btn btn-primary" 
          style={{ fontSize: "var(--font-xs)", padding: "5px 10px", minHeight: 32 }} 
          onClick={() => onAction("with-doctor")}
          disabled={!canSendToDoctor}
          title={!canSendToDoctor ? "Only doctors and admins can send patients to doctor" : undefined}
        >Send to Doctor</button>
        <button 
          className="btn btn-ghost" 
          style={{ fontSize: "var(--font-xs)", padding: "5px 10px", minHeight: 32 }} 
          onClick={() => onAction("waiting")}
          disabled={!canMarkWaiting}
          title={!canMarkWaiting ? "Only receptionists and admins can mark waiting" : undefined}
        >Mark Waiting</button>
        <button 
          className="btn btn-ghost" 
          style={{ fontSize: "var(--font-xs)", padding: "5px 10px", minHeight: 32 }} 
          onClick={() => onAction("no-show")}
          disabled={!canNoShow}
          title={!canNoShow ? "Only receptionists and admins can mark no-show" : undefined}
        >No Show</button>
        <button 
          className="btn btn-ghost" 
          style={{ fontSize: "var(--font-xs)", padding: "5px 10px", minHeight: 32 }} 
          onClick={() => onAction("cancelled")}
          disabled={!canCancel}
          title={!canCancel ? "Only receptionists and admins can cancel appointments" : undefined}
        >Cancel</button>
      </div>
    ),
    "waiting": (
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        <button 
          className="btn btn-primary" 
          style={{ fontSize: "var(--font-xs)", padding: "5px 10px", minHeight: 32 }} 
          onClick={() => onAction("with-doctor")}
          disabled={!canSendToDoctor}
          title={!canSendToDoctor ? "Only doctors and admins can send patients to doctor" : undefined}
        >Send to Doctor</button>
        <button 
          className="btn btn-ghost" 
          style={{ fontSize: "var(--font-xs)", padding: "5px 10px", minHeight: 32 }} 
          onClick={() => onAction("checked-in")}
          disabled={!canCheckIn}
          title={!canCheckIn ? "Only receptionists and admins can check in patients" : undefined}
        >Check In</button>
        <button 
          className="btn btn-ghost" 
          style={{ fontSize: "var(--font-xs)", padding: "5px 10px", minHeight: 32 }} 
          onClick={() => onAction("no-show")}
          disabled={!canNoShow}
          title={!canNoShow ? "Only receptionists and admins can mark no-show" : undefined}
        >No Show</button>
        <button 
          className="btn btn-ghost" 
          style={{ fontSize: "var(--font-xs)", padding: "5px 10px", minHeight: 32 }} 
          onClick={() => onAction("cancelled")}
          disabled={!canCancel}
          title={!canCancel ? "Only receptionists and admins can cancel appointments" : undefined}
        >Cancel</button>
      </div>
    ),
    "with-doctor": (
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        <button 
          className="btn btn-primary" 
          style={{ fontSize: "var(--font-xs)", padding: "5px 10px", minHeight: 32 }} 
          onClick={() => onAction("billing-pending")}
          disabled={!canBilling}
          title={!canBilling ? "Only receptionists and admins can send to billing" : undefined}
        >Send to Billing</button>
        <button 
          className="btn btn-ghost" 
          style={{ fontSize: "var(--font-xs)", padding: "5px 10px", minHeight: 32 }} 
          onClick={() => onAction("completed")}
          disabled={!canComplete}
          title={!canComplete ? "Only doctors and admins can complete consultations" : undefined}
        >Complete</button>
        <button 
          className="btn btn-ghost" 
          style={{ fontSize: "var(--font-xs)", padding: "5px 10px", minHeight: 32 }} 
          onClick={() => onAction("waiting")}
          disabled={!canMarkWaiting}
          title={!canMarkWaiting ? "Only receptionists and admins can send to waiting" : undefined}
        >Send to Waiting</button>
      </div>
    ),
    "billing-pending": (
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        <button 
          className="btn btn-primary" 
          style={{ fontSize: "var(--font-xs)", padding: "5px 10px", minHeight: 32 }} 
          onClick={() => onAction("completed")}
          disabled={!canComplete}
          title={!canComplete ? "Only doctors and admins can complete consultations" : undefined}
        >Mark Completed</button>
        <button 
          className="btn btn-ghost" 
          style={{ fontSize: "var(--font-xs)", padding: "5px 10px", minHeight: 32 }} 
          onClick={() => onAction("with-doctor")}
          disabled={!canSendToDoctor}
          title={!canSendToDoctor ? "Only doctors and admins can send back to doctor" : undefined}
        >Back to Doctor</button>
      </div>
    ),
    "completed": (
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        <span style={{ fontSize: "var(--font-xs)", color: "var(--green)", fontWeight: 600, display: "flex", alignItems: "center" }}>✓ Completed</span>
        <button 
          className="btn btn-ghost" 
          style={{ fontSize: "var(--font-xs)", padding: "5px 10px", minHeight: 32 }} 
          onClick={() => onAction("scheduled")}
          disabled={!canReopen}
          title={!canReopen ? "Only admins can reopen completed visits" : undefined}
        >Reopen</button>
      </div>
    ),
    "no-show": (
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        <button 
          className="btn btn-primary" 
          style={{ fontSize: "var(--font-xs)", padding: "5px 10px", minHeight: 32 }} 
          onClick={() => onAction("scheduled")}
          disabled={!canCheckIn}
          title={!canCheckIn ? "Only receptionists and admins can reschedule" : undefined}
        >Reschedule</button>
        <button 
          className="btn btn-ghost" 
          style={{ fontSize: "var(--font-xs)", padding: "5px 10px", minHeight: 32 }} 
          onClick={() => onAction("checked-in")}
          disabled={!canCheckIn}
          title={!canCheckIn ? "Only receptionists and admins can check in patients" : undefined}
        >Check In</button>
      </div>
    ),
    "cancelled": (
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        <button 
          className="btn btn-primary" 
          style={{ fontSize: "var(--font-xs)", padding: "5px 10px", minHeight: 32 }} 
          onClick={() => onAction("scheduled")}
          disabled={!canCheckIn}
          title={!canCheckIn ? "Only receptionists and admins can restore appointments" : undefined}
        >Restore</button>
        <button 
          className="btn btn-ghost" 
          style={{ fontSize: "var(--font-xs)", padding: "5px 10px", minHeight: 32 }} 
          onClick={() => onAction("checked-in")}
          disabled={!canCheckIn}
          title={!canCheckIn ? "Only receptionists and admins can check in patients" : undefined}
        >Check In</button>
      </div>
    ),
  };
  return actions[status];
}
