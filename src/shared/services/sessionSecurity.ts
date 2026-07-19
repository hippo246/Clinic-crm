// Phase 10F: Session Security Helper
// Provides demo-mode session timeout and activity tracking
// NOTE: This is frontend-only demo behavior. Production requires backend session management.

import { logAdminOperation } from "./adminAudit";
import type { UserRole } from "../../ui/types";

export interface SessionSecurityConfig {
  timeoutMinutes: number;
  warningMinutes?: number;
  onTimeout?: () => void;
  onWarning?: () => void;
}

export interface SessionSecurityState {
  lastActivity: number;
  isActive: boolean;
}

const DEFAULT_TIMEOUT_MINUTES = 30;
const WARNING_THRESHOLD_MINUTES = 2;

let sessionTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
let warningTimer: ReturnType<typeof setTimeout> | null = null;
let lastActivityTimestamp = Date.now();
let sessionActive = true;
let currentRole: UserRole = "admin";

/**
 * Initialize session security with optional config
 */
export function initSessionSecurity(
  role: UserRole,
  config?: Partial<SessionSecurityConfig>
): void {
  currentRole = role;
  lastActivityTimestamp = Date.now();
  sessionActive = true;

  const timeoutMinutes = config?.timeoutMinutes || DEFAULT_TIMEOUT_MINUTES;
  const warningMinutes = config?.warningMinutes || WARNING_THRESHOLD_MINUTES;

  // Clear existing timers
  clearSessionTimers();

  // Set warning timer if configured
  if (warningMinutes > 0 && warningMinutes < timeoutMinutes) {
    const warningMs = (timeoutMinutes - warningMinutes) * 60 * 1000;
    warningTimer = setTimeout(() => {
      if (config?.onWarning && sessionActive) {
        config.onWarning();
      }
    }, warningMs);
  }

  // Set timeout timer
  const timeoutMs = timeoutMinutes * 60 * 1000;
  sessionTimeoutTimer = setTimeout(() => {
    if (sessionActive) {
      handleSessionTimeout();
    }
  }, timeoutMs);
}

/**
 * Record user activity to reset session timer
 */
export function recordActivity(): void {
  if (!sessionActive) return;

  lastActivityTimestamp = Date.now();

  // Reset timers on activity
  if (sessionTimeoutTimer) {
    clearTimeout(sessionTimeoutTimer);
  }
  if (warningTimer) {
    clearTimeout(warningTimer);
  }

  // Restart timers
  const timeoutMs = DEFAULT_TIMEOUT_MINUTES * 60 * 1000;
  const warningMs = (DEFAULT_TIMEOUT_MINUTES - WARNING_THRESHOLD_MINUTES) * 60 * 1000;

  warningTimer = setTimeout(() => {
    // Warning threshold - would trigger onWarning callback if configured
  }, warningMs);

  sessionTimeoutTimer = setTimeout(() => {
    if (sessionActive) {
      handleSessionTimeout();
    }
  }, timeoutMs);
}

/**
 * Handle session timeout
 */
function handleSessionTimeout(): void {
  sessionActive = false;
  clearSessionTimers();

  // Log session timeout safely (PHI-safe)
  try {
    logAdminOperation({
      action: "session_timeout",
      module: "session_security",
      resourceType: "session",
      metadata: {
        timeoutMinutes: DEFAULT_TIMEOUT_MINUTES,
        inactiveDuration: Math.floor((Date.now() - lastActivityTimestamp) / 1000 / 60),
      },
      actor: currentRole,
      role: currentRole,
    });
  } catch {
    // Fail silently
  }

  // Reload page to return to login (demo behavior)
  // Production would redirect to login with proper session cleanup
  window.location.reload();
}

/**
 * Clear session timers
 */
function clearSessionTimers(): void {
  if (sessionTimeoutTimer) {
    clearTimeout(sessionTimeoutTimer);
    sessionTimeoutTimer = null;
  }
  if (warningTimer) {
    clearTimeout(warningTimer);
    warningTimer = null;
  }
}

/**
 * Get current session state
 */
export function getSessionState(): SessionSecurityState {
  return {
    lastActivity: lastActivityTimestamp,
    isActive: sessionActive,
  };
}

/**
 * Manually trigger session logout
 */
export function logoutSession(): void {
  sessionActive = false;
  clearSessionTimers();

  // Log manual logout safely (PHI-safe)
  try {
    logAdminOperation({
      action: "manual_logout",
      module: "session_security",
      resourceType: "session",
      metadata: {
        sessionDuration: Math.floor((Date.now() - lastActivityTimestamp) / 1000 / 60),
      },
      actor: currentRole,
      role: currentRole,
    });
  } catch {
    // Fail silently
  }
}

/**
 * Setup activity event listeners
 */
export function setupActivityListeners(): () => void {
  const events = ["click", "keydown", "mousemove", "touchstart"];

  const handlers = events.map(event => {
    const handler = () => recordActivity();
    window.addEventListener(event, handler);
    return { event, handler };
  });

  // Return cleanup function
  return () => {
    handlers.forEach(({ event, handler }) => {
      window.removeEventListener(event, handler);
    });
  };
}
