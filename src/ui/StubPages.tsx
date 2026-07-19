import React, { useState } from "react";
import type { Patient } from "./types";
import { getPatientStats, fmtDate, exportReportsToCSV } from "./utils";
import {
  PatientTrendsChart,
  PatientStatusChart,
  DoctorWorkloadChart,
  InsuranceChart,
  RiskDistributionChart
} from "./Charts";
import { hasRole, normalizeRole } from "../shared/permissions";
import { logDeniedAction } from "../shared/services/deniedActionLogger";
// Phase 8E: Import workflow audit and validation helpers
import { logWorkflowAction } from "../shared/workflow/workflowAudit";
import { validateWorkflowTransition, type WorkflowEntityType } from "../shared/workflow/workflowStateMachine";
import { validateWorkflowPatientReference } from "../shared/workflow/workflowValidation";
import { logSuccessfulHandoff, logBlockedHandoff } from "../shared/workflow/workflowHandoff";

function getInitials(name: string): string {
  return name.split(" ").filter(Boolean).map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

// ─── localStorage helpers ────────────────────────────────────────────────────
function readJSON<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; } catch { return fallback; }
}
function writeJSON(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or disabled */ }
}

// ─── Appointments ─────────────────────────────────────────────────────────────
export function AppointmentsPage({ patients, onUpdatePatient, onViewPatient, userRole = "admin" }: { patients: Patient[]; onUpdatePatient?: (patient: Patient) => void; onViewPatient?: (patient: Patient) => void; userRole?: "receptionist" | "doctor" | "admin" }) {
  const normalizedRole = normalizeRole(userRole);

  // Local permission guards
  const canViewAppointments = hasRole(normalizedRole, ["admin", "doctor", "nurse", "receptionist"]);
  const canCreateAppointment = hasRole(normalizedRole, ["admin", "doctor", "nurse", "receptionist"]);
  const canEditAppointment = hasRole(normalizedRole, ["admin", "doctor", "nurse", "receptionist"]);
  const canCancelAppointment = hasRole(normalizedRole, ["admin", "doctor", "nurse", "receptionist"]);
  const canDeleteAppointment = hasRole(normalizedRole, ["admin"]);
  const canExportAppointments = hasRole(normalizedRole, ["admin", "receptionist"]);
  const canPrintAppointments = hasRole(normalizedRole, ["admin", "doctor", "nurse", "receptionist"]);
  const canViewBillingDetails = hasRole(normalizedRole, ["admin", "billing"]);
  const canViewInsuranceDetails = hasRole(normalizedRole, ["admin", "billing"]);

  const handleDeniedAccess = (action: string, resource: string) => {
    setPageFeedback({ type: "error", message: `You don't have permission to ${action} ${resource}.` });
    logDeniedAction({
      action,
      resource,
      role: normalizedRole,
      reason: "Insufficient permissions",
      severity: "medium",
    });
  };

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showNewAppointmentModal, setShowNewAppointmentModal] = useState(false);
  const [selectedPatientForAppointment, setSelectedPatientForAppointment] = useState<Patient | null>(null);
  const [appointmentDate, setAppointmentDate] = useState(""); // modal-local date, separate from calendar selectedDate
  const [appointmentTime, setAppointmentTime] = useState("");
  const [appointmentType, setAppointmentType] = useState("consultation");
  const [appointmentNotes, setAppointmentNotes] = useState("");
  // inline feedback
  const [modalError, setModalError] = useState("");
  const [modalSuccess, setModalSuccess] = useState("");
  const [pastDateWarning, setPastDateWarning] = useState(false);
  const [pastDateConfirmed, setPastDateConfirmed] = useState(false);
  // reschedule support — when set, modal prefills with this patient's existing appt
  const [reschedulePatient, setReschedulePatient] = useState<Patient | null>(null);
  // quick filter
  type QuickFilter = "all" | "today" | "week" | "overdue" | "upcoming";
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  // column filters
  const [filterDoctor, setFilterDoctor] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  // page-level feedback (replaces all alert() calls)
  const [pageFeedback, setPageFeedback] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  const showFeedback = (message: string, type: "success" | "error" | "info" = "success") => {
    setPageFeedback({ type, message });
    setTimeout(() => setPageFeedback(null), 4000);
  };

  // ─── Waitlist ───────────────────────────────────────────────────────────────
  interface WaitlistEntry {
    id: string;
    patientId: string;
    patientName: string;
    doctor: string;
    requestedDate: string;
    requestedTime: string;
    reason: string;
    addedAt: string;
  }
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>(() => readJSON<WaitlistEntry[]>("clinic_crm_waitlist", []));
  const [showWaitlistModal, setShowWaitlistModal] = useState(false);
  const [wlPatient, setWlPatient] = useState<Patient | null>(null);
  const [wlDate, setWlDate] = useState("");
  const [wlTime, setWlTime] = useState("");
  const [wlReason, setWlReason] = useState("");
  const [wlError, setWlError] = useState("");

  const saveWaitlist = (list: WaitlistEntry[]) => {
    setWaitlist(list);
    writeJSON("clinic_crm_waitlist", list);
  };

  const resetWaitlistModal = () => {
    setWlPatient(null); setWlDate(""); setWlTime(""); setWlReason(""); setWlError("");
  };

  const handleAddToWaitlist = () => {
    setWlError("");
    if (!wlPatient) { setWlError("Please select a patient."); return; }
    if (!wlDate) { setWlError("Please select a preferred date."); return; }
    if (!wlTime) { setWlError("Please select a preferred time."); return; }
    if (!wlReason) { setWlError("Please enter a reason."); return; }

    // Phase 8E: Validate patient reference before adding to waitlist
    const patientValidation = validateWorkflowPatientReference(wlPatient.id, patients, {
      requireActive: true, // Require active patient for waitlist
      allowDeleted: false,
      action: "add to waitlist"
    });
    if (!patientValidation.valid) {
      setWlError(patientValidation.reason);
      logBlockedHandoff({
        fromModule: "waitlist",
        toModule: "waitlist",
        action: "add_waitlist",
        patientId: wlPatient.id,
        reason: patientValidation.reason,
        actor: normalizedRole,
      });
      return;
    }

    // Phase 8E: Check for duplicate waitlist entries (same patient, same date)
    const duplicateWaitlist = waitlist.find(w => {
      return w.patientId === wlPatient.id && w.requestedDate === wlDate;
    });
    if (duplicateWaitlist) {
      setWlError("Patient already has a waitlist entry for this date.");
      logWorkflowAction({
        action: "duplicate_prevented",
        entityType: "waitlist",
        entityId: duplicateWaitlist.id,
        patientId: wlPatient.id,
        metadata: {
          reason: "Duplicate waitlist entry on same date",
          performedBy: normalizedRole,
        },
      });
      return;
    }

    const entry: WaitlistEntry = {
      id: `wl-${Date.now()}`,
      patientId: wlPatient.id,
      patientName: wlPatient.name,
      doctor: wlPatient.doctor || "",
      requestedDate: wlDate,
      requestedTime: wlTime,
      reason: wlReason,
      addedAt: new Date().toISOString(),
    };
    saveWaitlist([...waitlist, entry]);
    setShowWaitlistModal(false);
    resetWaitlistModal();
    showFeedback(`${entry.patientName} added to waitlist.`);
  };

  const handleRemoveFromWaitlist = (id: string) => {
    const entry = waitlist.find(w => w.id === id);
    saveWaitlist(waitlist.filter(w => w.id !== id));
    if (entry) showFeedback(`${entry.patientName} removed from waitlist.`);
  };

  const handleScheduleFromWaitlist = (entry: WaitlistEntry) => {
    // Find matching patient
    const patient = patients.find(p => p.id === entry.patientId) || null;
    resetModal();
    if (patient) setSelectedPatientForAppointment(patient);
    setAppointmentDate(entry.requestedDate);
    setAppointmentTime(entry.requestedTime);
    setAppointmentNotes(entry.reason);
    setAppointmentType("consultation");
    // After appointment created, we'll remove this waitlist entry. Store the id.
    setWaitlistEntryToRemove(entry.id);
    setShowNewAppointmentModal(true);
  };

  const [waitlistEntryToRemove, setWaitlistEntryToRemove] = useState<string | null>(null);

  // Escape key closes whichever modal is open
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // don't close if focus is inside an input/textarea/select (typing Escape in a field)
      const tag = (document.activeElement?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (showNewAppointmentModal) { setShowNewAppointmentModal(false); resetModal(); }
      if (showWaitlistModal) { setShowWaitlistModal(false); resetWaitlistModal(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showNewAppointmentModal, showWaitlistModal]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekEnd = new Date(today); weekEnd.setDate(today.getDate() + 7);

  const allUpcoming = React.useMemo((): Patient[] =>
    patients
      .filter((p: Patient) => p.nextAppointment)
      .sort((a: Patient, b: Patient) => new Date(a.nextAppointment!).getTime() - new Date(b.nextAppointment!).getTime()),
    [patients]
  );

  const overdue = React.useMemo((): Patient[] =>
    patients.filter(
      (p: Patient) => p.status === "Follow-Up Due" || (p.followUpDate && new Date(p.followUpDate) < new Date())
    ),
    [patients]
  );

  // derive unique doctors for filter dropdown
  const doctorOptions = React.useMemo((): string[] => {
    const set = new Set<string>();
    patients.forEach((p: Patient) => { if (p.doctor) set.add(p.doctor); });
    return Array.from(set).sort();
  }, [patients]);

  // apply filters to the upcoming list
  const filteredUpcoming = React.useMemo((): Patient[] => {
    let list: Patient[] = allUpcoming;
    if (quickFilter === "today") {
      list = list.filter((p: Patient) => {
        const d = new Date(p.nextAppointment!); d.setHours(0,0,0,0);
        return d.getTime() === today.getTime();
      });
    } else if (quickFilter === "week") {
      list = list.filter((p: Patient) => {
        const d = new Date(p.nextAppointment!);
        return d >= today && d <= weekEnd;
      });
    } else if (quickFilter === "overdue") {
      list = overdue;
    } else if (quickFilter === "upcoming") {
      list = list.filter((p: Patient) => new Date(p.nextAppointment!) >= today);
    }
    if (filterDoctor) list = list.filter((p: Patient) => p.doctor === filterDoctor);
    if (filterType) list = list.filter((p: Patient) => (p as any).appointmentType === filterType);
    if (filterDateFrom) list = list.filter((p: Patient) => new Date(p.nextAppointment!) >= new Date(filterDateFrom));
    if (filterDateTo) list = list.filter((p: Patient) => new Date(p.nextAppointment!) <= new Date(filterDateTo + "T23:59:59"));
    return list.slice(0, 50);
  }, [allUpcoming, overdue, quickFilter, filterDoctor, filterType, filterDateFrom, filterDateTo]);

  const resetModal = () => {
    setSelectedPatientForAppointment(null);
    setAppointmentDate("");
    setAppointmentTime("");
    setAppointmentType("consultation");
    setAppointmentNotes("");
    setModalError("");
    setModalSuccess("");
    setPastDateWarning(false);
    setPastDateConfirmed(false);
    setReschedulePatient(null);
  };

  const openNewAppointment = () => {
    resetModal();
    // prefill date from calendar selection if available
    if (selectedDate) {
      setAppointmentDate(selectedDate.toISOString().split("T")[0]);
    }
    setShowNewAppointmentModal(true);
  };

  const openReschedule = (p: Patient) => {
    resetModal();
    setReschedulePatient(p);
    setSelectedPatientForAppointment(p);
    if (p.nextAppointment) {
      const d = new Date(p.nextAppointment);
      setAppointmentDate(d.toISOString().split("T")[0]);
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      setAppointmentTime(`${hh}:${mm}`);
    }
    setShowNewAppointmentModal(true);
  };

  const handleUpdatePatientStatus = (p: Patient, newStatus: string, extra?: Partial<Patient>) => {
    if (!onUpdatePatient) {
      showFeedback("No update handler provided by parent — changes not saved.", "error");
      return;
    }
    // Queue/App uses extended appointment statuses; cast keeps frontend workflow compatible.
    const updatedPatient: Patient = {
      ...p,
      ...extra,
      status: newStatus as Patient["status"],
      updatedAt: new Date().toISOString(),
    };
    onUpdatePatient(updatedPatient);
    showFeedback(`${p.name} marked as ${newStatus}.`);
  };

  const handleCancelAppointment = (p: Patient) => {
    if (!canCancelAppointment) {
      handleDeniedAccess("cancel", "appointment");
      return;
    }
    if (!onUpdatePatient) { showFeedback("No update handler — changes not saved.", "error"); return; }
    
    // Phase 8E: Validate patient reference before cancel
    const patientValidation = validateWorkflowPatientReference(p.id, patients, {
      requireActive: false, // Allow cancelling appointments for inactive patients
      allowDeleted: false,
      action: "cancel appointment"
    });
    if (!patientValidation.valid) {
      showFeedback(patientValidation.reason, "error");
      logBlockedHandoff({
        fromModule: "appointments",
        toModule: "appointments",
        action: "cancel_appointment",
        patientId: p.id,
        reason: patientValidation.reason,
        actor: normalizedRole,
      });
      return;
    }

    // Phase 8E: Separate appointment status from patient status
    // Appointment cancellation should NOT set patient status to Inactive
    const updatedPatient: Patient = {
      ...p,
      // Keep patient status unchanged - only clear appointment
      nextAppointment: undefined,
      // Track appointment status separately if needed
      ...(p as any).appointmentStatus ? { appointmentStatus: "cancelled" as const } : {},
      updatedAt: new Date().toISOString(),
    };
    onUpdatePatient(updatedPatient);
    
    // Phase 8E: Log appointment cancellation with PHI-safe audit logging
    logWorkflowAction({
      action: "appointment_cancelled",
      entityType: "appointment",
      entityId: p.id,
      patientId: p.id,
      metadata: {
        oldStatus: (p as any).appointmentStatus || "scheduled",
        newStatus: "cancelled",
        performedBy: normalizedRole,
      },
    });
    
    showFeedback(`Appointment for ${p.name} cancelled.`);
  };

  const handleExportAppointments = () => {
    if (!canExportAppointments) {
      handleDeniedAccess("export", "appointments");
      return;
    }
    if (filteredUpcoming.length === 0) {
      showFeedback("No appointments to export with current filters.", "info");
      return;
    }
    // Phase 8J: Remove patientName from appointment CSV export (PHI-safe)
    const header = "Patient ID,Doctor,Appointment Date,Status,Type\n";
    const rows = filteredUpcoming.map(p => {
      const apptType = (p as any).appointmentType || "";
      const apptDate = p.nextAppointment ? new Date(p.nextAppointment).toLocaleString() : "";
      return [`"${p.id}"`, `"${p.doctor || ""}"`, `"${apptDate}"`, `"${p.status}"`, `"${apptType}"`].join(",");
    }).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "appointments.csv"; a.click();
    URL.revokeObjectURL(url);
    showFeedback(`Exported ${filteredUpcoming.length} appointment(s).`);
  };

  const handleCreateAppointment = () => {
    if (!canCreateAppointment) {
      handleDeniedAccess("create", "appointment");
      return;
    }
    setModalError("");
    setModalSuccess("");

    // Validation
    if (!selectedPatientForAppointment) { setModalError("Please select a patient."); return; }
    if (!appointmentDate) { setModalError("Please select a date."); return; }
    if (!appointmentTime) { setModalError("Please select a time."); return; }
    if (!appointmentType) { setModalError("Please select an appointment type."); return; }

    // Phase 8E: Validate patient reference before creating appointment
    const patientValidation = validateWorkflowPatientReference(selectedPatientForAppointment.id, patients, {
      requireActive: true, // Require active patient for new appointments
      allowDeleted: false,
      action: "create appointment"
    });
    if (!patientValidation.valid) {
      setModalError(patientValidation.reason);
      logBlockedHandoff({
        fromModule: "appointments",
        toModule: "appointments",
        action: "create_appointment",
        patientId: selectedPatientForAppointment.id,
        reason: patientValidation.reason,
        actor: normalizedRole,
      });
      return;
    }

    // Phase 8E: Check for duplicate appointments (same patient, same date, active status)
    const appointmentDateStr = appointmentDate;
    const duplicateAppointment = patients.find(p => {
      if (p.id === selectedPatientForAppointment.id && p.nextAppointment) {
        const existingApptDate = new Date(p.nextAppointment).toISOString().split("T")[0];
        const existingApptStatus = (p.status || "").toLowerCase();
        // Check if same date and status is not completed/cancelled/no-show
        return existingApptDate === appointmentDateStr && 
               !["completed", "cancelled", "no-show"].includes(existingApptStatus);
      }
      return false;
    });
    if (duplicateAppointment && !reschedulePatient) {
      setModalError("Patient already has an active appointment on this date. Please reschedule the existing appointment first.");
      logWorkflowAction({
        action: "duplicate_prevented",
        entityType: "appointment",
        entityId: duplicateAppointment.id,
        patientId: selectedPatientForAppointment.id,
        metadata: {
          reason: "Duplicate appointment on same date",
          performedBy: normalizedRole,
        },
      });
      return;
    }

    const [hoursStr, minutesStr] = appointmentTime.split(":");
    const hours = parseInt(hoursStr, 10);
    const minutes = parseInt(minutesStr, 10);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) { setModalError("Please enter a valid time."); return; }

    // Build datetime — parse date parts directly to avoid timezone offset bugs
    const [yyyy, mm, dd] = appointmentDate.split("-").map(Number);
    const appointmentDateTime = new Date(yyyy, mm - 1, dd, hours, minutes, 0, 0);
    if (isNaN(appointmentDateTime.getTime())) { setModalError("Invalid date or time."); return; }

    // Past date check
    if (appointmentDateTime < new Date() && !pastDateConfirmed) {
      setPastDateWarning(true);
      setModalError("This appointment is in the past. Confirm below to proceed anyway.");
      return;
    }

    // Queue/App uses extended appointment statuses; cast keeps frontend workflow compatible.
    const updatedPatient: Patient = {
      ...selectedPatientForAppointment,
      nextAppointment: appointmentDateTime.toISOString(),
      status: "Scheduled" as Patient["status"],
      // Track appointment status separately
      ...(selectedPatientForAppointment as any).appointmentStatus ? { appointmentStatus: "scheduled" as const } : {},
      updatedAt: new Date().toISOString(),
    };

    if (onUpdatePatient) {
      onUpdatePatient(updatedPatient);
    } else {
      console.warn("AppointmentsPage: no onUpdatePatient handler — appointment not persisted");
    }

    // Phase 8E: Log appointment creation with PHI-safe audit logging
    logWorkflowAction({
      action: reschedulePatient ? "appointment_rescheduled" : "appointment_created",
      entityType: "appointment",
      entityId: selectedPatientForAppointment.id,
      patientId: selectedPatientForAppointment.id,
      metadata: {
        appointmentDate: appointmentDateTime.toISOString(),
        appointmentType,
        performedBy: normalizedRole,
      },
    });

    // If scheduled from waitlist, remove the waitlist entry
    if (waitlistEntryToRemove) {
      saveWaitlist(waitlist.filter(w => w.id !== waitlistEntryToRemove));
      setWaitlistEntryToRemove(null);
    }

    const label = reschedulePatient ? "Rescheduled" : "Scheduled";
    setModalSuccess(`${label}: ${selectedPatientForAppointment.name} on ${appointmentDateTime.toLocaleString()}`);
    showFeedback(`${label}: ${selectedPatientForAppointment.name} on ${appointmentDateTime.toLocaleDateString()}`);

    // Close modal and reset after a short pause so user sees success
    setTimeout(() => {
      setShowNewAppointmentModal(false);
      resetModal();
    }, 900);
  };

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const appointmentsByDate = React.useMemo(() => {
    const map = new Map<string, Patient[]>();
    for (const p of patients) {
      if (!p.nextAppointment) continue;
      const d = new Date(p.nextAppointment);
      if (isNaN(d.getTime())) continue;
      const key = d.toDateString();
      const list = map.get(key);
      if (list) list.push(p); else map.set(key, [p]);
    }
    return map;
  }, [patients]);

  const getAppointmentsForDate = (date: Date) => appointmentsByDate.get(date.toDateString()) ?? [];

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    setSelectedDate(null);
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    setSelectedDate(null);
  };

  const goToToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDate(now);
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
        role="button"
        tabIndex={0}
        aria-label={`${monthNames[currentDate.getMonth()]} ${day}, ${appointments.length} appointment${appointments.length === 1 ? "" : "s"}`}
        aria-pressed={!!isSelected}
        className="calendar-day-cell"
        onClick={() => setSelectedDate(date)}
        onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedDate(date); } }}
        style={{
          padding: 6,
          minHeight: 72,
          border: isSelected ? "2px solid var(--accent)" : isToday ? "2px solid var(--accent)" : "1px solid var(--border)",
          background: isSelected ? "var(--accent-soft)" : isToday ? "var(--accent-bg)" : "var(--surface)",
          cursor: "pointer",
          borderRadius: "var(--radius)",
          transition: "all 0.15s",
          position: "relative",
        }}
      >
        <div style={{
          fontSize: "var(--font-sm)",
          fontWeight: isToday ? 700 : 400,
          color: isToday ? "var(--accent)" : "var(--text)",
          marginBottom: 4,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <span>{day}</span>
          {appointments.length > 0 && (
            <span style={{
              fontSize: 10,
              background: isSelected ? "var(--accent)" : "var(--blue)",
              color: "#fff",
              borderRadius: 10,
              padding: "0 5px",
              lineHeight: "16px",
              minWidth: 16,
              textAlign: "center",
            }}>
              {appointments.length}
            </span>
          )}
        </div>
        {appointments.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {appointments.slice(0, 2).map((p: Patient) => (
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

  // status badge colours for appointment actions
  const apptStatusColor = (s: string) => {
    if (s === "Checked In") return { bg: "var(--blue-bg)", color: "var(--blue)", border: "1px solid var(--blue-border)" };
    if (s === "Completed") return { bg: "var(--green-bg)", color: "var(--green)", border: "1px solid var(--green-border)" };
    if (s === "No Show" || s === "Cancelled") return { bg: "var(--red-bg)", color: "var(--red)", border: "1px solid var(--red-border)" };
    return { bg: "var(--blue-bg)", color: "var(--blue)", border: "1px solid var(--blue-border)" };
  };

  return (
    <div style={{ padding: 24, maxWidth: 1400 }}>
      <style>{`
        .calendar-day-cell:hover, .calendar-day-cell:focus-visible { border-color: var(--accent) !important; }
        @media (max-width: 640px) {
          .appt-cal-grid { grid-template-columns: repeat(7, 1fr) !important; gap: 2px !important; }
          .appt-cal-grid .calendar-day-cell { min-height: 44px !important; padding: 3px !important; font-size: 11px; }
          .appt-filter-row { flex-wrap: wrap !important; }
          .appt-quick-filters { flex-wrap: wrap !important; }
          .appt-action-btns { flex-direction: column !important; align-items: stretch !important; }
        }
      `}</style>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ fontSize: "var(--font-xl)", fontWeight: 800, margin: 0 }}>Appointments</h2>
        {pageFeedback && (
          <div style={{
            padding: "6px 14px",
            background: pageFeedback.type === "success" ? "var(--green-bg)" : pageFeedback.type === "error" ? "var(--red-bg)" : "var(--blue-bg)",
            color: pageFeedback.type === "success" ? "var(--green)" : pageFeedback.type === "error" ? "var(--red)" : "var(--blue)",
            border: `1px solid ${pageFeedback.type === "success" ? "var(--green-border)" : pageFeedback.type === "error" ? "var(--red-border)" : "var(--blue-border)"}`,
            borderRadius: "var(--radius)", fontSize: "var(--font-sm)", fontWeight: 600,
          }}>
            <i className={`ti ${pageFeedback.type === "success" ? "ti-circle-check" : pageFeedback.type === "error" ? "ti-alert-circle" : "ti-info-circle"}`} style={{ marginRight: 6 }} />
            {pageFeedback.message}
          </div>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        <div className="stat-card" style={{ cursor: "pointer", outline: quickFilter === "all" ? "2px solid var(--accent)" : undefined }} onClick={() => setQuickFilter("all")}>
          <div className="stat-label"><i className="ti ti-calendar" style={{ fontSize: 11, marginRight: 4 }} />Total w/ Appt</div>
          <div className="stat-value" style={{ color: "var(--accent)" }}>{allUpcoming.length}</div>
        </div>
        <div className="stat-card" style={{ cursor: "pointer", outline: quickFilter === "today" ? "2px solid var(--accent)" : undefined }} onClick={() => setQuickFilter("today")}>
          <div className="stat-label"><i className="ti ti-sun" style={{ fontSize: 11, marginRight: 4 }} />Today</div>
          <div className="stat-value" style={{ color: "var(--blue)" }}>{allUpcoming.filter((p: Patient) => { const d = new Date(p.nextAppointment!); d.setHours(0,0,0,0); return d.getTime() === today.getTime(); }).length}</div>
        </div>
        <div className="stat-card" style={{ cursor: "pointer", outline: quickFilter === "week" ? "2px solid var(--accent)" : undefined }} onClick={() => setQuickFilter("week")}>
          <div className="stat-label"><i className="ti ti-calendar-week" style={{ fontSize: 11, marginRight: 4 }} />This Week</div>
          <div className="stat-value" style={{ color: "var(--blue)" }}>{allUpcoming.filter((p: Patient) => { const d = new Date(p.nextAppointment!); return d >= today && d <= weekEnd; }).length}</div>
        </div>
        <div className="stat-card" style={{ cursor: "pointer", outline: quickFilter === "overdue" ? "2px solid var(--accent)" : undefined }} onClick={() => setQuickFilter("overdue")}>
          <div className="stat-label"><i className="ti ti-clock-exclamation" style={{ fontSize: 11, marginRight: 4 }} />Follow-Up Overdue</div>
          <div className="stat-value" style={{ color: "var(--amber)" }}>{overdue.length}</div>
        </div>
      </div>

      {/* Quick filter chips */}
      <div className="appt-quick-filters" style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {(["all","today","week","overdue","upcoming"] as QuickFilter[]).map(f => (
          <button
            key={f}
            className={quickFilter === f ? "btn btn-primary" : "btn btn-ghost"}
            style={{ fontSize: "var(--font-xs)", padding: "4px 12px", textTransform: "capitalize" }}
            onClick={() => setQuickFilter(f)}
          >
            {f === "all" ? "All" : f === "today" ? "Today" : f === "week" ? "This Week" : f === "overdue" ? "Overdue" : "Upcoming"}
          </button>
        ))}
      </div>

      {/* Filters row */}
      <div className="appt-filter-row" style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <select
          value={filterDoctor}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterDoctor(e.target.value)}
          style={{ padding: "6px 10px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)", minWidth: 140 }}
        >
          <option value="">All Doctors</option>
          {doctorOptions.map((d: string) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select
          value={filterType}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterType(e.target.value)}
          style={{ padding: "6px 10px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)", minWidth: 140 }}
        >
          <option value="">All Types</option>
          <option value="consultation">Consultation</option>
          <option value="follow-up">Follow-up</option>
          <option value="checkup">Check-up</option>
          <option value="procedure">Procedure</option>
          <option value="emergency">Emergency</option>
        </select>
        <input
          type="date"
          value={filterDateFrom}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilterDateFrom(e.target.value)}
          title="From date"
          style={{ padding: "6px 10px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
        />
        <input
          type="date"
          value={filterDateTo}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilterDateTo(e.target.value)}
          title="To date"
          style={{ padding: "6px 10px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
        />
        {(filterDoctor || filterType || filterDateFrom || filterDateTo) && (
          <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} onClick={() => { setFilterDoctor(""); setFilterType(""); setFilterDateFrom(""); setFilterDateTo(""); }}>
            <i className="ti ti-x" style={{ fontSize: 11, marginRight: 4 }} />Clear
          </button>
        )}
      </div>

      {/* Calendar Controls */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 12,
        padding: "10px 14px",
        background: "var(--surface2)",
        borderRadius: "var(--radius)",
        flexWrap: "wrap",
        gap: 8,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button className="btn btn-ghost" onClick={goToPreviousMonth}>
            <i className="ti ti-chevron-left" style={{ fontSize: 14 }} />
          </button>
          <span style={{ fontSize: "var(--font-md)", fontWeight: 700, minWidth: 160, textAlign: "center" }}>
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </span>
          <button className="btn btn-ghost" onClick={goToNextMonth}>
            <i className="ti ti-chevron-right" style={{ fontSize: 14 }} />
          </button>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost" onClick={goToToday}>Today</button>
          <button className="btn btn-primary" onClick={openNewAppointment}>
            <i className="ti ti-plus" style={{ fontSize: 14, marginRight: 4 }} />
            New Appointment
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="appt-cal-grid" style={{
        display: "grid",
        gridTemplateColumns: "repeat(7, 1fr)",
        gap: 6,
        marginBottom: 24,
      }}>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
          <div key={day} style={{
            textAlign: "center",
            fontSize: "var(--font-sm)",
            fontWeight: 600,
            color: "var(--muted)",
            padding: "6px 0",
          }}>
            {day}
          </div>
        ))}
        {calendarDays}
      </div>

      {/* Selected Date Details */}
      {selectedDate ? (
        <div className="card card-padded" style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <h3 style={{ fontSize: "var(--font-md)", fontWeight: 700, margin: 0 }}>
              {selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
            </h3>
            <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} onClick={() => { openNewAppointment(); }}>
              <i className="ti ti-plus" style={{ fontSize: 11, marginRight: 4 }} />Add for this day
            </button>
          </div>
          {selectedDateAppointments.length === 0 ? (
            <div style={{ textAlign: "center", padding: "28px 16px", color: "var(--muted)" }}>
              <i className="ti ti-calendar-off" style={{ fontSize: 28, display: "block", marginBottom: 8 }} />
              <div style={{ fontWeight: 600, marginBottom: 4 }}>No appointments on this day</div>
              <div style={{ fontSize: "var(--font-xs)" }}>Click "Add for this day" to schedule one.</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {selectedDateAppointments.map((p: Patient) => (
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
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{
                    width: 38, height: 38, borderRadius: "50%",
                    background: "var(--accent-soft)", color: "var(--accent)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 700, flexShrink: 0,
                  }}>
                    {getInitials(p.name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 100 }}>
                    <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{p.name}</div>
                    <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>
                      {p.doctor} · {new Date(p.nextAppointment!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                  <div className="appt-action-btns" style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {onViewPatient && (
                      <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "4px 8px" }} onClick={() => onViewPatient(p)}>
                        View
                      </button>
                    )}
                    <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "4px 8px", color: "var(--blue)" }}
                      onClick={() => handleUpdatePatientStatus(p, "Checked In")}>
                      Check In
                    </button>
                    <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "4px 8px", color: "var(--green)" }}
                      onClick={() => handleUpdatePatientStatus(p, "Active" /* closest to Completed — PatientStatus may not have "Completed" */)}>
                      Complete
                    </button>
                    <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "4px 8px", color: "var(--amber)" }}
                      onClick={() => handleUpdatePatientStatus(p, "Follow-Up Due" /* closest to No-Show */)}>
                      No Show
                    </button>
                    <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "4px 8px", color: "var(--red)" }}
                      onClick={() => handleUpdatePatientStatus(p, "Inactive" /* closest to Cancelled */)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="card card-padded" style={{ marginBottom: 24, textAlign: "center", padding: "28px 16px", color: "var(--muted)" }}>
          <i className="ti ti-calendar" style={{ fontSize: 28, display: "block", marginBottom: 8 }} />
          <div style={{ fontWeight: 600, marginBottom: 4 }}>No date selected</div>
          <div style={{ fontSize: "var(--font-xs)" }}>Click a day on the calendar to see appointments.</div>
        </div>
      )}

      {overdue.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div className="section-label" style={{ marginBottom: 10 }}>
            <i className="ti ti-alert-circle" style={{ marginRight: 4 }} />
            Follow-Up Overdue ({overdue.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {overdue.slice(0, 10).map((p: Patient) => (
              <div key={p.id} className="card card-padded" style={{
                display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
                border: "1px solid var(--amber-border)", background: "var(--amber-bg)",
              }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "#f59e0b20", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <i className="ti ti-phone" style={{ fontSize: 16, color: "var(--amber)" }} />
                </div>
                <div style={{ flex: 1, minWidth: 100 }}>
                  <div style={{ fontSize: "var(--font-sm)", fontWeight: 700 }}>{p.name}</div>
                  <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>
                    {p.followUpReason || "Follow-up required"} · {p.doctor}
                  </div>
                </div>
                <span style={{ fontSize: "var(--font-xs)", fontWeight: 700, color: "var(--amber)" }}>
                  Due {fmtDate(p.followUpDate)}
                </span>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {onViewPatient && (
                    <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "3px 8px" }} onClick={() => onViewPatient(p)}>
                      View
                    </button>
                  )}
                  {p.phone ? (
                    <a href={`tel:${p.phone}`} className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "3px 8px", textDecoration: "none", color: "var(--amber)" }}>
                      <i className="ti ti-phone" style={{ fontSize: 11, marginRight: 3 }} />Call
                    </a>
                  ) : (
                    <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "3px 8px", color: "var(--muted)" }}
                      onClick={() => showFeedback(`No phone on file for ${p.name}.`, "info")}>
                      <i className="ti ti-phone" style={{ fontSize: 11, marginRight: 3 }} />Call
                    </button>
                  )}
                  {p.email ? (
                    <a href={`mailto:${p.email}`} className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "3px 8px", textDecoration: "none" }}>
                      <i className="ti ti-mail" style={{ fontSize: 11, marginRight: 3 }} />Message
                    </a>
                  ) : (
                    <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "3px 8px", color: "var(--muted)" }}
                      onClick={() => showFeedback(`No email on file for ${p.name}.`, "info")}>
                      <i className="ti ti-mail" style={{ fontSize: 11, marginRight: 3 }} />Message
                    </button>
                  )}
                  <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "3px 8px", color: "var(--blue)" }}
                    onClick={() => openReschedule(p)}>
                    Schedule
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Appointments Table */}
      <div>
        <div className="section-label" style={{ marginBottom: 10 }}>
          <i className="ti ti-calendar-check" style={{ marginRight: 4 }} />
          {quickFilter === "all" ? "All Appointments" : quickFilter === "today" ? "Today's Appointments" : quickFilter === "week" ? "This Week" : quickFilter === "overdue" ? "Overdue Follow-Ups" : "Upcoming Appointments"}
          {filteredUpcoming.length !== allUpcoming.length && (
            <span style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginLeft: 8, fontWeight: 400 }}>({filteredUpcoming.length} shown)</span>
          )}
        </div>
        <div className="card" style={{ overflow: "hidden" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Doctor</th>
                <th>Appointment Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUpcoming.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="empty-state" style={{ padding: "32px 16px", textAlign: "center", color: "var(--muted)" }}>
                      <i className="ti ti-calendar-off" style={{ fontSize: 28, display: "block", marginBottom: 8 }} />
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>No appointments found</div>
                      <div style={{ fontSize: "var(--font-xs)" }}>
                        {patients.length === 0
                          ? "No patients are registered yet. Add a patient first."
                          : "Try adjusting the filters or schedule a new appointment."}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : filteredUpcoming.map((p: Patient) => (
                <tr key={p.id} className="tbl-row">
                  <td>
                    <div style={{ fontWeight: 600, fontSize: "var(--font-sm)" }}>{p.name}</div>
                    <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{p.id}</div>
                  </td>
                  <td style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>{p.doctor}</td>
                  <td style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{fmtDate(p.nextAppointment)}</td>
                  <td>
                    <span className="badge" style={apptStatusColor(p.status)}>
                      {p.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {onViewPatient && (
                        <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "3px 8px" }} onClick={() => onViewPatient(p)}>
                          View
                        </button>
                      )}
                      <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "3px 8px" }} onClick={() => openReschedule(p)}>
                        Reschedule
                      </button>
                      <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "3px 8px", color: "var(--green)" }}
                        onClick={() => handleUpdatePatientStatus(p, "Active")}>
                        Done
                      </button>
                      <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "3px 8px", color: "var(--red)" }}
                        onClick={() => handleCancelAppointment(p)}>
                        Cancel
                      </button>
                      {p.phone ? (
                        <a href={`tel:${p.phone}`} className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "3px 8px", textDecoration: "none" }}>
                          <i className="ti ti-phone" style={{ fontSize: 11 }} />
                        </a>
                      ) : (
                        <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "3px 8px", color: "var(--muted)" }}
                          onClick={() => showFeedback(`No phone on file for ${p.name}.`, "info")}>
                          <i className="ti ti-phone" style={{ fontSize: 11 }} />
                        </button>
                      )}
                      {p.email ? (
                        <a href={`mailto:${p.email}`} className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "3px 8px", textDecoration: "none" }}>
                          <i className="ti ti-mail" style={{ fontSize: 11 }} />
                        </a>
                      ) : (
                        <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "3px 8px", color: "var(--muted)" }}
                          onClick={() => showFeedback(`No email on file for ${p.name}.`, "info")}>
                          <i className="ti ti-mail" style={{ fontSize: 11 }} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Export + Waitlist button row */}
      <div style={{ display: "flex", gap: 8, marginTop: 16, marginBottom: 24, flexWrap: "wrap" }}>
        {canExportAppointments && (
          <button className="btn btn-ghost" onClick={handleExportAppointments}>
            <i className="ti ti-download" style={{ fontSize: 14, marginRight: 4 }} />Export CSV
          </button>
        )}
        <button className="btn btn-ghost" onClick={() => { resetWaitlistModal(); setShowWaitlistModal(true); }}>
          <i className="ti ti-clock-plus" style={{ fontSize: 14, marginRight: 4 }} />Add to Waitlist
        </button>
      </div>

      {/* Waitlist Section */}
      {waitlist.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div className="section-label" style={{ marginBottom: 10 }}>
            <i className="ti ti-clock" style={{ marginRight: 4 }} />Waitlist ({waitlist.length})
          </div>
          <div className="card" style={{ overflow: "hidden" }}>
            <table className="tbl">
              <thead>
                <tr><th>Patient</th><th>Doctor</th><th>Requested Date</th><th>Reason</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {waitlist.map((entry) => (
                  <tr key={entry.id} className="tbl-row">
                    <td>
                      <div style={{ fontWeight: 600, fontSize: "var(--font-sm)" }}>{entry.patientName}</div>
                      <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{entry.patientId}</div>
                    </td>
                    <td style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>{entry.doctor}</td>
                    <td style={{ fontSize: "var(--font-sm)" }}>{entry.requestedDate} {entry.requestedTime}</td>
                    <td style={{ fontSize: "var(--font-sm)", color: "var(--muted)", maxWidth: 200 }}>{entry.reason}</td>
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "3px 8px", color: "var(--blue)" }}
                          onClick={() => handleScheduleFromWaitlist(entry)}>
                          Schedule
                        </button>
                        <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "3px 8px", color: "var(--red)" }}
                          onClick={() => handleRemoveFromWaitlist(entry.id)}>
                          Remove
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

      {/* Waitlist Modal */}
      {showWaitlistModal && (
        <div className="modal-backdrop" onClick={() => { setShowWaitlistModal(false); resetWaitlistModal(); }}>
          <div className="modal" style={{ maxWidth: 460 }} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontWeight: 700, fontSize: "var(--font-md)" }}>Add to Waitlist</div>
              <button className="btn-icon" onClick={() => { setShowWaitlistModal(false); resetWaitlistModal(); }}>
                <i className="ti ti-x" style={{ fontSize: 16 }} />
              </button>
            </div>
            <div style={{ padding: 20 }}>
              {wlError && (
                <div style={{ marginBottom: 12, padding: "8px 12px", background: "var(--red-bg)", color: "var(--red)", border: "1px solid var(--red-border)", borderRadius: "var(--radius)", fontSize: "var(--font-sm)" }}>
                  <i className="ti ti-alert-circle" style={{ marginRight: 6 }} />{wlError}
                </div>
              )}
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Patient *</label>
                <PatientSelect patients={patients} value={wlPatient?.id || ""} onChange={(p) => { setWlPatient(p); setWlError(""); }} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Preferred Date *</label>
                <input type="date" value={wlDate} onChange={(e) => { setWlDate(e.target.value); setWlError(""); }}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Preferred Time *</label>
                <input type="time" value={wlTime} onChange={(e) => { setWlTime(e.target.value); setWlError(""); }}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Reason *</label>
                <textarea value={wlReason} onChange={(e) => { setWlReason(e.target.value); setWlError(""); }}
                  placeholder="Reason for waitlist..." rows={3}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)", resize: "vertical" }} />
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn btn-ghost" onClick={() => { setShowWaitlistModal(false); resetWaitlistModal(); }}>Cancel</button>
                <button className="btn btn-primary" onClick={handleAddToWaitlist} disabled={!wlPatient || !wlDate || !wlTime || !wlReason}>
                  Add to Waitlist
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New / Reschedule Appointment Modal */}
      {showNewAppointmentModal && (
        <div className="modal-backdrop" onClick={() => { setShowNewAppointmentModal(false); resetModal(); }}>
          <div className="modal" style={{ maxWidth: 500 }} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontWeight: 700, fontSize: "var(--font-md)" }}>
                {reschedulePatient ? `Reschedule — ${reschedulePatient.name}` : "New Appointment"}
              </div>
              <button className="btn-icon" onClick={() => { setShowNewAppointmentModal(false); resetModal(); }}>
                <i className="ti ti-x" style={{ fontSize: 16 }} />
              </button>
            </div>
            <div style={{ padding: 20 }}>
              {/* Inline feedback */}
              {modalError && (
                <div style={{ marginBottom: 12, padding: "8px 12px", background: "var(--red-bg)", color: "var(--red)", border: "1px solid var(--red-border)", borderRadius: "var(--radius)", fontSize: "var(--font-sm)" }}>
                  <i className="ti ti-alert-circle" style={{ marginRight: 6 }} />{modalError}
                  {pastDateWarning && !pastDateConfirmed && (
                    <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                      <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", color: "var(--red)", borderColor: "var(--red)" }}
                        onClick={() => { setPastDateConfirmed(true); setModalError(""); setPastDateWarning(false); }}>
                        Yes, schedule in the past
                      </button>
                      <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }}
                        onClick={() => { setPastDateWarning(false); setModalError(""); }}>
                        Choose another date
                      </button>
                    </div>
                  )}
                </div>
              )}
              {modalSuccess && (
                <div style={{ marginBottom: 12, padding: "8px 12px", background: "var(--green-bg)", color: "var(--green)", border: "1px solid var(--green-border)", borderRadius: "var(--radius)", fontSize: "var(--font-sm)" }}>
                  <i className="ti ti-circle-check" style={{ marginRight: 6 }} />{modalSuccess}
                </div>
              )}

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Patient *</label>
                {patients.length === 0 ? (
                  <div style={{ fontSize: "var(--font-sm)", color: "var(--muted)", padding: "8px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
                    No patients registered yet.
                  </div>
                ) : (
                  <PatientSelect
                    patients={patients}
                    value={selectedPatientForAppointment?.id || ""}
                    onChange={(p) => { setSelectedPatientForAppointment(p); setModalError(""); }}
                  />
                )}
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Date *</label>
                <input
                  type="date"
                  value={appointmentDate}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setAppointmentDate(e.target.value); setModalError(""); setPastDateWarning(false); setPastDateConfirmed(false); }}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
                />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Time *</label>
                <input
                  type="time"
                  value={appointmentTime}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setAppointmentTime(e.target.value); setModalError(""); }}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
                />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Type *</label>
                <select
                  value={appointmentType}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setAppointmentType(e.target.value); setModalError(""); }}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
                >
                  <option value="">Select type...</option>
                  <option value="consultation">Consultation</option>
                  <option value="follow-up">Follow-up</option>
                  <option value="checkup">Check-up</option>
                  <option value="procedure">Procedure</option>
                  <option value="emergency">Emergency</option>
                </select>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Notes</label>
                <textarea
                  value={appointmentNotes}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setAppointmentNotes(e.target.value)}
                  placeholder="Additional notes..."
                  rows={3}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)", resize: "vertical" }}
                />
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn btn-ghost" onClick={() => { setShowNewAppointmentModal(false); resetModal(); }}>Cancel</button>
                <button
                  className="btn btn-primary"
                  onClick={handleCreateAppointment}
                  disabled={!canCreateAppointment || !selectedPatientForAppointment || !appointmentDate || !appointmentTime || !appointmentType || !!modalSuccess}
                >
                  {reschedulePatient ? "Reschedule" : "Schedule Appointment"}
                </button>
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
  const [billingFeedback, setBillingFeedback] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const [invoiceModalError, setInvoiceModalError] = useState("");

  const showBillingFeedback = (message: string, type: "success" | "error" | "info" = "info") => {
    setBillingFeedback({ type, message });
    setTimeout(() => setBillingFeedback(null), 4000);
  };

  const INSURERS = ["Star Health","HDFC ERGO","ICICI Lombard","Bajaj Allianz"];
  const insStats = INSURERS.map((name) => ({
    name,
    count: patients.filter((p) => p.insurer === name).length,
  }));

  const resetInvoiceModal = () => {
    setSelectedPatientForInvoice(null);
    setInvoiceAmount("");
    setInvoiceDescription("");
    setInvoiceDueDate("");
    setInvoiceModalError("");
  };

  const handleExportInvoices = () => {
    if (!canViewBillingDetails) {
      handleDeniedAccess("export", "invoices");
      return;
    }
    let invoices: any[] = [];
    try { invoices = JSON.parse(localStorage.getItem("clinic_crm_invoices") || "[]"); } catch { invoices = []; }
    if (invoices.length === 0) {
      showBillingFeedback("No invoices to export yet.", "info");
      return;
    }
    // Phase 8J: Remove patientName from invoice CSV export (PHI-safe)
    const header = "ID,Patient ID,Amount,Description,Due Date,Status,Created\n";
    const rows = invoices.map((inv: any) =>
      [inv.id, `"${inv.patientId}"`, inv.amount, `"${inv.description}"`, inv.dueDate, inv.status, inv.createdAt].join(",")
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "invoices.csv"; a.click();
    URL.revokeObjectURL(url);
    showBillingFeedback(`Exported ${invoices.length} invoice(s).`, "success");
  };

  const handleCreateInvoice = () => {
    if (!canViewBillingDetails) {
      handleDeniedAccess("create", "invoice");
      return;
    }
    setInvoiceModalError("");
    if (!selectedPatientForInvoice) { setInvoiceModalError("Please select a patient."); return; }
    if (!invoiceAmount) { setInvoiceModalError("Please enter an amount."); return; }
    if (!invoiceDescription) { setInvoiceModalError("Please enter a description."); return; }

    const amount = parseFloat(invoiceAmount);
    if (Number.isNaN(amount) || amount <= 0) { setInvoiceModalError("Please enter a valid amount greater than 0."); return; }

    const newInvoice = {
      id: `inv-${Date.now()}`,
      patientId: selectedPatientForInvoice.id,
      patientName: selectedPatientForInvoice.name,
      amount,
      description: invoiceDescription,
      dueDate: invoiceDueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      status: "pending",
      createdAt: new Date().toISOString()
    };

    try {
      let existingInvoices: any[] = [];
      try { existingInvoices = JSON.parse(localStorage.getItem("clinic_crm_invoices") || "[]"); } catch { existingInvoices = []; }
      localStorage.setItem("clinic_crm_invoices", JSON.stringify([...existingInvoices, newInvoice]));
    } catch {
      setInvoiceModalError("Could not save the invoice (storage may be full or disabled).");
      return;
    }

    const patientName = selectedPatientForInvoice.name;
    setShowInvoiceModal(false);
    resetInvoiceModal();
    showBillingFeedback(`Invoice created for ${patientName} — $${amount.toFixed(2)}`, "success");
  };

  // Use Escape to close modal
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setShowInvoiceModal(false); resetInvoiceModal(); } };
    if (showInvoiceModal) { window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }
  }, [showInvoiceModal]);

  const feedbackStyle = (type: "success" | "error" | "info") => ({
    padding: "8px 14px",
    borderRadius: "var(--radius)",
    fontSize: "var(--font-sm)",
    fontWeight: 600,
    background: type === "success" ? "var(--green-bg)" : type === "error" ? "var(--red-bg)" : "var(--blue-bg)",
    color: type === "success" ? "var(--green)" : type === "error" ? "var(--red)" : "var(--blue)",
    border: `1px solid ${type === "success" ? "var(--green-border)" : type === "error" ? "var(--red-border)" : "var(--blue-border)"}`,
  });

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ fontSize: "var(--font-xl)", fontWeight: 800, margin: 0 }}>Billing & Insurance</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {billingFeedback && <div style={feedbackStyle(billingFeedback.type)}>{billingFeedback.message}</div>}
          {canViewBillingDetails && (
            <button className="btn btn-ghost" onClick={handleExportInvoices}>
              <i className="ti ti-download" style={{ fontSize: 14, marginRight: 4 }} />Export Invoices
            </button>
          )}
          {canViewBillingDetails && (
            <button className="btn btn-primary" onClick={() => setShowInvoiceModal(true)}>
              <i className="ti ti-plus" style={{ fontSize: 14, marginRight: 4 }} />
              Create Invoice
            </button>
          )}
        </div>
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
                <tr><th>Patient</th><th>Provider</th><th>Expired</th><th>Doctor</th><th>Action</th></tr>
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
                    <td>
                      {p.phone ? (
                        <a href={`tel:${p.phone}`} className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "3px 8px", textDecoration: "none" }}>
                          <i className="ti ti-phone" style={{ fontSize: 11, marginRight: 4 }} />Call
                        </a>
                      ) : (
                        <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "3px 8px", color: "var(--muted)" }}
                          onClick={() => showBillingFeedback(`No phone number on file for ${p.name}.`, "info")}>
                          No phone
                        </button>
                      )}
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
                <div style={{ height: "100%", background: "var(--accent)", borderRadius: 4, width: `${patients.length > 0 ? (count / patients.length) * 100 : 0}%`, transition: "width 0.5s ease" }} />
              </div>
              <span style={{ fontSize: "var(--font-sm)", color: "var(--muted)", width: 40, textAlign: "right" }}>{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Invoice Modal */}
      {showInvoiceModal && (
        <div className="modal-backdrop" onClick={() => { setShowInvoiceModal(false); resetInvoiceModal(); }}>
          <div className="modal" style={{ maxWidth: 500 }} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontWeight: 700, fontSize: "var(--font-md)" }}>Create Invoice</div>
              <button className="btn-icon" onClick={() => { setShowInvoiceModal(false); resetInvoiceModal(); }}><i className="ti ti-x" style={{ fontSize: 16 }} /></button>
            </div>
            <div style={{ padding: 20 }}>
              {invoiceModalError && (
                <div style={{ marginBottom: 12, padding: "8px 12px", background: "var(--red-bg)", color: "var(--red)", border: "1px solid var(--red-border)", borderRadius: "var(--radius)", fontSize: "var(--font-sm)" }}>
                  <i className="ti ti-alert-circle" style={{ marginRight: 6 }} />{invoiceModalError}
                </div>
              )}
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Patient *</label>
                <PatientSelect
                  patients={patients}
                  value={selectedPatientForInvoice?.id || ""}
                  onChange={(p) => { setSelectedPatientForInvoice(p); setInvoiceModalError(""); }}
                />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Amount ($) *</label>
                <input
                  type="number"
                  value={invoiceAmount}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setInvoiceAmount(e.target.value); setInvoiceModalError(""); }}
                  placeholder="0.00"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
                />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Description *</label>
                <textarea
                  value={invoiceDescription}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => { setInvoiceDescription(e.target.value); setInvoiceModalError(""); }}
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
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInvoiceDueDate(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
                />
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn btn-ghost" onClick={() => { setShowInvoiceModal(false); resetInvoiceModal(); }}>Cancel</button>
                <button className="btn btn-primary" onClick={handleCreateInvoice} disabled={!canViewBillingDetails || !selectedPatientForInvoice || !invoiceAmount || !invoiceDescription}>Create Invoice</button>
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
        const pct = patients.length > 0 ? Math.round((count / patients.length) * 100) : 0;
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
type UserRole = "receptionist" | "doctor" | "admin";

interface RolePermissionRow {
  permission: string;
  receptionist: boolean;
  doctor: boolean;
  admin: boolean;
}

const ROLE_PERMISSIONS: RolePermissionRow[] = [
  { permission: "View Medical Info",   receptionist: false, doctor: true,  admin: true },
  { permission: "View Billing",        receptionist: true,  doctor: false, admin: true },
  { permission: "Edit Patient",        receptionist: true,  doctor: true,  admin: true },
  { permission: "Delete Document",     receptionist: false, doctor: false, admin: true },
  { permission: "Edit Medical Alerts", receptionist: false, doctor: true,  admin: true },
  { permission: "View Audit Log",      receptionist: false, doctor: false, admin: true },
  { permission: "Delete Patient",      receptionist: false, doctor: false, admin: true },
];

export function SettingsPage({
  dark, setDark, role, setRole,
}: {
  dark: boolean;
  setDark: (d: boolean) => void;
  role: UserRole;
  setRole: (r: UserRole) => void;
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
          <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} style={{ fontSize: "var(--font-sm)" }}>
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
              {ROLE_PERMISSIONS.map(({ permission, receptionist, doctor, admin }) => (
                <tr key={permission}>
                  <td style={{ fontSize: "var(--font-sm)" }}>{permission}</td>
                  <td><PermDot on={receptionist} /></td>
                  <td><PermDot on={doctor} /></td>
                  <td><PermDot on={admin} /></td>
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

function PatientSelect({ patients, value, onChange }: { patients: Patient[]; value: string; onChange: (patient: Patient | null) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(patients.find(p => p.id === e.target.value) || null)}
      style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
    >
      <option value="">Select patient...</option>
      {patients.map(p => (
        <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
      ))}
    </select>
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
