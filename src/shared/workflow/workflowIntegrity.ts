/**
 * Phase 8F: Workflow Data Integrity + Consistency Checker
 * 
 * Provides safe workflow integrity scanning without data mutation.
 * Detects orphaned records, timestamp issues, invalid statuses, stale references, and PHI risks.
 * 
 * AUDIT/ACTIVITY CLEANUP PLAN (Phase 8F):
 * 
 * 1. Old Activity Cleanup:
 *    - Queue activity: Remove entries older than 90 days (currently 48 hours in Queue.tsx)
 *    - Consultation activity: Remove entries older than 180 days
 *    - Prescription activity: Remove entries older than 365 days
 *    - Lab activity: Remove entries older than 365 days
 *    - Billing activity: Remove entries older than 730 days (2 years for compliance)
 *    - Keep last 100 entries per module instead of current 50
 * 
 * 2. Audit Export:
 *    - Add admin-only export function for full audit logs
 *    - Export should include: timestamp, action, module, resourceType, resourceId, patientId, actor, role
 *    - Export should NOT include: patientName, phone, email, DOB, address, clinical notes, medication details
 *    - Export format: CSV with BOM for Excel compatibility
 *    - Export should be RBAC-gated to admin only
 * 
 * 3. Audit Retention:
 *    - Workflow audit logs: Retain for 7 years (compliance standard)
 *    - Security events: Retain for 7 years
 *    - Activity logs: Retain for 1-2 years depending on module
 *    - Implement automatic cleanup based on retention policy
 *    - Add retention policy configuration in Settings
 * 
 * 4. PHI Legacy Cleanup:
 *    - Scan all activity logs for patientName field (already done in Phase 8B)
 *    - Scan all activity logs for phone, email, DOB, address fields
 *    - Scan all activity logs for clinical text fields (diagnosis, medication, dosage, labValue)
 *    - Provide one-time cleanup function to remove PHI from legacy logs
 *    - Cleanup should be admin-only and require confirmation
 * 
 * 5. Archived Record Cleanup:
 *    - Scan for workflow records referencing archived patients
 *    - Provide option to archive or remove orphaned records
 *    - Implement soft-delete for workflow records (add deletedAt field)
 *    - Add cleanup job to remove soft-deleted records after 30 days
 * 
 * 6. Orphan Record Resolution:
 *    - Provide UI to review orphaned records
 *    - Allow bulk restore of referenced patients
 *    - Allow bulk removal of orphaned records
 *    - Log all resolution actions
 * 
 * TEMPLATE/RESULT VERSIONING PLAN (Phase 8F):
 * 
 * 1. Consultation Templates:
 *    - Location: Consultations.tsx (handleSaveTemplate, handleUpdateTemplate)
 *    - Current state: No versioning, templates stored in localStorage
 *    - Recommendation: Add version field, createdAt, updatedAt, createdBy
 *    - Implementation: Phase 8G or later
 * 
 * 2. Lab Result Versioning:
 *    - Location: Lab.tsx (labResults state)
 *    - Current state: No versioning, results stored in localStorage
 *    - Recommendation: Add version field, previousVersions array, changeReason
 *    - Implementation: Phase 8G or later
 * 
 * 3. Prescription Templates:
 *    - Location: Prescriptions.tsx (if templates exist)
 *    - Current state: No prescription templates identified
 *    - Recommendation: Add prescription template system with versioning
 *    - Implementation: Phase 8G or later
 * 
 * 4. Document Versioning:
 *    - Location: PatientProfile.tsx (Documents section)
 *    - Current state: No versioning, documents stored with uploaded timestamp
 *    - Recommendation: Add version field, previousVersions array, changeReason
 *    - Implementation: Phase 8G or later
 * 
 * 5. Communication Templates:
 *    - Location: Communications.tsx (if templates exist)
 *    - Current state: No communication templates identified
 *    - Recommendation: Add communication template system with versioning
 *    - Implementation: Phase 8G or later
 */

