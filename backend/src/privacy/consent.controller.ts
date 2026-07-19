import { Response } from 'express';
import { logger } from '../utils/logger';
import {
  createConsentRecord as createConsentRecordService,
  getConsentRecordById as getConsentRecordByIdService,
  listConsentRecords as listConsentRecordsService,
  updateConsentRecord as updateConsentRecordService,
  revokeConsentRecord as revokeConsentRecordService,
} from './consent.service';
import {
  createConsentRecordSchema,
  updateConsentRecordSchema,
  revokeConsentSchema,
  consentListQuerySchema,
} from './privacy.validation';
import { successResponse, errorResponse } from '../utils/apiResponse';
import { AuthenticatedRequest } from '../auth/auth.types';

// ==================== CONSENT CONTROLLERS ====================

export async function createConsentRecord(req: AuthenticatedRequest, res: Response) {
  try {
    const validatedData = createConsentRecordSchema.parse(req.body);

    // Check permissions
    if (!req.user?.permissions.includes('manage_privacy') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to create consent records', 403);
      return;
    }

    const consent = await createConsentRecordService(validatedData, req.user.id, req.user.roles.join(','));

    successResponse(res, consent, 'Consent record created successfully', 201);
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid input data', 400);
      return;
    }
    if (error instanceof Error && error.message === 'Patient not suitable for consent record') {
      errorResponse(res, 'INVALID_PATIENT', error.message, 400);
      return;
    }
    logger.error('Create consent record controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to create consent record', 500);
  }
}

export async function getConsentRecordById(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    // Check permissions
    if (!req.user?.permissions.includes('view_privacy') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to view consent records', 403);
      return;
    }

    const consent = await getConsentRecordByIdService(id);

    if (!consent) {
      errorResponse(res, 'NOT_FOUND', 'Consent record not found', 404);
      return;
    }

    successResponse(res, consent, 'Consent record retrieved successfully');
  } catch (error) {
    logger.error('Get consent record by ID controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to get consent record', 500);
  }
}

export async function listConsentRecords(req: AuthenticatedRequest, res: Response) {
  try {
    const validatedQuery = consentListQuerySchema.parse(req.query);

    // Check permissions
    if (!req.user?.permissions.includes('view_privacy') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to view consent records', 403);
      return;
    }

    const result = await listConsentRecordsService(validatedQuery);

    successResponse(res, result, 'Consent records retrieved successfully');
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid query parameters', 400);
      return;
    }
    logger.error('List consent records controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to list consent records', 500);
  }
}

export async function updateConsentRecord(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const validatedData = updateConsentRecordSchema.parse(req.body);

    // Check permissions
    if (!req.user?.permissions.includes('manage_privacy') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to update consent records', 403);
      return;
    }

    const consent = await updateConsentRecordService(id, validatedData, req.user.id, req.user.roles.join(','));

    successResponse(res, consent, 'Consent record updated successfully');
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid input data', 400);
      return;
    }
    if (error instanceof Error && error.message === 'Consent record not found') {
      errorResponse(res, 'NOT_FOUND', 'Consent record not found', 404);
      return;
    }
    logger.error('Update consent record controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to update consent record', 500);
  }
}

export async function revokeConsentRecord(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const validatedData = revokeConsentSchema.parse(req.body);

    // Check permissions
    if (!req.user?.permissions.includes('manage_privacy') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to revoke consent records', 403);
      return;
    }

    const consent = await revokeConsentRecordService(id, validatedData, req.user.id, req.user.roles.join(','));

    successResponse(res, consent, 'Consent record revoked successfully');
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid input data', 400);
      return;
    }
    if (error instanceof Error && error.message === 'Consent record not found') {
      errorResponse(res, 'NOT_FOUND', 'Consent record not found', 404);
      return;
    }
    logger.error('Revoke consent record controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to revoke consent record', 500);
  }
}
