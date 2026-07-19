import { Response } from 'express';
import { logger } from '../utils/logger';
import {
  createPrivacyRequest as createPrivacyRequestService,
  getPrivacyRequestById as getPrivacyRequestByIdService,
  listPrivacyRequests as listPrivacyRequestsService,
  updatePrivacyRequest as updatePrivacyRequestService,
  approvePrivacyRequest as approvePrivacyRequestService,
  rejectPrivacyRequest as rejectPrivacyRequestService,
  completePrivacyRequest as completePrivacyRequestService,
  cancelPrivacyRequest as cancelPrivacyRequestService,
} from './privacyRequest.service';
import {
  createPrivacyRequestSchema,
  updatePrivacyRequestSchema,
  privacyRequestListQuerySchema,
  privacyRequestDecisionSchema,
  privacyRequestCompletionSchema,
  privacyRequestIdParamSchema,
} from './privacy.validation';
import { successResponse, errorResponse } from '../utils/apiResponse';
import { AuthenticatedRequest } from '../auth/auth.types';

// ==================== PRIVACY REQUEST CONTROLLERS ====================

export async function createPrivacyRequest(req: AuthenticatedRequest, res: Response) {
  try {
    const validatedData = createPrivacyRequestSchema.parse(req.body);

    // Check permissions
    if (!req.user?.permissions.includes('manage_privacy') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to create privacy requests', 403);
      return;
    }

    const request = await createPrivacyRequestService(validatedData, req.user.id, req.user.roles.join(','));

    successResponse(res, request, 'Privacy request created successfully', 201);
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid input data', 400);
      return;
    }
    if (error instanceof Error && error.message === 'Patient not suitable for privacy request') {
      errorResponse(res, 'INVALID_PATIENT', error.message, 400);
      return;
    }
    logger.error('Create privacy request controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to create privacy request', 500);
  }
}

export async function getPrivacyRequestById(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    privacyRequestIdParamSchema.parse({ id });

    // Check permissions
    if (!req.user?.permissions.includes('view_privacy') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to view privacy requests', 403);
      return;
    }

    const request = await getPrivacyRequestByIdService(id);

    if (!request) {
      errorResponse(res, 'NOT_FOUND', 'Privacy request not found', 404);
      return;
    }

    successResponse(res, request, 'Privacy request retrieved successfully');
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid privacy request ID', 400);
      return;
    }
    logger.error('Get privacy request by ID controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to get privacy request', 500);
  }
}

export async function listPrivacyRequests(req: AuthenticatedRequest, res: Response) {
  try {
    const validatedQuery = privacyRequestListQuerySchema.parse(req.query);

    // Check permissions
    if (!req.user?.permissions.includes('view_privacy') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to view privacy requests', 403);
      return;
    }

    const result = await listPrivacyRequestsService(validatedQuery);

    successResponse(res, result, 'Privacy requests retrieved successfully');
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid query parameters', 400);
      return;
    }
    logger.error('List privacy requests controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to list privacy requests', 500);
  }
}

export async function updatePrivacyRequest(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    privacyRequestIdParamSchema.parse({ id });
    const validatedData = updatePrivacyRequestSchema.parse(req.body);

    // Check permissions
    if (!req.user?.permissions.includes('manage_privacy') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to update privacy requests', 403);
      return;
    }

    const request = await updatePrivacyRequestService(id, validatedData, req.user.id, req.user.roles.join(','));

    successResponse(res, request, 'Privacy request updated successfully');
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid input data', 400);
      return;
    }
    if (error instanceof Error && error.message === 'Privacy request not found') {
      errorResponse(res, 'NOT_FOUND', 'Privacy request not found', 404);
      return;
    }
    logger.error('Update privacy request controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to update privacy request', 500);
  }
}

export async function approvePrivacyRequest(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    privacyRequestIdParamSchema.parse({ id });
    const validatedData = privacyRequestDecisionSchema.parse(req.body);

    // Check permissions - admin only
    if (!req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to approve privacy requests', 403);
      return;
    }

    const request = await approvePrivacyRequestService(id, validatedData, req.user.id, req.user.roles.join(','));

    successResponse(res, request, 'Privacy request approved successfully');
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid input data', 400);
      return;
    }
    if (error instanceof Error && error.message === 'Privacy request not found') {
      errorResponse(res, 'NOT_FOUND', 'Privacy request not found', 404);
      return;
    }
    logger.error('Approve privacy request controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to approve privacy request', 500);
  }
}

export async function rejectPrivacyRequest(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    privacyRequestIdParamSchema.parse({ id });
    const validatedData = privacyRequestDecisionSchema.parse(req.body);

    // Check permissions - admin only
    if (!req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to reject privacy requests', 403);
      return;
    }

    const request = await rejectPrivacyRequestService(id, validatedData, req.user.id, req.user.roles.join(','));

    successResponse(res, request, 'Privacy request rejected successfully');
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid input data', 400);
      return;
    }
    if (error instanceof Error && error.message === 'Privacy request not found') {
      errorResponse(res, 'NOT_FOUND', 'Privacy request not found', 404);
      return;
    }
    logger.error('Reject privacy request controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to reject privacy request', 500);
  }
}

export async function completePrivacyRequest(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    privacyRequestIdParamSchema.parse({ id });
    const validatedData = privacyRequestCompletionSchema.parse(req.body);

    // Check permissions - admin only
    if (!req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to complete privacy requests', 403);
      return;
    }

    const request = await completePrivacyRequestService(id, validatedData, req.user.id, req.user.roles.join(','));

    successResponse(res, request, 'Privacy request completed successfully');
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid input data', 400);
      return;
    }
    if (error instanceof Error && error.message === 'Privacy request not found') {
      errorResponse(res, 'NOT_FOUND', 'Privacy request not found', 404);
      return;
    }
    logger.error('Complete privacy request controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to complete privacy request', 500);
  }
}

export async function cancelPrivacyRequest(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    privacyRequestIdParamSchema.parse({ id });

    // Check permissions - admin only
    if (!req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to cancel privacy requests', 403);
      return;
    }

    const request = await cancelPrivacyRequestService(id, req.user.id, req.user.roles.join(','));

    successResponse(res, request, 'Privacy request cancelled successfully');
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid privacy request ID', 400);
      return;
    }
    if (error instanceof Error && error.message === 'Privacy request not found') {
      errorResponse(res, 'NOT_FOUND', 'Privacy request not found', 404);
      return;
    }
    logger.error('Cancel privacy request controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to cancel privacy request', 500);
  }
}
