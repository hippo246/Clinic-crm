// ─── ROLE PERMISSIONS ─────────────────────────────────────────────────────────
// Each role lists what it CAN see/do. Absence = denied.

export const ROLES = {
  admin:         "admin",
  receptionist:  "receptionist",
  doctor:        "doctor",
};

export const PERMISSIONS = {
  // Medical section (conditions, allergies, medications)
  viewMedical:        ["admin", "doctor"],
  // Billing / insurance info
  viewBilling:        ["admin", "receptionist"],
  // Delete documents
  deleteDocument:     ["admin"],
  // Edit medical alerts (conditions, allergy field)
  editMedicalAlerts:  ["admin", "doctor"],
  // View audit log
  viewAudit:          ["admin"],
  // Edit patient
  editPatient:        ["admin", "receptionist"],
};

/**
 * can(role, permission) → boolean
 * Usage: can("receptionist", "viewMedical") → false
 */
export function can(role, permission) {
  const allowed = PERMISSIONS[permission];
  if (!allowed) return false;
  return allowed.includes(role);
}
