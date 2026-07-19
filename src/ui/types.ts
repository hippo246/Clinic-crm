// ─── Core Domain Types ─────────────────────────────────────────────────────────

export type Gender = "Male" | "Female" | "Other";
export type BloodGroup = "A+" | "A-" | "B+" | "B-" | "O+" | "O-" | "AB+" | "AB-";
export type PatientStatus =
  | "New" | "Active" | "Follow-Up Due" | "Under Treatment"
  | "Observation" | "Inactive" | "VIP" | "Archived";
export type InsuranceStatus = "Active" | "Expiring" | "Expired" | "None";
export type AlertType =
  | "Allergy" | "Diabetic" | "Hypertension"
  | "Heart Condition" | "Pregnancy" | "High Risk";
export type RiskLevel = "Low" | "Medium" | "High" | "Critical";
// Import centralized UserRole from permissions system
export type { UserRole } from "../shared/permissions/permissions";
export type FollowUpStatus = "Pending" | "Called" | "No Answer" | "Completed";

export interface TimelineEvent {
  id: string;
  type: string;
  label: string;
  icon: string;
  color: string;
  date: Date | string;
  note?: string | null;
  doctor?: string;
  // Phase 7F: Timeline metadata
  sourceType?: string;
  sourceId?: string;
  createdAt?: string;
  createdBy?: string;
  immutable?: boolean;
}

export interface PatientDocument {
  id: string;
  type: string;
  uploaded: string;
  size: string;
  verified?: boolean;
  expiry?: string | null;
}

export interface PatientNote {
  id: string;
  text: string;
  pinned: boolean;
  date: string;
  category?: string;
  author?: string;
  // Phase 7F: Note versioning and soft-delete
  updatedAt?: string;
  updatedBy?: string;
  deletedAt?: string;
  deletedBy?: string;
  versions?: PatientNoteVersion[];
}

export interface PatientNoteVersion {
  text: string;
  updatedAt: string;
  updatedBy: string;
}

export interface FamilyMember {
  id: string;
  name: string;
  relation: string;
  patientId: string;
}

export interface Prescription {
  id: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  route: string;
  duration: string;
  instructions: string;
  prescribedDate: string;
  prescribedBy: string;
  refillsTotal: number;
  refillsUsed: number;
  refillsRemaining: number;
  status: "active" | "completed" | "discontinued";
  refillHistory?: Array<{
    date: string;
    filledBy: string;
  }>;
}

export interface LabResult {
  id: string;
  testName: string;
  testType: string;
  value: number;
  unit: string;
  referenceRange: string;
  date: string;
  performedBy: string;
  status: "normal" | "abnormal" | "critical";
  notes?: string;
}

