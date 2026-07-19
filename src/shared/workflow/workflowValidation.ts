/**
 * Phase 8C: Workflow Validation Helpers
 * 
 * This module provides patient reference validation and workflow safety checks
 * to prevent actions on missing, archived, or deleted patients.
 */

export interface PatientReferenceValidationOptions {
  /** Whether to require the patient to be active (not archived/inactive) */
  requireActive?: boolean;
  /** Whether to allow soft-deleted patients */
  allowDeleted?: boolean;
  /** The action being performed (for error context) */
  action?: string;
}

export interface PatientReferenceValidationResult {
  /** Whether the patient reference is valid for the requested action */
  valid: boolean;
  /** Reason for invalidity (PHI-safe, no patient names) */
  reason?: string;
  /** The patient record if valid */
  patient?: any;
}

/**
 * Validates a patient reference before workflow actions.
 * 
 * Checks:
 * - patientId exists and is non-empty
 * - patient record exists in the patients array
 * - patient is not soft-deleted (has deletedAt) unless allowDeleted is true
 * - patient status is not Archived/Inactive if requireActive is true
 * 
 * @param patientId - The patient ID to validate
 * @param patients - Array of patient records to search
 * @param options - Validation options
 * @returns Validation result with patient record if valid
 */
export function validateWorkflowPatientReference(
  patientId: string | undefined | null,
  patients: any[],
  options?: PatientReferenceValidationOptions
): PatientReferenceValidationResult {
  const { requireActive = true, allowDeleted = false, action = "action" } = options || {};

  // Check if patientId is provided
  if (!patientId || typeof patientId !== "string" || patientId.trim() === "") {
    return {
      valid: false,
      reason: `Patient ID is required for ${action}`,
    };
  }

  // Find patient in the array
  const patient = patients.find(p => p.id === patientId);
  if (!patient) {
    return {
      valid: false,
      reason: `Patient record not found for ID: ${patientId}`,
    };
  }

  // Check if patient is soft-deleted
  if (patient.deletedAt && !allowDeleted) {
    return {
      valid: false,
      reason: `Patient has been deleted (ID: ${patientId})`,
    };
  }

  // Check if patient is archived/inactive when active is required
  if (requireActive) {
    const status = (patient.status || "").toLowerCase();
    if (status === "archived" || status === "inactive") {
      return {
        valid: false,
        reason: `Patient is ${status} (ID: ${patientId}). Cannot perform ${action} on inactive patients.`,
      };
    }
  }

  return {
    valid: true,
    patient,
  };
}

/**
 * Batch validates multiple patient references.
 * Useful for detecting orphaned records across workflow modules.
 * 
 * @param records - Array of records with patientId field
 * @param patients - Array of patient records
 * @param options - Validation options
 * @returns Array of validation results
 */
export interface OrphanedRecordInfo {
  recordId: string;
  patientId: string;
  recordType: string;
  reason: string;
}

export function findOrphanedWorkflowRecords(
  records: Array<{ id: string; patientId?: string } & Record<string, any>>,
  patients: any[],
  recordType: string,
  options?: PatientReferenceValidationOptions
): OrphanedRecordInfo[] {
  const orphans: OrphanedRecordInfo[] = [];
  const { requireActive = false, allowDeleted = false } = options || {};

  for (const record of records) {
    if (!record.patientId) continue;

    const validation = validateWorkflowPatientReference(
      record.patientId,
      patients,
      { requireActive, allowDeleted, action: "record check" }
    );

    if (!validation.valid) {
      orphans.push({
        recordId: record.id,
        patientId: record.patientId,
        recordType,
        reason: validation.reason || "Unknown",
      });
    }
  }

  return orphans;
}

/**
 * Comprehensive orphaned record detection across all workflow modules.
 * This helper checks for records with missing or invalid patient references.
 * 
 * @param workflowData - Object containing arrays of workflow records by module
 * @param patients - Array of patient records
 * @returns Summary of orphaned records by module
 */
export interface WorkflowData {
  consultations?: Array<{ id: string; patientId?: string } & Record<string, any>>;
  prescriptions?: Array<{ id: string; patientId?: string } & Record<string, any>>;
  labOrders?: Array<{ id: string; patientId?: string } & Record<string, any>>;
  labResults?: Array<{ id: string; patientId?: string } & Record<string, any>>;
  invoices?: Array<{ id: string; patientId?: string } & Record<string, any>>;
  communications?: Array<{ id: string; patientId?: string } & Record<string, any>>;
}

export interface OrphanedRecordSummary {
  totalOrphans: number;
  byModule: Record<string, OrphanedRecordInfo[]>;
  details: OrphanedRecordInfo[];
}

export function detectOrphanedWorkflowRecords(
  workflowData: WorkflowData,
  patients: any[],
  options?: PatientReferenceValidationOptions
): OrphanedRecordSummary {
  const summary: OrphanedRecordSummary = {
    totalOrphans: 0,
    byModule: {},
    details: [],
  };

  const { requireActive = false, allowDeleted = false } = options || {};

  // Check consultations
  if (workflowData.consultations) {
    const orphans = findOrphanedWorkflowRecords(
      workflowData.consultations,
      patients,
      "consultation",
      { requireActive, allowDeleted }
    );
    if (orphans.length > 0) {
      summary.byModule.consultations = orphans;
      summary.details.push(...orphans);
    }
  }

  // Check prescriptions
  if (workflowData.prescriptions) {
    const orphans = findOrphanedWorkflowRecords(
      workflowData.prescriptions,
      patients,
      "prescription",
      { requireActive, allowDeleted }
    );
    if (orphans.length > 0) {
      summary.byModule.prescriptions = orphans;
      summary.details.push(...orphans);
    }
  }

  // Check lab orders
  if (workflowData.labOrders) {
    const orphans = findOrphanedWorkflowRecords(
      workflowData.labOrders,
      patients,
      "labOrder",
      { requireActive, allowDeleted }
    );
    if (orphans.length > 0) {
      summary.byModule.labOrders = orphans;
      summary.details.push(...orphans);
    }
  }

  // Check lab results
  if (workflowData.labResults) {
    const orphans = findOrphanedWorkflowRecords(
      workflowData.labResults,
      patients,
      "labResult",
      { requireActive, allowDeleted }
    );
    if (orphans.length > 0) {
      summary.byModule.labResults = orphans;
      summary.details.push(...orphans);
    }
  }

  // Check invoices
  if (workflowData.invoices) {
    const orphans = findOrphanedWorkflowRecords(
      workflowData.invoices,
      patients,
      "invoice",
      { requireActive, allowDeleted }
    );
    if (orphans.length > 0) {
      summary.byModule.invoices = orphans;
      summary.details.push(...orphans);
    }
  }

  // Check communications
  if (workflowData.communications) {
    const orphans = findOrphanedWorkflowRecords(
      workflowData.communications,
      patients,
      "communication",
      { requireActive, allowDeleted }
    );
    if (orphans.length > 0) {
      summary.byModule.communications = orphans;
      summary.details.push(...orphans);
    }
  }

  summary.totalOrphans = summary.details.length;

  return summary;
}
