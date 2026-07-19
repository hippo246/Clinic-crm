/**
 * Backup Controller
 * Handles HTTP requests for backup operations
 */

import { Response } from 'express';
import { logger } from '../utils/logger';
import {
  createBackupArchive,
  listBackupArchives,
  getBackupArchiveById,
  downloadBackupArchive,
  restorePreview,
  restoreBackup,
} from './backup.service';
import {
  backupCreateSchema,
  backupArchiveListQuerySchema,
  backupArchiveIdParamSchema,
  backupRestorePreviewSchema,
  backupRestoreExecuteSchema,
} from './dataExchange.validation';
import { successResponse, errorResponse } from '../utils/apiResponse';
import { AuthenticatedRequest } from '../auth/auth.types';

/**
 * Create backup archive
 */
export async function createBackupArchiveController(req: AuthenticatedRequest, res: Response) {
  try {
    const validatedData = backupCreateSchema.parse(req.body);

    // Check permissions - admin only
    if (!req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'Only admins can create backups', 403);
      return;
    }

    const result = await createBackupArchive(
      validatedData.archiveType,
      validatedData.confirmation,
      validatedData.description,
      req.user.id,
      req.user.roles.join(',')
    );

    successResponse(res, result, 'Backup archive created successfully');
  } catch (error) {
    if (error instanceof Error && error.message === 'Invalid confirmation') {
      errorResponse(res, 'INVALID_CONFIRMATION', 'Invalid confirmation string', 400);
      return;
    }
    if (error instanceof Error && error.message === 'Invalid archive type') {
      errorResponse(res, 'INVALID_ARCHIVE_TYPE', error.message, 400);
      return;
    }
    logger.error('Create backup archive controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to create backup archive', 500);
  }
}

/**
 * List backup archives
 */
export async function listBackupArchivesController(req: AuthenticatedRequest, res: Response) {
  try {
    const validatedQuery = backupArchiveListQuerySchema.parse(req.query);

    // Check permissions - admin only
    if (!req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'Only admins can view backups', 403);
      return;
    }

    const result = await listBackupArchives(validatedQuery);

    successResponse(res, result, 'Backup archives listed successfully');
  } catch (error) {
    logger.error('List backup archives controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to list backup archives', 500);
  }
}

/**
 * Get backup archive by ID
 */
export async function getBackupArchiveByIdController(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const validatedParams = backupArchiveIdParamSchema.parse({ id });

    // Check permissions - admin only
    if (!req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'Only admins can view backups', 403);
      return;
    }

    const result = await getBackupArchiveById(validatedParams.id);

    successResponse(res, result, 'Backup archive retrieved successfully');
  } catch (error) {
    if (error instanceof Error && error.message === 'Backup archive not found') {
      errorResponse(res, 'NOT_FOUND', 'Backup archive not found', 404);
      return;
    }
    logger.error('Get backup archive controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to get backup archive', 500);
  }
}

/**
 * Download backup archive
 */
export async function downloadBackupArchiveController(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const validatedParams = backupArchiveIdParamSchema.parse({ id });

    // Check permissions - admin only
    if (!req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'Only admins can download backups', 403);
      return;
    }

    const result = await downloadBackupArchive(validatedParams.id, req.user.id, req.user.roles.join(','));

    successResponse(res, result, 'Backup archive download URL generated');
  } catch (error) {
    if (error instanceof Error && error.message === 'Backup archive not found') {
      errorResponse(res, 'NOT_FOUND', 'Backup archive not found', 404);
      return;
    }
    logger.error('Download backup archive controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to download backup archive', 500);
  }
}

/**
 * Restore preview
 */
export async function restorePreviewController(req: AuthenticatedRequest, res: Response) {
  try {
    const validatedData = backupRestorePreviewSchema.parse(req.body);

    // Check permissions - admin only
    if (!req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'Only admins can preview restores', 403);
      return;
    }

    const result = await restorePreview(validatedData.backupArchiveId, req.user.id, req.user.roles.join(','));

    successResponse(res, result, 'Restore preview generated successfully');
  } catch (error) {
    if (error instanceof Error && error.message === 'Backup archive not found') {
      errorResponse(res, 'NOT_FOUND', 'Backup archive not found', 404);
      return;
    }
    logger.error('Restore preview controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to create restore preview', 500);
  }
}

/**
 * Restore backup (foundation only - disabled for safety)
 */
export async function restoreBackupController(req: AuthenticatedRequest, res: Response) {
  try {
    const validatedData = backupRestoreExecuteSchema.parse(req.body);

    // Check permissions - admin only
    if (!req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'Only admins can restore backups', 403);
      return;
    }

    const result = await restoreBackup(
      validatedData.backupArchiveId,
      validatedData.confirmation,
      validatedData.dryRun,
      req.user.id,
      req.user.roles.join(',')
    );

    successResponse(res, result, 'Backup restore executed successfully');
  } catch (error) {
    if (error instanceof Error && error.message === 'Invalid confirmation') {
      errorResponse(res, 'INVALID_CONFIRMATION', 'Invalid confirmation string', 400);
      return;
    }
    if (error instanceof Error && error.message === 'Backup restore is foundation only - disabled for safety') {
      errorResponse(res, 'DISABLED', 'Backup restore execution is disabled for safety. Use dryRun only.', 400);
      return;
    }
    logger.error('Restore backup controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to restore backup', 500);
  }
}
