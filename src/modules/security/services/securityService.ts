/**
 * Security Service
 * Real localStorage-backed security event service
 */

import { readJSON, writeJSON, removeStorageItem, storageAvailable } from "../../../shared/services/storageService";
import { exportToCSV, generateTimestampedFilename } from "../../../shared/utils/exportUtils";

const SECURITY_EVENTS_KEY = "clinic_crm_security_events_v1";
const MAX_EVENTS = 1000;

/**
 * Security event types
 */
export type SecurityEventType =
  | "failed_login"
  | "successful_login"
  | "logout"
  | "permission_denied"
  | "suspicious_access"
  | "bulk_export"
  | "role_change"
  | "settings_change"
  | "file_upload_blocked"
  | "session_timeout"
  | "break_glass_access"
  | "data_retention_change"
  | "backup_created"
  | "backup_restored"
  | "unknown";

/**
 * Security severity
 */
export type SecuritySeverity = "info" | "low" | "medium" | "high" | "critical";

/**
 * Security event
 */
export interface SecurityEvent {
  id: string;
  timestamp: string;
  type: SecurityEventType;
  severity: SecuritySeverity;
  title: string;
  description: string;
  userId?: string;
  userName?: string;
  userRole?: string;
  ipAddress?: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, any>;
  resolved: boolean;
  resolvedAt?: string;
  resolutionNotes?: string;
}

/**
 * Security event filter
 */