export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  dob: string;
  age: number;
  gender: Gender;
  bloodGroup: BloodGroup;
  phone: string;
  email: string;
  address: string;
  nationality: string;
  maritalStatus?: string;
  occupation?: string;
  languages?: string;
  religion?: string;
  ethnicity?: string;
  race?: string;
  preferredLanguage?: string;
  employmentStatus?: string;
  educationLevel?: string;
  livingArrangement?: string;
  preferredPharmacy?: string;
  referralSource?: string;
  primaryCarePhysician?: string;
  advanceDirectives?: string;
  advanceCarePlanning?: string;
  organDonor?: string;
  bloodDonor?: string;

  // Emergency
  emergencyName: string;
  emergencyRelation: string;
  emergencyPhone: string;
  emergencyContact2?: string;
  emergencyRelation2?: string;
  emergencyPhone2?: string;

  // Insurance
  insurer: string;
  policyNumber: string | null;
  insuranceExpiry: string | null;
  insuranceStatus: InsuranceStatus;
  insuranceType?: string;
  insuranceGroupNumber?: string;
  insuranceMemberId?: string;

  // Medical
  allergies: string;
  allergiesSeverity?: string;
  allergiesReaction?: string;
  conditions: string[];
  medications: string[];
  alerts: AlertType[];
  alertsReviewed?: boolean;
  acknowledgedAlerts?: string[];
  pastIllnesses?: string;
  pastSurgeries?: string;
  hospitalizations?: string;
  familyHistory?: string;
  socialHistory?: string;
  smokingStatus?: string;
  alcoholUse?: string;
  drugUse?: string;
  immunizationHistory?: string;
  vaccinationStatus?: string;
  dietaryRestrictions?: string;
  exerciseFrequency?: string;
  sleepHours?: string;
  stressLevel?: string;

  // Status
  status: PatientStatus;
  doctor: string;
  lastVisit: string | null;
  nextAppointment: string | null;

  // Follow-up
  followUpDate: string | null;
  followUpReason: string | null;
  followUpStaff: string | null;
  followUpPriority: "High" | "Medium" | "Low" | null;
  followUpStatus: FollowUpStatus | null;
  callAttempts: number;
  lastContacted: string | null;
  followUpNotes: string | null;

  // Verification flags
  phoneVerified: boolean;
  insuranceVerified: boolean;
  idVerified: boolean;
  consentSigned: boolean;
  documentsComplete: boolean;

  // Sub-arrays
  timeline: TimelineEvent[];
  documents: PatientDocument[];
  notes: PatientNote[];
  family: FamilyMember[];
  prescriptions?: Prescription[];
  labResults?: LabResult[];

  // Optional extras
  flags?: Record<string, boolean>;
  consents?: Record<string, boolean>;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;

  // Soft-delete/archive metadata (Phase 7B)
  deletedAt?: string;
  deletedBy?: string;
  deleteReason?: string;
  archivedAt?: string;
  archivedBy?: string;
  archiveReason?: string;
  restoredAt?: string;
  restoredBy?: string;
  statusBeforeArchive?: PatientStatus; // Phase 7C: for restore to prior status
}

// ─── Import/Export Types (Phase 7D) ─────────────────────────────────────────────
export type ImportRowStatus = "valid" | "invalid" | "duplicate" | "update" | "skipped";

export interface PatientImportRow {
  index: number;
  data: Partial<Patient>;
  status: ImportRowStatus;
  issues: string[];
  matchedPatientId?: string;
}

export interface PatientImportSummary {
  total: number;
  valid: number;
  invalid: number;
  duplicate: number;
  update: number;
  skipped: number;
}

export type ExportPreset = "demographics" | "contact" | "clinical" | "full";

export interface ExportPresetConfig {
  id: ExportPreset;
  label: string;
  fields: (keyof Patient)[];
  allowedRoles: string[]; // Phase 7D: use string[] to avoid UserRole import issues
}

// ─── Duplicate/Merge Types (Phase 7E) ────────────────────────────────────────────
export type DuplicateConfidence = "high" | "medium" | "low";

export interface DuplicateGroup {
  type: string;
  patients: [Patient, Patient];
  field: string;
  value: string;
  confidence: DuplicateConfidence; // Phase 7E
}

export interface ReviewedDuplicatePair {
  patientId1: string;
  patientId2: string;
  dismissedAt: string;
  dismissedBy: string;
}

export interface MergePreview {
  masterPatient: Patient;
  duplicatePatient: Patient;
  fieldDifferences: Array<{
    field: keyof Patient;
    masterValue: any;
    duplicateValue: any;
    useMaster: boolean;
  }>;
}

// ─── Consent Types (Phase 7F) ───────────────────────────────────────────────────
export type ConsentStatus = "granted" | "revoked" | "expired" | "pending";

export interface ConsentRecord {
  type: string;
  status: ConsentStatus;
  changedAt: string;
  changedBy: string;
  source?: string;
  sourceDocumentId?: string;
}

export interface AuditEntry {
  id: string;
  patientId: string;
  message: string;
  type: string;
  user: string;
  timestamp: string;
}

export interface PatientStats {
  total: number;
  active: number;
  followUpDue: number;
  newPatients: number;
  insExpiring: number;
  criticalAlerts: number;
}

export interface RiskResult {
  score: number;
  level: RiskLevel;
}

export interface NextBestAction {
  label: string;
  detail: string;
  icon: string;
  color: string;
  bg: string;
  urgency: "critical" | "high" | "medium" | "low" | "none";
}

export interface VisitReadinessItem {
  key: string;
  label: string;
  done: boolean;
}

export interface VisitReadiness {
  items: VisitReadinessItem[];
  done: number;
  total: number;
  ready: boolean;
}