import type { Patient } from "../../ui/types";
import { isValidQueueStatus, isValidConsultationStatus, isValidPrescriptionStatus, isValidLabOrderStatus, isValidLabResultStatus, isValidAppointmentStatus } from "./workflowStateMachine";

export interface IntegrityIssue {
  id: string;
  module: string;
  resourceType: string;
  resourceId: string;
  patientId?: string;
  severity: "critical" | "high" | "medium" | "low";
  category: "orphaned" | "timestamp" | "status" | "phi_risk" | "reference" | "history";
  message: string;
  suggestedFix: string;
  detectedAt: string;
}

export interface IntegrityScanResult {
  summary: {
    totalIssues: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    scannedModules: string[];
    scanDuration: number;
  };
  issues: IntegrityIssue[];
  byModule: Record<string, {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  }>;
  recommendations: string[];
}

export interface WorkflowData {
  patients: Patient[];
  consultations?: any[];
  prescriptions?: any[];
  labOrders?: any[];
  labResults?: any[];
  invoices?: any[];
  communications?: any[];
  queue?: any[];
  waitlist?: any[];
  queueActivity?: any[];
  consultationActivity?: any[];
  prescriptionActivity?: any[];
  labActivity?: any[];
  billingActivity?: any[];
}

export interface IntegrityScanOptions {
  includePHIRiskScan?: boolean;
  includeTimestampValidation?: boolean;
  includeStatusValidation?: boolean;
  includeStatusHistoryReview?: boolean;
}

/**
 * Main workflow integrity scanner
 * Never mutates data, only reports issues
 */
export function scanWorkflowIntegrity(
  data: WorkflowData,
  options: IntegrityScanOptions = {}
): IntegrityScanResult {
  const startTime = Date.now();
  const issues: IntegrityIssue[] = [];
  const scannedModules: string[] = [];

  const opts = {
    includePHIRiskScan: true,
    includeTimestampValidation: true,
    includeStatusValidation: true,
    includeStatusHistoryReview: true,
    ...options,
  };

  // Scan patients
  if (data.patients) {
    scannedModules.push("patients");
    issues.push(...scanPatients(data.patients, data));
  }

  // Scan consultations
  if (data.consultations) {
    scannedModules.push("consultations");
    issues.push(...scanConsultations(data.consultations, data.patients, opts));
  }

  // Scan prescriptions
  if (data.prescriptions) {
    scannedModules.push("prescriptions");
    issues.push(...scanPrescriptions(data.prescriptions, data.patients, opts));
  }

  // Scan lab orders
  if (data.labOrders) {
    scannedModules.push("labOrders");
    issues.push(...scanLabOrders(data.labOrders, data.patients, data.labResults, opts));
  }

  // Scan lab results
  if (data.labResults) {
    scannedModules.push("labResults");
    issues.push(...scanLabResults(data.labResults, data.patients, data.labOrders, opts));
  }

  // Scan invoices
  if (data.invoices) {
    scannedModules.push("invoices");
    issues.push(...scanInvoices(data.invoices, data.patients, opts));
  }

  // Scan communications
  if (data.communications) {
    scannedModules.push("communications");
    issues.push(...scanCommunications(data.communications, data.patients, opts));
  }

  // Scan queue
  if (data.queue) {
    scannedModules.push("queue");
    issues.push(...scanQueue(data.queue, data.patients, opts));
  }

  // Scan waitlist
  if (data.waitlist) {
    scannedModules.push("waitlist");
    issues.push(...scanWaitlist(data.waitlist, data.patients, opts));
  }

  // Scan activity logs for PHI risks
  if (opts.includePHIRiskScan) {
    if (data.queueActivity) {
      scannedModules.push("queueActivity");
      issues.push(...scanActivityForPHIRisks(data.queueActivity, "queue"));
    }
    if (data.consultationActivity) {
      scannedModules.push("consultationActivity");
      issues.push(...scanActivityForPHIRisks(data.consultationActivity, "consultations"));
    }
    if (data.prescriptionActivity) {
      scannedModules.push("prescriptionActivity");
      issues.push(...scanActivityForPHIRisks(data.prescriptionActivity, "prescriptions"));
    }
    if (data.labActivity) {
      scannedModules.push("labActivity");
      issues.push(...scanActivityForPHIRisks(data.labActivity, "lab"));
    }
    if (data.billingActivity) {
      scannedModules.push("billingActivity");
      issues.push(...scanActivityForPHIRisks(data.billingActivity, "billing"));
    }
  }

  // Calculate summary
  const summary = {
    totalIssues: issues.length,
    critical: issues.filter(i => i.severity === "critical").length,
    high: issues.filter(i => i.severity === "high").length,
    medium: issues.filter(i => i.severity === "medium").length,
    low: issues.filter(i => i.severity === "low").length,
    scannedModules,
    scanDuration: Date.now() - startTime,
  };

  // Calculate byModule breakdown
  const byModule: Record<string, any> = {};
  issues.forEach(issue => {
    if (!byModule[issue.module]) {
      byModule[issue.module] = { total: 0, critical: 0, high: 0, medium: 0, low: 0 };
    }
    byModule[issue.module].total++;
    byModule[issue.module][issue.severity]++;
  });

  // Generate recommendations
  const recommendations = generateRecommendations(issues);

  return {
    summary,
    issues,
    byModule,
    recommendations,
  };
}

