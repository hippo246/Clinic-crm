/**
 * Audit Logger
 * Thin shared wrapper around audit/security services
 * These functions never throw and are safe to use anywhere
 */

import { logAuditEntry as logAuditEntryService, getAuditLogs, getPatientAudit, exportAuditLogs } from "../../modules/audit/services/auditService";
import { logSecurityEvent as logSecurityEventService, getSecurityEvents, exportSecurityEvents } from "../../modules/security/services/securityService";
import type { AuditAction, AuditSeverity, AuditResourceType } from "../../modules/audit/services/auditService";
import type { SecurityEventType, SecuritySeverity } from "../../modules/security/services/securityService";

/**
 * Log a generic action
 */
export function logAction(params: {
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId?: string;
  resourceLabel?: string;
  details?: string;
  success?: boolean;
  errorMessage?: string;
  metadata?: Record<string, any>;
}): void {
  try {
    logAuditEntryService({
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      resourceLabel: params.resourceLabel,
      details: params.details,
      success: params.success,
      errorMessage: params.errorMessage,
      metadata: params.metadata,
    });
  } catch {
    // Fail silently
  }
}

/**
 * Log an access event
 */
export function logAccess(params: {
  resourceType: AuditResourceType;
  resourceId?: string;
  resourceLabel?: string;
  details?: string;
}): void {
  try {
    logAuditEntryService({
      action: "view",
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      resourceLabel: params.resourceLabel,
      details: params.details,
      severity: "info",
      success: true,
    });
  } catch {
    // Fail silently
  }
}

/**
 * Log a modification event
 */
export function logModification(params: {
  resourceType: AuditResourceType;
  resourceId?: string;
  resourceLabel?: string;
  details?: string;
  success?: boolean;
  errorMessage?: string;
}): void {
  try {
    logAuditEntryService({
      action: "update",
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      resourceLabel: params.resourceLabel,
      details: params.details,
      severity: "low",
      success: params.success,
      errorMessage: params.errorMessage,
    });
  } catch {
    // Fail silently
  }
}

/**
 * Log an export event
 */
export function logExport(params: {
  resourceType: AuditResourceType;
  resourceId?: string;
  resourceLabel?: string;
  details?: string;
  recordCount?: number;
}): void {
  try {
    logAuditEntryService({
      action: "export",
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      resourceLabel: params.resourceLabel,
      details: params.details,
      severity: "medium",
      success: true,
      metadata: { recordCount: params.recordCount },
    });
  } catch {
    // Fail silently
  }
}

/**
 * Log a deletion event
 */
export function logDeletion(params: {
  resourceType: AuditResourceType;
  resourceId?: string;
  resourceLabel?: string;
  details?: string;
  success?: boolean;
  errorMessage?: string;
}): void {
  try {
    logAuditEntryService({
      action: "delete",
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      resourceLabel: params.resourceLabel,
      details: params.details,
      severity: "high",
      success: params.success,
      errorMessage: params.errorMessage,
    });
  } catch {
    // Fail silently
  }
}

/**
 * Log a permission denied event
 */
export function logPermissionDenied(params: {
  resourceType: AuditResourceType;
  resourceId?: string;
  resourceLabel?: string;
  details?: string;
}): void {
  try {
    logAuditEntryService({
      action: "permission_denied",
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      resourceLabel: params.resourceLabel,
      details: params.details,
      severity: "medium",
      success: false,
      errorMessage: "Permission denied",
    });
  } catch {
    // Fail silently
  }
}

/**
 * Log a security event
 */
export function logSecurity(params: {
  type: SecurityEventType;
  severity: SecuritySeverity;
  title: string;
  description: string;
  userName?: string;
  userRole?: string;
  ipAddress?: string;
  resourceType?: string;
  resourceId?: string;
}): void {
  try {
    logSecurityEventService({
      type: params.type,
      severity: params.severity,
      title: params.title,
      description: params.description,
      userName: params.userName,
      userRole: params.userRole,
      ipAddress: params.ipAddress,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
    });
  } catch {
    // Fail silently
  }
}

/**
 * Safe audit - wrapper that never throws
 */
export function safeAudit(fn: () => void): void {
  try {
    fn();
  } catch {
    // Fail silently
  }
}

/**
 * Get audit logs (for components that need direct access)
 */
export function getAuditLogsSafe() {
  try {
    return getAuditLogs();
  } catch {
    return [];
  }
}

/**
 * Get patient audit (for components that need direct access)
 */
export function getPatientAuditSafe(patientId: string) {
  try {
    return getPatientAudit(patientId);
  } catch {
    return [];
  }
}

/**
 * Get security events (for components that need direct access)
 */
export function getSecurityEventsSafe() {
  try {
    return getSecurityEvents();
  } catch {
    return [];
  }
}

/**
 * Export audit logs (for components that need direct access)
 */
export function exportAuditLogsSafe() {
  try {
    exportAuditLogs();
  } catch {
    // Fail silently
  }
}

/**
 * Export security events (for components that need direct access)
 */
export function exportSecurityEventsSafe() {
  try {
    exportSecurityEvents();
  } catch {
    // Fail silently
  }
}
