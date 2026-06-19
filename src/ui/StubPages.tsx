import React, { useState } from "react";
import type { Patient } from "./types";
import { getPatientStats, fmtDate, exportReportsToCSV } from "./utils";
import {
  PatientTrendsChart,
  PatientStatusChart,
  DoctorWorkloadChart,
  InsuranceChart,
  RiskDistributionChart
} from "./components/Charts";

// ─── Appointments ─────────────────────────────────────────────────────────────
export function AppointmentsPage({ patients }: { patients: Patient[] }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showNewAppointmentModal, setShowNewAppointmentModal] = useState(false);
  const [selectedPatientForAppointment, setSelectedPatientForAppointment] = useState<Patient | null>(null);
  const [appointmentTime, setAppointmentTime] = useState("");
  const [appointmentType, setAppointmentType] = useState("consultation");
  const [appointmentNotes, setAppointmentNotes] = useState("");

  const upcoming = patients
    .filter((p) => p.nextAppointment)
    .sort((a, b) => new Date(a.nextAppointment!).getTime() - new Date(b.nextAppointment!).getTime())
    .slice(0, 50);

  const overdue = patients.filter(
    (p) => p.status === "Follow-Up Due" || (p.followUpDate && new Date(p.followUpDate) < new Date())
  );

  const handleCreateAppointment = () => {
    if (!selectedPatientForAppointment || !selectedDate || !appointmentTime) {
      alert("Please select a patient, date, and time");
      return;
    }

    const [hours, minutes] = appointmentTime.split(":");
    const appointmentDateTime = new Date(selectedDate);
    appointmentDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    const updatedPatient = {
      ...selectedPatientForAppointment,
      nextAppointment: appointmentDateTime.toISOString()
    };

    const index = patients.findIndex(p => p.id === selectedPatientForAppointment.id);
    if (index !== -1) {
      patients[index] = updatedPatient;
    }

    setShowNewAppointmentModal(false);
    setSelectedPatientForAppointment(null);
    setAppointmentTime("");
    setAppointmentType("consultation");
    setAppointmentNotes("");
    alert(`Appointment scheduled for ${selectedPatientForAppointment.name} on ${appointmentDateTime.toLocaleString()}`);
  };

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const getAppointmentsForDate = (date: Date) => {
    return patients.filter(p => {
      if (!p.nextAppointment) return false;
      const appointmentDate = new Date(p.nextAppointment);
      return appointmentDate.toDateString() === date.toDateString();
    });
  };

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const calendarDays = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    calendarDays.push(<div key={`empty-${i}`} style={{ padding: 8, background: "var(--surface2)" }} />);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const appointments = getAppointmentsForDate(date);
    const isToday = date.toDateString() === new Date().toDateString();
    const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString();

    calendarDays.push(
      <div
        key={day}
        onClick={() => setSelectedDate(date)}
        style={{
          padding: 8,
          minHeight: 80,
          border: "1px solid var(--border)",
          background: isSelected ? "var(--accent-soft)" : isToday ? "var(--accent-bg)" : "var(--surface)",
          cursor: "pointer",
          borderRadius: "var(--radius)",
          transition: "all 0.15s",
        }}
        onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--accent)"}
        onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--border)"}
      >
        <div style={{
          fontSize: "var(--font-sm)",
          fontWeight: isToday ? 700 : 400,
          color: isToday ? "var(--accent)" : "var(--text)",
          marginBottom: 4,
        }}>
          {day}
        </div>
        {appointments.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {appointments.slice(0, 2).map(p => (
              <div
                key={p.id}
                style={{
                  fontSize: "var(--font-2xs)",
                  padding: "2px 4px",
                  background: "var(--blue-bg)",
                  color: "var(--blue)",
                  borderRadius: 2,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {p.name}
              </div>
            ))}
            {appointments.length > 2 && (
              <div style={{ fontSize: "var(--font-2xs)", color: "var(--muted)" }}>
                +{appointments.length - 2} more
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  const selectedDateAppointments = selectedDate ? getAppointmentsForDate(selectedDate) : [];

  return (
    <div style={{ padding: 24, maxWidth: 1400 }}>
      <h2 style={{ fontSize: "var(--font-xl)", fontWeight: 800, marginBottom: 20 }}>Appointments</h2>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-label"><i className="ti ti-calendar" style={{ fontSize: 11, marginRight: 4 }} />Upcoming</div>
          <div className="stat-value" style={{ color: "var(--blue)" }}>{upcoming.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label"><i className="ti ti-clock-exclamation" style={{ fontSize: 11, marginRight: 4 }} />Follow-Up Overdue</div>
          <div className="stat-value" style={{ color: "var(--amber)" }}>{overdue.length}</div>
        </div>
      </div>

      {/* Calendar Controls */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 16,
        padding: "12px 16px",
        background: "var(--surface2)",
        borderRadius: "var(--radius)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="btn btn-ghost" onClick={goToPreviousMonth}>
            <i className="ti ti-chevron-left" style={{ fontSize: 14 }} />
          </button>
          <span style={{ fontSize: "var(--font-md)", fontWeight: 700, minWidth: 200, textAlign: "center" }}>
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </span>
          <button className="btn btn-ghost" onClick={goToNextMonth}>
            <i className="ti ti-chevron-right" style={{ fontSize: 14 }} />
          </button>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost" onClick={goToToday}>
            Today
          </button>
          <button className="btn btn-primary" onClick={() => setShowNewAppointmentModal(true)}>
            <i className="ti ti-plus" style={{ fontSize: 14, marginRight: 4 }} />
            New Appointment
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(7, 1fr)",
        gap: 8,
        marginBottom: 24,
      }}>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
          <div key={day} style={{
            textAlign: "center",
            fontSize: "var(--font-sm)",
            fontWeight: 600,
            color: "var(--muted)",
            padding: 8,
          }}>
            {day}
          </div>
        ))}
        {calendarDays}
      </div>

      {/* Selected Date Details */}
      {selectedDate && (
        <div className="card card-padded" style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: "var(--font-md)", fontWeight: 700, marginBottom: 16 }}>
            Appointments for {selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </h3>
          {selectedDateAppointments.length === 0 ? (
            <div style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>
              <i className="ti ti-calendar-off" style={{ fontSize: 32, marginBottom: 8 }} />
              <div>No appointments scheduled</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {selectedDateAppointments.map(p => (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: 12,
                    background: "var(--surface2)",
                    borderRadius: "var(--radius)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: "var(--accent-soft)",
                    color: "var(--accent)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 700,
                  }}>
                    {p.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{p.name}</div>
                    <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>
                      {p.doctor} · {p.status}
                    </div>
                  </div>
                  <button className="btn btn-ghost" style={{ fontSize: "var(--font-sm)" }} onClick={() => alert(`View details for ${p.name} - This would navigate to the patient profile page.`)}>
                    View Details
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {overdue.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div className="section-label" style={{ marginBottom: 10 }}>
            <i className="ti ti-alert-circle" style={{ marginRight: 4 }} />
            Follow-Up Overdue ({overdue.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {overdue.slice(0, 10).map((p) => (
              <div key={p.id} className="card card-padded" style={{
                display: "flex", alignItems: "center", gap: 12,
                border: "1px solid var(--amber-border)", background: "var(--amber-bg)",
              }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "#f59e0b20", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <i className="ti ti-phone" style={{ fontSize: 16, color: "var(--amber)" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "var(--font-sm)", fontWeight: 700 }}>{p.name}</div>
                  <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>
                    {p.followUpReason || "Follow-up required"} · {p.doctor}
                  </div>
                </div>
                <span style={{ fontSize: "var(--font-xs)", fontWeight: 700, color: "var(--amber)" }}>
                  Due {fmtDate(p.followUpDate)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="section-label" style={{ marginBottom: 10 }}>
          <i className="ti ti-calendar-check" style={{ marginRight: 4 }} />
          Upcoming Appointments
        </div>
        <div className="card" style={{ overflow: "hidden" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Doctor</th>
                <th>Appointment Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {upcoming.length === 0 ? (
                <tr><td colSpan={4}><div className="empty-state"><i className="ti ti-calendar-off empty-state-icon" /><div className="empty-state-sub">No upcoming appointments</div></div></td></tr>
              ) : upcoming.map((p) => (
                <tr key={p.id} className="tbl-row">
                  <td>
                    <div style={{ fontWeight: 600, fontSize: "var(--font-sm)" }}>{p.name}</div>
                    <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{p.id}</div>
                  </td>
                  <td style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>{p.doctor}</td>
                  <td style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{fmtDate(p.nextAppointment)}</td>
                  <td>
                    <span className="badge" style={{ background: "var(--blue-bg)", color: "var(--blue)", border: "1px solid var(--blue-border)" }}>
                      Scheduled
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Appointment Modal */}
      {showNewAppointmentModal && (
        <div className="modal-backdrop" onClick={() => setShowNewAppointmentModal(false)}>
          <div className="modal" style={{ maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontWeight: 700, fontSize: "var(--font-md)" }}>New Appointment</div>
              <button className="btn-icon" onClick={() => setShowNewAppointmentModal(false)}><i className="ti ti-x" style={{ fontSize: 16 }} /></button>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Patient</label>
                <select
                  value={selectedPatientForAppointment?.id || ""}
                  onChange={(e) => setSelectedPatientForAppointment(patients.find(p => p.id === e.target.value) || null)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
                >
                  <option value="">Select patient...</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Date</label>
                <input
                  type="date"
                  value={selectedDate ? selectedDate.toISOString().split("T")[0] : ""}
                  onChange={(e) => setSelectedDate(e.target.value ? new Date(e.target.value) : null)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
                />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Time</label>
                <input
                  type="time"
                  value={appointmentTime}
                  onChange={(e) => setAppointmentTime(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
                />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Type</label>
                <select
                  value={appointmentType}
                  onChange={(e) => setAppointmentType(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
                >
                  <option value="consultation">Consultation</option>
                  <option value="follow-up">Follow-up</option>
                  <option value="checkup">Check-up</option>
                  <option value="procedure">Procedure</option>
                  <option value="emergency">Emergency</option>
                </select>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Notes</label>
                <textarea
                  value={appointmentNotes}
                  onChange={(e) => setAppointmentNotes(e.target.value)}
                  placeholder="Additional notes..."
                  rows={3}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)", resize: "vertical" }}
                />
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn btn-ghost" onClick={() => setShowNewAppointmentModal(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleCreateAppointment} disabled={!selectedPatientForAppointment || !selectedDate || !appointmentTime}>Schedule Appointment</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Billing ──────────────────────────────────────────────────────────────────
export function BillingPage({ patients }: { patients: Patient[] }) {
  const expired  = patients.filter((p) => p.insuranceStatus === "Expired");
  const expiring = patients.filter((p) => p.insuranceStatus === "Expiring");
  const insured  = patients.filter((p) => p.insuranceStatus === "Active");
  const none     = patients.filter((p) => p.insuranceStatus === "None");

  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedPatientForInvoice, setSelectedPatientForInvoice] = useState<Patient | null>(null);
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [invoiceDescription, setInvoiceDescription] = useState("");
  const [invoiceDueDate, setInvoiceDueDate] = useState("");

  const INSURERS = ["Star Health","HDFC ERGO","ICICI Lombard","Bajaj Allianz"];
  const insStats = INSURERS.map((name) => ({
    name,
    count: patients.filter((p) => p.insurer === name).length,
  }));

  const handleCreateInvoice = () => {
    if (!selectedPatientForInvoice || !invoiceAmount || !invoiceDescription) {
      alert("Please select a patient, enter amount, and description");
      return;
    }

    const newInvoice = {
      id: `inv-${Date.now()}`,
      patientId: selectedPatientForInvoice.id,
      patientName: selectedPatientForInvoice.name,
      amount: parseFloat(invoiceAmount),
      description: invoiceDescription,
      dueDate: invoiceDueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      status: "pending",
      createdAt: new Date().toISOString()
    };

    // Store invoice in localStorage
    const existingInvoices = JSON.parse(localStorage.getItem("clinic_crm_invoices") || "[]");
    localStorage.setItem("clinic_crm_invoices", JSON.stringify([...existingInvoices, newInvoice]));

    setShowInvoiceModal(false);
    setSelectedPatientForInvoice(null);
    setInvoiceAmount("");
    setInvoiceDescription("");
    setInvoiceDueDate("");
    alert(`Invoice created for ${selectedPatientForInvoice.name} - Amount: $${invoiceAmount}`);
  };

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h2 style={{ fontSize: "var(--font-xl)", fontWeight: 800, margin: 0 }}>Billing & Insurance</h2>
        <button className="btn btn-primary" onClick={() => setShowInvoiceModal(true)}>
          <i className="ti ti-plus" style={{ fontSize: 14, marginRight: 4 }} />
          Create Invoice
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        <StatCard label="Active Insurance" value={insured.length} color="var(--green)" icon="ti-shield-check" bg="var(--green-bg)" />
        <StatCard label="Expiring Soon"    value={expiring.length} color="var(--amber)" icon="ti-shield-exclamation" bg="var(--amber-bg)" />
        <StatCard label="Expired"          value={expired.length}  color="var(--red)"   icon="ti-shield-x" bg="var(--red-bg)" />
        <StatCard label="No Insurance"     value={none.length}     color="var(--muted)" icon="ti-shield-off" bg="var(--surface3)" />
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
                <tr><th>Patient</th><th>Provider</th><th>Expired</th><th>Doctor</th></tr>
              </thead>
              <tbody>
                {expired.slice(0, 15).map((p) => (
                  <tr key={p.id} className="tbl-row">
                    <td>
                      <div style={{ fontWeight: 600, fontSize: "var(--font-sm)" }}>{p.name}</div>
                      <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{p.id}</div>
                    </td>
                    <td style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>{p.insurer}</td>
                    <td style={{ fontSize: "var(--font-sm)", fontWeight: 700, color: "var(--red)" }}>{fmtDate(p.insuranceExpiry)}</td>
                    <td style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>{p.doctor}</td>
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

      {/* Invoice Modal */}
      {showInvoiceModal && (
        <div className="modal-backdrop" onClick={() => setShowInvoiceModal(false)}>
          <div className="modal" style={{ maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontWeight: 700, fontSize: "var(--font-md)" }}>Create Invoice</div>
              <button className="btn-icon" onClick={() => setShowInvoiceModal(false)}><i className="ti ti-x" style={{ fontSize: 16 }} /></button>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Patient</label>
                <select
                  value={selectedPatientForInvoice?.id || ""}
                  onChange={(e) => setSelectedPatientForInvoice(patients.find(p => p.id === e.target.value) || null)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
                >
                  <option value="">Select patient...</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Amount ($)</label>
                <input
                  type="number"
                  value={invoiceAmount}
                  onChange={(e) => setInvoiceAmount(e.target.value)}
                  placeholder="0.00"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
                />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Description</label>
                <textarea
                  value={invoiceDescription}
                  onChange={(e) => setInvoiceDescription(e.target.value)}
                  placeholder="Invoice description..."
                  rows={3}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)", resize: "vertical" }}
                />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Due Date</label>
                <input
                  type="date"
                  value={invoiceDueDate}
                  onChange={(e) => setInvoiceDueDate(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
                />
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn btn-ghost" onClick={() => setShowInvoiceModal(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleCreateInvoice} disabled={!selectedPatientForInvoice || !invoiceAmount || !invoiceDescription}>Create Invoice</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Reports ──────────────────────────────────────────────────────────────────
export function ReportsPage({ patients }: { patients: Patient[] }) {
  const stats = getPatientStats(patients);

  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h2 style={{ fontSize: "var(--font-xl)", fontWeight: 800, margin: 0 }}>Reports & Analytics</h2>
        <button className="btn btn-ghost" onClick={() => exportReportsToCSV(patients)}>
          <i className="ti ti-download" style={{ fontSize: 14 }} />
          Export Report
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
        <StatCard label="Total Patients"       value={stats.total}          color="var(--accent)" icon="ti-users"              bg="var(--accent-soft)" />
        <StatCard label="Active Patients"      value={stats.active}         color="var(--green)"  icon="ti-activity"           bg="var(--green-bg)" />
        <StatCard label="Critical Alerts"      value={stats.criticalAlerts} color="var(--red)"    icon="ti-alert-triangle"     bg="var(--red-bg)" />
        <StatCard label="Follow-Up Due"        value={stats.followUpDue}    color="var(--amber)"  icon="ti-clock"              bg="var(--amber-bg)" />
        <StatCard label="Insurance Expiring"   value={stats.insExpiring}    color="var(--amber)"  icon="ti-shield-exclamation" bg="var(--amber-bg)" />
        <StatCard label="New Patients"         value={stats.newPatients}    color="var(--blue)"   icon="ti-user-plus"          bg="var(--blue-bg)" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <PatientTrendsChart patients={patients} />
        <PatientStatusChart patients={patients} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <DoctorWorkloadChart patients={patients} />
        <InsuranceChart patients={patients} />
      </div>

      <div style={{ marginBottom: 16 }}>
        <RiskDistributionChart patients={patients} />
      </div>

      <div className="card card-padded">
        <div className="section-label" style={{ marginBottom: 12 }}>Data Quality</div>
        <QualityReport patients={patients} />
      </div>
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

// ─── Settings ─────────────────────────────────────────────────────────────────
export function SettingsPage({
  dark, setDark, role, setRole,
}: {
  dark: boolean;
  setDark: (d: boolean) => void;
  role: string;
  setRole: (r: any) => void;
}) {
  return (
    <div style={{ padding: 24, maxWidth: 700 }}>
      <h2 style={{ fontSize: "var(--font-xl)", fontWeight: 800, marginBottom: 20 }}>Settings</h2>

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
