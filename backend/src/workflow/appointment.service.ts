import { prisma } from '../db/client';
import { logger } from '../utils/logger';
import { logAuditEvent } from '../services/auditService';
import { validateAppointmentTransition } from './workflowStateMachine';
import { validatePatientForWorkflow } from './patientWorkflowGuard';
import {
  CreateAppointmentInput,
  UpdateAppointmentInput,
  AppointmentListQuery,
} from './workflow.validation';

/**
 * Create appointment
 */
export async function createAppointment(
  data: CreateAppointmentInput,
  actorId: string,
  actorRole: string
) {
  try {
    // Validate patient
    const patientCheck = await validatePatientForWorkflow(data.patientId);
    if (!patientCheck.valid) {
      throw new Error(patientCheck.error || 'Patient not suitable for appointment');
    }

    const appointment = await prisma.appointment.create({
      data: {
        patientId: data.patientId,
        staffId: data.staffId,
        date: typeof data.date === 'string' ? new Date(data.date) : data.date,
        time: data.time,
        duration: data.duration,
        notes: data.notes,
      },
    });

    // Log audit event with appointmentId/patientId only
    await logAuditEvent({
      action: 'appointment_created',
      resourceType: 'appointment',
      resourceId: appointment.id,
      actorId,
      actorRole,
      metadata: {
        appointmentId: appointment.id,
        patientId: data.patientId,
      },
    }).catch((err) => {
      logger.warn('Failed to log appointment creation audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return appointment;
  } catch (error) {
    logger.error('Failed to create appointment', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to create appointment');
  }
}

/**
 * Get appointment by ID
 */
export async function getAppointmentById(id: string) {
  try {
    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            dateOfBirth: true,
          },
        },
      },
    });

    return appointment;
  } catch (error) {
    logger.error('Failed to get appointment by ID', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to get appointment');
  }
}

/**
 * List appointments with pagination and filters
 */
export async function listAppointments(query: AppointmentListQuery) {
  try {
    const { page, limit, patientId, staffId, status, dateFrom, dateTo, sortBy, sortOrder } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (patientId) where.patientId = patientId;
    if (staffId) where.staffId = staffId;
    if (status) where.status = status;

    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) (where.date as Record<string, unknown>).gte = new Date(dateFrom);
      if (dateTo) (where.date as Record<string, unknown>).lte = new Date(dateTo);
    }

    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({
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
      }),
      prisma.appointment.count({ where }),
    ]);

    return {
      appointments,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  } catch (error) {
    logger.error('Failed to list appointments', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to list appointments');
  }
}

/**
 * Update appointment
 */
