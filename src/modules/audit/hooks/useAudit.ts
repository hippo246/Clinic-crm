/**
 * Audit Hook
 * Hook for Audit page and future components
 */

import { useState, useCallback } from "react";
import {
  getAuditLogs,
  logAuditEntry,
  clearAuditLogs,
  deleteAuditLog,
  exportAuditLogs,
  seedAuditLogIfEmpty,
  type AuditLogEntry,
  type AuditLogFilter,
} from "../services/auditService";

export function useAudit() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [filters, setFilters] = useState<AuditLogFilter>({});
  const [loading, setLoading] = useState(false);

  const refreshLogs = useCallback(() => {
    setLoading(true);
    try {
      const filteredLogs = getAuditLogs(filters);
      setLogs(filteredLogs);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const logAudit = useCallback((entry: Partial<AuditLogEntry>) => {
    try {
      logAuditEntry(entry);
      refreshLogs();
    } catch {
      // Fail silently
    }
  }, [refreshLogs]);

  const clearLogs = useCallback(() => {
    try {
      clearAuditLogs();
      refreshLogs();
    } catch {
      // Fail silently
    }
  }, [refreshLogs]);

  const deleteLog = useCallback((id: string) => {
    try {
      deleteAuditLog(id);
      refreshLogs();
    } catch {
      // Fail silently
    }
  }, [refreshLogs]);

  const exportLogs = useCallback(() => {
    try {
      exportAuditLogs(filters);
    } catch {
      // Fail silently
    }
  }, [filters]);

  const getPatientAudit = useCallback((patientId: string) => {
    try {
      return getAuditLogs().filter((log) => log.resourceId === patientId);
    } catch {
      return [];
    }
  }, []);

  const seedDemoLogs = useCallback(() => {
    try {
      seedAuditLogIfEmpty();
      refreshLogs();
    } catch {
      // Fail silently
    }
  }, [refreshLogs]);

  return {
    logs,
    filters,
    setFilters,
    refreshLogs,
    logAudit,
    clearLogs,
    deleteLog,
    exportLogs,
    getPatientAudit,
    seedDemoLogs,
    loading,
  };
}