/**
 * Scan patients for orphaned or invalid records
 */
function scanPatients(patients: Patient[], data: WorkflowData): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];

  for (const patient of patients) {
    // Check for deleted patients with active workflow references
    if (patient.deletedAt) {
      // Check if patient has active appointments
      if (patient.nextAppointment) {
        const apptDate = new Date(patient.nextAppointment);
        if (apptDate > new Date()) {
          issues.push({
            id: `patient-${patient.id}-deleted-with-future-appt`,
            module: "patients",
            resourceType: "patient",
            resourceId: patient.id,
            patientId: patient.id,
            severity: "high",
            category: "orphaned",
            message: "Deleted patient has future appointment",
            suggestedFix: "Restore patient or cancel appointment",
            detectedAt: new Date().toISOString(),
          });
        }
      }
    }

    // Check timestamp sequence
    if (patient.deletedAt && patient.createdAt) {
      if (new Date(patient.deletedAt) < new Date(patient.createdAt)) {
        issues.push({
          id: `patient-${patient.id}-invalid-delete-timestamp`,
          module: "patients",
          resourceType: "patient",
          resourceId: patient.id,
          patientId: patient.id,
          severity: "medium",
          category: "timestamp",
          message: "Deleted timestamp before creation timestamp",
          suggestedFix: "Review patient timestamps",
          detectedAt: new Date().toISOString(),
        });
      }
    }
  }

  return issues;
}

/**
 * Scan consultations for integrity issues
 */
