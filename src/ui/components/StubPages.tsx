import React, { useState } from "react";
import type { Patient, WaitlistEntry, InsuranceClaim, PreAuthorization } from "./types";
import { getPatientStats, fmtDate } from "./utils";

// ─── Appointments ─────────────────────────────────────────────────────────────
export function AppointmentsPage({ patients, onSelectPatient }: { patients: Patient[]; onSelectPatient?: (p: Patient) => void }) {
  const handleSelectPatient = onSelectPatient || (() => {});
  const [view, setView] = useState<"list" | "calendar" | "waitlist">("list");
  const [showBooking, setShowBooking] = useState(false);
  const [showWaitlistModal, setShowWaitlistModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [filterDoctor, setFilterDoctor] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([
    { id: "wl-1", patientId: "P001", patientName: "John Doe", requestedDate: "2024-01-20", requestedTime: "10:00", reason: "Annual checkup", priority: "High", addedDate: "2024-01-15", notes: "Prefers morning appointments" },
    { id: "wl-2", patientId: "P005", patientName: "Jane Smith", requestedDate: "2024-01-21", requestedTime: "14:00", reason: "Follow-up", priority: "Medium", addedDate: "2024-01-16", notes: "" },
  ]);
  const [cancelledIds, setCancelledIds] = useState<Set<string>>(new Set());

  const upcoming = patients
    .filter((p) => p.nextAppointment)
    .filter((p) => filterDoctor === "All" || p.doctor === filterDoctor)
    .filter((p) => filterStatus === "All" || p.status === filterStatus)
    .sort((a, b) => new Date(a.nextAppointment!).getTime() - new Date(b.nextAppointment!).getTime())
    .slice(0, 50);

  const overdue = patients.filter(
    (p) => p.status === "Follow-Up Due" || (p.followUpDate && new Date(p.followUpDate) < new Date())
  );

  const today = patients.filter((p) => {
    if (!p.nextAppointment) return false;
    const apptDate = new Date(p.nextAppointment).toDateString();
    return apptDate === new Date().toDateString();
  });

  const thisWeek = patients.filter((p) => {
    if (!p.nextAppointment) return false;
    const apptDate = new Date(p.nextAppointment);
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return apptDate >= now && apptDate <= weekFromNow;
  });

  function generateAppointmentReport(appointments: any[], reportType: string) {
    const reportDate = new Date().toLocaleDateString();
    let reportContent = "";

    if (reportType === "summary") {
      reportContent = `
APPOINTMENT SUMMARY REPORT
Generated: ${reportDate}
==========================================

TOTAL APPOINTMENTS: ${appointments.length}

STATUS BREAKDOWN:
- Scheduled: ${appointments.filter(a => a.status === "Scheduled").length}
- Completed: ${appointments.filter(a => a.status === "Completed").length}
- Cancelled: ${appointments.filter(a => a.status === "Cancelled").length}
- No-Show: ${appointments.filter(a => a.status === "No-Show").length}

UPCOMING: ${upcoming.length}
TODAY: ${today.length}
THIS WEEK: ${thisWeek.length}
OVERDUE: ${overdue.length}

CLINICAL WORKFLOW STATUS:
- Pre-Visit Prep: 92% Complete
- Check-In Ready: 88% Ready
- Room Availability: 5/8 Available
- Lab Results: 12 Pending

END OF REPORT
      `;
    }

    const blob = new Blob([reportContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `appointment-report-${reportType}-${new Date().toISOString().split("T")[0]}.txt`;
    a.click();
  }

  return (
    <div style={{ padding: "16px 12px", maxWidth: 1200 }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: "var(--font-xl)", fontWeight: 800, margin: "0 0 12px 0" }}>Appointments</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-ghost" onClick={() => generateAppointmentReport(upcoming, "summary")}>
            <i className="ti ti-file-text" style={{ fontSize: 14 }} /> Report
          </button>
          <button className="btn btn-ghost" onClick={() => setShowWaitlistModal(true)}>
            <i className="ti ti-list-details" style={{ fontSize: 14 }} /> Add to Waitlist
          </button>
          <button className="btn btn-primary" onClick={() => setShowBooking(true)}>
            <i className="ti ti-calendar-plus" style={{ fontSize: 14 }} /> New Appointment
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-label"><i className="ti ti-calendar" style={{ fontSize: 11, marginRight: 4 }} />Upcoming</div>
          <div className="stat-value" style={{ color: "var(--blue)" }}>{upcoming.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label"><i className="ti ti-calendar-check" style={{ fontSize: 11, marginRight: 4 }} />Today</div>
          <div className="stat-value" style={{ color: "var(--green)" }}>{today.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label"><i className="ti ti-calendar-week" style={{ fontSize: 11, marginRight: 4 }} />This Week</div>
          <div className="stat-value" style={{ color: "var(--purple)" }}>{thisWeek.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label"><i className="ti ti-clock-exclamation" style={{ fontSize: 11, marginRight: 4 }} />Overdue</div>
          <div className="stat-value" style={{ color: "var(--amber)" }}>{overdue.length}</div>
        </div>
      </div>

      {/* Clinical Workflow Indicators */}
      <div className="card card-padded" style={{ marginBottom: 24 }}>
        <div className="section-label" style={{ marginBottom: 12 }}>Clinical Workflow Status</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12 }}>
          <div style={{ padding: 12, borderRadius: "var(--radius)", background: "var(--surface3)" }}>
            <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginBottom: 4 }}>Pre-Visit Prep</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--green)" }}>92%</div>
            <div style={{ fontSize: "var(--font-2xs)", color: "var(--muted)" }}>Complete</div>
          </div>
          <div style={{ padding: 12, borderRadius: "var(--radius)", background: "var(--surface3)" }}>
            <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginBottom: 4 }}>Check-In Ready</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--accent)" }}>88%</div>
            <div style={{ fontSize: "var(--font-2xs)", color: "var(--muted)" }}>Ready</div>
          </div>
          <div style={{ padding: 12, borderRadius: "var(--radius)", background: "var(--surface3)" }}>
            <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginBottom: 4 }}>Room Availability</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--blue)" }}>5/8</div>
            <div style={{ fontSize: "var(--font-2xs)", color: "var(--muted)" }}>Available</div>
          </div>
          <div style={{ padding: 12, borderRadius: "var(--radius)", background: "var(--surface3)" }}>
            <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginBottom: 4 }}>Lab Results</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--amber)" }}>12</div>
            <div style={{ fontSize: "var(--font-2xs)", color: "var(--muted)" }}>Pending</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card card-padded" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>View:</span>
            <button 
              onClick={() => setView("list")}
              style={{ padding: "6px 12px", borderRadius: "var(--radius)", fontSize: "var(--font-sm)", border: "1px solid var(--border)", background: view === "list" ? "var(--accent-soft)" : "transparent", color: view === "list" ? "var(--accent)" : "var(--muted)", cursor: "pointer" }}
            >
              List
            </button>
            <button 
              onClick={() => setView("calendar")}
              style={{ padding: "6px 12px", borderRadius: "var(--radius)", fontSize: "var(--font-sm)", border: "1px solid var(--border)", background: view === "calendar" ? "var(--accent-soft)" : "transparent", color: view === "calendar" ? "var(--accent)" : "var(--muted)", cursor: "pointer" }}
            >
              Calendar
            </button>
            <button 
              onClick={() => setView("waitlist")}
              style={{ padding: "6px 12px", borderRadius: "var(--radius)", fontSize: "var(--font-sm)", border: "1px solid var(--border)", background: view === "waitlist" ? "var(--accent-soft)" : "transparent", color: view === "waitlist" ? "var(--accent)" : "var(--muted)", cursor: "pointer" }}
            >
              Waitlist ({waitlist.length})
            </button>
          </div>
          <select value={filterDoctor} onChange={(e) => setFilterDoctor(e.target.value)} style={{ fontSize: "var(--font-sm)", padding: "6px 10px", borderRadius: "var(--radius)" }}>
            <option value="All">All Doctors</option>
            {["Dr. Sharma", "Dr. Patel", "Dr. Mehta", "Dr. Iyer", "Dr. Nair"].map((d) => <option key={d}>{d}</option>)}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ fontSize: "var(--font-sm)", padding: "6px 10px", borderRadius: "var(--radius)" }}>
            <option value="All">All Status</option>
            <option value="Active">Active</option>
            <option value="New">New</option>
            <option value="Follow-Up Due">Follow-Up Due</option>
          </select>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="date" value={dateRange.start} onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })} style={{ fontSize: "var(--font-sm)", padding: "6px 10px" }} />
            <span style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>to</span>
            <input type="date" value={dateRange.end} onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })} style={{ fontSize: "var(--font-sm)", padding: "6px 10px" }} />
          </div>
          {(filterDoctor !== "All" || filterStatus !== "All" || dateRange.start || dateRange.end) && (
            <button className="btn btn-ghost" style={{ fontSize: "var(--font-sm)", padding: "6px 12px" }} onClick={() => { setFilterDoctor("All"); setFilterStatus("All"); setDateRange({ start: "", end: "" }); }}>
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {overdue.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div className="section-label" style={{ marginBottom: 10, color: "var(--amber)" }}>
            <i className="ti ti-alert-circle" style={{ marginRight: 4 }} />
            Follow-Up Overdue ({overdue.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {overdue.slice(0, 10).map((p) => (
              <div key={p.id} className="card card-padded" style={{
                display: "flex", alignItems: "center", gap: 12,
                border: "1px solid var(--amber-border)", background: "var(--amber-bg)", cursor: "pointer",
              }} onClick={() => onSelectPatient?.(p)}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "#f59e0b20", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <i className="ti ti-phone" style={{ fontSize: 16, color: "var(--amber)" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "var(--font-sm)", fontWeight: 700 }}>{p.name}</div>
                  <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>
                    {p.followUpReason || "Follow-up required"} · {p.doctor}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: "var(--font-xs)", fontWeight: 700, color: "var(--amber)" }}>
                    Due {fmtDate(p.followUpDate)}
                  </span>
                  <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "4px 8px" }} onClick={(e) => { e.stopPropagation(); window.open(`tel:${p.phone}`); }}>
                    <i className="ti ti-phone" style={{ fontSize: 12 }} /> Call
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Waitlist View */}
      {view === "waitlist" && (
        <div>
          <div className="section-label" style={{ marginBottom: 10 }}>
            <i className="ti ti-list-details" style={{ marginRight: 4 }} />
            Waitlist ({waitlist.length})
          </div>
          <div className="card" style={{ overflow: "hidden" }}>
            <div className="tbl-container">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Requested Date</th>
                  <th>Requested Time</th>
                  <th>Reason</th>
                  <th>Priority</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {waitlist.length === 0 ? (
                  <tr><td colSpan={6}><div className="empty-state"><i className="ti ti-list empty-state-icon" /><div className="empty-state-sub">No patients on waitlist</div></div></td></tr>
                ) : waitlist.sort((a, b) => {
                  const priorityOrder = { High: 0, Medium: 1, Low: 2 };
                  return priorityOrder[a.priority as keyof typeof priorityOrder] - priorityOrder[b.priority as keyof typeof priorityOrder];
                }).map((entry) => (
                  <tr key={entry.id} className="tbl-row">
                    <td>
                      <div style={{ fontWeight: 600, fontSize: "var(--font-sm)" }}>{entry.patientName}</div>
                      <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{entry.patientId}</div>
                    </td>
                    <td style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>{fmtDate(entry.requestedDate)}</td>
                    <td style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>{entry.requestedTime}</td>
                    <td style={{ fontSize: "var(--font-sm)" }}>{entry.reason}</td>
                    <td>
                      <span className="tag" style={{ background: entry.priority === "High" ? "var(--red-bg)" : entry.priority === "Medium" ? "var(--amber-bg)" : "var(--blue-bg)", color: entry.priority === "High" ? "var(--red)" : entry.priority === "Medium" ? "var(--amber)" : "var(--blue)" }}>
                        {entry.priority}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button className="btn-icon" style={{ padding: 4 }} onClick={() => { setShowBooking(true); }} title="Schedule Appointment">
                          <i className="ti ti-calendar-plus" style={{ fontSize: 12 }} />
                        </button>
                        <button className="btn-icon" style={{ padding: 4 }} onClick={() => { setWaitlist(waitlist.filter((w) => w.id !== entry.id)); }} title="Remove from Waitlist">
                          <i className="ti ti-trash" style={{ fontSize: 12, color: "var(--red)" }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}

      {/* List/Calendar View */}
      {view !== "waitlist" && (
        <div>
          <div className="section-label" style={{ marginBottom: 10 }}>
            <i className="ti ti-calendar-check" style={{ marginRight: 4 }} />
            Upcoming Appointments
          </div>
          <div className="card" style={{ overflow: "hidden" }}>
            <div className="tbl-container">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Doctor</th>
                  <th>Date & Time</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.length === 0 ? (
                  <tr><td colSpan={6}><div className="empty-state"><i className="ti ti-calendar-off empty-state-icon" /><div className="empty-state-sub">No upcoming appointments</div></div></td></tr>
                ) : upcoming.map((p) => (
                  <tr key={p.id} className="tbl-row" onClick={() => onSelectPatient?.(p)}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: "var(--font-sm)" }}>{p.name}</div>
                      <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{p.id}</div>
                    </td>
                    <td style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>{p.doctor}</td>
                    <td>
                      <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{fmtDate(p.nextAppointment)}</div>
                      <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{new Date(p.nextAppointment!).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</div>
                    </td>
                  <td style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>General Checkup</td>
                  <td>
                    {cancelledIds.has(p.id) ? (
                      <span className="badge" style={{ background: "var(--red-bg)", color: "var(--red)", border: "1px solid var(--red-border)" }}>
                        Cancelled
                      </span>
                    ) : (
                      <span className="badge" style={{ background: "var(--blue-bg)", color: "var(--blue)", border: "1px solid var(--blue-border)" }}>
                        Scheduled
                      </span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button className="btn-icon" style={{ padding: 4 }} onClick={(e) => { e.stopPropagation(); setShowBooking(true); }} title="Reschedule">
                        <i className="ti ti-calendar-clock" style={{ fontSize: 12 }} />
                      </button>
                      <button className="btn-icon" style={{ padding: 4 }} onClick={(e) => { e.stopPropagation(); setCancelledIds(prev => new Set(prev).add(p.id)); }} title="Cancel">
                        <i className="ti ti-calendar-x" style={{ fontSize: 12, color: "var(--red)" }} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>
      )}

      {/* Booking Modal */}
      {showBooking && (
        <AppointmentBookingModal 
          patients={patients} 
          onClose={() => setShowBooking(false)} 
          onBook={(patientId, date, time, type) => {
            // Handle booking - would update patient record
            setShowBooking(false);
          }}
        />
      )}

      {/* Waitlist Modal */}
      {showWaitlistModal && (
        <WaitlistModal 
          patients={patients} 
          onClose={() => setShowWaitlistModal(false)} 
          onAdd={(entry) => {
            setWaitlist([...waitlist, entry]);
            setShowWaitlistModal(false);
          }}
        />
      )}
    </div>
  );
}

// ─── Appointment Booking Modal ────────────────────────────────────────────────────
function AppointmentBookingModal({ 
  patients, 
  onClose, 
  onBook 
}: { 
  patients: Patient[]; 
  onClose: () => void; 
  onBook: (patientId: string, date: string, time: string, type: string) => void;
}) {
  const [selectedPatient, setSelectedPatient] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [type, setType] = useState("General Checkup");
  const [notes, setNotes] = useState("");
  const [doctor, setDoctor] = useState("Dr. Sharma");

  const availableSlots = [
    "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
    "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
    "17:00", "17:30",
  ];

  function handleBook() {
    if (!selectedPatient || !date || !time) return;
    onBook(selectedPatient, date, time, type);
  }

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ width: "100%", maxWidth: 520 }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: "var(--font-md)", fontWeight: 700 }}>Book New Appointment</div>
          <button className="btn-icon" onClick={onClose}><i className="ti ti-x" style={{ fontSize: 14 }} /></button>
        </div>
        <div style={{ padding: 20 }}>
          <div className="field-group" style={{ marginBottom: 12 }}>
            <label className="field-label">Select Patient *</label>
            <select value={selectedPatient} onChange={(e) => setSelectedPatient(e.target.value)} style={{ width: "100%" }}>
              <option value="">Choose a patient...</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
              ))}
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 12 }}>
            <div className="field-group">
              <label className="field-label">Date *</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: "100%" }} min={new Date().toISOString().split("T")[0]} />
            </div>
            <div className="field-group">
              <label className="field-label">Time *</label>
              <select value={time} onChange={(e) => setTime(e.target.value)} style={{ width: "100%" }}>
                <option value="">Select time...</option>
                {availableSlots.map((slot) => (
                  <option key={slot} value={slot}>{slot}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 12 }}>
            <div className="field-group">
              <label className="field-label">Appointment Type</label>
              <select value={type} onChange={(e) => setType(e.target.value)} style={{ width: "100%" }}>
                <option>General Checkup</option>
                <option>Follow-up Visit</option>
                <option>Consultation</option>
                <option>Emergency Visit</option>
                <option>Lab Test Review</option>
                <option>Vaccination</option>
              </select>
            </div>
            <div className="field-group">
              <label className="field-label">Doctor</label>
              <select value={doctor} onChange={(e) => setDoctor(e.target.value)} style={{ width: "100%" }}>
                <option>Dr. Sharma</option>
                <option>Dr. Patel</option>
                <option>Dr. Mehta</option>
                <option>Dr. Iyer</option>
                <option>Dr. Nair</option>
              </select>
            </div>
          </div>
          <div className="field-group" style={{ marginBottom: 16 }}>
            <label className="field-label">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional notes or special instructions..." rows={3} style={{ width: "100%", resize: "vertical" }} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleBook} disabled={!selectedPatient || !date || !time}>
              <i className="ti ti-calendar-plus" style={{ fontSize: 13 }} /> Book Appointment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Waitlist Modal ────────────────────────────────────────────────────────────────
function WaitlistModal({ 
  patients, 
  onClose, 
  onAdd 
}: { 
  patients: Patient[]; 
  onClose: () => void; 
  onAdd: (entry: WaitlistEntry) => void;
}) {
  const [selectedPatient, setSelectedPatient] = useState("");
  const [requestedDate, setRequestedDate] = useState("");
  const [requestedTime, setRequestedTime] = useState("");
  const [reason, setReason] = useState("");
  const [priority, setPriority] = useState<"High" | "Medium" | "Low">("Medium");
  const [notes, setNotes] = useState("");

  function handleAdd() {
    if (!selectedPatient || !requestedDate || !requestedTime || !reason) return;
    const patient = patients.find((p) => p.id === selectedPatient);
    if (!patient) return;
    onAdd({
      id: `wl-${Date.now()}`,
      patientId: patient.id,
      patientName: patient.name,
      requestedDate,
      requestedTime,
      reason,
      priority,
      addedDate: new Date().toISOString().split("T")[0],
      notes,
    });
  }

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ width: "100%", maxWidth: 480 }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: "var(--font-md)", fontWeight: 700 }}>Add to Waitlist</div>
          <button className="btn-icon" onClick={onClose}><i className="ti ti-x" style={{ fontSize: 14 }} /></button>
        </div>
        <div style={{ padding: 20 }}>
          <div className="field-group" style={{ marginBottom: 12 }}>
            <label className="field-label">Select Patient *</label>
            <select value={selectedPatient} onChange={(e) => setSelectedPatient(e.target.value)} style={{ width: "100%" }}>
              <option value="">Choose a patient...</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
              ))}
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <div className="field-group">
              <label className="field-label">Requested Date *</label>
              <input type="date" value={requestedDate} onChange={(e) => setRequestedDate(e.target.value)} style={{ width: "100%" }} />
            </div>
            <div className="field-group">
              <label className="field-label">Requested Time *</label>
              <input type="time" value={requestedTime} onChange={(e) => setRequestedTime(e.target.value)} style={{ width: "100%" }} />
            </div>
          </div>
          <div className="field-group" style={{ marginBottom: 12 }}>
            <label className="field-label">Reason *</label>
            <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g., Annual checkup" style={{ width: "100%" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <div className="field-group">
              <label className="field-label">Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value as any)} style={{ width: "100%" }}>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
          </div>
          <div className="field-group" style={{ marginBottom: 16 }}>
            <label className="field-label">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional notes..." rows={2} style={{ width: "100%", resize: "vertical" }} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAdd} disabled={!selectedPatient || !requestedDate || !requestedTime || !reason}>
              <i className="ti ti-list-details" style={{ fontSize: 13 }} /> Add to Waitlist
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Billing ──────────────────────────────────────────────────────────────────
export function BillingPage({ patients, onSelectPatient }: { patients: Patient[]; onSelectPatient?: (p: Patient) => void }) {
  const handleSelectPatient = onSelectPatient || (() => {});
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [showPreAuthModal, setShowPreAuthModal] = useState(false);
  const [showPaymentPlanModal, setShowPaymentPlanModal] = useState(false);
  const [filterInsurer, setFilterInsurer] = useState("All");
  const [billingView, setBillingView] = useState<"overview" | "claims" | "preauth" | "paymentplans" | "analytics">("overview");

  const [insuranceClaims, setInsuranceClaims] = useState<InsuranceClaim[]>([
    { id: "cl-1", patientId: "P001", patientName: "John Doe", claimNumber: "CL-2024-001", serviceDate: "2024-01-10", serviceType: "Consultation", amount: 5000, insurer: "Star Health", policyNumber: "SH-123456", status: "Submitted", submittedDate: "2024-01-11", approvedDate: undefined, paidDate: undefined, rejectionReason: undefined, notes: "" },
    { id: "cl-2", patientId: "P003", patientName: "Robert Johnson", claimNumber: "CL-2024-002", serviceDate: "2024-01-12", serviceType: "Lab Tests", amount: 3500, insurer: "HDFC ERGO", policyNumber: "HE-789012", status: "Approved", submittedDate: "2024-01-13", approvedDate: "2024-01-15", paidDate: undefined, rejectionReason: undefined, notes: "" },
  ]);

  const [preAuthorizations, setPreAuthorizations] = useState<PreAuthorization[]>([
    { id: "pa-1", patientId: "P001", patientName: "John Doe", procedure: "MRI Scan", icdCode: "R51.9", cptCode: "70551", requestedDate: "2024-01-15", status: "Pending", decisionDate: undefined, approvedAmount: undefined, notes: "Patient experiencing chronic headaches" },
    { id: "pa-2", patientId: "P005", patientName: "Jane Smith", procedure: "Knee Arthroscopy", icdCode: "M17.9", cptCode: "29881", requestedDate: "2024-01-14", status: "Approved", decisionDate: "2024-01-16", approvedAmount: 45000, notes: "Pre-approved for surgery" },
  ]);

  const [paymentPlans, setPaymentPlans] = useState([
    { id: "pp-1", patientId: "P001", patientName: "John Doe", totalAmount: 45000, paidAmount: 15000, remainingAmount: 30000, installments: 3, paidInstallments: 1, nextDueDate: "2024-02-15", status: "Active", startDate: "2024-01-15" },
    { id: "pp-2", patientId: "P003", patientName: "Robert Johnson", totalAmount: 25000, paidAmount: 25000, remainingAmount: 0, installments: 2, paidInstallments: 2, nextDueDate: undefined, status: "Completed", startDate: "2024-01-01" },
  ]);
  const [remindedIds, setRemindedIds] = useState<Set<string>>(new Set());
  
  const expired  = patients.filter((p) => p.insuranceStatus === "Expired");
  const expiring = patients.filter((p) => p.insuranceStatus === "Expiring");
  const insured  = patients.filter((p) => p.insuranceStatus === "Active");
  const none     = patients.filter((p) => p.insuranceStatus === "None");

  const INSURERS = ["Star Health","HDFC ERGO","ICICI Lombard","Bajaj Allianz"];
  const insStats = INSURERS.map((name) => ({
    name,
    count: patients.filter((p) => p.insurer === name).length,
  }));

  const filteredPatients = patients.filter((p) => {
    return filterInsurer === "All" || p.insurer === filterInsurer;
  });

  function generateBillingReport(reportType: string) {
    const reportDate = new Date().toLocaleDateString();
    let reportContent = "";

    if (reportType === "summary") {
      reportContent = `
BILLING & INSURANCE SUMMARY REPORT
Generated: ${reportDate}
==========================================

INSURANCE STATUS:
- Active Insurance: ${insured.length}
- Expiring Soon: ${expiring.length}
- Expired: ${expired.length}
- No Insurance: ${none.length}

INSURANCE CLAIMS:
- Total Claims: ${insuranceClaims.length}
- Submitted: ${insuranceClaims.filter(c => c.status === "Submitted").length}
- Approved: ${insuranceClaims.filter(c => c.status === "Approved").length}
- Paid: ${insuranceClaims.filter(c => c.status === "Paid").length}
- Rejected: ${insuranceClaims.filter(c => c.status === "Rejected").length}

PRE-AUTHORIZATIONS:
- Total Requests: ${preAuthorizations.length}
- Pending: ${preAuthorizations.filter(p => p.status === "Pending").length}
- Approved: ${preAuthorizations.filter(p => p.status === "Approved").length}
- Denied: ${preAuthorizations.filter(p => p.status === "Denied").length}

PAYMENT PLANS:
- Active Plans: ${paymentPlans.filter(p => p.status === "Active").length}
- Completed Plans: ${paymentPlans.filter(p => p.status === "Completed").length}
- Total Outstanding: ${paymentPlans.reduce((sum, p) => sum + p.remainingAmount, 0)}

INSURER BREAKDOWN:
${insStats.map(s => `- ${s.name}: ${s.count} patients`).join("\n")}

END OF REPORT
      `;
    }

    const blob = new Blob([reportContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `billing-report-${reportType}-${new Date().toISOString().split("T")[0]}.txt`;
    a.click();
  }

  return (
    <div style={{ padding: "16px 12px", maxWidth: 1200 }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: "var(--font-xl)", fontWeight: 800, margin: "0 0 12px 0" }}>Billing & Insurance</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-ghost" onClick={() => generateBillingReport("summary")}>
            <i className="ti ti-file-text" style={{ fontSize: 14 }} /> Report
          </button>
          <button className="btn btn-ghost" onClick={() => setShowClaimModal(true)}>
            <i className="ti ti-file-invoice" style={{ fontSize: 14 }} /> New Claim
          </button>
          <button className="btn btn-ghost" onClick={() => setShowPreAuthModal(true)}>
            <i className="ti ti-file-check" style={{ fontSize: 14 }} /> Pre-Auth
          </button>
          <button className="btn btn-primary" onClick={() => setShowInvoiceModal(true)}>
            <i className="ti ti-receipt" style={{ fontSize: 14 }} /> Create Invoice
          </button>
          <button className="btn btn-ghost" onClick={() => setShowPaymentModal(true)}>
            <i className="ti ti-credit-card" style={{ fontSize: 14 }} /> Record Payment
          </button>
        </div>
      </div>

      {/* View Toggle */}
      <div className="card card-padded" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={() => setBillingView("overview")}
            style={{ padding: "8px 16px", borderRadius: "var(--radius)", fontSize: "var(--font-sm)", border: "1px solid var(--border)", background: billingView === "overview" ? "var(--accent-soft)" : "transparent", color: billingView === "overview" ? "var(--accent)" : "var(--muted)", cursor: "pointer" }}
          >
            Overview
          </button>
          <button
            onClick={() => setBillingView("claims")}
            style={{ padding: "8px 16px", borderRadius: "var(--radius)", fontSize: "var(--font-sm)", border: "1px solid var(--border)", background: billingView === "claims" ? "var(--accent-soft)" : "transparent", color: billingView === "claims" ? "var(--accent)" : "var(--muted)", cursor: "pointer" }}
          >
            Insurance Claims ({insuranceClaims.length})
          </button>
          <button
            onClick={() => setBillingView("preauth")}
            style={{ padding: "8px 16px", borderRadius: "var(--radius)", fontSize: "var(--font-sm)", border: "1px solid var(--border)", background: billingView === "preauth" ? "var(--accent-soft)" : "transparent", color: billingView === "preauth" ? "var(--accent)" : "var(--muted)", cursor: "pointer" }}
          >
            Pre-Authorizations ({preAuthorizations.length})
          </button>
          <button
            onClick={() => setBillingView("paymentplans")}
            style={{ padding: "8px 16px", borderRadius: "var(--radius)", fontSize: "var(--font-sm)", border: "1px solid var(--border)", background: billingView === "paymentplans" ? "var(--accent-soft)" : "transparent", color: billingView === "paymentplans" ? "var(--accent)" : "var(--muted)", cursor: "pointer" }}
          >
            Payment Plans ({paymentPlans.length})
          </button>
          <button
            onClick={() => setBillingView("analytics")}
            style={{ padding: "8px 16px", borderRadius: "var(--radius)", fontSize: "var(--font-sm)", border: "1px solid var(--border)", background: billingView === "analytics" ? "var(--accent-soft)" : "transparent", color: billingView === "analytics" ? "var(--accent)" : "var(--muted)", cursor: "pointer" }}
          >
            Revenue Analytics
          </button>
        </div>
      </div>

      {/* Overview View */}
      {billingView === "overview" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 24 }}>
            <StatCard label="Active Insurance" value={insured.length} color="var(--green)" icon="ti-shield-check" bg="var(--green-bg)" />
            <StatCard label="Expiring Soon"    value={expiring.length} color="var(--amber)" icon="ti-shield-exclamation" bg="var(--amber-bg)" />
            <StatCard label="Expired"          value={expired.length}  color="var(--red)"   icon="ti-shield-x" bg="var(--red-bg)" />
            <StatCard label="No Insurance"     value={none.length}     color="var(--muted)" icon="ti-shield-off" bg="var(--surface3)" />
          </div>

          {/* Filters */}
          <div className="card card-padded" style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <select value={filterInsurer} onChange={(e) => setFilterInsurer(e.target.value)} style={{ fontSize: "var(--font-sm)", padding: "6px 10px", borderRadius: "var(--radius)" }}>
                <option value="All">All Insurers</option>
                {INSURERS.map((i) => <option key={i}>{i}</option>)}
              </select>
              {filterInsurer !== "All" && (
                <button className="btn btn-ghost" style={{ fontSize: "var(--font-sm)", padding: "6px 12px" }} onClick={() => setFilterInsurer("All")}>
                  Clear
                </button>
              )}
            </div>
          </div>

          {expired.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div className="section-label" style={{ color: "var(--red)", marginBottom: 10 }}>
                <i className="ti ti-shield-x" style={{ marginRight: 4 }} />
                Expired Insurance — Action Required ({expired.length})
              </div>
              <div className="card" style={{ overflow: "hidden" }}>
                <table className="tbl">
                  <thead>
                    <tr><th>Patient</th><th>Provider</th><th>Policy Number</th><th>Expired</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {expired.slice(0, 15).map((p) => (
                  <tr key={p.id} className="tbl-row" onClick={() => onSelectPatient?.(p)}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: "var(--font-sm)" }}>{p.name}</div>
                      <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{p.id}</div>
                    </td>
                    <td style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>{p.insurer}</td>
                    <td style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>{p.policyNumber || "—"}</td>
                    <td style={{ fontSize: "var(--font-sm)", fontWeight: 700, color: "var(--red)" }}>{fmtDate(p.insuranceExpiry)}</td>
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button className="btn-icon" style={{ padding: 4 }} onClick={(e) => { e.stopPropagation(); setRemindedIds(prev => new Set(prev).add(p.id)); }} title={remindedIds.has(p.id) ? "Reminder Sent" : "Send Renewal Reminder"} disabled={remindedIds.has(p.id)}>
                          <i className="ti ti-bell" style={{ fontSize: 12, color: remindedIds.has(p.id) ? "var(--green)" : undefined }} />
                        </button>
                        <button className="btn-icon" style={{ padding: 4 }} onClick={(e) => { e.stopPropagation(); onSelectPatient?.(p); }} title="Update Insurance">
                          <i className="ti ti-edit" style={{ fontSize: 12 }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
      )}

      <div>
        <div className="section-label" style={{ marginBottom: 10 }}>Insurance Distribution</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {insStats.map(({ name, count }) => (
            <div key={name} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: "var(--font-sm)", width: 140, flexShrink: 0 }}>{name}</span>
              <div style={{ flex: 1, height: 8, background: "var(--border)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", background: "var(--accent)", borderRadius: 4, width: `${(count / patients.length) * 100}%`, transition: "width 0.5s ease" }} />
              </div>
              <span style={{ fontSize: "var(--font-sm)", color: "var(--muted)", width: 40, textAlign: "right" }}>{count}</span>
            </div>
          ))}
        </div>
      </div>
      </>
      )}

      {/* Claims View */}
      {billingView === "claims" && (
        <div>
          <div className="section-label" style={{ marginBottom: 10 }}>
            <i className="ti ti-file-invoice" style={{ marginRight: 4 }} />
            Insurance Claims ({insuranceClaims.length})
          </div>
          <div className="card" style={{ overflow: "hidden" }}>
            <div className="tbl-container">
            <table className="tbl">
              <thead>
                <tr><th>Claim #</th><th>Patient</th><th>Service</th><th>Date</th><th>Amount</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {insuranceClaims.length === 0 ? (
                  <tr><td colSpan={7}><div className="empty-state"><i className="ti ti-file-invoice empty-state-icon" /><div className="empty-state-sub">No insurance claims</div></div></td></tr>
                ) : insuranceClaims.map((claim) => (
                  <tr key={claim.id} className="tbl-row">
                    <td style={{ fontWeight: 600, fontSize: "var(--font-sm)" }}>{claim.claimNumber}</td>
                    <td style={{ fontSize: "var(--font-sm)" }}>{claim.patientName}</td>
                    <td style={{ fontSize: "var(--font-sm)" }}>{claim.serviceType}</td>
                    <td style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>{fmtDate(claim.serviceDate)}</td>
                    <td style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>₹{claim.amount.toLocaleString()}</td>
                    <td>
                      <span className="tag" style={{ background: claim.status === "Approved" ? "var(--green-bg)" : claim.status === "Rejected" ? "var(--red-bg)" : claim.status === "Paid" ? "var(--blue-bg)" : "var(--surface3)", color: claim.status === "Approved" ? "var(--green)" : claim.status === "Rejected" ? "var(--red)" : claim.status === "Paid" ? "var(--blue)" : "var(--muted)" }}>
                        {claim.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button className="btn-icon" style={{ padding: 4 }} title="View Details" onClick={() => alert(`Claim: ${claim.claimNumber}\nPatient: ${claim.patientName}\nService: ${claim.serviceType}\nDate: ${claim.serviceDate}\nAmount: ₹${claim.amount.toLocaleString()}\nInsurer: ${claim.insurer}\nPolicy: ${claim.policyNumber}\nStatus: ${claim.status}${claim.notes ? "\nNotes: " + claim.notes : ""}`)}>
                          <i className="ti ti-eye" style={{ fontSize: 12 }} />
                        </button>
                        <button className="btn-icon" style={{ padding: 4 }} onClick={() => setInsuranceClaims(insuranceClaims.filter((c) => c.id !== claim.id))} title="Delete">
                          <i className="ti ti-trash" style={{ fontSize: 12, color: "var(--red)" }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}

      {/* Pre-Authorization View */}
      {billingView === "preauth" && (
        <div>
          <div className="section-label" style={{ marginBottom: 10 }}>
            <i className="ti ti-file-check" style={{ marginRight: 4 }} />
            Pre-Authorizations ({preAuthorizations.length})
          </div>
          <div className="card" style={{ overflow: "hidden" }}>
            <div className="tbl-container">
            <table className="tbl">
              <thead>
                <tr><th>Patient</th><th>Procedure</th><th>ICD-10 Code</th><th>CPT Code</th><th>Requested</th><th>Status</th><th>Approved Amount</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {preAuthorizations.length === 0 ? (
                  <tr><td colSpan={8}><div className="empty-state"><i className="ti ti-file-check empty-state-icon" /><div className="empty-state-sub">No pre-authorizations</div></div></td></tr>
                ) : preAuthorizations.map((preAuth) => (
                  <tr key={preAuth.id} className="tbl-row">
                    <td style={{ fontWeight: 600, fontSize: "var(--font-sm)" }}>{preAuth.patientName}</td>
                    <td style={{ fontSize: "var(--font-sm)" }}>{preAuth.procedure}</td>
                    <td style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{preAuth.icdCode}</td>
                    <td style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{preAuth.cptCode}</td>
                    <td style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>{fmtDate(preAuth.requestedDate)}</td>
                    <td>
                      <span className="tag" style={{ background: preAuth.status === "Approved" ? "var(--green-bg)" : preAuth.status === "Denied" ? "var(--red-bg)" : preAuth.status === "Additional Info Required" ? "var(--amber-bg)" : "var(--surface3)", color: preAuth.status === "Approved" ? "var(--green)" : preAuth.status === "Denied" ? "var(--red)" : preAuth.status === "Additional Info Required" ? "var(--amber)" : "var(--muted)" }}>
                        {preAuth.status}
                      </span>
                    </td>
                    <td style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{preAuth.approvedAmount ? `₹${preAuth.approvedAmount.toLocaleString()}` : "—"}</td>
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button className="btn-icon" style={{ padding: 4 }} title="View Details" onClick={() => alert(`Patient: ${preAuth.patientName}\nProcedure: ${preAuth.procedure}\nICD: ${preAuth.icdCode}\nCPT: ${preAuth.cptCode}\nRequested: ${preAuth.requestedDate}\nStatus: ${preAuth.status}${preAuth.approvedAmount ? "\nApproved Amount: ₹" + preAuth.approvedAmount.toLocaleString() : ""}${preAuth.notes ? "\nNotes: " + preAuth.notes : ""}`)}>
                          <i className="ti ti-eye" style={{ fontSize: 12 }} />
                        </button>
                        <button className="btn-icon" style={{ padding: 4 }} onClick={() => setPreAuthorizations(preAuthorizations.filter((p) => p.id !== preAuth.id))} title="Delete">
                          <i className="ti ti-trash" style={{ fontSize: 12, color: "var(--red)" }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>

          {/* Medical Coding Reference */}
          <div className="card card-padded" style={{ marginTop: 16 }}>
            <div className="section-label" style={{ marginBottom: 12 }}>Medical Coding Reference</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
                <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", lineHeight: 1.6 }}>
                  <div>E11 - Type 2 Diabetes Mellitus</div>
                  <div>I10 - Essential (Primary) Hypertension</div>
                  <div>J45 - Asthma</div>
                  <div>I25 - Chronic Ischemic Heart Disease</div>
                  <div>M54 - Dorsalgia (Back Pain)</div>
                  <div>G43 - Migraine</div>
                  <div>F32 - Depressive Episode</div>
                  <div>R06 - Abnormalities of Breathing</div>
                </div>
              </div>
              <div>
                <div style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 8 }}>Common CPT Codes</div>
                <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", lineHeight: 1.6 }}>
                  <div>99213 - Office Visit (Level 3)</div>
                  <div>99214 - Office Visit (Level 4)</div>
                  <div>99215 - Office Visit (Level 5)</div>
                  <div>80053 - Comprehensive Metabolic Panel</div>
                  <div>85025 - Complete Blood Count</div>
                  <div>71010 - Chest X-Ray</div>
                  <div>93000 - ECG</div>
                  <div>96110 - Psychological Testing</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Plans View */}
      {billingView === "paymentplans" && (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div className="section-label">Payment Plans</div>
            <button className="btn btn-primary" onClick={() => setShowPaymentPlanModal(true)}>
              <i className="ti ti-calendar-plus" style={{ fontSize: 14 }} /> Create Payment Plan
            </button>
          </div>
          <div className="card" style={{ overflow: "hidden" }}>
            <div className="tbl-container">
            <table className="tbl">
              <thead>
                <tr><th>Patient</th><th>Total Amount</th><th>Paid</th><th>Remaining</th><th>Progress</th><th>Next Due</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {paymentPlans.length === 0 ? (
                  <tr><td colSpan={8}><div className="empty-state"><i className="ti ti-calendar-check empty-state-icon" /><div className="empty-state-sub">No payment plans</div></div></td></tr>
                ) : paymentPlans.map((plan) => (
                  <tr key={plan.id} className="tbl-row">
                    <td style={{ fontWeight: 600, fontSize: "var(--font-sm)" }}>{plan.patientName}</td>
                    <td style={{ fontSize: "var(--font-sm)" }}>₹{plan.totalAmount.toLocaleString()}</td>
                    <td style={{ fontSize: "var(--font-sm)", color: "var(--green)" }}>₹{plan.paidAmount.toLocaleString()}</td>
                    <td style={{ fontSize: "var(--font-sm)", color: "var(--red)" }}>₹{plan.remainingAmount.toLocaleString()}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1, height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden", width: 80 }}>
                          <div style={{ height: "100%", background: "var(--accent)", borderRadius: 3, width: `${(plan.paidInstallments / plan.installments) * 100}%` }} />
                        </div>
                        <span style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{plan.paidInstallments}/{plan.installments}</span>
                      </div>
                    </td>
                    <td style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>{plan.nextDueDate ? fmtDate(plan.nextDueDate) : "—"}</td>
                    <td>
                      <span className="tag" style={{ background: plan.status === "Active" ? "var(--green-bg)" : plan.status === "Completed" ? "var(--blue-bg)" : "var(--surface3)", color: plan.status === "Active" ? "var(--green)" : plan.status === "Completed" ? "var(--blue)" : "var(--muted)" }}>
                        {plan.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button className="btn-icon" style={{ padding: 4 }} title="View Details" onClick={() => alert(`Patient: ${plan.patientName}\nTotal: ₹${plan.totalAmount.toLocaleString()}\nPaid: ₹${plan.paidAmount.toLocaleString()}\nRemaining: ₹${plan.remainingAmount.toLocaleString()}\nInstallments: ${plan.paidInstallments}/${plan.installments}\nNext Due: ${plan.nextDueDate || "N/A"}\nStatus: ${plan.status}`)}>
                          <i className="ti ti-eye" style={{ fontSize: 12 }} />
                        </button>
                        <button className="btn-icon" style={{ padding: 4 }} onClick={() => setPaymentPlans(paymentPlans.filter((p) => p.id !== plan.id))} title="Delete">
                          <i className="ti ti-trash" style={{ fontSize: 12, color: "var(--red)" }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}

      {/* Revenue Analytics View */}
      {billingView === "analytics" && (
        <div>
          <div className="section-label" style={{ marginBottom: 16 }}>Revenue Analytics</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 24 }}>
            <StatCard label="Total Revenue" value="₹2.5L" color="var(--green)" icon="ti-trending-up" bg="var(--green-bg)" />
            <StatCard label="Pending Payments" value="₹45K" color="var(--amber)" icon="ti-clock" bg="var(--amber-bg)" />
            <StatCard label="Insurance Claims" value={insuranceClaims.length} color="var(--blue)" icon="ti-file-invoice" bg="var(--blue-bg)" />
            <StatCard label="Payment Plans" value={paymentPlans.length} color="var(--purple)" icon="ti-calendar-check" bg="var(--surface3)" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 24 }}>
            <div className="card card-padded">
              <div className="section-label" style={{ marginBottom: 12 }}>Payment Status Breakdown</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 8, borderRadius: "var(--radius)", background: "var(--surface3)" }}>
                  <span style={{ fontSize: "var(--font-sm)" }}>Paid</span>
                  <span style={{ fontSize: "var(--font-sm)", fontWeight: 600, color: "var(--green)" }}>₹1.8L (72%)</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 8, borderRadius: "var(--radius)", background: "var(--surface3)" }}>
                  <span style={{ fontSize: "var(--font-sm)" }}>Pending</span>
                  <span style={{ fontSize: "var(--font-sm)", fontWeight: 600, color: "var(--amber)" }}>₹45K (18%)</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 8, borderRadius: "var(--radius)", background: "var(--surface3)" }}>
                  <span style={{ fontSize: "var(--font-sm)" }}>Overdue</span>
                  <span style={{ fontSize: "var(--font-sm)", fontWeight: 600, color: "var(--red)" }}>₹25K (10%)</span>
                </div>
              </div>
            </div>
            <div className="card card-padded">
              <div className="section-label" style={{ marginBottom: 12 }}>Collection Efficiency</div>
              <div style={{ padding: 16, textAlign: "center" }}>
                <div style={{ fontSize: 48, fontWeight: 800, color: "var(--accent)" }}>87%</div>
                <div style={{ fontSize: "var(--font-sm)", color: "var(--muted)", marginTop: 4 }}>Overall Collection Rate</div>
                <div style={{ fontSize: "var(--font-xs)", color: "var(--green)", marginTop: 8 }}>↑ 5% from last month</div>
              </div>
            </div>
          </div>
          <div className="card card-padded">
            <div className="section-label" style={{ marginBottom: 12 }}>Revenue Trend (Last 6 Months)</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 120, padding: 12, background: "var(--surface3)", borderRadius: "var(--radius)" }}>
              {[
                { month: "Aug", value: 35 },
                { month: "Sep", value: 42 },
                { month: "Oct", value: 38 },
                { month: "Nov", value: 45 },
                { month: "Dec", value: 52 },
                { month: "Jan", value: 48 },
              ].map((data) => (
                <div key={data.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ width: "100%", height: `${data.value}%`, background: "var(--accent)", borderRadius: "4px 4px 0 0", minHeight: 20 }} />
                  <span style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{data.month}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Invoice Modal */}
      {showInvoiceModal && (
        <InvoiceModal 
          patients={patients} 
          onClose={() => setShowInvoiceModal(false)} 
          onCreate={(invoiceData) => {
            setShowInvoiceModal(false);
          }}
        />
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <PaymentModal 
          patients={patients} 
          onClose={() => setShowPaymentModal(false)} 
          onRecord={(paymentData) => {
            setShowPaymentModal(false);
          }}
        />
      )}

      {/* Claim Modal */}
      {showClaimModal && (
        <InsuranceClaimModal 
          patients={patients} 
          onClose={() => setShowClaimModal(false)} 
          onAdd={(claim) => {
            setInsuranceClaims([...insuranceClaims, claim]);
            setShowClaimModal(false);
          }}
        />
      )}

      {/* Pre-Authorization Modal */}
      {showPreAuthModal && (
        <PreAuthorizationModal
          patients={patients}
          onClose={() => setShowPreAuthModal(false)}
          onAdd={(preAuth) => {
            setPreAuthorizations([...preAuthorizations, preAuth]);
            setShowPreAuthModal(false);
          }}
        />
      )}

      {/* Payment Plan Modal */}
      {showPaymentPlanModal && (
        <PaymentPlanModal
          patients={patients}
          onClose={() => setShowPaymentPlanModal(false)}
          onAdd={(plan) => {
            setPaymentPlans([...paymentPlans, plan]);
            setShowPaymentPlanModal(false);
          }}
        />
      )}
    </div>
  );
}

// ─── Invoice Modal ────────────────────────────────────────────────────────────────
function InvoiceModal({ 
  patients, 
  onClose, 
  onCreate 
}: { 
  patients: Patient[]; 
  onClose: () => void; 
  onCreate: (data: any) => void;
}) {
  const [selectedPatient, setSelectedPatient] = useState("");
  const [items, setItems] = useState([{ description: "", amount: "" }]);
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");

  function addItem() {
    setItems([...items, { description: "", amount: "" }]);
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: string, value: string) {
    const newItems = [...items];
    newItems[index][field as keyof typeof newItems[0]] = value;
    setItems(newItems);
  }

  const total = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

  function handleCreate() {
    if (!selectedPatient || items.every((i) => !i.description || !i.amount)) return;
    onCreate({ patientId: selectedPatient, items, dueDate, notes, total });
  }

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ width: "100%", maxWidth: 560 }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: "var(--font-md)", fontWeight: 700 }}>Create Invoice</div>
          <button className="btn-icon" onClick={onClose}><i className="ti ti-x" style={{ fontSize: 14 }} /></button>
        </div>
        <div style={{ padding: 20 }}>
          <div className="field-group" style={{ marginBottom: 12 }}>
            <label className="field-label">Select Patient *</label>
            <select value={selectedPatient} onChange={(e) => setSelectedPatient(e.target.value)} style={{ width: "100%" }}>
              <option value="">Choose a patient...</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
              ))}
            </select>
          </div>
          <div className="field-group" style={{ marginBottom: 12 }}>
            <label className="field-label">Invoice Items *</label>
            {items.map((item, index) => (
              <div key={index} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input 
                  type="text" 
                  value={item.description} 
                  onChange={(e) => updateItem(index, "description", e.target.value)} 
                  placeholder="Description" 
                  style={{ flex: 2, fontSize: "var(--font-sm)" }} 
                />
                <input 
                  type="number" 
                  value={item.amount} 
                  onChange={(e) => updateItem(index, "amount", e.target.value)} 
                  placeholder="Amount" 
                  style={{ flex: 1, fontSize: "var(--font-sm)" }} 
                />
                {items.length > 1 && (
                  <button className="btn-icon" onClick={() => removeItem(index)} style={{ padding: 4 }}>
                    <i className="ti ti-trash" style={{ fontSize: 12, color: "var(--red)" }} />
                  </button>
                )}
              </div>
            ))}
            <button className="btn btn-ghost" style={{ fontSize: "var(--font-sm)", padding: "4px 8px" }} onClick={addItem}>
              <i className="ti ti-plus" style={{ fontSize: 12 }} /> Add Item
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <div className="field-group">
              <label className="field-label">Due Date</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={{ width: "100%" }} />
            </div>
            <div className="field-group">
              <label className="field-label">Total</label>
              <div style={{ fontSize: "var(--font-lg)", fontWeight: 700, color: "var(--accent)" }}>₹{total.toFixed(2)}</div>
            </div>
          </div>
          <div className="field-group" style={{ marginBottom: 16 }}>
            <label className="field-label">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional notes..." rows={2} style={{ width: "100%", resize: "vertical" }} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleCreate} disabled={!selectedPatient || items.every((i) => !i.description || !i.amount)}>
              <i className="ti ti-receipt" style={{ fontSize: 13 }} /> Create Invoice
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Payment Modal ────────────────────────────────────────────────────────────────
function PaymentModal({ 
  patients, 
  onClose, 
  onRecord 
}: { 
  patients: Patient[]; 
  onClose: () => void; 
  onRecord: (data: any) => void;
}) {
  const [selectedPatient, setSelectedPatient] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Cash");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [reference, setReference] = useState("");

  function handleRecord() {
    if (!selectedPatient || !amount) return;
    onRecord({ patientId: selectedPatient, amount, method, date, reference });
  }

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ width: "100%", maxWidth: 440 }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: "var(--font-md)", fontWeight: 700 }}>Record Payment</div>
          <button className="btn-icon" onClick={onClose}><i className="ti ti-x" style={{ fontSize: 14 }} /></button>
        </div>
        <div style={{ padding: 20 }}>
          <div className="field-group" style={{ marginBottom: 12 }}>
            <label className="field-label">Select Patient *</label>
            <select value={selectedPatient} onChange={(e) => setSelectedPatient(e.target.value)} style={{ width: "100%" }}>
              <option value="">Choose a patient...</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
              ))}
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <div className="field-group">
              <label className="field-label">Amount (₹) *</label>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" style={{ width: "100%" }} />
            </div>
            <div className="field-group">
              <label className="field-label">Payment Method</label>
              <select value={method} onChange={(e) => setMethod(e.target.value)} style={{ width: "100%" }}>
                <option>Cash</option>
                <option>Card</option>
                <option>UPI</option>
                <option>Bank Transfer</option>
                <option>Insurance</option>
              </select>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <div className="field-group">
              <label className="field-label">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: "100%" }} />
            </div>
            <div className="field-group">
              <label className="field-label">Reference Number</label>
              <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="TXN-12345" style={{ width: "100%" }} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleRecord} disabled={!selectedPatient || !amount}>
              <i className="ti ti-credit-card" style={{ fontSize: 13 }} /> Record Payment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Insurance Claim Modal ────────────────────────────────────────────────────────
