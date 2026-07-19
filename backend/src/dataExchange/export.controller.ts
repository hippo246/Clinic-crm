/**
 * Export Controller
 * Handles HTTP requests for export operations
 */

import { Response } from 'express';
import { logger } from '../utils/logger';
import {
  createExportJob,
  listExportJobs,
  getExportJobById,
  downloadExportFile,
  cancelExportJob,
} from './export.service';
import {
  exportCreateSchema,
  exportJobListQuerySchema,
  exportJobIdParamSchema,
} from './dataExchange.validation';
import { successResponse, errorResponse } from '../utils/apiResponse';
import { AuthenticatedRequest } from '../auth/auth.types';

/**
 * Create export job
 */
export async function createExportJobController(req: AuthenticatedRequest, res: Response) {
  try {
    const validatedData = exportCreateSchema.parse(req.body);

    // Check permissions
    if (!req.user?.roles.includes('admin') && !req.user?.permissions.includes('export')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to export data', 403);
      return;
    }

    const result = await createExportJob(
      validatedData.dataType,
      validatedData.format,
      validatedData.filters,
      validatedData.dateRange as { from: string; to: string } | undefined,
      validatedData.isFullPhi,
      validatedData.confirmation,
      req.user.id,
      req.user.roles.join(',')
    );

    successResponse(res, result, 'Export job created successfully');
  } catch (error) {
    if (error instanceof Error && error.message === 'Invalid data type') {
      errorResponse(res, 'INVALID_DATA_TYPE', error.message, 400);
      return;
    }
    if (error instanceof Error && error.message === 'Invalid format') {
      errorResponse(res, 'INVALID_FORMAT', error.message, 400);
      return;
    }
    if (error instanceof Error && error.message === 'Full PHI export requires admin role') {
      errorResponse(res, 'PERMISSION_DENIED', 'Full PHI export requires admin role', 403);
      return;
    }
    if (error instanceof Error && error.message === 'Invalid confirmation for full PHI export') {
      errorResponse(res, 'INVALID_CONFIRMATION', 'Invalid confirmation for full PHI export', 400);
      return;
    }
    logger.error('Create export job controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to create export job', 500);
  }
}

/**
 * List export jobs
 */
export async function listExportJobsController(req: AuthenticatedRequest, res: Response) {
  try {
    const validatedQuery = exportJobListQuerySchema.parse(req.query);

    // Check permissions
    if (!req.user?.roles.includes('admin') && !req.user?.permissions.includes('export')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to view export jobs', 403);
      return;
    }

    const result = await listExportJobs(validatedQuery);

    successResponse(res, result, 'Export jobs listed successfully');
  } catch (error) {
    logger.error('List export jobs controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to list export jobs', 500);
  }
}

/**
 * Get export job by ID
 */
export async function getExportJobByIdController(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const validatedParams = exportJobIdParamSchema.parse({ id });

    // Check permissions
    if (!req.user?.roles.includes('admin') && !req.user?.permissions.includes('export')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to view export jobs', 403);
      return;
    }

    const result = await getExportJobById(validatedParams.id);

    successResponse(res, result, 'Export job retrieved successfully');
  } catch (error) {
    if (error instanceof Error && error.message === 'Export job not found') {
      errorResponse(res, 'NOT_FOUND', 'Export job not found', 404);
      return;
    }
    logger.error('Get export job controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to get export job', 500);
  }
}

/**
 * Download export file
 */
export async function downloadExportFileController(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const validatedParams = exportJobIdParamSchema.parse({ id });

    // Check permissions
    if (!req.user?.roles.includes('admin') && !req.user?.permissions.includes('export')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to download exports', 403);
      return;
    }

    const result = await downloadExportFile(validatedParams.id, req.user.id, req.user.roles.join(','));

    successResponse(res, result, 'Export file download URL generated');
  } catch (error) {
    if (error instanceof Error && error.message === 'Export job not found') {
      errorResponse(res, 'NOT_FOUND', 'Export job not found', 404);
      return;
    }
    if (error instanceof Error && error.message === 'Export job is not completed') {
      errorResponse(res, 'INVALID_STATUS', 'Export job is not completed', 400);
      return;
    }
    if (error instanceof Error && error.message === 'Export file not available') {
      errorResponse(res, 'FILE_NOT_AVAILABLE', 'Export file not available', 404);
      return;
    }
    logger.error('Download export file controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to download export file', 500);
  }
}

/**
 * Cancel export job
 */
export async function cancelExportJobController(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const validatedParams = exportJobIdParamSchema.parse({ id });

    // Check permissions
    if (!req.user?.roles.includes('admin') && !req.user?.permissions.includes('export')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to cancel exports', 403);
      return;
    }

    const result = await cancelExportJob(validatedParams.id, req.user.id, req.user.roles.join(','));

    successResponse(res, result, 'Export job cancelled successfully');
  } catch (error) {
    if (error instanceof Error && error.message === 'Export job not found') {
      errorResponse(res, 'NOT_FOUND', 'Export job not found', 404);
      return;
    }
    if (error instanceof Error && error.message === 'Cannot cancel completed or failed job') {
      errorResponse(res, 'INVALID_STATUS', 'Cannot cancel completed or failed job', 400);
      return;
    }
    logger.error('Cancel export job controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to cancel export job', 500);
  }
}
