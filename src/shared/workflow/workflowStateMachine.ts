/**
 * Phase 8B: Shared Workflow State-Machine Utility
 * 
 * Provides centralized status transition validation for workflow entities.
 * Prevents invalid status transitions and provides allowed next statuses.
 */

export type WorkflowEntityType = 
  | "queue"
  | "consultation"
  | "prescription"
  | "labOrder"
  | "labResult"
  | "appointment";

export type QueueStatus = 
  | "scheduled"
  | "checked-in"
  | "waiting"
  | "with-doctor"
  | "billing-pending"
  | "completed"
  | "no-show"
  | "cancelled";

export type ConsultationStatus = 
  | "pending"
  | "in-progress"
  | "completed"
  | "cancelled";

export type PrescriptionStatus = 
  | "active"
  | "completed"
  | "cancelled";

export type LabOrderStatus = 
  | "pending"
  | "in-progress"
  | "completed"
  | "cancelled";

export type LabResultStatus = 
  | "pending"
  | "review"
  | "approved"
  | "rejected";

export type AppointmentStatus = 
  | "scheduled"
  | "confirmed"
  | "checked-in"
  | "in-queue"
  | "in-consultation"
  | "completed"
  | "cancelled"
  | "no-show"
  | "rescheduled";

/**
 * Allowed status transitions for each entity type
 */
const TRANSITIONS: Record<WorkflowEntityType, Record<string, string[]>> = {
  queue: {
    "scheduled": ["checked-in", "waiting", "cancelled", "no-show"],
    "checked-in": ["waiting", "with-doctor", "no-show", "cancelled"],
    "waiting": ["with-doctor", "cancelled", "no-show"],
    "with-doctor": ["billing-pending", "completed", "cancelled"],
    "billing-pending": ["completed"],
    "completed": [],
    "no-show": ["scheduled"],
    "cancelled": [],
  },
  consultation: {
    "pending": ["in-progress", "cancelled"],
    "in-progress": ["completed", "cancelled"],
    "completed": [],
    "cancelled": [],
  },
  prescription: {
    "active": ["completed", "cancelled"],
    "completed": [],
    "cancelled": [],
  },
  labOrder: {
    "pending": ["in-progress", "cancelled"],
    "in-progress": ["completed", "cancelled"],
    "completed": [],
    "cancelled": [],
  },
  labResult: {
    "pending": ["review"],
    "review": ["approved", "rejected"],
    "approved": [],
    "rejected": ["review"],
  },
  appointment: {
    "scheduled": ["confirmed", "checked-in", "cancelled", "no-show", "rescheduled"],
    "confirmed": ["checked-in", "cancelled", "no-show", "rescheduled"],
    "checked-in": ["in-queue", "cancelled", "no-show"],
    "in-queue": ["in-consultation", "cancelled", "no-show"],
    "in-consultation": ["completed", "cancelled"],
    "completed": [],
    "cancelled": [],
    "no-show": ["scheduled"],
    "rescheduled": ["scheduled", "confirmed"],
  },
};

/**
 * Check if a status transition is allowed
 */
export function canTransitionStatus(
  entityType: WorkflowEntityType,
  fromStatus: string,
  toStatus: string
): boolean {
  const entityTransitions = TRANSITIONS[entityType];
  if (!entityTransitions) {
    console.warn(`[StateMachine] Unknown entity type: ${entityType}`);
    return false;
  }

  const allowedNext = entityTransitions[fromStatus] || [];
  return allowedNext.includes(toStatus);
}

/**
 * Get allowed next statuses for a given entity type and current status
 */
export function getAllowedNextStatuses(
  entityType: WorkflowEntityType,
  currentStatus: string
): string[] {
  const entityTransitions = TRANSITIONS[entityType];
  if (!entityTransitions) {
    console.warn(`[StateMachine] Unknown entity type: ${entityType}`);
    return [];
  }

  return entityTransitions[currentStatus] || [];
}

/**
 * Validate a workflow transition and return detailed result
 */
export function validateWorkflowTransition(
  entityType: WorkflowEntityType,
  fromStatus: string,
  toStatus: string
): { valid: boolean; reason?: string } {
  const entityTransitions = TRANSITIONS[entityType];
  if (!entityTransitions) {
    return { valid: false, reason: `Unknown entity type: ${entityType}` };
  }

  if (!entityTransitions[fromStatus]) {
    return { valid: false, reason: `Unknown current status: ${fromStatus}` };
  }

  if (!entityTransitions[fromStatus].includes(toStatus)) {
    const allowed = entityTransitions[fromStatus].join(", ");
    return { 
      valid: false, 
      reason: `Invalid transition from ${fromStatus} to ${toStatus}. Allowed: ${allowed}` 
    };
  }

  return { valid: true };
}

/**
 * Type guards for status validation
 */
export function isValidQueueStatus(status: string): status is QueueStatus {
  return TRANSITIONS.queue.hasOwnProperty(status);
}

export function isValidConsultationStatus(status: string): status is ConsultationStatus {
  return TRANSITIONS.consultation.hasOwnProperty(status);
}

export function isValidPrescriptionStatus(status: string): status is PrescriptionStatus {
  return TRANSITIONS.prescription.hasOwnProperty(status);
}

export function isValidLabOrderStatus(status: string): status is LabOrderStatus {
  return TRANSITIONS.labOrder.hasOwnProperty(status);
}

export function isValidLabResultStatus(status: string): status is LabResultStatus {
  return TRANSITIONS.labResult.hasOwnProperty(status);
}

export function isValidAppointmentStatus(status: string): status is AppointmentStatus {
  return TRANSITIONS.appointment.hasOwnProperty(status);
}