function scanConsultations(consultations: any[], patients: Patient[], opts: IntegrityScanOptions): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];

  for (const consultation of consultations) {
    // Check patient reference
    if (consultation.patientId) {
      const patient = patients.find(p => p.id === consultation.patientId);
      if (!patient) {
        issues.push({
          id: `consultation-${consultation.id}-missing-patient`,
          module: "consultations",
          resourceType: "consultation",
          resourceId: consultation.id,
          patientId: consultation.patientId,
          severity: "critical",
          category: "orphaned",
          message: "Consultation references missing patient",
          suggestedFix: "Restore patient or remove consultation",
          detectedAt: new Date().toISOString(),
        });
      } else if (patient.deletedAt) {
        issues.push({
          id: `consultation-${consultation.id}-deleted-patient`,
          module: "consultations",
          resourceType: "consultation",
          resourceId: consultation.id,
          patientId: consultation.patientId,
          severity: "high",
          category: "orphaned",
          message: "Consultation references deleted patient",
          suggestedFix: "Restore patient or remove consultation",
          detectedAt: new Date().toISOString(),
        });
      }
    }

    // Check status validation
    if (opts.includeStatusValidation && consultation.status) {
      if (!isValidConsultationStatus(consultation.status)) {
        issues.push({
          id: `consultation-${consultation.id}-invalid-status`,
          module: "consultations",
          resourceType: "consultation",
          resourceId: consultation.id,
          patientId: consultation.patientId,
          severity: "medium",
          category: "status",
          message: `Invalid consultation status: ${consultation.status}`,
          suggestedFix: "Update to valid status (pending, in-progress, completed, cancelled)",
          detectedAt: new Date().toISOString(),
        });
      }
    }

    // Check timestamp sequence
    if (opts.includeTimestampValidation) {
      if (consultation.createdAt && consultation.updatedAt) {
        if (new Date(consultation.updatedAt) < new Date(consultation.createdAt)) {
          issues.push({
            id: `consultation-${consultation.id}-invalid-timestamp`,
            module: "consultations",
            resourceType: "consultation",
            resourceId: consultation.id,
            patientId: consultation.patientId,
            severity: "medium",
            category: "timestamp",
            message: "Updated timestamp before creation timestamp",
            suggestedFix: "Review consultation timestamps",
            detectedAt: new Date().toISOString(),
          });
        }
      }
      if (consultation.startedAt && consultation.completedAt) {
        if (new Date(consultation.completedAt) < new Date(consultation.startedAt)) {
          issues.push({
            id: `consultation-${consultation.id}-invalid-completion-timestamp`,
            module: "consultations",
            resourceType: "consultation",
            resourceId: consultation.id,
            patientId: consultation.patientId,
            severity: "medium",
            category: "timestamp",
            message: "Completed timestamp before started timestamp",
            suggestedFix: "Review consultation timestamps",
            detectedAt: new Date().toISOString(),
          });
        }
      }
    }

    // Check status history
    if (opts.includeStatusHistoryReview && consultation.statusHistory) {
      issues.push(...scanStatusHistory(consultation.statusHistory, consultation.id, "consultation", consultation.patientId));
    }
  }

  return issues;
}

/**
 * Scan prescriptions for integrity issues
 */
function scanPrescriptions(prescriptions: any[], patients: Patient[], opts: IntegrityScanOptions): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];

  for (const prescription of prescriptions) {
    // Check patient reference
    if (prescription.patientId) {
      const patient = patients.find(p => p.id === prescription.patientId);
      if (!patient) {
        issues.push({
          id: `prescription-${prescription.id}-missing-patient`,
          module: "prescriptions",
          resourceType: "prescription",
          resourceId: prescription.id,
          patientId: prescription.patientId,
          severity: "critical",
          category: "orphaned",
          message: "Prescription references missing patient",
          suggestedFix: "Restore patient or remove prescription",
          detectedAt: new Date().toISOString(),
        });
      } else if (patient.deletedAt) {
        issues.push({
          id: `prescription-${prescription.id}-deleted-patient`,
          module: "prescriptions",
          resourceType: "prescription",
          resourceId: prescription.id,
          patientId: prescription.patientId,
          severity: "high",
          category: "orphaned",
          message: "Prescription references deleted patient",
          suggestedFix: "Restore patient or remove prescription",
          detectedAt: new Date().toISOString(),
        });
      }
    }

    // Check status validation
    if (opts.includeStatusValidation && prescription.status) {
      if (!isValidPrescriptionStatus(prescription.status)) {
        issues.push({
          id: `prescription-${prescription.id}-invalid-status`,
          module: "prescriptions",
          resourceType: "prescription",
          resourceId: prescription.id,
          patientId: prescription.patientId,
          severity: "medium",
          category: "status",
          message: `Invalid prescription status: ${prescription.status}`,
          suggestedFix: "Update to valid status (active, completed, cancelled)",
          detectedAt: new Date().toISOString(),
        });
      }
    }

    // Check timestamp sequence
    if (opts.includeTimestampValidation && prescription.createdAt && prescription.completedAt) {
      if (new Date(prescription.completedAt) < new Date(prescription.createdAt)) {
        issues.push({
          id: `prescription-${prescription.id}-invalid-completion-timestamp`,
          module: "prescriptions",
          resourceType: "prescription",
          resourceId: prescription.id,
          patientId: prescription.patientId,
          severity: "medium",
          category: "timestamp",
          message: "Completed timestamp before creation timestamp",
          suggestedFix: "Review prescription timestamps",
          detectedAt: new Date().toISOString(),
        });
      }
    }
  }

  return issues;
}

