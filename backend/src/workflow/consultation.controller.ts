import { Response } from 'express';
import { logger } from '../utils/logger';
import {
  createConsultation as createConsultationService,
  getConsultationById as getConsultationByIdService,
  listConsultations as listConsultationsService,
  updateConsultation as updateConsultationService,
  updateConsultationStatus as updateConsultationStatusService,
  completeConsultation as completeConsultationService,
  cancelConsultation as cancelConsultationService,
} from './consultation.service';
import {
  createConsultationSchema,
  updateConsultationSchema,
  consultationStatusSchema,
  completeConsultationSchema,
  consultationListQuerySchema,
} from './workflow.validation';
import { successResponse, errorResponse } from '../utils/apiResponse';
import { AuthenticatedRequest } from '../auth/auth.types';

/**
 * Create consultation controller
 */
export async function createConsultation(req: AuthenticatedRequest, res: Response) {
  try {
    const validatedData = createConsultationSchema.parse(req.body);

    // Check permissions
    if (!req.user?.permissions.includes('edit_consultations') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to create consultations', 403);
      return;
    }

    const consultation = await createConsultationService(
      validatedData,
      req.user.id,
      req.user.roles.join(',')
    );

    successResponse(res, consultation, 'Consultation created successfully', 201);
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid input data', 400);
      return;
    }
    logger.error('Create consultation controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to create consultation', 500);
  }
}

/**
 * Get consultation by ID controller
 */
export async function getConsultationById(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    // Check permissions
    if (!req.user?.permissions.includes('view_consultations') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to view consultations', 403);
      return;
    }

    const consultation = await getConsultationByIdService(id);

    if (!consultation) {
      errorResponse(res, 'NOT_FOUND', 'Consultation not found', 404);
      return;
    }

    successResponse(res, consultation, 'Consultation retrieved successfully');
  } catch (error) {
    logger.error('Get consultation by ID controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to get consultation', 500);
  }
}

/**
 * List consultations controller
 */
export async function listConsultations(req: AuthenticatedRequest, res: Response) {
  try {
    const validatedQuery = consultationListQuerySchema.parse(req.query);

    // Check permissions
    if (!req.user?.permissions.includes('view_consultations') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to view consultations', 403);
      return;
    }

    const result = await listConsultationsService(validatedQuery);

    successResponse(res, result, 'Consultations retrieved successfully');
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid query parameters', 400);
      return;
    }
    logger.error('List consultations controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to list consultations', 500);
  }
}

/**
 * Update consultation controller
 */
export async function updateConsultation(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const validatedData = updateConsultationSchema.parse(req.body);

    // Check permissions
    if (!req.user?.permissions.includes('edit_consultations') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to update consultations', 403);
      return;
    }

    const consultation = await updateConsultationService(
      id,
      validatedData,
      req.user.id,
      req.user.roles.join(',')
    );

    successResponse(res, consultation, 'Consultation updated successfully');
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid input data', 400);
      return;
    }
    if (error instanceof Error && error.message === 'Consultation not found') {
      errorResponse(res, 'NOT_FOUND', 'Consultation not found', 404);
      return;
    }
    logger.error('Update consultation controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to update consultation', 500);
  }
}

/**
 * Update consultation status controller
 */
export async function updateConsultationStatus(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const validatedData = consultationStatusSchema.parse(req.body);

    // Check permissions
    if (!req.user?.permissions.includes('edit_consultations') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to update consultation status', 403);
      return;
    }

    const consultation = await updateConsultationStatusService(
      id,
      validatedData.status,
      req.user.id,
      req.user.roles.join(',')
    );

    successResponse(res, consultation, 'Consultation status updated successfully');
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid input data', 400);
      return;
    }
    if (error instanceof Error && error.message === 'Consultation not found') {
      errorResponse(res, 'NOT_FOUND', 'Consultation not found', 404);
      return;
    }
    if (error instanceof Error && error.message.includes('Invalid status transition')) {
      errorResponse(res, 'INVALID_TRANSITION', error.message, 400);
      return;
    }
    logger.error('Update consultation status controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to update consultation status', 500);
  }
}

/**
 * Complete consultation controller
 */
export async function completeConsultation(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const validatedData = completeConsultationSchema.parse(req.body);

    // Check permissions
    if (!req.user?.permissions.includes('edit_consultations') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to complete consultations', 403);
      return;
    }

    const consultation = await completeConsultationService(
      id,
      validatedData,
      req.user.id,
      req.user.roles.join(',')
    );

    successResponse(res, consultation, 'Consultation completed successfully');
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid input data', 400);
      return;
    }
    if (error instanceof Error && error.message === 'Consultation not found') {
      errorResponse(res, 'NOT_FOUND', 'Consultation not found', 404);
      return;
    }
    if (error instanceof Error && error.message.includes('Cannot complete')) {
      errorResponse(res, 'INVALID_STATE', error.message, 400);
      return;
    }
    logger.error('Complete consultation controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to complete consultation', 500);
  }
}

/**
 * Cancel consultation controller
 */
export async function cancelConsultation(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    // Check permissions
    if (!req.user?.permissions.includes('edit_consultations') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to cancel consultations', 403);
      return;
    }

    const consultation = await cancelConsultationService(id, req.user.id, req.user.roles.join(','));

    successResponse(res, consultation, 'Consultation cancelled successfully');
  } catch (error) {
    if (error instanceof Error && error.message === 'Consultation not found') {
      errorResponse(res, 'NOT_FOUND', 'Consultation not found', 404);
      return;
    }
    if (error instanceof Error && error.message.includes('Cannot cancel')) {
      errorResponse(res, 'INVALID_TRANSITION', error.message, 400);
      return;
    }
    logger.error('Cancel consultation controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to cancel consultation', 500);
  }
}