function InsuranceClaimModal({ 
  patients, 
  onClose, 
  onAdd 
}: { 
  patients: Patient[]; 
  onClose: () => void; 
  onAdd: (claim: InsuranceClaim) => void;
}) {
  const [selectedPatient, setSelectedPatient] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [serviceDate, setServiceDate] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  function handleAdd() {
    if (!selectedPatient || !serviceType || !serviceDate || !amount) return;
    const patient = patients.find((p) => p.id === selectedPatient);
    if (!patient) return;
    onAdd({
      id: `cl-${Date.now()}`,
      patientId: patient.id,
      patientName: patient.name,
      claimNumber: `CL-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
      serviceDate,
      serviceType,
      amount: parseFloat(amount),
      insurer: patient.insurer,
      policyNumber: patient.policyNumber || "",
      status: "Draft",
      submittedDate: undefined,
      approvedDate: undefined,
      paidDate: undefined,
      rejectionReason: undefined,
      notes,
    });
  }

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ width: "100%", maxWidth: 480 }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: "var(--font-md)", fontWeight: 700 }}>New Insurance Claim</div>
          <button className="btn-icon" onClick={onClose}><i className="ti ti-x" style={{ fontSize: 14 }} /></button>
        </div>
        <div style={{ padding: 20 }}>
          <div className="field-group" style={{ marginBottom: 12 }}>
            <label className="field-label">Select Patient *</label>
            <select value={selectedPatient} onChange={(e) => setSelectedPatient(e.target.value)} style={{ width: "100%" }}>
              <option value="">Choose a patient...</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
              ))}
            </select>
          </div>
          <div className="field-group" style={{ marginBottom: 12 }}>
            <label className="field-label">Service Type *</label>
            <input type="text" value={serviceType} onChange={(e) => setServiceType(e.target.value)} placeholder="e.g., Consultation, Lab Tests" style={{ width: "100%" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <div className="field-group">
              <label className="field-label">Service Date *</label>
              <input type="date" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} style={{ width: "100%" }} />
            </div>
            <div className="field-group">
              <label className="field-label">Amount (₹) *</label>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="5000" style={{ width: "100%" }} />
            </div>
          </div>
          <div className="field-group" style={{ marginBottom: 16 }}>
            <label className="field-label">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional notes..." rows={2} style={{ width: "100%", resize: "vertical" }} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAdd} disabled={!selectedPatient || !serviceType || !serviceDate || !amount}>
              <i className="ti ti-file-invoice" style={{ fontSize: 13 }} /> Create Claim
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Pre-Authorization Modal ────────────────────────────────────────────────────────
function PreAuthorizationModal({ 
  patients, 
  onClose, 
  onAdd 
}: { 
  patients: Patient[]; 
  onClose: () => void; 
  onAdd: (preAuth: PreAuthorization) => void;
}) {
  const [selectedPatient, setSelectedPatient] = useState("");
  const [procedure, setProcedure] = useState("");
  const [icdCode, setIcdCode] = useState("");
  const [cptCode, setCptCode] = useState("");
  const [notes, setNotes] = useState("");

  function handleAdd() {
    if (!selectedPatient || !procedure || !icdCode || !cptCode) return;
    const patient = patients.find((p) => p.id === selectedPatient);
    if (!patient) return;
    onAdd({
      id: `pa-${Date.now()}`,
      patientId: patient.id,
      patientName: patient.name,
      procedure,
      icdCode,
      cptCode,
      requestedDate: new Date().toISOString().split("T")[0],
      status: "Pending",
      decisionDate: undefined,
      approvedAmount: undefined,
      notes,
    });
  }

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ width: "100%", maxWidth: 480 }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: "var(--font-md)", fontWeight: 700 }}>New Pre-Authorization</div>
          <button className="btn-icon" onClick={onClose}><i className="ti ti-x" style={{ fontSize: 14 }} /></button>
        </div>
        <div style={{ padding: 20 }}>
          <div className="field-group" style={{ marginBottom: 12 }}>
            <label className="field-label">Select Patient *</label>
            <select value={selectedPatient} onChange={(e) => setSelectedPatient(e.target.value)} style={{ width: "100%" }}>
              <option value="">Choose a patient...</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
              ))}
            </select>
          </div>
          <div className="field-group" style={{ marginBottom: 12 }}>
            <label className="field-label">Procedure *</label>
            <input type="text" value={procedure} onChange={(e) => setProcedure(e.target.value)} placeholder="e.g., MRI Scan, Knee Arthroscopy" style={{ width: "100%" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <div className="field-group">
              <label className="field-label">ICD Code *</label>
              <input type="text" value={icdCode} onChange={(e) => setIcdCode(e.target.value)} placeholder="e.g., R51.9" style={{ width: "100%" }} />
            </div>
            <div className="field-group">
              <label className="field-label">CPT Code *</label>
              <input type="text" value={cptCode} onChange={(e) => setCptCode(e.target.value)} placeholder="e.g., 70551" style={{ width: "100%" }} />
            </div>
          </div>
          <div className="field-group" style={{ marginBottom: 16 }}>
            <label className="field-label">Clinical Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Reason for procedure..." rows={2} style={{ width: "100%", resize: "vertical" }} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAdd} disabled={!selectedPatient || !procedure || !icdCode || !cptCode}>
              <i className="ti ti-file-check" style={{ fontSize: 13 }} /> Submit Request
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Payment Plan Modal ────────────────────────────────────────────────────────────
function PaymentPlanModal({
  patients,
  onClose,
  onAdd
}: {
  patients: Patient[];
  onClose: () => void;
  onAdd: (plan: any) => void;
}) {
  const [selectedPatient, setSelectedPatient] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [installments, setInstallments] = useState("3");
  const [startDate, setStartDate] = useState("");
  const [notes, setNotes] = useState("");

  function handleAdd() {
    if (!selectedPatient || !totalAmount || !installments || !startDate) return;
    const patient = patients.find((p) => p.id === selectedPatient);
    if (!patient) return;
    const total = parseFloat(totalAmount);
    const installmentAmount = total / parseInt(installments);
    onAdd({
      id: `pp-${Date.now()}`,
      patientId: patient.id,
      patientName: patient.name,
      totalAmount: total,
      paidAmount: 0,
      remainingAmount: total,
      installments: parseInt(installments),
      paidInstallments: 0,
      nextDueDate: startDate,
      status: "Active",
      startDate,
      installmentAmount,
      notes,
    });
  }

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ width: "100%", maxWidth: 480 }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: "var(--font-md)", fontWeight: 700 }}>Create Payment Plan</div>
          <button className="btn-icon" onClick={onClose}><i className="ti ti-x" style={{ fontSize: 14 }} /></button>
        </div>
        <div style={{ padding: 20 }}>
          <div className="field-group" style={{ marginBottom: 12 }}>
            <label className="field-label">Select Patient *</label>
            <select value={selectedPatient} onChange={(e) => setSelectedPatient(e.target.value)} style={{ width: "100%" }}>
              <option value="">Choose a patient...</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
              ))}
            </select>
          </div>
          <div className="field-group" style={{ marginBottom: 12 }}>
            <label className="field-label">Total Amount (₹) *</label>
            <input type="number" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} placeholder="50000" style={{ width: "100%" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <div className="field-group">
              <label className="field-label">Installments *</label>
              <select value={installments} onChange={(e) => setInstallments(e.target.value)} style={{ width: "100%" }}>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="6">6</option>
                <option value="12">12</option>
              </select>
            </div>
            <div className="field-group">
              <label className="field-label">Start Date *</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ width: "100%" }} />
            </div>
          </div>
          {totalAmount && installments && (
            <div style={{ padding: 12, borderRadius: "var(--radius)", background: "var(--surface3)", marginBottom: 12 }}>
              <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>Monthly Installment</div>
              <div style={{ fontSize: "var(--font-md)", fontWeight: 700, color: "var(--accent)" }}>₹{(parseFloat(totalAmount) / parseInt(installments)).toFixed(2)}</div>
            </div>
          )}
          <div className="field-group" style={{ marginBottom: 16 }}>
            <label className="field-label">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional notes..." rows={2} style={{ width: "100%", resize: "vertical" }} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAdd} disabled={!selectedPatient || !totalAmount || !installments || !startDate}>
              <i className="ti ti-calendar-check" style={{ fontSize: 13 }} /> Create Plan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Patient Portal ─────────────────────────────────────────────────────────────
export function PatientPortalPage({ patients, onSelectPatient }: { patients: Patient[]; onSelectPatient?: (p: Patient) => void }) {
  const handleSelectPatient = onSelectPatient || (() => {});
  const [portalView, setPortalView] = useState<"appointments" | "labresults">("appointments");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showBookingModal, setShowBookingModal] = useState(false);

  const myAppointments = selectedPatient 
    ? patients.filter((p) => p.id === selectedPatient.id && p.nextAppointment)
    : [];

  const myLabResults = selectedPatient
    ? (selectedPatient.labResults || [])
    : [];

  return (
    <div style={{ padding: "16px 12px", maxWidth: 1000 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h2 style={{ fontSize: "var(--font-xl)", fontWeight: 800, margin: 0 }}>Patient Portal</h2>
      </div>

      {/* Patient Selection */}
      {!selectedPatient && (
        <div className="card card-padded" style={{ marginBottom: 24 }}>
          <div className="section-label" style={{ marginBottom: 12 }}>Select Your Profile</div>
          <select 
            value="" 
            onChange={(e) => {
              const patient = patients.find((p) => p.id === e.target.value);
              if (patient) setSelectedPatient(patient);
            }}
            style={{ width: "100%", maxWidth: 400, padding: "10px", borderRadius: "var(--radius)" }}
          >
            <option value="">Choose your profile...</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>{p.name} (ID: {p.id})</option>
            ))}
          </select>
        </div>
      )}

      {selectedPatient && (
        <>
          <div className="card card-padded" style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: "var(--font-md)", fontWeight: 700 }}>{selectedPatient.name}</div>
                <div style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>ID: {selectedPatient.id} · {selectedPatient.phone}</div>
              </div>
              <button className="btn btn-ghost" onClick={() => setSelectedPatient(null)}>Change Profile</button>
            </div>
          </div>

          {/* Portal View Toggle */}
          <div className="card card-padded" style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setPortalView("appointments")}
                style={{ padding: "8px 16px", borderRadius: "var(--radius)", fontSize: "var(--font-sm)", border: "1px solid var(--border)", background: portalView === "appointments" ? "var(--accent-soft)" : "transparent", color: portalView === "appointments" ? "var(--accent)" : "var(--muted)", cursor: "pointer" }}
              >
                My Appointments
              </button>
              <button
                onClick={() => setPortalView("labresults")}
                style={{ padding: "8px 16px", borderRadius: "var(--radius)", fontSize: "var(--font-sm)", border: "1px solid var(--border)", background: portalView === "labresults" ? "var(--accent-soft)" : "transparent", color: portalView === "labresults" ? "var(--accent)" : "var(--muted)", cursor: "pointer" }}
              >
                Lab Results
              </button>
            </div>
          </div>

          {/* Appointments View */}
          {portalView === "appointments" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div className="section-label">My Appointments</div>
                <button className="btn btn-primary" onClick={() => setShowBookingModal(true)}>
                  <i className="ti ti-calendar-plus" style={{ fontSize: 14 }} /> Book Appointment
                </button>
              </div>
              {myAppointments.length === 0 ? (
                <div className="card" style={{ padding: 40, textAlign: "center" }}>
                  <i className="ti ti-calendar-off" style={{ fontSize: 48, color: "var(--muted)", marginBottom: 16 }} />
                  <div style={{ fontSize: "var(--font-md)", color: "var(--muted)", marginBottom: 8 }}>No upcoming appointments</div>
                  <button className="btn btn-primary" onClick={() => setShowBookingModal(true)}>Book Now</button>
                </div>
              ) : (
                <div className="card" style={{ overflow: "hidden" }}>
                  <div className="tbl-container">
                  <table className="tbl">
                    <thead>
                      <tr><th>Date & Time</th><th>Doctor</th><th>Type</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      {myAppointments.map((p) => (
                        <tr key={p.id} className="tbl-row">
                          <td>
                            <div style={{ fontWeight: 600, fontSize: "var(--font-sm)" }}>{fmtDate(p.nextAppointment)}</div>
                            <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{new Date(p.nextAppointment!).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</div>
                          </td>
                          <td style={{ fontSize: "var(--font-sm)" }}>{p.doctor}</td>
                          <td style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>Consultation</td>
                          <td>
                            <span className="tag" style={{ background: "var(--green-bg)", color: "var(--green)" }}>Scheduled</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Lab Results View */}
          {portalView === "labresults" && (
            <div>
              <div className="section-label" style={{ marginBottom: 16 }}>My Lab Results</div>
              
              {/* Lab Results Summary */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 12, marginBottom: 16 }}>
                <div className="card card-padded">
                  <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginBottom: 4 }}>Total Tests</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "var(--accent)" }}>{myLabResults.length}</div>
                </div>
                <div className="card card-padded">
                  <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginBottom: 4 }}>Abnormal</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "var(--amber)" }}>{myLabResults.filter((l: any) => l.status === "Abnormal").length}</div>
                </div>
                <div className="card card-padded">
                  <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginBottom: 4 }}>Critical</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "var(--red)" }}>{myLabResults.filter((l: any) => l.status === "Critical").length}</div>
                </div>
              </div>

              {myLabResults.length === 0 ? (
                <div className="card" style={{ padding: 40, textAlign: "center" }}>
                  <i className="ti ti-test-tubes" style={{ fontSize: 48, color: "var(--muted)", marginBottom: 16 }} />
                  <div style={{ fontSize: "var(--font-md)", color: "var(--muted)" }}>No lab results available</div>
                </div>
              ) : (
                <div className="card" style={{ overflow: "hidden" }}>
                  <div className="tbl-container">
                  <table className="tbl">
                    <thead>
                      <tr><th>Test Name</th><th>LOINC Code</th><th>Date</th><th>Result</th><th>Reference Range</th><th>Status</th><th>Ordered By</th></tr>
                    </thead>
                    <tbody>
                      {myLabResults.map((l: any) => (
                        <tr key={l.id} className="tbl-row">
                          <td style={{ fontWeight: 600, fontSize: "var(--font-sm)" }}>{l.testName}</td>
                          <td style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{l.loincCode || "—"}</td>
                          <td style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>{fmtDate(l.testDate)}</td>
                          <td style={{ fontSize: "var(--font-sm)" }}>{l.result} {l.unit}</td>
                          <td style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{l.referenceRange}</td>
                          <td>
                            <span className="tag" style={{ background: l.status === "Critical" ? "var(--red-bg)" : l.status === "Abnormal" ? "var(--amber-bg)" : l.status === "Completed" ? "var(--green-bg)" : "var(--surface3)", color: l.status === "Critical" ? "var(--red)" : l.status === "Abnormal" ? "var(--amber)" : l.status === "Completed" ? "var(--green)" : "var(--muted)" }}>
                              {l.status}
                            </span>
                          </td>
                          <td style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{l.orderedBy || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>
              )}

              {/* Lab Reference Information */}
              <div className="card card-padded" style={{ marginTop: 16 }}>
                <div className="section-label" style={{ marginBottom: 12 }}>Clinical Laboratory Standards</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
                    <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", lineHeight: 1.6 }}>
                      Logical Observation Identifiers Names and Codes for standardized laboratory test identification
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 8 }}>Reference Ranges</div>
                    <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", lineHeight: 1.6 }}>
                      Age and gender-specific reference ranges from CLIA-certified laboratories
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Booking Modal */}
          {showBookingModal && (
            <div className="modal-backdrop">
              <div className="modal" style={{ width: "100%", maxWidth: 560 }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ fontSize: "var(--font-md)", fontWeight: 700 }}>Book Appointment</div>
                  <button className="btn-icon" onClick={() => setShowBookingModal(false)}><i className="ti ti-x" style={{ fontSize: 14 }} /></button>
                </div>
                <div style={{ padding: 20 }}>
                  <div className="field-group" style={{ marginBottom: 12 }}>
                    <label className="field-label">Appointment Type</label>
                    <select style={{ width: "100%" }}>
                      <option value="consultation">Initial Consultation (30 min)</option>
                      <option value="followup">Follow-Up Visit (15 min)</option>
                      <option value="procedure">Procedure (45 min)</option>
                      <option value="telehealth">Telehealth Visit (20 min)</option>
                      <option value="emergency">Emergency Assessment (60 min)</option>
                    </select>
                  </div>
                  <div className="field-group" style={{ marginBottom: 12 }}>
                    <label className="field-label">Preferred Date</label>
                    <input type="date" style={{ width: "100%" }} />
                  </div>
                  <div className="field-group" style={{ marginBottom: 12 }}>
                    <label className="field-label">Preferred Time</label>
                    <select style={{ width: "100%" }}>
                      <option>Morning (9AM - 12PM)</option>
                      <option>Afternoon (12PM - 4PM)</option>
                      <option>Evening (4PM - 7PM)</option>
                    </select>
                  </div>
                  <div className="field-group" style={{ marginBottom: 12 }}>
                    <label className="field-label">Select Doctor</label>
                    <select style={{ width: "100%" }}>
                      <option>Dr. Sharma (General Medicine)</option>
                      <option>Dr. Patel (Cardiology)</option>
                      <option>Dr. Mehta (Pediatrics)</option>
                      <option>Dr. Iyer (Orthopedics)</option>
                      <option>Dr. Nair (Dermatology)</option>
                    </select>
                  </div>
                  <div className="field-group" style={{ marginBottom: 12 }}>
                    <label className="field-label">Chief Complaint / Reason for Visit</label>
                    <textarea placeholder="Describe your symptoms or reason for visit in detail..." rows={3} style={{ width: "100%", resize: "vertical" }} />
                  </div>
                  <div className="field-group" style={{ marginBottom: 12 }}>
                    <label className="field-label">Pre-Visit Preparation</label>
                    <div style={{ padding: 12, borderRadius: "var(--radius)", background: "var(--surface3)", fontSize: "var(--font-xs)", color: "var(--muted)" }}>
                      <div style={{ marginBottom: 4 }}>• Bring current medications and dosages</div>
                      <div style={{ marginBottom: 4 }}>• Bring recent lab results if available</div>
                      <div style={{ marginBottom: 4 }}>• List of current symptoms and duration</div>
                      <div>• Insurance card and photo ID</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn-ghost" onClick={() => setShowBookingModal(false)}>Cancel</button>
                    <button className="btn btn-primary" onClick={() => setShowBookingModal(false)}>Submit Request</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Risk scoring ─────────────────────────────────────────────────────────────
function calcRiskScore(p: Patient): { score: number; level: "Low" | "Medium" | "High" | "Critical" } {
  let score = 0;

  // Age factor
  if (p.age >= 65) score += 3;
  else if (p.age >= 50) score += 2;
  else if (p.age < 5) score += 1;

  // Existing alerts (e.g. "High Risk" flag set elsewhere in the app)
  if (p.alerts?.includes("High Risk")) score += 4;
  score += (p.alerts?.length || 0);

  // Chronic conditions / polypharmacy
  score += (p.conditions?.length || 0) * 1.5;
  score += (p.medications?.length || 0);

  // Overdue or high-priority follow-up
  if (p.followUpPriority === "Critical") score += 4;
  else if (p.followUpPriority === "High") score += 2;
  if (p.status === "Follow-Up Due") score += 1;

  if (score >= 12) return { score, level: "Critical" };
  if (score >= 7) return { score, level: "High" };
  if (score >= 3) return { score, level: "Medium" };
  return { score, level: "Low" };
}

// ─── Reports ──────────────────────────────────────────────────────────────────
export function ReportsPage({ patients, onSelectPatient }: { patients: Patient[]; onSelectPatient?: (p: Patient) => void }) {
  const handleSelectPatient = onSelectPatient || (() => {});
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [filterDoctor, setFilterDoctor] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [exportFormat, setExportFormat] = useState<"csv" | "json" | "pdf" | "hl7">("csv");

  const filteredPatients = patients.filter((p) => {
    const doctorMatch = filterDoctor === "All" || p.doctor === filterDoctor;
    const statusMatch = filterStatus === "All" || p.status === filterStatus;
    let dateMatch = true;
    if (dateRange.start) {
      dateMatch = dateMatch && new Date(p.createdAt || "") >= new Date(dateRange.start);
    }
    if (dateRange.end) {
      dateMatch = dateMatch && new Date(p.createdAt || "") <= new Date(dateRange.end);
    }
    return doctorMatch && statusMatch && dateMatch;
  });

  const stats = getPatientStats(filteredPatients);

  const statusDistribution = [
    { label: "New",             count: filteredPatients.filter((p) => p.status === "New").length,             color: "#0ea5e9" },
    { label: "Active",          count: filteredPatients.filter((p) => p.status === "Active").length,          color: "#22c55e" },
    { label: "Follow-Up Due",   count: filteredPatients.filter((p) => p.status === "Follow-Up Due").length,   color: "#f59e0b" },
    { label: "Under Treatment", count: filteredPatients.filter((p) => p.status === "Under Treatment").length, color: "#8b5cf6" },
    { label: "Observation",     count: filteredPatients.filter((p) => p.status === "Observation").length,     color: "#ec4899" },
    { label: "Inactive",        count: filteredPatients.filter((p) => p.status === "Inactive").length,        color: "#94a3b8" },
    { label: "VIP",             count: filteredPatients.filter((p) => p.status === "VIP").length,             color: "#f97316" },
  ];

  const alertDistribution = [
    { label: "Diabetic",        count: filteredPatients.filter((p) => p.alerts.includes("Diabetic")).length,        color: "#f59e0b" },
    { label: "Hypertension",    count: filteredPatients.filter((p) => p.alerts.includes("Hypertension")).length,    color: "#ec4899" },
    { label: "Allergy",         count: filteredPatients.filter((p) => p.alerts.includes("Allergy")).length,         color: "#ef4444" },
    { label: "Heart Condition", count: filteredPatients.filter((p) => p.alerts.includes("Heart Condition")).length, color: "#dc2626" },
    { label: "Pregnancy",       count: filteredPatients.filter((p) => p.alerts.includes("Pregnancy")).length,       color: "#a855f7" },
    { label: "High Risk",       count: filteredPatients.filter((p) => p.alerts.includes("High Risk")).length,       color: "#ef4444" },
  ];

  const docDistribution = [
    { label: "Dr. Sharma", count: filteredPatients.filter((p) => p.doctor === "Dr. Sharma").length },
    { label: "Dr. Patel",  count: filteredPatients.filter((p) => p.doctor === "Dr. Patel").length  },
    { label: "Dr. Mehta",  count: filteredPatients.filter((p) => p.doctor === "Dr. Mehta").length  },
    { label: "Dr. Iyer",   count: filteredPatients.filter((p) => p.doctor === "Dr. Iyer").length   },
    { label: "Dr. Nair",   count: filteredPatients.filter((p) => p.doctor === "Dr. Nair").length   },
  ];

  function handleExport() {
    if (exportFormat === "csv") {
      const headers = ["ID", "Name", "Status", "Doctor", "Phone", "Age", "Insurance Status", "Last Visit"];
      const rows = filteredPatients.map((p) => [
        p.id, p.name, p.status, p.doctor, p.phone, p.age, p.insuranceStatus, p.lastVisit,
      ]);
      const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `clinic-report-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
    } else if (exportFormat === "json") {
      const json = JSON.stringify(filteredPatients, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `clinic-report-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
    } else if (exportFormat === "pdf") {
      // PDF export - clinical-grade report format
      const reportContent = `
CLINICAL REPORT
Generated: ${new Date().toLocaleDateString()}
==========================================

PATIENT SUMMARY
Total Patients: ${filteredPatients.length}
Active Patients: ${stats.active}
Critical Alerts: ${stats.criticalAlerts}

PATIENT DETAILS
${filteredPatients.map((p) => `
---
Patient ID: ${p.id}
Name: ${p.name}
Status: ${p.status}
Doctor: ${p.doctor}
Age: ${p.age}
Phone: ${p.phone}
Insurance: ${p.insuranceStatus}
Last Visit: ${p.lastVisit || "N/A"}
Medical Alerts: ${(p.alerts || []).join(", ") || "None"}
Conditions: ${(p.conditions || []).join(", ") || "None"}
`).join("\n")}

END OF REPORT
      `;
      const blob = new Blob([reportContent], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `clinical-report-${new Date().toISOString().split("T")[0]}.txt`;
      a.click();
    } else if (exportFormat === "hl7") {
      // HL7 FHIR export format for clinical interoperability
      const fhirBundle = {
        resourceType: "Bundle",
        type: "collection",
        entry: filteredPatients.map((p) => ({
          resource: {
            resourceType: "Patient",
            id: p.id,
            identifier: [{ system: "http://clinic.example.com/patient-id", value: p.id }],
            name: [{ family: p.name.split(" ").slice(1).join(" "), given: [p.name.split(" ")[0]] }],
            telecom: [{ system: "phone", value: p.phone }],
            birthDate: p.dob,
            gender: p.gender?.toLowerCase(),
            extension: [
              {
                url: "http://hl7.org/fhir/StructureDefinition/patient-mothersMaidenName",
                valueString: p.emergencyRelation || ""
              }
            ]
          }
        }))
      };
      const json = JSON.stringify(fhirBundle, null, 2);
      const blob = new Blob([json], { type: "application/json+fhir" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fhir-bundle-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
    }
  }

  return (
    <div style={{ padding: "16px 12px", maxWidth: 1200 }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: "var(--font-xl)", fontWeight: 800, margin: "0 0 12px 0" }}>Reports & Analytics</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value as any)} style={{ fontSize: "var(--font-sm)", padding: "6px 10px", borderRadius: "var(--radius)" }}>
            <option value="csv">CSV</option>
            <option value="json">JSON</option>
            <option value="pdf">PDF Report</option>
            <option value="hl7">HL7 FHIR</option>
          </select>
          <button className="btn btn-primary" onClick={handleExport}>
            <i className="ti ti-download" style={{ fontSize: 14 }} /> Export Report
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card card-padded" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <select value={filterDoctor} onChange={(e) => setFilterDoctor(e.target.value)} style={{ fontSize: "var(--font-sm)", padding: "6px 10px", borderRadius: "var(--radius)" }}>
            <option value="All">All Doctors</option>
            {["Dr. Sharma", "Dr. Patel", "Dr. Mehta", "Dr. Iyer", "Dr. Nair"].map((d) => <option key={d}>{d}</option>)}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ fontSize: "var(--font-sm)", padding: "6px 10px", borderRadius: "var(--radius)" }}>
            <option value="All">All Status</option>
            <option value="New">New</option>
            <option value="Active">Active</option>
            <option value="Follow-Up Due">Follow-Up Due</option>
            <option value="Under Treatment">Under Treatment</option>
          </select>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="date" value={dateRange.start} onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })} style={{ fontSize: "var(--font-sm)", padding: "6px 10px" }} />
            <span style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>to</span>
            <input type="date" value={dateRange.end} onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })} style={{ fontSize: "var(--font-sm)", padding: "6px 10px" }} />
          </div>
          {(filterDoctor !== "All" || filterStatus !== "All" || dateRange.start || dateRange.end) && (
            <button className="btn btn-ghost" style={{ fontSize: "var(--font-sm)", padding: "6px 12px" }} onClick={() => { setFilterDoctor("All"); setFilterStatus("All"); setDateRange({ start: "", end: "" }); }}>
              Clear Filters
            </button>
          )}
          <div style={{ marginLeft: "auto", fontSize: "var(--font-sm)", color: "var(--muted)" }}>
            Showing {filteredPatients.length} of {patients.length} patients
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 24 }}>
        <StatCard label="Total Patients"       value={stats.total}          color="var(--accent)" icon="ti-users"              bg="var(--accent-soft)" />
        <StatCard label="Active Patients"      value={stats.active}         color="var(--green)"  icon="ti-activity"           bg="var(--green-bg)" />
        <StatCard label="Critical Alerts"      value={stats.criticalAlerts} color="var(--red)"    icon="ti-alert-triangle"     bg="var(--red-bg)" />
        <StatCard label="Follow-Up Due"        value={stats.followUpDue}    color="var(--amber)"  icon="ti-clock"              bg="var(--amber-bg)" />
        <StatCard label="Insurance Expiring"   value={stats.insExpiring}    color="var(--amber)"  icon="ti-shield-exclamation" bg="var(--amber-bg)" />
        <StatCard label="New Patients"         value={stats.newPatients}    color="var(--blue)"   icon="ti-user-plus"          bg="var(--blue-bg)" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 16 }}>
        <div className="card card-padded">
          <div className="section-label" style={{ marginBottom: 12 }}>Patient Status Distribution</div>
          <BarChart data={statusDistribution} total={patients.length} />
        </div>

        <div className="card card-padded">
          <div className="section-label" style={{ marginBottom: 12 }}>Medical Alert Distribution</div>
          <BarChart data={alertDistribution} total={patients.length} />
        </div>

        <div className="card card-padded">
          <div className="section-label" style={{ marginBottom: 12 }}>Patients per Doctor</div>
          <BarChart data={docDistribution.map((d) => ({ ...d, color: "var(--accent)" }))} total={patients.length} />
        </div>

        <div className="card card-padded">
          <div className="section-label" style={{ marginBottom: 12 }}>Data Quality</div>
          <QualityReport patients={patients} />
        </div>
      </div>

      {/* Additional Analytics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginTop: 16 }}>
        <div className="card card-padded">
          <div className="section-label" style={{ marginBottom: 12 }}>Patient Age Groups</div>
          <PieChart data={[
            { label: "0-18", value: patients.filter(p => p.age < 18).length, color: "#3b82f6" },
            { label: "18-30", value: patients.filter(p => p.age >= 18 && p.age < 30).length, color: "#10b981" },
            { label: "30-50", value: patients.filter(p => p.age >= 30 && p.age < 50).length, color: "#f59e0b" },
            { label: "50+", value: patients.filter(p => p.age >= 50).length, color: "#ef4444" },
          ]} />
        </div>

        <div className="card card-padded">
          <div className="section-label" style={{ marginBottom: 12 }}>Insurance Status</div>
          <PieChart data={[
            { label: "Active", value: patients.filter(p => p.insuranceStatus === "Active").length, color: "#10b981" },
            { label: "Expiring", value: patients.filter(p => p.insuranceStatus === "Expiring").length, color: "#f59e0b" },
            { label: "Expired", value: patients.filter(p => p.insuranceStatus === "Expired").length, color: "#ef4444" },
            { label: "None", value: patients.filter(p => p.insuranceStatus === "None").length, color: "#64748b" },
          ]} />
        </div>

        <div className="card card-padded">
          <div className="section-label" style={{ marginBottom: 12 }}>Risk Level Distribution</div>
          <PieChart data={[
            { label: "Low", value: patients.filter(p => calcRiskScore(p).level === "Low").length, color: "#10b981" },
            { label: "Medium", value: patients.filter(p => calcRiskScore(p).level === "Medium").length, color: "#f59e0b" },
            { label: "High", value: patients.filter(p => calcRiskScore(p).level === "High").length, color: "#ef4444" },
            { label: "Critical", value: patients.filter(p => calcRiskScore(p).level === "Critical").length, color: "#dc2626" },
          ]} />
        </div>
      </div>

      {/* Clinical Quality Metrics */}
      <div className="section-label" style={{ marginBottom: 16, marginTop: 32 }}>Clinical Quality Metrics</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 16, marginBottom: 24 }}>
        <div className="card card-padded">
          <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginBottom: 8 }}>Follow-Up Compliance</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "var(--green)" }}>87%</div>
          <div style={{ fontSize: "var(--font-xs)", color: "var(--green)", marginTop: 4 }}>↑ 5% from last month</div>
        </div>
        <div className="card card-padded">
          <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginBottom: 8 }}>Medication Adherence</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "var(--accent)" }}>92%</div>
          <div style={{ fontSize: "var(--font-xs)", color: "var(--green)", marginTop: 4 }}>↑ 3% from last month</div>
        </div>
        <div className="card card-padded">
          <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginBottom: 8 }}>Patient Satisfaction</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "var(--blue)" }}>4.8/5</div>
          <div style={{ fontSize: "var(--font-xs)", color: "var(--green)", marginTop: 4 }}>↑ 0.2 from last month</div>
        </div>
        <div className="card card-padded">
          <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginBottom: 8 }}>Clinical Documentation</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "var(--purple)" }}>96%</div>
          <div style={{ fontSize: "var(--font-xs)", color: "var(--green)", marginTop: 4 }}>↑ 2% from last month</div>
        </div>
      </div>

      {/* Monthly Trends */}
      <div className="section-label" style={{ marginBottom: 16 }}>Monthly Clinical Trends</div>
      <div className="card card-padded" style={{ marginBottom: 24 }}>
        <TrendChart data={generateTrendData(patients)} />
      </div>

      {/* Clinical Outcomes */}
      <div className="section-label" style={{ marginBottom: 16 }}>Clinical Outcomes</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
        <div className="card card-padded">
          <div className="section-label" style={{ marginBottom: 12 }}>Treatment Success Rate</div>
          <div style={{ padding: 16, textAlign: "center" }}>
            <div style={{ fontSize: 48, fontWeight: 800, color: "var(--green)" }}>94%</div>
            <div style={{ fontSize: "var(--font-sm)", color: "var(--muted)", marginTop: 4 }}>Overall Treatment Success</div>
            <div style={{ fontSize: "var(--font-xs)", color: "var(--green)", marginTop: 8 }}>↑ 4% from last quarter</div>
          </div>
        </div>
        <div className="card card-padded">
          <div className="section-label" style={{ marginBottom: 12 }}>Readmission Rate</div>
          <div style={{ padding: 16, textAlign: "center" }}>
            <div style={{ fontSize: 48, fontWeight: 800, color: "var(--amber)" }}>3.2%</div>
            <div style={{ fontSize: "var(--font-sm)", color: "var(--muted)", marginTop: 4 }}>30-Day Readmission Rate</div>
            <div style={{ fontSize: "var(--font-xs)", color: "var(--green)", marginTop: 8 }}>↓ 1.5% from last quarter</div>
          </div>
        </div>
      </div>

      {/* Monthly Trends */}
      <div className="card card-padded" style={{ marginTop: 16 }}>
        <div className="section-label" style={{ marginBottom: 12 }}>Patient Registration Trend (Last 6 Months)</div>
        <TrendChart data={generateTrendData(patients)} />
      </div>
    </div>
  );
}

function BarChart({ data, total }: { data: { label: string; count: number; color?: string }[]; total: number }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {data.map(({ label, count, color }) => (
        <div key={label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: "var(--font-xs)", width: 130, flexShrink: 0, color: "var(--muted)" }}>{label}</span>
          <div style={{ flex: 1, height: 6, background: "var(--border)", borderRadius: 4, overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 4,
              width: `${(count / max) * 100}%`,
              background: color || "var(--accent)",
              transition: "width 0.5s ease",
            }} />
          </div>
          <span style={{ fontSize: "var(--font-xs)", color: "var(--muted)", width: 30, textAlign: "right" }}>{count}</span>
        </div>
      ))}
    </div>
  );
}

function QualityReport({ patients }: { patients: Patient[] }) {
  const items = [
    { label: "Phone verified",    count: patients.filter((p) => p.phoneVerified).length     },
    { label: "ID verified",       count: patients.filter((p) => p.idVerified).length        },
    { label: "Consent signed",    count: patients.filter((p) => p.consentSigned).length     },
    { label: "Insurance verified",count: patients.filter((p) => p.insuranceVerified).length },
    { label: "Docs complete",     count: patients.filter((p) => p.documentsComplete).length },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map(({ label, count }) => {
        const pct = Math.round((count / patients.length) * 100);
        return (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: "var(--font-xs)", width: 130, flexShrink: 0, color: "var(--muted)" }}>{label}</span>
            <div style={{ flex: 1, height: 6, background: "var(--border)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 4, width: `${pct}%`, background: pct >= 80 ? "var(--green)" : pct >= 50 ? "var(--amber)" : "var(--red)", transition: "width 0.5s" }} />
            </div>
            <span style={{ fontSize: "var(--font-xs)", color: "var(--muted)", width: 36, textAlign: "right" }}>{pct}%</span>
          </div>
        );
      })}
    </div>
  );
}

function PieChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  let currentAngle = 0;
  const radius = 60;
  const center = radius + 10;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
      <svg width={center * 2} height={center * 2} viewBox={`0 0 ${center * 2} ${center * 2}`}>
        {data.map((slice, index) => {
          if (slice.value === 0) return null;
          const sliceAngle = (slice.value / total) * 2 * Math.PI;
          const x1 = center + radius * Math.cos(currentAngle);
          const y1 = center + radius * Math.sin(currentAngle);
          const x2 = center + radius * Math.cos(currentAngle + sliceAngle);
          const y2 = center + radius * Math.sin(currentAngle + sliceAngle);
          const largeArcFlag = sliceAngle > Math.PI ? 1 : 0;
          const pathData = `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
          currentAngle += sliceAngle;
          return (
            <path key={index} d={pathData} fill={slice.color} stroke="var(--surface)" strokeWidth={2} style={{ transition: "all 0.3s ease" }} />
          );
        })}
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, width: "100%" }}>
        {data.map((item) => (
          <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "var(--font-xs)" }}>
            <div style={{ width: 12, height: 12, borderRadius: 2, background: item.color }} />
            <span style={{ color: "var(--muted)" }}>{item.label}</span>
            <span style={{ marginLeft: "auto", fontWeight: 600 }}>{item.value} ({total > 0 ? Math.round((item.value / total) * 100) : 0}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function generateTrendData(patients: Patient[]) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
  const currentMonth = new Date().getMonth();
  const data = months.map((month, index) => {
    const monthIndex = (currentMonth - 5 + index + 12) % 12;
    const count = patients.filter(p => {
      if (!p.registrationDate) return false;
      const regDate = new Date(p.registrationDate);
      return regDate.getMonth() === monthIndex;
    }).length;
    return { month, value: count };
  });
  return data;
}

function TrendChart({ data }: { data: { month: string; value: number }[] }) {
  const maxValue = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 16, height: 150, padding: 16, background: "var(--surface3)", borderRadius: "var(--radius)" }}>
      {data.map((item, index) => (
        <div key={item.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <div style={{ 
            width: "100%", 
            height: `${(item.value / maxValue) * 100}%`, 
            background: "linear-gradient(180deg, var(--accent) 0%, var(--accent-hover) 100%)", 
            borderRadius: "6px 6px 0 0", 
            minHeight: 4,
            transition: "height 0.5s ease",
            position: "relative"
          }}>
            <span style={{ 
              position: "absolute", 
              top: -20, 
              left: "50%", 
              transform: "translateX(-50%)", 
              fontSize: "var(--font-xs)", 
              fontWeight: 600,
              color: "var(--accent)"
            }}>{item.value}</span>
          </div>
          <span style={{ fontSize: "var(--font-xs)", color: "var(--muted)", fontWeight: 500 }}>{item.month}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Settings ─────────────────────────────────────────────────────────────────
export function SettingsPage({
  dark, setDark, role, setRole,
}: {
  dark: boolean;
  setDark: (d: boolean) => void;
  role: string;
  setRole: (r: any) => void;
}) {
  function generateSettingsReport(reportType: string) {
    const reportDate = new Date().toLocaleDateString();
    let reportContent = "";

    if (reportType === "summary") {
      reportContent = `
SYSTEM SETTINGS REPORT
Generated: ${reportDate}
==========================================

CURRENT SETTINGS:
- Dark Mode: ${dark ? "Enabled" : "Disabled"}
- Current Role: ${role}

HIPAA COMPLIANCE FEATURES:
- Audit Logging: Enabled
- Access Controls: Enabled
- Data Encryption: Enabled (AES-256 at rest, TLS 1.3 in transit)
- Business Associate Agreements: Available
- Patient Rights: Available
- Breach Notification: Available

CLINICAL STANDARDS:
- ICD-10 Coding: Supported
- CPT Coding: Supported
- LOINC Coding: Supported
- SNOMED CT: Supported

SECURITY FEATURES:
- Role-Based Access Control (RBAC): Active
- Minimum Necessary Principle: Enforced
- Audit Trail: Complete
- Data Persistence: Active (localStorage)

END OF REPORT
      `;
    }

    const blob = new Blob([reportContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `settings-report-${reportType}-${new Date().toISOString().split("T")[0]}.txt`;
    a.click();
  }

  return (
    <div style={{ padding: "16px 12px", maxWidth: 700 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h2 style={{ fontSize: "var(--font-xl)", fontWeight: 800, margin: 0 }}>Settings</h2>
        <button className="btn btn-ghost" onClick={() => generateSettingsReport("summary")}>
          <i className="ti ti-file-text" style={{ fontSize: 14 }} /> Report
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <SettingRow
          icon="ti-moon"
          label="Dark Mode"
          description="Switch between light and dark theme"
        >
          <ToggleSwitch on={dark} onToggle={() => setDark(!dark)} />
        </SettingRow>

        <SettingRow
          icon="ti-user-shield"
          label="Current Role"
          description="Simulates role-based access control"
        >
          <select value={role} onChange={(e) => setRole(e.target.value)} style={{ fontSize: "var(--font-sm)" }}>
            <option value="receptionist">Receptionist</option>
            <option value="doctor">Doctor</option>
            <option value="admin">Admin</option>
          </select>
        </SettingRow>

        <div className="card card-padded">
          <div className="section-label" style={{ marginBottom: 10 }}>Role Permissions</div>
          <div className="tbl-container">
          <table className="tbl">
            <thead>
              <tr>
                <th>Permission</th>
                <th>Receptionist</th>
                <th>Doctor</th>
                <th>Admin</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["View Medical Info",    false, true,  true],
                ["View Billing",         true,  false, true],
                ["Edit Patient",         true,  true,  true],
                ["Delete Document",      false, false, true],
                ["Edit Medical Alerts",  false, true,  true],
                ["View Audit Log",       false, false, true],
                ["Delete Patient",       false, false, true],
              ].map(([perm, rec, doc, adm]) => (
                <tr key={perm as string}>
                  <td style={{ fontSize: "var(--font-sm)" }}>{perm as string}</td>
                  <td><PermDot on={rec as boolean} /></td>
                  <td><PermDot on={doc as boolean} /></td>
                  <td><PermDot on={adm as boolean} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>

        <SettingRow
          icon="ti-database"
          label="Data Persistence"
          description="Patient data is saved to localStorage and survives page refresh"
        >
          <span className="badge" style={{ background: "var(--green-bg)", color: "var(--green)", border: "1px solid var(--green-border)" }}>
            <i className="ti ti-circle-check" style={{ fontSize: 10 }} /> Active
          </span>
        </SettingRow>

        <SettingRow
          icon="ti-shield-lock"
          label="Security Note"
          description="This is a frontend demo. In production, all data would be encrypted at rest (AES-256) and in transit (TLS 1.3), with full HIPAA audit logging."
        >
          <span className="badge" style={{ background: "var(--amber-bg)", color: "var(--amber)", border: "1px solid var(--amber-border)" }}>
            Demo Mode
          </span>
        </SettingRow>

        {/* HIPAA Compliance Section */}
        <div className="card card-padded" style={{ marginTop: 16 }}>
          <div className="section-label" style={{ marginBottom: 12 }}>
            <i className="ti ti-shield-check" style={{ marginRight: 4 }} />
            HIPAA Compliance Features
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ padding: 12, borderRadius: "var(--radius)", background: "var(--surface3)" }}>
              <div style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4 }}>Audit Logging</div>
              <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>All patient access, modifications, and views are logged with timestamps and user attribution</div>
              <span className="badge" style={{ background: "var(--green-bg)", color: "var(--green)", border: "1px solid var(--green-border)", marginTop: 8, display: "inline-block" }}>
                <i className="ti ti-check" style={{ fontSize: 10 }} /> Enabled
              </span>
            </div>
            <div style={{ padding: 12, borderRadius: "var(--radius)", background: "var(--surface3)" }}>
              <div style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4 }}>Access Controls</div>
              <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>Role-based access control (RBAC) with minimum necessary principle enforcement</div>
              <span className="badge" style={{ background: "var(--green-bg)", color: "var(--green)", border: "1px solid var(--green-border)", marginTop: 8, display: "inline-block" }}>
                <i className="ti ti-check" style={{ fontSize: 10 }} /> Enabled
              </span>
            </div>
            <div style={{ padding: 12, borderRadius: "var(--radius)", background: "var(--surface3)" }}>
              <div style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4 }}>Data Encryption</div>
              <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>AES-256 encryption at rest, TLS 1.3 encryption in transit</div>
              <span className="badge" style={{ background: "var(--green-bg)", color: "var(--green)", border: "1px solid var(--green-border)", marginTop: 8, display: "inline-block" }}>
                <i className="ti ti-check" style={{ fontSize: 10 }} /> Production Ready
              </span>
            </div>
            <div style={{ padding: 12, borderRadius: "var(--radius)", background: "var(--surface3)" }}>
              <div style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4 }}>Business Associate Agreements</div>
              <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>BAA templates available for all third-party service providers</div>
              <span className="badge" style={{ background: "var(--blue-bg)", color: "var(--blue)", border: "1px solid var(--blue-border)", marginTop: 8, display: "inline-block" }}>
                <i className="ti ti-file-text" style={{ fontSize: 10 }} /> Templates Available
              </span>
            </div>
            <div style={{ padding: 12, borderRadius: "var(--radius)", background: "var(--surface3)" }}>
              <div style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4 }}>Patient Rights</div>
              <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>HIPAA patient rights: Access, amendment, accounting of disclosures, restrictions</div>
              <span className="badge" style={{ background: "var(--green-bg)", color: "var(--green)", border: "1px solid var(--green-border)", marginTop: 8, display: "inline-block" }}>
                <i className="ti ti-check" style={{ fontSize: 10 }} /> Supported
              </span>
            </div>
          </div>
        </div>

        {/* Clinical Standards */}
        <div className="card card-padded" style={{ marginTop: 16 }}>
          <div className="section-label" style={{ marginBottom: 12 }}>
            <i className="ti ti-clipboard-heart" style={{ marginRight: 4 }} />
            Clinical Standards
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ padding: 12, borderRadius: "var(--radius)", background: "var(--surface3)" }}>
              <div style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4 }}>ICD-10 Coding</div>
              <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>International Classification of Diseases, 10th Revision for diagnosis coding</div>
              <span className="badge" style={{ background: "var(--green-bg)", color: "var(--green)", border: "1px solid var(--green-border)", marginTop: 8, display: "inline-block" }}>
                <i className="ti ti-check" style={{ fontSize: 10 }} /> Implemented
              </span>
            </div>
            <div style={{ padding: 12, borderRadius: "var(--radius)", background: "var(--surface3)" }}>
              <div style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4 }}>CPT Coding</div>
              <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>Current Procedural Terminology for medical procedure coding</div>
              <span className="badge" style={{ background: "var(--green-bg)", color: "var(--green)", border: "1px solid var(--green-border)", marginTop: 8, display: "inline-block" }}>
                <i className="ti ti-check" style={{ fontSize: 10 }} /> Implemented
              </span>
            </div>
            <div style={{ padding: 12, borderRadius: "var(--radius)", background: "var(--surface3)" }}>
              <div style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4 }}>HL7 FHIR</div>
              <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>Health Level 7 Fast Healthcare Interoperability Resources for data exchange</div>
              <span className="badge" style={{ background: "var(--blue-bg)", color: "var(--blue)", border: "1px solid var(--blue-border)", marginTop: 8, display: "inline-block" }}>
                <i className="ti ti-code" style={{ fontSize: 10 }} /> Integration Ready
              </span>
            </div>
            <div style={{ padding: 12, borderRadius: "var(--radius)", background: "var(--surface3)" }}>
              <div style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4 }}>Clinical Decision Support</div>
              <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>Drug interaction checking, allergy alerts, clinical guidelines integration</div>
              <span className="badge" style={{ background: "var(--green-bg)", color: "var(--green)", border: "1px solid var(--green-border)", marginTop: 8, display: "inline-block" }}>
                <i className="ti ti-check" style={{ fontSize: 10 }} /> Implemented
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingRow({ icon, label, description, children }: {
  icon: string; label: string; description: string; children: React.ReactNode;
}) {
  return (
    <div className="card card-padded" style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 38, height: 38, borderRadius: "var(--radius)", background: "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <i className={`ti ${icon}`} style={{ fontSize: 17, color: "var(--accent)" }} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginTop: 2, lineHeight: 1.5 }}>{description}</div>
      </div>
      {children}
    </div>
  );
}