/**
 * Scan lab orders for integrity issues
 */
function scanLabOrders(labOrders: any[], patients: Patient[], labResults: any[] = [], opts: IntegrityScanOptions): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];

  for (const labOrder of labOrders) {
    // Check patient reference
    if (labOrder.patientId) {
      const patient = patients.find(p => p.id === labOrder.patientId);
      if (!patient) {
        issues.push({
          id: `labOrder-${labOrder.id}-missing-patient`,
          module: "labOrders",
          resourceType: "labOrder",
          resourceId: labOrder.id,
          patientId: labOrder.patientId,
          severity: "critical",
          category: "orphaned",
          message: "Lab order references missing patient",
          suggestedFix: "Restore patient or remove lab order",
          detectedAt: new Date().toISOString(),
        });
      } else if (patient.deletedAt) {
        issues.push({
          id: `labOrder-${labOrder.id}-deleted-patient`,
          module: "labOrders",
          resourceType: "labOrder",
          resourceId: labOrder.id,
          patientId: labOrder.patientId,
          severity: "high",
          category: "orphaned",
          message: "Lab order references deleted patient",
          suggestedFix: "Restore patient or remove lab order",
          detectedAt: new Date().toISOString(),
        });
      }
    }

    // Check status validation
    if (opts.includeStatusValidation && labOrder.status) {
      if (!isValidLabOrderStatus(labOrder.status)) {
        issues.push({
          id: `labOrder-${labOrder.id}-invalid-status`,
          module: "labOrders",
          resourceType: "labOrder",
          resourceId: labOrder.id,
          patientId: labOrder.patientId,
          severity: "medium",
          category: "status",
          message: `Invalid lab order status: ${labOrder.status}`,
          suggestedFix: "Update to valid status (pending, in-progress, completed, cancelled)",
          detectedAt: new Date().toISOString(),
        });
      }
    }
  }

  return issues;
}

/**
 * Scan lab results for integrity issues
 */
function scanLabResults(labResults: any[], patients: Patient[], labOrders: any[] = [], opts: IntegrityScanOptions): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];

  for (const labResult of labResults) {
    // Check patient reference
    if (labResult.patientId) {
      const patient = patients.find(p => p.id === labResult.patientId);
      if (!patient) {
        issues.push({
          id: `labResult-${labResult.id}-missing-patient`,
          module: "labResults",
          resourceType: "labResult",
          resourceId: labResult.id,
          patientId: labResult.patientId,
          severity: "critical",
          category: "orphaned",
          message: "Lab result references missing patient",
          suggestedFix: "Restore patient or remove lab result",
          detectedAt: new Date().toISOString(),
        });
      } else if (patient.deletedAt) {
        issues.push({
          id: `labResult-${labResult.id}-deleted-patient`,
          module: "labResults",
          resourceType: "labResult",
          resourceId: labResult.id,
          patientId: labResult.patientId,
          severity: "high",
          category: "orphaned",
          message: "Lab result references deleted patient",
          suggestedFix: "Restore patient or remove lab result",
          detectedAt: new Date().toISOString(),
        });
      }
    }

    // Check lab order reference
    if (labResult.orderId) {
      const labOrder = labOrders.find(lo => lo.id === labResult.orderId);
      if (!labOrder) {
        issues.push({
          id: `labResult-${labResult.id}-missing-order`,
          module: "labResults",
          resourceType: "labResult",
          resourceId: labResult.id,
          patientId: labResult.patientId,
          severity: "high",
          category: "reference",
          message: "Lab result references missing lab order",
          suggestedFix: "Restore lab order or remove lab result",
          detectedAt: new Date().toISOString(),
        });
      }
    }

    // Check status validation
    if (opts.includeStatusValidation && labResult.status) {
      if (!isValidLabResultStatus(labResult.status)) {
        issues.push({
          id: `labResult-${labResult.id}-invalid-status`,
          module: "labResults",
          resourceType: "labResult",
          resourceId: labResult.id,
          patientId: labResult.patientId,
          severity: "medium",
          category: "status",
          message: `Invalid lab result status: ${labResult.status}`,
          suggestedFix: "Update to valid status (pending, review, approved, rejected)",
          detectedAt: new Date().toISOString(),
        });
      }
    }

    // Check timestamp sequence
    if (opts.includeTimestampValidation && labResult.createdAt && labResult.approvedAt) {
      if (new Date(labResult.approvedAt) < new Date(labResult.createdAt)) {
        issues.push({
          id: `labResult-${labResult.id}-invalid-approval-timestamp`,
          module: "labResults",
          resourceType: "labResult",
          resourceId: labResult.id,
          patientId: labResult.patientId,
          severity: "medium",
          category: "timestamp",
          message: "Approved timestamp before creation timestamp",
          suggestedFix: "Review lab result timestamps",
          detectedAt: new Date().toISOString(),
        });
      }
    }
  }

  return issues;
}

