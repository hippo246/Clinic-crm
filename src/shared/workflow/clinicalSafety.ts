/**
 * Phase 8D: Clinical Safety Validation Helpers
 * 
 * This module provides structural validation for Lab and Prescription workflows
 * to ensure clinical safety without implementing medical advice or drug interactions.
 * 
 * Focus: Structural validation, duplicate prevention, required field checks
 * NOT: Medical interpretation, drug interactions, clinical decision support
 */

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  reason?: string;
  existingRecordId?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Checks for duplicate lab orders based on structural criteria.
 * 
 * Duplicate rules:
 * - same patient ID
 * - same test/panel name
 * - same requested date/day
 * - status not completed/cancelled
 * 
 * @param patientId - Patient ID to check
 * @param testType - Test type/panel name
 * @param orderDate - Order date
 * @param existingOrders - Array of existing lab orders
 * @returns Duplicate check result
 */
export function checkDuplicateLabOrder(
  patientId: string,
  testType: string,
  orderDate: string,
  existingOrders: Array<{ id: string; patientId: string; testType: string; orderDate: string; status: string }>
): DuplicateCheckResult {
  if (!patientId || !testType || !orderDate) {
    return { isDuplicate: false };
  }

  const normalizedTestType = testType.toLowerCase().trim();
  const orderDateObj = new Date(orderDate);
  const orderDateStr = orderDateObj.toISOString().split('T')[0];

  for (const order of existingOrders) {
    // Skip completed or cancelled orders
    if (order.status === 'completed' || order.status === 'cancelled') {
      continue;
    }

    // Check if same patient
    if (order.patientId !== patientId) {
      continue;
    }

    // Check if same test type (case-insensitive)
    if (order.testType.toLowerCase().trim() !== normalizedTestType) {
      continue;
    }

    // Check if same date
    const existingOrderDate = new Date(order.orderDate);
    const existingOrderDateStr = existingOrderDate.toISOString().split('T')[0];
    if (existingOrderDateStr !== orderDateStr) {
      continue;
    }

    // All conditions match - duplicate found
    return {
      isDuplicate: true,
      reason: `Duplicate lab order detected for patient ${patientId} on ${orderDateStr}`,
      existingRecordId: order.id,
    };
  }

  return { isDuplicate: false };
}

/**
 * Checks for duplicate active prescriptions.
 * 
 * Duplicate rules:
 * - same patient ID
 * - same medication name
 * - same dosage if available
 * - active status
 * - overlapping date range if available
 * 
 * @param patientId - Patient ID to check
 * @param medicationName - Medication name
 * @param dosage - Dosage (optional)
 * @param existingPrescriptions - Array of existing prescriptions
 * @returns Duplicate check result
 */
export function checkDuplicatePrescription(
  patientId: string,
  medicationName: string,
  dosage: string,
  existingPrescriptions: Array<{ id: string; patientId: string; medications: Array<{ name: string; dosage: string }>; status: string }>
): DuplicateCheckResult {
  if (!patientId || !medicationName) {
    return { isDuplicate: false };
  }

  const normalizedMedName = medicationName.toLowerCase().trim();
  const normalizedDosage = dosage ? dosage.toLowerCase().trim() : '';

  for (const prescription of existingPrescriptions) {
    // Skip non-active prescriptions
    if (prescription.status !== 'active') {
      continue;
    }

    // Check if same patient
    if (prescription.patientId !== patientId) {
      continue;
    }

    // Check medications in prescription
    for (const med of prescription.medications) {
      const existingMedName = med.name.toLowerCase().trim();
      const existingDosage = med.dosage ? med.dosage.toLowerCase().trim() : '';

      // Check if same medication name
      if (existingMedName !== normalizedMedName) {
        continue;
      }

      // If dosage provided, check if same
      if (normalizedDosage && existingDosage && existingDosage !== normalizedDosage) {
        continue;
      }

      // All conditions match - duplicate found
      return {
        isDuplicate: true,
        reason: `Duplicate active prescription detected for patient ${patientId}`,
        existingRecordId: prescription.id,
      };
    }
  }

  return { isDuplicate: false };
}

/**
 * Validates lab result structure before approval.
 * 
 * Checks:
 * - result has patientId
 * - result has linked orderId if required
 * - result has test name/type
 * - result has parameters if required
 * - abnormal/critical flag is intentional (has parameters flagged)
 * 
 * @param result - Lab result to validate
 * @returns Validation result
 */
