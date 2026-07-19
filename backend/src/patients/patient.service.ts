import { prisma } from '../db/client';
import { logger } from '../utils/logger';
import { logAuditEvent } from '../services/auditService';
import type { Prisma } from '@prisma/client';
import { 
  CreatePatientInput, 
  UpdatePatientInput, 
  PatientListQuery,
  ArchivePatientInput,
  PatientNoteCreateInput,
  PatientNoteUpdateInput,
  PatientTimelineEventCreateInput 
} from './patient.validation';

/**
 * Create a new patient
 */
export async function createPatient(
  data: CreatePatientInput,
  actorId: string,
  actorRole: string
) {
  try {
    const patient = await prisma.patient.create({
      data: {
        externalId: data.externalId,
        firstName: data.firstName,
        lastName: data.lastName,
        dateOfBirth: typeof data.dateOfBirth === 'string' ? new Date(data.dateOfBirth) : data.dateOfBirth,
        gender: data.gender,
        phone: data.phone,
        email: data.email,
        address: data.address,
        emergencyContact: data.emergencyContact,
        emergencyPhone: data.emergencyPhone,
        status: data.status || 'ACTIVE',
      },
    });

    // Log audit event with patientId only (no PHI)
    await logAuditEvent({
      action: 'patient_created',
      resourceType: 'patient',
      resourceId: patient.id,
      actorId,
      actorRole,
      metadata: {
        patientId: patient.id,
        externalId: data.externalId,
      },
    }).catch((err) => {
      logger.warn('Failed to log patient creation audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return patient;
  } catch (error) {
    logger.error('Failed to create patient', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to create patient');
  }
}

/**
 * Get patient by ID
 */
export async function getPatientById(id: string, includeArchived = false) {
  try {
    const patient = await prisma.patient.findUnique({
      where: { id },
      include: {
        notes: {
          orderBy: { createdAt: 'desc' },
        },
        timelineEvents: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!patient) {
      return null;
    }

    // If not including archived and patient is deleted, return null
    if (!includeArchived && patient.deletedAt) {
      return null;
    }

    return patient;
  } catch (error) {
    logger.error('Failed to get patient by ID', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to get patient');
  }
}

/**
 * List patients with pagination and filters
 */
export async function listPatients(query: PatientListQuery, includeArchived = false) {
  try {
    const { page, limit, status, search, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    // Filter by status if provided
    if (status) {
      where.status = status;
    }

    // Filter out deleted/archived unless explicitly requested
    if (!includeArchived) {
      where.deletedAt = null;
    }

    // Search by name, phone, or email if provided
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
        { externalId: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [patients, total] = await Promise.all([
      prisma.patient.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.patient.count({ where }),
    ]);

    return {
      patients,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  } catch (error) {
    logger.error('Failed to list patients', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to list patients');
  }
}

/**
 * Update patient
 */
export async function updatePatient(
  id: string,
  data: UpdatePatientInput,
  actorId: string,
  actorRole: string
) {
  try {
    const existingPatient = await prisma.patient.findUnique({
      where: { id },
    });

    if (!existingPatient) {
      throw new Error('Patient not found');
    }

    // Build update data and track changed fields
    const updateData: Record<string, unknown> = {};
    const changedFields: string[] = [];

    if (data.firstName !== undefined && data.firstName !== existingPatient.firstName) {
      updateData.firstName = data.firstName;
      changedFields.push('firstName');
    }
    if (data.lastName !== undefined && data.lastName !== existingPatient.lastName) {
      updateData.lastName = data.lastName;
      changedFields.push('lastName');
    }
    if (data.dateOfBirth !== undefined) {
      const newDob = typeof data.dateOfBirth === 'string' ? new Date(data.dateOfBirth) : data.dateOfBirth;
      if (newDob.getTime() !== existingPatient.dateOfBirth.getTime()) {
        updateData.dateOfBirth = newDob;
        changedFields.push('dateOfBirth');
      }
    }
    if (data.gender !== undefined && data.gender !== existingPatient.gender) {
      updateData.gender = data.gender;
      changedFields.push('gender');
    }
    if (data.phone !== undefined && data.phone !== existingPatient.phone) {
      updateData.phone = data.phone;
      changedFields.push('phone');
    }
    if (data.email !== undefined && data.email !== existingPatient.email) {
      updateData.email = data.email;
      changedFields.push('email');
    }
    if (data.address !== undefined && data.address !== existingPatient.address) {
      updateData.address = data.address;
      changedFields.push('address');
    }
    if (data.emergencyContact !== undefined && data.emergencyContact !== existingPatient.emergencyContact) {
      updateData.emergencyContact = data.emergencyContact;
      changedFields.push('emergencyContact');
    }
    if (data.emergencyPhone !== undefined && data.emergencyPhone !== existingPatient.emergencyPhone) {
      updateData.emergencyPhone = data.emergencyPhone;
      changedFields.push('emergencyPhone');
    }
    if (data.status !== undefined && data.status !== existingPatient.status) {
      updateData.status = data.status;
      changedFields.push('status');
    }

    if (Object.keys(updateData).length === 0) {
      return existingPatient;
    }

    const patient = await prisma.patient.update({
      where: { id },
      data: updateData,
    });

    // Log audit event with changed field names only (no PHI values)
    await logAuditEvent({
      action: 'patient_updated',
      resourceType: 'patient',
      resourceId: patient.id,
      actorId,
      actorRole,
      metadata: {
        patientId: patient.id,
        changedFields,
      },
    }).catch((err) => {
      logger.warn('Failed to log patient update audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return patient;
  } catch (error) {
    logger.error('Failed to update patient', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to update patient');
  }
}

/**
 * Archive patient (soft delete)
 */
export async function archivePatient(
  id: string,
  data: ArchivePatientInput,
  actorId: string,
  actorRole: string
) {
  try {
    const patient = await prisma.patient.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy: actorId,
        status: 'INACTIVE',
      },
    });

    // Log audit event with patientId only (no PHI)
    await logAuditEvent({
      action: 'patient_archived',
      resourceType: 'patient',
      resourceId: patient.id,
      actorId,
      actorRole,
      metadata: {
        patientId: patient.id,
        reasonCode: data.reasonCode,
      },
    }).catch((err) => {
      logger.warn('Failed to log patient archive audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return patient;
  } catch (error) {
    logger.error('Failed to archive patient', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to archive patient');
  }
}

/**
 * Restore patient
 */
export async function restorePatient(
  id: string,
  actorId: string,
  actorRole: string
) {
  try {
    const patient = await prisma.patient.update({
      where: { id },
      data: {
        deletedAt: null,
        deletedBy: null,
        status: 'ACTIVE',
      },
    });

    // Log audit event with patientId only (no PHI)
    await logAuditEvent({
      action: 'patient_restored',
      resourceType: 'patient',
      resourceId: patient.id,
      actorId,
      actorRole,
      metadata: {
        patientId: patient.id,
      },
    }).catch((err) => {
      logger.warn('Failed to log patient restore audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return patient;
  } catch (error) {
    logger.error('Failed to restore patient', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to restore patient');
  }
}

/**
 * Get patient audit trail
 */
export async function getPatientAuditTrail(patientId: string) {
  try {
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        resourceType: 'patient',
        resourceId: patientId,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return auditLogs;
  } catch (error) {
    logger.error('Failed to get patient audit trail', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to get patient audit trail');
  }
}

/**
 * Create patient note
 */
export async function createPatientNote(
  patientId: string,
  data: PatientNoteCreateInput,
  createdBy: string,
  actorRole: string
) {
  try {
    const note = await prisma.patientNote.create({
      data: {
        patientId,
        content: data.content,
        createdBy,
      },
    });

    // Log audit event with patientId and noteId only (no note content)
    await logAuditEvent({
      action: 'patient_note_created',
      resourceType: 'patient_note',
      resourceId: note.id,
      actorId: createdBy,
      actorRole,
      metadata: {
        patientId,
        noteId: note.id,
      },
    }).catch((err) => {
      logger.warn('Failed to log patient note creation audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return note;
  } catch (error) {
    logger.error('Failed to create patient note', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to create patient note');
  }
}

/**
 * Update patient note
 */
export async function updatePatientNote(
  noteId: string,
  data: PatientNoteUpdateInput,
  actorId: string,
  actorRole: string
) {
  try {
    const note = await prisma.patientNote.update({
      where: { id: noteId },
      data: {
        content: data.content,
      },
    });

    // Log audit event with noteId only (no note content)
    await logAuditEvent({
      action: 'patient_note_updated',
      resourceType: 'patient_note',
      resourceId: note.id,
      actorId,
      actorRole,
      metadata: {
        patientId: note.patientId,
        noteId: note.id,
      },
    }).catch((err) => {
      logger.warn('Failed to log patient note update audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return note;
  } catch (error) {
    logger.error('Failed to update patient note', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to update patient note');
  }
}

/**
 * Soft delete patient note
 */
export async function deletePatientNote(
  noteId: string,
  actorId: string,
  actorRole: string
) {
  try {
    const note = await prisma.patientNote.update({
      where: { id: noteId },
      data: {
        deletedAt: new Date(),
        deletedBy: actorId,
      },
    });

    // Log audit event with noteId only (no note content)
    await logAuditEvent({
      action: 'patient_note_deleted',
      resourceType: 'patient_note',
      resourceId: note.id,
      actorId,
      actorRole,
      metadata: {
        patientId: note.patientId,
        noteId: note.id,
        deletedAt: note.deletedAt?.toISOString(),
      },
    }).catch((err) => {
      logger.warn('Failed to log patient note deletion audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return note;
  } catch (error) {
    logger.error('Failed to delete patient note', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to delete patient note');
  }
}

/**
 * Add patient timeline event
 */
export async function addPatientTimelineEvent(
  patientId: string,
  data: PatientTimelineEventCreateInput,
  actorId: string,
  actorRole: string
) {
  try {
    const event = await prisma.patientTimelineEvent.create({
      data: {
        patientId,
        eventType: data.eventType,
        description: data.description,
        metadata: data.metadata as Prisma.InputJsonValue,
      },
    });

    // Log audit event with patientId and eventId only (no event details)
    await logAuditEvent({
      action: 'patient_timeline_event_created',
      resourceType: 'patient_timeline_event',
      resourceId: event.id,
      actorId,
      actorRole,
      metadata: {
        patientId,
        eventId: event.id,
        eventType: data.eventType,
      },
    }).catch((err) => {
      logger.warn('Failed to log patient timeline event creation audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return event;
  } catch (error) {
    logger.error('Failed to add patient timeline event', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to add patient timeline event');
  }
}

/**
 * Get patient timeline events
 */
export async function getPatientTimelineEvents(patientId: string) {
  try {
    const events = await prisma.patientTimelineEvent.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return events;
  } catch (error) {
    logger.error('Failed to get patient timeline events', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to get patient timeline events');
  }
}

/**
 * Get patient notes
 */
export async function getPatientNotes(patientId: string, includeDeleted = false) {
  try {
    const where: Record<string, unknown> = { patientId };
    
    // Exclude deleted notes by default
    if (!includeDeleted) {
      where.deletedAt = null;
    }
    
    const notes = await prisma.patientNote.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return notes;
  } catch (error) {
    logger.error('Failed to get patient notes', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to get patient notes');
  }
}