/**
 * Scan invoices for integrity issues
 */
function scanInvoices(invoices: any[], patients: Patient[], opts: IntegrityScanOptions): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];

  for (const invoice of invoices) {
    // Check patient reference
    if (invoice.patientId) {
      const patient = patients.find(p => p.id === invoice.patientId);
      if (!patient) {
        issues.push({
          id: `invoice-${invoice.id}-missing-patient`,
          module: "invoices",
          resourceType: "invoice",
          resourceId: invoice.id,
          patientId: invoice.patientId,
          severity: "critical",
          category: "orphaned",
          message: "Invoice references missing patient",
          suggestedFix: "Restore patient or remove invoice",
          detectedAt: new Date().toISOString(),
        });
      } else if (patient.deletedAt) {
        issues.push({
          id: `invoice-${invoice.id}-deleted-patient`,
          module: "invoices",
          resourceType: "invoice",
          resourceId: invoice.id,
          patientId: invoice.patientId,
          severity: "high",
          category: "orphaned",
          message: "Invoice references deleted patient",
          suggestedFix: "Restore patient or remove invoice",
          detectedAt: new Date().toISOString(),
        });
      }
    }

    // Check timestamp sequence
    if (opts.includeTimestampValidation && invoice.createdAt && invoice.paymentDate) {
      if (new Date(invoice.paymentDate) < new Date(invoice.createdAt)) {
        issues.push({
          id: `invoice-${invoice.id}-invalid-payment-timestamp`,
          module: "invoices",
          resourceType: "invoice",
          resourceId: invoice.id,
          patientId: invoice.patientId,
          severity: "medium",
          category: "timestamp",
          message: "Payment date before invoice creation date",
          suggestedFix: "Review invoice timestamps",
          detectedAt: new Date().toISOString(),
        });
      }
    }
  }

  return issues;
}

/**
 * Scan communications for integrity issues
 */
function scanCommunications(communications: any[], patients: Patient[], opts: IntegrityScanOptions): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];

  for (const communication of communications) {
    // Check patient reference
    if (communication.patientId) {
      const patient = patients.find(p => p.id === communication.patientId);
      if (!patient) {
        issues.push({
          id: `communication-${communication.id}-missing-patient`,
          module: "communications",
          resourceType: "communication",
          resourceId: communication.id,
          patientId: communication.patientId,
          severity: "critical",
          category: "orphaned",
          message: "Communication references missing patient",
          suggestedFix: "Restore patient or remove communication",
          detectedAt: new Date().toISOString(),
        });
      } else if (patient.deletedAt) {
        issues.push({
          id: `communication-${communication.id}-deleted-patient`,
          module: "communications",
          resourceType: "communication",
          resourceId: communication.id,
          patientId: communication.patientId,
          severity: "high",
          category: "orphaned",
          message: "Communication references deleted patient",
          suggestedFix: "Restore patient or remove communication",
          detectedAt: new Date().toISOString(),
        });
      }
    }
  }

  return issues;
}

