/**
 * Phase 9E: Legacy PHI Risk Scanner and Log Sanitizer
 * 
 * Provides read-only scanning for PHI/PII fields in legacy logs
 * and optional sanitization with typed confirmation.
 */

interface FieldRiskReport {
  fieldName: string;
  count: number;
  module: string;
}

interface ScanResult {
  totalEntries: number;
  riskyFields: FieldRiskReport[];
  safeEntries: number;
  scannedModules: string[];
}

// Fields that indicate PHI/PII presence
const SENSITIVE_FIELD_PATTERNS = [
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
  "resourceLabel", // Known legacy issue in api.ts patient creation audit
];

/**
 * Scan logs for sensitive field names (read-only, no mutation)
 */
export function scanLogsForSensitiveFields(
  logs: any[],
  moduleName: string
): ScanResult {
  const fieldCounts: Record<string, number> = {};
  let safeEntries = 0;

  for (const log of logs) {
    let hasSensitiveField = false;
    
    // Check all keys in the log entry
    for (const key of Object.keys(log)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = SENSITIVE_FIELD_PATTERNS.some(pattern => 
        lowerKey.includes(pattern.toLowerCase())
      );
      
      if (isSensitive) {
        hasSensitiveField = true;
        fieldCounts[key] = (fieldCounts[key] || 0) + 1;
      }
    }
    
    if (!hasSensitiveField) {
      safeEntries++;
    }
  }

  const riskyFields: FieldRiskReport[] = Object.entries(fieldCounts).map(([fieldName, count]) => ({
    fieldName,
    count,
    module: moduleName,
  }));

  return {
    totalEntries: logs.length,
    riskyFields,
    safeEntries,
    scannedModules: [moduleName],
  };
}

/**
 * Scan multiple log sources
 */
export function scanAllLogSources(sources: { logs: any[]; moduleName: string }[]): ScanResult {
  const combinedResult: ScanResult = {
    totalEntries: 0,
    riskyFields: [],
    safeEntries: 0,
    scannedModules: [],
  };

  for (const source of sources) {
    const result = scanLogsForSensitiveFields(source.logs, source.moduleName);
    combinedResult.totalEntries += result.totalEntries;
    combinedResult.safeEntries += result.safeEntries;
    combinedResult.riskyFields.push(...result.riskyFields);
    combinedResult.scannedModules.push(...result.scannedModules);
  }

  // Aggregate field counts across modules
  const fieldAggregation: Record<string, number> = {};
  for (const field of combinedResult.riskyFields) {
    fieldAggregation[field.fieldName] = (fieldAggregation[field.fieldName] || 0) + field.count;
  }

  combinedResult.riskyFields = Object.entries(fieldAggregation).map(([fieldName, count]) => ({
    fieldName,
    count,
    module: "combined",
  }));

  return combinedResult;
}

/**
 * Extended scan result with raw logs for redaction
 */
interface ExtendedScanResult extends ScanResult {
  riskyRecords: number;
  rawLogs: any[];
  auditLogs?: any[];
  adminAuditLogs?: any[];
  securityEvents?: any[];
  deniedActions?: any[];
  staffActivity?: any[];
  communicationActivity?: any[];
  queueActivity?: any[];
}

/**
 * Scan all known log sources from localStorage automatically
 */
export function scanAllKnownLogSources(): ExtendedScanResult {
  const sources: { logs: any[]; moduleName: string }[] = [];
  const rawLogs: any[] = [];
  const extendedResult: ExtendedScanResult = {
    totalEntries: 0,
    riskyFields: [],
    safeEntries: 0,
    scannedModules: [],
    riskyRecords: 0,
    rawLogs,
  };

  // Helper to safely read localStorage
  const safeRead = (key: string): any[] => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch {
      return [];
    }
  };

  // Scan audit logs
  const auditLogs = safeRead("clinic_crm_audit");
  if (auditLogs.length > 0) {
    sources.push({ logs: auditLogs, moduleName: "audit_logs" });
    rawLogs.push(...auditLogs);
    extendedResult.auditLogs = auditLogs;
  }

  // Scan admin audit logs
  const adminAuditLogs = safeRead("admin_audit");
  if (adminAuditLogs.length > 0) {
    sources.push({ logs: adminAuditLogs, moduleName: "admin_audit" });
    rawLogs.push(...adminAuditLogs);
    extendedResult.adminAuditLogs = adminAuditLogs;
  }

  // Scan security events
  const securityEvents = safeRead("clinic_crm_security_events");
  if (securityEvents.length > 0) {
    sources.push({ logs: securityEvents, moduleName: "security_events" });
    rawLogs.push(...securityEvents);
    extendedResult.securityEvents = securityEvents;
  }

  // Scan denied actions
  const deniedActions = safeRead("clinic_crm_denied_actions");
  if (deniedActions.length > 0) {
    sources.push({ logs: deniedActions, moduleName: "denied_actions" });
    rawLogs.push(...deniedActions);
    extendedResult.deniedActions = deniedActions;
  }

  // Scan staff activity
  const staffActivity = safeRead("clinic_crm_staff_activity");
  if (staffActivity.length > 0) {
    sources.push({ logs: staffActivity, moduleName: "staff_activity" });
    rawLogs.push(...staffActivity);
    extendedResult.staffActivity = staffActivity;
  }

  // Scan communication activity
  const communicationActivity = safeRead("clinic_crm_communication_activity");
  if (communicationActivity.length > 0) {
    sources.push({ logs: communicationActivity, moduleName: "communication_activity" });
    rawLogs.push(...communicationActivity);
    extendedResult.communicationActivity = communicationActivity;
  }

  // Scan queue activity
  const queueActivity = safeRead("clinic_crm_queue_activity");
  if (queueActivity.length > 0) {
    sources.push({ logs: queueActivity, moduleName: "queue_activity" });
    rawLogs.push(...queueActivity);
    extendedResult.queueActivity = queueActivity;
  }

  // Scan all sources
  const combinedResult = scanAllLogSources(sources);
  extendedResult.totalEntries = combinedResult.totalEntries;
  extendedResult.riskyFields = combinedResult.riskyFields;
  extendedResult.safeEntries = combinedResult.safeEntries;
  extendedResult.scannedModules = combinedResult.scannedModules;
  extendedResult.riskyRecords = combinedResult.totalEntries - combinedResult.safeEntries;

  return extendedResult;
}

/**
 * Sanitize a single log entry (redact sensitive field values)
 */
export function sanitizeLogEntry(log: any): any {
  if (log === null || typeof log !== "object") {
    return log;
  }

  const sanitized: any = {};
  
  for (const [key, value] of Object.entries(log)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = SENSITIVE_FIELD_PATTERNS.some(pattern => 
      lowerKey.includes(pattern.toLowerCase())
    );
    
    if (isSensitive && typeof value === "string") {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeLogEntry(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * Preview sanitization (show what would be redacted)
 */
export function previewSanitization(logs: any[]): {
  totalEntries: number;
  entriesWithRedactions: number;
  totalRedactions: number;
} {
  let entriesWithRedactions = 0;
  let totalRedactions = 0;

  for (const log of logs) {
    let hasRedactions = false;
    
    for (const key of Object.keys(log)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = SENSITIVE_FIELD_PATTERNS.some(pattern => 
        lowerKey.includes(pattern.toLowerCase())
      );
      
      if (isSensitive) {
        hasRedactions = true;
        totalRedactions++;
      }
    }
    
    if (hasRedactions) {
      entriesWithRedactions++;
    }
  }

  return {
    totalEntries: logs.length,
    entriesWithRedactions,
    totalRedactions,
  };
}
