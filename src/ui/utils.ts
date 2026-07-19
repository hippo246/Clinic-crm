import type { Patient, AuditEntry, RiskResult, NextBestAction, VisitReadiness, PatientStats, DuplicateGroup, DuplicateConfidence, ReviewedDuplicatePair } from "./types";
import { AVATAR_COLORS, ALERT_SEVERITY } from "./constants";
import { logExport } from "../shared/services/auditLogger";

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

  // Use fuzzy matching for better typo tolerance
  return patients.filter((p) =>
    fuzzyMatch(p.name, q) ||
    fuzzyMatch(p.phone || "", q) ||
    fuzzyMatch(p.id, q) ||
    fuzzyMatch(p.doctor || "", q) ||
    fuzzyMatch(p.policyNumber || "", q) ||
    fuzzyMatch(p.email || "", q) ||
    fuzzyMatch(p.bloodGroup || "", q)
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

// ─── Duplicate Detection (Phase 7E Enhanced) ───────────────────────────────────

export function detectDuplicates(patients: Patient[]): DuplicateGroup[] {
  const duplicates: DuplicateGroup[] = [];
  const phoneMap = new Map<string, Patient>();
  const emailMap = new Map<string, Patient>();
  const nameMap  = new Map<string, Patient>();

  patients.forEach((p) => {
    // Phone match - high confidence
    if (p.phone) {
      const norm = p.phone.replace(/\D/g, "").slice(-10);
      if (phoneMap.has(norm)) {
        duplicates.push({ 
          type: "phone", 
          patients: [phoneMap.get(norm)!, p], 
          field: "phone", 
          value: p.phone,
          confidence: "high" as DuplicateConfidence
        });
      } else {
        phoneMap.set(norm, p);
      }
    }
    
    // Email match - high confidence
    if (p.email) {
      const norm = p.email.toLowerCase().trim();
      if (emailMap.has(norm)) {
        duplicates.push({ 
          type: "email", 
          patients: [emailMap.get(norm)!, p], 
          field: "email", 
          value: p.email,
          confidence: "high" as DuplicateConfidence
        });
      } else {
        emailMap.set(norm, p);
      }
    }
    
    // Name + DOB match - high confidence
    const key = `${p.name.toLowerCase()}-${p.dob || ""}`;
    if (nameMap.has(key)) {
      duplicates.push({ 
        type: "name_dob", 
        patients: [nameMap.get(key)!, p], 
        field: "name", 
        value: p.name,
        confidence: "high" as DuplicateConfidence
      });
    } else {
      nameMap.set(key, p);
    }
  });

  return duplicates;
}

// ─── Reviewed Duplicate Storage (Phase 7E) ─────────────────────────────────────
const REVIEWED_DUPLICATES_KEY = "clinic_crm_reviewed_duplicates_v1";

export function getReviewedDuplicates(): ReviewedDuplicatePair[] {
  try {
    const raw = localStorage.getItem(REVIEWED_DUPLICATES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ReviewedDuplicatePair[];
  } catch (error) {
    console.error("Failed to load reviewed duplicates:", error);
    return [];
  }
}

export function saveReviewedDuplicate(pair: ReviewedDuplicatePair): void {
  try {
    const reviewed = getReviewedDuplicates();
    reviewed.push(pair);
    localStorage.setItem(REVIEWED_DUPLICATES_KEY, JSON.stringify(reviewed));
  } catch (error) {
    console.error("Failed to save reviewed duplicate:", error);
  }
}

export function isDuplicateReviewed(patientId1: string, patientId2: string): boolean {
  const reviewed = getReviewedDuplicates();
  return reviewed.some(
    r => (r.patientId1 === patientId1 && r.patientId2 === patientId2) ||
         (r.patientId1 === patientId2 && r.patientId2 === patientId1)
  );
}

export function filterReviewedDuplicates(duplicates: DuplicateGroup[]): DuplicateGroup[] {
  return duplicates.filter(dup => 
    !isDuplicateReviewed(dup.patients[0].id, dup.patients[1].id)
  );
}

// ─── Field-Level Privacy Helpers (Phase 7G) ───────────────────────────────────────
export function maskPhone(phone: string): string {
  if (!phone) return "";
  const visible = phone.slice(0, 3);
  const masked = "*".repeat(Math.max(0, phone.length - 3));
  return visible + masked;
}

export function maskEmail(email: string): string {
  if (!email) return "";
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const maskedLocal = local.slice(0, 2) + "*".repeat(Math.max(0, local.length - 2));
  return maskedLocal + "@" + domain;
}

export function maskAddress(address: string): string {
  if (!address) return "";
  const parts = address.split(",");
  if (parts.length <= 1) return address;
  return parts[0] + ", " + "*".repeat(10);
}

export function canViewClinicalField(role: string, field: string): boolean {
  const adminDoctorNurse = ["admin", "doctor", "nurse"].includes(role.toLowerCase());
  if (["alerts", "conditions", "medications", "clinicalNotes", "diagnosis"].includes(field)) {
    return adminDoctorNurse;
  }
  return true;
}

export function canViewBillingField(role: string, field: string): boolean {
  const adminDoctorBilling = ["admin", "doctor", "billing"].includes(role.toLowerCase());
  if (["insurer", "insuranceStatus", "insuranceExpiry", "insuranceId"].includes(field)) {
    return adminDoctorBilling;
  }
  return true;
}

// ─── Merge Preview Helper (Phase 7E) ────────────────────────────────────────────
import type { MergePreview } from "./types";

export function buildMergePreview(masterPatient: Patient, duplicatePatient: Patient): MergePreview {
  const fieldDifferences: Array<{
    field: keyof Patient;
    masterValue: any;
    duplicateValue: any;
    useMaster: boolean;
  }> = [];
  
  const fieldsToCompare: (keyof Patient)[] = [
    "name", "phone", "email", "dob", "age", "gender", "bloodGroup", 
    "address", "doctor", "status", "insurer", "insuranceStatus", 
    "insuranceExpiry", "lastVisit", "nextAppointment"
  ];
  
  fieldsToCompare.forEach(field => {
    const masterVal = masterPatient[field];
    const dupVal = duplicatePatient[field];
    
    if (masterVal !== dupVal) {
      fieldDifferences.push({
        field,
        masterValue: masterVal,
        duplicateValue: dupVal,
        useMaster: true // Default to keeping master value
      });
    }
  });
  
  return {
    masterPatient,
    duplicatePatient,
    fieldDifferences
  };
}

// ─── Soft-Delete/Archive Helpers (Phase 7B) ─────────────────────────────────────
export function isPatientDeleted(patient: Patient): boolean {
  return !!patient.deletedAt;
}

export function isPatientArchived(patient: Patient): boolean {
  return patient.status === "Archived" || !!patient.archivedAt;
}

export function getActivePatients(patients: Patient[]): Patient[] {
  return patients.filter(p => !p.deletedAt);
}

export function getArchivedPatients(patients: Patient[]): Patient[] {
  return patients.filter(p => !!p.deletedAt);
}

// ─── Import Validation Helpers (Phase 7D) ───────────────────────────────────────
import type { PatientImportRow, PatientImportSummary, ImportRowStatus } from "./types";

export function validateImportedPatientRow(row: Partial<Patient>, existingPatients: Patient[]): { status: ImportRowStatus; issues: string[]; matchedPatientId?: string } {
  const issues: string[] = [];
  
  // Required field validation
  if (!row.name || row.name.trim() === "") {
    issues.push("Missing required field: name");
  }
  
  // Phone format validation
  if (row.phone && row.phone.trim() !== "") {
    const phoneDigits = row.phone.replace(/\D/g, "");
    if (phoneDigits.length < 10) {
      issues.push("Invalid phone format (must have at least 10 digits)");
    }
  }
  
  // Email format validation
  if (row.email && row.email.trim() !== "") {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(row.email)) {
      issues.push("Invalid email format");
    }
  }
  
  // DOB validation
  if (row.dob && row.dob.trim() !== "") {
    const dobDate = new Date(row.dob);
    if (isNaN(dobDate.getTime())) {
      issues.push("Invalid date of birth format");
    }
  }
  
  // Duplicate detection
  const matchedById = existingPatients.find(p => row.id && p.id === row.id);
  const matchedByPhone = existingPatients.find(p => row.phone && p.phone === row.phone);
  const matchedByEmail = existingPatients.find(p => row.email && p.email === row.email);
  const matchedByNameDob = existingPatients.find(p => 
    row.name && row.name === p.name && 
    row.dob && row.dob === p.dob
  );
  
  if (matchedById) {
    return { status: "update", issues: [], matchedPatientId: matchedById.id };
  }
  
  if (matchedByPhone || matchedByEmail || matchedByNameDob) {
    issues.push("Potential duplicate detected (matches existing patient by phone, email, or name+DOB)");
    return { status: "duplicate", issues, matchedPatientId: matchedByPhone?.id || matchedByEmail?.id || matchedByNameDob?.id };
  }
  
  if (issues.length > 0) {
    return { status: "invalid", issues };
  }
  
  return { status: "valid", issues: [] };
}

export function buildPatientImportPreview(rows: Partial<Patient>[], existingPatients: Patient[]): PatientImportRow[] {
  return rows.map((row, index) => {
    const validation = validateImportedPatientRow(row, existingPatients);
    return {
      index,
      data: row,
      status: validation.status,
      issues: validation.issues,
      matchedPatientId: validation.matchedPatientId
    };
  });
}

export function getPatientImportSummary(previewRows: PatientImportRow[]): PatientImportSummary {
  return {
    total: previewRows.length,
    valid: previewRows.filter(r => r.status === "valid").length,
    invalid: previewRows.filter(r => r.status === "invalid").length,
    duplicate: previewRows.filter(r => r.status === "duplicate").length,
    update: previewRows.filter(r => r.status === "update").length,
    skipped: previewRows.filter(r => r.status === "skipped").length
  };
}

// ─── Rollback Backup Helper (Phase 7D) ───────────────────────────────────────────
const BACKUP_KEY = "clinic_crm_patients_backup_v1";

export async function createPatientBackup(patients: Patient[]): Promise<void> {
  try {
    localStorage.setItem(BACKUP_KEY, JSON.stringify({
      timestamp: new Date().toISOString(),
      patients: patients
    }));
  } catch (error) {
    console.error("Failed to create patient backup:", error);
  }
}

export async function restorePatientBackup(): Promise<Patient[] | null> {
  try {
    const raw = localStorage.getItem(BACKUP_KEY);
    if (!raw) return null;
    const backup = JSON.parse(raw);
    return backup.patients as Patient[];
  } catch (error) {
    console.error("Failed to restore patient backup:", error);
    return null;
  }
}

export async function clearPatientBackup(): Promise<void> {
  try {
    localStorage.removeItem(BACKUP_KEY);
  } catch (error) {
    console.error("Failed to clear patient backup:", error);
  }
}

// ─── LocalStorage-based persistence (Frontend-only mode) ───────────────────────
const STORAGE_KEY = "clinic_crm_patients_v1";
const AUDIT_KEY   = "clinic_crm_audit_v1";

export async function savePatients(patients: Patient[]): Promise<void> {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(patients));
  } catch (error) {
    console.error("Failed to save patients to localStorage:", error);
  }
}