export interface SecurityEventFilter {
  search?: string;
  type?: SecurityEventType;
  severity?: SecuritySeverity;
  resolved?: boolean;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Log a security event
 */
export function logSecurityEvent(input: Partial<SecurityEvent>): SecurityEvent | null {
  if (!storageAvailable()) return null;

  const event: SecurityEvent = {
    id: `sec-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    timestamp: new Date().toISOString(),
    type: input.type || "unknown",
    severity: input.severity || "info",
    title: input.title || "Security Event",
    description: input.description || "",
    resolved: false,
    ...input,
  };

  try {
    const events = readJSON<SecurityEvent[]>(SECURITY_EVENTS_KEY, []);
    
    // Add new event at the beginning
    events.unshift(event);
    
    // Keep only MAX_EVENTS
    if (events.length > MAX_EVENTS) {
      events.splice(MAX_EVENTS);
    }
    
    const success = writeJSON(SECURITY_EVENTS_KEY, events);
    return success ? event : null;
  } catch (error) {
    console.warn("Failed to log security event:", error);
    return null;
  }
}

/**
 * Get security events with optional filtering
 */
export function getSecurityEvents(filter?: SecurityEventFilter): SecurityEvent[] {
  if (!storageAvailable()) return [];

  try {
    const events = readJSON<SecurityEvent[]>(SECURITY_EVENTS_KEY, []);
    
    if (!filter) return events;
    
    return events.filter((event) => {
      if (filter.search) {
        const search = filter.search.toLowerCase();
        const searchable = [
          event.type,
          event.title,
          event.description,
          event.userName,
          event.ipAddress,
        ].join(" ").toLowerCase();
        
        if (!searchable.includes(search)) return false;
      }
      
      if (filter.type && event.type !== filter.type) return false;
      if (filter.severity && event.severity !== filter.severity) return false;
      if (filter.resolved !== undefined && event.resolved !== filter.resolved) return false;
      if (filter.userId && event.userId !== filter.userId) return false;
      
      if (filter.dateFrom && new Date(event.timestamp) < new Date(filter.dateFrom)) return false;
      if (filter.dateTo && new Date(event.timestamp) > new Date(filter.dateTo)) return false;
      
      return true;
    });
  } catch (error) {
    console.warn("Failed to get security events:", error);
    return [];
  }
}

/**
 * Resolve a security event
 */
export function resolveSecurityEvent(id: string, notes?: string): boolean {
  if (!storageAvailable()) return false;

  try {
    const events = readJSON<SecurityEvent[]>(SECURITY_EVENTS_KEY, []);
    const updated = events.map((event) => {
      if (event.id === id) {
        return {
          ...event,
          resolved: true,
          resolvedAt: new Date().toISOString(),
          resolutionNotes: notes,
        };
      }
      return event;
    });
    return writeJSON(SECURITY_EVENTS_KEY, updated);
  } catch (error) {
    console.warn("Failed to resolve security event:", error);
    return false;
  }
}

/**
 * Reopen a security event
 */
export function reopenSecurityEvent(id: string): boolean {
  if (!storageAvailable()) return false;

  try {
    const events = readJSON<SecurityEvent[]>(SECURITY_EVENTS_KEY, []);
    const updated = events.map((event) => {
      if (event.id === id) {
        return {
          ...event,
          resolved: false,
          resolvedAt: undefined,
          resolutionNotes: undefined,
        };
      }
      return event;
    });
    return writeJSON(SECURITY_EVENTS_KEY, updated);
  } catch (error) {
    console.warn("Failed to reopen security event:", error);
    return false;
  }
}

/**
 * Delete a security event
 */
export function deleteSecurityEvent(id: string): boolean {
  if (!storageAvailable()) return false;

  try {
    const events = readJSON<SecurityEvent[]>(SECURITY_EVENTS_KEY, []);
    const filtered = events.filter((event) => event.id !== id);
    return writeJSON(SECURITY_EVENTS_KEY, filtered);
  } catch (error) {
    console.warn("Failed to delete security event:", error);
    return false;
  }
}

/**
 * Clear all security events
 */
export function clearSecurityEvents(): boolean {
  if (!storageAvailable()) return false;

  try {
    return removeStorageItem(SECURITY_EVENTS_KEY);
  } catch (error) {
    console.warn("Failed to clear security events:", error);
    return false;
  }
}

/**
 * Export security events to CSV
 */
export function exportSecurityEvents(filter?: SecurityEventFilter): void {
  const events = getSecurityEvents(filter);
  
  if (events.length === 0) {
    console.warn("No security events to export");
    return;
  }

  const columns = [
    { key: "timestamp" as keyof SecurityEvent, label: "Timestamp" },
    { key: "type" as keyof SecurityEvent, label: "Type" },
    { key: "severity" as keyof SecurityEvent, label: "Severity" },
    { key: "title" as keyof SecurityEvent, label: "Title" },
    { key: "description" as keyof SecurityEvent, label: "Description" },
    { key: "userName" as keyof SecurityEvent, label: "User" },
    { key: "userRole" as keyof SecurityEvent, label: "User Role" },
    { key: "ipAddress" as keyof SecurityEvent, label: "IP Address" },
    { key: "resolved" as keyof SecurityEvent, label: "Resolved" },
    { key: "resolvedAt" as keyof SecurityEvent, label: "Resolved At" },
    { key: "resolutionNotes" as keyof SecurityEvent, label: "Resolution Notes" },
  ];

  const filename = generateTimestampedFilename("security_events");
  exportToCSV(events, filename, columns);
}

/**
 * Detect suspicious activity based on local rules
 */
export function detectSuspiciousActivity(): SecurityEvent[] {
  const events = getSecurityEvents();
  const suspicious: SecurityEvent[] = [];
  const now = Date.now();
  const fifteenMinutes = 15 * 60 * 1000;
  const tenMinutes = 10 * 60 * 1000;

  // Rule 1: 5+ failed logins in 15 minutes
  const recentFailedLogins = events.filter(
    (e) => e.type === "failed_login" && now - new Date(e.timestamp).getTime() < fifteenMinutes
  );
  if (recentFailedLogins.length >= 5) {
    const suspiciousEvent: SecurityEvent = {
      id: `sec-detect-${Date.now()}-1`,
      timestamp: new Date().toISOString(),
      type: "suspicious_access",
      severity: "high",
      title: "Multiple Failed Login Attempts",
      description: `${recentFailedLogins.length} failed login attempts detected in the last 15 minutes`,
      metadata: { count: recentFailedLogins.length, timeWindow: "15 minutes" },
      resolved: false,
    };
    suspicious.push(suspiciousEvent);
  }

  // Rule 2: 3+ exports in 10 minutes
  const recentExports = events.filter(
    (e) => e.type === "bulk_export" && now - new Date(e.timestamp).getTime() < tenMinutes
  );
  if (recentExports.length >= 3) {
    const suspiciousEvent: SecurityEvent = {
      id: `sec-detect-${Date.now()}-2`,
      timestamp: new Date().toISOString(),
      type: "suspicious_access",
      severity: "medium",
      title: "Bulk Export Activity",
      description: `${recentExports.length} bulk export operations detected in the last 10 minutes`,
      metadata: { count: recentExports.length, timeWindow: "10 minutes" },
      resolved: false,
    };
    suspicious.push(suspiciousEvent);
  }

  // Rule 3: Repeated permission denied events
  const recentPermissionDenied = events.filter(
    (e) => e.type === "permission_denied" && now - new Date(e.timestamp).getTime() < fifteenMinutes
  );
  if (recentPermissionDenied.length >= 3) {
    const suspiciousEvent: SecurityEvent = {
      id: `sec-detect-${Date.now()}-3`,
      timestamp: new Date().toISOString(),
      type: "suspicious_access",
      severity: "medium",
      title: "Repeated Permission Denied Events",
      description: `${recentPermissionDenied.length} permission denied events detected in the last 15 minutes`,
      metadata: { count: recentPermissionDenied.length, timeWindow: "15 minutes" },
      resolved: false,
    };
    suspicious.push(suspiciousEvent);
  }

  // Rule 4: Unresolved high/critical events
  const unresolvedHighCritical = events.filter(
    (e) => !e.resolved && (e.severity === "high" || e.severity === "critical")
  );
  if (unresolvedHighCritical.length > 0) {
    unresolvedHighCritical.forEach((event) => {
      suspicious.push({
        ...event,
        id: `sec-detect-${event.id}`,
        title: `Unresolved ${event.severity} Event`,
        description: `Unresolved ${event.severity} security event requires attention`,
      });
    });
  }

  return suspicious;
}

/**
 * Seed demo security events if empty
 */
export function seedSecurityEventsIfEmpty(): void {
  if (!storageAvailable()) return;

  try {
    const existing = readJSON<SecurityEvent[]>(SECURITY_EVENTS_KEY, []);
    if (existing.length > 0) return;

    const demoEvents: SecurityEvent[] = [
      {
        id: "sec-demo-1",
        timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        type: "successful_login",
        severity: "info",
        title: "Successful Login",
        description: "User logged in successfully (local demo)",
        userName: "Dr. Admin",
        userRole: "admin",
        ipAddress: "192.168.1.100",
        resolved: false,
      },
      {
        id: "sec-demo-2",
        timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        type: "failed_login",
        severity: "medium",
        title: "Failed Login Attempt",
        description: "Failed login attempt detected (local demo)",
        ipAddress: "203.0.113.1",
        resolved: false,
      },
      {
        id: "sec-demo-3",
        timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        type: "bulk_export",
        severity: "medium",
        title: "Bulk Data Export",
        description: "Large data export initiated (local demo)",
        userName: "Dr. Admin",
        userRole: "admin",
        resolved: false,
      },
      {
        id: "sec-demo-4",
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        type: "permission_denied",
        severity: "low",
        title: "Permission Denied",
        description: "Access denied to restricted resource (local demo)",
        userName: "Dr. Admin",
        userRole: "admin",
        resolved: true,
        resolvedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
        resolutionNotes: "Reviewed - legitimate access attempt",
      },
      {
        id: "sec-demo-5",
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        type: "settings_change",
        severity: "low",
        title: "Settings Change",
        description: "System settings modified (local demo)",
        userName: "Dr. Admin",
        userRole: "admin",
        resolved: false,
      },
    ];

    writeJSON(SECURITY_EVENTS_KEY, demoEvents);
  } catch (error) {
    console.warn("Failed to seed security events:", error);
  }
}
