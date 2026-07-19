/**
 * App-wide constants
 * Extracted from src/ui/constants.ts for shared use
 */

/**
 * Doctors list
 */
export const DOCTORS = [
  "Dr. Sharma",
  "Dr. Patel",
  "Dr. Singh",
  "Dr. Gupta",
  "Dr. Verma",
  "Dr. Kumar",
  "Dr. Reddy",
  "Dr. Nair",
];

/**
 * Insurance providers
 */
export const INSURERS = [
  "None",
  "Star Health",
  "HDFC Ergo",
  "ICICI Lombard",
  "Bajaj Allianz",
  "Max Bupa",
  "Apollo Munich",
  "Religare",
  "SBI General",
];

/**
 * Gender options
 */
export const GENDERS = ["Male", "Female", "Other"];

/**
 * Blood groups
 */
export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

/**
 * Patient statuses
 */
export const STATUSES = ["Active", "New", "Follow-Up Due", "VIP", "Inactive", "Deceased"];

/**
 * Alert types
 */
export const ALERT_TYPES = [
  "Allergy",
  "Diabetic",
  "Hypertension",
  "Heart Condition",
  "Pregnancy",
  "High Risk",
];

/**
 * Document types
 */
export const DOC_TYPES = [
  "ID Proof",
  "Insurance Card",
  "Lab Report",
  "Prescription",
  "Consent Form",
  "Discharge Summary",
  "X-Ray",
  "MRI",
  "CT Scan",
  "Other",
];

/**
 * Family relations
 */
export const RELATIONS = [
  "Spouse",
  "Parent",
  "Child",
  "Sibling",
  "Grandparent",
  "Other",
];

/**
 * Appointment types
 */
export const APPOINTMENT_TYPES = [
  "Consultation",
  "Follow-up",
  "Lab Test",
  "Procedure",
  "Emergency",
  "Vaccination",
];

/**
 * Payment methods
 */
export const PAYMENT_METHODS = [
  "Cash",
  "Card",
  "UPI",
  "Bank Transfer",
  "Insurance",
];

/**
 * Invoice statuses
 */
export const INVOICE_STATUSES = [
  "draft",
  "pending",
  "partial",
  "paid",
  "overdue",
  "cancelled",
];

/**
 * Lab priorities
 */
export const LAB_PRIORITIES = ["routine", "urgent", "stat"];

/**
 * Lab statuses
 */
export const LAB_STATUSES = ["pending", "in-progress", "completed", "cancelled"];

/**
 * Prescription statuses
 */
export const PRESCRIPTION_STATUSES = ["active", "completed", "cancelled"];

/**
 * Communication channels
 */
export const COMMUNICATION_CHANNELS = ["SMS", "Email", "WhatsApp", "Phone"];

/**
 * Communication types
 */
export const COMMUNICATION_TYPES = [
  "Appointment Reminder",
  "Follow-up",
  "Lab Result",
  "Prescription Reminder",
  "Payment Reminder",
  "General",
];

/**
 * Consent types
 */
export const CONSENT_TYPES = [
  "Treatment Consent",
  "Surgery Consent",
  "Anesthesia Consent",
  "Data Sharing Consent",
  "Photo Consent",
];

/**
 * Page size for pagination
 */
export const PAGE_SIZE = 20;

/**
 * Storage keys
 */
export const STORAGE_KEYS = {
  PATIENTS: "clinic_crm_patients_v1",
  AUDIT: "clinic_crm_audit_v1",
  INVOICES: "clinic_crm_invoices",
  PRESCRIPTIONS: "clinic_crm_prescriptions",
  DOCUMENTS: "clinic_crm_documents",
  COMMUNICATIONS: "clinic_crm_communications",
  SETTINGS: "clinic_crm_settings",
  ROLE: "clinic_crm_role",
  THEME: "clinic_crm_theme",
} as const;
