/**
 * Validation and app option constants
 * Centralized constants for validation and form options
 */

/**
 * Valid blood groups
 */
export const VALID_BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

/**
 * Valid genders
 */
export const VALID_GENDERS = ["Male", "Female", "Other"] as const;

/**
 * Valid appointment types
 */
export const VALID_APPOINTMENT_TYPES = [
  "consultation",
  "follow-up",
  "check-up",
  "emergency",
  "procedure",
  "vaccination",
  "lab-test",
] as const;

/**
 * Valid invoice statuses
 */
export const VALID_INVOICE_STATUSES = ["pending", "partial", "paid", "overdue", "cancelled"] as const;

/**
 * Valid prescription statuses
 */
export const VALID_PRESCRIPTION_STATUSES = ["active", "completed", "dispensed", "cancelled"] as const;

/**
 * Valid document types
 */
export const VALID_DOCUMENT_TYPES = [
  "id-proof",
  "insurance",
  "medical-record",
  "lab-report",
  "prescription",
  "consent-form",
  "discharge-summary",
  "other",
] as const;

/**
 * Valid communication types
 */
export const VALID_COMMUNICATION_TYPES = ["email", "sms", "phone", "whatsapp", "in-person"] as const;

/**
 * Valid queue statuses
 */
export const VALID_QUEUE_STATUSES = ["waiting", "in-progress", "completed", "skipped"] as const;

/**
 * Valid payment methods
 */
export const VALID_PAYMENT_METHODS = ["cash", "card", "upi", "bank-transfer", "insurance"] as const;

/**
 * Max file size in bytes (10MB)
 */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/**
 * Allowed document MIME types
 */
export const ALLOWED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
] as const;

/**
 * Default validation limits
 */
export const DEFAULT_VALIDATION_LIMITS = {
  MAX_NAME_LENGTH: 100,
  MAX_ADDRESS_LENGTH: 500,
  MAX_PHONE_LENGTH: 20,
  MAX_EMAIL_LENGTH: 254,
  MAX_NOTES_LENGTH: 2000,
  MIN_AGE: 0,
  MAX_AGE: 150,
  MIN_AMOUNT: 0,
  MAX_AMOUNT: 10000000,
} as const;
