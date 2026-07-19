/**
 * Phase 8B: PHI-Safe Workflow Audit Helper
 * 
 * Provides safe workflow audit logging that never stores PHI.
 * All patient references use patientId only, never patientName.
 */

import { logAction } from "../services/auditLogger";
import type { AuditAction, AuditResourceType } from "../../modules/audit/services/auditService";

export interface WorkflowAuditOptions {
  action: string;
  module: string;
  resourceType: AuditResourceType;
  resourceId?: string;
  patientId?: string;
  actor?: string;
  role?: string;
  statusFrom?: string;
  statusTo?: string;
  success: boolean;
  reason?: string;
  metadata?: Record<string, unknown>;
}

/**
 * PHI-safe workflow audit logging
 * 
 * Requirements:
 * - Never logs patient name
 * - Never logs phone, email, DOB, address, diagnosis, clinical note text
 * - Never logs prescription details, lab result values, insurance details
 * - Never logs document titles/content, message bodies, or full records
 * - Logs patient ID only when needed
 * - Safely sanitizes metadata
 * - Never throws
 * - Calls existing shared audit logger
 */
export function logWorkflowAction(options: WorkflowAuditOptions): void {
  try {
    // Sanitize metadata to ensure no PHI
    const sanitizedMetadata = sanitizeMetadata(options.metadata || {});
    
    // Remove any potentially PHI fields from metadata
    const safeMetadata: Record<string, unknown> = {
      ...sanitizedMetadata,
      // Explicitly block common PHI fields
      patientName: undefined,
      patientPhone: undefined,
      patientEmail: undefined,
      patientDOB: undefined,
      patientAddress: undefined,
      diagnosis: undefined,
      symptoms: undefined,
      treatment: undefined,
      notes: undefined,
      prescriptionDetails: undefined,
      labResultValues: undefined,
      insuranceDetails: undefined,
      documentContent: undefined,
      messageBody: undefined,
    };
    
    // Build safe details string
    let details = options.action;
    if (options.statusFrom && options.statusTo) {
      details += ` (${options.statusFrom} → ${options.statusTo})`;
    }
    if (options.reason) {
      details += `: ${options.reason}`;
    }
    
    // Call shared audit logger
    logAction({
      action: options.action as AuditAction,
      resourceType: options.resourceType,
      resourceId: options.resourceId || options.patientId,
      details,
      success: options.success,
      metadata: {
        module: options.module,
        patientId: options.patientId,
        actor: options.actor,
        role: options.role,
        statusFrom: options.statusFrom,
        statusTo: options.statusTo,
        ...safeMetadata,
      },
    });
  } catch (error) {
    // Never throw - fail silently for audit logging
    console.error("[WorkflowAudit] Failed to log workflow action:", error);
  }
}

/**
 * Sanitize metadata to remove PHI
 */
function sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  
  const phiFields = [
    'name', 'patientName', 'patient_name',
    'phone', 'patientPhone', 'patient_phone',
    'email', 'patientEmail', 'patient_email',
    'dob', 'patientDOB', 'patient_dob',
    'address', 'patientAddress', 'patient_address',
    'diagnosis', 'symptoms', 'treatment', 'notes',
    'prescriptionDetails', 'prescription_details',
    'labResultValues', 'lab_result_values',
    'insuranceDetails', 'insurance_details',
    'documentContent', 'document_content',
    'messageBody', 'message_body',
  ];
  
  for (const [key, value] of Object.entries(metadata)) {
    const lowerKey = key.toLowerCase();
    
    // Skip PHI fields
    if (phiFields.some(phi => lowerKey.includes(phi.toLowerCase()))) {
      continue;
    }
    
    // Recursively sanitize nested objects
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeMetadata(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      // For arrays, check if they contain objects and sanitize those
      const sanitizedArray = value.map(item => {
        if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
          return sanitizeMetadata(item as Record<string, unknown>);
        }
        return item;
      });
      sanitized[key] = sanitizedArray;
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}
