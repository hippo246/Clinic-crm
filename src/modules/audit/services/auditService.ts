/**
 * Audit Service
 * Real localStorage-backed audit logging service
 */

import { readJSON, writeJSON, removeStorageItem, storageAvailable } from "../../../shared/services/storageService";
import { exportToCSV, generateTimestampedFilename } from "../../../shared/utils/exportUtils";

const AUDIT_LOGS_KEY = "clinic_crm_audit_logs_v1";
const MAX_LOGS = 1000;

/**
 * Audit actions
 */
export type AuditAction =
  | "view"
  | "create"
  | "update"
  | "delete"
  | "archive"
  | "restore"
  | "export"
  | "import"
  | "login"
  | "logout"
  | "permission_denied"
  | "settings_change"
  | "security_event"
  | "file_upload"
  | "file_download"
  | "print"
  | "unknown";

/**
 * Audit severity
 */
export type AuditSeverity = "info" | "low" | "medium" | "high" | "critical";

/**
 * Audit resource types
 */
export type AuditResourceType =
  | "patient"
  | "appointment"
  | "queue"
  | "consultation"
  | "prescription"
  | "lab"
  | "billing"
  | "document"
  | "communication"
  | "staff"
  | "settings"
  | "report"
  | "auth"
  | "system"
  | "unknown";

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId?: string;
  resourceLabel?: string;
  userId?: string;
  userName?: string;
  userRole?: string;
  severity: AuditSeverity;
  details?: string;
  metadata?: Record<string, any>;
  success: boolean;
  errorMessage?: string;
}

/**
 * Audit log filter
 */
