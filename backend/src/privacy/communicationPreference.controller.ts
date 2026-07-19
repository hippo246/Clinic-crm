import { Response } from 'express';
import { logger } from '../utils/logger';
import {
  getCommunicationPreferences as getCommunicationPreferencesService,
  updateCommunicationPreference as updateCommunicationPreferenceService,
  optOutCommunication as optOutCommunicationService,
  optInCommunication as optInCommunicationService,
} from './communicationPreference.service';
import {
  updateCommunicationPreferenceSchema,
  optOutSchema,
  optInSchema,
} from './privacy.validation';
import { successResponse, errorResponse } from '../utils/apiResponse';
import { AuthenticatedRequest } from '../auth/auth.types';

// ==================== COMMUNICATION PREFERENCE CONTROLLERS ====================

export async function getCommunicationPreferences(req: AuthenticatedRequest, res: Response) {
  try {
    const { patientId } = req.params;

    // Check permissions
    if (!req.user?.permissions.includes('view_privacy') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to view communication preferences', 403);
      return;
    }

    const preferences = await getCommunicationPreferencesService(patientId);

    successResponse(res, preferences, 'Communication preferences retrieved successfully');
  } catch (error) {
    logger.error('Get communication preferences controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to get communication preferences', 500);
  }
}

export async function updateCommunicationPreference(req: AuthenticatedRequest, res: Response) {
  try {
    const { patientId } = req.params;
    const validatedData = updateCommunicationPreferenceSchema.parse(req.body);

    // Check permissions
    if (!req.user?.permissions.includes('manage_privacy') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to update communication preferences', 403);
      return;
    }

    const preference = await updateCommunicationPreferenceService(patientId, validatedData, req.user.id, req.user.roles.join(','));

    successResponse(res, preference, 'Communication preference updated successfully');
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid input data', 400);
      return;
    }
    if (error instanceof Error && error.message === 'Patient not suitable for communication preference update') {
      errorResponse(res, 'INVALID_PATIENT', error.message, 400);
      return;
    }
    logger.error('Update communication preference controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to update communication preference', 500);
  }
}

export async function optOutCommunication(req: AuthenticatedRequest, res: Response) {
  try {
    const { patientId } = req.params;
    const validatedData = optOutSchema.parse(req.body);

    // Check permissions
    if (!req.user?.permissions.includes('manage_privacy') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to update communication preferences', 403);
      return;
    }

    const preference = await optOutCommunicationService(patientId, validatedData, req.user.id, req.user.roles.join(','));

    successResponse(res, preference, 'Communication opt-out recorded successfully');
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid input data', 400);
      return;
    }
    if (error instanceof Error && error.message === 'Patient not suitable for communication opt-out') {
      errorResponse(res, 'INVALID_PATIENT', error.message, 400);
      return;
    }
    logger.error('Opt out communication controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to opt out of communication', 500);
  }
}

export async function optInCommunication(req: AuthenticatedRequest, res: Response) {
  try {
    const { patientId } = req.params;
    const validatedData = optInSchema.parse(req.body);

    // Check permissions
    if (!req.user?.permissions.includes('manage_privacy') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to update communication preferences', 403);
      return;
    }

    const preference = await optInCommunicationService(patientId, validatedData, req.user.id, req.user.roles.join(','));

    successResponse(res, preference, 'Communication opt-in recorded successfully');
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid input data', 400);
      return;
    }
    if (error instanceof Error && error.message === 'Patient not suitable for communication opt-in') {
      errorResponse(res, 'INVALID_PATIENT', error.message, 400);
      return;
    }
    logger.error('Opt in communication controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to opt in to communication', 500);
  }
}
