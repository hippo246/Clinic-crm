import type { Patient, AuditEntry, RiskResult, NextBestAction, VisitReadiness, PatientStats } from "./types";
import { AVATAR_COLORS, ALERT_SEVERITY } from "./constants";

// ─── Date / Format ─────────────────────────────────────────────────────────────
export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

export function fmtDateShort(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

export function calcAge(dob: Date | string): number {
  const d = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

// ─── Random helpers (for mock data generation) ────────────────────────────────
export function randomFrom<T>(arr: readonly T[] | T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

// ─── Avatar ────────────────────────────────────────────────────────────────────
export function getAvatarColor(name: string): string {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

export function getInitials(name: string): string {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

// ─── Risk Score ────────────────────────────────────────────────────────────────
const CRITICAL_ALERTS = ["Allergy", "Heart Condition", "Pregnancy", "High Risk"];
const CHRONIC_ALERTS  = ["Diabetic", "Hypertension"];

export function calcRiskScore(patient: Partial<Patient>): RiskResult {
  if (!patient || typeof patient !== "object") return { score: 0, level: "Low" };
  let score = 0;

  const criticals = (patient.alerts || []).filter((a) => CRITICAL_ALERTS.includes(a));
  score += criticals.length * 30;

  const chronics = (patient.alerts || []).filter((a) => CHRONIC_ALERTS.includes(a));
  score += chronics.length * 15;

  const age = patient.age || 0;
  if (age >= 75) score += 35;
  else if (age >= 65) score += 20;

  if (patient.status === "Follow-Up Due") score += 20;

  const unverified = [
    patient.phoneVerified, patient.insuranceVerified,
    patient.idVerified, patient.consentSigned, patient.documentsComplete,
  ].filter((v) => !v).length;
  score += unverified * 2;

  if (patient.insuranceStatus === "Expired")  score += 15;
  if (patient.insuranceStatus === "Expiring") score += 8;
  if (!patient.consentSigned) score += 10;

  let level: "Low" | "Medium" | "High" | "Critical";
  if      (score >= 80) level = "Critical";
  else if (score >= 50) level = "High";
  else if (score >= 25) level = "Medium";
  else                  level = "Low";

  return { score, level };
}

// ─── Next Best Action ──────────────────────────────────────────────────────────
export function calcNextBestAction(patient: Partial<Patient>): NextBestAction {
  const now = new Date();

  const hasCritical = (patient.alerts || []).some((a) =>
    ["Allergy", "Heart Condition", "Pregnancy", "High Risk"].includes(a)
  );
  if (hasCritical && !patient.alertsReviewed) {
    return { label: "Review Medical Alert", detail: "Critical alert requires acknowledgement",
      icon: "ti-alert-triangle", color: "#ef4444", bg: "#fee2e2", urgency: "critical" };
  }
  if (patient.insuranceStatus === "Expired") {
    return { label: "Verify Insurance", detail: "Insurance has expired — update before next visit",
      icon: "ti-shield-exclamation", color: "#ef4444", bg: "#fee2e2", urgency: "critical" };
  }
  if (patient.status === "Follow-Up Due" ||
      (patient.followUpDate && new Date(patient.followUpDate) < now)) {
    return { label: "Call for Follow-Up", detail: patient.followUpReason || "Scheduled follow-up is overdue",
      icon: "ti-phone", color: "#f59e0b", bg: "#fef3c7", urgency: "high" };
  }
  if (!patient.consentSigned) {
    return { label: "Collect Consent", detail: "Patient consent form has not been collected",
      icon: "ti-writing", color: "#f97316", bg: "#fff7ed", urgency: "high" };
  }
  if (patient.insuranceStatus === "Expiring") {
    return { label: "Verify Insurance", detail: "Insurance expiring soon — confirm renewal",
      icon: "ti-shield", color: "#f59e0b", bg: "#fef3c7", urgency: "medium" };
  }
  if (!patient.emergencyName || !patient.emergencyPhone) {
    return { label: "Add Emergency Contact", detail: "No emergency contact on file",
      icon: "ti-phone-call", color: "#7c4fff", bg: "#ede9fe", urgency: "medium" };
  }
  if (patient.lastVisit) {
    const days = Math.floor((now.getTime() - new Date(patient.lastVisit).getTime()) / 86400000);
    if (days >= 90) {
      return { label: "Schedule Review Visit", detail: `No visit in ${days} days`,
        icon: "ti-calendar-plus", color: "#4f7cff", bg: "#eff6ff", urgency: "medium" };
    }
  }
  if (!patient.idVerified || !patient.documentsComplete) {
    return { label: "Complete Verification", detail: "ID or documents require verification",
      icon: "ti-shield-check", color: "#64748b", bg: "#f1f5f9", urgency: "low" };
  }
  if (!patient.nextAppointment) {
    return { label: "Book Next Appointment", detail: "No upcoming appointment scheduled",
      icon: "ti-calendar", color: "#4f7cff", bg: "#eff6ff", urgency: "low" };
  }
  return { label: "Patient Up To Date", detail: "No immediate actions required",
    icon: "ti-circle-check", color: "#22c55e", bg: "#dcfce7", urgency: "none" };
}

// ─── Visit Readiness ───────────────────────────────────────────────────────────
export function calcVisitReadiness(patient: Partial<Patient>): VisitReadiness {
  const items = [
    { key: "phoneVerified",     label: "Phone Verified",          done: !!patient.phoneVerified     },
    { key: "idVerified",        label: "ID Verified",             done: !!patient.idVerified        },
    { key: "consentSigned",     label: "Consent Signed",          done: !!patient.consentSigned     },
    { key: "insuranceVerified", label: "Insurance Valid",         done: !!patient.insuranceVerified },
    { key: "emergencyContact",  label: "Emergency Contact Added", done: !!(patient.emergencyName && patient.emergencyPhone) },
    { key: "documentsComplete", label: "Documents Complete",      done: !!patient.documentsComplete },
  ];
  const done = items.filter((i) => i.done).length;
  return { items, done, total: items.length, ready: done === items.length };
}

// ─── Stats ─────────────────────────────────────────────────────────────────────
export function getPatientStats(patients: Patient[]): PatientStats {
  return {
    total:         patients.length,
    active:        patients.filter((p) => p.status === "Active").length,
    followUpDue:   patients.filter((p) => p.status === "Follow-Up Due").length,
    newPatients:   patients.filter((p) => p.status === "New").length,
    insExpiring:   patients.filter((p) => p.insuranceStatus === "Expiring").length,
    criticalAlerts: patients.filter((p) =>
      (p.alerts || []).some((a) => ["Allergy","Heart Condition","Pregnancy","High Risk"].includes(a))
    ).length,
  };
}

// ─── Search / Filter ───────────────────────────────────────────────────────────
const SMART_PHRASES: Array<{ match: string[]; fn: (p: Patient) => boolean }> = [
  { match: ["diabetic","diabetes"],           fn: (p) => p.alerts.includes("Diabetic") },
  { match: ["hypertension","hypertensive"],   fn: (p) => p.alerts.includes("Hypertension") },
  { match: ["heart","cardiac"],               fn: (p) => p.alerts.includes("Heart Condition") },
  { match: ["pregnant","pregnancy"],          fn: (p) => p.alerts.includes("Pregnancy") },
  { match: ["allerg"],                        fn: (p) => p.alerts.includes("Allergy") },
  { match: ["high risk"],                     fn: (p) => p.alerts.includes("High Risk") },
  { match: ["vip"],                           fn: (p) => p.status === "VIP" },
  { match: ["follow-up overdue","overdue"],   fn: (p) => p.status === "Follow-Up Due" || !!(p.followUpDate && new Date(p.followUpDate) < new Date()) },
  { match: ["follow-up","followup"],          fn: (p) => p.status === "Follow-Up Due" || !!p.followUpDate },
  { match: ["expired insurance"],             fn: (p) => p.insuranceStatus === "Expired" },
  { match: ["insurance expir"],               fn: (p) => p.insuranceStatus === "Expiring" || p.insuranceStatus === "Expired" },
  { match: ["no insurance","uninsured"],      fn: (p) => p.insurer === "None" || !p.insurer },
  { match: ["missing consent","no consent"],  fn: (p) => !p.consentSigned },
  { match: ["90 days","inactive","no visit"], fn: (p) => !!(p.lastVisit && Math.floor((Date.now() - new Date(p.lastVisit).getTime()) / 86400000) >= 90) },
  { match: ["new patient"],                   fn: (p) => p.status === "New" },
  { match: ["active"],                        fn: (p) => p.status === "Active" },
  { match: ["critical"],                      fn: (p) => calcRiskScore(p).level === "Critical" },
  { match: ["missing emergency"],             fn: (p) => !p.emergencyName || !p.emergencyPhone },
];

export function applySmartSearch(patients: Patient[], query: string): Patient[] {
  const q = query.trim().toLowerCase();
  if (!q) return patients;

  for (const phrase of SMART_PHRASES) {
    if (phrase.match.some((m) => q.includes(m))) {
      return patients.filter(phrase.fn);
    }
  }

  return patients.filter((p) =>
    p.name.toLowerCase().includes(q) ||
    p.phone?.includes(q) ||
    p.id.toLowerCase().includes(q) ||
    p.doctor?.toLowerCase().includes(q) ||
    (p.policyNumber && p.policyNumber.toLowerCase().includes(q)) ||
    p.email?.toLowerCase().includes(q) ||
    p.bloodGroup?.toLowerCase().includes(q)
  );
}

export function sortPatients(
  list: Patient[],
  key: keyof Patient,
  dir: "asc" | "desc",
): Patient[] {
  return [...list].sort((a, b) => {
    const av = (a[key] ?? "") as string | number;
    const bv = (b[key] ?? "") as string | number;
    if (typeof av === "number" && typeof bv === "number") {
      return dir === "asc" ? av - bv : bv - av;
    }
    return dir === "asc"
      ? String(av).localeCompare(String(bv))
      : String(bv).localeCompare(String(av));
  });
}

// ─── Audit ─────────────────────────────────────────────────────────────────────
export function createAuditEntry(opts: {
  patientId: string;
  message: string;
  type?: string;
  user?: string;
}): AuditEntry {
  return {
    id:        `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    patientId: opts.patientId,
    message:   opts.message,
    type:      opts.type || "general",
    user:      opts.user || "System",
    timestamp: new Date().toISOString(),
  };
}

export function addAuditEntry(
  auditMap: Record<string, AuditEntry[]>,
  patientId: string,
  entry: AuditEntry,
): Record<string, AuditEntry[]> {
  return {
    ...auditMap,
    [patientId]: [...(auditMap[patientId] || []), entry],
  };
}

// ─── Smart Snapshot ─────────────────────────────────────────────────────────────
export function buildSmartSnapshot(patient: Partial<Patient>): string {
  const parts: string[] = [];
  const now = new Date();

  if (patient.lastVisit) {
    const days = Math.floor((now.getTime() - new Date(patient.lastVisit).getTime()) / 86400000);
    parts.push(`Last seen ${days} day${days !== 1 ? "s" : ""} ago${patient.doctor ? ` by ${patient.doctor}` : ""}.`);
  }
  if (patient.status === "Follow-Up Due") parts.push("Follow-up overdue.");
  if (patient.insuranceExpiry) {
    const daysLeft = Math.floor((new Date(patient.insuranceExpiry).getTime() - now.getTime()) / 86400000);
    if (daysLeft >= 0 && daysLeft <= 30) parts.push(`Insurance expires in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}.`);
    if (daysLeft < 0) parts.push("Insurance has expired.");
  }
  if (patient.allergies) parts.push(`Critical allergy: ${patient.allergies}.`);
  const criticals = (patient.alerts || []).filter((a) =>
    ["Allergy","Heart Condition","Pregnancy","High Risk"].includes(a)
  );
  if (criticals.length > 0) parts.push(`Alert: ${criticals.join(", ")}.`);
  if (!patient.consentSigned) parts.push("Consent not yet signed.");

  return parts.length > 0 ? parts.join(" ") : "No urgent flags for this patient.";
}

// ─── Duplicate Detection ───────────────────────────────────────────────────────
export interface DuplicateGroup {
  type: string;
  patients: [Patient, Patient];
  field: string;
  value: string;
}

export function detectDuplicates(patients: Patient[]): DuplicateGroup[] {
  const duplicates: DuplicateGroup[] = [];
  const phoneMap = new Map<string, Patient>();
  const nameMap  = new Map<string, Patient>();

  patients.forEach((p) => {
    if (p.phone) {
      const norm = p.phone.replace(/\D/g, "").slice(-10);
      if (phoneMap.has(norm)) {
        duplicates.push({ type: "phone", patients: [phoneMap.get(norm)!, p], field: "phone", value: p.phone });
      } else {
        phoneMap.set(norm, p);
      }
    }
    const key = `${p.name.toLowerCase()}-${p.dob || ""}`;
    if (nameMap.has(key)) {
      duplicates.push({ type: "name_dob", patients: [nameMap.get(key)!, p], field: "name", value: p.name });
    } else {
      nameMap.set(key, p);
    }
  });

  return duplicates;
}

// ─── localStorage persistence ──────────────────────────────────────────────────
const STORAGE_KEY = "clinic_crm_patients_v1";
const AUDIT_KEY   = "clinic_crm_audit_v1";

export function savePatients(patients: Patient[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(patients));
  } catch { /* storage full — silently ignore */ }
}

export function loadPatients(): Patient[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Patient[];
  } catch {
    return null;
  }
}

export function saveAuditMap(map: Record<string, AuditEntry[]>): void {
  try {
    localStorage.setItem(AUDIT_KEY, JSON.stringify(map));
  } catch { /* ignore */ }
}

export function loadAuditMap(): Record<string, AuditEntry[]> {
  try {
    const raw = localStorage.getItem(AUDIT_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, AuditEntry[]>;
  } catch {
    return {};
  }
}
