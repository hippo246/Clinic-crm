/**
 * Security Hook
 * Hook for Security Events page and future components
 */

import { useState, useCallback } from "react";
import {
  getSecurityEvents,
  logSecurityEvent,
  resolveSecurityEvent,
  reopenSecurityEvent,
  deleteSecurityEvent,
  clearSecurityEvents,
  exportSecurityEvents,
  detectSuspiciousActivity,
  seedSecurityEventsIfEmpty,
  type SecurityEvent,
  type SecurityEventFilter,
} from "../services/securityService";

export function useSecurity() {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [filters, setFilters] = useState<SecurityEventFilter>({});
  const [loading, setLoading] = useState(false);

  const refreshEvents = useCallback(() => {
    setLoading(true);
    try {
      const filteredEvents = getSecurityEvents(filters);
      setEvents(filteredEvents);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const logSecurityEventHook = useCallback((input: Partial<SecurityEvent>) => {
    try {
      logSecurityEvent(input);
      refreshEvents();
    } catch {
      // Fail silently
    }
  }, [refreshEvents]);

  const resolveEvent = useCallback((id: string, notes?: string) => {
    try {
      resolveSecurityEvent(id, notes);
      refreshEvents();
    } catch {
      // Fail silently
    }
  }, [refreshEvents]);

  const reopenEvent = useCallback((id: string) => {
    try {
      reopenSecurityEvent(id);
      refreshEvents();
    } catch {
      // Fail silently
    }
  }, [refreshEvents]);

  const deleteEvent = useCallback((id: string) => {
    try {
      deleteSecurityEvent(id);
      refreshEvents();
    } catch {
      // Fail silently
    }
  }, [refreshEvents]);

  const clearEvents = useCallback(() => {
    try {
      clearSecurityEvents();
      refreshEvents();
    } catch {
      // Fail silently
    }
  }, [refreshEvents]);

  const exportEvents = useCallback(() => {
    try {
      exportSecurityEvents(filters);
    } catch {
      // Fail silently
    }
  }, [filters]);

  const suspiciousEvents = useCallback(() => {
    try {
      return detectSuspiciousActivity();
    } catch {
      return [];
    }
  }, []);

  const seedDemoEvents = useCallback(() => {
    try {
      seedSecurityEventsIfEmpty();
      refreshEvents();
    } catch {
      // Fail silently
    }
  }, [refreshEvents]);

  return {
    events,
    filters,
    setFilters,
    refreshEvents,
    logSecurityEvent: logSecurityEventHook,
    resolveEvent,
    reopenEvent,
    deleteEvent,
    clearEvents,
    exportEvents,
    suspiciousEvents,
    seedDemoEvents,
    loading,
  };
}