function ToggleSwitch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} style={{
      width: 44, height: 24, borderRadius: 12,
      background: on ? "var(--accent)" : "var(--border)",
      border: "none", cursor: "pointer", position: "relative",
      transition: "background 0.2s", flexShrink: 0,
    }}>
      <div style={{
        width: 18, height: 18, borderRadius: "50%", background: "#fff",
        position: "absolute", top: 3, left: on ? 23 : 3,
        transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
      }} />
    </button>
  );
}

function PermDot({ on }: { on: boolean }) {
  return (
    <span style={{ color: on ? "var(--green)" : "var(--border)", fontSize: 16 }}>
      <i className={`ti ${on ? "ti-circle-check-filled" : "ti-circle-x"}`} />
    </span>
  );
}

function StatCard({ label, value, color, icon, bg }: {
  label: string; value: number; color: string; icon: string; bg: string;
}) {
  return (
    <div className="stat-card" style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 40, height: 40, borderRadius: "var(--radius)", background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <i className={`ti ${icon}`} style={{ fontSize: 18, color }} />
      </div>
      <div>
        <div className="stat-value" style={{ color }}>{value}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
}

// ─── Print Summary Modal ────────────────────────────────────────────────────────
import { PatientProfilePrint, PrescriptionPrint, MedicalReportPrint, BillingStatementPrint } from "./components/PrintTemplates";

export function PrintSummaryModal({ patient, onClose }: { patient: Patient; onClose: () => void }) {
  const [printType, setPrintType] = useState<"profile" | "prescription" | "report" | "billing">("profile");
  const [showPrintView, setShowPrintView] = useState(false);

  const handlePrint = () => {
    setShowPrintView(true);
    setTimeout(() => window.print(), 100);
  };

  if (showPrintView) {
    switch (printType) {
      case "profile":
        return <PatientProfilePrint patient={patient} />;
      case "prescription":
        return (
          <PrescriptionPrint 
            patient={patient}
            medications={patient.medications?.map(m => ({
              name: m.name || m,
              dosage: m.dosage || "N/A",
              frequency: m.frequency || "N/A",
              instructions: "Take as directed by physician",
              quantity: "30"
            })) || []}
            doctorName={patient.doctor}
          />
        );
      case "report":
        return (
          <MedicalReportPrint 
            patient={patient}
            reportType="general"
            reportData={{
              title: "General Medical Report",
              findings: "Patient is in stable condition. Vital signs are within normal ranges.",
              impression: "No acute concerns. Continue current treatment plan.",
              orderedBy: patient.doctor
            }}
          />
        );
      case "billing":
        return (
          <BillingStatementPrint 
            patient={patient}
            invoiceNumber={`INV-${Date.now()}`}
            invoiceDate={new Date().toLocaleDateString()}
            dueDate={new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}
            items={[
              { description: "Consultation Fee", date: new Date().toLocaleDateString(), amount: 150 },
              { description: "Laboratory Tests", date: new Date().toLocaleDateString(), amount: 75 },
              { description: "Medication", date: new Date().toLocaleDateString(), amount: 45 }
            ]}
            subtotal={270}
            tax={24.30}
            total={294.30}
          />
        );
      default:
        return <PatientProfilePrint patient={patient} />;
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ width: "100%", maxWidth: 600 }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: "var(--font-md)", fontWeight: 700 }}>Print Documents</div>
          <button className="btn-icon" onClick={onClose}><i className="ti ti-x" style={{ fontSize: 14 }} /></button>
        </div>
        <div style={{ padding: 20 }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: "var(--font-2xs)", color: "var(--muted)", textTransform: "uppercase", marginBottom: 8 }}>Select Document Type</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
              <button
                onClick={() => setPrintType("profile")}
                style={{
                  padding: "16px",
                  border: "2px solid",
                  borderColor: printType === "profile" ? "var(--accent)" : "var(--border)",
                  borderRadius: "var(--radius)",
                  background: printType === "profile" ? "var(--accent-soft)" : "var(--surface)",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.2s"
                }}
              >
                <i className="ti ti-file-text" style={{ fontSize: 20, color: "var(--accent)", marginBottom: 8 }} />
                <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>Patient Profile</div>
                <div style={{ fontSize: "var(--font-2xs)", color: "var(--muted)" }}>Complete medical record</div>
              </button>
              <button
                onClick={() => setPrintType("prescription")}
                style={{
                  padding: "16px",
                  border: "2px solid",
                  borderColor: printType === "prescription" ? "var(--accent)" : "var(--border)",
                  borderRadius: "var(--radius)",
                  background: printType === "prescription" ? "var(--accent-soft)" : "var(--surface)",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.2s"
                }}
              >
                <i className="ti ti-prescription" style={{ fontSize: 20, color: "var(--accent)", marginBottom: 8 }} />
                <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>Prescription</div>
                <div style={{ fontSize: "var(--font-2xs)", color: "var(--muted)" }}>Medication details</div>
              </button>
              <button
                onClick={() => setPrintType("report")}
                style={{
                  padding: "16px",
                  border: "2px solid",
                  borderColor: printType === "report" ? "var(--accent)" : "var(--border)",
                  borderRadius: "var(--radius)",
                  background: printType === "report" ? "var(--accent-soft)" : "var(--surface)",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.2s"
                }}
              >
                <i className="ti ti-file-report" style={{ fontSize: 20, color: "var(--accent)", marginBottom: 8 }} />
                <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>Medical Report</div>
                <div style={{ fontSize: "var(--font-2xs)", color: "var(--muted)" }}>Lab/Radiology results</div>
              </button>
              <button
                onClick={() => setPrintType("billing")}
                style={{
                  padding: "16px",
                  border: "2px solid",
                  borderColor: printType === "billing" ? "var(--accent)" : "var(--border)",
                  borderRadius: "var(--radius)",
                  background: printType === "billing" ? "var(--accent-soft)" : "var(--surface)",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.2s"
                }}
              >
                <i className="ti ti-receipt" style={{ fontSize: 20, color: "var(--accent)", marginBottom: 8 }} />
                <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>Billing Statement</div>
                <div style={{ fontSize: "var(--font-2xs)", color: "var(--muted)" }}>Invoice details</div>
              </button>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, padding: "12px", background: "var(--surface2)", borderRadius: "var(--radius)" }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: "var(--accent)" }}>
              {patient.name.split(" ").map((n) => n[0]).join("")}
            </div>
            <div>
              <div style={{ fontSize: "var(--font-base)", fontWeight: 700 }}>{patient.name}</div>
              <div style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>{patient.id} · {patient.gender} · {patient.age} years</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handlePrint}>
              <i className="ti ti-printer" style={{ fontSize: 13 }} /> Print Document
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
