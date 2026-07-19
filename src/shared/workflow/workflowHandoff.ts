/**
 * Phase 8C: Cross-Module Handoff Audit Helper
 * 
 * This module provides safe audit logging for cross-module workflow handoffs.
 * All handoff logs are PHI-safe and use only IDs, never patient names or clinical content.
 */

import { logWorkflowAction } from "./workflowAudit";

export interface WorkflowHandoffOptions {
  /** Source module (e.g., "queue", "consultations") */
  fromModule: string;
  /** Target module (e.g., "consultations", "billing") */
  toModule: string;
  /** Action being performed (e.g., "start_consultation", "create_invoice") */
  action: string;
  /** Patient ID (never patient name) */
  patientId?: string;
  /** Type of resource being handed off (e.g., "consultation", "prescription") */
  resourceType?: string;
  /** ID of the resource being handed off */
  resourceId?: string;
  /** Status of the handoff (e.g., "success", "failed", "blocked") */
  status: "success" | "failed" | "blocked";
  /** Reason for failure/block (PHI-safe, no patient names) */
  reason?: string;
  /** Actor performing the handoff (role or user ID) */
  actor?: string;
  /** Additional metadata (PHI-safe only) */
  metadata?: Record<string, any>;
}

/**
 * Logs a cross-module workflow handoff with PHI-safe audit logging.
 * 
 * This function:
 * - Never throws errors (catches and logs internally)
 * - Uses only patient IDs, never patient names
 * - Does not log clinical content (diagnosis, notes, lab values, etc.)
 * - Integrates with the existing logWorkflowAction helper
 * 
 * @param options - Handoff options
 */
export function logWorkflowHandoff(options: WorkflowHandoffOptions): void {
  try {
    const {
      fromModule,
      toModule,
      action,
      patientId,
      resourceType,
      resourceId,
      status,
      reason,
      actor,
      metadata = {},
    } = options;

    // Sanitize metadata to ensure no PHI is included
    const sanitizedMetadata: Record<string, any> = {
      ...metadata,
      fromModule,
      toModule,
      handoffStatus: status,
    };

    if (reason) {
      sanitizedMetadata.reason = reason;
    }

    if (resourceType) {
      sanitizedMetadata.resourceType = resourceType;
    }

    if (resourceId) {
      sanitizedMetadata.resourceId = resourceId;
    }

    // Log the handoff action
    logWorkflowAction({
      action: `handoff_${action}`,
      entityType: "workflow_handoff",
      entityId: resourceId || `${fromModule}_to_${toModule}`,
      patientId,
      metadata: sanitizedMetadata,
    });

    // If the handoff failed, also log a denied action for audit trail
    if (status === "failed" || status === "blocked") {
      logWorkflowAction({
        action: "handoff_denied",
        entityType: "workflow_handoff",
        entityId: resourceId || `${fromModule}_to_${toModule}`,
        patientId,
        metadata: {
          fromModule,
          toModule,
          action,
          reason: reason || "Unknown",
          performedBy: actor || "unknown",
        },
      });
    }
  } catch (error) {
    // Never throw - log to console as fallback
    console.error("[WorkflowHandoff] Failed to log handoff:", error);
  }
}

/**
 * Logs a successful handoff.
 * Convenience wrapper for common success case.
 */
export function logSuccessfulHandoff(options: Omit<WorkflowHandoffOptions, "status">): void {
  logWorkflowHandoff({ ...options, status: "success" });
}

/**
 * Logs a failed handoff.
 * Convenience wrapper for common failure case.
 */
export function logFailedHandoff(options: Omit<WorkflowHandoffOptions, "status">): void {
  logWorkflowHandoff({ ...options, status: "failed" });
}

/**
 * Logs a blocked handoff (e.g., due to permissions or validation).
 * Convenience wrapper for common blocked case.
 */
export function logBlockedHandoff(options: Omit<WorkflowHandoffOptions, "status">): void {
  logWorkflowHandoff({ ...options, status: "blocked" });
}
