import React, { useState, useMemo, useEffect } from "react";
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
}

export default function QueuePage({
  patients,
  onUpdatePatient,
  onAction,
}: {
  patients: Patient[];
  onUpdatePatient?: (updated: Patient, action?: string) => void;
  onAction?: (actionId: string) => void;
}) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedDoctor, setSelectedDoctor] = useState("All");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const today = new Date().toISOString().split("T")[0];

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      setLastRefresh(new Date());
    }, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const queuePatients = useMemo(() => {
    const todayAppointments = patients.filter(p => {
      if (!p.nextAppointment) return false;
      const appointmentDate = new Date(p.nextAppointment).toISOString().split("T")[0];
      return appointmentDate === today;
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
        // NOTE: there is no real consultation-start timestamp on the Patient record yet, so duration
        // is intentionally left undefined here rather than fabricated. If per-consult duration needs to
        // show on this page, Patient needs a real `consultationStartedAt` field set when status → "In Progress".
        consultationStartTime: undefined,
      };
    }).sort((a, b) => {
      const statusPriority = { "with-doctor": 0, "checked-in": 1, "waiting": 2, "scheduled": 3, "completed": 4, "billing-pending": 5, "no-show": 6, "cancelled": 7 };
      return statusPriority[a.status] - statusPriority[b.status] || a.tokenNo - b.tokenNo;
    });
  }, [patients, today]);

  const filteredQueue = selectedDoctor === "All" 
    ? queuePatients 
    : queuePatients.filter(q => q.doctor === selectedDoctor);

  const waitingRoom = filteredQueue.filter(q => q.status === "checked-in" || q.status === "waiting");
  const inProgress = filteredQueue.filter(q => q.status === "with-doctor");
  const completed = filteredQueue.filter(q => q.status === "completed");
  const billingPending = filteredQueue.filter(q => q.status === "billing-pending");

  const doctors = useMemo(() => {
    const docSet = new Set(patients.map(p => p.doctor).filter(Boolean));
    return Array.from(docSet).sort();
  }, [patients]);

  const handleStatusChange = (patientId: string, newStatus: QueuePatient["status"]) => {
    const patient = patients.find(p => p.id === patientId);
    if (!patient) return;

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

    onUpdatePatient?.({ ...patient, status: statusMap[newStatus] }, `moved to ${statusMap[newStatus]}`);
  };

  return (
    <div className="queue-page" style={{ padding: 24, width: "100%", boxSizing: "border-box" }}>
      <style>{`
        .queue-page .qp-stat-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 24px; }
        .queue-page .qp-header-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; gap: 12px; flex-wrap: wrap; }
        .queue-page .qp-quick-actions { display: flex; gap: 8px; flex-wrap: wrap; }
        .queue-page .qp-col-hide { display: table-cell; }
        @media (max-width: 1024px) {
          .queue-page .qp-stat-grid { grid-template-columns: repeat(3, 1fr); }
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
      <div style={{ marginBottom: 24 }}>
        <div className="qp-header-row">
          <h1 style={{ fontSize: "var(--font-xl)", fontWeight: 800, margin: 0 }}>
            Queue & Front Desk
          </h1>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <label style={{ fontSize: "var(--font-sm)", display: "flex", alignItems: "center", gap: 4 }}>
              <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
              Auto-refresh
            </label>
            <span style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>
              Last updated: {lastRefresh.toLocaleTimeString()}
            </span>
          </div>
        </div>
        <div style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>
          Manage patient flow, walk-ins, check-in/check-out, and waiting room
        </div>
      </div>

      <div className="qp-stat-grid">
        <StatCard label="Waiting Room" value={waitingRoom.length} color="var(--amber)" icon="ti-users" bg="var(--amber-bg)" />
        <StatCard label="In Progress" value={inProgress.length} color="var(--blue)" icon="ti-activity" bg="var(--blue-bg)" />
        <StatCard label="Completed" value={completed.length} color="var(--green)" icon="ti-check" bg="var(--green-bg)" />
        <StatCard label="Billing Pending" value={billingPending.length} color="var(--purple)" icon="ti-receipt" bg="var(--purple-bg)" />
        <StatCard label="Total Today" value={filteredQueue.length} color="var(--accent)" icon="ti-calendar" bg="var(--accent-soft)" />
      </div>

      <div style={{ marginBottom: 16 }}>
        <select 
          value={selectedDoctor} 
          onChange={(e) => setSelectedDoctor(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)", minHeight: 40 }}
        >
          <option value="All">All Doctors</option>
          {doctors.map(doc => <option key={doc} value={doc}>{doc}</option>)}
        </select>
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
              <tr><td colSpan={9}><div className="empty-state"><div className="empty-state-sub">No patients in queue</div></div></td></tr>
            ) : filteredQueue.map(q => (
              <tr key={q.id} className="tbl-row">
                <td style={{ fontSize: "var(--font-sm)", fontWeight: 700 }}>#{q.tokenNo}</td>
                <td>
                  <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{q.patient.name}</div>
                  <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{q.patient.id}</div>
                </td>
                <td style={{ fontSize: "var(--font-sm)" }}>{q.appointmentTime}</td>
                <td style={{ fontSize: "var(--font-sm)" }} className="qp-col-hide">{q.doctor}</td>
                <td style={{ fontSize: "var(--font-sm)" }} className="qp-col-hide">{q.visitType}</td>
                <td>
                  <StatusBadge status={q.status} />
                </td>
                <td style={{ fontSize: "var(--font-sm)" }}>{q.waitingTime}m</td>
                <td style={{ fontSize: "var(--font-sm)" }} className="qp-col-hide">
                  {q.consultationStartTime ? `${Math.floor((Date.now() - new Date(q.consultationStartTime).getTime()) / 60000)}m` : "—"}
                </td>
                <td>
                  <QueueActions status={q.status} onAction={(newStatus) => handleStatusChange(q.id, newStatus)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* Mobile-only stacked list — same data/handlers as the table above, just laid out for thumbs */}
      <div className="qp-mobile-list">
        {filteredQueue.length === 0 ? (
          <div className="card card-padded">
            <div className="empty-state"><div className="empty-state-sub">No patients in queue</div></div>
          </div>
        ) : filteredQueue.map(q => (
          <div key={q.id} className="card qp-mobile-card">
            <div className="qp-mobile-card-top">
              <div>
                <div style={{ fontSize: "var(--font-sm)", fontWeight: 700 }}>#{q.tokenNo} · {q.patient.name}</div>
                <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{q.patient.id}</div>
              </div>
              <StatusBadge status={q.status} />
            </div>
            <div className="qp-mobile-card-meta">
              <span><i className="ti ti-clock" style={{ fontSize: 11, marginRight: 3 }} />{q.appointmentTime}</span>
              <span><i className="ti ti-stethoscope" style={{ fontSize: 11, marginRight: 3 }} />{q.doctor}</span>
              <span><i className="ti ti-hourglass" style={{ fontSize: 11, marginRight: 3 }} />{q.waitingTime}m wait</span>
            </div>
            <div className="qp-mobile-card-actions">
              <QueueActions status={q.status} onAction={(newStatus) => handleStatusChange(q.id, newStatus)} />
            </div>
          </div>
        ))}
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
              if (next) handleStatusChange(next.id, "with-doctor");
            }}
          >
            <i className="ti ti-phone-call" style={{ fontSize: 12, marginRight: 4 }} />
            Call Next Patient
          </button>
          <button className="btn btn-ghost" style={{ fontSize: "var(--font-sm)", minHeight: 40 }} onClick={() => onAction?.("create-invoice")}>
            <i className="ti ti-receipt" style={{ fontSize: 12, marginRight: 4 }} />
            Create Invoice
          </button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color, icon, bg }: {
  label: string;
  value: number;
  color: string;
  icon: string;
  bg: string;
}) {
  return (
    <div className="card card-padded" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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

function QueueActions({ status, onAction }: { status: QueuePatient["status"]; onAction: (newStatus: QueuePatient["status"]) => void }) {
  const actions: Record<QueuePatient["status"], JSX.Element> = {
    "scheduled": <button className="btn btn-primary" style={{ fontSize: "var(--font-xs)", padding: "5px 10px", minHeight: 32 }} onClick={() => onAction("checked-in")}>Check In</button>,
    "checked-in": <button className="btn btn-primary" style={{ fontSize: "var(--font-xs)", padding: "5px 10px", minHeight: 32 }} onClick={() => onAction("with-doctor")}>Start</button>,
    "waiting": <button className="btn btn-primary" style={{ fontSize: "var(--font-xs)", padding: "5px 10px", minHeight: 32 }} onClick={() => onAction("with-doctor")}>Start</button>,
    "with-doctor": <button className="btn btn-primary" style={{ fontSize: "var(--font-xs)", padding: "5px 10px", minHeight: 32 }} onClick={() => onAction("billing-pending")}>Complete</button>,
    "billing-pending": <button className="btn btn-primary" style={{ fontSize: "var(--font-xs)", padding: "5px 10px", minHeight: 32 }} onClick={() => onAction("completed")}>Bill</button>,
    "completed": <span style={{ fontSize: "var(--font-xs)", color: "var(--green)" }}>✓ Done</span>,
    "no-show": <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "5px 10px", minHeight: 32 }} onClick={() => onAction("scheduled")}>Reschedule</button>,
    "cancelled": <span style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>—</span>,
  };
  return actions[status];
}