/**
 * Scan queue for integrity issues
 */
function scanQueue(queue: any[], patients: Patient[], opts: IntegrityScanOptions): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];

  for (const queueEntry of queue) {
    // Check patient reference
    if (queueEntry.patientId) {
      const patient = patients.find(p => p.id === queueEntry.patientId);
      if (!patient) {
        issues.push({
          id: `queue-${queueEntry.id}-missing-patient`,
          module: "queue",
          resourceType: "queue",
          resourceId: queueEntry.id,
          patientId: queueEntry.patientId,
          severity: "critical",
          category: "orphaned",
          message: "Queue entry references missing patient",
          suggestedFix: "Restore patient or remove queue entry",
          detectedAt: new Date().toISOString(),
        });
      } else if (patient.deletedAt) {
        issues.push({
          id: `queue-${queueEntry.id}-deleted-patient`,
          module: "queue",
          resourceType: "queue",
          resourceId: queueEntry.id,
          patientId: queueEntry.patientId,
          severity: "high",
          category: "orphaned",
          message: "Queue entry references deleted patient",
          suggestedFix: "Restore patient or remove queue entry",
          detectedAt: new Date().toISOString(),
        });
      }
    }

    // Check status validation
    if (opts.includeStatusValidation && queueEntry.status) {
      if (!isValidQueueStatus(queueEntry.status)) {
        issues.push({
          id: `queue-${queueEntry.id}-invalid-status`,
          module: "queue",
          resourceType: "queue",
          resourceId: queueEntry.id,
          patientId: queueEntry.patientId,
          severity: "medium",
          category: "status",
          message: `Invalid queue status: ${queueEntry.status}`,
          suggestedFix: "Update to valid queue status",
          detectedAt: new Date().toISOString(),
        });
      }
    }
  }

  return issues;
}

/**
 * Scan waitlist for integrity issues
 */
function scanWaitlist(waitlist: any[], patients: Patient[], opts: IntegrityScanOptions): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];

  for (const waitlistEntry of waitlist) {
    // Check patient reference
    if (waitlistEntry.patientId) {
      const patient = patients.find(p => p.id === waitlistEntry.patientId);
      if (!patient) {
        issues.push({
          id: `waitlist-${waitlistEntry.id}-missing-patient`,
          module: "waitlist",
          resourceType: "waitlist",
          resourceId: waitlistEntry.id,
          patientId: waitlistEntry.patientId,
          severity: "critical",
          category: "orphaned",
          message: "Waitlist entry references missing patient",
          suggestedFix: "Restore patient or remove waitlist entry",
          detectedAt: new Date().toISOString(),
        });
      } else if (patient.deletedAt) {
        issues.push({
          id: `waitlist-${waitlistEntry.id}-deleted-patient`,
          module: "waitlist",
          resourceType: "waitlist",
          resourceId: waitlistEntry.id,
          patientId: waitlistEntry.patientId,
          severity: "high",
          category: "orphaned",
          message: "Waitlist entry references deleted patient",
          suggestedFix: "Restore patient or remove waitlist entry",
          detectedAt: new Date().toISOString(),
        });
      }
    }
  }

  return issues;
}

/**
 * Scan activity logs for PHI risks
 */
