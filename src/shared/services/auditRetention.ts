/**
 * Phase 9E: Audit Retention and Archive-Before-Clear Helper
 * 
 * Provides retention policy support and archive-before-clear behavior for audit/security logs.
 */

interface RetentionPolicy {
  auditLogs: number; // days
  securityEvents: number; // days
  workflowActivity: number; // days
  uiActivity: number; // days
  backupArchives: number; // days
}

interface ArchiveMetadata {
  archiveType: string;
  createdAt: string;
  createdBy: string;
  recordCount: number;
  sourceModule: string;
}

// Default retention policies (in days)
const DEFAULT_RETENTION_POLICY: RetentionPolicy = {
  auditLogs: 2555, // 7 years
  securityEvents: 2555, // 7 years
  workflowActivity: 730, // 2 years
  uiActivity: 180, // 6 months
  backupArchives: 90, // 3 months
};

/**
 * Get retention policy
 */
export function getRetentionPolicy(): RetentionPolicy {
  try {
    const stored = localStorage.getItem("retention_policy");
    if (stored) {
      return { ...DEFAULT_RETENTION_POLICY, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.error("Error reading retention policy:", error);
  }
  return DEFAULT_RETENTION_POLICY;
}

/**
 * Set retention policy (admin-only)
 */
export function setRetentionPolicy(policy: Partial<RetentionPolicy>): void {
  try {
    const current = getRetentionPolicy();
    const updated = { ...current, ...policy };
    localStorage.setItem("retention_policy", JSON.stringify(updated));
  } catch (error) {
    console.error("Error setting retention policy:", error);
  }
}

/**
 * Check if a log entry is eligible for cleanup based on retention policy
 */
export function isEligibleForCleanup(timestamp: string, logType: keyof RetentionPolicy): boolean {
  const policy = getRetentionPolicy();
  const retentionDays = policy[logType];
  const logDate = new Date(timestamp);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  
  return logDate < cutoffDate;
}

/**
 * Preview retention cleanup counts
 */
export function previewRetentionCleanup(logs: any[], logType: keyof RetentionPolicy): number {
  return logs.filter(log => isEligibleForCleanup(log.timestamp || log.createdAt, logType)).length;
}

/**
 * Create archive metadata for archive-before-clear
 */
export function createArchiveMetadata(
  archiveType: string,
  recordCount: number,
  sourceModule: string,
  createdBy: string
): ArchiveMetadata {
  return {
    archiveType,
    createdAt: new Date().toISOString(),
    createdBy,
    recordCount,
    sourceModule,
  };
}

/**
 * Store archive metadata (count/summary only, no raw PHI)
 */
export function storeArchiveMetadata(metadata: ArchiveMetadata): void {
  try {
    const existing = JSON.parse(localStorage.getItem("audit_archives") || "[]");
    const updated = [metadata, ...existing].slice(0, 100); // Keep last 100 archives
    localStorage.setItem("audit_archives", JSON.stringify(updated));
  } catch (error) {
    console.error("Error storing archive metadata:", error);
  }
}

/**
 * Get archive metadata
 */
export function getArchiveMetadata(): ArchiveMetadata[] {
  try {
    return JSON.parse(localStorage.getItem("audit_archives") || "[]");
  } catch {
    return [];
  }
}

/**
 * Clear archive metadata
 */
export function clearArchiveMetadata(): void {
  try {
    localStorage.setItem("audit_archives", "[]");
  } catch (error) {
    console.error("Error clearing archive metadata:", error);
  }
}