export function validateLabResultStructure(
  result: {
    patientId?: string;
    orderId?: string;
    testType?: string;
    parameters?: Array<{ name: string; value: string; flag?: string }>;
    critical?: boolean;
  }
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check patientId
  if (!result.patientId) {
    errors.push('Lab result must have a patient ID');
  }

  // Check orderId
  if (!result.orderId) {
    errors.push('Lab result must be linked to an order');
  }

  // Check testType
  if (!result.testType || result.testType.trim() === '') {
    errors.push('Lab result must have a test type');
  }

  // Check parameters
  if (!result.parameters || result.parameters.length === 0) {
    warnings.push('Lab result has no parameters');
  }

  // Check critical flag consistency
  if (result.critical) {
    const hasCriticalParam = result.parameters?.some(p => p.flag === 'critical');
    if (!hasCriticalParam) {
      warnings.push('Critical flag set but no parameters marked as critical');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates prescription structure before completion/print/export.
 * 
 * Checks:
 * - prescription has patientId
 * - prescription has medications
 * - each medication has name
 * - each medication has dosage
 * - each medication has frequency
 * - each medication has duration
 * - prescription has doctor
 * 
 * @param prescription - Prescription to validate
 * @returns Validation result
 */
export function validatePrescriptionStructure(
  prescription: {
    patientId?: string;
    doctor?: string;
    medications?: Array<{ name: string; dosage: string; frequency: string; duration: string }>;
  }
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check patientId
  if (!prescription.patientId) {
    errors.push('Prescription must have a patient ID');
  }

  // Check doctor
  if (!prescription.doctor || prescription.doctor.trim() === '') {
    errors.push('Prescription must have a doctor/prescriber');
  }

  // Check medications
  if (!prescription.medications || prescription.medications.length === 0) {
    errors.push('Prescription must have at least one medication');
  } else {
    prescription.medications.forEach((med, index) => {
      const medPrefix = `Medication ${index + 1}`;

      // Check medication name
      if (!med.name || med.name.trim() === '') {
        errors.push(`${medPrefix} must have a name`);
      }

      // Check dosage
      if (!med.dosage || med.dosage.trim() === '') {
        errors.push(`${medPrefix} must have a dosage`);
      }

      // Check frequency
      if (!med.frequency || med.frequency.trim() === '') {
        errors.push(`${medPrefix} must have a frequency`);
      }

      // Check duration
      if (!med.duration || med.duration.trim() === '') {
        errors.push(`${medPrefix} must have a duration`);
      }

      // Check for unreasonably long values (potential data entry error)
      if (med.name && med.name.length > 200) {
        warnings.push(`${medPrefix} name is unusually long`);
      }
      if (med.dosage && med.dosage.length > 100) {
        warnings.push(`${medPrefix} dosage is unusually long`);
      }
      if (med.frequency && med.frequency.length > 100) {
        warnings.push(`${medPrefix} frequency is unusually long`);
      }
      if (med.duration && med.duration.length > 100) {
        warnings.push(`${medPrefix} duration is unusually long`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates dose/frequency structure (no medical interpretation).
 * 
 * Structural checks only:
 * - dosage should not be empty
 * - frequency should not be empty
 * - duration should not be empty
 * - negative/zero numeric quantities should be rejected if model has quantities
 * - extremely long free-text values should be rejected or warned
 * 
 * @param medications - Array of medications to validate
 * @returns Validation result
 */
export function validateMedicationDoseStructure(
  medications: Array<{ dosage: string; frequency: string; duration: string }>
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  medications.forEach((med, index) => {
    const medPrefix = `Medication ${index + 1}`;

    // Check dosage not empty
    if (!med.dosage || med.dosage.trim() === '') {
      errors.push(`${medPrefix} dosage cannot be empty`);
    }

    // Check frequency not empty
    if (!med.frequency || med.frequency.trim() === '') {
      errors.push(`${medPrefix} frequency cannot be empty`);
    }

    // Check duration not empty
    if (!med.duration || med.duration.trim() === '') {
      errors.push(`${medPrefix} duration cannot be empty`);
    }

    // Check for negative numbers in dosage (basic numeric check)
    const dosageMatch = med.dosage.match(/-?\d+(\.\d+)?/);
    if (dosageMatch) {
      const numValue = parseFloat(dosageMatch[0]);
      if (numValue < 0) {
        errors.push(`${medPrefix} dosage cannot be negative`);
      }
      if (numValue === 0) {
        warnings.push(`${medPrefix} dosage is zero - please verify`);
      }
    }

    // Check for extremely long values
    if (med.dosage.length > 200) {
      errors.push(`${medPrefix} dosage is too long (max 200 characters)`);
    }
    if (med.frequency.length > 200) {
      errors.push(`${medPrefix} frequency is too long (max 200 characters)`);
    }
    if (med.duration.length > 200) {
      errors.push(`${medPrefix} duration is too long (max 200 characters)`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates refill request structure.
 * 
 * Checks:
 * - refill has prescriptionId
 * - refill has patientId
 * - refill has medication name
 * 
 * @param refill - Refill request to validate
 * @returns Validation result
 */
export function validateRefillStructure(
  refill: {
    prescriptionId?: string;
    patientId?: string;
    medication?: string;
  }
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!refill.prescriptionId) {
    errors.push('Refill request must have a prescription ID');
  }

  if (!refill.patientId) {
    errors.push('Refill request must have a patient ID');
  }

  if (!refill.medication || refill.medication.trim() === '') {
    errors.push('Refill request must have a medication name');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Cleans up old drafts from localStorage.
 * 
 * Requirements:
 * - Drafts older than 48 hours should be removable
 * - Do not delete active records
 * - Audit cleanup with count only, no PHI
 * 
 * @param drafts - Array of drafts with savedAt timestamp
 * @param maxAgeHours - Maximum age in hours (default: 48)
 * @returns Object with cleaned drafts and cleanup count
 */
export interface DraftWithTimestamp {
  id: string;
  savedAt: string;
}

export interface DraftCleanupResult {
  cleanedDrafts: any[];
  cleanupCount: number;
  remainingCount: number;
}

export function cleanupOldDrafts(
  drafts: DraftWithTimestamp[],
  maxAgeHours: number = 48
): DraftCleanupResult {
  const now = new Date();
  const maxAgeMs = maxAgeHours * 60 * 60 * 1000;

  const cleanedDrafts = drafts.filter(draft => {
    const savedAt = new Date(draft.savedAt);
    const age = now.getTime() - savedAt.getTime();
    return age < maxAgeMs;
  });

  const cleanupCount = drafts.length - cleanedDrafts.length;

  return {
    cleanedDrafts,
    cleanupCount,
    remainingCount: cleanedDrafts.length,
  };
}
