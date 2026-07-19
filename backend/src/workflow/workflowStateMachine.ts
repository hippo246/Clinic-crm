/**
 * Workflow State Machine
 * Validates state transitions for workflow entities
 */

// Appointment Status Transitions
const APPOINTMENT_TRANSITIONS: Record<string, string[]> = {
  SCHEDULED: ['CONFIRMED', 'CHECKED_IN', 'CANCELLED', 'NO_SHOW'],
  CONFIRMED: ['CHECKED_IN', 'CANCELLED', 'NO_SHOW'],
  CHECKED_IN: ['IN_PROGRESS', 'CANCELLED', 'NO_SHOW'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [], // Terminal state
  CANCELLED: [], // Terminal state
  NO_SHOW: [], // Terminal state
};

// Queue Status Transitions
const QUEUE_TRANSITIONS: Record<string, string[]> = {
  WAITING: ['IN_PROGRESS', 'CANCELLED', 'SKIPPED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [], // Terminal state
  CANCELLED: [], // Terminal state
  SKIPPED: [], // Terminal state
};

// Consultation Status Transitions
const CONSULTATION_TRANSITIONS: Record<string, string[]> = {
  SCHEDULED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [], // Terminal state
  CANCELLED: [], // Terminal state
};

// Prescription Status Transitions
const PRESCRIPTION_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['ISSUED', 'CANCELLED'],
  ISSUED: ['DISPENSED', 'CANCELLED', 'EXPIRED'],
  DISPENSED: ['EXPIRED'],
  CANCELLED: [], // Terminal state
  EXPIRED: [], // Terminal state
};

// Lab Order Status Transitions
const LAB_ORDER_TRANSITIONS: Record<string, string[]> = {
  ORDERED: ['SAMPLE_COLLECTED', 'IN_PROGRESS', 'CANCELLED'],
  SAMPLE_COLLECTED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [], // Terminal state
  CANCELLED: [], // Terminal state
};

// Lab Result Status Transitions
const LAB_RESULT_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['REVIEWED', 'APPROVED', 'REJECTED'],
  REVIEWED: ['APPROVED', 'REJECTED'],
  APPROVED: [], // Terminal state
  REJECTED: [], // Terminal state
};

/**
 * Validate appointment status transition
 */
export function validateAppointmentTransition(
  fromStatus: string,
  toStatus: string
): { valid: boolean; error?: string } {
  const allowedTransitions = APPOINTMENT_TRANSITIONS[fromStatus];
  
  if (!allowedTransitions) {
    return { valid: false, error: `Invalid from status: ${fromStatus}` };
  }
  
  if (!allowedTransitions.includes(toStatus)) {
    return { 
      valid: false, 
      error: `Cannot transition from ${fromStatus} to ${toStatus}. Allowed: ${allowedTransitions.join(', ')}` 
    };
  }
  
  return { valid: true };
}

/**
 * Validate queue status transition
 */
export function validateQueueTransition(
  fromStatus: string,
  toStatus: string
): { valid: boolean; error?: string } {
  const allowedTransitions = QUEUE_TRANSITIONS[fromStatus];
  
  if (!allowedTransitions) {
    return { valid: false, error: `Invalid from status: ${fromStatus}` };
  }
  
  if (!allowedTransitions.includes(toStatus)) {
    return { 
      valid: false, 
      error: `Cannot transition from ${fromStatus} to ${toStatus}. Allowed: ${allowedTransitions.join(', ')}` 
    };
  }
  
  return { valid: true };
}

/**
 * Validate consultation status transition
 */
export function validateConsultationTransition(
  fromStatus: string,
  toStatus: string
): { valid: boolean; error?: string } {
  const allowedTransitions = CONSULTATION_TRANSITIONS[fromStatus];
  
  if (!allowedTransitions) {
    return { valid: false, error: `Invalid from status: ${fromStatus}` };
  }
  
  if (!allowedTransitions.includes(toStatus)) {
    return { 
      valid: false, 
      error: `Cannot transition from ${fromStatus} to ${toStatus}. Allowed: ${allowedTransitions.join(', ')}` 
    };
  }
  
  return { valid: true };
}

/**
 * Validate prescription status transition
 */
export function validatePrescriptionTransition(
  fromStatus: string,
  toStatus: string
): { valid: boolean; error?: string } {
  const allowedTransitions = PRESCRIPTION_TRANSITIONS[fromStatus];
  
  if (!allowedTransitions) {
    return { valid: false, error: `Invalid from status: ${fromStatus}` };
  }
  
  if (!allowedTransitions.includes(toStatus)) {
    return { 
      valid: false, 
      error: `Cannot transition from ${fromStatus} to ${toStatus}. Allowed: ${allowedTransitions.join(', ')}` 
    };
  }
  
  return { valid: true };
}

/**
 * Validate lab order status transition
 */
export function validateLabOrderTransition(
  fromStatus: string,
  toStatus: string
): { valid: boolean; error?: string } {
  const allowedTransitions = LAB_ORDER_TRANSITIONS[fromStatus];
  
  if (!allowedTransitions) {
    return { valid: false, error: `Invalid from status: ${fromStatus}` };
  }
  
  if (!allowedTransitions.includes(toStatus)) {
    return { 
      valid: false, 
      error: `Cannot transition from ${fromStatus} to ${toStatus}. Allowed: ${allowedTransitions.join(', ')}` 
    };
  }
  
  return { valid: true };
}

/**
 * Validate lab result status transition
 */
export function validateLabResultTransition(
  fromStatus: string,
  toStatus: string
): { valid: boolean; error?: string } {
  const allowedTransitions = LAB_RESULT_TRANSITIONS[fromStatus];
  
  if (!allowedTransitions) {
    return { valid: false, error: `Invalid from status: ${fromStatus}` };
  }
  
  if (!allowedTransitions.includes(toStatus)) {
    return { 
      valid: false, 
      error: `Cannot transition from ${fromStatus} to ${toStatus}. Allowed: ${allowedTransitions.join(', ')}` 
    };
  }
  
  return { valid: true };
}

/**
 * Check if status is terminal (no further transitions allowed)
 */
export function isTerminalStatus(
  entityType: 'appointment' | 'queue' | 'consultation' | 'prescription' | 'labOrder' | 'labResult',
  status: string
): boolean {
  const transitionsMap = {
    appointment: APPOINTMENT_TRANSITIONS,
    queue: QUEUE_TRANSITIONS,
    consultation: CONSULTATION_TRANSITIONS,
    prescription: PRESCRIPTION_TRANSITIONS,
    labOrder: LAB_ORDER_TRANSITIONS,
    labResult: LAB_RESULT_TRANSITIONS,
  };
  
  const transitions = transitionsMap[entityType][status];
  return !transitions || transitions.length === 0;
}