function scanActivityForPHIRisks(activity: any[], module: string): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  const suspiciousFields = [
    "patientName",
    "name",
    "phone",
    "email",
    "dob",
    "address",
    "note",
    "diagnosis",
    "medication",
    "dosage",
    "labValue",
    "resultValue",
    "messageBody",
    "documentTitle",
  ];

  for (const entry of activity) {
    for (const field of suspiciousFields) {
      if (entry[field] !== undefined && entry[field] !== null && entry[field] !== "") {
        issues.push({
          id: `activity-${module}-${entry.id || entry.timestamp}-phi-risk-${field}`,
          module: `${module}Activity`,
          resourceType: "activity",
          resourceId: entry.id || entry.timestamp,
          patientId: entry.patientId,
          severity: "high",
          category: "phi_risk",
          message: `Activity log contains potentially sensitive field: ${field}`,
          suggestedFix: "Remove sensitive field from activity log",
          detectedAt: new Date().toISOString(),
        });
        // Only report one field per entry to avoid spam
        break;
      }
    }
  }

  return issues;
}

/**
 * Scan status history for integrity issues
 */
function scanStatusHistory(statusHistory: any[], resourceId: string, module: string, patientId?: string): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];

  if (!Array.isArray(statusHistory)) {
    return issues;
  }

  for (let i = 0; i < statusHistory.length; i++) {
    const entry = statusHistory[i];

    // Check required fields
    if (!entry.from || !entry.to) {
      issues.push({
        id: `${module}-${resourceId}-status-history-${i}-missing-fields`,
        module,
        resourceType: module,
        resourceId,
        patientId,
        severity: "medium",
        category: "history",
        message: "Status history entry missing from/to fields",
        suggestedFix: "Add missing from/to fields to status history",
        detectedAt: new Date().toISOString(),
      });
    }

    // Check timestamp
    if (!entry.changedAt) {
      issues.push({
        id: `${module}-${resourceId}-status-history-${i}-missing-timestamp`,
        module,
        resourceType: module,
        resourceId,
        patientId,
        severity: "medium",
        category: "history",
        message: "Status history entry missing changedAt timestamp",
        suggestedFix: "Add changedAt timestamp to status history",
        detectedAt: new Date().toISOString(),
      });
    }

    // Check chronological order
    if (i > 0 && entry.changedAt && statusHistory[i - 1].changedAt) {
      if (new Date(entry.changedAt) < new Date(statusHistory[i - 1].changedAt)) {
        issues.push({
          id: `${module}-${resourceId}-status-history-${i}-chronological-disorder`,
          module,
          resourceType: module,
          resourceId,
          patientId,
          severity: "low",
          category: "history",
          message: "Status history entries not in chronological order",
          suggestedFix: "Review status history timestamps",
          detectedAt: new Date().toISOString(),
        });
      }
    }
  }

  return issues;
}

/**
 * Generate recommendations based on issues found
 */
function generateRecommendations(issues: IntegrityIssue[]): string[] {
  const recommendations: string[] = [];

  const orphanedCount = issues.filter(i => i.category === "orphaned").length;
  if (orphanedCount > 0) {
    recommendations.push(`Resolve ${orphanedCount} orphaned records by restoring referenced patients or removing invalid references.`);
  }

  const timestampCount = issues.filter(i => i.category === "timestamp").length;
  if (timestampCount > 0) {
    recommendations.push(`Review and fix ${timestampCount} timestamp sequence issues in workflow records.`);
  }

  const statusCount = issues.filter(i => i.category === "status").length;
  if (statusCount > 0) {
    recommendations.push(`Update ${statusCount} records with invalid status values to valid workflow statuses.`);
  }

  const phiRiskCount = issues.filter(i => i.category === "phi_risk").length;
  if (phiRiskCount > 0) {
    recommendations.push(`Remove sensitive fields from ${phiRiskCount} activity log entries to comply with PHI safety requirements.`);
  }

  const historyCount = issues.filter(i => i.category === "history").length;
  if (historyCount > 0) {
    recommendations.push(`Review and fix ${historyCount} status history issues for complete audit trails.`);
  }

  if (recommendations.length === 0) {
    recommendations.push("No integrity issues detected. Continue monitoring workflow data regularly.");
  }

  return recommendations;
}
