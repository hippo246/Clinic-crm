import { prisma } from '../db/client';
import { logger } from '../utils/logger';
import { logAdminOperation } from '../services/adminAuditService';
import { logAuditEvent } from '../services/auditService';
import { validatePatientForWorkflow } from '../workflow/patientWorkflowGuard';
import {
  createConsentRecordSchema,
  updateConsentRecordSchema,
  revokeConsentSchema,
  consentListQuerySchema,
} from './privacy.validation';
import type { z } from 'zod';

type CreateConsentRecordInput = z.infer<typeof createConsentRecordSchema>;
type UpdateConsentRecordInput = z.infer<typeof updateConsentRecordSchema>;
type RevokeConsentInput = z.infer<typeof revokeConsentSchema>;
type ConsentListQuery = z.infer<typeof consentListQuerySchema>;

/**
 * Create consent record
 */
export async function createConsentRecord(
  data: CreateConsentRecordInput,
  actorId: string,
  actorRole: string
) {
  try {
    // Validate patient exists and is active
    const patientValidation = await validatePatientForWorkflow(data.patientId);
    if (!patientValidation.valid) {
      throw new Error('Patient not suitable for consent record');
    }

    const consent = await prisma.consentRecord.create({
      data: {
        patientId: data.patientId,
        consentType: data.consentType,
        status: data.status || 'ACTIVE',
        signedAt: data.signedAt || new Date(),
        expiresAt: data.expiresAt,
        metadata: data.metadata as any,
      },
    });

    // Log audit event
    await logAuditEvent({
      action: 'consent_created',
      resourceType: 'consent_record',
      resourceId: consent.id,
      actorId,
      actorRole,
      metadata: {
        consentId: consent.id,
        patientId: data.patientId,
        consentType: data.consentType,
        status: consent.status,
      },
    }).catch((err) => {
      logger.warn('Failed to log consent creation audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return consent;
  } catch (error) {
    logger.error('Failed to create consent record', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to create consent record');
  }
}

/**
 * Get consent record by ID
 */
export async function getConsentRecordById(id: string) {
  try {
    const consent = await prisma.consentRecord.findUnique({
      where: { id },
    });

    return consent;
  } catch (error) {
    logger.error('Failed to get consent record by ID', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to get consent record');
  }
}

/**
 * List consent records with pagination and filters
 */
export async function listConsentRecords(query: ConsentListQuery) {
  try {
    const { page, limit, patientId, consentType, status, sortBy, sortOrder } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (patientId) where.patientId = patientId;
    if (consentType) where.consentType = consentType;
    if (status) where.status = status;

    const [consents, total] = await Promise.all([
      prisma.consentRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.consentRecord.count({ where }),
    ]);

    return {
      consents,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  } catch (error) {
    logger.error('Failed to list consent records', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to list consent records');
  }
}

/**
 * Update consent record
 */
export async function updateConsentRecord(
  id: string,
  data: UpdateConsentRecordInput,
  actorId: string,
  actorRole: string
) {
  try {
    const existing = await prisma.consentRecord.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error('Consent record not found');
    }

    const updateData: Record<string, unknown> = {};
    const changedFields: string[] = [];

    if (data.consentType !== undefined && data.consentType !== existing.consentType) {
      updateData.consentType = data.consentType;
      changedFields.push('consentType');
    }
    if (data.status !== undefined && data.status !== existing.status) {
      updateData.status = data.status;
      changedFields.push('status');
    }
    if (data.expiresAt !== undefined && data.expiresAt !== existing.expiresAt) {
      updateData.expiresAt = data.expiresAt;
      changedFields.push('expiresAt');
    }
    if (data.metadata !== undefined) {
      updateData.metadata = data.metadata as any;
      changedFields.push('metadata');
    }

    if (Object.keys(updateData).length === 0) {
      return existing;
    }

    const consent = await prisma.consentRecord.update({
      where: { id },
      data: updateData,
    });

    // Log admin audit event
    await logAdminOperation({
      action: 'consent_updated',
      module: 'privacy',
      resourceType: 'consent_record',
      resourceId: consent.id,
      actor: actorId,
      role: actorRole,
      metadata: {
        consentId: consent.id,
        patientId: existing.patientId,
        changedFields,
      },
    }).catch((err) => {
      logger.warn('Failed to log consent update admin audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return consent;
  } catch (error) {
    logger.error('Failed to update consent record', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to update consent record');
  }
}

/**
 * Revoke consent record
 */
export async function revokeConsentRecord(
  id: string,
  _data: RevokeConsentInput,
  actorId: string,
  actorRole: string
) {
  try {
    const existing = await prisma.consentRecord.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error('Consent record not found');
    }

    const consent = await prisma.consentRecord.update({
      where: { id },
      data: {
        status: 'REVOKED',
      },
    });

    // Log admin audit event
    await logAdminOperation({
      action: 'consent_revoked',
      module: 'privacy',
      resourceType: 'consent_record',
      resourceId: consent.id,
      actor: actorId,
      role: actorRole,
      metadata: {
        consentId: consent.id,
        patientId: existing.patientId,
      },
    }).catch((err) => {
      logger.warn('Failed to log consent revocation admin audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return consent;
  } catch (error) {
    logger.error('Failed to revoke consent record', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to revoke consent record');
  }
}
