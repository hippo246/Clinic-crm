import { Response } from 'express';
import { logger } from '../utils/logger';
import {
  createPrescription as createPrescriptionService,
  getPrescriptionById as getPrescriptionByIdService,
  listPrescriptions as listPrescriptionsService,
  updatePrescription as updatePrescriptionService,
  updatePrescriptionStatus as updatePrescriptionStatusService,
  refillPrescription as refillPrescriptionService,
  discontinuePrescription as discontinuePrescriptionService,
} from './prescription.service';
import {
  createPrescriptionSchema,
  updatePrescriptionSchema,
  prescriptionStatusSchema,
  prescriptionRefillSchema,
  prescriptionListQuerySchema,
} from './workflow.validation';
import { successResponse, errorResponse } from '../utils/apiResponse';
import { AuthenticatedRequest } from '../auth/auth.types';

/**
 * Create prescription controller
 */
export async function createPrescription(req: AuthenticatedRequest, res: Response) {
  try {
    const validatedData = createPrescriptionSchema.parse(req.body);

    // Check permissions
    if (!req.user?.permissions.includes('edit_prescriptions') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to create prescriptions', 403);
      return;
    }

    const prescription = await createPrescriptionService(
      validatedData,
      req.user.id,
      req.user.roles.join(',')
    );

    successResponse(res, prescription, 'Prescription created successfully', 201);
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid input data', 400);
      return;
    }
    logger.error('Create prescription controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to create prescription', 500);
  }
}

/**
 * Get prescription by ID controller
 */
export async function getPrescriptionById(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    // Check permissions
    if (!req.user?.permissions.includes('view_prescriptions') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to view prescriptions', 403);
      return;
    }

    const prescription = await getPrescriptionByIdService(id);

    if (!prescription) {
      errorResponse(res, 'NOT_FOUND', 'Prescription not found', 404);
      return;
    }

    successResponse(res, prescription, 'Prescription retrieved successfully');
  } catch (error) {
    logger.error('Get prescription by ID controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to get prescription', 500);
  }
}

/**
 * List prescriptions controller
 */
export async function listPrescriptions(req: AuthenticatedRequest, res: Response) {
  try {
    const validatedQuery = prescriptionListQuerySchema.parse(req.query);

    // Check permissions
    if (!req.user?.permissions.includes('view_prescriptions') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to view prescriptions', 403);
      return;
    }

    const result = await listPrescriptionsService(validatedQuery);

    successResponse(res, result, 'Prescriptions retrieved successfully');
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid query parameters', 400);
      return;
    }
    logger.error('List prescriptions controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to list prescriptions', 500);
  }
}

/**
 * Update prescription controller
 */
export async function updatePrescription(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const validatedData = updatePrescriptionSchema.parse(req.body);

    // Check permissions
    if (!req.user?.permissions.includes('edit_prescriptions') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to update prescriptions', 403);
      return;
    }

    const prescription = await updatePrescriptionService(
      id,
      validatedData,
      req.user.id,
      req.user.roles.join(',')
    );

    successResponse(res, prescription, 'Prescription updated successfully');
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid input data', 400);
      return;
    }
    if (error instanceof Error && error.message === 'Prescription not found') {
      errorResponse(res, 'NOT_FOUND', 'Prescription not found', 404);
      return;
    }
    logger.error('Update prescription controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to update prescription', 500);
  }
}

/**
 * Update prescription status controller
 */
export async function updatePrescriptionStatus(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const validatedData = prescriptionStatusSchema.parse(req.body);

    // Check permissions
    if (!req.user?.permissions.includes('edit_prescriptions') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to update prescription status', 403);
      return;
    }

    const prescription = await updatePrescriptionStatusService(
      id,
      validatedData.status,
      req.user.id,
      req.user.roles.join(',')
    );

    successResponse(res, prescription, 'Prescription status updated successfully');
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid input data', 400);
      return;
    }
    if (error instanceof Error && error.message === 'Prescription not found') {
      errorResponse(res, 'NOT_FOUND', 'Prescription not found', 404);
      return;
    }
    if (error instanceof Error && error.message.includes('Invalid status transition')) {
      errorResponse(res, 'INVALID_TRANSITION', error.message, 400);
      return;
    }
    logger.error('Update prescription status controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to update prescription status', 500);
  }
}

/**
 * Refill prescription controller
 */
export async function refillPrescription(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const validatedData = prescriptionRefillSchema.parse(req.body);

    // Check permissions
    if (!req.user?.permissions.includes('edit_prescriptions') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to refill prescriptions', 403);
      return;
    }

    const prescription = await refillPrescriptionService(
      id,
      validatedData,
      req.user.id,
      req.user.roles.join(',')
    );

    successResponse(res, prescription, 'Prescription refilled successfully');
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid input data', 400);
      return;
    }
    if (error instanceof Error && error.message === 'Prescription not found') {
      errorResponse(res, 'NOT_FOUND', 'Prescription not found', 404);
      return;
    }
    if (error instanceof Error && error.message.includes('Cannot refill')) {
      errorResponse(res, 'INVALID_STATE', error.message, 400);
      return;
    }
    logger.error('Refill prescription controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to refill prescription', 500);
  }
}

/**
 * Discontinue prescription controller
 */
export async function discontinuePrescription(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    // Check permissions
    if (!req.user?.permissions.includes('edit_prescriptions') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to discontinue prescriptions', 403);
      return;
    }

    const prescription = await discontinuePrescriptionService(id, req.user.id, req.user.roles.join(','));

    successResponse(res, prescription, 'Prescription discontinued successfully');
  } catch (error) {
    if (error instanceof Error && error.message === 'Prescription not found') {
      errorResponse(res, 'NOT_FOUND', 'Prescription not found', 404);
      return;
    }
    if (error instanceof Error && error.message.includes('Cannot discontinue')) {
      errorResponse(res, 'INVALID_TRANSITION', error.message, 400);
      return;
    }
    logger.error('Discontinue prescription controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to discontinue prescription', 500);
  }
}
