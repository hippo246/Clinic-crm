import React, { useState, useMemo, useCallback, useEffect } from "react";
import type { Patient } from "./types";
import { fmtDate, getPatientStats } from "./utils";

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
}
export default function Dashboard({ patients, userRole = "admin", onAction, onUpdatePatient }: { patients: Patient[]; userRole?: "receptionist" | "doctor" | "admin"; onAction?: (actionId: string) => void; onUpdatePatient?: (updated: Patient, action?: string) => void }) {
  const stats = getPatientStats(patients);
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  // Tick every 60 s so waiting times stay current
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // Base queue derived from patients prop — recognizes every status in QUEUE_TO_PATIENT_STATUS
  // so a persisted status always round-trips correctly, even if local statusOverrides resets (e.g. on reload)
  const baseQueue = useMemo(() => {
    const todayAppointments = patients.filter(p => {
      if (!p.nextAppointment) return false;
      return new Date(p.nextAppointment).toISOString().split("T")[0] === todayStr;
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
  }, [todayStr, patients]);

  // Live queue: status overrides live here, waiting times refresh on tick
  const [statusOverrides, setStatusOverrides] = useState<Record<string, QueueStatus>>({});

  // Consultation timing — captures when a patient enters/exits "with-doctor" so we can compute average consult time per doctor
  const [consultTimes, setConsultTimes] = useState<Record<string, { startedAt?: number; endedAt?: number; doctor: string }>>({});

  const queuePatients: QueuePatient[] = useMemo(() => {
    return baseQueue.map(q => {
      const appointmentTime = new Date(q.patient.nextAppointment!);
      const waitingTime = Math.max(0, Math.floor((Date.now() - appointmentTime.getTime()) / (1000 * 60)));
      return {
        ...q,
        waitingTime,
        status: statusOverrides[q.id] ?? q.status,
      };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseQueue, statusOverrides, tick]);

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
    setConsultTimes(prev => {
      const existing = prev[id];
      if (next === "with-doctor") {
        // Entering consultation — record start time
        return { ...prev, [id]: { ...existing, doctor, startedAt: Date.now() } };
      }
      if (existing?.startedAt && !existing.endedAt && (next === "billing-pending" || next === "completed")) {
        // Leaving consultation — record end time, so duration can be computed
        return { ...prev, [id]: { ...existing, endedAt: Date.now() } };
      }
      return prev;
    });
  }, [persistStatus]);

  const markNoShow = useCallback((id: string) => {
    setStatusOverrides(prev => ({ ...prev, [id]: "no-show" }));
    persistStatus(id, "no-show");
  }, [persistStatus]);

  const markCancelled = useCallback((id: string) => {
    setStatusOverrides(prev => ({ ...prev, [id]: "cancelled" }));
    persistStatus(id, "cancelled");
  }, [persistStatus]);

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
  }, [todayStr]);

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

  const [taskOverrides, setTaskOverrides] = useState<Record<string, TaskStatus>>({});
  const tasks: ClinicTask[] = useMemo(() =>
    seedTasks.map(t => ({ ...t, status: taskOverrides[t.id] ?? t.status })),
    [seedTasks, taskOverrides]
  );
  const updateTask = useCallback((id: string, status: TaskStatus) => {
    setTaskOverrides(prev => ({ ...prev, [id]: status }));
  }, []);

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

  const checkedIn = queuePatients.filter(q => q.status === "checked-in").length;
  const waiting = queuePatients.filter(q => q.status === "waiting").length;
  const inConsultation = queuePatients.filter(q => q.status === "with-doctor").length;
  const completed = queuePatients.filter(q => q.status === "completed").length;
  const noShows = queuePatients.filter(q => q.status === "no-show").length;
  const followUpsDone = followUps.filter(f => f.status === "completed").length;

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
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div className="cd-header-row">
          <div>
            <h1 style={{ fontSize: "var(--font-xl)", fontWeight: 800, margin: 0 }}>
              {userRole === "receptionist" ? "Receptionist Dashboard" : userRole === "doctor" ? "Doctor Dashboard" : "Admin Dashboard"}
            </h1>
            <div style={{ fontSize: "var(--font-sm)", color: "var(--muted)", marginTop: 2 }}>
              {today.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </div>
          </div>
          {/* Quick Actions button bar */}
          <div className="cd-quick-actions">
            {quickActions.map(action => (
              <button key={action.id} className="btn btn-primary" style={{ fontSize: "var(--font-xs)", padding: "6px 12px", display: "flex", alignItems: "center", gap: 5 }}
                onClick={() => onAction?.(action.id)}>
                <i className={`ti ${action.icon}`} style={{ fontSize: 13 }} />
                {action.label}
              </button>
            ))}
          </div>
        </div>
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
      {userRole !== "doctor" && (
        <div className="cd-grid-4">
          <OverviewCard label="Checked In"     value={checkedIn}       color="var(--green)"  icon="ti-login" />
          <OverviewCard label="In Consultation" value={inConsultation}  color="var(--purple)" icon="ti-stethoscope" />
          <OverviewCard label="No Shows"        value={noShows}         color="var(--red)"    icon="ti-circle-x" />
          <OverviewCard label="Follow-ups Done" value={followUpsDone}   color="var(--green)"  icon="ti-phone-check" />
        </div>
      )}
      {/* Doctor-specific secondary row */}
      {userRole === "doctor" && (
        <div className="cd-grid-4">
          <OverviewCard label="In Consultation" value={inConsultation}                                  color="var(--purple)" icon="ti-stethoscope" />
          <OverviewCard label="Checked In"      value={checkedIn}                                       color="var(--green)"  icon="ti-login" />
          <OverviewCard label="Pending Notes"   value={tasks.filter(t => t.category === "pending-note" && t.status !== "done").length} color="var(--amber)" icon="ti-notes" />
          <OverviewCard label="Pending Rx"      value={tasks.filter(t => t.category === "send-prescription" && t.status !== "done").length} color="var(--blue)" icon="ti-pill" />
        </div>
      )}

      <div className="cd-grid-2-1">
        {/* Live Queue / Waiting Room */}
        <div className="card card-padded">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div className="section-label" style={{ margin: 0 }}>
              <i className="ti ti-users-group" style={{ marginRight: 4 }} />
              Live Queue / Waiting Room
              <span style={{ marginLeft: 8, fontWeight: 400, color: "var(--muted)" }}>
                {queuePatients.filter(q => !["completed","cancelled","no-show"].includes(q.status)).length} active
              </span>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", maxWidth: "100%" }}>
              {queuePatients.filter(q => q.status === "with-doctor").map(q => (
                <span key={q.id} style={{
                  fontSize: "var(--font-xs)", padding: "2px 10px",
                  background: "var(--purple-bg)", color: "var(--purple)",
                  border: "1px solid var(--purple-border)", borderRadius: 99, fontWeight: 600
                }}>
                  🩺 {q.patient.name} with {q.doctor.replace(/^Dr\.\s*/i, "Dr. ")}
                </span>
              ))}
              {(() => {
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
          <div style={{ overflowX: "auto", maxHeight: 400, WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
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
                  <tr><td colSpan={8}><div className="empty-state"><div className="empty-state-sub">No patients in queue today</div></div></td></tr>
                ) : queuePatients.map(q => {
                  const isLong = q.waitingTime >= 30 && (q.status === "waiting" || q.status === "checked-in");
                  return (
                  <tr key={q.id} className="tbl-row" style={isLong ? { background: "var(--amber-bg)" } : undefined}>
                    <td style={{ fontSize: "var(--font-sm)", fontWeight: 700 }}>#{q.tokenNo}</td>
                    <td>
                      <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{q.patient.name}</div>
                      <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{q.patient.id}</div>
                    </td>
                    <td style={{ fontSize: "var(--font-sm)" }}>{q.appointmentTime}</td>
                    <td style={{ fontSize: "var(--font-sm)" }} className="cd-col-hide-mobile">{q.doctor}</td>
                    <td style={{ fontSize: "var(--font-sm)" }} className="cd-col-hide-mobile">{q.visitType}</td>
                    <td><StatusBadge status={q.status} /></td>
                    <td style={{ fontSize: "var(--font-sm)", color: isLong ? "var(--amber)" : undefined, fontWeight: isLong ? 700 : undefined }}>
                      {q.waitingTime}m
                    </td>
                    <td>
                      <QueueActions
                        status={q.status}
                        onTransition={next => transitionStatus(q.id, next, q.doctor)}
                        onNoShow={() => markNoShow(q.id)}
                        onCancel={() => markCancelled(q.id)}
                      />
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Critical Alerts & Follow-ups */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Critical Patient Alerts */}
          <div className="card card-padded">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div className="section-label" style={{ color: "var(--red)", margin: 0 }}>
                <i className="ti ti-alert-triangle" style={{ marginRight: 4 }} />
                Critical Alerts
                <span style={{ marginLeft: 6, fontWeight: 400, color: "var(--muted)", fontSize: "var(--font-xs)" }}>
                  {criticalAlerts.filter(a => a.severity === "critical").length} critical · {criticalAlerts.filter(a => a.severity === "high").length} high
                </span>
              </div>
              {criticalAlerts.length > 0 && (
                <span style={{ fontSize: "var(--font-xs)", color: "var(--red)", fontWeight: 700, background: "var(--red-bg)", padding: "1px 8px", borderRadius: 99, border: "1px solid var(--red-border)" }}>
                  {criticalAlerts.length} need attention
                </span>
              )}
            </div>
            <div style={{ maxHeight: 280, overflow: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
              {criticalAlerts.length === 0 ? (
                <div style={{ textAlign: "center", padding: 20, color: "var(--muted)", fontSize: "var(--font-sm)" }}>
                  <i className="ti ti-circle-check" style={{ fontSize: 20, color: "var(--green)", display: "block", marginBottom: 4 }} />
                  No critical alerts
                </div>
              ) : criticalAlerts.map(alert => {
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
                    <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "1px 6px", flexShrink: 0 }} onClick={() => onAction?.(`view-patient:${alert.patient.id}`)}>View</button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Follow-up Center */}
          <div className="card card-padded">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div className="section-label" style={{ color: "var(--amber)", margin: 0 }}>
                <i className="ti ti-phone-exclamation" style={{ marginRight: 4 }} />
                Follow-up Center
                <span style={{ marginLeft: 6, fontWeight: 400, color: "var(--muted)", fontSize: "var(--font-xs)" }}>
                  {followUps.filter(f => f.status !== "completed").length} pending
                </span>
              </div>
            </div>
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
                    return (
                      <div key={f.id} style={{
                        padding: "8px 10px", borderRadius: "var(--radius)", border: "1px solid var(--border)",
                        background: isClosed ? "var(--surface2)" : "var(--surface)",
                        opacity: isClosed ? 0.6 : 1,
                      }}>
                        {/* Row 1: name + priority + status */}
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                          <span style={{ fontSize: "var(--font-sm)", fontWeight: 700, flex: 1 }}>{f.patient.name}</span>
                          <span style={{ fontSize: "var(--font-xs)", fontWeight: 700, color: prioColor[f.priority] }}>{f.priority.toUpperCase()}</span>
                          <span style={{ fontSize: "var(--font-xs)", color: statusColor[f.status], fontWeight: 600 }}>● {f.status.replace("-", " ")}</span>
                        </div>
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
                            <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "5px 10px", minHeight: 32 }}
                              onClick={() => updateFollowUp(f.id, "in-progress", `Called ${new Date().toLocaleDateString()}`)}>
                              <i className="ti ti-phone" style={{ marginRight: 2, fontSize: 10 }} />Call
                            </button>
                            <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "5px 10px", minHeight: 32 }} onClick={() => onAction?.(`message-patient:${f.patient.id}`)}>
                              <i className="ti ti-message" style={{ marginRight: 2, fontSize: 10 }} />Message
                            </button>
                            <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "5px 10px", minHeight: 32 }}
                              onClick={() => updateFollowUp(f.id, "in-progress", `Called ${new Date().toLocaleDateString()}`)}>
                              <i className="ti ti-check" style={{ marginRight: 2, fontSize: 10 }} />Mark Called
                            </button>
                            <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "5px 10px", minHeight: 32 }} onClick={() => onAction?.(`schedule-followup:${f.patient.id}`)}>
                              <i className="ti ti-calendar-plus" style={{ marginRight: 2, fontSize: 10 }} />Schedule
                            </button>
                            <button className="btn btn-primary" style={{ fontSize: "var(--font-xs)", padding: "5px 10px", minHeight: 32 }}
                              onClick={() => updateFollowUp(f.id, "completed", `Completed ${new Date().toLocaleDateString()}`)}>
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
          </div>
        </div>
      </div>

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
        <div className="card card-padded">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div className="section-label" style={{ margin: 0 }}>
              <i className="ti ti-receipt" style={{ marginRight: 4 }} />
              Billing Snapshot
              <span style={{ marginLeft: 6, color: "var(--muted)", fontWeight: 400, fontSize: "var(--font-xs)" }}>Today</span>
            </div>
            {revenue.pendingCount > 0 && (
              <span style={{ fontSize: "var(--font-xs)", color: "var(--amber)", fontWeight: 700, background: "var(--amber-bg)", padding: "1px 8px", borderRadius: 99, border: "1px solid var(--amber-border)" }}>
                {revenue.pendingCount} unpaid invoice{revenue.pendingCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>
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
            <button className="btn btn-primary" style={{ fontSize: "var(--font-xs)", minHeight: 36 }} onClick={() => onAction?.("create-invoice")}><i className="ti ti-plus" style={{ marginRight: 4, fontSize: 11 }} />Create Invoice</button>
            <button className="btn btn-ghost"   style={{ fontSize: "var(--font-xs)", minHeight: 36 }} onClick={() => onAction?.("collect-payment")}><i className="ti ti-cash" style={{ marginRight: 4, fontSize: 11 }} />Collect Payment</button>
            <button className="btn btn-ghost"   style={{ fontSize: "var(--font-xs)", minHeight: 36 }} onClick={() => onAction?.("pending-bills")}><i className="ti ti-list" style={{ marginRight: 4, fontSize: 11 }} />Pending Bills</button>
            <button className="btn btn-ghost"   style={{ fontSize: "var(--font-xs)", minHeight: 36 }} onClick={() => onAction?.("print-receipt")}><i className="ti ti-printer" style={{ marginRight: 4, fontSize: 11 }} />Print Receipt</button>
          </div>
        </div>

        {/* Doctor / Staff Workload — admin only */}
        {userRole === "admin" ? (
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
                        {isOverloaded && <span style={{ fontSize: "var(--font-xs)", color: "var(--amber)", fontWeight: 700 }}>⚠ Overloaded</span>}
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
          <TasksPanel tasks={tasks} updateTask={updateTask} userRole={userRole} onAction={onAction} />
        )}

        {/* Recent Activity */}
        <div className="card card-padded">
          <div className="section-label" style={{ marginBottom: 10 }}>
            <i className="ti ti-activity" style={{ marginRight: 4 }} />
            Recent Activity
          </div>
          <div style={{ maxHeight: 340, overflow: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
            {recentActivity.map(activity => {
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
              const meta = ACTIVITY_META[activity.type];
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
            })}
          </div>
        </div>
      </div>

      {/* Tasks & Reminders — full width for admin (already shown in side panel for other roles) */}
      {userRole === "admin" && (
        <TasksPanel tasks={tasks} updateTask={updateTask} userRole={userRole} onAction={onAction} fullWidth />
      )}
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
  userRole,
  fullWidth,
  onAction,
}: {
  tasks: ClinicTask[];
  updateTask: (id: string, status: TaskStatus) => void;
  userRole: "receptionist" | "doctor" | "admin";
  fullWidth?: boolean;
  onAction?: (actionId: string) => void;
}) {
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

  // Tasks relevant to this role: receptionist/doctor see only their own assignments, admin sees all
  const visibleTasks = useMemo(() => {
    let list = tasks;
    if (userRole === "doctor") {
      list = tasks.filter(t => t.assignedTo.toLowerCase().includes("dr"));
    } else if (userRole === "receptionist") {
      list = tasks.filter(t => !t.assignedTo.toLowerCase().includes("dr"));
    }
    const order = { urgent: 0, high: 1, medium: 2, low: 3 };
    return [...list].sort((a, b) => {
      if (a.status !== b.status) return a.status === "done" ? 1 : b.status === "done" ? -1 : 0;
      return order[a.priority] - order[b.priority];
    });
  }, [tasks, userRole]);

  const pendingCount = visibleTasks.filter(t => t.status !== "done").length;

  return (
    <div className="card card-padded" style={fullWidth ? { marginTop: 16 } : undefined}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div className="section-label" style={{ margin: 0 }}>
          <i className="ti ti-checklist" style={{ marginRight: 4 }} />
          Tasks &amp; Reminders
          <span style={{ marginLeft: 6, fontWeight: 400, color: "var(--muted)", fontSize: "var(--font-xs)" }}>
            {pendingCount} open
          </span>
        </div>
        {pendingCount > 0 && (
          <span style={{ fontSize: "var(--font-xs)", color: "var(--amber)", fontWeight: 700, background: "var(--amber-bg)", padding: "1px 8px", borderRadius: 99, border: "1px solid var(--amber-border)" }}>
            {pendingCount} pending
          </span>
        )}
      </div>
      <div className={fullWidth ? "cd-tasks-grid" : undefined} style={{ maxHeight: fullWidth ? 280 : 340, overflow: "auto", display: fullWidth ? undefined : "flex", flexDirection: fullWidth ? undefined : "column", gap: 8 }}>
        {visibleTasks.length === 0 ? (
          <div style={{ textAlign: "center", padding: 20, color: "var(--muted)", fontSize: "var(--font-sm)" }}>
            <i className="ti ti-circle-check" style={{ fontSize: 20, color: "var(--green)", display: "block", marginBottom: 4 }} />
            No tasks — all clear
          </div>
        ) : visibleTasks.map(t => {
          const meta = CATEGORY_META[t.category];
          const isDone = t.status === "done";
          return (
            <div key={t.id} style={{
              padding: "8px 10px", borderRadius: "var(--radius)", border: "1px solid var(--border)",
              background: isDone ? "var(--surface2)" : "var(--surface)",
              opacity: isDone ? 0.6 : 1,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                <i className={`ti ${meta.icon}`} style={{ fontSize: 13, color: PRIORITY_COLOR[t.priority], flexShrink: 0 }} />
                <span style={{ fontSize: "var(--font-sm)", fontWeight: 700, flex: 1 }}>{t.title}</span>
                <span style={{ fontSize: "var(--font-xs)", fontWeight: 700, color: PRIORITY_COLOR[t.priority] }}>{t.priority.toUpperCase()}</span>
              </div>
              <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginBottom: 5, lineHeight: 1.5 }}>
                {meta.label}
                <span style={{ margin: "0 4px" }}>·</span>
                Assigned: <strong style={{ color: "var(--fg)" }}>{t.assignedTo}</strong>
                <span style={{ margin: "0 4px" }}>·</span>
                Due {t.dueTime}
                {t.patientName && (
                  <>
                    <span style={{ margin: "0 4px" }}>·</span>
                    <button
                      onClick={() => onAction?.(`view-patient:${t.patientId}`)}
                      style={{ color: "var(--accent)", textDecoration: "none", background: "none", border: "none", padding: 0, font: "inherit", cursor: "pointer" }}
                    >
                      {t.patientName}
                    </button>
                  </>
                )}
                <span style={{ margin: "0 4px" }}>·</span>
                <span style={{ color: STATUS_COLOR[t.status], fontWeight: 600 }}>● {t.status.replace("-", " ")}</span>
              </div>
              {!isDone && (
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {t.status === "pending" && (
                    <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "5px 10px", minHeight: 32 }}
                      onClick={() => updateTask(t.id, "in-progress")}>
                      <i className="ti ti-player-play" style={{ marginRight: 2, fontSize: 10 }} />Start
                    </button>
                  )}
                  <button className="btn btn-primary" style={{ fontSize: "var(--font-xs)", padding: "5px 10px", minHeight: 32 }}
                    onClick={() => updateTask(t.id, "done")}>
                    <i className="ti ti-circle-check" style={{ marginRight: 2, fontSize: 10 }} />Mark Done
                  </button>
                </div>
              )}
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
}: {
  status: QueueStatus;
  onTransition: (next: QueueStatus) => void;
  onNoShow: () => void;
  onCancel: () => void;
}) {
  const next = NEXT_STATUS[status];
  const btnSm: React.CSSProperties = { fontSize: "var(--font-xs)", padding: "5px 10px", minHeight: 32 };

  // Label for the forward action button
  const forwardLabel: Partial<Record<QueueStatus, string>> = {
    "scheduled":       "Check In",
    "checked-in":      "Start Consult",
    "waiting":         "Start Consult",
    "with-doctor":     "Send to Billing",
    "billing-pending": "Mark Paid & Done",
    "no-show":         "Reschedule",
  };

  if (status === "completed") {
    return <span style={{ fontSize: "var(--font-xs)", color: "var(--green)", fontWeight: 700 }}>✓ Done</span>;
  }
  if (status === "cancelled") {
    return <span style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>—</span>;
  }

  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "nowrap" }}>
      {next && forwardLabel[status] && (
        <button className="btn btn-primary" style={btnSm} onClick={() => onTransition(next)}>
          {forwardLabel[status]}
        </button>
      )}
      {(status === "scheduled" || status === "checked-in" || status === "waiting") && (
        <button className="btn btn-ghost" style={{ ...btnSm, color: "var(--amber)" }} onClick={onNoShow}>
          No Show
        </button>
      )}
      {status !== "no-show" && (
        <button className="btn btn-ghost" style={{ ...btnSm, color: "var(--red)" }} onClick={onCancel}>
          Cancel
        </button>
      )}
    </div>
  );
}