export async function loadPatients(): Promise<Patient[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Patient[];
  } catch (error) {
    console.error("Failed to load patients from localStorage:", error);
    return [];
  }
}

export async function saveAuditMap(map: Record<string, AuditEntry[]>): Promise<void> {
  try {
    localStorage.setItem(AUDIT_KEY, JSON.stringify(map));
  } catch (error) {
    console.error("Failed to save audit map to localStorage:", error);
  }
}

export async function loadAuditMap(): Promise<Record<string, AuditEntry[]>> {
  try {
    const raw = localStorage.getItem(AUDIT_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, AuditEntry[]>;
  } catch (error) {
    console.error("Failed to load audit map from localStorage:", error);
    return {};
  }
}

// ─── CSV Export ─────────────────────────────────────────────────────────────────
interface ExportOptions {
  actor?: string;
  exportType?: string;
  count?: number; // Phase 7K: Record count for audit metadata
}

export function exportToCSV<T extends Record<string, any>>(
  data: T[],
  filename: string,
  columns?: { key: keyof T; label: string }[],
  options?: ExportOptions
): void {
  if (data.length === 0) {
    console.warn("No data to export");
    return;
  }

  const headers = columns || Object.keys(data[0]).map(key => ({ key, label: String(key) }));
  const csvHeaders = headers.map(h => h.label).join(",");
  
  // Add metadata header rows (Phase 7D)
  const metadataRows: string[] = [];
  if (options?.actor || options?.exportType) {
    metadataRows.push(`# Exported at: ${new Date().toISOString()}`);
    if (options?.actor) metadataRows.push(`# Exported by: ${options.actor}`);
    if (options?.exportType) metadataRows.push(`# Export type: ${options.exportType}`);
    // Phase 7K: Use count from options if provided, otherwise use data.length
    const recordCount = options?.count !== undefined ? options.count : data.length;
    metadataRows.push(`# Record count: ${recordCount}`);
    metadataRows.push(`# Source: Clinic CRM`);
    metadataRows.push(""); // Empty line after metadata
  }
  
  const csvRows = data.map(row => 
    headers.map(h => {
      const value = row[h.key];
      // Handle nested objects, arrays, and special characters
      if (value === null || value === undefined) return "";
      if (typeof value === "object") return JSON.stringify(value).replace(/"/g, '""');
      return String(value).replace(/"/g, '""');
    }).join(",")
  );

  const csvContent = [...metadataRows, csvHeaders, ...csvRows].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  // Phase 7K: PHI-safe export audit logging
  const recordCount = options?.count !== undefined ? options.count : data.length;
  logExport({
    resourceType: "patient",
    resourceLabel: options?.exportType || "csv_export",
    details: `Exported ${recordCount} records as ${options?.exportType || "csv"}`,
    recordCount,
  });
}

export function exportPatientsToCSV(patients: Patient[], preset: "demographics" | "contact" | "clinical" | "full" = "full", actor?: string): void {
  // Phase 7K: Filter out archived/deleted patients from normal exports
  const activePatients = patients.filter(p => !p.deletedAt);
  
  // Define export presets (Phase 7D)
  const presetFields: Record<string, (keyof Patient)[]> = {
    demographics: ["id", "name", "dob", "age", "gender", "bloodGroup", "address"],
    contact: ["id", "name", "phone", "email", "address"],
    clinical: ["id", "name", "doctor", "status", "alerts", "conditions", "medications", "lastVisit", "nextAppointment"],
    full: ["id", "name", "phone", "email", "dob", "age", "gender", "bloodGroup", "address", "doctor", "status", "insurer", "insuranceStatus", "insuranceExpiry", "lastVisit", "nextAppointment", "alerts", "conditions", "medications"]
  };

  const fields = presetFields[preset] || presetFields.full;
  
  const columns = fields.map(key => ({
    key: key as keyof Patient,
    label: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1').trim()
  }));
  
  const timestamp = new Date().toISOString().split("T")[0];
  const filename = `patients_${preset}_export_${timestamp}`;
  
  // Phase 7K: Pass count for audit metadata
  exportToCSV(activePatients, filename, columns, { actor, exportType: preset, count: activePatients.length });
}

export function exportReportsToCSV(patients: Patient[]): void {
  // Phase 8J: Remove PHI from patient report export (PHI-safe)
  const reportData = patients.map(p => ({
    "Patient ID": p.id,
    "Status": p.status,
    "Doctor": p.doctor,
    "Next Appointment": p.nextAppointment,
    "Follow-Up Date": p.followUpDate,
    "Follow-Up Status": p.followUpStatus,
    "Created At": p.createdAt,
  }));
  
  const timestamp = new Date().toISOString().split("T")[0];
  exportToCSV(reportData, `clinic_report_${timestamp}`);
}

// ─── Fuzzy Search with Highlighting ───────────────────────────────────────────────
export function getHighlightParts(text: string, query: string): Array<{ text: string; highlight: boolean }> {
  if (!query || !text) return [{ text, highlight: false }];
  
  const regex = new RegExp(`(${query.split('').join('.*?')})`, 'gi');
  const parts: Array<{ text: string; highlight: boolean }> = [];
  let lastIndex = 0;
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, match.index), highlight: false });
    }
    parts.push({ text: match[0], highlight: true });
    lastIndex = regex.lastIndex;
  }
  
  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), highlight: false });
  }
  
  return parts.length > 0 ? parts : [{ text, highlight: false }];
}

