import { prisma } from '../db/client';
import { logger } from '../utils/logger';
import { logAuditEvent } from '../services/auditService';
import { validateQueueTransition } from './workflowStateMachine';
import { validatePatientForWorkflow } from './patientWorkflowGuard';
import {
  CreateQueueEntryInput,
  UpdateQueueEntryInput,
  QueueListQuery,
} from './workflow.validation';

/**
 * Create queue entry
 */
export async function createQueueEntry(
  data: CreateQueueEntryInput,
  actorId: string,
  actorRole: string
) {
  try {
    // Validate patient
    const patientCheck = await validatePatientForWorkflow(data.patientId);
    if (!patientCheck.valid) {
      throw new Error(patientCheck.error || 'Patient not suitable for queue entry');
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

    const queueEntry = await prisma.queueEntry.create({
      data: {
        patientId: data.patientId,
        appointmentId: data.appointmentId,
        priority: data.priority,
      },
    });

    // Log audit event with queueEntryId/patientId only
    await logAuditEvent({
      action: 'queue_entry_created',
      resourceType: 'queue_entry',
      resourceId: queueEntry.id,
      actorId,
      actorRole,
      metadata: {
        queueEntryId: queueEntry.id,
        patientId: data.patientId,
      },
    }).catch((err) => {
      logger.warn('Failed to log queue entry creation audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return queueEntry;
  } catch (error) {
    logger.error('Failed to create queue entry', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to create queue entry');
  }
}

/**
 * Get queue entry by ID
 */
export async function getQueueEntryById(id: string) {
  try {
    const queueEntry = await prisma.queueEntry.findUnique({
      where: { id },
    });

    return queueEntry;
  } catch (error) {
    logger.error('Failed to get queue entry by ID', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to get queue entry');
  }
}

/**
 * List queue entries with pagination and filters
 */
export async function listQueueEntries(query: QueueListQuery) {
  try {
    const { page, limit, patientId, status, priority, sortBy, sortOrder } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (patientId) where.patientId = patientId;
    if (status) where.status = status;
    if (priority !== undefined) where.priority = priority;

    const [queueEntries, total] = await Promise.all([
      prisma.queueEntry.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          patient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      } as any),
      prisma.queueEntry.count({ where }),
    ]);

    return {
      queueEntries,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  } catch (error) {
    logger.error('Failed to list queue entries', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to list queue entries');
  }
}

/**
 * Update queue entry
 */
export async function updateQueueEntry(
  id: string,
  data: UpdateQueueEntryInput,
  actorId: string,
  actorRole: string
) {
  try {
    const existingQueueEntry = await prisma.queueEntry.findUnique({
      where: { id },
    });

    if (!existingQueueEntry) {
      throw new Error('Queue entry not found');
    }

    // If changing patient, validate new patient
    if (data.patientId && data.patientId !== existingQueueEntry.patientId) {
      const patientCheck = await validatePatientForWorkflow(data.patientId);
      if (!patientCheck.valid) {
        throw new Error(patientCheck.error || 'Patient not suitable for queue entry');
      }
    }

    const updateData: Record<string, unknown> = {};
    const changedFields: string[] = [];

    if (data.patientId !== undefined && data.patientId !== existingQueueEntry.patientId) {
      updateData.patientId = data.patientId;
      changedFields.push('patientId');
    }
    if (data.appointmentId !== undefined && data.appointmentId !== existingQueueEntry.appointmentId) {
      updateData.appointmentId = data.appointmentId;
      changedFields.push('appointmentId');
    }
    if (data.priority !== undefined && data.priority !== existingQueueEntry.priority) {
      updateData.priority = data.priority;
      changedFields.push('priority');
    }

    if (Object.keys(updateData).length === 0) {
      return existingQueueEntry;
    }

    const queueEntry = await prisma.queueEntry.update({
      where: { id },
      data: updateData,
    });

    // Log audit event with changed field names only
    await logAuditEvent({
      action: 'queue_entry_updated',
      resourceType: 'queue_entry',
      resourceId: queueEntry.id,
      actorId,
      actorRole,
      metadata: {
        queueEntryId: queueEntry.id,
        patientId: queueEntry.patientId,
        changedFields,
      },
    }).catch((err) => {
      logger.warn('Failed to log queue entry update audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return queueEntry;
  } catch (error) {
    logger.error('Failed to update queue entry', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to update queue entry');
  }
}

/**
 * Update queue entry status
 */
export async function updateQueueEntryStatus(
  id: string,
  status: string,
  actorId: string,
  actorRole: string
) {
  try {
    const queueEntry = await prisma.queueEntry.findUnique({
      where: { id },
    });

    if (!queueEntry) {
      throw new Error('Queue entry not found');
    }

    // Validate state transition
    const transition = validateQueueTransition(queueEntry.status, status);
    if (!transition.valid) {
      throw new Error(transition.error || 'Invalid status transition');
    }

    const updateData: Record<string, unknown> = { status };

    // Set timestamps based on status
    if (status === 'IN_PROGRESS') {
      updateData.startedAt = new Date();
    }
    if (status === 'COMPLETED' || status === 'CANCELLED' || status === 'SKIPPED') {
      updateData.completedAt = new Date();
    }

    const updatedQueueEntry = await prisma.queueEntry.update({
      where: { id },
      data: updateData,
    });

    // Log audit event with status change only
    await logAuditEvent({
      action: 'queue_status_changed',
      resourceType: 'queue_entry',
      resourceId: queueEntry.id,
      actorId,
      actorRole,
      metadata: {
        queueEntryId: queueEntry.id,
        patientId: queueEntry.patientId,
        fromStatus: queueEntry.status,
        toStatus: status,
      },
    }).catch((err) => {
      logger.warn('Failed to log queue status change audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return updatedQueueEntry;
  } catch (error) {
    logger.error('Failed to update queue entry status', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to update queue entry status');
  }
}

/**
 * Update queue entry priority
 */
export async function updateQueueEntryPriority(
  id: string,
  priority: number,
  actorId: string,
  actorRole: string
) {
  try {
    const queueEntry = await prisma.queueEntry.findUnique({
      where: { id },
    });

    if (!queueEntry) {
      throw new Error('Queue entry not found');
    }

    const updatedQueueEntry = await prisma.queueEntry.update({
      where: { id },
      data: { priority },
    });

    // Log audit event
    await logAuditEvent({
      action: 'queue_priority_changed',
      resourceType: 'queue_entry',
      resourceId: queueEntry.id,
      actorId,
      actorRole,
      metadata: {
        queueEntryId: queueEntry.id,
        patientId: queueEntry.patientId,
        newPriority: priority,
      },
    }).catch((err) => {
      logger.warn('Failed to log queue priority change audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return updatedQueueEntry;
  } catch (error) {
    logger.error('Failed to update queue entry priority', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to update queue entry priority');
  }
}
