/**
 * Portability Controller
 * Handles HTTP requests for portability export package operations
 */

import { Response } from 'express';
import { logger } from '../utils/logger';
import { createPortabilityPackage } from './portability.service';
import { portabilityPackageCreateSchema } from './dataExchange.validation';
import { successResponse, errorResponse } from '../utils/apiResponse';
import { AuthenticatedRequest } from '../auth/auth.types';

/**
 * Create portability export package
 */
export async function createPortabilityPackageController(req: AuthenticatedRequest, res: Response) {
  try {
    const validatedData = portabilityPackageCreateSchema.parse(req.body);

    // Check permissions - admin or privacy manager only
    if (!req.user?.roles.includes('admin') && !req.user?.permissions.includes('privacy')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to create portability packages', 403);
      return;
    }

    const result = await createPortabilityPackage(
      validatedData.privacyRequestId,
      req.user.id,
      req.user.roles.join(',')
    );

    successResponse(res, result, 'Portability package created successfully');
  } catch (error) {
    if (error instanceof Error && error.message === 'Privacy request not found') {
      errorResponse(res, 'NOT_FOUND', 'Privacy request not found', 404);
      return;
    }
    if (error instanceof Error && error.message === 'Privacy request must be ACCESS or PORTABILITY type') {
      errorResponse(res, 'INVALID_REQUEST_TYPE', 'Privacy request must be ACCESS or PORTABILITY type', 400);
      return;
    }
    if (error instanceof Error && error.message === 'Privacy request must be in COMPLETED status') {
      errorResponse(res, 'INVALID_STATUS', 'Privacy request must be in COMPLETED status', 400);
      return;
    }
    logger.error('Create portability package controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to create portability package', 500);
  }
}
