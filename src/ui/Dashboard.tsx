import React, { useState, useMemo, useCallback, useEffect } from "react";
import type { Patient } from "./types";
import { fmtDate, getPatientStats } from "./utils";
import { hasRole, normalizeRole } from "../shared/permissions/permissions";
import { logDeniedAction } from "../shared/services/deniedActionLogger";

type QueueStatus = "scheduled" | "checked-in" | "waiting" | "with-doctor" | "billing-pending" | "completed" | "no-show" | "cancelled";

// Valid one-step forward transitions
const NEXT_STATUS: Record<QueueStatus, QueueStatus | null> = {
  "scheduled":       "checked-in",
  "checked-in":      "with-doctor",
  "waiting":         "with-doctor",
  "with-doctor":     "billing-pending",
  "billing-pending": "completed",
  "completed":       null,
  "no-show":         "scheduled",
  "cancelled":       null,
};

interface QueuePatient {
  id: string;
  tokenNo: number;
  patient: Patient;
  appointmentTime: string;
  doctor: string;
  visitType: string;
  status: QueueStatus;
  waitingTime: number;
}

interface CriticalAlert {
  id: string;
  patient: Patient;
  type: "high-risk" | "allergy" | "pregnancy" | "heart-condition" | "critical-lab" | "expired-insurance" | "missing-consent" | "overdue-followup";
  message: string;
  severity: "critical" | "high" | "medium";
}

interface FollowUp {
  id: string;
  patient: Patient;
  reason: string;
  dueDate: string;
  priority: "urgent" | "high" | "medium" | "low";
  assignedStaff: string;
  lastContacted: string;
  status: "pending" | "in-progress" | "completed";
}

interface Activity {
  id: string;
  type: "patient-registered" | "appointment-booked" | "invoice-paid" | "prescription-issued" | "lab-uploaded" | "consent-signed" | "patient-edited" | "file-deleted";
  message: string;
  timestamp: string;
  user: string;
}

type TaskPriority = "urgent" | "high" | "medium" | "low";
type TaskStatus = "pending" | "in-progress" | "done";
type TaskCategory = "call-patient" | "upload-lab" | "verify-insurance" | "collect-consent" | "send-prescription" | "prepare-report" | "pending-note" | "payment-pending" | "other";

// Module-level constants for metadata
const ALERT_META: Record<CriticalAlert["type"], { icon: string; label: string; bg: string; border: string; color: string }> = {
  "high-risk":         { icon: "ti-alert-octagon", label: "High Risk",       bg: "var(--red-bg)",    border: "var(--red-border)",    color: "var(--red)" },
  "allergy":           { icon: "ti-droplet-off",   label: "Allergy",         bg: "var(--red-bg)",    border: "var(--red-border)",    color: "var(--red)" },
  "pregnancy":         { icon: "ti-heart",         label: "Pregnancy",       bg: "var(--purple-bg)", border: "var(--purple-border)", color: "var(--purple)" },
  "heart-condition":   { icon: "ti-heart-broken",  label: "Cardiac",         bg: "var(--red-bg)",    border: "var(--red-border)",    color: "var(--red)" },
  "critical-lab":      { icon: "ti-test-pipe",     label: "Critical Lab",    bg: "var(--red-bg)",    border: "var(--red-border)",    color: "var(--red)" },
  "expired-insurance": { icon: "ti-shield-off",    label: "Ins. Expired",    bg: "var(--amber-bg)",  border: "var(--amber-border)",  color: "var(--amber)" },
  "missing-consent":   { icon: "ti-file-x",        label: "No Consent",      bg: "var(--red-bg)",    border: "var(--red-border)",    color: "var(--red)" },
  "overdue-followup":  { icon: "ti-clock-exclamation", label: "Overdue F/U", bg: "var(--amber-bg)",  border: "var(--amber-border)",  color: "var(--amber)" },
};

const ACTIVITY_META: Record<Activity["type"], { icon: string; color: string }> = {
  "patient-registered": { icon: "ti-user-plus",      color: "var(--blue)" },
  "appointment-booked": { icon: "ti-calendar-plus",  color: "var(--purple)" },
  "invoice-paid":       { icon: "ti-cash",           color: "var(--green)" },
  "prescription-issued":{ icon: "ti-pill",           color: "var(--blue)" },
  "lab-uploaded":       { icon: "ti-test-tube",      color: "var(--amber)" },
  "consent-signed":     { icon: "ti-file-check",     color: "var(--green)" },
  "patient-edited":     { icon: "ti-pencil",         color: "var(--muted)" },
  "file-deleted":       { icon: "ti-trash",          color: "var(--red)" },
};

const CATEGORY_META: Record<TaskCategory, { icon: string; label: string }> = {
  "call-patient":       { icon: "ti-phone",          label: "Call Patient" },
  "upload-lab":         { icon: "ti-test-tube",      label: "Upload Lab Result" },
  "verify-insurance":   { icon: "ti-shield-check",   label: "Verify Insurance" },
  "collect-consent":    { icon: "ti-file-check",     label: "Collect Consent" },
  "send-prescription":  { icon: "ti-pill",           label: "Send Prescription" },
  "prepare-report":     { icon: "ti-report",         label: "Prepare Report" },
  "pending-note":       { icon: "ti-notes",          label: "Pending Note" },
  "payment-pending":    { icon: "ti-currency-dollar",label: "Payment Pending" },
  "other":              { icon: "ti-checklist",      label: "Task" },
};

const PRIORITY_COLOR: Record<TaskPriority, string> = {
  urgent: "var(--red)", high: "var(--amber)", medium: "var(--blue)", low: "var(--muted)",
};

const STATUS_COLOR: Record<TaskStatus, string> = {
  pending: "var(--amber)", "in-progress": "var(--blue)", done: "var(--green)",
};

const FORWARD_LABEL: Partial<Record<QueueStatus, string>> = {
  "scheduled":       "Check In",
  "checked-in":      "Start Consult",
  "waiting":         "Start Consult",
  "with-doctor":     "Send to Billing",
  "billing-pending": "Mark Paid & Done",
  "no-show":         "Reschedule",
};

