/**
 * Denied Action Logger
 * Shared helper for logging permission-denied actions safely
 * Never throws and never logs sensitive PHI
 */

import { logPermissionDenied, logSecurity } from "./auditLogger";
import type { AuditResourceType } from "../../modules/audit/services/auditService";
import type { SecurityEventType, SecuritySeverity } from "../../modules/security/services/securityService";

/**
 * Options for logging a denied action
 */
export interface DeniedActionOptions {
  /** The user role attempting the action */
  role?: string;
  /** The action being attempted (e.g., "delete", "export", "view") */
  action: string;
  /** The resource type (e.g., "patient", "billing", "settings") */
  resource: string;
  /** Optional resource ID (never PHI) */
  resourceId?: string;
  /** Optional resource label (sanitized - never PHI) */
  resourceLabel?: string;
  /** Reason for denial (e.g., "insufficient permissions") */
  reason: string;
  /** Severity level for security logging */
  severity?: "low" | "medium" | "high";
  /** Optional additional metadata (never PHI) */
  metadata?: Record<string, unknown>;
}

/**
 * Log a denied action safely
 * - Never throws
 * - Never logs sensitive PHI
 * - Uses existing audit/security services if available
 * - Falls back gracefully if services fail
 */
export function logDeniedAction(options: DeniedActionOptions): void {
  const { role, action, resource, resourceId, resourceLabel, reason, severity = "medium", metadata } = options;

  try {
    // Log to audit system
    logPermissionDenied({
      resourceType: resource as AuditResourceType,
      resourceId,
      resourceLabel,
      details: `Action: ${action} | Role: ${role || "unknown"} | Reason: ${reason}`,
    });

    // Log to security system for higher severity events
    if (severity === "high" || severity === "medium") {
      logSecurity({
        type: "access_denied" as SecurityEventType,
        severity: severity === "high" ? ("high" as SecuritySeverity) : ("medium" as SecuritySeverity),
        title: `Access Denied: ${action}`,
        description: `User with role "${role || "unknown"}" attempted ${action} on ${resource}. Reason: ${reason}`,
        userRole: role,
        resourceType: resource,
        resourceId,
      });
    }

    // Optional: Store to localStorage for security events if needed
    // This is a fallback if the main services fail
    try {
      const securityEvents = JSON.parse(localStorage.getItem("clinic_crm_security_events") || "[]");
      securityEvents.push({
        timestamp: new Date().toISOString(),
        type: "access_denied",
        severity,
        action,
        resource,
        resourceId,
        role: role || "unknown",
        reason,
        metadata: metadata ? sanitizeMetadata(metadata) : undefined,
      });
      // Keep only last 100 events to prevent storage bloat
      if (securityEvents.length > 100) {
        securityEvents.shift();
      }
      localStorage.setItem("clinic_crm_security_events", JSON.stringify(securityEvents));
    } catch {
      // Fail silently if localStorage fails
    }
  } catch {
    // Fail silently - never throw
  }
}

/**
 * Sanitize metadata to ensure no PHI is logged
 * Removes sensitive fields and keeps only safe metadata
 */
function sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = [
    "name", "firstName", "lastName", "fullName",
    "phone", "email", "address", "ssn", "insurance",
    "notes", "documents", "messages", "results",
    "diagnosis", "prescription", "treatment", "history",
    "dob", "birthDate", "age", "gender"
  ];

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    // Skip sensitive keys
    if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive.toLowerCase()))) {
      continue;
    }
    // Only include primitive values (no objects/arrays that might contain PHI)
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Get security events from localStorage (fallback)
 */
export function getSecurityEventsFallback(): Array<{
  timestamp: string;
  type: string;
  severity: string;
  action: string;
  resource: string;
  resourceId?: string;
  role: string;
  reason: string;
  metadata?: Record<string, unknown>;
}> {
  try {
    return JSON.parse(localStorage.getItem("clinic_crm_security_events") || "[]");
  } catch {
    return [];
  }
}

/**
 * Clear security events from localStorage (fallback)
 */
export function clearSecurityEventsFallback(): void {
  try {
    localStorage.removeItem("clinic_crm_security_events");
  } catch {
    // Fail silently
  }
}
