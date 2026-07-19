/**
 * Phase 9E: Safe Admin Operation Audit Helper
 * 
 * Provides PHI/PII-safe logging for admin operations including:
 * - Settings changes
 * - Exports
 * - Imports
 * - Clear/delete actions
 * - Backup operations
 * 
 * All logs are sanitized to remove sensitive fields before storage.
 */

interface AdminAuditOptions {
  action: string;
  module: string;
  resourceType?: string;
  resourceId?: string;
  actor?: string;
  role?: string;
  status?: "success" | "failed" | "blocked";
  count?: number;
  exportType?: string;
  importMode?: string;
  section?: string;
  metadata?: Record<string, unknown>;
}

// Fields that must be redacted from logs
const SENSITIVE_FIELDS = [
  "patientName",
  "staffName",
  "name",
  "phone",
  "email",
  "dob",
  "address",
  "diagnosis",
  "symptoms",
  "treatment",
  "notes",
  "messageBody",
  "templateBody",
  "documentTitle",
  "documentContent",
  "medication",
  "dosage",
  "labValue",
  "resultValue",
  "insuranceDetails",
  "message",
  "subject",
  "body",
  "clinicPhone",
  "clinicEmail",
  "clinicAddress",
];

// Recursive sanitizer to remove sensitive fields
function sanitizeMetadata(metadata: unknown): unknown {
  if (metadata === null || typeof metadata !== "object") {
    return metadata;
  }

  if (Array.isArray(metadata)) {
    return metadata.map(item => sanitizeMetadata(item));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = SENSITIVE_FIELDS.some(field => lowerKey.includes(field.toLowerCase()));
    
    if (isSensitive) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeMetadata(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * Log an admin operation safely
 * Never throws, always logs to admin_audit localStorage key
 */
export function logAdminOperation(options: AdminAuditOptions): void {
  try {
    const entry = {
      timestamp: new Date().toISOString(),
      action: options.action,
      module: options.module,
      resourceType: options.resourceType || null,
      resourceId: options.resourceId || null,
      actor: options.actor || null,
      role: options.role || null,
      status: options.status || "success",
      count: options.count || null,
      exportType: options.exportType || null,
      importMode: options.importMode || null,
      section: options.section || null,
      metadata: options.metadata ? sanitizeMetadata(options.metadata) : null,
    };

    // Read existing logs
    const existing = JSON.parse(localStorage.getItem("admin_audit") || "[]");
    
    // Add new entry at the beginning
    const updated = [entry, ...existing].slice(0, 1000); // Keep last 1000 entries
    
    // Write back
    localStorage.setItem("admin_audit", JSON.stringify(updated));
  } catch (error) {
    // Never throw - fail silently for audit logging
    console.error("Failed to log admin operation:", error);
  }
}

/**
 * Get admin audit logs
 */
export function getAdminAuditLogs(): unknown[] {
  try {
    return JSON.parse(localStorage.getItem("admin_audit") || "[]");
  } catch {
    return [];
  }
}

/**
 * Clear admin audit logs (use with caution)
 */
export function clearAdminAuditLogs(): void {
  try {
    localStorage.setItem("admin_audit", "[]");
  } catch (error) {
    console.error("Failed to clear admin audit logs:", error);
  }
}
