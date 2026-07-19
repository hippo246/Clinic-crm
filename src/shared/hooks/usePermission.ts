import { useMemo } from "react";
import { can, canAny, canAll, canPerformSensitiveAction, canDelete, canExport, hasRole, normalizeRole, guardAction, getDeniedMessage, UserRole, Permission } from "../permissions/permissions";
import { logDeniedAction } from "../services/deniedActionLogger";
import { readJSON } from "../services/storageService";

/**
 * Custom hook for permission checks
 * Simple wrapper around permission helpers
 * Does not require a provider yet
 */
export function usePermission(role?: UserRole) {
  // Infer role from localStorage if not provided, with safe normalization
  const inferredRole = useMemo(() => {
    if (role) return role;
    try {
      const storedRole = readJSON<string>("clinic_crm_role", "admin");
      return normalizeRole(storedRole);
    } catch {
      return "readonly"; // Safe fallback for errors
    }
  }, [role]);

  const checkCan = (permission: Permission): boolean => {
    return can(inferredRole, permission);
  };

  const checkCanAny = (permissions: Permission[]): boolean => {
    return canAny(inferredRole, permissions);
  };

  const checkCanAll = (permissions: Permission[]): boolean => {
    return canAll(inferredRole, permissions);
  };

  const checkHasRole = (allowedRoles: UserRole[]): boolean => {
    return hasRole(inferredRole, allowedRoles);
  };

  const checkGuard = (options: {
    allowedRoles?: UserRole[];
    permission?: Permission;
    onAllowed?: () => void;
    onDenied?: () => void;
  }): boolean => {
    return guardAction({
      role: inferredRole,
      ...options,
    });
  };

  const deny = (options: {
    action: string;
    resource: string;
    resourceId?: string;
    resourceLabel?: string;
    reason?: string;
    severity?: "low" | "medium" | "high";
    metadata?: Record<string, unknown>;
  }): void => {
    logDeniedAction({
      role: inferredRole,
      action: options.action,
      resource: options.resource,
      resourceId: options.resourceId,
      resourceLabel: options.resourceLabel,
      reason: options.reason || "Insufficient permissions",
      severity: options.severity,
      metadata: options.metadata,
    });
  };

  const requirePermission = (permission: Permission): boolean => {
    const hasPermission = can(inferredRole, permission);
    if (!hasPermission) {
      deny({
        action: "access",
        resource: permission,
        reason: `Missing permission: ${permission}`,
      });
    }
    return hasPermission;
  };

  const requireRole = (allowedRoles: UserRole[]): boolean => {
    const hasRequiredRole = hasRole(inferredRole, allowedRoles);
    if (!hasRequiredRole) {
      deny({
        action: "access",
        resource: "role_restricted",
        reason: `Missing required role: ${allowedRoles.join(", ")}`,
      });
    }
    return hasRequiredRole;
  };

  return {
    role: inferredRole,
    can: checkCan,
    canAny: checkCanAny,
    canAll: checkCanAll,
    hasRole: checkHasRole,
    guard: checkGuard,
    deny,
    requirePermission,
    requireRole,
    getDeniedMessage,
    canPerformSensitiveAction: () => canPerformSensitiveAction(inferredRole),
    canDelete: () => canDelete(inferredRole),
    canExport: () => canExport(inferredRole),
  };
}
