import { prisma } from '../db/client';
import { logger } from '../utils/logger';
import { logAdminOperation } from '../services/adminAuditService';
import { logDestructiveAction } from '../services/destructiveActionService';
import {
  createRetentionPolicySchema,
  updateRetentionPolicySchema,
  retentionPolicyListQuerySchema,
  retentionPreviewQuerySchema,
  retentionRunSchema,
} from './privacy.validation';
import type { z } from 'zod';

type CreateRetentionPolicyInput = z.infer<typeof createRetentionPolicySchema>;
type UpdateRetentionPolicyInput = z.infer<typeof updateRetentionPolicySchema>;
type RetentionPolicyListQuery = z.infer<typeof retentionPolicyListQuerySchema>;
type RetentionPreviewQuery = z.infer<typeof retentionPreviewQuerySchema>;
type RetentionRunInput = z.infer<typeof retentionRunSchema>;

/**
 * Create retention policy
 */
export async function createRetentionPolicy(
  data: CreateRetentionPolicyInput,
  actorId: string,
  actorRole: string
) {
  try {
    const policy = await prisma.retentionPolicy.create({
      data: {
        policyName: data.policyName,
        auditLogsRetentionDays: data.auditLogsRetentionDays || 90,
        securityEventsRetentionDays: data.securityEventsRetentionDays || 180,
        workflowActivityRetentionDays: data.workflowActivityRetentionDays || 365,
        uiActivityRetentionDays: data.uiActivityRetentionDays || 90,
        backupArchivesRetentionDays: data.backupArchivesRetentionDays || 365,
      },
    });

    // Log admin audit event
    await logAdminOperation({
      action: 'retention_policy_created',
      module: 'retention',
      resourceType: 'retention_policy',
      resourceId: policy.id,
      actor: actorId,
      role: actorRole,
      metadata: {
        policyId: policy.id,
        policyName: data.policyName,
      },
    }).catch((err) => {
      logger.warn('Failed to log retention policy creation admin audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return policy;
  } catch (error) {
    logger.error('Failed to create retention policy', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to create retention policy');
  }
}

/**
 * Get retention policy by ID
 */
export async function getRetentionPolicyById(id: string) {
  try {
    const policy = await prisma.retentionPolicy.findUnique({
      where: { id },
    });

    return policy;
  } catch (error) {
    logger.error('Failed to get retention policy by ID', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to get retention policy');
  }
}

/**
 * List retention policies with pagination and filters
 */
export async function listRetentionPolicies(query: RetentionPolicyListQuery) {
  try {
    const { page, limit, isActive, sortBy, sortOrder } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (isActive !== undefined) where.isActive = isActive;

    const [policies, total] = await Promise.all([
      prisma.retentionPolicy.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.retentionPolicy.count({ where }),
    ]);

    return {
      policies,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  } catch (error) {
    logger.error('Failed to list retention policies', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to list retention policies');
  }
}

/**
 * Update retention policy
 */
export async function updateRetentionPolicy(
  id: string,
  data: UpdateRetentionPolicyInput,
  actorId: string,
  actorRole: string
) {
  try {
    const existing = await prisma.retentionPolicy.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error('Retention policy not found');
    }

    const updateData: Record<string, unknown> = {};
    const changedFields: string[] = [];

    if (data.policyName !== undefined && data.policyName !== existing.policyName) {
      updateData.policyName = data.policyName;
      changedFields.push('policyName');
    }
    if (data.auditLogsRetentionDays !== undefined && data.auditLogsRetentionDays !== existing.auditLogsRetentionDays) {
      updateData.auditLogsRetentionDays = data.auditLogsRetentionDays;
      changedFields.push('auditLogsRetentionDays');
    }
    if (data.securityEventsRetentionDays !== undefined && data.securityEventsRetentionDays !== existing.securityEventsRetentionDays) {
      updateData.securityEventsRetentionDays = data.securityEventsRetentionDays;
      changedFields.push('securityEventsRetentionDays');
    }
    if (data.workflowActivityRetentionDays !== undefined && data.workflowActivityRetentionDays !== existing.workflowActivityRetentionDays) {
      updateData.workflowActivityRetentionDays = data.workflowActivityRetentionDays;
      changedFields.push('workflowActivityRetentionDays');
    }
    if (data.uiActivityRetentionDays !== undefined && data.uiActivityRetentionDays !== existing.uiActivityRetentionDays) {
      updateData.uiActivityRetentionDays = data.uiActivityRetentionDays;
      changedFields.push('uiActivityRetentionDays');
    }
    if (data.backupArchivesRetentionDays !== undefined && data.backupArchivesRetentionDays !== existing.backupArchivesRetentionDays) {
      updateData.backupArchivesRetentionDays = data.backupArchivesRetentionDays;
      changedFields.push('backupArchivesRetentionDays');
    }

    if (Object.keys(updateData).length === 0) {
      return existing;
    }

    const policy = await prisma.retentionPolicy.update({
      where: { id },
      data: updateData,
    });

    // Log admin audit event
    await logAdminOperation({
      action: 'retention_policy_updated',
      module: 'retention',
      resourceType: 'retention_policy',
      resourceId: policy.id,
      actor: actorId,
      role: actorRole,
      metadata: {
        policyId: policy.id,
        changedFields,
      },
    }).catch((err) => {
      logger.warn('Failed to log retention policy update admin audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return policy;
  } catch (error) {
    logger.error('Failed to update retention policy', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to update retention policy');
  }
}

/**
 * Activate retention policy
 */
export async function activateRetentionPolicy(
  id: string,
  actorId: string,
  actorRole: string
) {
  try {
    const policy = await prisma.retentionPolicy.update({
      where: { id },
      data: { isActive: true },
    });

    // Log admin audit event
    await logAdminOperation({
      action: 'retention_policy_activated',
      module: 'retention',
      resourceType: 'retention_policy',
      resourceId: policy.id,
      actor: actorId,
      role: actorRole,
      metadata: {
        policyId: policy.id,
      },
    }).catch((err) => {
      logger.warn('Failed to log retention policy activation admin audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return policy;
  } catch (error) {
    logger.error('Failed to activate retention policy', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to activate retention policy');
  }
}

/**
 * Deactivate retention policy
 */
export async function deactivateRetentionPolicy(
  id: string,
  actorId: string,
  actorRole: string
) {
  try {
    const policy = await prisma.retentionPolicy.update({
      where: { id },
      data: { isActive: false },
    });

    // Log admin audit event
    await logAdminOperation({
      action: 'retention_policy_deactivated',
      module: 'retention',
      resourceType: 'retention_policy',
      resourceId: policy.id,
      actor: actorId,
      role: actorRole,
      metadata: {
        policyId: policy.id,
      },
    }).catch((err) => {
      logger.warn('Failed to log retention policy deactivation admin audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return policy;
  } catch (error) {
    logger.error('Failed to deactivate retention policy', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to deactivate retention policy');
  }
}

/**
 * Preview retention cleanup
 */
export async function previewRetentionCleanup(query: RetentionPreviewQuery) {
  try {
    const policy = await prisma.retentionPolicy.findUnique({
      where: { id: query.policyId },
    });

    if (!policy) {
      throw new Error('Retention policy not found');
    }

    // Calculate cutoff date based on policy-specific retention days
    const now = new Date();
    const auditLogsCutoffDate = policy.auditLogsRetentionDays 
      ? new Date(now.getTime() - (policy.auditLogsRetentionDays * 24 * 60 * 60 * 1000))
      : null;
    const securityEventsCutoffDate = policy.securityEventsRetentionDays
      ? new Date(now.getTime() - (policy.securityEventsRetentionDays * 24 * 60 * 60 * 1000))
      : null;
    const adminAuditLogsCutoffDate = policy.auditLogsRetentionDays
      ? new Date(now.getTime() - (policy.auditLogsRetentionDays * 24 * 60 * 60 * 1000))
      : null;

    // Count only - no PHI/PII rows returned
    let auditLogsCount = 0;
    let securityEventsCount = 0;
    let adminAuditLogsCount = 0;

    // Only count if policy has retention days set and we're not in append-only mode
    // For now, make audit/admin/security logs preview-only to avoid violating append-only audit expectations
    // These will be counted but not deleted until hash-chain and DB immutability design is finalized
    if (auditLogsCutoffDate) {
      auditLogsCount = await prisma.auditLog.count({
        where: {
          createdAt: { lt: auditLogsCutoffDate },
        },
      });
    }

    if (securityEventsCutoffDate) {
      securityEventsCount = await prisma.securityEvent.count({
        where: {
          createdAt: { lt: securityEventsCutoffDate },
        },
      });
    }

    if (adminAuditLogsCutoffDate) {
      adminAuditLogsCount = await prisma.adminAuditLog.count({
        where: {
          createdAt: { lt: adminAuditLogsCutoffDate },
        },
      });
    }

    const preview = {
      policyId: policy.id,
      policyName: policy.policyName,
      dryRun: query.dryRun,
      counts: {
        auditLogs: auditLogsCount,
        securityEvents: securityEventsCount,
        adminAuditLogs: adminAuditLogsCount,
      },
      totalRecords: auditLogsCount + securityEventsCount + adminAuditLogsCount,
      note: 'Audit/admin/security logs are preview-only pending hash-chain and DB immutability design',
    };

    // Log admin audit event with counts only
    await logAdminOperation({
      action: 'retention_preview_generated',
      module: 'retention',
      resourceType: 'retention_preview',
      resourceId: policy.id,
      actor: 'system',
      role: 'system',
      metadata: {
        policyId: policy.id,
        totalRecords: preview.totalRecords,
      },
    }).catch((err) => {
      logger.warn('Failed to log retention preview admin audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return preview;
  } catch (error) {
    logger.error('Failed to preview retention cleanup', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to preview retention cleanup');
  }
}

/**
 * Run retention cleanup
 */
export async function runRetentionCleanup(
  data: RetentionRunInput,
  actorId: string,
  actorRole: string
) {
  try {
    const policy = await prisma.retentionPolicy.findUnique({
      where: { id: data.policyId },
    });

    if (!policy) {
      throw new Error('Retention policy not found');
    }

    // Create retention job
    const job = await prisma.retentionCleanupJob.create({
      data: {
        policyId: data.policyId,
        status: 'PENDING',
      },
    });

    // Log admin audit event
    await logAdminOperation({
      action: 'retention_run_started',
      module: 'retention',
      resourceType: 'retention_run',
      resourceId: job.id,
      actor: actorId,
      role: actorRole,
      metadata: {
        jobId: job.id,
        policyId: data.policyId,
        dryRun: data.dryRun,
      },
    }).catch((err) => {
      logger.warn('Failed to log retention run start admin audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    // If dry run, just return the job
    if (data.dryRun) {
      await prisma.retentionCleanupJob.update({
        where: { id: job.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          recordsDeleted: 0,
        },
      });

      return job;
    }

    // Calculate cutoff date based on policy-specific retention days
    // const now = new Date();
    // Cutoff dates calculated but not used for deletion (preview-only for audit/admin/security logs)
    // These are calculated for future use when safe deletion pathway is established

    let recordsDeleted = 0;

    // IMPORTANT: Do NOT delete audit/admin/security logs to preserve append-only audit foundation
    // These are preview-only until hash-chain and DB immutability design is finalized
    // Only safe non-critical logs would be deleted here if schema clearly separates them
    
    // For now, retention run is effectively preview-only for audit/admin/security logs
    // This ensures we don't violate append-only audit expectations
    // Cutoff dates are calculated for future use when safe deletion pathway is established
    
    // Log destructive action with counts only
    await logDestructiveAction({
      action: 'retention_cleanup_executed',
      resourceType: 'retention_run',
      resourceId: job.id,
      actorId,
      role: actorRole,
      confirmationType: 'type_confirm',
      confirmationMatched: true,
      metadata: {
        jobId: job.id,
        policyId: data.policyId,
        recordsDeleted,
        note: 'Audit/admin/security logs preserved pending hash-chain and DB immutability design',
      },
    }).catch((err) => {
      logger.warn('Failed to log retention cleanup destructive action', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    // Update job as completed
    await prisma.retentionCleanupJob.update({
      where: { id: job.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        recordsDeleted,
      },
    });

    // Log admin audit event
    await logAdminOperation({
      action: 'retention_run_completed',
      module: 'retention',
      resourceType: 'retention_run',
      resourceId: job.id,
      actor: actorId,
      role: actorRole,
      metadata: {
        jobId: job.id,
        policyId: data.policyId,
        recordsDeleted,
      },
    }).catch((err) => {
      logger.warn('Failed to log retention run completion admin audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return job;
  } catch (error) {
    logger.error('Failed to run retention cleanup', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to run retention cleanup');
  }
}

/**
 * Get retention run by ID
 */
export async function getRetentionRunById(id: string) {
  try {
    const run = await prisma.retentionCleanupJob.findUnique({
      where: { id },
    });

    return run;
  } catch (error) {
    logger.error('Failed to get retention run by ID', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to get retention run');
  }
}

/**
 * List retention runs
 */
export async function listRetentionRuns() {
  try {
    const runs = await prisma.retentionCleanupJob.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return runs;
  } catch (error) {
    logger.error('Failed to list retention runs', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to list retention runs');
  }
}
