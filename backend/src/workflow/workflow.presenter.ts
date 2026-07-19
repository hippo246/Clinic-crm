/**
 * Workflow Output Shaping Helper
 * Shapes workflow output based on user roles and permissions
 */

export interface WorkflowOutputOptions {
  userRoles: string[];
  permissions?: string[];
}

/**
 * Determine if user has clinical access
 */
function hasClinicalAccess(roles: string[], permissions?: string[]): boolean {
  return (
    roles.includes('admin') ||
    roles.includes('doctor') ||
    roles.includes('nurse') ||
    permissions?.includes('view_clinical_data') ||
    false
  );
}

/**
 * Determine if user is read-only
 */
function isReadOnly(roles: string[]): boolean {
  return roles.includes('auditor') || roles.includes('readonly');
}

/**
 * Shape appointment output based on user role
 */
export function shapeAppointmentOutput<T extends Record<string, unknown>>(
  appointment: T,
  options: WorkflowOutputOptions
): T {
  const { userRoles, permissions } = options;

  // Return full appointment for clinical/admin users
  if (hasClinicalAccess(userRoles, permissions)) {
    return appointment;
  }

  // For billing/receptionist, limit to scheduling info only
  const shaped = { ...appointment };
  
  // Remove clinical notes if not clinical user
  if (!hasClinicalAccess(userRoles, permissions) && 'notes' in shaped) {
    delete (shaped as Record<string, unknown>).notes;
  }

  return shaped;
}

/**
 * Shape consultation output based on user role
 */
export function shapeConsultationOutput<T extends Record<string, unknown>>(
  consultation: T,
  options: WorkflowOutputOptions
): T {
  const { userRoles, permissions } = options;

  // Return full consultation for clinical/admin users
  if (hasClinicalAccess(userRoles, permissions)) {
    return consultation;
  }

  // For non-clinical users, remove clinical fields
  const shaped = { ...consultation };
  
  if ('chiefComplaint' in shaped) {
    delete (shaped as Record<string, unknown>).chiefComplaint;
  }
  if ('diagnosis' in shaped) {
    delete (shaped as Record<string, unknown>).diagnosis;
  }
  if ('notes' in shaped) {
    delete (shaped as Record<string, unknown>).notes;
  }

  return shaped;
}

/**
 * Shape prescription output based on user role
 */
export function shapePrescriptionOutput<T extends Record<string, unknown>>(
  prescription: T,
  options: WorkflowOutputOptions
): T {
  const { userRoles, permissions } = options;

  // Return full prescription for clinical/admin users
  if (hasClinicalAccess(userRoles, permissions)) {
    return prescription;
  }

  // For non-clinical users, remove clinical details
  const shaped = { ...prescription };
  
  if ('medication' in shaped) {
    delete (shaped as Record<string, unknown>).medication;
  }
  if ('dosage' in shaped) {
    delete (shaped as Record<string, unknown>).dosage;
  }
  if ('frequency' in shaped) {
    delete (shaped as Record<string, unknown>).frequency;
  }
  if ('duration' in shaped) {
    delete (shaped as Record<string, unknown>).duration;
  }
  if ('instructions' in shaped) {
    delete (shaped as Record<string, unknown>).instructions;
  }

  return shaped;
}

/**
 * Shape lab result output based on user role
 */
export function shapeLabResultOutput<T extends Record<string, unknown>>(
  labResult: T,
  options: WorkflowOutputOptions
): T {
  const { userRoles, permissions } = options;

  // Return full lab result for clinical/admin users
  if (hasClinicalAccess(userRoles, permissions)) {
    return labResult;
  }

  // For non-clinical users, remove clinical values
  const shaped = { ...labResult };
  
  if ('resultValue' in shaped) {
    delete (shaped as Record<string, unknown>).resultValue;
  }
  if ('notes' in shaped) {
    delete (shaped as Record<string, unknown>).notes;
  }

  return shaped;
}

/**
 * Shape queue entry output based on user role
 */
export function shapeQueueEntryOutput<T extends Record<string, unknown>>(
  queueEntry: T,
  _options: WorkflowOutputOptions
): T {
  // Queue entries are generally safe for all roles
  return queueEntry;
}

/**
 * Shape lab order output based on user role
 */
export function shapeLabOrderOutput<T extends Record<string, unknown>>(
  labOrder: T,
  _options: WorkflowOutputOptions
): T {
  // Lab orders are generally safe for all roles (test type, status, etc.)
  return labOrder;
}

/**
 * Check if user can mutate workflow records
 */
export function canMutateWorkflow(roles: string[], permissions?: string[]): boolean {
  if (isReadOnly(roles)) {
    return false;
  }

  return (
    roles.includes('admin') ||
    roles.includes('doctor') ||
    roles.includes('nurse') ||
    roles.includes('receptionist') ||
    permissions?.includes('edit_workflow') ||
    false
  );
}