interface ClinicTask {
  id: string;
  category: TaskCategory;
  title: string;
  priority: TaskPriority;
  assignedTo: string;
  dueTime: string;
  status: TaskStatus;
  patientId?: string;
  patientName?: string;
  recurring?: boolean;
}
export default function Dashboard({ patients, userRole = "admin", onAction, onUpdatePatient }: { patients: Patient[]; userRole?: "receptionist" | "doctor" | "admin"; onAction?: (actionId: string) => void; onUpdatePatient?: (updated: Patient, action?: string) => void }) {
  // Normalize role to ensure it's a valid UserRole
  const normalizedRole = normalizeRole(userRole) as "admin" | "doctor" | "nurse" | "receptionist" | "billing" | "auditor" | "readonly";

  const stats = getPatientStats(patients);
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  // ─── Local Permission Guards (Phase 6H) ─────────────────────────────────────────────
  const canViewDashboardQueue = hasRole(normalizedRole, ["admin", "doctor", "nurse", "receptionist"]);
  const canViewPatientContact = hasRole(normalizedRole, ["admin", "doctor", "nurse", "receptionist"]);
  const canOpenPatientProfile = hasRole(normalizedRole, ["admin", "doctor", "nurse", "receptionist"]);
  const canViewCriticalAlerts = hasRole(normalizedRole, ["admin", "doctor", "nurse"]);
  const canViewPatientSafetyReview = hasRole(normalizedRole, ["admin", "doctor", "nurse"]);
  const canViewBillingSnapshot = hasRole(normalizedRole, ["admin"]);
  const canManageQueueFromDashboard = hasRole(normalizedRole, ["admin", "doctor", "nurse", "receptionist"]);

  // Quick action permissions
  const canRunQuickAction = (actionId: string): boolean => {
    const actionPermissions: Record<string, string[]> = {
      "add-patient": ["admin", "doctor", "nurse", "receptionist"],
      "book-appointment": ["admin", "doctor", "nurse", "receptionist"],
      "check-in": ["admin", "doctor", "nurse", "receptionist"],
      "create-invoice": ["admin", "billing", "receptionist"],
      "start-consult": ["admin", "doctor"],
      "create-rx": ["admin", "doctor"],
      "view-labs": ["admin", "doctor", "nurse"],
      "upload-doc": ["admin", "doctor", "nurse"],
      "send-message": ["admin", "doctor", "nurse", "receptionist"],
      "view-reports": ["admin", "auditor", "doctor"],
    };
    return hasRole(normalizedRole, actionPermissions[actionId] || []);
  };

  // ─── Local Denied Helper (Phase 6H) ───────────────────────────────────────────────
  const handleDeniedAccess = (action: string, resource: string) => {
    showFeedback(`You do not have permission to ${action} ${resource}.`, "error");
    logDeniedAction({
      role: normalizedRole,
      action,
      resource,
      reason: "Insufficient permissions",
      severity: "medium",
    });
  };

  // Tick every 60 s so waiting times stay current
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // Date context selector — must be declared BEFORE baseQueue which reads selectedDateStr
  type DateRange = "today" | "tomorrow" | "week" | "custom";
  const [dateRange, setDateRange] = useState<DateRange>("today");
  const [customDate, setCustomDate] = useState(todayStr);
  const selectedDateStr = useMemo(() => {
    if (dateRange === "tomorrow") { const d = new Date(today); d.setDate(d.getDate() + 1); return d.toISOString().split("T")[0]; }
    if (dateRange === "custom") return customDate;
    return todayStr;
  }, [dateRange, customDate, todayStr]);

  // Base queue derived from patients prop — recognizes every status in QUEUE_TO_PATIENT_STATUS
  // so a persisted status always round-trips correctly, even if local statusOverrides resets (e.g. on reload)
  const baseQueue = useMemo(() => {
    const todayAppointments = patients.filter(p => {
      if (!p.nextAppointment) return false;
      const apptDate = new Date(p.nextAppointment).toISOString().split("T")[0];
      if (dateRange === "week") {
        const weekEnd = new Date(today); weekEnd.setDate(weekEnd.getDate() + 6);
        return apptDate >= todayStr && apptDate <= weekEnd.toISOString().split("T")[0];
      }
      return apptDate === selectedDateStr;
    });
    const PATIENT_STATUS_TO_QUEUE: Record<string, QueueStatus> = {
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
      let status: QueueStatus = PATIENT_STATUS_TO_QUEUE[p.status ?? ""] ?? "scheduled";
      // Only auto-escalate to "waiting" if the patient hasn't reached a later stage in the workflow
      if (status === "scheduled" && waitingTime > 15) status = "waiting";
      return {
        id: p.id,
        tokenNo: index + 1,
        patient: p,
        appointmentTime: appointmentTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
        doctor: p.doctor || "Unassigned",
        visitType: "Consultation",
        status,
        waitingTime: Math.max(0, waitingTime),
      } as QueuePatient;
    });
  }, [selectedDateStr, dateRange, todayStr, patients]);

  // Live queue: status overrides live here, waiting times refresh on tick
  const [statusOverrides, setStatusOverrides] = useState<Record<string, QueueStatus>>({});

  // Consultation timing — captures when a patient enters/exits "with-doctor" so we can compute average consult time per doctor
  const [consultTimes, setConsultTimes] = useState<Record<string, { startedAt?: number; endedAt?: number; doctor: string }>>({});

  // Queue status filter and prioritized — must be before queuePatients useMemo
  const [queueStatusFilter, setQueueStatusFilter] = useState<QueueStatus | "">("");
  const [prioritized, setPrioritized] = useState<string[]>([]);

  // Dashboard filters — must be before queuePatients useMemo (filterDoctor is read inside it)
  const [filterDoctor, setFilterDoctor] = useState<string>("");

  const queuePatients: QueuePatient[] = useMemo(() => {
    let list = baseQueue.map(q => {
      const appointmentTime = new Date(q.patient.nextAppointment!);
      const waitingTime = Math.max(0, Math.floor((Date.now() - appointmentTime.getTime()) / (1000 * 60)));
      return { ...q, waitingTime, status: statusOverrides[q.id] ?? q.status };
    });
    // Apply status filter
    if (queueStatusFilter) list = list.filter(q => q.status === queueStatusFilter);
    // Apply doctor filter
    if (filterDoctor) list = list.filter(q => q.doctor === filterDoctor);
    // Prioritized patients bubble to top
    if (prioritized.length > 0) {
      list = [...list.filter(q => prioritized.includes(q.id)), ...list.filter(q => !prioritized.includes(q.id))];
    }
    return list;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseQueue, statusOverrides, queueStatusFilter, filterDoctor, prioritized, tick]);

  // Maps internal queue status to the Patient.status string used app-wide (must match Queue.tsx exactly,
  // so the same patient shows the same status whether viewed from Dashboard, Queue, or the Patient profile)
  const QUEUE_TO_PATIENT_STATUS: Record<QueueStatus, string> = {
    "scheduled":        "Scheduled",
    "checked-in":       "Checked In",
    "waiting":          "Waiting",
    "with-doctor":      "In Progress",
    "billing-pending":  "Billing Pending",
    "completed":        "Completed",
    "no-show":          "No Show",
    "cancelled":        "Cancelled",
  };

  const persistStatus = useCallback((id: string, next: QueueStatus) => {
    const patient = patients.find(p => p.id === id);
    if (!patient) return;
    onUpdatePatient?.({ ...patient, status: QUEUE_TO_PATIENT_STATUS[next] }, `moved to ${QUEUE_TO_PATIENT_STATUS[next]}`);
  }, [patients, onUpdatePatient]);

  const transitionStatus = useCallback((id: string, next: QueueStatus, doctor: string) => {
    // Optimistic local update so the UI reflects the change instantly even before the patients prop re-renders
    setStatusOverrides(prev => ({ ...prev, [id]: next }));
    persistStatus(id, next);
    const patient = patients.find(p => p.id === id);
    logActivity({ type: "patient-edited", message: `${patient?.name ?? id} → ${QUEUE_TO_PATIENT_STATUS[next]}`, user: userRole });
    showFeedback(`${patient?.name ?? "Patient"} moved to ${QUEUE_TO_PATIENT_STATUS[next]}.`, "success");
    setConsultTimes(prev => {
      const existing = prev[id];
      if (next === "with-doctor") {
        return { ...prev, [id]: { ...existing, doctor, startedAt: Date.now() } };
      }
      if (existing?.startedAt && !existing.endedAt && (next === "billing-pending" || next === "completed")) {
        return { ...prev, [id]: { ...existing, endedAt: Date.now() } };
      }
      return prev;
    });
  }, [persistStatus, patients, userRole]);

  const markNoShow = useCallback((id: string) => {
    setStatusOverrides(prev => ({ ...prev, [id]: "no-show" }));
    persistStatus(id, "no-show");
    const patient = patients.find(p => p.id === id);
    logActivity({ type: "patient-edited", message: `${patient?.name ?? id} marked No Show`, user: userRole });
    showFeedback(`${patient?.name ?? "Patient"} marked as no-show.`, "info");
  }, [persistStatus, patients, userRole]);

  const markCancelled = useCallback((id: string) => {
    setStatusOverrides(prev => ({ ...prev, [id]: "cancelled" }));
    persistStatus(id, "cancelled");
    const patient = patients.find(p => p.id === id);
    logActivity({ type: "patient-edited", message: `${patient?.name ?? id} cancelled`, user: userRole });
    showFeedback(`${patient?.name ?? "Patient"} appointment cancelled.`, "info");
  }, [persistStatus, patients, userRole]);

  // Queue status breakdown (unfiltered)
  const queueBreakdown = useMemo(() => {
    const all = baseQueue.map(q => ({ ...q, status: statusOverrides[q.id] ?? q.status }));
    const counts: Partial<Record<QueueStatus, number>> = {};
    for (const q of all) counts[q.status] = (counts[q.status] ?? 0) + 1;
    return counts;
  }, [baseQueue, statusOverrides]);

  // Critical alerts — all 8 types
  const criticalAlerts = useMemo(() => {
    const alerts: CriticalAlert[] = [];
    const now = new Date();
    patients.forEach(p => {
      // 1. High-risk / custom critical alerts from patient record
      if (p.alerts) {
        p.alerts.forEach((a: any) => {
          if (a.severity === "critical" || a.type === "high-risk") {
            alerts.push({ id: `${p.id}-alert-${a.id}`, patient: p, type: "high-risk", message: a.message, severity: "critical" });
          }
        });
      }
      // 2. Allergy alert
      const allergiesArr = Array.isArray(p.allergies) ? p.allergies : p.allergies ? [p.allergies] : [];
      if (allergiesArr.length > 0) {
        alerts.push({ id: `${p.id}-allergy`, patient: p, type: "allergy", message: `Known allergies: ${allergiesArr.join(", ")}`, severity: "high" });
      }
      // 3. Pregnancy
      if (p.isPregnant || p.medicalConditions?.includes?.("Pregnant") || p.tags?.includes?.("pregnant")) {
        alerts.push({ id: `${p.id}-pregnancy`, patient: p, type: "pregnancy", message: "Patient is pregnant — verify medication safety", severity: "high" });
      }
      // 4. Heart condition
      if (p.medicalConditions?.some?.((c: string) => /heart|cardiac|arrhythmia|angina|hypertension/i.test(c)) || p.tags?.includes?.("heart-condition")) {
        alerts.push({ id: `${p.id}-heart`, patient: p, type: "heart-condition", message: `Cardiac condition: ${p.medicalConditions?.find?.((c: string) => /heart|cardiac|arrhythmia|angina|hypertension/i.test(c)) ?? "on file"}`, severity: "critical" });
      }
      // 5. Critical lab result
      if (p.labResults?.some?.((l: any) => l.flagged || l.status === "critical")) {
        const lab = p.labResults.find((l: any) => l.flagged || l.status === "critical");
        alerts.push({ id: `${p.id}-lab`, patient: p, type: "critical-lab", message: `Critical lab: ${lab?.name ?? "result"} requires review`, severity: "critical" });
      }
      // 6. Expired insurance
      if (p.insuranceStatus === "Expired" || (p.insuranceExpiry && new Date(p.insuranceExpiry) < now)) {
        alerts.push({ id: `${p.id}-insurance`, patient: p, type: "expired-insurance", message: `Insurance expired${p.insuranceExpiry ? ` on ${fmtDate(p.insuranceExpiry)}` : ""}`, severity: "high" });
      }
      // 7. Missing consent before treatment (today's queue only)
      const inTodayQueue = patients.some(tp => tp.id === p.id && tp.nextAppointment && new Date(tp.nextAppointment).toISOString().split("T")[0] === todayStr);
      if (inTodayQueue && p.consentStatus === "missing") {
        alerts.push({ id: `${p.id}-consent`, patient: p, type: "missing-consent", message: "Consent form not signed — required before treatment", severity: "critical" });
      }
      // 8. Overdue follow-up
      if (p.followUpDate && new Date(p.followUpDate) < now && p.status !== "Completed") {
        const daysOverdue = Math.floor((now.getTime() - new Date(p.followUpDate).getTime()) / (1000 * 60 * 60 * 24));
        if (daysOverdue >= 3) {
          alerts.push({ id: `${p.id}-followup`, patient: p, type: "overdue-followup", message: `Follow-up overdue by ${daysOverdue} day${daysOverdue !== 1 ? "s" : ""}`, severity: daysOverdue >= 7 ? "critical" : "high" });
        }
      }
    });
    // Sort: critical first, then high, then medium
    const order = { critical: 0, high: 1, medium: 2 };
    return alerts.sort((a, b) => order[a.severity] - order[b.severity]);
  }, [patients, todayStr]);

  // Follow-ups — live status overrides
  const [followUpOverrides, setFollowUpOverrides] = useState<Record<string, { status: FollowUp["status"]; lastContacted?: string }>>({});

  const followUps = useMemo(() => {
    const now = new Date();
    const pending = patients.filter(p =>
      p.status === "Follow-Up Due" ||
      (p.followUpDate && new Date(p.followUpDate) < now)
    );
    return pending.map(p => {
      const override = followUpOverrides[p.id];
      const daysOverdue = p.followUpDate ? Math.floor((now.getTime() - new Date(p.followUpDate).getTime()) / (1000 * 60 * 60 * 24)) : 0;
      const priority: FollowUp["priority"] = daysOverdue >= 7 ? "urgent" : daysOverdue >= 3 ? "high" : daysOverdue >= 1 ? "medium" : "low";
      return {
        id: p.id,
        patient: p,
        reason: p.followUpReason || "Post-visit follow-up required",
        dueDate: p.followUpDate || "",
        priority,
        assignedStaff: p.doctor || "Unassigned",
        lastContacted: override?.lastContacted ?? (p.lastContacted ? fmtDate(p.lastContacted) : "Never"),
        status: override?.status ?? ("pending" as FollowUp["status"]),
      };
    }).sort((a, b) => {
      const o = { urgent: 0, high: 1, medium: 2, low: 3 };
      return o[a.priority] - o[b.priority];
    });
  }, [patients, followUpOverrides]);

  const updateFollowUp = useCallback((id: string, status: FollowUp["status"], lastContacted?: string) => {
    setFollowUpOverrides(prev => ({ ...prev, [id]: { status, lastContacted: lastContacted ?? prev[id]?.lastContacted } }));
    const patient = patients.find(p => p.id === id);
    if (!patient) return;
    const patch: Partial<Patient> = { lastContacted: new Date().toISOString() };
    // Completing a follow-up clears the "Follow-Up Due" status so it doesn't reappear as overdue after reload —
    // it does NOT overwrite an active queue status (e.g. "In Progress"), only the dedicated follow-up flag
    if (status === "completed" && patient.status === "Follow-Up Due") {
      patch.status = "Completed";
    }
    onUpdatePatient?.({ ...patient, ...patch }, status === "completed" ? "follow-up completed" : "follow-up contacted");
  }, [patients, onUpdatePatient]);

  // Revenue — full billing snapshot
  const revenue = useMemo(() => {
    const invoices: any[] = JSON.parse(localStorage.getItem("clinic_crm_invoices") || "[]");
    const todayInvoices = invoices.filter((inv: any) => {
      const invDate = new Date(inv.createdAt).toISOString().split("T")[0];
      return invDate === todayStr;
    });
    const sum = (arr: any[], key = "amount") => arr.reduce((s: number, i: any) => s + (i[key] || 0), 0);
    const paid = todayInvoices.filter((i: any) => i.status === "paid");
    const pending = todayInvoices.filter((i: any) => i.status === "pending" || i.status === "unpaid");
    const refunds = todayInvoices.filter((i: any) => i.status === "refunded");
    const insurancePending = todayInvoices.filter((i: any) => i.paymentMethod === "insurance" && i.status !== "paid");
    return {
      total: sum(todayInvoices),
      paid: sum(paid),
      pending: sum(pending),
      unpaid: sum(pending),
      refunds: sum(refunds),
      insurancePending: sum(insurancePending),
      pendingCount: pending.length,
      cash: sum(paid.filter((i: any) => i.paymentMethod === "cash")),
      upi: sum(paid.filter((i: any) => i.paymentMethod === "upi" || i.paymentMethod === "online")),
      card: sum(paid.filter((i: any) => i.paymentMethod === "card")),
    };
  }, [todayStr, tick]);

  // (tasks derived from followUps are managed in the Follow-up Center directly)

  // Recent activity
  const recentActivity = useMemo(() => {
    const activities: Activity[] = [
      { id: "1", type: "patient-registered", message: "New patient registered: John Doe", timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(), user: "Emily Davis" },
      { id: "2", type: "appointment-booked", message: "Appointment booked for Jane Smith", timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(), user: "Emily Davis" },
      { id: "3", type: "invoice-paid", message: "Invoice #INV-001 paid: $150.00", timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(), user: "Emily Davis" },
      { id: "4", type: "prescription-issued", message: "Prescription issued for Bob Wilson", timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(), user: "Dr. Sarah Johnson" },
      { id: "5", type: "lab-uploaded", message: "Lab result uploaded for Alice Brown", timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), user: "Dr. Michael Chen" },
    ];
    return activities;
  }, []);

  // Quick actions — full role-based sets
  const quickActions: { id: string; label: string; icon: string; color?: string }[] = useMemo(() => {
    if (userRole === "receptionist") return [
      { id: "add-patient",      label: "Add Patient",       icon: "ti-user-plus" },
      { id: "book-appointment", label: "Book Appointment",  icon: "ti-calendar-plus" },
      { id: "check-in",         label: "Check In",          icon: "ti-login" },
      { id: "create-invoice",   label: "Create Invoice",    icon: "ti-receipt" },
      { id: "send-message",     label: "Send Message",      icon: "ti-send" },
    ];
    if (userRole === "doctor") return [
      { id: "start-consult",    label: "Start Consultation", icon: "ti-stethoscope" },
      { id: "create-rx",        label: "Prescription",       icon: "ti-pill" },
      { id: "view-labs",        label: "Lab Results",        icon: "ti-test-tube" },
      { id: "add-note",         label: "Add Note",           icon: "ti-notes" },
      { id: "book-appointment", label: "Book Follow-up",     icon: "ti-calendar-plus" },
    ];
    // admin
    return [
      { id: "add-patient",      label: "Add Patient",       icon: "ti-user-plus" },
      { id: "book-appointment", label: "Book Appointment",  icon: "ti-calendar-plus" },
      { id: "create-invoice",   label: "Create Invoice",    icon: "ti-receipt" },
      { id: "upload-doc",       label: "Upload Document",   icon: "ti-upload" },
      { id: "view-reports",     label: "View Reports",      icon: "ti-chart-bar" },
      { id: "send-message",     label: "Send Message",      icon: "ti-send" },
    ];
  }, [userRole]);

  // Tasks — live state seeded from clinic needs
  const seedTasks = useMemo((): ClinicTask[] => {
    const t: ClinicTask[] = [];
    const now = new Date();
    const hhmm = (offsetMin: number) => {
      const d = new Date(now.getTime() + offsetMin * 60_000);
      return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    };
    // Auto-seed from follow-ups
    followUps.filter(f => f.status !== "completed").forEach(f => {
      t.push({
        id: `task-fu-${f.id}`, category: "call-patient",
        title: `Call ${f.patient.name} — ${f.reason}`,
        priority: f.priority === "urgent" ? "urgent" : f.priority === "high" ? "high" : "medium",
        assignedTo: f.assignedStaff, dueTime: f.dueDate ? fmtDate(f.dueDate) : hhmm(60),
        status: f.status === "in-progress" ? "in-progress" : "pending",
        patientId: f.patient.id, patientName: f.patient.name,
      });
    });
    // Auto-seed from patients with missing consent in today's queue
    queuePatients.filter(q => (q.patient as any).consentStatus === "missing").forEach(q => {
      t.push({
        id: `task-consent-${q.id}`, category: "collect-consent",
        title: `Collect consent — ${q.patient.name}`,
        priority: "urgent", assignedTo: "Reception", dueTime: q.appointmentTime,
        status: "pending", patientId: q.patient.id, patientName: q.patient.name,
      });
    });
    // Auto-seed from expired insurance in today's queue
    queuePatients.filter(q => (q.patient as any).insuranceStatus === "Expired").forEach(q => {
      t.push({
        id: `task-ins-${q.id}`, category: "verify-insurance",
        title: `Verify insurance — ${q.patient.name}`,
        priority: "high", assignedTo: "Reception", dueTime: hhmm(30),
        status: "pending", patientId: q.patient.id, patientName: q.patient.name,
      });
    });
    // Hardcoded demo tasks so panel is never empty
    if (t.length < 3) {
      t.push(
        { id: "task-demo-1", category: "upload-lab",        title: "Upload CBC results — John Doe",    priority: "high",   assignedTo: "Lab Tech",    dueTime: hhmm(45),  status: "pending" },
        { id: "task-demo-2", category: "payment-pending",   title: "Collect payment — Jane Smith",     priority: "medium", assignedTo: "Reception",   dueTime: hhmm(120), status: "pending" },
        { id: "task-demo-3", category: "pending-note",      title: "Complete consultation note",       priority: "high",   assignedTo: "Dr. Johnson", dueTime: hhmm(240), status: "in-progress" },
        { id: "task-demo-4", category: "send-prescription", title: "Send e-Rx — Bob Wilson",           priority: "urgent", assignedTo: "Dr. Chen",    dueTime: hhmm(15),  status: "pending" },
        { id: "task-demo-5", category: "prepare-report",    title: "Prepare discharge summary",        priority: "low",    assignedTo: "Dr. Johnson", dueTime: hhmm(480), status: "pending" },
      );
    }
    const prioOrder: Record<TaskPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
    return t.sort((a, b) => prioOrder[a.priority] - prioOrder[b.priority]);
  }, [followUps, queuePatients]);

  // Feedback system
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const showFeedback = useCallback((message: string, type: "success" | "error" | "info" = "info") => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  }, []);

  // Dashboard filters
  const allDoctors = useMemo(() => [...new Set(patients.map(p => p.doctor).filter(Boolean))], [patients]);
  const clearFilters = () => { setFilterDoctor(""); };
  const hasFilters = !!filterDoctor;

  // Acknowledged alerts (session)
  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState<Set<string>>(new Set());
  const acknowledgeAlert = useCallback((alertId: string, patient: Patient) => {
    setAcknowledgedAlerts(prev => new Set([...prev, alertId]));
    onUpdatePatient?.({ ...patient, alertsReviewed: true } as Patient, "alert acknowledged");
    logActivity({ type: "patient-edited", message: `Alert acknowledged for ${patient.name}`, user: userRole });
    showFeedback(`Alert acknowledged for ${patient.name}`, "success");
  }, [onUpdatePatient, userRole]);

  // Activity log (localStorage)
  const ACTIVITY_KEY = "clinic_crm_dashboard_activity";
  const [activityLog, setActivityLog] = useState<Activity[]>(() => {
    try { return JSON.parse(localStorage.getItem(ACTIVITY_KEY) || "[]"); } catch { return []; }
  });
  const logActivity = useCallback((entry: Omit<Activity, "id" | "timestamp">) => {
    const newEntry: Activity = { ...entry, id: `act-${Date.now()}`, timestamp: new Date().toISOString() };
    setActivityLog(prev => {
      const updated = [newEntry, ...prev].slice(0, 50);
      try { localStorage.setItem(ACTIVITY_KEY, JSON.stringify(updated)); } catch { /* ignore */ }
      return updated;
    });
  }, []);
  const [showClearActivity, setShowClearActivity] = useState(false);

  const prioritizePatient = useCallback((id: string, name: string) => {
    setPrioritized(prev => prev.includes(id) ? prev : [id, ...prev]);
    logActivity({ type: "patient-edited", message: `${name} prioritized in queue`, user: userRole });
    showFeedback(`${name} moved to top of queue.`, "info");
  }, [logActivity, showFeedback, userRole]);

  // Tasks — persisted to localStorage
  const TASKS_KEY = "clinic_crm_dashboard_tasks";
  const [savedTasks, setSavedTasks] = useState<ClinicTask[]>(() => {
    try { return JSON.parse(localStorage.getItem(TASKS_KEY) || "[]"); } catch { return []; }
  });
  const persistTasks = useCallback((tasks: ClinicTask[]) => {
    setSavedTasks(tasks);
    try { localStorage.setItem(TASKS_KEY, JSON.stringify(tasks)); } catch { /* ignore */ }
  }, []);

  const [taskOverrides, setTaskOverrides] = useState<Record<string, TaskStatus>>({});
  const tasks: ClinicTask[] = useMemo(() => {
    // Merge seeded tasks with saved user-created tasks, avoiding id collisions
    const seeded = seedTasks.map(t => ({ ...t, status: taskOverrides[t.id] ?? t.status }));
    const userCreated = savedTasks.filter(st => !seeded.find(t => t.id === st.id));
    const combined = [...seeded, ...userCreated];
    const prioOrder: Record<TaskPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
    return combined.sort((a, b) => {
      if (a.status !== b.status) return a.status === "done" ? 1 : b.status === "done" ? -1 : 0;
      return prioOrder[a.priority] - prioOrder[b.priority];
    });
  }, [seedTasks, taskOverrides, savedTasks]);

  const updateTask = useCallback((id: string, status: TaskStatus) => {
    setTaskOverrides(prev => ({ ...prev, [id]: status }));
    // Also update in savedTasks if it's a user task
    setSavedTasks(prev => {
      const idx = prev.findIndex(t => t.id === id);
      if (idx === -1) return prev;
      const updated = prev.map(t => t.id === id ? { ...t, status } : t);
      try { localStorage.setItem(TASKS_KEY, JSON.stringify(updated)); } catch { /* ignore */ }
      return updated;
    });
    // Recurring: if marking done and task is recurring, spawn a copy for tomorrow (feature 7)
    if (status === "done") {
      const allTasks = [...savedTasks, ...seedTasks];
      const task = allTasks.find(t => t.id === id);
      if (task?.recurring) {
        const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split("T")[0];
        const spawn: ClinicTask = { ...task, id: `task-recur-${Date.now()}`, status: "pending", dueTime: tomorrowStr };
        setSavedTasks(prev => {
          const next = [...prev, spawn];
          try { localStorage.setItem(TASKS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
          return next;
        });
      }
    }
    logActivity({ type: "patient-edited", message: `Task marked ${status}`, user: userRole });
    showFeedback(status === "done" ? "Task marked done." : status === "in-progress" ? "Task started." : "Task reopened.", "success");
  }, [logActivity, userRole, savedTasks, seedTasks]);

  const deleteTask = useCallback((id: string) => {
    setSavedTasks(prev => {
      const updated = prev.filter(t => t.id !== id);
      try { localStorage.setItem(TASKS_KEY, JSON.stringify(updated)); } catch { /* ignore */ }
      return updated;
    });
    setTaskOverrides(prev => { const n = {...prev}; delete n[id]; return n; });
    logActivity({ type: "file-deleted", message: "Task deleted", user: userRole });
    showFeedback("Task deleted.", "info");
  }, [logActivity, userRole]);

  const addTask = useCallback((task: ClinicTask) => {
    const updated = [...savedTasks, task];
    persistTasks(updated);
    logActivity({ type: "patient-edited", message: `Task added: ${task.title}`, user: userRole });
    showFeedback("Task added.", "success");
  }, [savedTasks, persistTasks, logActivity, userRole]);

  // Reschedule follow-up modal
  const [rescheduleModal, setRescheduleModal] = useState<{ patientId: string; patientName: string } | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [reschedulePriority, setReschedulePriority] = useState<"urgent"|"high"|"medium"|"low">("medium");
  const [rescheduleStaff, setRescheduleStaff] = useState("");
  const [rescheduleNotes, setRescheduleNotes] = useState("");

  // Bulk follow-up selection
  const [selectedFollowUps, setSelectedFollowUps] = useState<Set<string>>(new Set());
  const [bulkRescheduleDate, setBulkRescheduleDate] = useState("");
  const [showBulkReschedule, setShowBulkReschedule] = useState(false);

  // Edit task modal
  const [editTaskModal, setEditTaskModal] = useState<ClinicTask | null>(null);

  // Safety review dismissed
  const [dismissedSafety, setDismissedSafety] = useState<Set<string>>(new Set());

  // Clear completed confirm
  const [showClearCompleted, setShowClearCompleted] = useState(false);

  // Activity CSV confirm typed
  const [clearActivityConfirmText, setClearActivityConfirmText] = useState("");

  // Confirm delete modal
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; label: string } | null>(null);

  // Add Task modal
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTask, setNewTask] = useState<Omit<ClinicTask, "id" | "status">>({ title: "", priority: "medium", category: "other", assignedTo: "", dueTime: todayStr });

  // Patient lookup
  const [patientSearch, setPatientSearch] = useState("");
  const patientSearchResults = useMemo(() => {
    const q = patientSearch.trim().toLowerCase();
    if (!q || q.length < 2) return [];
    return patients.filter(p =>
      p.name?.toLowerCase().includes(q) ||
      p.id?.toLowerCase().includes(q) ||
      p.phone?.includes(q)
    ).slice(0, 5);
  }, [patientSearch, patients]);

  // Clinic day checklist
  const CHECKLIST_KEY = "clinic_crm_dashboard_checklist";
  type ChecklistItem = { id: string; label: string; done: boolean; custom?: boolean };
  const DEFAULT_CHECKLIST: ChecklistItem[] = [
    { id: "cl-1", label: "Confirm today appointments", done: false },
    { id: "cl-2", label: "Review critical alerts", done: false },
    { id: "cl-3", label: "Check pending lab results", done: false },
    { id: "cl-4", label: "Review billing pending", done: false },
    { id: "cl-5", label: "Call overdue follow-ups", done: false },
    { id: "cl-6", label: "Backup/export end-of-day summary", done: false },
  ];
  const [checklist, setChecklist] = useState<ChecklistItem[]>(() => {
    try { return JSON.parse(localStorage.getItem(CHECKLIST_KEY) || "null") ?? DEFAULT_CHECKLIST; } catch { return DEFAULT_CHECKLIST; }
  });
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const saveChecklist = (items: ChecklistItem[]) => {
    setChecklist(items);
    try { localStorage.setItem(CHECKLIST_KEY, JSON.stringify(items)); } catch { /* ignore */ }
  };

  // Activity feed filter
  const [activityFilter, setActivityFilter] = useState<"all" | "queue" | "followup" | "task" | "alert" | "export">("all");

  // Collapsible sections — persisted to localStorage
  const SECTIONS_KEY = "clinic_crm_dashboard_sections";
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem(SECTIONS_KEY) || "{}"); } catch { return {}; }
  });
  const toggleSection = (key: string) => {
    setCollapsed(prev => {
      const next = { ...prev, [key]: !prev[key] };
      try { localStorage.setItem(SECTIONS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  // Task panel filter
  const [taskFilter, setTaskFilter] = useState<"all" | "pending" | "in-progress" | "done" | "urgent">("all");

  // Notification dot — fires when there are unacknowledged critical alerts or 60min+ waiters
  const longWaiters = useMemo(() => queuePatients.filter(q => !["completed","cancelled","no-show"].includes(q.status) && q.waitingTime >= 60).length, [queuePatients]);
  const unackedCritical = useMemo(() => criticalAlerts.filter(a => !acknowledgedAlerts.has(a.id) && a.severity === "critical").length, [criticalAlerts, acknowledgedAlerts]);
  const notificationCount = unackedCritical + longWaiters;
  useEffect(() => {
    const base = userRole === "receptionist" ? "Receptionist Dashboard" : userRole === "doctor" ? "Doctor Dashboard" : "Admin Dashboard";
    document.title = notificationCount > 0 ? `(${notificationCount}) ${base}` : base;
    return () => { document.title = base; };
  }, [notificationCount, userRole]);

  // Escape closes modals
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape" || (e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "TEXTAREA") return;
      if (showAddTask) { setShowAddTask(false); return; }
      if (rescheduleModal) { setRescheduleModal(null); return; }
      if (confirmDelete) { setConfirmDelete(null); return; }
      if (showClearActivity) { setShowClearActivity(false); setClearActivityConfirmText(""); return; }
      if (editTaskModal) { setEditTaskModal(null); return; }
      if (showClearCompleted) { setShowClearCompleted(false); return; }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showAddTask, rescheduleModal, confirmDelete, showClearActivity]);

  // Doctor workload — derived from live queue
  const doctorWorkload = useMemo(() => {
    const map: Record<string, { appts: number; seen: number; waiting: number; inConsult: number; pendingNotes: number; avgConsultMin: number | null }> = {};
    queuePatients.forEach(q => {
      if (!map[q.doctor]) map[q.doctor] = { appts: 0, seen: 0, waiting: 0, inConsult: 0, pendingNotes: 0, avgConsultMin: null };
      map[q.doctor].appts++;
      if (q.status === "completed") map[q.doctor].seen++;
      if (q.status === "waiting" || q.status === "checked-in") map[q.doctor].waiting++;
      if (q.status === "with-doctor") map[q.doctor].inConsult++;
    });
    // Pending notes from tasks
    tasks.filter(t => t.category === "pending-note").forEach(t => {
      const staff = t.assignedTo;
      if (map[staff]) map[staff].pendingNotes++;
    });
    // Average consultation time — only counts consults with both a start and end timestamp
    const durationsByDoctor: Record<string, number[]> = {};
    Object.values(consultTimes).forEach(c => {
      if (c.startedAt && c.endedAt && c.doctor) {
        const minutes = (c.endedAt - c.startedAt) / 60_000;
        if (!durationsByDoctor[c.doctor]) durationsByDoctor[c.doctor] = [];
        durationsByDoctor[c.doctor].push(minutes);
      }
    });
    Object.entries(durationsByDoctor).forEach(([doctor, durations]) => {
      if (map[doctor]) {
        const avg = durations.reduce((sum, d) => sum + d, 0) / durations.length;
        map[doctor].avgConsultMin = Math.round(avg);
      }
    });
    return map;
  }, [queuePatients, tasks, consultTimes]);

  // Print token slip
  const printTokenSlip = useCallback((q: QueuePatient) => {
    const win = window.open("", "_blank", "width=320,height=480");
    if (!win) { showFeedback("Pop-up blocked — allow pop-ups to print token slips.", "error"); return; }
    const clinicName = "Clinic";
    win.document.write(`<!DOCTYPE html><html><head><title>Token #${q.tokenNo}</title><style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:Arial,sans-serif;padding:24px;max-width:280px;margin:0 auto;text-align:center}
      .clinic{font-size:13px;color:#666;margin-bottom:4px}
      .token-label{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#999;margin-bottom:2px}
      .token-num{font-size:72px;font-weight:900;line-height:1;color:#111;margin-bottom:8px}
      .divider{border:none;border-top:1px dashed #ccc;margin:12px 0}
      .row{display:flex;justify-content:space-between;font-size:12px;margin:4px 0}
      .label{color:#888} .value{font-weight:700;color:#111}
      .status{display:inline-block;margin-top:10px;font-size:11px;padding:3px 10px;border-radius:99px;background:#f3f4f6;color:#555;border:1px solid #e5e7eb}
      .footer{margin-top:16px;font-size:10px;color:#aaa}
      @media print{body{padding:8px}}
    </style></head><body>
      <div class="clinic">${clinicName}</div>
      <div class="token-label">Queue Token</div>
      <div class="token-num">#${q.tokenNo}</div>
      <hr class="divider"/>
      <div class="row"><span class="label">Patient</span><span class="value">${q.patient.name}</span></div>
      <div class="row"><span class="label">Doctor</span><span class="value">${q.doctor}</span></div>
      <div class="row"><span class="label">Appt Time</span><span class="value">${q.appointmentTime}</span></div>
      <div class="row"><span class="label">Visit</span><span class="value">${q.visitType}</span></div>
      <hr class="divider"/>
      <span class="status">${q.status.replace(/-/g," ").replace(/\b\w/g,l=>l.toUpperCase())}</span>
      <div class="footer">Printed ${new Date().toLocaleTimeString()}</div>
      <script>window.onload=()=>{window.print();window.close()}<\/script>
    </body></html>`);
    win.document.close();
    logActivity({ type: "patient-edited", message: `Token slip printed for ${q.patient.name} (#${q.tokenNo})`, user: userRole });
  }, [logActivity, userRole, showFeedback]);
  const { waiting, checkedIn, inConsultation, completed, noShows, followUpsDone } = useMemo(() => ({
    waiting: queuePatients.filter(q => q.status === "waiting").length,
    checkedIn: queuePatients.filter(q => q.status === "checked-in").length,
    inConsultation: queuePatients.filter(q => q.status === "with-doctor").length,
    completed: queuePatients.filter(q => q.status === "completed").length,
    noShows: queuePatients.filter(q => q.status === "no-show").length,
    followUpsDone: followUps.filter(f => f.status === "completed").length,
  }), [queuePatients, followUps]);

  // Appointment snapshot
  const apptSnapshot = useMemo(() => {
    const now = new Date();
    const upcoming = queuePatients
      .filter(q => q.status === "scheduled" || q.status === "checked-in")
      .slice(0, 5);
    const delayed = queuePatients.filter(q =>
      (q.status === "waiting" || q.status === "checked-in") && q.waitingTime > 20
    );
    const cancelledNoShow = queuePatients.filter(q => q.status === "no-show" || q.status === "cancelled");
    // Doctor schedule: unique doctors with their queue
    const doctorMap: Record<string, QueuePatient[]> = {};
    queuePatients.forEach(q => {
      if (!doctorMap[q.doctor]) doctorMap[q.doctor] = [];
      doctorMap[q.doctor].push(q);
    });
    return { upcoming, delayed, cancelledNoShow, doctorMap };
  }, [queuePatients]);

  return (
    <div className="clinic-dashboard" style={{ padding: 24, width: "100%", boxSizing: "border-box" }}>
      <style>{`
        .clinic-dashboard { --bp-tablet: 1024px; --bp-mobile: 640px; }
        .cd-grid-5  { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 16px; }
        .cd-grid-4  { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 16px; }
        .cd-grid-2-1 { display: grid; grid-template-columns: 2fr 1fr; gap: 16px; margin-bottom: 16px; }
        .cd-grid-1-2 { display: grid; grid-template-columns: 1fr 2fr; gap: 16px; margin-bottom: 16px; }
        /* Doctor layout: alerts/follow-ups column (first child) is narrow-left, queue (second child) is wide-right */
        .cd-grid-1-2 > *:first-child { order: 2; }
        .cd-grid-1-2 > *:last-child  { order: 1; }
        .cd-grid-snapshot4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        .cd-grid-2-1-1 { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 16px; margin-bottom: 16px; }
        .cd-grid-4-sm { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px; }
        .cd-grid-2-sm { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
        .cd-grid-4-stat { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; margin-bottom: 5px; }
        .cd-header-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; gap: 12px; flex-wrap: wrap; }
        .cd-tasks-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
        .cd-quick-actions { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
        .cd-quick-actions .btn { white-space: nowrap; }

        @media (max-width: 1024px) {
          .cd-grid-5  { grid-template-columns: repeat(3, 1fr); }
          .cd-grid-4  { grid-template-columns: repeat(2, 1fr); }
          .cd-grid-2-1 { grid-template-columns: 1fr; }
          .cd-grid-1-2 { grid-template-columns: 1fr; }
          .cd-grid-1-2 > *:first-child { order: unset; }
          .cd-grid-1-2 > *:last-child  { order: unset; }
          .cd-grid-snapshot4 { grid-template-columns: repeat(2, 1fr); }
          .cd-grid-2-1-1 { grid-template-columns: 1fr 1fr; }
          .cd-grid-4-sm { grid-template-columns: repeat(2, 1fr); }
          .cd-grid-4-stat { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 640px) {
          .clinic-dashboard { padding: 12px !important; }
          .cd-grid-5  { grid-template-columns: repeat(2, 1fr); gap: 6px; }
          .cd-grid-4  { grid-template-columns: repeat(2, 1fr); gap: 6px; }
          .cd-grid-snapshot4 { grid-template-columns: 1fr; }
          .cd-grid-4-sm { grid-template-columns: 1fr 1fr; }
          .cd-grid-2-sm { grid-template-columns: 1fr; }
          .cd-grid-4-stat { grid-template-columns: repeat(2, 1fr); }
          .cd-header-row { flex-direction: column; align-items: stretch; }
          .cd-tasks-grid { grid-template-columns: 1fr; }
          .cd-quick-actions { display: grid; grid-template-columns: repeat(2, 1fr); justify-content: stretch; }
          .cd-quick-actions .btn { justify-content: center; }
          .cd-grid-2-1-1 { grid-template-columns: 1fr; }
          .card.card-padded { padding: 12px !important; }
          .tbl th, .tbl td { padding: 6px 4px !important; font-size: 11px !important; }
          .cd-col-hide-mobile { display: none !important; }
          .btn { min-height: 36px; }
          .btn.btn-ghost, .btn.btn-primary { padding: 6px 10px !important; }
        }
        @media (min-width: 641px) {
          .cd-col-hide-mobile { display: table-cell; }
        }
      `}</style>

      {/* Feedback banner */}
      {feedback && (
        <div style={{ position: "sticky", top: 0, zIndex: 100, padding: "10px 16px", marginBottom: 12, borderRadius: "var(--radius)", fontWeight: 500, fontSize: "var(--font-sm)", display: "flex", alignItems: "center", gap: 8, background: feedback.type === "error" ? "var(--red-bg)" : feedback.type === "success" ? "var(--green-bg,#f0fdf4)" : "var(--accent-soft)", color: feedback.type === "error" ? "var(--red)" : feedback.type === "success" ? "var(--green,#16a34a)" : "var(--accent)", border: `1px solid ${feedback.type === "error" ? "var(--red-border)" : feedback.type === "success" ? "var(--green-border,#86efac)" : "var(--accent-border,var(--border))"}` }}>
          <i className={`ti ${feedback.type === "error" ? "ti-alert-circle" : feedback.type === "success" ? "ti-circle-check" : "ti-info-circle"}`} />
          {feedback.message}
        </div>
      )}

      {/* Reschedule Follow-up Modal */}
      {rescheduleModal && (
        <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 12px" }}>
          <div style={{ background: "var(--surface)", padding: 24, borderRadius: "var(--radius)", maxWidth: 420, width: "100%", boxShadow: "var(--shadow-lg)", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Reschedule Follow-up</div>
            <div style={{ fontSize: "var(--font-sm)", color: "var(--muted)", marginBottom: 12 }}>{rescheduleModal.patientName}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <label style={{ fontSize: "var(--font-xs)", fontWeight: 600, display: "block", marginBottom: 3 }}>New Follow-up Date *</label>
                <input type="date" value={rescheduleDate} onChange={e => setRescheduleDate(e.target.value)} style={{ width: "100%" }} />
                {rescheduleDate && rescheduleDate < todayStr && (
                  <div style={{ fontSize: "var(--font-xs)", color: "var(--amber)", marginTop: 3 }}>⚠ Past date — this follow-up is overdue.</div>
                )}
              </div>
              <div>
                <label style={{ fontSize: "var(--font-xs)", fontWeight: 600, display: "block", marginBottom: 3 }}>Reason</label>
                <input type="text" value={rescheduleReason} onChange={e => setRescheduleReason(e.target.value)} placeholder="Reason for follow-up" style={{ width: "100%" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ fontSize: "var(--font-xs)", fontWeight: 600, display: "block", marginBottom: 3 }}>Priority</label>
                  <select value={reschedulePriority} onChange={e => setReschedulePriority(e.target.value as "urgent"|"high"|"medium"|"low")} style={{ width: "100%" }}>
                    <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "var(--font-xs)", fontWeight: 600, display: "block", marginBottom: 3 }}>Assigned Staff</label>
                  <input type="text" value={rescheduleStaff} onChange={e => setRescheduleStaff(e.target.value)} placeholder="Staff / doctor" style={{ width: "100%" }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: "var(--font-xs)", fontWeight: 600, display: "block", marginBottom: 3 }}>Notes</label>
                <textarea value={rescheduleNotes} onChange={e => setRescheduleNotes(e.target.value)} placeholder="Additional notes…" rows={2} style={{ width: "100%", resize: "vertical" }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
              <button className="btn btn-ghost" onClick={() => setRescheduleModal(null)}>Cancel</button>
              <button className="btn btn-primary" disabled={!rescheduleDate} onClick={() => {
                const patient = patients.find(p => p.id === rescheduleModal.patientId);
                if (patient && rescheduleDate) {
                  onUpdatePatient?.({ ...patient,
                    followUpDate: rescheduleDate,
                    followUpReason: rescheduleReason || (patient as any).followUpReason,
                    followUpPriority: reschedulePriority,
                    followUpStaff: rescheduleStaff || (patient as any).followUpStaff,
                    followUpNotes: rescheduleNotes,
                    followUpStatus: "Pending",
                    updatedAt: new Date().toISOString(),
                  } as Patient, "follow-up rescheduled");
                  logActivity({ type: "patient-edited", message: `Follow-up rescheduled for ${rescheduleModal.patientName} → ${rescheduleDate}`, user: userRole });
                  showFeedback(`Follow-up for ${rescheduleModal.patientName} rescheduled to ${rescheduleDate}.`, "success");
                }
                setRescheduleModal(null); setRescheduleDate(""); setRescheduleReason(""); setRescheduleStaff(""); setRescheduleNotes("");
              }}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      {confirmDelete && (
        <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "var(--surface)", padding: 24, borderRadius: "var(--radius)", maxWidth: 320, width: "90%", boxShadow: "var(--shadow-lg)" }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Delete Task?</div>
            <div style={{ fontSize: "var(--font-sm)", color: "var(--muted)", marginBottom: 16 }}>"{confirmDelete.label}" will be permanently removed.</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="btn btn-danger" style={{ background: "var(--red)", color: "#fff" }} onClick={() => { deleteTask(confirmDelete.id); setConfirmDelete(null); }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Task Modal */}
      {showAddTask && (
        <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "var(--surface)", padding: 24, borderRadius: "var(--radius)", maxWidth: 420, width: "92%", boxShadow: "var(--shadow-lg)", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Add Task</div>
            {/* Task Templates — feature 6 */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: "var(--font-xs)", fontWeight: 600, marginBottom: 5, color: "var(--muted)" }}>Quick Templates</div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {[
                  { label: "New Patient Bundle", tasks: [
                    { title: "Collect consent form", category: "collect-consent" as TaskCategory, priority: "urgent" as TaskPriority },
                    { title: "Verify insurance", category: "verify-insurance" as TaskCategory, priority: "high" as TaskPriority },
                    { title: "Upload lab results", category: "upload-lab" as TaskCategory, priority: "high" as TaskPriority },
                  ]},
                  { label: "Post-Visit", tasks: [
                    { title: "Send e-Rx to pharmacy", category: "send-prescription" as TaskCategory, priority: "high" as TaskPriority },
                    { title: "Complete consultation note", category: "pending-note" as TaskCategory, priority: "medium" as TaskPriority },
                    { title: "Schedule follow-up call", category: "call-patient" as TaskCategory, priority: "medium" as TaskPriority },
                  ]},
                  { label: "Billing Bundle", tasks: [
                    { title: "Create invoice", category: "payment-pending" as TaskCategory, priority: "high" as TaskPriority },
                    { title: "Verify insurance claim", category: "verify-insurance" as TaskCategory, priority: "medium" as TaskPriority },
                  ]},
                ].map(tpl => (
                  <button key={tpl.label} className="btn btn-ghost" style={{ fontSize: 10, padding: "3px 8px" }}
                    onClick={() => {
                      const now = Date.now();
                      tpl.tasks.forEach((t, i) => addTask({ ...t, id: `task-tpl-${now}-${i}`, assignedTo: "", dueTime: todayStr, status: "pending" }));
                      showFeedback(`${tpl.label}: ${tpl.tasks.length} tasks added.`, "success");
                      setShowAddTask(false);
                    }}>
                    <i className="ti ti-template" style={{ marginRight: 3, fontSize: 9 }} />{tpl.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <label style={{ fontSize: "var(--font-xs)", fontWeight: 600, display: "block", marginBottom: 3 }}>Title *</label>
                <input type="text" value={newTask.title} onChange={e => setNewTask(p => ({...p, title: e.target.value}))} style={{ width: "100%" }} placeholder="Task description" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ fontSize: "var(--font-xs)", fontWeight: 600, display: "block", marginBottom: 3 }}>Priority</label>
                  <select value={newTask.priority} onChange={e => setNewTask(p => ({...p, priority: e.target.value as TaskPriority}))} style={{ width: "100%" }}>
                    <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "var(--font-xs)", fontWeight: 600, display: "block", marginBottom: 3 }}>Category</label>
                  <select value={newTask.category} onChange={e => setNewTask(p => ({...p, category: e.target.value as TaskCategory}))} style={{ width: "100%" }}>
                    <option value="other">Other</option><option value="call-patient">Call Patient</option><option value="upload-lab">Upload Lab</option><option value="verify-insurance">Verify Insurance</option><option value="collect-consent">Collect Consent</option><option value="send-prescription">Send Prescription</option><option value="payment-pending">Payment Pending</option><option value="pending-note">Pending Note</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ fontSize: "var(--font-xs)", fontWeight: 600, display: "block", marginBottom: 3 }}>Assigned To</label>
                  <input type="text" value={newTask.assignedTo} onChange={e => setNewTask(p => ({...p, assignedTo: e.target.value}))} style={{ width: "100%" }} placeholder="Name or role" />
                </div>
                <div>
                  <label style={{ fontSize: "var(--font-xs)", fontWeight: 600, display: "block", marginBottom: 3 }}>Due</label>
                  <input type="date" value={newTask.dueTime} onChange={e => setNewTask(p => ({...p, dueTime: e.target.value}))} style={{ width: "100%" }} />
                </div>
              </div>
              {/* Recurring toggle — feature 7 */}
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "var(--font-xs)", userSelect: "none" }}>
                <input type="checkbox" checked={!!(newTask as any).recurring} onChange={e => setNewTask(p => ({...p, recurring: e.target.checked}))} />
                <span><strong>Recurring</strong> — auto-reappear tomorrow when marked done</span>
              </label>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
              <button className="btn btn-ghost" onClick={() => setShowAddTask(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={!newTask.title.trim()} onClick={() => {
                addTask({ ...newTask, id: `task-user-${Date.now()}`, status: "pending" });
                setShowAddTask(false);
                setNewTask({ title: "", priority: "medium", category: "other", assignedTo: "", dueTime: todayStr });
              }}>Add Task</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Task Modal */}
      {editTaskModal && (
        <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 12px" }}>
          <div style={{ background: "var(--surface)", padding: 24, borderRadius: "var(--radius)", maxWidth: 400, width: "100%", boxShadow: "var(--shadow-lg)" }}>
            <div style={{ fontWeight: 700, marginBottom: 12 }}>Edit Task</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <label style={{ fontSize: "var(--font-xs)", fontWeight: 600, display: "block", marginBottom: 3 }}>Title *</label>
                <input type="text" value={editTaskModal.title} onChange={e => setEditTaskModal(p => p ? {...p, title: e.target.value} : null)} style={{ width: "100%" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ fontSize: "var(--font-xs)", fontWeight: 600, display: "block", marginBottom: 3 }}>Priority</label>
                  <select value={editTaskModal.priority} onChange={e => setEditTaskModal(p => p ? {...p, priority: e.target.value as TaskPriority} : null)} style={{ width: "100%" }}>
                    <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "var(--font-xs)", fontWeight: 600, display: "block", marginBottom: 3 }}>Status</label>
                  <select value={editTaskModal.status} onChange={e => setEditTaskModal(p => p ? {...p, status: e.target.value as TaskStatus} : null)} style={{ width: "100%" }}>
                    <option value="pending">Pending</option><option value="in-progress">In Progress</option><option value="done">Done</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ fontSize: "var(--font-xs)", fontWeight: 600, display: "block", marginBottom: 3 }}>Assigned To</label>
                  <input type="text" value={editTaskModal.assignedTo} onChange={e => setEditTaskModal(p => p ? {...p, assignedTo: e.target.value} : null)} style={{ width: "100%" }} />
                </div>
                <div>
                  <label style={{ fontSize: "var(--font-xs)", fontWeight: 600, display: "block", marginBottom: 3 }}>Due</label>
                  <input type="date" value={editTaskModal.dueTime} onChange={e => setEditTaskModal(p => p ? {...p, dueTime: e.target.value} : null)} style={{ width: "100%" }} />
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
              <button className="btn btn-ghost" onClick={() => setEditTaskModal(null)}>Cancel</button>
              <button className="btn btn-primary" disabled={!editTaskModal.title.trim()} onClick={() => {
                const updated = editTaskModal;
                setSavedTasks(prev => {
                  const exists = prev.find(t => t.id === updated.id);
                  const next = exists ? prev.map(t => t.id === updated.id ? updated : t) : [...prev, updated];
                  try { localStorage.setItem(TASKS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
                  return next;
                });
                setTaskOverrides(prev => ({ ...prev, [updated.id]: updated.status }));
                logActivity({ type: "patient-edited", message: `Task updated: ${updated.title}`, user: userRole });
                showFeedback("Task updated.", "success");
                setEditTaskModal(null);
              }}>Save</button>
            </div>
          </div>
        </div>
      )}
      <div style={{ marginBottom: 16 }}>
        <div className="cd-header-row">
          <div>
            <h1 style={{ fontSize: "var(--font-xl)", fontWeight: 800, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
              {userRole === "receptionist" ? "Receptionist Dashboard" : userRole === "doctor" ? "Doctor Dashboard" : "Admin Dashboard"}
              {notificationCount > 0 && (
                <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 20, height: 20, padding: "0 5px", borderRadius: 99, background: "var(--red)", color: "#fff", fontSize: 11, fontWeight: 800, lineHeight: 1 }} title={`${unackedCritical} critical alert${unackedCritical !== 1 ? "s" : ""}${longWaiters > 0 ? `, ${longWaiters} patient${longWaiters !== 1 ? "s" : ""} waiting 60min+` : ""}`}>
                  {notificationCount}
                </span>
              )}
            </h1>
            <div style={{ fontSize: "var(--font-sm)", color: "var(--muted)", marginTop: 2 }}>
              {today.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </div>
          </div>
          {/* Quick Actions button bar */}
          <div className="cd-quick-actions">
            {quickActions.map(action => (
              <button key={action.id} className="btn btn-primary" style={{ fontSize: "var(--font-xs)", padding: "6px 12px", display: "flex", alignItems: "center", gap: 5 }}
                onClick={() => {
                  if (!canRunQuickAction(action.id)) {
                    handleDeniedAccess(action.id, "quick action");
                    return;
                  }
                  if (onAction) onAction(action.id);
                  else showFeedback(`${action.label} — not yet wired in this view.`, "info");
                }}>
                <i className={`ti ${action.icon}`} style={{ fontSize: 13 }} />
                {action.label}
              </button>
            ))}
          </div>
        </div>

        {/* Date selector + Patient lookup row */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {(["today","tomorrow","week","custom"] as const).map(d => (
              <button key={d} className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "4px 10px", fontWeight: dateRange === d ? 700 : 400, background: dateRange === d ? "var(--accent-soft)" : undefined, color: dateRange === d ? "var(--accent)" : undefined }}
                onClick={() => setDateRange(d)}>
                {d === "today" ? "Today" : d === "tomorrow" ? "Tomorrow" : d === "week" ? "This Week" : "Custom"}
              </button>
            ))}
            {dateRange === "custom" && (
              <input type="date" value={customDate} onChange={e => setCustomDate(e.target.value)} style={{ fontSize: "var(--font-xs)", padding: "3px 6px", borderRadius: "var(--radius)", border: "1px solid var(--border)" }} />
            )}
          </div>
          {/* Patient quick lookup */}
          <div style={{ marginLeft: "auto", position: "relative", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <i className="ti ti-search" style={{ fontSize: 13, color: "var(--muted)" }} />
              <input type="text" value={patientSearch} onChange={e => setPatientSearch(e.target.value)} placeholder="Search patient name, ID, phone…" style={{ fontSize: "var(--font-xs)", padding: "4px 8px", borderRadius: "var(--radius)", border: "1px solid var(--border)", width: 220 }} />
              {patientSearch && <button className="btn-icon" style={{ fontSize: 12 }} title="Clear search" onClick={() => setPatientSearch("")}><i className="ti ti-x" /></button>}
            </div>
            {patientSearch.trim().length >= 2 && (
              <div style={{ position: "absolute", top: "100%", right: 0, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow-lg)", zIndex: 50, minWidth: 240, marginTop: 4 }}>
                {patientSearchResults.length === 0 ? (
                  <div style={{ padding: "8px 12px", fontSize: "var(--font-xs)", color: "var(--muted)" }}>No patient found</div>
                ) : patientSearchResults.map(p => (
                  <button key={p.id} style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", background: "none", border: "none", cursor: "pointer", fontSize: "var(--font-xs)", borderBottom: "1px solid var(--border)" }}
                    onClick={() => {
                      if (!canOpenPatientProfile) {
                        handleDeniedAccess("view", "patient profile");
                        return;
                      }
                      if (onAction) onAction(`view-patient:${p.id}`);
                      else showFeedback(`Patient: ${p.name} · ${p.id} · ${p.phone || "no phone"}`, "info");
                      setPatientSearch("");
                    }}>
                    <div style={{ fontWeight: 700 }}>{p.name}</div>
                    <div style={{ color: "var(--muted)" }}>{p.id} · {p.phone || "—"}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Queue status breakdown chips */}
        {baseQueue.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10, alignItems: "center" }}>
            <span style={{ fontSize: "var(--font-xs)", color: "var(--muted)", fontWeight: 600 }}>Queue:</span>
            {(["scheduled","checked-in","waiting","with-doctor","billing-pending","completed","no-show"] as QueueStatus[]).map(s => {
              const count = queueBreakdown[s] ?? 0;
              if (!count) return null;
              const active = queueStatusFilter === s;
              return (
                <button key={s} onClick={() => setQueueStatusFilter(active ? "" : s)} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99, border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`, background: active ? "var(--accent-soft)" : "var(--surface2)", color: active ? "var(--accent)" : "var(--text)", cursor: "pointer", fontWeight: active ? 700 : 400 }}>
                  {s.replace(/-/g, " ")} {count}
                </button>
              );
            })}
            {queueStatusFilter && (
              <button onClick={() => setQueueStatusFilter("")} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99, border: "1px solid var(--border)", background: "none", color: "var(--muted)", cursor: "pointer" }}>✕ clear status</button>
            )}
            {filterDoctor && (
              <button onClick={() => setFilterDoctor("")} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99, border: "1px solid var(--purple-border,var(--border))", background: "var(--purple-bg,var(--surface2))", color: "var(--purple)", cursor: "pointer", fontWeight: 700 }}>
                🩺 {filterDoctor} ✕
              </button>
            )}
          </div>
        )}
      </div>

      {/* Today's Overview Cards — role-filtered */}
      <div className="cd-grid-5">
        <OverviewCard label="Today's Appts"    value={queuePatients.length} color="var(--blue)"   icon="ti-calendar" />
        <OverviewCard label="Waiting"           value={waiting}              color="var(--amber)"  icon="ti-clock" />
        <OverviewCard label="Completed"         value={completed}            color="var(--green)"  icon="ti-circle-check" />
        <OverviewCard label="Pending Payments"  value={`$${revenue.pending.toFixed(0)}`} color="var(--amber)" icon="ti-currency-dollar" />
        <OverviewCard label="Critical Alerts"   value={criticalAlerts.length} color="var(--red)"   icon="ti-alert-triangle" />
      </div>
      {/* Secondary row — admin/receptionist */}
      {canViewDashboardQueue && (
        <div className="cd-grid-4">
          <OverviewCard label="Checked In"     value={checkedIn}       color="var(--green)"  icon="ti-login" />
          <OverviewCard label="In Consultation" value={inConsultation}  color="var(--purple)" icon="ti-stethoscope" />
          <OverviewCard label="No Shows"        value={noShows}         color="var(--red)"    icon="ti-circle-x" />
          <OverviewCard label="Follow-ups Done" value={followUpsDone}   color="var(--green)"  icon="ti-phone-check" />
        </div>
      )}
      {/* Doctor-specific secondary row */}
      {hasRole(normalizedRole, ["doctor"]) && (
        <div className="cd-grid-4">
          <OverviewCard label="In Consultation" value={inConsultation}                                  color="var(--purple)" icon="ti-stethoscope" />
          <OverviewCard label="Checked In"      value={checkedIn}                                       color="var(--green)"  icon="ti-login" />
          <OverviewCard label="Pending Notes"   value={tasks.filter(t => t.category === "pending-note" && t.status !== "done").length} color="var(--amber)" icon="ti-notes" />
          <OverviewCard label="Pending Rx"      value={tasks.filter(t => t.category === "send-prescription" && t.status !== "done").length} color="var(--blue)" icon="ti-pill" />
        </div>
      )}

      <div className={hasRole(normalizedRole, ["doctor"]) ? "cd-grid-1-2" : "cd-grid-2-1"}>
        {/* Live Queue / Waiting Room — for doctor role this renders second (right/below) */}
        <div className="card card-padded">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: collapsed["queue"] ? 0 : 12 }}>
            <div className="section-label" style={{ margin: 0 }}>
              <i className="ti ti-users-group" style={{ marginRight: 4 }} />
              Live Queue / Waiting Room
              <span style={{ marginLeft: 8, fontWeight: 400, color: "var(--muted)" }}>
                {queuePatients.filter(q => !["completed","cancelled","no-show"].includes(q.status)).length} active
              </span>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", maxWidth: "100%", alignItems: "center" }}>
              <button className="btn btn-ghost" style={{ fontSize: 10, padding: "1px 6px" }} title={collapsed["queue"] ? "Expand" : "Collapse"} onClick={() => toggleSection("queue")}>
                <i className={`ti ${collapsed["queue"] ? "ti-chevron-down" : "ti-chevron-up"}`} />
              </button>
              {!collapsed["queue"] && queuePatients.filter(q => q.status === "with-doctor").map(q => (
                <span key={q.id} style={{
                  fontSize: "var(--font-xs)", padding: "2px 10px",
                  background: "var(--purple-bg)", color: "var(--purple)",
                  border: "1px solid var(--purple-border)", borderRadius: 99, fontWeight: 600
                }}>
                  🩺 {q.patient.name} with {q.doctor.replace(/^Dr\.\s*/i, "Dr. ")}
                </span>
              ))}
              {!collapsed["queue"] && (() => {
                const nextUp = queuePatients.find(q => q.status === "waiting" || q.status === "checked-in");
                return nextUp ? (
                  <span style={{
                    fontSize: "var(--font-xs)", padding: "2px 10px",
                    background: "var(--blue-bg)", color: "var(--blue)",
                    border: "1px solid var(--blue-border)", borderRadius: 99, fontWeight: 600
                  }}>
                    ⏭ Next: #{nextUp.tokenNo} {nextUp.patient.name}
                  </span>
                ) : null;
              })()}
            </div>
          </div>
          {!collapsed["queue"] && <div style={{ overflowX: "auto", maxHeight: 400, WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
            <table className="tbl" style={{ minWidth: 560 }}>
              <thead>
                <tr>
                  <th style={{ fontSize: "var(--font-xs)" }}>Token</th>
                  <th style={{ fontSize: "var(--font-xs)" }}>Patient</th>
                  <th style={{ fontSize: "var(--font-xs)" }}>Time</th>
                  <th style={{ fontSize: "var(--font-xs)" }} className="cd-col-hide-mobile">Doctor</th>
                  <th style={{ fontSize: "var(--font-xs)" }} className="cd-col-hide-mobile">Type</th>
                  <th style={{ fontSize: "var(--font-xs)" }}>Status</th>
                  <th style={{ fontSize: "var(--font-xs)" }}>Wait</th>
                  <th style={{ fontSize: "var(--font-xs)" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {queuePatients.length === 0 ? (
                  <tr><td colSpan={8}><div className="empty-state">
                    <div className="empty-state-sub">No patients in queue for this date</div>
                    <button className="btn btn-ghost" style={{ marginTop: 8, fontSize: "var(--font-xs)" }} onClick={() => { if (onAction) onAction("appointments"); else showFeedback("Open the Appointments tab to add patients.", "info"); }}>
                      <i className="ti ti-calendar-plus" style={{ marginRight: 4 }} />Go to Appointments
                    </button>
                  </div></td></tr>
                ) : queuePatients.map(q => {
                  const isWaiting = q.status === "waiting" || q.status === "checked-in";
                  const wait15 = isWaiting && q.waitingTime >= 15 && q.waitingTime < 30;
                  const wait30 = isWaiting && q.waitingTime >= 30 && q.waitingTime < 60;
                  const wait60 = isWaiting && q.waitingTime >= 60;
                  const rowBg = wait60 ? "var(--red-bg)" : wait30 ? "var(--amber-bg)" : wait15 ? "rgba(253,224,71,0.08)" : undefined;
                  const waitColor = wait60 ? "var(--red)" : wait30 ? "var(--amber)" : wait15 ? "var(--amber)" : undefined;
                  const isPrioritized = prioritized.includes(q.id);
                  return (
                  <tr key={q.id} className="tbl-row" style={rowBg ? { background: rowBg } : undefined}>
                    <td style={{ fontSize: "var(--font-sm)", fontWeight: 700 }}>
                      {isPrioritized && <i className="ti ti-arrow-up" style={{ fontSize: 10, color: "var(--red)", marginRight: 2 }} />}
                      #{q.tokenNo}
                    </td>
                    <td>
                      <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{q.patient.name}</div>
                      <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginBottom: 2 }}>{q.patient.id}</div>
                      {canViewPatientContact && q.patient.phone && (isWaiting || q.status === "scheduled") && (
                        <div style={{ display: "flex", gap: 3 }}>
                          <a href={`https://wa.me/${q.patient.phone.replace(/\D/g,"")}`} target="_blank" rel="noreferrer"
                            title="WhatsApp nudge"
                            style={{ fontSize: 10, padding: "1px 5px", borderRadius: 4, background: "#dcfce7", color: "#16a34a", border: "1px solid #86efac", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 2 }}
                            onClick={() => logActivity({ type: "patient-edited", message: `WhatsApp nudge sent to ${q.patient.name}`, user: userRole })}>
                            <i className="ti ti-brand-whatsapp" style={{ fontSize: 10 }} />WA
                          </a>
                          <a href={`sms:${q.patient.phone}`}
                            title="SMS nudge"
                            style={{ fontSize: 10, padding: "1px 5px", borderRadius: 4, background: "var(--blue-bg)", color: "var(--blue)", border: "1px solid var(--blue-border)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 2 }}
                            onClick={() => logActivity({ type: "patient-edited", message: `SMS nudge sent to ${q.patient.name}`, user: userRole })}>
                            <i className="ti ti-message" style={{ fontSize: 10 }} />SMS
                          </a>
                        </div>
                      )}
                    </td>
                    <td style={{ fontSize: "var(--font-sm)" }}>{q.appointmentTime}</td>
                    <td style={{ fontSize: "var(--font-sm)" }} className="cd-col-hide-mobile">{q.doctor}</td>
                    <td style={{ fontSize: "var(--font-sm)" }} className="cd-col-hide-mobile">{q.visitType}</td>
                    <td><StatusBadge status={q.status} /></td>
                    <td>
                      <div style={{ fontSize: "var(--font-xs)", color: waitColor, fontWeight: (wait15||wait30||wait60) ? 700 : undefined }}>
                        {q.waitingTime > 0 ? `${wait60 ? "⚠ " : wait30 ? "🕐 " : ""}Waiting ${q.waitingTime}m` : "—"}
                      </div>
                      {(wait30 || wait60) && !isPrioritized && (
                        <button className="btn btn-ghost" style={{ fontSize: 10, padding: "1px 6px", marginTop: 2, color: "var(--red)" }} title="Prioritize this patient" onClick={() => prioritizePatient(q.id, q.patient.name)}>
                          Prioritize
                        </button>
                      )}
                      {isPrioritized && <span style={{ fontSize: 10, color: "var(--muted)" }}>Prioritized</span>}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 4, flexDirection: "column", alignItems: "flex-start" }}>
                        {canManageQueueFromDashboard && (
                          <QueueActions
                            status={q.status}
                            onTransition={next => transitionStatus(q.id, next, q.doctor)}
                            onNoShow={() => markNoShow(q.id)}
                            onCancel={() => markCancelled(q.id)}
                            userRole={userRole}
                          />
                        )}
                        <button className="btn btn-ghost" style={{ fontSize: 10, padding: "2px 7px", minHeight: 26 }} title="Print token slip" onClick={() => printTokenSlip(q)}>
                          <i className="ti ti-printer" style={{ fontSize: 10, marginRight: 2 }} />Slip
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>}
        </div>

        {/* Critical Alerts & Follow-ups */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Critical Patient Alerts */}
          {canViewCriticalAlerts && (
            <div className="card card-padded">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: collapsed["alerts"] ? 0 : 12 }}>
                <div className="section-label" style={{ color: "var(--red)", margin: 0 }}>
                  <i className="ti ti-alert-triangle" style={{ marginRight: 4 }} />
                  Critical Alerts
                  <span style={{ marginLeft: 6, fontWeight: 400, color: "var(--muted)", fontSize: "var(--font-xs)" }}>
                    {criticalAlerts.filter(a => a.severity === "critical").length} critical · {criticalAlerts.filter(a => a.severity === "high").length} high
                  </span>
                </div>
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <button className="btn btn-ghost" style={{ fontSize: 10, padding: "1px 6px" }} onClick={() => toggleSection("alerts")}>
                    <i className={`ti ${collapsed["alerts"] ? "ti-chevron-down" : "ti-chevron-up"}`} />
                  </button>
                  {criticalAlerts.length > 0 && !collapsed["alerts"] && (
                    <span style={{ fontSize: "var(--font-xs)", color: "var(--red)", fontWeight: 700, background: "var(--red-bg)", padding: "1px 8px", borderRadius: 99, border: "1px solid var(--red-border)" }}>
                      {criticalAlerts.length} need attention
                    </span>
                  )}
                </div>
              </div>
              {!collapsed["alerts"] && <div style={{ maxHeight: 280, overflow: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                {criticalAlerts.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 20, color: "var(--muted)", fontSize: "var(--font-sm)" }}>
                    <i className="ti ti-circle-check" style={{ fontSize: 20, color: "var(--green)", display: "block", marginBottom: 4 }} />
                    No critical alerts
                  </div>
                ) : criticalAlerts.filter(a => !acknowledgedAlerts.has(a.id)).map(alert => {
                const meta = ALERT_META[alert.type];
                return (
                  <div key={alert.id} style={{ display: "flex", gap: 8, padding: "7px 10px", background: meta.bg, border: `1px solid ${meta.border}`, borderRadius: "var(--radius)", alignItems: "flex-start" }}>
                    <i className={`ti ${meta.icon}`} style={{ color: meta.color, fontSize: 14, marginTop: 1, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: "var(--font-sm)", fontWeight: 700 }}>{alert.patient.name}</span>
                        <span style={{ fontSize: "var(--font-xs)", color: meta.color, fontWeight: 600, flexShrink: 0 }}>{meta.label}</span>
                      </div>
                      <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginTop: 1 }}>{alert.message}</div>
                    </div>
                    <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "1px 6px", flexShrink: 0 }}
                      onClick={() => {
                        if (!canOpenPatientProfile) {
                          handleDeniedAccess("view", "patient profile");
                          return;
                        }
                        if (onAction) onAction(`view-patient:${alert.patient.id}`);
                        else showFeedback(`Open patient profile for ${alert.patient.name}.`, "info");
                      }}>View</button>
                    {!acknowledgedAlerts.has(alert.id) && (
                      <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "1px 6px", flexShrink: 0, color: "var(--green)" }}
                        onClick={() => acknowledgeAlert(alert.id, alert.patient)}>✓ Ack</button>
                    )}
                  </div>
                );
              })}
            </div>}
          </div>
          )}

          {/* Follow-up Center */}
          <div className="card card-padded">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div className="section-label" style={{ color: "var(--amber)", margin: 0 }}>
                <i className="ti ti-phone-exclamation" style={{ marginRight: 4 }} />
                Follow-up Center
                <span style={{ marginLeft: 6, fontWeight: 400, color: "var(--muted)", fontSize: "var(--font-xs)" }}>
                  {followUps.filter(f => f.status !== "completed").length} pending
                </span>
              </div>
              <button className="btn btn-ghost" style={{ fontSize: 10, padding: "1px 6px" }} onClick={() => toggleSection("followups")}>
                <i className={`ti ${collapsed["followups"] ? "ti-chevron-down" : "ti-chevron-up"}`} />
              </button>
            </div>
            {!collapsed["followups"] && <>
            {/* Bulk action toolbar */}
            {followUps.filter(f => f.status !== "completed").length > 0 && (
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8, alignItems: "center" }}>
                <input type="checkbox"
                  checked={selectedFollowUps.size === followUps.filter(f => f.status !== "completed").length && followUps.filter(f => f.status !== "completed").length > 0}
                  onChange={e => {
                    if (e.target.checked) setSelectedFollowUps(new Set(followUps.filter(f => f.status !== "completed").map(f => f.id)));
                    else setSelectedFollowUps(new Set());
                  }}
                  title="Select all"
                />
                <span style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginRight: 4 }}>
                  {selectedFollowUps.size > 0 ? `${selectedFollowUps.size} selected` : "Select all"}
                </span>
                {selectedFollowUps.size > 0 && (
                  <>
                    <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "3px 8px", minHeight: 28 }}
                      onClick={() => {
                        selectedFollowUps.forEach(id => updateFollowUp(id, "in-progress", new Date().toISOString()));
                        showFeedback(`${selectedFollowUps.size} follow-ups marked as called.`, "success");
                        setSelectedFollowUps(new Set());
                      }}>
                      <i className="ti ti-phone-check" style={{ marginRight: 3, fontSize: 10 }} />Mark All Called
                    </button>
                    <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "3px 8px", minHeight: 28 }}
                      onClick={() => setShowBulkReschedule(true)}>
                      <i className="ti ti-calendar-event" style={{ marginRight: 3, fontSize: 10 }} />Reschedule All
                    </button>
                    {showBulkReschedule && (
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        <input type="date" value={bulkRescheduleDate} onChange={e => setBulkRescheduleDate(e.target.value)}
                          style={{ fontSize: "var(--font-xs)", padding: "2px 6px", borderRadius: "var(--radius)", border: "1px solid var(--border)" }} />
                        <button className="btn btn-primary" style={{ fontSize: "var(--font-xs)", padding: "3px 8px", minHeight: 28 }}
                          disabled={!bulkRescheduleDate}
                          onClick={() => {
                            selectedFollowUps.forEach(id => {
                              const patient = patients.find(p => p.id === id);
                              if (patient) onUpdatePatient?.({ ...patient, followUpDate: bulkRescheduleDate }, "follow-up rescheduled");
                            });
                            showFeedback(`${selectedFollowUps.size} follow-ups rescheduled to ${bulkRescheduleDate}.`, "success");
                            setSelectedFollowUps(new Set()); setBulkRescheduleDate(""); setShowBulkReschedule(false);
                          }}>Apply</button>
                        <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "3px 8px", minHeight: 28 }}
                          onClick={() => { setShowBulkReschedule(false); setBulkRescheduleDate(""); }}>✕</button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
            <div style={{ maxHeight: 320, overflow: "auto" }}>
              {followUps.length === 0 ? (
                <div style={{ textAlign: "center", padding: 20, color: "var(--muted)", fontSize: "var(--font-sm)" }}>
                  <i className="ti ti-circle-check" style={{ fontSize: 20, color: "var(--green)", display: "block", marginBottom: 4 }} />
                  All follow-ups clear
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {followUps.map(f => {
                    const isClosed = f.status === "completed";
                    const prioColor: Record<FollowUp["priority"], string> = { urgent: "var(--red)", high: "var(--amber)", medium: "var(--blue)", low: "var(--muted)" };
                    const statusColor: Record<FollowUp["status"], string> = { pending: "var(--amber)", "in-progress": "var(--blue)", completed: "var(--green)" };
                    // Aging heatmap — days overdue capped at 14 for bar width
                    const daysOverdue = f.dueDate ? Math.max(0, Math.floor((Date.now() - new Date(f.dueDate).getTime()) / 86_400_000)) : 0;
                    const heatPct = Math.min(100, (daysOverdue / 14) * 100);
                    const heatColor = daysOverdue === 0 ? "var(--green)" : daysOverdue < 3 ? "var(--amber)" : daysOverdue < 7 ? "var(--orange,#f97316)" : "var(--red)";
                    const isSelected = selectedFollowUps.has(f.id);
                    return (
                      <div key={f.id} style={{
                        padding: "8px 10px", borderRadius: "var(--radius)", border: `1px solid ${isSelected ? "var(--accent)" : "var(--border)"}`,
                        background: isSelected ? "var(--accent-soft)" : isClosed ? "var(--surface2)" : "var(--surface)",
                        opacity: isClosed ? 0.6 : 1,
                      }}>
                        {/* Row 1: checkbox + name + priority + status */}
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                          {!isClosed && (
                            <input type="checkbox" checked={isSelected}
                              onChange={e => setSelectedFollowUps(prev => { const s = new Set(prev); e.target.checked ? s.add(f.id) : s.delete(f.id); return s; })} />
                          )}
                          <span style={{ fontSize: "var(--font-sm)", fontWeight: 700, flex: 1 }}>{f.patient.name}</span>
                          <span style={{ fontSize: "var(--font-xs)", fontWeight: 700, color: prioColor[f.priority] }}>{f.priority.toUpperCase()}</span>
                          <span style={{ fontSize: "var(--font-xs)", color: statusColor[f.status], fontWeight: 600 }}>● {f.status.replace("-", " ")}</span>
                        </div>
                        {/* Aging heatmap bar — feature 5 */}
                        {!isClosed && daysOverdue > 0 && (
                          <div style={{ marginBottom: 5 }}>
                            <div style={{ height: 4, borderRadius: 2, background: "var(--surface2)", overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${heatPct}%`, background: heatColor, transition: "width 0.3s" }} />
                            </div>
                            <div style={{ fontSize: 10, color: heatColor, fontWeight: 700, marginTop: 1 }}>{daysOverdue}d overdue</div>
                          </div>
                        )}
                        {/* Row 2: reason + due + staff + last contact */}
                        <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginBottom: 5, lineHeight: 1.5 }}>
                          {f.reason}
                          <span style={{ margin: "0 4px" }}>·</span>
                          Due <strong style={{ color: "var(--fg)" }}>{f.dueDate ? fmtDate(f.dueDate) : "—"}</strong>
                          <span style={{ margin: "0 4px" }}>·</span>
                          {f.assignedStaff}
                          <span style={{ margin: "0 4px" }}>·</span>
                          Last: {f.lastContacted}
                        </div>
                        {/* Row 3: actions */}
                        {!isClosed && (
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            {f.patient.phone ? (
                              <a href={`tel:${f.patient.phone}`} className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "5px 10px", minHeight: 32, textDecoration: "none", display: "inline-flex", alignItems: "center" }}
                                onClick={() => updateFollowUp(f.id, "in-progress", new Date().toISOString())}>
                                <i className="ti ti-phone" style={{ marginRight: 2, fontSize: 10 }} />Call
                              </a>
                            ) : (
                              <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "5px 10px", minHeight: 32, opacity: 0.5 }} disabled title="No phone on file">
                                <i className="ti ti-phone" style={{ marginRight: 2, fontSize: 10 }} />Call
                              </button>
                            )}
                            <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "5px 10px", minHeight: 32 }}
                              onClick={() => updateFollowUp(f.id, "in-progress", new Date().toISOString())}>
                              <i className="ti ti-check" style={{ marginRight: 2, fontSize: 10 }} />Mark Called
                            </button>
                            <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "5px 10px", minHeight: 32 }}
                              onClick={() => { setRescheduleModal({ patientId: f.patient.id, patientName: f.patient.name }); setRescheduleDate(f.dueDate || ""); }}>
                              <i className="ti ti-calendar-plus" style={{ marginRight: 2, fontSize: 10 }} />Reschedule
                            </button>
                            <button className="btn btn-primary" style={{ fontSize: "var(--font-xs)", padding: "5px 10px", minHeight: 32 }}
                              onClick={() => updateFollowUp(f.id, "completed", new Date().toISOString())}>
                              <i className="ti ti-circle-check" style={{ marginRight: 2, fontSize: 10 }} />Done
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            </>}
          </div>
        </div>
      </div>

      {/* Patient Safety Review */}
      {canViewPatientSafetyReview && (() => {
        const safetyItems = useMemo(() => patients.filter(p => {
          if (dismissedSafety.has(p.id)) return false;
          return (
            !(p as any).emergencyContact ||
            !p.phone ||
            (p as any).consentStatus === "missing" ||
            p.insuranceStatus === "Expired" ||
            (p.tags as string[] | undefined)?.includes("high-risk") ||
            (p as any).highRisk
          );
        }), [patients, dismissedSafety]);
        if (safetyItems.length === 0 && userRole !== "admin") return null;
        return (
          <div className="card card-padded" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div className="section-label" style={{ margin: 0, color: safetyItems.length > 0 ? "var(--red)" : "var(--green)" }}>
                <i className={`ti ${safetyItems.length > 0 ? "ti-shield-exclamation" : "ti-shield-check"}`} style={{ marginRight: 4 }} />
                Patient Safety Review
                <span style={{ marginLeft: 6, fontWeight: 400, color: "var(--muted)", fontSize: "var(--font-xs)" }}>
                  {safetyItems.length} need attention
                </span>
              </div>
            </div>
            {safetyItems.length === 0 ? (
              <div style={{ textAlign: "center", padding: 14, color: "var(--green)", fontSize: "var(--font-sm)" }}>
                <i className="ti ti-shield-check" style={{ fontSize: 18, display: "block", marginBottom: 4 }} />
                All patients clear — no safety gaps detected.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 240, overflow: "auto" }}>
                {safetyItems.slice(0, 20).map(p => {
                  const issues: string[] = [];
                  if (!(p as any).emergencyContact) issues.push("Missing emergency contact");
                  if (!p.phone) issues.push("Missing phone");
                  if ((p as any).consentStatus === "missing") issues.push("Missing consent");
                  if (p.insuranceStatus === "Expired") issues.push("Expired insurance");
                  if ((p.tags as string[] | undefined)?.includes("high-risk") || (p as any).highRisk) issues.push("High risk");
                  return (
                    <div key={p.id} style={{ display: "flex", gap: 8, padding: "6px 10px", background: "var(--red-bg)", border: "1px solid var(--red-border)", borderRadius: "var(--radius)", alignItems: "flex-start", flexWrap: "wrap" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "var(--font-sm)", fontWeight: 700 }}>{p.name}</div>
                        <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{issues.join(" · ")}</div>
                      </div>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {canViewPatientContact && p.phone && (
                          <a href={`tel:${p.phone}`} className="btn btn-ghost" style={{ fontSize: 10, padding: "2px 6px", textDecoration: "none", display: "inline-flex", alignItems: "center" }} title="Call patient">
                            <i className="ti ti-phone" style={{ fontSize: 10 }} />
                          </a>
                        )}
                        {(p as any).consentStatus === "missing" && (
                          <button className="btn btn-ghost" style={{ fontSize: 10, padding: "2px 6px" }} onClick={() => {
                            onUpdatePatient?.({ ...p, consentReminderSent: true } as Patient, "consent reminder sent");
                            logActivity({ type: "patient-edited", message: `Consent reminder marked for ${p.name}`, user: userRole });
                            showFeedback(`Consent reminder marked for ${p.name}.`, "info");
                          }}>Consent Reminder</button>
                        )}
                        <button className="btn btn-ghost" style={{ fontSize: 10, padding: "2px 6px" }} onClick={() => {
                          if (!canOpenPatientProfile) {
                            handleDeniedAccess("view", "patient profile");
                            return;
                          }
                          if (onAction) onAction(`view-patient:${p.id}`);
                          else showFeedback(`Patient: ${p.name} · ${p.id}`, "info");
                        }}>View</button>
                        <button className="btn btn-ghost" style={{ fontSize: 10, padding: "2px 6px", color: "var(--muted)" }} title="Dismiss" onClick={() => setDismissedSafety(prev => new Set([...prev, p.id]))}>✕</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* Appointment Snapshot */}
      <div className="card card-padded" style={{ marginBottom: 16 }}>
        <div className="section-label" style={{ marginBottom: 12 }}>
          <i className="ti ti-calendar-time" style={{ marginRight: 4 }} />
          Appointment Snapshot
        </div>
        <div className="cd-grid-snapshot4">

          {/* Upcoming next 5 */}
          <div>
            <div style={{ fontSize: "var(--font-xs)", fontWeight: 700, color: "var(--blue)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <i className="ti ti-clock-hour-3" style={{ marginRight: 4 }} />Next Up
            </div>
            {apptSnapshot.upcoming.length === 0 ? (
              <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>No upcoming</div>
            ) : apptSnapshot.upcoming.map(q => (
              <div key={q.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
                <div>
                  <div style={{ fontSize: "var(--font-xs)", fontWeight: 600 }}>{q.patient.name}</div>
                  <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{q.appointmentTime} · {q.doctor.replace("Dr. ", "")}</div>
                </div>
                <StatusBadge status={q.status} />
              </div>
            ))}
          </div>

          {/* Delayed */}
          <div>
            <div style={{ fontSize: "var(--font-xs)", fontWeight: 700, color: "var(--amber)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <i className="ti ti-clock-exclamation" style={{ marginRight: 4 }} />Delayed ({apptSnapshot.delayed.length})
            </div>
            {apptSnapshot.delayed.length === 0 ? (
              <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>None delayed</div>
            ) : apptSnapshot.delayed.map(q => (
              <div key={q.id} style={{ padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "var(--font-xs)", fontWeight: 600 }}>{q.patient.name}</span>
                  <span style={{ fontSize: "var(--font-xs)", color: "var(--amber)", fontWeight: 700 }}>+{q.waitingTime}m</span>
                </div>
                <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{q.appointmentTime} · {q.doctor.replace("Dr. ", "")}</div>
              </div>
            ))}
          </div>

          {/* Doctor-wise schedule */}
          <div>
            <div style={{ fontSize: "var(--font-xs)", fontWeight: 700, color: "var(--purple)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <i className="ti ti-user-shield" style={{ marginRight: 4 }} />By Doctor
            </div>
            {Object.keys(apptSnapshot.doctorMap).length === 0 ? (
              <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>No schedule</div>
            ) : Object.entries(apptSnapshot.doctorMap).map(([doc, pts]) => (
              <div key={doc} style={{ padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
                <div style={{ fontSize: "var(--font-xs)", fontWeight: 700 }}>{doc}</div>
                <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", lineHeight: 1.6 }}>
                  {pts.filter(p => p.status === "with-doctor").length} in consult ·{" "}
                  {pts.filter(p => p.status === "waiting" || p.status === "checked-in").length} waiting ·{" "}
                  {pts.filter(p => p.status === "completed").length} done
                </div>
              </div>
            ))}
          </div>

          {/* Cancelled / No-show */}
          <div>
            <div style={{ fontSize: "var(--font-xs)", fontWeight: 700, color: "var(--red)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <i className="ti ti-circle-x" style={{ marginRight: 4 }} />Cancelled / No-Show ({apptSnapshot.cancelledNoShow.length})
            </div>
            {apptSnapshot.cancelledNoShow.length === 0 ? (
              <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>None</div>
            ) : apptSnapshot.cancelledNoShow.map(q => (
              <div key={q.id} style={{ padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "var(--font-xs)", fontWeight: 600 }}>{q.patient.name}</span>
                  <StatusBadge status={q.status} />
                </div>
                <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{q.appointmentTime} · {q.doctor.replace("Dr. ", "")}</div>
              </div>
            ))}
          </div>

        </div>
      </div>

      <div className="cd-grid-2-1-1">
        {/* Billing Snapshot */}
        {canViewBillingSnapshot && (
          <div className="card card-padded">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: collapsed["billing"] ? 0 : 12 }}>
              <div className="section-label" style={{ margin: 0 }}>
                <i className="ti ti-receipt" style={{ marginRight: 4 }} />
                Billing Snapshot
                <span style={{ marginLeft: 6, color: "var(--muted)", fontWeight: 400, fontSize: "var(--font-xs)" }}>Today</span>
              </div>
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                <button className="btn btn-ghost" style={{ fontSize: 10, padding: "1px 6px" }} onClick={() => toggleSection("billing")}>
                  <i className={`ti ${collapsed["billing"] ? "ti-chevron-down" : "ti-chevron-up"}`} />
                </button>
                {revenue.pendingCount > 0 && !collapsed["billing"] && (
                  <span style={{ fontSize: "var(--font-xs)", color: "var(--amber)", fontWeight: 700, background: "var(--amber-bg)", padding: "1px 8px", borderRadius: 99, border: "1px solid var(--amber-border)" }}>
                    {revenue.pendingCount} unpaid invoice{revenue.pendingCount !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>
            {!collapsed["billing"] && <>
          <div className="cd-grid-4-sm">
            {[
              { label: "Total Revenue", value: revenue.total, color: "var(--fg)", bold: true },
              { label: "Paid", value: revenue.paid, color: "var(--green)" },
              { label: "Unpaid", value: revenue.unpaid, color: "var(--amber)" },
              { label: "Refunds", value: revenue.refunds, color: "var(--red)" },
            ].map(item => (
              <div key={item.label} style={{ textAlign: "center", padding: "8px 4px", background: "var(--surface2)", borderRadius: "var(--radius)" }}>
                <div style={{ fontSize: "var(--font-md)", fontWeight: item.bold ? 800 : 700, color: item.color }}>${item.value.toFixed(0)}</div>
                <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginTop: 1 }}>{item.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 12 }}>
            {[
              { label: "Insurance Pending", value: revenue.insurancePending, color: "var(--amber)" },
              { label: "Cash collected",    value: revenue.cash,            color: undefined },
              { label: "UPI / Online",      value: revenue.upi,             color: undefined },
              { label: "Card",              value: revenue.card,            color: undefined },
            ].map(r => (
              <div key={r.label} style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--font-xs)" }}>
                <span style={{ color: "var(--muted)" }}>{r.label}</span>
                <span style={{ fontWeight: 700, color: r.color }}>${r.value.toFixed(0)}</span>
              </div>
            ))}
          </div>
          <div className="cd-grid-2-sm">
            {canViewBillingSnapshot && (
              <>
                <button className="btn btn-primary" style={{ fontSize: "var(--font-xs)", minHeight: 36 }} onClick={() => { if (onAction) onAction("create-invoice"); else showFeedback("Create Invoice — open Billing to continue.", "info"); }}><i className="ti ti-plus" style={{ marginRight: 4, fontSize: 11 }} />Create Invoice</button>
                <button className="btn btn-ghost"   style={{ fontSize: "var(--font-xs)", minHeight: 36 }} onClick={() => { if (onAction) onAction("collect-payment"); else showFeedback("Collect Payment — open Billing to continue.", "info"); }}><i className="ti ti-cash" style={{ marginRight: 4, fontSize: 11 }} />Collect Payment</button>
                <button className="btn btn-ghost"   style={{ fontSize: "var(--font-xs)", minHeight: 36 }} onClick={() => { if (onAction) onAction("pending-bills"); else showFeedback("Pending Bills — open Billing to continue.", "info"); }}><i className="ti ti-list" style={{ marginRight: 4, fontSize: 11 }} />Pending Bills</button>
                <button className="btn btn-ghost"   style={{ fontSize: "var(--font-xs)", minHeight: 36 }} onClick={() => { if (onAction) onAction("print-receipt"); else showFeedback("Print Receipt — open Billing to continue.", "info"); }}><i className="ti ti-printer" style={{ marginRight: 4, fontSize: 11 }} />Print Receipt</button>
              </>
            )}
          </div>
          <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", minHeight: 32, marginTop: 8, width: "100%" }} onClick={() => {
            const dateLabel = dateRange === "week" ? `Week from ${todayStr}` : dateRange === "tomorrow" ? `Tomorrow ${selectedDateStr}` : dateRange === "custom" ? `Custom ${selectedDateStr}` : todayStr;
            const qbd = queueBreakdown;
            const lines = [
              `=== Clinic Daily Summary ===`,
              `Date: ${dateLabel}`,
              `Generated: ${new Date().toLocaleString()}`,
              ``,
              `--- Queue Breakdown ---`,
              `Total Appointments: ${baseQueue.length}`,
              `Scheduled: ${qbd.scheduled ?? 0}  Checked In: ${qbd["checked-in"] ?? 0}  Waiting: ${qbd.waiting ?? 0}`,
              `With Doctor: ${qbd["with-doctor"] ?? 0}  Billing Pending: ${qbd["billing-pending"] ?? 0}`,
              `Completed: ${qbd.completed ?? 0}  No Show: ${qbd["no-show"] ?? 0}`,
              ``,
              `--- Doctor Workload ---`,
              ...Object.entries(doctorWorkload).map(([doc, w]) => `  ${doc}: ${w.appts} appts, ${w.seen} seen, ${w.waiting} waiting, ${w.inConsult} in consult`),
              ``,
              `--- Critical Alerts ---`,
              `Total: ${criticalAlerts.length}`,
              ...criticalAlerts.slice(0,10).map(a => `  [${a.severity.toUpperCase()}] ${a.patient.name} — ${a.message}`),
              ``,
              `--- Follow-ups Due ---`,
              `Pending: ${followUps.filter(f => f.status !== "completed").length}`,
              ...followUps.filter(f => f.status !== "completed").slice(0,10).map(f => `  ${f.patient.name} — ${f.reason} (${f.priority})`),
              ``,
              `--- Task Summary ---`,
              `Total: ${tasks.length}  Open: ${tasks.filter(t => t.status !== "done").length}  Done: ${tasks.filter(t => t.status === "done").length}`,
              `Urgent: ${tasks.filter(t => t.priority === "urgent" && t.status !== "done").length}`,
              ``,
              `--- Revenue (Today) ---`,
              `Total: $${revenue.total.toFixed(2)}  Paid: $${revenue.paid.toFixed(2)}  Pending: $${revenue.pending.toFixed(2)}`,
              ``,
              `--- Activity ---`,
              `Total entries: ${activityLog.length}`,
            ];
            const blob = new Blob([lines.join("\n")], { type: "text/plain" });
            const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
            a.download = `clinic-summary-${selectedDateStr}.txt`; a.click();
            showFeedback("Daily summary (TXT) exported.", "success");
            logActivity({ type: "file-deleted", message: "Daily summary exported as TXT", user: userRole });
          }}><i className="ti ti-download" style={{ marginRight: 4, fontSize: 11 }} />Export Summary TXT</button>
          <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", minHeight: 32, marginTop: 4, width: "100%" }} onClick={() => {
            const dateLabel = dateRange === "week" ? `Week from ${todayStr}` : selectedDateStr;
            const qbd = queueBreakdown;
            const rows = [
              ["Date", "Generated", "Total Appts", "Scheduled", "Checked In", "Waiting", "With Doctor", "Billing Pending", "Completed", "No Show", "Critical Alerts", "Follow-ups Pending", "Tasks Open", "Tasks Done", "Revenue Total", "Revenue Paid", "Revenue Pending"],
              [dateLabel, new Date().toLocaleString(), baseQueue.length, qbd.scheduled??0, qbd["checked-in"]??0, qbd.waiting??0, qbd["with-doctor"]??0, qbd["billing-pending"]??0, qbd.completed??0, qbd["no-show"]??0, criticalAlerts.length, followUps.filter(f=>f.status!=="completed").length, tasks.filter(t=>t.status!=="done").length, tasks.filter(t=>t.status==="done").length, revenue.total.toFixed(2), revenue.paid.toFixed(2), revenue.pending.toFixed(2)],
            ];
            const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,"''")}"`).join(",")).join("\n");
            const blob = new Blob([csv], { type: "text/csv" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `clinic-summary-${selectedDateStr}.csv`; a.click();
            showFeedback("Daily summary (CSV) exported.", "success");
            logActivity({ type: "file-deleted", message: "Daily summary exported as CSV", user: userRole });
          }}><i className="ti ti-table-export" style={{ marginRight: 4, fontSize: 11 }} />Export Summary CSV</button>
          {/* Shift Handover Report — feature 10 */}
          <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", minHeight: 32, marginTop: 4, width: "100%", color: "var(--purple)" }} onClick={() => {
            const openTasks = tasks.filter(t => t.status !== "done");
            const pendingFU = followUps.filter(f => f.status !== "completed");
            const billingPending = queuePatients.filter(q => q.status === "billing-pending");
            const unackedAlerts = criticalAlerts.filter(a => !acknowledgedAlerts.has(a.id));
            const lines = [
              `=== SHIFT HANDOVER REPORT ===`,
              `Generated: ${new Date().toLocaleString()}  |  Role: ${userRole}`,
              ``,
              `--- OPEN TASKS (${openTasks.length}) ---`,
              ...openTasks.map(t => `  [${t.priority.toUpperCase()}] ${t.title} — ${t.assignedTo} — due ${t.dueTime}`),
              ``,
              `--- PENDING FOLLOW-UPS (${pendingFU.length}) ---`,
              ...pendingFU.map(f => `  [${f.priority.toUpperCase()}] ${f.patient.name} — ${f.reason} — due ${f.dueDate || "—"}`),
              ``,
              `--- BILLING PENDING (${billingPending.length}) ---`,
              ...billingPending.map(q => `  ${q.patient.name} — Token #${q.tokenNo} — ${q.doctor}`),
              ``,
              `--- UNACKNOWLEDGED ALERTS (${unackedAlerts.length}) ---`,
              ...unackedAlerts.map(a => `  [${a.severity.toUpperCase()}] ${a.patient.name} — ${a.message}`),
            ];
            const blob = new Blob([lines.join("\n")], { type: "text/plain" });
            const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
            a.download = `handover-${new Date().toISOString().replace(/[:.]/g, "-")}.txt`; a.click();
            showFeedback("Shift handover report exported.", "success");
            logActivity({ type: "file-deleted", message: "Shift handover report exported", user: userRole });
          }}><i className="ti ti-arrow-right-circle" style={{ marginRight: 4, fontSize: 11 }} />Shift Handover Report</button>
          {/* 7-day revenue sparkline — feature 8 */}
          {(() => {
            const storedInvoices: any[] = (() => { try { return JSON.parse(localStorage.getItem("clinic_crm_invoices") || "[]"); } catch { return []; } })();
            // Fallback: derive synthetic billing points from patients prop when localStorage key is absent.
            // Uses lastVisit OR nextAppointment as the date anchor, and any fee/balance field as the amount.
            // This ensures bars render even in host apps that haven't written clinic_crm_invoices yet.
            const syntheticInvoices: any[] = patients
              .filter(p => {
                const dateField = (p as any).lastVisit || (p.status === "Completed" ? p.nextAppointment : null);
                const amount = (p as any).consultationFee ?? (p as any).balance ?? (p as any).totalAmount ?? (p as any).fee ?? 0;
                return dateField && Number(amount) > 0;
              })
              .map(p => ({
                createdAt: (p as any).lastVisit || p.nextAppointment,
                status: "paid",
                amount: (p as any).consultationFee ?? (p as any).balance ?? (p as any).totalAmount ?? (p as any).fee ?? 0,
              }));
            const invoices: any[] = storedInvoices.length > 0 ? storedInvoices : syntheticInvoices;
            const days = Array.from({ length: 7 }, (_, i) => {
              const d = new Date(); d.setDate(d.getDate() - (6 - i));
              const ds = d.toISOString().split("T")[0];
              const total = invoices.filter((inv: any) => {
                try { return new Date(inv.createdAt).toISOString().split("T")[0] === ds && inv.status === "paid"; } catch { return false; }
              }).reduce((s: number, inv: any) => s + (Number(inv.amount) || 0), 0);
              return { label: d.toLocaleDateString("en-US", { weekday: "short" }), total, ds };
            });
            const max = Math.max(...days.map(d => d.total), 1);
            const hasData = days.some(d => d.total > 0);
            const todayLabel = new Date().toLocaleDateString("en-US", { weekday: "short" });
            return (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginBottom: 4, display: "flex", justifyContent: "space-between" }}>
                  <span>7-day revenue trend</span>
                  {!hasData && <span style={{ color: "var(--muted)", fontStyle: "italic" }}>no billing data yet</span>}
                </div>
                <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 40 }}>
                  {days.map((d, i) => (
                    <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                      <div title={`${d.label}: $${d.total.toFixed(0)}`} style={{ width: "100%", height: Math.max(3, (d.total / max) * 34), background: d.label === todayLabel ? "var(--accent)" : hasData ? "var(--green)" : "var(--border)", borderRadius: "2px 2px 0 0", transition: "height 0.3s" }} />
                      <div style={{ fontSize: 9, color: d.label === todayLabel ? "var(--accent)" : "var(--muted)", fontWeight: d.label === todayLabel ? 700 : 400 }}>{d.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
          </>}
        </div>
        )}

        {/* Doctor / Staff Workload — admin only */}
        {hasRole(normalizedRole, ["admin"]) ? (
          <div className="card card-padded">
            <div className="section-label" style={{ marginBottom: 10 }}>
              <i className="ti ti-user-shield" style={{ marginRight: 4 }} />
              Staff Workload
            </div>
            {Object.keys(doctorWorkload).length === 0 ? (
              <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", textAlign: "center", padding: 16 }}>No appointments today</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {Object.entries(doctorWorkload).map(([doctor, w]) => {
                  const pct = w.appts > 0 ? Math.round((w.seen / w.appts) * 100) : 0;
                  const isOverloaded = w.waiting >= 3 || w.inConsult > 0 && w.waiting >= 2;
                  return (
                    <div key={doctor} style={{ padding: "8px 10px", borderRadius: "var(--radius)", border: `1px solid ${isOverloaded ? "var(--amber-border)" : "var(--border)"}`, background: isOverloaded ? "var(--amber-bg)" : "var(--surface2)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <span style={{ fontSize: "var(--font-sm)", fontWeight: 700 }}>{doctor}</span>
                        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                          {isOverloaded && <span style={{ fontSize: "var(--font-xs)", color: "var(--amber)", fontWeight: 700 }}>⚠ Overloaded</span>}
                          <button className="btn btn-ghost" style={{ fontSize: 10, padding: "1px 6px" }} title={`Filter dashboard by ${doctor}`} onClick={() => { setFilterDoctor(filterDoctor === doctor ? "" : doctor); showFeedback(`Filtered to ${doctor}.`, "info"); }}>
                            {filterDoctor === doctor ? "✕ Clear" : "Filter"}
                          </button>
                        </div>
                      </div>
                      <div className="cd-grid-4-stat">
                        {[
                          { label: "Appts", value: w.appts },
                          { label: "Seen",  value: w.seen },
                          { label: "Waiting", value: w.waiting, color: w.waiting >= 3 ? "var(--amber)" : undefined },
                          { label: "Avg Consult", value: w.avgConsultMin !== null ? `${w.avgConsultMin}m` : "—" },
                        ].map(m => (
                          <div key={m.label} style={{ textAlign: "center", background: "var(--surface)", borderRadius: 4, padding: "3px 0" }}>
                            <div style={{ fontSize: "var(--font-sm)", fontWeight: 800, color: m.color }}>{m.value}</div>
                            <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{m.label}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--font-xs)", color: "var(--muted)" }}>
                        <span>{pct}% complete</span>
                        <span>{w.pendingNotes} pending note{w.pendingNotes !== 1 ? "s" : ""}</span>
                        {w.inConsult > 0 && <span style={{ color: "var(--purple)" }}>● In consult</span>}
                      </div>
                      {/* Progress bar */}
                      <div style={{ marginTop: 5, height: 4, background: "var(--border)", borderRadius: 99, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: pct === 100 ? "var(--green)" : "var(--accent)", borderRadius: 99, transition: "width 0.4s" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* Non-admin: show Tasks panel here instead */
          <TasksPanel tasks={tasks} updateTask={updateTask} deleteTask={deleteTask} setConfirmDelete={setConfirmDelete} setShowAddTask={setShowAddTask} setEditTaskModal={setEditTaskModal} userRole={userRole} onAction={onAction} />
        )}

        {/* Doctor Comparison Table — feature 9, admin only */}
        {hasRole(normalizedRole, ["admin"]) && Object.keys(doctorWorkload).length > 1 && (
          <div className="card card-padded" style={{ gridColumn: "1 / -1" }}>
            <div className="section-label" style={{ marginBottom: 10 }}>
              <i className="ti ti-table" style={{ marginRight: 4 }} />
              Doctor Comparison
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="tbl" style={{ minWidth: 480 }}>
                <thead>
                  <tr>
                    <th style={{ fontSize: "var(--font-xs)" }}>Doctor</th>
                    <th style={{ fontSize: "var(--font-xs)" }}>Seen</th>
                    <th style={{ fontSize: "var(--font-xs)" }}>Waiting</th>
                    <th style={{ fontSize: "var(--font-xs)" }}>In Consult</th>
                    <th style={{ fontSize: "var(--font-xs)" }}>Avg Consult</th>
                    <th style={{ fontSize: "var(--font-xs)" }}>% Done</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(doctorWorkload).map(([doc, w]) => {
                    const pct = w.appts > 0 ? Math.round((w.seen / w.appts) * 100) : 0;
                    return (
                      <tr key={doc}>
                        <td style={{ fontSize: "var(--font-xs)", fontWeight: 700 }}>{doc}</td>
                        <td style={{ fontSize: "var(--font-xs)", color: "var(--green)", fontWeight: 700 }}>{w.seen}</td>
                        <td style={{ fontSize: "var(--font-xs)", color: w.waiting >= 3 ? "var(--red)" : w.waiting >= 1 ? "var(--amber)" : "var(--muted)", fontWeight: 700 }}>{w.waiting}</td>
                        <td style={{ fontSize: "var(--font-xs)", color: w.inConsult > 0 ? "var(--purple)" : "var(--muted)", fontWeight: 700 }}>{w.inConsult}</td>
                        <td style={{ fontSize: "var(--font-xs)" }}>{w.avgConsultMin !== null ? `${w.avgConsultMin}m` : "—"}</td>
                        <td style={{ fontSize: "var(--font-xs)" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                            <div style={{ flex: 1, height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden", minWidth: 50 }}>
                              <div style={{ height: "100%", width: `${pct}%`, background: pct === 100 ? "var(--green)" : "var(--accent)", borderRadius: 3 }} />
                            </div>
                            <span style={{ fontWeight: 700, color: pct === 100 ? "var(--green)" : undefined }}>{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Recent Activity */}
        <div className="card card-padded">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
            <div className="section-label" style={{ margin: 0 }}>
              <i className="ti ti-activity" style={{ marginRight: 4 }} />
              Recent Activity
              <span style={{ marginLeft: 6, fontSize: "var(--font-xs)", color: "var(--muted)", fontWeight: 400 }}>{activityLog.length} entries</span>
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "2px 8px" }} title="Export activity as CSV" onClick={() => {
                const rows = [["timestamp","type","message","user"], ...activityLog.map(a => [a.timestamp, a.type, a.message, a.user])];
                const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,"''")}"`).join(",")).join("\n");
                const blob = new Blob([csv], { type: "text/csv" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `activity-${todayStr}.csv`; a.click();
                showFeedback("Activity exported as CSV.", "success");
                logActivity({ type: "file-deleted", message: "Activity log exported as CSV", user: userRole });
              }}><i className="ti ti-download" style={{ fontSize: 10 }} /></button>
              {activityLog.length > 0 && (
                <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "2px 8px", color: "var(--muted)" }}
                  onClick={() => { setShowClearActivity(true); setClearActivityConfirmText(""); }}>Clear</button>
              )}
            </div>
          </div>
          {/* Filter chips */}
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
            {(["all","queue","followup","task","alert","export"] as const).map(f => (
              <button key={f} onClick={() => setActivityFilter(f)} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 99, border: `1px solid ${activityFilter === f ? "var(--accent)" : "var(--border)"}`, background: activityFilter === f ? "var(--accent-soft)" : "var(--surface2)", color: activityFilter === f ? "var(--accent)" : "var(--muted)", cursor: "pointer", fontWeight: activityFilter === f ? 700 : 400 }}>
                {f === "all" ? "All" : f === "queue" ? "Queue" : f === "followup" ? "Follow-up" : f === "task" ? "Task" : f === "alert" ? "Alert" : "Export"}
              </button>
            ))}
          </div>
          {showClearActivity && (
            <div style={{ padding: "10px 12px", background: "var(--amber-bg)", borderRadius: "var(--radius)", marginBottom: 8, fontSize: "var(--font-xs)" }}>
              {activityLog.length > 10 ? (
                <>
                  Type <strong>CLEAR</strong> to confirm deleting {activityLog.length} entries:
                  <input type="text" value={clearActivityConfirmText} onChange={e => setClearActivityConfirmText(e.target.value)} placeholder="Type CLEAR" style={{ marginLeft: 8, fontSize: "var(--font-xs)", padding: "2px 6px", width: 80 }} />
                </>
              ) : "Clear all activity history?"}
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "3px 8px" }} onClick={() => { setShowClearActivity(false); setClearActivityConfirmText(""); }}>Cancel</button>
                <button className="btn btn-danger" style={{ fontSize: "var(--font-xs)", padding: "3px 8px", background: "var(--red)", color: "#fff" }}
                  disabled={activityLog.length > 10 && clearActivityConfirmText !== "CLEAR"}
                  onClick={() => {
                    setActivityLog([]); localStorage.removeItem(ACTIVITY_KEY); setShowClearActivity(false); setClearActivityConfirmText(""); showFeedback("Activity cleared.", "info");
                  }}>Clear All</button>
              </div>
            </div>
          )}
          <div style={{ maxHeight: 340, overflow: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
            {(() => {
              const filtered = useMemo(() => activityLog.filter(a => {
                if (activityFilter === "all") return true;
                const msg = a.message.toLowerCase();
                if (activityFilter === "queue") return ["checked in","waiting","with doctor","billing","no show","cancelled","prioritized","moved to"].some(k => msg.includes(k));
                if (activityFilter === "followup") return msg.includes("follow-up") || msg.includes("follow up") || msg.includes("rescheduled") || msg.includes("contacted");
                if (activityFilter === "task") return msg.includes("task");
                if (activityFilter === "alert") return msg.includes("alert") || msg.includes("acknowledged");
                if (activityFilter === "export") return msg.includes("export");
                return true;
              }), [activityLog, activityFilter]);
              if (filtered.length === 0) return <div style={{ textAlign: "center", padding: 16, color: "var(--muted)", fontSize: "var(--font-sm)" }}>{activityLog.length === 0 ? "No activity yet today." : "No activity matching this filter."}</div>;
              return filtered.map(activity => {
                const meta = ACTIVITY_META[activity.type] ?? { icon: "ti-dot", color: "var(--muted)" };
                const mins = Math.floor((Date.now() - new Date(activity.timestamp).getTime()) / 60_000);
                const timeAgo = mins < 1 ? "just now" : mins < 60 ? `${mins}m ago` : `${Math.floor(mins / 60)}h ago`;
                return (
                  <div key={activity.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "5px 0", borderBottom: "1px solid var(--border)" }}>
                    <div style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <i className={`ti ${meta.icon}`} style={{ fontSize: 12, color: meta.color }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "var(--font-xs)", lineHeight: 1.4 }}>{activity.message}</div>
                      <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginTop: 1 }}>
                        {activity.user} · {timeAgo}
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </div>

      {/* Tasks & Reminders — full width for admin (already shown in side panel for other roles) */}
      {hasRole(normalizedRole, ["admin"]) && (
        <TasksPanel tasks={tasks} updateTask={updateTask} deleteTask={deleteTask} setConfirmDelete={setConfirmDelete} setShowAddTask={setShowAddTask} setEditTaskModal={setEditTaskModal} userRole={userRole} onAction={onAction} fullWidth />
      )}

      {/* Clinic Day Checklist */}
      <div className="card card-padded" style={{ marginTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div className="section-label" style={{ margin: 0 }}>
            <i className="ti ti-list-check" style={{ marginRight: 4 }} />
            Clinic Day Checklist
            <span style={{ marginLeft: 6, fontSize: "var(--font-xs)", color: "var(--muted)", fontWeight: 400 }}>
              {checklist.filter(c => c.done).length}/{checklist.length} done
            </span>
          </div>
          <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "2px 8px" }} onClick={() => {
            const reset = checklist.map(c => c.custom ? c : { ...c, done: false });
            saveChecklist(reset); showFeedback("Checklist reset.", "info");
          }}>Reset</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
          {checklist.map(item => (
            <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: "var(--radius)", background: item.done ? "var(--surface2)" : "var(--surface)" }}>
              <input type="checkbox" checked={item.done} onChange={() => { const next = checklist.map(c => c.id === item.id ? { ...c, done: !c.done } : c); saveChecklist(next); }} style={{ cursor: "pointer" }} />
              <span style={{ flex: 1, fontSize: "var(--font-sm)", textDecoration: item.done ? "line-through" : undefined, color: item.done ? "var(--muted)" : undefined }}>{item.label}</span>
              {item.custom && (
                <button className="btn-icon" style={{ fontSize: 11 }} title="Remove item" onClick={() => { const next = checklist.filter(c => c.id !== item.id); saveChecklist(next); }}>
                  <i className="ti ti-x" />
                </button>
              )}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <input type="text" value={newChecklistItem} onChange={e => setNewChecklistItem(e.target.value)} placeholder="Add custom item…" style={{ flex: 1, fontSize: "var(--font-xs)", padding: "4px 8px" }}
            onKeyDown={e => { if (e.key === "Enter" && newChecklistItem.trim()) { saveChecklist([...checklist, { id: `cl-custom-${Date.now()}`, label: newChecklistItem.trim(), done: false, custom: true }]); setNewChecklistItem(""); } }} />
          <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "4px 10px" }} onClick={() => {
            if (!newChecklistItem.trim()) return;
            saveChecklist([...checklist, { id: `cl-custom-${Date.now()}`, label: newChecklistItem.trim(), done: false, custom: true }]);
            setNewChecklistItem("");
          }}><i className="ti ti-plus" /></button>
        </div>
      </div>

      {/* System / Data Status */}
      <div className="card card-padded" style={{ marginTop: 12 }}>
        <div className="section-label" style={{ marginBottom: 8 }}>
          <i className="ti ti-server" style={{ marginRight: 4 }} />
          System Status
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: "var(--font-xs)", color: "var(--muted)" }}>
          <span><strong style={{ color: "var(--fg)" }}>{patients.length}</strong> patients</span>
          <span><strong style={{ color: "var(--fg)" }}>{tasks.length}</strong> tasks</span>
          <span><strong style={{ color: "var(--fg)" }}>{activityLog.length}</strong> activity entries</span>
          <span>Last activity: <strong style={{ color: "var(--fg)" }}>{activityLog[0] ? (() => { const m = Math.floor((Date.now() - new Date(activityLog[0].timestamp).getTime()) / 60_000); return m < 1 ? "just now" : m < 60 ? `${m}m ago` : `${Math.floor(m/60)}h ago`; })() : "—"}</strong></span>
          <span>Storage: <strong style={{ color: "var(--green)" }}>localStorage</strong></span>
          <span>Role: <strong style={{ color: "var(--accent)" }}>{userRole}</strong></span>
        </div>
      </div>
    </div>
  );
}

function OverviewCard({ label, value, color, icon }: {
  label: string;
  value: string | number;
  color: string;
  icon: string;
}) {
  return (
    <div className="card card-padded" style={{ textAlign: "center" }}>
      <i className={`ti ${icon}`} style={{ fontSize: 16, color, marginBottom: 4 }} />
      <div style={{ fontSize: "var(--font-xl)", fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{label}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: QueueStatus }) {
  const colors: Record<QueueStatus, { bg: string; color: string; border: string }> = {
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
      {status.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
    </span>
  );
}



function TasksPanel({
  tasks,
  updateTask,
  deleteTask,
  setConfirmDelete,
  setShowAddTask,
  setEditTaskModal,
  userRole,
  fullWidth,
  onAction,
}: {
  tasks: ClinicTask[];
  updateTask: (id: string, status: TaskStatus) => void;
  deleteTask?: (id: string) => void;
  setConfirmDelete?: (v: { id: string; label: string } | null) => void;
  setShowAddTask?: (v: boolean) => void;
  setEditTaskModal?: (v: ClinicTask | null) => void;
  userRole: "receptionist" | "doctor" | "admin";
  fullWidth?: boolean;
  onAction?: (actionId: string) => void;
}) {

  const [panelFilter, setPanelFilter] = useState<"all"|"pending"|"in-progress"|"done"|"urgent"|"myrole">("all");
  const [confirmClearCompleted, setConfirmClearCompleted] = useState(false);
  const todayISO = new Date().toISOString().split("T")[0];

  const visibleTasks = useMemo(() => {
    let list = tasks;
    if (userRole === "doctor") list = tasks.filter(t => t.assignedTo.toLowerCase().includes("dr"));
    else if (userRole === "receptionist") list = tasks.filter(t => !t.assignedTo.toLowerCase().includes("dr"));
    if (panelFilter === "pending") list = list.filter(t => t.status === "pending");
    else if (panelFilter === "in-progress") list = list.filter(t => t.status === "in-progress");
    else if (panelFilter === "done") list = list.filter(t => t.status === "done");
    else if (panelFilter === "urgent") list = list.filter(t => t.priority === "urgent" || t.priority === "high");
    else if (panelFilter === "myrole") list = list.filter(t => userRole === "doctor" ? t.assignedTo.toLowerCase().includes("dr") : !t.assignedTo.toLowerCase().includes("dr"));
    const order = { urgent: 0, high: 1, medium: 2, low: 3 };
    return [...list].sort((a, b) => {
      if (a.status !== b.status) return a.status === "done" ? 1 : b.status === "done" ? -1 : 0;
      return order[a.priority] - order[b.priority];
    });
  }, [tasks, userRole, panelFilter]);

  const { pendingCount, doneCount, urgentCount } = useMemo(() => ({
    pendingCount: tasks.filter(t => t.status !== "done").length,
    doneCount: tasks.filter(t => t.status === "done").length,
    urgentCount: tasks.filter(t => t.priority === "urgent" && t.status !== "done").length,
  }), [tasks]);

  return (
    <div className="card card-padded" style={fullWidth ? { marginTop: 16 } : undefined}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div className="section-label" style={{ margin: 0 }}>
          <i className="ti ti-checklist" style={{ marginRight: 4 }} />
          Tasks &amp; Reminders
          <span style={{ marginLeft: 6, fontWeight: 400, color: "var(--muted)", fontSize: "var(--font-xs)" }}>
            {pendingCount} open · {doneCount} done{urgentCount > 0 ? ` · ` : ""}
            {urgentCount > 0 && <span style={{ color: "var(--red)", fontWeight: 700 }}>{urgentCount} urgent</span>}
          </span>
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {doneCount > 0 && (
            <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "3px 8px", color: "var(--muted)" }} title="Clear completed tasks" onClick={() => setConfirmClearCompleted(true)}>
              Clear Done
            </button>
          )}
          {setShowAddTask && (
            <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "4px 10px" }} onClick={() => setShowAddTask(true)}>
              <i className="ti ti-plus" style={{ fontSize: 11, marginRight: 3 }} />Add Task
            </button>
          )}
        </div>
      </div>
      {/* Filter chips */}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
        {(["all","pending","in-progress","done","urgent","myrole"] as const).map(f => (
          <button key={f} onClick={() => setPanelFilter(f)} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 99, border: `1px solid ${panelFilter === f ? "var(--accent)" : "var(--border)"}`, background: panelFilter === f ? "var(--accent-soft)" : "var(--surface2)", color: panelFilter === f ? "var(--accent)" : "var(--muted)", cursor: "pointer", fontWeight: panelFilter === f ? 700 : 400 }}>
            {f === "all" ? "All" : f === "pending" ? "Pending" : f === "in-progress" ? "In Progress" : f === "done" ? "Done" : f === "urgent" ? "Urgent/High" : "My Role"}
          </button>
        ))}
      </div>
      {confirmClearCompleted && (
        <div style={{ padding: "8px 10px", background: "var(--amber-bg)", border: "1px solid var(--amber-border)", borderRadius: "var(--radius)", marginBottom: 8, fontSize: "var(--font-xs)" }}>
          Remove all {doneCount} completed task{doneCount !== 1 ? "s" : ""}?
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "3px 8px" }} onClick={() => setConfirmClearCompleted(false)}>Cancel</button>
            <button className="btn btn-danger" style={{ fontSize: "var(--font-xs)", padding: "3px 8px", background: "var(--red)", color: "#fff" }} onClick={() => {
              tasks.filter(t => t.status === "done").forEach(t => deleteTask?.(t.id));
              setConfirmClearCompleted(false);
            }}>Clear Done</button>
          </div>
        </div>
      )}
      <div className={fullWidth ? "cd-tasks-grid" : undefined} style={{ maxHeight: fullWidth ? 320 : 360, overflow: "auto", display: fullWidth ? undefined : "flex", flexDirection: fullWidth ? undefined : "column", gap: 8 }}>
        {visibleTasks.length === 0 ? (
          <div style={{ textAlign: "center", padding: 20, color: "var(--muted)", fontSize: "var(--font-sm)" }}>
            <i className="ti ti-circle-check" style={{ fontSize: 20, color: "var(--green)", display: "block", marginBottom: 4 }} />
            {panelFilter === "all" ? (
              <>No tasks — all clear.{setShowAddTask && <><br /><button className="btn btn-ghost" style={{ marginTop: 8, fontSize: "var(--font-xs)" }} onClick={() => setShowAddTask(true)}>Add a task</button></>}</>
            ) : `No ${panelFilter} tasks.`}
          </div>
        ) : visibleTasks.map(t => {
          const meta = CATEGORY_META[t.category];
          const isDone = t.status === "done";
          const isOverdue = !isDone && t.dueTime && t.dueTime < todayISO;
          return (
            <div key={t.id} style={{
              padding: "8px 10px", borderRadius: "var(--radius)",
              border: `1px solid ${isOverdue ? "var(--red-border)" : "var(--border)"}`,
              background: isDone ? "var(--surface2)" : isOverdue ? "var(--red-bg)" : "var(--surface)",
              opacity: isDone ? 0.6 : 1,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                <i className={`ti ${meta.icon}`} style={{ fontSize: 13, color: PRIORITY_COLOR[t.priority], flexShrink: 0 }} />
                <span style={{ fontSize: "var(--font-sm)", fontWeight: 700, flex: 1 }}>{t.title}</span>
                {isOverdue && <span style={{ fontSize: 10, color: "var(--red)", fontWeight: 700 }}>OVERDUE</span>}
                <span style={{ fontSize: "var(--font-xs)", fontWeight: 700, color: PRIORITY_COLOR[t.priority] }}>{t.priority.toUpperCase()}</span>
              </div>
              <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginBottom: 5, lineHeight: 1.5 }}>
                {meta.label}
                <span style={{ margin: "0 4px" }}>·</span>
                Assigned: <strong style={{ color: "var(--fg)" }}>{t.assignedTo}</strong>
                <span style={{ margin: "0 4px" }}>·</span>
                Due <span style={{ color: isOverdue ? "var(--red)" : undefined, fontWeight: isOverdue ? 700 : undefined }}>{t.dueTime}</span>
                {t.patientName && (
                  <>
                    <span style={{ margin: "0 4px" }}>·</span>
                    <button onClick={() => {
                      if (!canOpenPatientProfile) {
                        handleDeniedAccess("view", "patient profile");
                        return;
                      }
                      onAction?.(`view-patient:${t.patientId}`);
                    }} style={{ color: "var(--accent)", background: "none", border: "none", padding: 0, font: "inherit", cursor: "pointer" }}>
                      {t.patientName}
                    </button>
                  </>
                )}
                <span style={{ margin: "0 4px" }}>·</span>
                <span style={{ color: STATUS_COLOR[t.status], fontWeight: 600 }}>● {t.status.replace("-", " ")}</span>
              </div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {!isDone && t.status === "pending" && (
                  <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "5px 10px", minHeight: 32 }} onClick={() => updateTask(t.id, "in-progress")}>
                    <i className="ti ti-player-play" style={{ marginRight: 2, fontSize: 10 }} />Start
                  </button>
                )}
                {!isDone && (
                  <button className="btn btn-primary" style={{ fontSize: "var(--font-xs)", padding: "5px 10px", minHeight: 32 }} onClick={() => updateTask(t.id, "done")}>
                    <i className="ti ti-circle-check" style={{ marginRight: 2, fontSize: 10 }} />Done
                  </button>
                )}
                {isDone && (
                  <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "5px 10px", minHeight: 32 }} onClick={() => updateTask(t.id, "pending")}>
                    <i className="ti ti-refresh" style={{ marginRight: 2, fontSize: 10 }} />Reopen
                  </button>
                )}
                {setEditTaskModal && (
                  <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "5px 10px", minHeight: 32 }} title="Edit task" onClick={() => setEditTaskModal(t)}>
                    <i className="ti ti-pencil" style={{ fontSize: 10 }} />
                  </button>
                )}
                {setShowAddTask && (
                  <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "5px 10px", minHeight: 32 }} title="Duplicate task" onClick={() => {
                    // Trigger addTask equivalent via parent setShowAddTask — but we don't have addTask here.
                    // Use deleteTask pattern: signal via a synthetic localStorage write.
                    const dup: ClinicTask = { ...t, id: `task-dup-${Date.now()}`, status: "pending", title: `[Copy] ${t.title}` };
                    const TASKS_KEY = "clinic_crm_dashboard_tasks";
                    try {
                      const saved: ClinicTask[] = JSON.parse(localStorage.getItem(TASKS_KEY) || "[]");
                      const next = [...saved, dup];
                      localStorage.setItem(TASKS_KEY, JSON.stringify(next));
                      // Force re-render by toggling a phantom task then deleting it — simplest: update via updateTask noop
                      // Actually trigger a real re-render by calling deleteTask with a fake id then reverting — no.
                      // Simplest: dispatch a storage event.
                      window.dispatchEvent(new Event("storage"));
                    } catch { /* ignore */ }
                  }}>
                    <i className="ti ti-copy" style={{ fontSize: 10 }} />
                  </button>
                )}
                {setConfirmDelete && (
                  <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "5px 10px", minHeight: 32, color: "var(--red)" }} title="Delete task" onClick={() => setConfirmDelete({ id: t.id, label: t.title })}>
                    <i className="ti ti-trash" style={{ fontSize: 10 }} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function QueueActions({
  status,
  onTransition,
  onNoShow,
  onCancel,
  userRole = "admin",
}: {
  status: QueueStatus;
  onTransition: (next: QueueStatus) => void;
  onNoShow: () => void;
  onCancel: () => void;
  userRole?: "receptionist" | "doctor" | "admin";
}) {
  const next = NEXT_STATUS[status];
  const btnSm: React.CSSProperties = { fontSize: "var(--font-xs)", padding: "5px 10px", minHeight: 32 };

  // Role-based permissions - using normalizedRole for consistency
  const normalizedUser = normalizeRole(userRole) as "admin" | "doctor" | "nurse" | "receptionist" | "billing" | "auditor" | "readonly";
  const canCheckIn = hasRole(normalizedUser, ["admin", "receptionist"]);
  const canStartConsult = hasRole(normalizedUser, ["admin", "doctor"]);
  const canSendToBilling = hasRole(normalizedUser, ["admin", "receptionist"]);
  const canMarkPaid = hasRole(normalizedUser, ["admin", "receptionist"]);
  const canNoShow = hasRole(normalizedUser, ["admin", "receptionist"]);
  const canCancel = hasRole(normalizedUser, ["admin", "receptionist"]);
  const canReschedule = hasRole(normalizedUser, ["admin", "receptionist"]);

  // Permission check for forward action
  const canDoForward = (() => {
    if (status === "scheduled") return canCheckIn;
    if (status === "checked-in" || status === "waiting") return canStartConsult;
    if (status === "with-doctor") return canSendToBilling;
    if (status === "billing-pending") return canMarkPaid;
    if (status === "no-show") return canReschedule;
    return true;
  })();

  if (status === "completed") {
    return <span style={{ fontSize: "var(--font-xs)", color: "var(--green)", fontWeight: 700 }}>✓ Done</span>;
  }
  if (status === "cancelled") {
    return <span style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>—</span>;
  }

  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "nowrap" }}>
      {next && FORWARD_LABEL[status] && canDoForward && (
        <button
          className="btn btn-primary"
          style={btnSm}
          onClick={() => onTransition(next)}
          disabled={!canDoForward}
          title={!canDoForward ? "Your role doesn't have permission for this action" : undefined}
        >
          {FORWARD_LABEL[status]}
        </button>
      )}
      {(status === "scheduled" || status === "checked-in" || status === "waiting") && (
        <button 
          className="btn btn-ghost" 
          style={{ ...btnSm, color: "var(--amber)" }} 
          onClick={onNoShow}
          disabled={!canNoShow}
          title={!canNoShow ? "Only receptionists and admins can mark no-show" : undefined}
        >
          No Show
        </button>
      )}
      {status !== "no-show" && (
        <button 
          className="btn btn-ghost" 
          style={{ ...btnSm, color: "var(--red)" }} 
          onClick={onCancel}
          disabled={!canCancel}
          title={!canCancel ? "Only receptionists and admins can cancel" : undefined}
        >
          Cancel
        </button>
      )}
    </div>
  );
}
