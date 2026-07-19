/**
 * Backup Service
 * Handles backup archive creation and restore preview with safety safeguards
 */

import { prisma } from '../db/client';
import { logger } from '../utils/logger';
import { logAuditEvent } from '../services/auditService';
import { logAdminOperation } from '../services/adminAuditService';
import { logDestructiveAction } from '../services/destructiveActionService';
import { BACKUP_CREATE_CONFIRMATION, BACKUP_RESTORE_CONFIRMATION } from './dataExchange.constants';

/**
 * Create backup archive
 */
export async function createBackupArchive(
  archiveType: string,
  confirmation: string,
  _description: string | undefined,
  actorId: string,
  actorRole: string
) {
  try {
    // Validate confirmation
    if (confirmation !== BACKUP_CREATE_CONFIRMATION) {
      throw new Error('Invalid confirmation');
    }

    // Validate archive type
    const validArchiveTypes = ['FULL', 'PATIENTS', 'BILLING', 'AUDIT'];
    if (!validArchiveTypes.includes(archiveType)) {
      throw new Error(`Invalid archive type: ${archiveType}`);
    }

    // Fetch data based on archive type
    const backupData = await fetchBackupData(archiveType);

    // Generate backup file (storage integration foundation - not fully wired for generated backup files yet)
    const fileContent = JSON.stringify(backupData, null, 2);
    const fileUrl = `backups/${archiveType.toLowerCase()}_${Date.now()}.json`;

    // Create backup archive record
    const backupArchive = await prisma.backupArchive.create({
      data: {
        archiveType,
        fileUrl,
        fileSize: fileContent.length,
        createdBy: actorId,
        expiresAt: null,
      },
    });

    // Log destructive action for backup creation
    await logDestructiveAction({
      actorId,
      action: 'backup_archive_created',
      resourceType: 'backup_archive',
      resourceId: backupArchive.id,
      role: actorRole,
      confirmationType: 'type_confirm',
      confirmationMatched: confirmation === BACKUP_CREATE_CONFIRMATION,
      metadata: {
        backupArchiveId: backupArchive.id,
        archiveType,
        sizeBytes: fileContent.length,
        recordCounts: Object.fromEntries(
          Object.entries(backupData).map(([key, value]) => [key, Array.isArray(value) ? value.length : 0])
        ),
      },
    }).catch((err: unknown) => {
      logger.warn('Failed to log destructive action for backup creation', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    // Log admin audit event
    await logAdminOperation({
      action: 'backup_archive_created',
      module: 'data_exchange',
      resourceType: 'backup_archive',
      resourceId: backupArchive.id,
      actor: actorId,
      role: actorRole,
      metadata: {
        backupArchiveId: backupArchive.id,
        archiveType,
        sizeBytes: fileContent.length,
        recordCounts: Object.fromEntries(
          Object.entries(backupData).map(([key, value]) => [key, Array.isArray(value) ? value.length : 0])
        ),
      },
    }).catch((err: unknown) => {
      logger.warn('Failed to log backup creation admin audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return {
      backupArchiveId: backupArchive.id,
      archiveType: backupArchive.archiveType,
      sizeBytes: backupArchive.fileSize,
      dataTypes: Object.keys(backupData),
      recordCounts: Object.fromEntries(
        Object.entries(backupData).map(([key, value]) => [key, Array.isArray(value) ? value.length : 0])
      ),
      createdBy: backupArchive.createdBy,
      createdAt: backupArchive.createdAt,
      checksum: generateChecksum(fileContent),
    };
  } catch (error) {
    logger.error('Failed to create backup archive', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to create backup archive');
  }
}

/**
 * List backup archives
 */
export async function listBackupArchives(filters: { archiveType?: string; page?: number; limit?: number }) {
  try {
    const { archiveType, page = 1, limit = 20 } = filters;

    const where: any = {};
    if (archiveType) where.archiveType = archiveType;

    const [archives, total] = await Promise.all([
      prisma.backupArchive.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.backupArchive.count({ where }),
    ]);

    return {
      archives: archives.map((archive) => ({
        backupArchiveId: archive.id,
        archiveType: archive.archiveType,
        sizeBytes: archive.fileSize,
        dataTypes: [],
        recordCounts: {},
        createdBy: archive.createdBy,
        createdAt: archive.createdAt,
        expiresAt: archive.expiresAt,
        checksum: undefined,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  } catch (error) {
    logger.error('Failed to list backup archives', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to list backup archives');
  }
}

/**
 * Get backup archive by ID
 */
export async function getBackupArchiveById(backupArchiveId: string) {
  try {
    const archive = await prisma.backupArchive.findUnique({
      where: { id: backupArchiveId },
    });

    if (!archive) {
      throw new Error('Backup archive not found');
    }

    return {
      backupArchiveId: archive.id,
      archiveType: archive.archiveType,
      sizeBytes: archive.fileSize,
      dataTypes: [],
      recordCounts: {},
      createdBy: archive.createdBy,
      createdAt: archive.createdAt,
      expiresAt: archive.expiresAt,
      checksum: undefined,
    };
  } catch (error) {
    logger.error('Failed to get backup archive', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to get backup archive');
  }
}

/**
 * Download backup archive
 */
export async function downloadBackupArchive(backupArchiveId: string, actorId: string, actorRole: string) {
  try {
    const archive = await prisma.backupArchive.findUnique({
      where: { id: backupArchiveId },
    });

    if (!archive) {
      throw new Error('Backup archive not found');
    }

    // Log audit event
    await logAuditEvent({
      action: 'backup_archive_downloaded',
      resourceType: 'backup_archive',
      resourceId: backupArchiveId,
      actorId,
      actorRole,
      metadata: {
        backupArchiveId,
      },
    }).catch((err: unknown) => {
      logger.warn('Failed to log backup download audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    // Foundation: return file URL (in production, would stream from storage)
    return {
      fileUrl: archive.fileUrl,
      fileName: `backup_${backupArchiveId}.json`,
    };
  } catch (error) {
    logger.error('Failed to download backup archive', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to download backup archive');
  }
}

/**
 * Restore preview (foundation only - returns counts only, writes nothing)
 */
export async function restorePreview(backupArchiveId: string, actorId: string, actorRole: string) {
  try {
    const archive = await prisma.backupArchive.findUnique({
      where: { id: backupArchiveId },
    });

    if (!archive) {
      throw new Error('Backup archive not found');
    }

    // Foundation: return preview with counts only
    const previewResult = {
      canRestore: true,
      schemaVersion: '1.0.0',
      recordCounts: {},
      conflicts: [],
      warnings: ['Restore execution is foundation only - not implemented'],
    };

    // Log audit event
    await logAuditEvent({
      action: 'backup_restore_previewed',
      resourceType: 'backup_archive',
      resourceId: backupArchiveId,
      actorId,
      actorRole,
      metadata: {
        backupArchiveId,
      },
    }).catch((err: unknown) => {
      logger.warn('Failed to log restore preview audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return previewResult;
  } catch (error) {
    logger.error('Failed to create restore preview', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to create restore preview');
  }
}

/**
 * Restore backup (foundation only - disabled for safety)
 */
export async function restoreBackup(
  backupArchiveId: string,
  confirmation: string,
  dryRun: boolean,
  actorId: string,
  actorRole: string
) {
  try {
    // Validate confirmation
    if (confirmation !== BACKUP_RESTORE_CONFIRMATION) {
      throw new Error('Invalid confirmation');
    }

    // Log destructive action for restore attempt
    await logDestructiveAction({
      actorId,
      action: 'backup_restore_attempted',
      resourceType: 'backup_archive',
      resourceId: backupArchiveId,
      role: actorRole,
      confirmationType: 'type_confirm',
      confirmationMatched: confirmation === BACKUP_RESTORE_CONFIRMATION,
      metadata: {
        backupArchiveId,
        dryRun,
      },
    }).catch((err: unknown) => {
      logger.warn('Failed to log destructive action for restore attempt', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    // Foundation: restore is disabled for safety
    logger.warn('Backup restore is foundation only - disabled for safety', { backupArchiveId });

    if (!dryRun) {
      throw new Error('Backup restore execution is disabled for safety. Use dryRun only.');
    }

    // Dry run - just return preview
    return await restorePreview(backupArchiveId, actorId, actorRole);
  } catch (error) {
    logger.error('Failed to restore backup', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to restore backup');
  }
}

/**
 * Fetch backup data based on archive type
 */
async function fetchBackupData(archiveType: string): Promise<Record<string, any[]>> {
  const data: Record<string, any[]> = {};

  switch (archiveType) {
    case 'FULL':
      // Foundation: fetch all data types
      data.patients = await prisma.patient.findMany({ select: { id: true, externalId: true, firstName: true, lastName: true } });
      data.appointments = await prisma.appointment.findMany({ select: { id: true, patientId: true, status: true } });
      data.consultations = await prisma.consultation.findMany({ select: { id: true, patientId: true, status: true } });
      data.prescriptions = await prisma.prescription.findMany({ select: { id: true, patientId: true, status: true } });
      data.invoices = await prisma.invoice.findMany({ select: { id: true, invoiceNumber: true, totalAmount: true } });
      break;

    case 'PATIENTS':
      data.patients = await prisma.patient.findMany({ select: { id: true, externalId: true, firstName: true, lastName: true } });
      break;

    case 'BILLING':
      data.invoices = await prisma.invoice.findMany({ select: { id: true, invoiceNumber: true, totalAmount: true } });
      data.payments = await prisma.payment.findMany({ select: { id: true, amount: true, status: true } });
      break;

    case 'AUDIT':
      data.auditLogs = await prisma.auditLog.findMany({ select: { id: true, action: true, resourceType: true, createdAt: true } });
      data.adminAuditLogs = await prisma.adminAuditLog.findMany({ select: { id: true, action: true, module: true, createdAt: true } });
      break;

    default:
      break;
  }

  return data;
}

/**
 * Generate checksum (simple hash for foundation)
 */
function generateChecksum(content: string): string {
  // Foundation: simple hash - in production would use proper crypto
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}
