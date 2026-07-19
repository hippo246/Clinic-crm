import { prisma } from '../db/client';
import { Prisma } from '@prisma/client';
import { logger } from '../utils/logger';
import { logAuditEvent } from '../services/auditService';
import { validatePatientForWorkflow } from '../workflow/patientWorkflowGuard';
import { checkOptOutStatus } from '../privacy/communicationPreference.service';
import {
  CreateCommunicationInput,
  UpdateCommunicationInput,
  ScheduleCommunicationInput,
  CommunicationTemplateInput,
  UpdateCommunicationTemplateInput,
  CreateCallLogInput,
  UpdateCallLogInput,
  CommunicationListQuery,
} from './operations.validation';

/**
 * Create communication
 */
export async function createCommunication(
  data: CreateCommunicationInput,
  actorId: string,
  actorRole: string,
  overrideOptOut: boolean = false
) {
  try {
    // Validate patient
    const patientCheck = await validatePatientForWorkflow(data.patientId);
    if (!patientCheck.valid) {
      throw new Error(patientCheck.error || 'Patient not suitable for communication');
    }

    // Check opt-out status
    const isOptedOut = await checkOptOutStatus(data.patientId, data.channel, data.purpose);
    if (isOptedOut && !overrideOptOut) {
      // Log blocked communication
      await logAuditEvent({
        action: 'communication_blocked_by_opt_out',
        resourceType: 'communication',
        resourceId: 'blocked',
        actorId,
        actorRole,
        metadata: {
          patientId: data.patientId,
          channel: data.channel,
          purpose: data.purpose,
        },
      }).catch((err) => {
        logger.warn('Failed to log blocked communication audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
      });

      throw new Error('Communication blocked by patient opt-out preference');
    }

    const communication = await prisma.communication.create({
      data: {
        patientId: data.patientId,
        channel: data.channel,
        subject: data.subject,
        message: data.message,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
        createdBy: actorId,
      },
    });

    // Log audit event with communicationId/patientId only
    await logAuditEvent({
      action: overrideOptOut ? 'communication_sent_with_override' : 'communication_created',
      resourceType: 'communication',
      resourceId: communication.id,
      actorId,
      actorRole,
      metadata: {
        communicationId: communication.id,
        patientId: data.patientId,
        channel: data.channel,
        purpose: data.purpose,
      },
    }).catch((err) => {
      logger.warn('Failed to log communication creation audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return communication;
  } catch (error) {
    logger.error('Failed to create communication', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to create communication');
  }
}

/**
 * Get communication by ID
 */
export async function getCommunicationById(id: string) {
  try {
    const communication = await prisma.communication.findUnique({
      where: { id },
    });

    return communication;
  } catch (error) {
    logger.error('Failed to get communication by ID', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to get communication');
  }
}

/**
 * List communications with pagination and filters
 */
export async function listCommunications(query: CommunicationListQuery) {
  try {
    const { page, limit, patientId, channel, status, sortBy, sortOrder } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (patientId) where.patientId = patientId;
    if (channel) where.channel = channel;
    if (status) where.status = status;

    const [communications, total] = await Promise.all([
      prisma.communication.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.communication.count({ where }),
    ]);

    return {
      communications,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  } catch (error) {
    logger.error('Failed to list communications', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to list communications');
  }
}

/**
 * Update communication
 */
export async function updateCommunication(
  id: string,
  data: UpdateCommunicationInput,
  actorId: string,
  actorRole: string
) {
  try {
    const existingCommunication = await prisma.communication.findUnique({
      where: { id },
    });

    if (!existingCommunication) {
      throw new Error('Communication not found');
    }

    const updateData: Record<string, unknown> = {};
    const changedFields: string[] = [];

    if (data.channel !== undefined && data.channel !== existingCommunication.channel) {
      updateData.channel = data.channel;
      changedFields.push('channel');
    }
    if (data.subject !== undefined && data.subject !== existingCommunication.subject) {
      updateData.subject = data.subject;
      changedFields.push('subject');
    }
    if (data.message !== undefined && data.message !== existingCommunication.message) {
      updateData.message = data.message;
      changedFields.push('message');
    }
    if (data.scheduledAt !== undefined) {
      updateData.scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : null;
      changedFields.push('scheduledAt');
    }
    if (data.status !== undefined && data.status !== existingCommunication.status) {
      updateData.status = data.status;
      changedFields.push('status');
    }

    if (Object.keys(updateData).length === 0) {
      return existingCommunication;
    }

    const communication = await prisma.communication.update({
      where: { id },
      data: updateData,
    });

    // Log audit event with changed field names only
    await logAuditEvent({
      action: 'communication_updated',
      resourceType: 'communication',
      resourceId: communication.id,
      actorId,
      actorRole,
      metadata: {
        communicationId: communication.id,
        patientId: communication.patientId,
        changedFields,
      },
    }).catch((err) => {
      logger.warn('Failed to log communication update audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return communication;
  } catch (error) {
    logger.error('Failed to update communication', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to update communication');
  }
}

/**
 * Delete communication
 */
export async function deleteCommunication(
  id: string,
  actorId: string,
  actorRole: string
) {
  try {
    const communication = await prisma.communication.findUnique({
      where: { id },
    });

    if (!communication) {
      throw new Error('Communication not found');
    }

    await prisma.communication.delete({
      where: { id },
    });

    // Log audit event
    await logAuditEvent({
      action: 'communication_deleted',
      resourceType: 'communication',
      resourceId: communication.id,
      actorId,
      actorRole,
      metadata: {
        communicationId: communication.id,
        patientId: communication.patientId,
      },
    }).catch((err) => {
      logger.warn('Failed to log communication deletion audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return { success: true };
  } catch (error) {
    logger.error('Failed to delete communication', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to delete communication');
  }
}

/**
 * Schedule communication
 */
export async function scheduleCommunication(
  data: ScheduleCommunicationInput,
  actorId: string,
  actorRole: string,
  overrideOptOut: boolean = false
) {
  try {
    // Validate patient
    const patientCheck = await validatePatientForWorkflow(data.patientId);
    if (!patientCheck.valid) {
      throw new Error(patientCheck.error || 'Patient not suitable for communication');
    }

    // Check opt-out status
    const isOptedOut = await checkOptOutStatus(data.patientId, data.channel, data.purpose);
    if (isOptedOut && !overrideOptOut) {
      // Log blocked communication
      await logAuditEvent({
        action: 'communication_blocked_by_opt_out',
        resourceType: 'scheduled_communication',
        resourceId: 'blocked',
        actorId,
        actorRole,
        metadata: {
          patientId: data.patientId,
          channel: data.channel,
          purpose: data.purpose,
        },
      }).catch((err) => {
        logger.warn('Failed to log blocked communication audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
      });

      throw new Error('Communication blocked by patient opt-out preference');
    }

    const scheduled = await prisma.scheduledCommunication.create({
      data: {
        patientId: data.patientId,
        templateId: data.templateId,
        channel: data.channel,
        scheduledAt: new Date(data.scheduledAt),
        metadata: data.metadata as Prisma.InputJsonValue,
      },
    });

    // Log audit event
    await logAuditEvent({
      action: overrideOptOut ? 'communication_scheduled_with_override' : 'communication_scheduled',
      resourceType: 'scheduled_communication',
      resourceId: scheduled.id,
      actorId,
      actorRole,
      metadata: {
        scheduledCommunicationId: scheduled.id,
        patientId: data.patientId,
        channel: data.channel,
        purpose: data.purpose,
      },
    }).catch((err) => {
      logger.warn('Failed to log scheduled communication audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return scheduled;
  } catch (error) {
    logger.error('Failed to schedule communication', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to schedule communication');
  }
}

/**
 * List scheduled communications
 */
export async function listScheduledCommunications(patientId?: string) {
  try {
    const where: Record<string, unknown> = {};

    if (patientId) where.patientId = patientId;

    const scheduled = await prisma.scheduledCommunication.findMany({
      where,
      orderBy: { scheduledAt: 'asc' },
    });

    return scheduled;
  } catch (error) {
    logger.error('Failed to list scheduled communications', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to list scheduled communications');
  }
}

/**
 * Update scheduled communication
 */
export async function updateScheduledCommunication(
  id: string,
  data: Partial<ScheduleCommunicationInput>,
  actorId: string,
  actorRole: string
) {
  try {
    const existing = await prisma.scheduledCommunication.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error('Scheduled communication not found');
    }

    const updateData: Record<string, unknown> = {};

    if (data.scheduledAt !== undefined) {
      updateData.scheduledAt = new Date(data.scheduledAt);
    }
    if (data.status !== undefined) {
      updateData.status = data.status;
    }

    const scheduled = await prisma.scheduledCommunication.update({
      where: { id },
      data: updateData,
    });

    // Log audit event
    await logAuditEvent({
      action: 'scheduled_communication_updated',
      resourceType: 'scheduled_communication',
      resourceId: id,
      actorId,
      actorRole,
      metadata: {
        scheduledCommunicationId: id,
      },
    }).catch((err) => {
      logger.warn('Failed to log scheduled communication update audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return scheduled;
  } catch (error) {
    logger.error('Failed to update scheduled communication', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to update scheduled communication');
  }
}

/**
 * Cancel scheduled communication
 */
export async function cancelScheduledCommunication(
  id: string,
  actorId: string,
  actorRole: string
) {
  try {
    const scheduled = await prisma.scheduledCommunication.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    // Log audit event
    await logAuditEvent({
      action: 'scheduled_communication_cancelled',
      resourceType: 'scheduled_communication',
      resourceId: id,
      actorId,
      actorRole,
      metadata: {
        scheduledCommunicationId: id,
      },
    }).catch((err) => {
      logger.warn('Failed to log scheduled communication cancellation audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return scheduled;
  } catch (error) {
    logger.error('Failed to cancel scheduled communication', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to cancel scheduled communication');
  }
}

/**
 * Create communication template
 */
export async function createCommunicationTemplate(
  data: CommunicationTemplateInput,
  actorId: string,
  actorRole: string
) {
  try {
    const template = await prisma.communicationTemplate.create({
      data: {
        name: data.name,
        channel: data.channel,
        subject: data.subject,
        body: data.body,
        isActive: data.isActive,
      },
    });

    // Log audit event with templateId only
    await logAuditEvent({
      action: 'communication_template_created',
      resourceType: 'communication_template',
      resourceId: template.id,
      actorId,
      actorRole,
      metadata: {
        templateId: template.id,
      },
    }).catch((err) => {
      logger.warn('Failed to log communication template creation audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return template;
  } catch (error) {
    logger.error('Failed to create communication template', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to create communication template');
  }
}

/**
 * Get communication template by ID
 */
export async function getCommunicationTemplateById(id: string) {
  try {
    const template = await prisma.communicationTemplate.findUnique({
      where: { id },
    });

    return template;
  } catch (error) {
    logger.error('Failed to get communication template by ID', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to get communication template');
  }
}

/**
 * List communication templates
 */
export async function listCommunicationTemplates() {
  try {
    const templates = await prisma.communicationTemplate.findMany({
      orderBy: { name: 'asc' },
    });

    return templates;
  } catch (error) {
    logger.error('Failed to list communication templates', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to list communication templates');
  }
}

/**
 * Update communication template
 */
export async function updateCommunicationTemplate(
  id: string,
  data: UpdateCommunicationTemplateInput,
  actorId: string,
  actorRole: string
) {
  try {
    const existing = await prisma.communicationTemplate.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error('Communication template not found');
    }

    const updateData: Record<string, unknown> = {};
    const changedFields: string[] = [];

    if (data.name !== undefined && data.name !== existing.name) {
      updateData.name = data.name;
      changedFields.push('name');
    }
    if (data.channel !== undefined && data.channel !== existing.channel) {
      updateData.channel = data.channel;
      changedFields.push('channel');
    }
    if (data.subject !== undefined && data.subject !== existing.subject) {
      updateData.subject = data.subject;
      changedFields.push('subject');
    }
    if (data.body !== undefined && data.body !== existing.body) {
      updateData.body = data.body;
      changedFields.push('body');
    }
    if (data.isActive !== undefined && data.isActive !== existing.isActive) {
      updateData.isActive = data.isActive;
      changedFields.push('isActive');
    }

    if (Object.keys(updateData).length === 0) {
      return existing;
    }

    const template = await prisma.communicationTemplate.update({
      where: { id },
      data: updateData,
    });

    // Log audit event
    await logAuditEvent({
      action: 'communication_template_updated',
      resourceType: 'communication_template',
      resourceId: template.id,
      actorId,
      actorRole,
      metadata: {
        templateId: template.id,
        changedFields,
      },
    }).catch((err) => {
      logger.warn('Failed to log communication template update audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return template;
  } catch (error) {
    logger.error('Failed to update communication template', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to update communication template');
  }
}

/**
 * Delete communication template
 */
export async function deleteCommunicationTemplate(
  id: string,
  actorId: string,
  actorRole: string
) {
  try {
    await prisma.communicationTemplate.delete({
      where: { id },
    });

    // Log audit event
    await logAuditEvent({
      action: 'communication_template_deleted',
      resourceType: 'communication_template',
      resourceId: id,
      actorId,
      actorRole,
      metadata: {
        templateId: id,
      },
    }).catch((err) => {
      logger.warn('Failed to log communication template deletion audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return { success: true };
  } catch (error) {
    logger.error('Failed to delete communication template', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to delete communication template');
  }
}

/**
 * Create call log
 */
export async function createCallLog(
  data: CreateCallLogInput,
  actorId: string,
  actorRole: string
) {
  try {
    // Validate patient if provided
    if (data.patientId) {
      const patientCheck = await validatePatientForWorkflow(data.patientId);
      if (!patientCheck.valid) {
        throw new Error(patientCheck.error || 'Patient not suitable for call log');
      }
    }

    const callLog = await prisma.callLog.create({
      data: {
        patientId: data.patientId,
        phoneNumber: data.phoneNumber,
        direction: data.direction,
        duration: data.duration,
        notes: data.notes,
        calledBy: data.calledBy || actorId,
      },
    });

    // Log audit event with callLogId only
    await logAuditEvent({
      action: 'call_log_created',
      resourceType: 'call_log',
      resourceId: callLog.id,
      actorId,
      actorRole,
      metadata: {
        callLogId: callLog.id,
      },
    }).catch((err) => {
      logger.warn('Failed to log call log creation audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return callLog;
  } catch (error) {
    logger.error('Failed to create call log', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to create call log');
  }
}

/**
 * Get call log by ID
 */
export async function getCallLogById(id: string) {
  try {
    const callLog = await prisma.callLog.findUnique({
      where: { id },
    });

    return callLog;
  } catch (error) {
    logger.error('Failed to get call log by ID', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to get call log');
  }
}

/**
 * List call logs
 */
export async function listCallLogs(patientId?: string) {
  try {
    const where: Record<string, unknown> = {};

    if (patientId) where.patientId = patientId;

    const callLogs = await prisma.callLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return callLogs;
  } catch (error) {
    logger.error('Failed to list call logs', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to list call logs');
  }
}

/**
 * Update call log
 */
export async function updateCallLog(
  id: string,
  data: UpdateCallLogInput,
  actorId: string,
  actorRole: string
) {
  try {
    const existing = await prisma.callLog.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error('Call log not found');
    }

    const updateData: Record<string, unknown> = {};
    const changedFields: string[] = [];

    if (data.phoneNumber !== undefined && data.phoneNumber !== existing.phoneNumber) {
      updateData.phoneNumber = data.phoneNumber;
      changedFields.push('phoneNumber');
    }
    if (data.direction !== undefined && data.direction !== existing.direction) {
      updateData.direction = data.direction;
      changedFields.push('direction');
    }
    if (data.duration !== undefined && data.duration !== existing.duration) {
      updateData.duration = data.duration;
      changedFields.push('duration');
    }
    if (data.notes !== undefined && data.notes !== existing.notes) {
      updateData.notes = data.notes;
      changedFields.push('notes');
    }
    if (data.calledBy !== undefined && data.calledBy !== existing.calledBy) {
      updateData.calledBy = data.calledBy;
      changedFields.push('calledBy');
    }

    if (Object.keys(updateData).length === 0) {
      return existing;
    }

    const callLog = await prisma.callLog.update({
      where: { id },
      data: updateData,
    });

    // Log audit event
    await logAuditEvent({
      action: 'call_log_updated',
      resourceType: 'call_log',
      resourceId: callLog.id,
      actorId,
      actorRole,
      metadata: {
        callLogId: callLog.id,
        changedFields,
      },
    }).catch((err) => {
      logger.warn('Failed to log call log update audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return callLog;
  } catch (error) {
    logger.error('Failed to update call log', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to update call log');
  }
}
