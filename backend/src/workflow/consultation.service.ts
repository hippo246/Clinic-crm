import { prisma } from '../db/client';
import { logger } from '../utils/logger';
import { logAuditEvent } from '../services/auditService';
import { validateConsultationTransition } from './workflowStateMachine';
import { validatePatientForWorkflow } from './patientWorkflowGuard';
import { canCompleteConsultation } from './clinicalSafety';
import {
  CreateConsultationInput,
  UpdateConsultationInput,
  CompleteConsultationInput,
  ConsultationListQuery,
} from './workflow.validation';

/**
 * Create consultation
 */
export async function createConsultation(
  data: CreateConsultationInput,
  actorId: string,
  actorRole: string
) {
  try {
    // Validate patient
    const patientCheck = await validatePatientForWorkflow(data.patientId);
    if (!patientCheck.valid) {
      throw new Error(patientCheck.error || 'Patient not suitable for consultation');
    }

    // Validate appointment if provided
    if (data.appointmentId) {
      const appointment = await prisma.appointment.findUnique({
        where: { id: data.appointmentId },
      });
      if (!appointment) {
        throw new Error('Appointment not found');
      }
    }

    const consultation = await prisma.consultation.create({
      data: {
        patientId: data.patientId,
        staffId: data.staffId,
        appointmentId: data.appointmentId,
        chiefComplaint: data.chiefComplaint,
        diagnosis: data.diagnosis,
        notes: data.notes,
      },
    });

    // Log audit event with consultationId/patientId only
    await logAuditEvent({
      action: 'consultation_created',
      resourceType: 'consultation',
      resourceId: consultation.id,
      actorId,
      actorRole,
      metadata: {
        consultationId: consultation.id,
        patientId: data.patientId,
      },
    }).catch((err) => {
      logger.warn('Failed to log consultation creation audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return consultation;
  } catch (error) {
    logger.error('Failed to create consultation', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to create consultation');
  }
}

/**
 * Get consultation by ID
 */
export async function getConsultationById(id: string) {
  try {
    const consultation = await prisma.consultation.findUnique({
      where: { id },
    });

    return consultation;
  } catch (error) {
    logger.error('Failed to get consultation by ID', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to get consultation');
  }
}

/**
 * List consultations with pagination and filters
 */
export async function listConsultations(query: ConsultationListQuery) {
  try {
    const { page, limit, patientId, staffId, status, dateFrom, dateTo, sortBy, sortOrder } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (patientId) where.patientId = patientId;
    if (staffId) where.staffId = staffId;
    if (status) where.status = status;

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) (where.createdAt as Record<string, unknown>).gte = new Date(dateFrom);
      if (dateTo) (where.createdAt as Record<string, unknown>).lte = new Date(dateTo);
    }

    const [consultations, total] = await Promise.all([
      prisma.consultation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.consultation.count({ where }),
    ]);

    return {
      consultations,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  } catch (error) {
    logger.error('Failed to list consultations', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to list consultations');
  }
}

/**
 * Update consultation
 */
export async function updateConsultation(
  id: string,
  data: UpdateConsultationInput,
  actorId: string,
  actorRole: string
) {
  try {
    const existingConsultation = await prisma.consultation.findUnique({
      where: { id },
    });

    if (!existingConsultation) {
      throw new Error('Consultation not found');
    }

    // If changing patient, validate new patient
    if (data.patientId && data.patientId !== existingConsultation.patientId) {
      const patientCheck = await validatePatientForWorkflow(data.patientId);
      if (!patientCheck.valid) {
        throw new Error(patientCheck.error || 'Patient not suitable for consultation');
      }
    }

    const updateData: Record<string, unknown> = {};
    const changedFields: string[] = [];

    if (data.patientId !== undefined && data.patientId !== existingConsultation.patientId) {
      updateData.patientId = data.patientId;
      changedFields.push('patientId');
    }
    if (data.staffId !== undefined && data.staffId !== existingConsultation.staffId) {
      updateData.staffId = data.staffId;
      changedFields.push('staffId');
    }
    if (data.appointmentId !== undefined && data.appointmentId !== existingConsultation.appointmentId) {
      updateData.appointmentId = data.appointmentId;
      changedFields.push('appointmentId');
    }
    if (data.chiefComplaint !== undefined && data.chiefComplaint !== existingConsultation.chiefComplaint) {
      updateData.chiefComplaint = data.chiefComplaint;
      changedFields.push('chiefComplaint');
    }
    if (data.diagnosis !== undefined && data.diagnosis !== existingConsultation.diagnosis) {
      updateData.diagnosis = data.diagnosis;
      changedFields.push('diagnosis');
    }
    if (data.notes !== undefined && data.notes !== existingConsultation.notes) {
      updateData.notes = data.notes;
      changedFields.push('notes');
    }

    if (Object.keys(updateData).length === 0) {
      return existingConsultation;
    }

    const consultation = await prisma.consultation.update({
      where: { id },
      data: updateData,
    });

    // Log audit event with changed field names only
    await logAuditEvent({
      action: 'consultation_updated',
      resourceType: 'consultation',
      resourceId: consultation.id,
      actorId,
      actorRole,
      metadata: {
        consultationId: consultation.id,
        patientId: consultation.patientId,
        changedFields,
      },
    }).catch((err) => {
      logger.warn('Failed to log consultation update audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return consultation;
  } catch (error) {
    logger.error('Failed to update consultation', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to update consultation');
  }
}

/**
 * Update consultation status
 */
export async function updateConsultationStatus(
  id: string,
  status: string,
  actorId: string,
  actorRole: string
) {
  try {
    const consultation = await prisma.consultation.findUnique({
      where: { id },
    });

    if (!consultation) {
      throw new Error('Consultation not found');
    }

    // Validate state transition
    const transition = validateConsultationTransition(consultation.status, status);
    if (!transition.valid) {
      throw new Error(transition.error || 'Invalid status transition');
    }

    const updateData: Record<string, unknown> = { status };

    // Set timestamps based on status
    if (status === 'IN_PROGRESS') {
      updateData.startedAt = new Date();
    }
    if (status === 'COMPLETED') {
      updateData.completedAt = new Date();
    }

    const updatedConsultation = await prisma.consultation.update({
      where: { id },
      data: updateData,
    });

    // Log audit event with status change only
    await logAuditEvent({
      action: 'consultation_status_changed',
      resourceType: 'consultation',
      resourceId: consultation.id,
      actorId,
      actorRole,
      metadata: {
        consultationId: consultation.id,
        patientId: consultation.patientId,
        fromStatus: consultation.status,
        toStatus: status,
      },
    }).catch((err) => {
      logger.warn('Failed to log consultation status change audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return updatedConsultation;
  } catch (error) {
    logger.error('Failed to update consultation status', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to update consultation status');
  }
}

/**
 * Complete consultation
 */
export async function completeConsultation(
  id: string,
  data: CompleteConsultationInput,
  actorId: string,
  actorRole: string
) {
  try {
    const consultation = await prisma.consultation.findUnique({
      where: { id },
    });

    if (!consultation) {
      throw new Error('Consultation not found');
    }

    // Validate safety check
    const safetyCheck = canCompleteConsultation({
      status: consultation.status,
      chiefComplaint: consultation.chiefComplaint || undefined,
      notes: data.notes,
    });

    if (!safetyCheck.valid) {
      throw new Error(safetyCheck.errors.join(', '));
    }

    // Validate state transition
    const transition = validateConsultationTransition(consultation.status, 'COMPLETED');
    if (!transition.valid) {
      throw new Error(transition.error || 'Cannot complete consultation');
    }

    const updatedConsultation = await prisma.consultation.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        diagnosis: data.diagnosis,
        notes: data.notes,
      },
    });

    // Log audit event
    await logAuditEvent({
      action: 'consultation_completed',
      resourceType: 'consultation',
      resourceId: consultation.id,
      actorId,
      actorRole,
      metadata: {
        consultationId: consultation.id,
        patientId: consultation.patientId,
      },
    }).catch((err) => {
      logger.warn('Failed to log consultation completion audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return updatedConsultation;
  } catch (error) {
    logger.error('Failed to complete consultation', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to complete consultation');
  }
}

/**
 * Cancel consultation
 */
export async function cancelConsultation(
  id: string,
  actorId: string,
  actorRole: string
) {
  try {
    const consultation = await prisma.consultation.findUnique({
      where: { id },
    });

    if (!consultation) {
      throw new Error('Consultation not found');
    }

    // Validate state transition
    const transition = validateConsultationTransition(consultation.status, 'CANCELLED');
    if (!transition.valid) {
      throw new Error(transition.error || 'Cannot cancel consultation');
    }

    const updatedConsultation = await prisma.consultation.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    // Log audit event
    await logAuditEvent({
      action: 'consultation_cancelled',
      resourceType: 'consultation',
      resourceId: consultation.id,
      actorId,
      actorRole,
      metadata: {
        consultationId: consultation.id,
        patientId: consultation.patientId,
      },
    }).catch((err) => {
      logger.warn('Failed to log consultation cancellation audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return updatedConsultation;
  } catch (error) {
    logger.error('Failed to cancel consultation', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to cancel consultation');
  }
}
