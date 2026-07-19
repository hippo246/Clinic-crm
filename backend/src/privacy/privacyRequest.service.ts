import { prisma } from '../db/client';
import { logger } from '../utils/logger';
import { logAdminOperation } from '../services/adminAuditService';
import { logAuditEvent } from '../services/auditService';
import { validatePatientForWorkflow } from '../workflow/patientWorkflowGuard';
import {
  createPrivacyRequestSchema,
  updatePrivacyRequestSchema,
  privacyRequestListQuerySchema,
  privacyRequestDecisionSchema,
  privacyRequestCompletionSchema,
} from './privacy.validation';
import type { z } from 'zod';

type CreatePrivacyRequestInput = z.infer<typeof createPrivacyRequestSchema>;
type UpdatePrivacyRequestInput = z.infer<typeof updatePrivacyRequestSchema>;
type PrivacyRequestListQuery = z.infer<typeof privacyRequestListQuerySchema>;
type PrivacyRequestDecisionInput = z.infer<typeof privacyRequestDecisionSchema>;
type PrivacyRequestCompletionInput = z.infer<typeof privacyRequestCompletionSchema>;

/**
 * Create privacy request
 */
export async function createPrivacyRequest(
  data: CreatePrivacyRequestInput,
  actorId: string,
  actorRole: string
) {
  try {
    // Validate patient exists and is active
    const patientValidation = await validatePatientForWorkflow(data.patientId);
    if (!patientValidation.valid) {
      throw new Error('Patient not suitable for privacy request');
    }

    const request = await prisma.privacyRequest.create({
      data: {
        patientId: data.patientId,
        requestType: data.requestType,
        metadata: data.metadata as any,
      },
    });

    // Log audit event
    await logAuditEvent({
      action: 'privacy_request_created',
      resourceType: 'privacy_request',
      resourceId: request.id,
      actorId,
      actorRole,
      metadata: {
        privacyRequestId: request.id,
        patientId: data.patientId,
        requestType: data.requestType,
      },
    }).catch((err) => {
      logger.warn('Failed to log privacy request creation audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return request;
  } catch (error) {
    logger.error('Failed to create privacy request', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to create privacy request');
  }
}

/**
 * Get privacy request by ID
 */
export async function getPrivacyRequestById(id: string) {
  try {
    const request = await prisma.privacyRequest.findUnique({
      where: { id },
      include: {
        events: true,
      },
    });

    return request;
  } catch (error) {
    logger.error('Failed to get privacy request by ID', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to get privacy request');
  }
}

/**
 * List privacy requests with pagination and filters
 */
export async function listPrivacyRequests(query: PrivacyRequestListQuery) {
  try {
    const { page, limit, patientId, requestType, status, sortBy, sortOrder } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (patientId) where.patientId = patientId;
    if (requestType) where.requestType = requestType;
    if (status) where.status = status;

    const [requests, total] = await Promise.all([
      prisma.privacyRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          events: true,
        },
      }),
      prisma.privacyRequest.count({ where }),
    ]);

    return {
      requests,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  } catch (error) {
    logger.error('Failed to list privacy requests', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to list privacy requests');
  }
}

/**
 * Update privacy request
 */
export async function updatePrivacyRequest(
  id: string,
  data: UpdatePrivacyRequestInput,
  actorId: string,
  actorRole: string
) {
  try {
    const existing = await prisma.privacyRequest.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error('Privacy request not found');
    }

    const updateData: Record<string, unknown> = {};
    if (data.status !== undefined) updateData.status = data.status;
    if (data.metadata !== undefined) updateData.metadata = data.metadata as any;

    const request = await prisma.privacyRequest.update({
      where: { id },
      data: updateData,
    });

    // Log admin audit event
    await logAdminOperation({
      action: 'privacy_request_updated',
      module: 'privacy',
      resourceType: 'privacy_request',
      resourceId: request.id,
      actor: actorId,
      role: actorRole,
      metadata: {
        privacyRequestId: request.id,
        patientId: existing.patientId,
      },
    }).catch((err) => {
      logger.warn('Failed to log privacy request update admin audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return request;
  } catch (error) {
    logger.error('Failed to update privacy request', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to update privacy request');
  }
}

/**
 * Approve privacy request
 */
export async function approvePrivacyRequest(
  id: string,
  data: PrivacyRequestDecisionInput,
  actorId: string,
  actorRole: string
) {
  try {
    const existing = await prisma.privacyRequest.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error('Privacy request not found');
    }

    const request = await prisma.privacyRequest.update({
      where: { id },
      data: {
        status: 'IN_PROGRESS',
      },
    });

    // Create event
    await prisma.privacyRequestEvent.create({
      data: {
        requestId: id,
        eventType: 'APPROVED',
        description: data.reason || 'Request approved',
      },
    });

    // Log admin audit event
    await logAdminOperation({
      action: 'privacy_request_approved',
      module: 'privacy',
      resourceType: 'privacy_request',
      resourceId: request.id,
      actor: actorId,
      role: actorRole,
      metadata: {
        privacyRequestId: request.id,
        patientId: existing.patientId,
      },
    }).catch((err) => {
      logger.warn('Failed to log privacy request approval admin audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return request;
  } catch (error) {
    logger.error('Failed to approve privacy request', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to approve privacy request');
  }
}

/**
 * Reject privacy request
 */
export async function rejectPrivacyRequest(
  id: string,
  data: PrivacyRequestDecisionInput,
  actorId: string,
  actorRole: string
) {
  try {
    const existing = await prisma.privacyRequest.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error('Privacy request not found');
    }

    const request = await prisma.privacyRequest.update({
      where: { id },
      data: {
        status: 'DENIED',
      },
    });

    // Create event
    await prisma.privacyRequestEvent.create({
      data: {
        requestId: id,
        eventType: 'REJECTED',
        description: data.reason || 'Request rejected',
      },
    });

    // Log admin audit event
    await logAdminOperation({
      action: 'privacy_request_rejected',
      module: 'privacy',
      resourceType: 'privacy_request',
      resourceId: request.id,
      actor: actorId,
      role: actorRole,
      metadata: {
        privacyRequestId: request.id,
        patientId: existing.patientId,
      },
    }).catch((err) => {
      logger.warn('Failed to log privacy request rejection admin audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return request;
  } catch (error) {
    logger.error('Failed to reject privacy request', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to reject privacy request');
  }
}

/**
 * Complete privacy request
 */
export async function completePrivacyRequest(
  id: string,
  data: PrivacyRequestCompletionInput,
  actorId: string,
  actorRole: string
) {
  try {
    const existing = await prisma.privacyRequest.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error('Privacy request not found');
    }

    const request = await prisma.privacyRequest.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    // Create event
    await prisma.privacyRequestEvent.create({
      data: {
        requestId: id,
        eventType: 'COMPLETED',
        description: data.completionDetails || 'Request completed',
      },
    });

    // Log admin audit event
    await logAdminOperation({
      action: 'privacy_request_completed',
      module: 'privacy',
      resourceType: 'privacy_request',
      resourceId: request.id,
      actor: actorId,
      role: actorRole,
      metadata: {
        privacyRequestId: request.id,
        patientId: existing.patientId,
      },
    }).catch((err) => {
      logger.warn('Failed to log privacy request completion admin audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return request;
  } catch (error) {
    logger.error('Failed to complete privacy request', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to complete privacy request');
  }
}

/**
 * Cancel privacy request
 */
export async function cancelPrivacyRequest(
  id: string,
  actorId: string,
  actorRole: string
) {
  try {
    const existing = await prisma.privacyRequest.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error('Privacy request not found');
    }

    const request = await prisma.privacyRequest.update({
      where: { id },
      data: {
        status: 'EXPIRED',
      },
    });

    // Create event
    await prisma.privacyRequestEvent.create({
      data: {
        requestId: id,
        eventType: 'CANCELLED',
        description: 'Request cancelled',
      },
    });

    // Log admin audit event
    await logAdminOperation({
      action: 'privacy_request_cancelled',
      module: 'privacy',
      resourceType: 'privacy_request',
      resourceId: request.id,
      actor: actorId,
      role: actorRole,
      metadata: {
        privacyRequestId: request.id,
        patientId: existing.patientId,
      },
    }).catch((err) => {
      logger.warn('Failed to log privacy request cancellation admin audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return request;
  } catch (error) {
    logger.error('Failed to cancel privacy request', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to cancel privacy request');
  }
}
