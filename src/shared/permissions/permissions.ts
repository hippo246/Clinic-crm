/**
 * Permission system
 * Centralized permission model for RBAC
 */

/**
 * User roles
 */
export type UserRole =
  | "admin"
  | "doctor"
  | "nurse"
  | "receptionist"
  | "billing"
  | "auditor"
  | "readonly";

/**
 * Role constants (as const for type safety)
 */
export const ROLES = ["admin", "doctor", "nurse", "receptionist", "billing", "auditor", "readonly"] as const;

/**
 * Role labels for UI display
 */
export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  doctor: "Doctor",
  nurse: "Nurse",
  receptionist: "Receptionist",
  billing: "Billing",
  auditor: "Auditor",
  readonly: "Read-only",
};

/**
 * Permission strings
 */
export type Permission =
  // Patient permissions
  | "view_patients"
  | "edit_patients"
  | "delete_patients"
  | "view_patient_sensitive"
  | "edit_patient_sensitive"
  // Medical permissions
  | "view_medical"
  | "edit_medical"
  | "prescribe"
  | "view_vitals"
  | "edit_vitals"
  // Appointment permissions
  | "schedule"
  | "edit_appointments"
  | "cancel_appointments"
  // Lab permissions
  | "view_lab"
  | "edit_lab"
  | "approve_lab"
  // Billing permissions
  | "view_billing"
  | "edit_billing"
  | "delete_billing"
  // Document permissions
  | "view_documents"
  | "upload_documents"
  | "delete_documents"
  // Communication permissions
  | "send_communication"
  | "view_communication"
  // Staff permissions
  | "manage_staff"
  | "view_staff"
  // Reports permissions
  | "view_reports"
  | "export_reports"
  // Audit permissions
  | "view_audit"
  | "export_audit"
  // Settings permissions
  | "manage_settings"
  | "backup_restore"
  // System permissions
  | "all";

/**
 * Role-based permission mapping
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: ["all"],
  doctor: [
    "view_patients",
    "edit_patients",
    "view_medical",
    "edit_medical",
    "prescribe",
    "view_vitals",
    "edit_vitals",
    "schedule",
    "view_lab",
    "edit_lab",
    "view_billing",
    "view_reports",
    "view_documents",
    "upload_documents",
    "send_communication",
    "view_communication",
  ],
  nurse: [
    "view_patients",
    "edit_patients",
    "view_medical",
    "view_vitals",
    "edit_vitals",
    "schedule",
    "view_lab",
    "edit_lab",
    "view_reports",
    "view_documents",
    "upload_documents",
    "view_communication",
  ],
  receptionist: [
    "view_patients",
    "edit_patients",
    "schedule",
    "edit_appointments",
    "cancel_appointments",
    "view_billing",
    "edit_billing",
    "view_reports",
    "view_documents",
    "upload_documents",
    "send_communication",
    "view_communication",
  ],
  billing: [
    "view_patients",
    "view_billing",
    "edit_billing",
    "delete_billing",
    "view_reports",
    "export_reports",
  ],
  auditor: [
    "view_patients",
    "view_medical",
    "view_billing",
    "view_lab",
    "view_reports",
    "view_audit",
    "export_audit",
    "view_communication",
  ],
  readonly: [
    "view_patients",
    "view_medical",
    "view_billing",
    "view_lab",
    "view_reports",
    "view_documents",
    "view_communication",
  ],
};

/**
 * Check if a role has a specific permission
 */
export function can(role: UserRole, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes("all") || permissions.includes(permission);
}

/**
 * Check if a role has any of the specified permissions
 */
export function canAny(role: UserRole, permissions: Permission[]): boolean {
  return permissions.some((permission) => can(role, permission));
}

/**
 * Check if a role has all of the specified permissions
 */
export function canAll(role: UserRole, permissions: Permission[]): boolean {
  return permissions.every((permission) => can(role, permission));
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}

/**
 * Check if a role can perform a sensitive action
 */
export function canPerformSensitiveAction(role: UserRole): boolean {
  return ["admin", "doctor", "nurse"].includes(role);
}

/**
 * Check if a role can delete data
 */
export function canDelete(role: UserRole): boolean {
  return ["admin"].includes(role);
}

/**
 * Check if a role can export data
 */
export function canExport(role: UserRole): boolean {
  return ["admin", "auditor", "billing"].includes(role);
}

/**
 * Check if a role is in the allowed roles list
 */
export function hasRole(role: UserRole, allowedRoles: UserRole[]): boolean {
  return allowedRoles.includes(role);
}

/**
 * Check if a role is a known valid role
 */
export function isKnownRole(role: string): role is UserRole {
  return ROLES.includes(role as UserRole);
}

/**
 * Safely normalize a role string to a valid UserRole
 * Falls back to "readonly" for unknown roles (safe low-access behavior)
 */
export function normalizeRole(role: string | undefined | null): UserRole {
  if (!role) return "readonly";
  if (isKnownRole(role)) return role;
  return "readonly"; // Safe fallback for unknown roles
}

/**
 * Get a user-friendly denied access message for an action or area
 * This is a simple helper for UI feedback - does not perform logging
 */
export function getDeniedMessage(actionOrArea: string): string {
  const area = actionOrArea.toLowerCase();
  if (area.includes("delete")) return "You do not have permission to delete this item.";
  if (area.includes("edit") || area.includes("modify")) return "You do not have permission to edit this item.";
  if (area.includes("export")) return "You do not have permission to export data.";
  if (area.includes("settings")) return "You do not have permission to access settings.";
  if (area.includes("staff")) return "You do not have permission to manage staff.";
  if (area.includes("audit")) return "You do not have permission to access audit logs.";
  if (area.includes("billing")) return "You do not have permission to access billing.";
  if (area.includes("prescriptions")) return "You do not have permission to manage prescriptions.";
  if (area.includes("lab")) return "You do not have permission to access lab results.";
  if (area.includes("reports")) return "You do not have permission to view reports.";
  return `You do not have permission to access ${actionOrArea}.`;
}

/**
 * Guard utility for permission checks
 * Simple type-safe helper to check permissions and execute callbacks
 * Returns true if allowed, false if denied
 */
export function guardAction<T = void>(options: {
  role: UserRole;
  allowedRoles?: UserRole[];
  permission?: Permission;
  onAllowed?: () => T;
  onDenied?: () => T;
}): boolean {
  const { role, allowedRoles, permission, onAllowed, onDenied } = options;

  let allowed = false;

  // Check role-based access
  if (allowedRoles) {
    allowed = hasRole(role, allowedRoles);
  }
  // Check permission-based access
  else if (permission) {
    allowed = can(role, permission);
  }
  // If neither provided, deny by default
  else {
    allowed = false;
  }

  // Execute appropriate callback
  if (allowed) {
    if (onAllowed) onAllowed();
  } else {
    if (onDenied) onDenied();
  }

  return allowed;
}
