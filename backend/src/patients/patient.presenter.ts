import { Patient, PatientNote, PatientTimelineEvent } from '@prisma/client';

// Role-based patient output types
type PatientRole = 'admin' | 'doctor' | 'nurse' | 'receptionist' | 'billing' | 'auditor' | 'readonly' | 'unknown';

// Base patient fields (safe for all roles)
interface BasePatientOutput {
  id: string;
  externalId: string | null;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  gender: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

// Extended patient fields (clinical/demographic)
interface ExtendedPatientOutput extends BasePatientOutput {
  phone: string | null;
  email: string | null;
  address: string | null;
  emergencyContact: string | null;
  emergencyPhone: string | null;
}

// Full patient output (includes all fields)
interface FullPatientOutput extends ExtendedPatientOutput {
  deletedAt: Date | null;
  deletedBy: string | null;
}

// Patient note output
interface PatientNoteOutput {
  id: string;
  patientId: string;
  content: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// Patient timeline event output
interface PatientTimelineEventOutput {
  id: string;
  patientId: string;
  eventType: string;
  description: string;
  metadata: unknown;
  createdAt: Date;
}

// Role-based field visibility
const ROLE_FIELD_VISIBILITY: Record<PatientRole, {
  canViewPhone: boolean;
  canViewEmail: boolean;
  canViewAddress: boolean;
  canViewEmergencyContact: boolean;
  canViewDeletedInfo: boolean;
}> = {
  admin: {
    canViewPhone: true,
    canViewEmail: true,
    canViewAddress: true,
    canViewEmergencyContact: true,
    canViewDeletedInfo: true,
  },
  doctor: {
    canViewPhone: true,
    canViewEmail: true,
    canViewAddress: true,
    canViewEmergencyContact: true,
    canViewDeletedInfo: false,
  },
  nurse: {
    canViewPhone: true,
    canViewEmail: true,
    canViewAddress: true,
    canViewEmergencyContact: true,
    canViewDeletedInfo: false,
  },
  receptionist: {
    canViewPhone: true,
    canViewEmail: true,
    canViewAddress: true,
    canViewEmergencyContact: true,
    canViewDeletedInfo: false,
  },
  billing: {
    canViewPhone: true,
    canViewEmail: true,
    canViewAddress: true,
    canViewEmergencyContact: false,
    canViewDeletedInfo: false,
  },
  auditor: {
    canViewPhone: true,
    canViewEmail: true,
    canViewAddress: true,
    canViewEmergencyContact: true,
    canViewDeletedInfo: true,
  },
  readonly: {
    canViewPhone: false,
    canViewEmail: false,
    canViewAddress: false,
    canViewEmergencyContact: false,
    canViewDeletedInfo: false,
  },
  unknown: {
    canViewPhone: false,
    canViewEmail: false,
    canViewAddress: false,
    canViewEmergencyContact: false,
    canViewDeletedInfo: false,
  },
};

/**
 * Shape patient output based on user role
 */
export function shapePatientOutput(
  patient: Patient,
  userRole: PatientRole = 'unknown'
): BasePatientOutput | ExtendedPatientOutput | FullPatientOutput {
  const visibility = ROLE_FIELD_VISIBILITY[userRole] || ROLE_FIELD_VISIBILITY.unknown;
  
  const base: BasePatientOutput = {
    id: patient.id,
    externalId: patient.externalId,
    firstName: patient.firstName,
    lastName: patient.lastName,
    dateOfBirth: patient.dateOfBirth,
    gender: patient.gender,
    status: patient.status,
    createdAt: patient.createdAt,
    updatedAt: patient.updatedAt,
  };

  // Add extended fields if role permits
  if (visibility.canViewPhone || visibility.canViewEmail || visibility.canViewAddress || visibility.canViewEmergencyContact) {
    const extended: ExtendedPatientOutput = {
      ...base,
      phone: visibility.canViewPhone ? patient.phone : null,
      email: visibility.canViewEmail ? patient.email : null,
      address: visibility.canViewAddress ? patient.address : null,
      emergencyContact: visibility.canViewEmergencyContact ? patient.emergencyContact : null,
      emergencyPhone: visibility.canViewEmergencyContact ? patient.emergencyPhone : null,
    };
    
    // Add deleted info if role permits
    if (visibility.canViewDeletedInfo) {
      const full: FullPatientOutput = {
        ...extended,
        deletedAt: patient.deletedAt,
        deletedBy: patient.deletedBy,
      };
      return full;
    }
    
    return extended;
  }

  return base;
}

/**
 * Shape patient list output based on user role
 */
export function shapePatientListOutput(
  patients: Patient[],
  userRole: PatientRole = 'unknown'
): (BasePatientOutput | ExtendedPatientOutput | FullPatientOutput)[] {
  return patients.map(patient => shapePatientOutput(patient, userRole));
}

/**
 * Shape patient note output
 */
export function shapePatientNoteOutput(note: PatientNote): PatientNoteOutput {
  return {
    id: note.id,
    patientId: note.patientId,
    content: note.content,
    createdBy: note.createdBy,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  };
}

/**
 * Shape patient note list output
 */
export function shapePatientNoteListOutput(notes: PatientNote[]): PatientNoteOutput[] {
  return notes.map(note => shapePatientNoteOutput(note));
}

/**
 * Shape patient timeline event output
 */
export function shapePatientTimelineEventOutput(event: PatientTimelineEvent): PatientTimelineEventOutput {
  return {
    id: event.id,
    patientId: event.patientId,
    eventType: event.eventType,
    description: event.description,
    metadata: event.metadata,
    createdAt: event.createdAt,
  };
}

/**
 * Shape patient timeline event list output
 */
export function shapePatientTimelineEventListOutput(events: PatientTimelineEvent[]): PatientTimelineEventOutput[] {
  return events.map(event => shapePatientTimelineEventOutput(event));
}

/**
 * Determine user role from roles array
 */
export function determineUserRole(roles: string[]): PatientRole {
  if (roles.includes('admin')) return 'admin';
  if (roles.includes('doctor')) return 'doctor';
  if (roles.includes('nurse')) return 'nurse';
  if (roles.includes('receptionist')) return 'receptionist';
  if (roles.includes('billing')) return 'billing';
  if (roles.includes('auditor')) return 'auditor';
  if (roles.includes('readonly')) return 'readonly';
  return 'unknown';
}