export function fuzzyMatch(text: string, query: string): boolean {
  if (!query) return true;
  if (!text) return false;
  
  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();
  
  // Exact match
  if (textLower.includes(queryLower)) return true;
  
  // Fuzzy match - allows for typos and partial matches
  let textIndex = 0;
  let queryIndex = 0;
  
  while (textIndex < textLower.length && queryIndex < queryLower.length) {
    if (textLower[textIndex] === queryLower[queryIndex]) {
      queryIndex++;
    }
    textIndex++;
  }
  
  // If we matched most of the query characters, consider it a match
  return queryIndex >= queryLower.length * 0.7;
}

function loadAuditMapFromLocalStorage(): Record<string, AuditEntry[]> {
  try {
    const raw = localStorage.getItem(AUDIT_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, AuditEntry[]>;
  } catch {
    return {};
  }
}

// ─── Shared Infrastructure (Phase 1) ─────────────────────────────────────────────────
// The following shared infrastructure has been created in src/shared/ for future migration:
// - src/shared/utils/dateUtils.ts (fmtDate, fmtDateShort, calcAge, fmtRelative, etc.)
// - src/shared/utils/formatUtils.ts (getInitials, getAvatarColor, formatPhone, formatCurrency, etc.)
// - src/shared/utils/searchUtils.ts (fuzzyMatch, getHighlightParts, smartSearch, etc.)
// - src/shared/utils/exportUtils.ts (exportToCSV, exportToJSON, downloadTextFile, etc.)
// - src/shared/services/storageService.ts (readJSON, writeJSON, removeStorageItem, etc.)
// - src/shared/services/notificationService.ts (createNotification, notificationQueue, etc.)
// - src/shared/components/ui/Modal.tsx (reusable modal component)
// - src/shared/components/feedback/Feedback.tsx (reusable feedback component)
// - src/shared/components/feedback/ConfirmDialog.tsx (reusable confirmation dialog)
// - src/shared/hooks/useLocalStorage.ts (custom hook for localStorage)
// - src/shared/hooks/usePermission.ts (custom hook for permission checks)
// - src/shared/permissions/permissions.ts (role-based permission system)
// - src/shared/constants/appConstants.ts (app-wide constants)
// - src/shared/types/common.types.ts (common types)
//
// Current functions in this file (utils.ts) are kept as-is for backward compatibility.
// Future phases may migrate to use the shared infrastructure incrementally.
// No breaking changes in Phase 1.
