/**
 * Import Controller
 * Handles HTTP requests for import operations
 */

import { Response } from 'express';
import { logger } from '../utils/logger';
import {
  createImportPreview,
  executeImport,
  cancelImportJob,
  listImportJobs,
  getImportJobById,
} from './import.service';
import {
  importPreviewSchema,
  importExecuteSchema,
  importJobListQuerySchema,
  importJobIdParamSchema,
} from './dataExchange.validation';
import { successResponse, errorResponse } from '../utils/apiResponse';
import { AuthenticatedRequest } from '../auth/auth.types';

/**
 * Create import preview
 */
export async function createImportPreviewController(req: AuthenticatedRequest, res: Response) {
  try {
    const validatedData = importPreviewSchema.parse(req.body);

    // Check permissions
    if (!req.user?.roles.includes('admin') && !req.user?.permissions.includes('import')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to import data', 403);
      return;
    }

    // For multipart upload, file is in req.file
    const fileBuffer = req.file ? req.file.buffer : Buffer.from('');
    
    const result = await createImportPreview(
      validatedData.dataType,
      validatedData.format,
      fileBuffer,
      req.user.id,
      req.user.roles.join(',')
    );

    successResponse(res, result, 'Import preview created successfully');
  } catch (error) {
    if (error instanceof Error && error.message === 'Invalid data type') {
      errorResponse(res, 'INVALID_DATA_TYPE', error.message, 400);
      return;
    }
    if (error instanceof Error && error.message === 'Invalid format') {
      errorResponse(res, 'INVALID_FORMAT', error.message, 400);
      return;
    }
    logger.error('Create import preview controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to create import preview', 500);
  }
}

/**
 * Execute import
 */
export async function executeImportController(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const validatedData = importExecuteSchema.parse(req.body);

    // Check permissions - admin only
    if (!req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'Only admins can execute imports', 403);
      return;
    }

    const result = await executeImport(
      id,
      validatedData.confirmation,
      validatedData.dryRun,
      req.user.id,
      req.user.roles.join(',')
    );

    successResponse(res, result, 'Import executed successfully');
  } catch (error) {
    if (error instanceof Error && error.message === 'Invalid confirmation') {
      errorResponse(res, 'INVALID_CONFIRMATION', 'Invalid confirmation string', 400);
      return;
    }
    if (error instanceof Error && error.message === 'Import job not found') {
      errorResponse(res, 'NOT_FOUND', 'Import job not found', 404);
      return;
    }
    if (error instanceof Error && error.message === 'Import job is not in PENDING status') {
      errorResponse(res, 'INVALID_STATUS', 'Import job is not in PENDING status', 400);
      return;
    }
    if (error instanceof Error && error.message === 'Cannot execute import with invalid rows') {
      errorResponse(res, 'INVALID_DATA', 'Cannot execute import with invalid rows. Use dryRun first.', 400);
      return;
    }
    logger.error('Execute import controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to execute import', 500);
  }
}

/**
 * Cancel import job
 */
export async function cancelImportJobController(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const validatedParams = importJobIdParamSchema.parse({ id });

    // Check permissions
    if (!req.user?.roles.includes('admin') && !req.user?.permissions.includes('import')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to cancel imports', 403);
      return;
    }

    const result = await cancelImportJob(validatedParams.id, req.user.id, req.user.roles.join(','));

    successResponse(res, result, 'Import job cancelled successfully');
  } catch (error) {
    if (error instanceof Error && error.message === 'Import job not found') {
      errorResponse(res, 'NOT_FOUND', 'Import job not found', 404);
      return;
    }
    if (error instanceof Error && error.message === 'Cannot cancel completed or failed job') {
      errorResponse(res, 'INVALID_STATUS', 'Cannot cancel completed or failed job', 400);
      return;
    }
    logger.error('Cancel import job controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to cancel import job', 500);
  }
}

/**
 * List import jobs
 */
export async function listImportJobsController(req: AuthenticatedRequest, res: Response) {
  try {
    const validatedQuery = importJobListQuerySchema.parse(req.query);

    // Check permissions
    if (!req.user?.roles.includes('admin') && !req.user?.permissions.includes('import')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to view import jobs', 403);
      return;
    }

    const result = await listImportJobs(validatedQuery);

    successResponse(res, result, 'Import jobs listed successfully');
  } catch (error) {
    logger.error('List import jobs controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to list import jobs', 500);
  }
}

/**
 * Get import job by ID
 */
export async function getImportJobByIdController(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const validatedParams = importJobIdParamSchema.parse({ id });

    // Check permissions
    if (!req.user?.roles.includes('admin') && !req.user?.permissions.includes('import')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to view import jobs', 403);
      return;
    }

    const result = await getImportJobById(validatedParams.id);

    successResponse(res, result, 'Import job retrieved successfully');
  } catch (error) {
    if (error instanceof Error && error.message === 'Import job not found') {
      errorResponse(res, 'NOT_FOUND', 'Import job not found', 404);
      return;
    }
    logger.error('Get import job controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to get import job', 500);
  }
}