export async function updateAppointment(
  id: string,
  data: UpdateAppointmentInput,
  actorId: string,
  actorRole: string
) {
  try {
    const existingAppointment = await prisma.appointment.findUnique({
      where: { id },
    });

    if (!existingAppointment) {
      throw new Error('Appointment not found');
    }

    // If changing patient, validate new patient
    if (data.patientId && data.patientId !== existingAppointment.patientId) {
      const patientCheck = await validatePatientForWorkflow(data.patientId);
      if (!patientCheck.valid) {
        throw new Error(patientCheck.error || 'Patient not suitable for appointment');
      }
    }

    const updateData: Record<string, unknown> = {};
    const changedFields: string[] = [];

    if (data.patientId !== undefined && data.patientId !== existingAppointment.patientId) {
      updateData.patientId = data.patientId;
      changedFields.push('patientId');
    }
    if (data.staffId !== undefined && data.staffId !== existingAppointment.staffId) {
      updateData.staffId = data.staffId;
      changedFields.push('staffId');
    }
    if (data.date !== undefined) {
      const newDate = typeof data.date === 'string' ? new Date(data.date) : data.date;
      if (newDate.getTime() !== existingAppointment.date.getTime()) {
        updateData.date = newDate;
        changedFields.push('date');
      }
    }
    if (data.time !== undefined && data.time !== existingAppointment.time) {
      updateData.time = data.time;
      changedFields.push('time');
    }
    if (data.duration !== undefined && data.duration !== existingAppointment.duration) {
      updateData.duration = data.duration;
      changedFields.push('duration');
    }
    if (data.notes !== undefined && data.notes !== existingAppointment.notes) {
      updateData.notes = data.notes;
      changedFields.push('notes');
    }

    if (Object.keys(updateData).length === 0) {
      return existingAppointment;
    }

    const appointment = await prisma.appointment.update({
      where: { id },
      data: updateData,
    });

    // Log audit event with changed field names only
    await logAuditEvent({
      action: 'appointment_updated',
      resourceType: 'appointment',
      resourceId: appointment.id,
      actorId,
      actorRole,
      metadata: {
        appointmentId: appointment.id,
        patientId: appointment.patientId,
        changedFields,
      },
    }).catch((err) => {
      logger.warn('Failed to log appointment update audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return appointment;
  } catch (error) {
    logger.error('Failed to update appointment', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to update appointment');
  }
}

/**
 * Update appointment status
 */
export async function updateAppointmentStatus(
  id: string,
  status: string,
  actorId: string,
  actorRole: string
) {
  try {
    const appointment = await prisma.appointment.findUnique({
      where: { id },
    });

    if (!appointment) {
      throw new Error('Appointment not found');
    }

    // Validate state transition
    const transition = validateAppointmentTransition(appointment.status, status);
    if (!transition.valid) {
      throw new Error(transition.error || 'Invalid status transition');
    }

    const updatedAppointment = await prisma.appointment.update({
      where: { id },
      data: { status: status as any },
    });

    // Log audit event with status change only
    await logAuditEvent({
      action: 'appointment_status_changed',
      resourceType: 'appointment',
      resourceId: appointment.id,
      actorId,
      actorRole,
      metadata: {
        appointmentId: appointment.id,
        patientId: appointment.patientId,
        fromStatus: appointment.status,
        toStatus: status,
      },
    }).catch((err) => {
      logger.warn('Failed to log appointment status change audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return updatedAppointment;
  } catch (error) {
    logger.error('Failed to update appointment status', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to update appointment status');
  }
}

/**
 * Cancel appointment
 */
export async function cancelAppointment(
  id: string,
  actorId: string,
  actorRole: string
) {
  try {
    const appointment = await prisma.appointment.findUnique({
      where: { id },
    });

    if (!appointment) {
      throw new Error('Appointment not found');
    }

    // Validate state transition
    const transition = validateAppointmentTransition(appointment.status, 'CANCELLED');
    if (!transition.valid) {
      throw new Error(transition.error || 'Cannot cancel appointment');
    }

    const updatedAppointment = await prisma.appointment.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    // Log audit event
    await logAuditEvent({
      action: 'appointment_cancelled',
      resourceType: 'appointment',
      resourceId: appointment.id,
      actorId,
      actorRole,
      metadata: {
        appointmentId: appointment.id,
        patientId: appointment.patientId,
      },
    }).catch((err) => {
      logger.warn('Failed to log appointment cancellation audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return updatedAppointment;
  } catch (error) {
    logger.error('Failed to cancel appointment', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to cancel appointment');
  }
}

/**
 * Mark appointment as no-show
 */
export async function markAppointmentNoShow(
  id: string,
  actorId: string,
  actorRole: string
) {
  try {
    const appointment = await prisma.appointment.findUnique({
      where: { id },
    });

    if (!appointment) {
      throw new Error('Appointment not found');
    }

    // Validate state transition
    const transition = validateAppointmentTransition(appointment.status, 'NO_SHOW');
    if (!transition.valid) {
      throw new Error(transition.error || 'Cannot mark as no-show');
    }

    const updatedAppointment = await prisma.appointment.update({
      where: { id },
      data: { status: 'NO_SHOW' },
    });

    // Log audit event
    await logAuditEvent({
      action: 'appointment_no_show',
      resourceType: 'appointment',
      resourceId: appointment.id,
      actorId,
      actorRole,
      metadata: {
        appointmentId: appointment.id,
        patientId: appointment.patientId,
      },
    }).catch((err) => {
      logger.warn('Failed to log appointment no-show audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return updatedAppointment;
  } catch (error) {
    logger.error('Failed to mark appointment as no-show', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to mark appointment as no-show');
  }
}