export interface AuditLogFilter {
  search?: string;
  action?: AuditAction;
  resourceType?: AuditResourceType;
  severity?: AuditSeverity;
  success?: boolean;
  userId?: string;
  resourceType?: AuditResourceType;
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Log an audit entry
 */
export function logAuditEntry(entryInput: Partial<AuditLogEntry>): AuditLogEntry | null {
  if (!storageAvailable()) return null;

  const entry: AuditLogEntry = {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    timestamp: new Date().toISOString(),
    action: entryInput.action || "unknown",
    resourceType: entryInput.resourceType || "unknown",
    severity: entryInput.severity || "info",
    success: entryInput.success !== false,
    ...entryInput,
  };

  try {
    const logs = readJSON<AuditLogEntry[]>(AUDIT_LOGS_KEY, []);
    
    // Add new log at the beginning
    logs.unshift(entry);
    
    // Keep only MAX_LOGS
    if (logs.length > MAX_LOGS) {
      logs.splice(MAX_LOGS);
    }
    
    const success = writeJSON(AUDIT_LOGS_KEY, logs);
    return success ? entry : null;
  } catch (error) {
    console.warn("Failed to log audit entry:", error);
    return null;
  }
}

/**
 * Get audit logs with optional filtering
 */
export function getAuditLogs(filter?: AuditLogFilter): AuditLogEntry[] {
  if (!storageAvailable()) return [];

  try {
    const logs = readJSON<AuditLogEntry[]>(AUDIT_LOGS_KEY, []);
    
    if (!filter) return logs;
    
    return logs.filter((log) => {
      if (filter.search) {
        const search = filter.search.toLowerCase();
        const searchable = [
          log.action,
          log.resourceType,
          log.resourceLabel,
          log.userName,
          log.details,
          log.errorMessage,
        ].join(" ").toLowerCase();
        
        if (!searchable.includes(search)) return false;
      }
      
      if (filter.action && log.action !== filter.action) return false;
      if (filter.resourceType && log.resourceType !== filter.resourceType) return false;
      if (filter.severity && log.severity !== filter.severity) return false;
      if (filter.success !== undefined && log.success !== filter.success) return false;
      if (filter.userId && log.userId !== filter.userId) return false;
      
      if (filter.dateFrom && new Date(log.timestamp) < new Date(filter.dateFrom)) return false;
      if (filter.dateTo && new Date(log.timestamp) > new Date(filter.dateTo)) return false;
      
      return true;
    });
  } catch (error) {
    console.warn("Failed to get audit logs:", error);
    return [];
  }
}

/**
 * Get audit logs for a specific patient
 */
export function getPatientAudit(patientId: string): AuditLogEntry[] {
  return getAuditLogs().filter((log) => log.resourceId === patientId);
}

/**
 * Clear all audit logs
 */
export function clearAuditLogs(): boolean {
  if (!storageAvailable()) return false;

  try {
    return removeStorageItem(AUDIT_LOGS_KEY);
  } catch (error) {
    console.warn("Failed to clear audit logs:", error);
    return false;
  }
}

/**
 * Delete a specific audit log
 */
export function deleteAuditLog(id: string): boolean {
  if (!storageAvailable()) return false;

  try {
    const logs = readJSON<AuditLogEntry[]>(AUDIT_LOGS_KEY, []);
    const filtered = logs.filter((log) => log.id !== id);
    return writeJSON(AUDIT_LOGS_KEY, filtered);
  } catch (error) {
    console.warn("Failed to delete audit log:", error);
    return false;
  }
}

/**
 * Export audit logs to CSV
 */
export function exportAuditLogs(filter?: AuditLogFilter): void {
  const logs = getAuditLogs(filter);
  
  if (logs.length === 0) {
    console.warn("No audit logs to export");
    return;
  }

  const columns = [
    { key: "timestamp" as keyof AuditLogEntry, label: "Timestamp" },
    { key: "action" as keyof AuditLogEntry, label: "Action" },
    { key: "resourceType" as keyof AuditLogEntry, label: "Resource Type" },
    { key: "resourceId" as keyof AuditLogEntry, label: "Resource ID" },
    { key: "resourceLabel" as keyof AuditLogEntry, label: "Resource Label" },
    { key: "userName" as keyof AuditLogEntry, label: "User" },
    { key: "userRole" as keyof AuditLogEntry, label: "User Role" },
    { key: "severity" as keyof AuditLogEntry, label: "Severity" },
    { key: "details" as keyof AuditLogEntry, label: "Details" },
    { key: "success" as keyof AuditLogEntry, label: "Success" },
    { key: "errorMessage" as keyof AuditLogEntry, label: "Error Message" },
  ];

  const filename = generateTimestampedFilename("audit_logs");
  exportToCSV(logs, filename, columns);
}

/**
 * Seed demo audit logs if empty
 */
export function seedAuditLogIfEmpty(): void {
  if (!storageAvailable()) return;

  try {
    const existing = readJSON<AuditLogEntry[]>(AUDIT_LOGS_KEY, []);
    if (existing.length > 0) return;

    const demoLogs: AuditLogEntry[] = [
      {
        id: "audit-demo-1",
        timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        action: "login",
        resourceType: "auth",
        severity: "info",
        success: true,
        userName: "Dr. Admin",
        userRole: "admin",
        details: "User logged in successfully (local demo)",
      },
      {
        id: "audit-demo-2",
        timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        action: "view",
        resourceType: "patient",
        resourceId: "CLN-01001",
        resourceLabel: "John Doe",
        severity: "info",
        success: true,
        userName: "Dr. Admin",
        userRole: "admin",
        details: "Viewed patient profile (local demo)",
      },
      {
        id: "audit-demo-3",
        timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        action: "export",
        resourceType: "report",
        severity: "medium",
        success: true,
        userName: "Dr. Admin",
        userRole: "admin",
        details: "Exported patient report (local demo)",
      },
      {
        id: "audit-demo-4",
        timestamp: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
        action: "update",
        resourceType: "patient",
        resourceId: "CLN-01002",
        resourceLabel: "Jane Smith",
        severity: "low",
        success: true,
        userName: "Dr. Admin",
        userRole: "admin",
        details: "Updated patient phone number (local demo)",
      },
      {
        id: "audit-demo-5",
        timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
        action: "permission_denied",
        resourceType: "settings",
        severity: "medium",
        success: false,
        userName: "Dr. Admin",
        userRole: "admin",
        details: "Attempted to access restricted settings (local demo)",
        errorMessage: "Insufficient permissions",
      },
    ];

    writeJSON(AUDIT_LOGS_KEY, demoLogs);
  } catch (error) {
    console.warn("Failed to seed audit logs:", error);
  }
}
