/**
 * Entity-level validators
 * Generic validators for common entities
 */

import {
  isNonEmpty,
  validateEmail,
  validatePhone,
  validateDate,
  validatePastOrTodayDate,
  validateFutureDate,
  validateBloodGroup,
  validateNumberRange,
  safeString,
} from "./validators";

/**
 * Validation result type
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate patient data
 */
export function validatePatientData(patient: Record<string, unknown>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Name/first name required
  const firstName = safeString(patient.firstName || patient.name);
  if (!isNonEmpty(firstName)) {
    errors.push("Patient name is required");
  }

  // Phone validation if present
  const phone = safeString(patient.phone);
  if (isNonEmpty(phone) && !validatePhone(phone)) {
    errors.push("Invalid phone number format");
  }

  // Email validation if present
  const email = safeString(patient.email);
  if (isNonEmpty(email) && !validateEmail(email)) {
    errors.push("Invalid email format");
  }

  // DOB validation if present
  const dob = safeString(patient.dob);
  if (isNonEmpty(dob)) {
    if (!validateDate(dob)) {
      errors.push("Invalid date of birth format");
    } else if (!validatePastOrTodayDate(dob)) {
      errors.push("Date of birth cannot be in the future");
    }
  }

  // Gender validation if present
  const gender = safeString(patient.gender);
  if (isNonEmpty(gender)) {
    const validGenders = ["Male", "Female", "Other", "male", "female", "other"];
    if (!validGenders.includes(gender)) {
      warnings.push("Gender value may be invalid");
    }
  }

  // Emergency phone validation if present
  const emergencyPhone = safeString(patient.emergencyPhone);
  if (isNonEmpty(emergencyPhone) && !validatePhone(emergencyPhone)) {
    errors.push("Invalid emergency phone number format");
  }

  // Blood group validation if present
  const bloodGroup = safeString(patient.bloodGroup);
  if (isNonEmpty(bloodGroup) && !validateBloodGroup(bloodGroup)) {
    warnings.push("Blood group may be invalid");
  }

  // Insurance expiry validation if present
  const insuranceExpiry = safeString(patient.insuranceExpiry);
  if (isNonEmpty(insuranceExpiry)) {
    if (!validateDate(insuranceExpiry)) {
      errors.push("Invalid insurance expiry date format");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate appointment data
 */
export function validateAppointmentData(appointment: Record<string, unknown>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Patient required
  if (!isNonEmpty(appointment.patient_id) && !isNonEmpty(appointment.patientId)) {
    errors.push("Patient is required");
  }

  // Date required
  const date = safeString(appointment.date || appointment.appointmentDate);
  if (!isNonEmpty(date)) {
    errors.push("Appointment date is required");
  } else if (!validateDate(date)) {
    errors.push("Invalid appointment date format");
  }

  // Doctor validation if present
  const doctor = safeString(appointment.doctor);
  if (!isNonEmpty(doctor)) {
    warnings.push("Doctor not specified");
  }

  // Status validation if present
  const status = safeString(appointment.status);
  if (isNonEmpty(status)) {
    const validStatuses = ["scheduled", "confirmed", "completed", "cancelled", "no-show"];
    if (!validStatuses.includes(status.toLowerCase())) {
      warnings.push("Appointment status may be invalid");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate invoice data
 */
export function validateInvoiceData(invoice: Record<string, unknown>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Patient required
  if (!isNonEmpty(invoice.patient_id) && !isNonEmpty(invoice.patientId)) {
    errors.push("Patient is required");
  }

  // Items validation
  const items = invoice.items;
  if (!Array.isArray(items) || items.length === 0) {
    errors.push("At least one invoice item is required");
  }

  // Amount validation
  const total = Number(invoice.total || invoice.amount);
  if (isNaN(total) || total <= 0) {
    errors.push("Invoice amount must be a positive number");
  }

  // Due date validation if present
  const dueDate = safeString(invoice.dueDate);
  if (isNonEmpty(dueDate)) {
    if (!validateDate(dueDate)) {
      errors.push("Invalid due date format");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate prescription data
 */
export function validatePrescriptionData(prescription: Record<string, unknown>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Patient required
  if (!isNonEmpty(prescription.patient_id) && !isNonEmpty(prescription.patientId)) {
    errors.push("Patient is required");
  }

  // Doctor validation if present
  const doctor = safeString(prescription.doctor);
  if (!isNonEmpty(doctor)) {
    warnings.push("Doctor not specified");
  }

  // Medications validation
  const medications = prescription.medications || prescription.meds;
  if (!Array.isArray(medications) || medications.length === 0) {
    errors.push("At least one medication is required");
  } else {
    // Check if medications have names
    const hasValidMed = medications.some((med: unknown) => {
      if (typeof med === "object" && med !== null) {
        return isNonEmpty((med as Record<string, unknown>).name);
      }
      return isNonEmpty(med);
    });
    if (!hasValidMed) {
      errors.push("Medications must have names");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate document data
 */
export function validateDocumentData(document: Record<string, unknown>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Patient required
  if (!isNonEmpty(document.patient_id) && !isNonEmpty(document.patientId)) {
    errors.push("Patient is required");
  }

  // Title/type validation
  const title = safeString(document.title || document.name);
  const type = safeString(document.type || document.documentType);
  if (!isNonEmpty(title) && !isNonEmpty(type)) {
    errors.push("Document title or type is required");
  }

  // Date order validation if both present
  const issueDate = safeString(document.issueDate || document.issuedAt);
  const expiryDate = safeString(document.expiryDate || document.expiresAt);
  
  if (isNonEmpty(issueDate) && isNonEmpty(expiryDate)) {
    if (validateDate(issueDate) && validateDate(expiryDate)) {
      const issue = new Date(issueDate);
      const expiry = new Date(expiryDate);
      if (issue > expiry) {
        errors.push("Issue date cannot be after expiry date");
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate communication data
 */
export function validateCommunicationData(communication: Record<string, unknown>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Patient required
  if (!isNonEmpty(communication.patient_id) && !isNonEmpty(communication.patientId)) {
    errors.push("Patient is required");
  }

  // Message required
  const message = safeString(communication.message || communication.content);
  if (!isNonEmpty(message)) {
    errors.push("Message is required");
  }

  // Type validation
  const type = safeString(communication.type || communication.communicationType);
  if (isNonEmpty(type)) {
    const validTypes = ["email", "sms", "phone", "whatsapp", "in-person"];
    if (!validTypes.includes(type.toLowerCase())) {
      warnings.push("Communication type may be invalid");
    }
  }

  // Contact target validation based on type
  if (isNonEmpty(type)) {
    const targetType = type.toLowerCase();
    const target = safeString(communication.target || communication.to || communication.phoneNumber || communication.emailAddress);
    
    if (targetType === "email" && isNonEmpty(target) && !validateEmail(target)) {
      errors.push("Invalid email address for email communication");
    }
    if ((targetType === "sms" || targetType === "phone" || targetType === "whatsapp") && isNonEmpty(target) && !validatePhone(target)) {
      errors.push("Invalid phone number for this communication type");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
