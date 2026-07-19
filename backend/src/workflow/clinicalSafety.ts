/**
 * Clinical Safety Helper
 * Foundation safety checks for clinical workflow operations
 * This is safety foundation, not medical decision support
 */

export interface PrescriptionSafetyCheck {
  valid: boolean;
  warnings: string[];
  errors: string[];
}

export interface LabResultSafetyCheck {
  valid: boolean;
  isCritical: boolean;
  warnings: string[];
  errors: string[];
}

export interface ConsultationSafetyCheck {
  valid: boolean;
  warnings: string[];
  errors: string[];
}

/**
 * Check prescription required fields
 */
export function checkPrescriptionRequiredFields(prescription: {
  medication?: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
}): PrescriptionSafetyCheck {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!prescription.medication || prescription.medication.trim() === '') {
    errors.push('Medication name is required');
  }

  if (!prescription.dosage || prescription.dosage.trim() === '') {
    warnings.push('Dosage is recommended');
  }

  if (!prescription.frequency || prescription.frequency.trim() === '') {
    warnings.push('Frequency is recommended');
  }

  if (!prescription.duration || prescription.duration.trim() === '') {
    warnings.push('Duration is recommended');
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
  };
}

/**
 * Check if prescription can be completed
 */
export function canCompletePrescription(prescription: {
  medication?: string;
  dosage?: string;
  status?: string;
}): PrescriptionSafetyCheck {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!prescription.medication || prescription.medication.trim() === '') {
    errors.push('Cannot complete prescription without medication name');
  }

  if (!prescription.dosage || prescription.dosage.trim() === '') {
    errors.push('Cannot complete prescription without dosage');
  }

  if (prescription.status === 'CANCELLED') {
    errors.push('Cannot complete a cancelled prescription');
  }

  if (prescription.status === 'EXPIRED') {
    errors.push('Cannot complete an expired prescription');
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
  };
}

/**
 * Check lab result critical flag
 */
export function checkLabResultCritical(result: {
  resultValue?: string;
  resultType?: string;
}): LabResultSafetyCheck {
  const warnings: string[] = [];
  const errors: string[] = [];
  let isCritical = false;

  // This is a simplified critical check foundation
  // In production, this would reference lab-specific reference ranges
  if (!result.resultValue || result.resultValue.trim() === '') {
    warnings.push('Result value is missing');
  }

  if (!result.resultType || result.resultType.trim() === '') {
    errors.push('Result type is required');
  }

  // Placeholder for critical detection logic
  // Real implementation would use reference ranges per test type
  const criticalKeywords = ['critical', 'emergency', 'panic', 'severe'];
  const resultLower = result.resultValue?.toLowerCase() || '';
  if (criticalKeywords.some(keyword => resultLower.includes(keyword))) {
    isCritical = true;
    warnings.push('Result may be critical based on value');
  }

  return {
    valid: errors.length === 0,
    isCritical,
    warnings,
    errors,
  };
}

/**
 * Check if lab result can be approved
 */
export function canApproveLabResult(result: {
  status?: string;
  resultValue?: string;
  resultType?: string;
}): LabResultSafetyCheck {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!result.resultValue || result.resultValue.trim() === '') {
    errors.push('Cannot approve result without value');
  }

  if (!result.resultType || result.resultType.trim() === '') {
    errors.push('Cannot approve result without type');
  }

  if (result.status === 'REJECTED') {
    errors.push('Cannot approve a rejected result');
  }

  if (result.status === 'APPROVED') {
    warnings.push('Result is already approved');
  }

  return {
    valid: errors.length === 0,
    isCritical: false,
    warnings,
    errors,
  };
}

/**
 * Check if lab result can be rejected
 */
export function canRejectLabResult(result: {
  status?: string;
}): LabResultSafetyCheck {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (result.status === 'APPROVED') {
    errors.push('Cannot reject an approved result');
  }

  if (result.status === 'REJECTED') {
    warnings.push('Result is already rejected');
  }

  return {
    valid: errors.length === 0,
    isCritical: false,
    warnings,
    errors,
  };
}

/**
 * Check consultation completion requirements
 */
export function canCompleteConsultation(consultation: {
  status?: string;
  chiefComplaint?: string;
  notes?: string;
}): ConsultationSafetyCheck {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (consultation.status === 'CANCELLED') {
    errors.push('Cannot complete a cancelled consultation');
  }

  if (consultation.status === 'COMPLETED') {
    warnings.push('Consultation is already completed');
  }

  if (!consultation.chiefComplaint || consultation.chiefComplaint.trim() === '') {
    warnings.push('Chief complaint is recommended for completion');
  }

  if (!consultation.notes || consultation.notes.trim() === '') {
    warnings.push('Notes are recommended for completion');
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
  };
}

/**
 * Check if patient is suitable for workflow operations
 */
export function isPatientSuitableForWorkflow(patient: {
  status?: string;
  deletedAt?: Date | null;
}): { valid: boolean; error?: string } {
  if (patient.deletedAt) {
    return { valid: false, error: 'Patient is deleted' };
  }

  if (patient.status === 'DECEASED') {
    return { valid: false, error: 'Patient is deceased' };
  }

  if (patient.status === 'TRANSFERRED') {
    return { valid: false, error: 'Patient has been transferred' };
  }

  return { valid: true };
}
